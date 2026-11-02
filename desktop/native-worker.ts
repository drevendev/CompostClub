import { readFile, writeFile, open, rename, mkdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NativeUI } from './native-ui';
import { CoherentController } from './coherent-controller';
import { CoherentStore } from './coherent-store';
import { NativeCredentialStore, windowsProtection } from './native-credentials';
import { ClaudeRuntime } from './claude-runtime';
import { GroqRuntime } from './groq-runtime';
import { OwnedOllama } from './runtime';
import { ownProfile } from './profile-owner';
import { createDesktopObserver } from './telemetry';
import { isAuthorLink } from '../src/content/author';
import { startOperator, type OperatorHandle } from './operator';
import { safeUrl } from '../src/domain/coherent/prepare';
import { hash } from '../src/domain/coherent/hash';
import type { DesktopServices } from './controller';
import { rendererCommand, inferenceOperations } from './webview-protocol';

async function main() {
  const argument = (name: string) => {
    const index = process.argv.indexOf(name);
    return index < 0 ? '' : (process.argv[index + 1] ?? '');
  };
  const directory = argument('--data-dir'),
    packageRoot = argument('--package-root');
  const webview = process.argv.includes('--webview');
  if (!path.isAbsolute(directory) || !path.isAbsolute(packageRoot))
    throw Error('Explicit native profile and package paths are required.');
  const owner = await ownProfile(directory, webview ? 'webview' : 'wpf');
  const send = (value: unknown) => {
    if (!process.stdout.destroyed) process.stdout.write(JSON.stringify(value) + '\n');
  };
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  let closing = false;
  let interrupting = Promise.resolve();
  const handles: { operator?: OperatorHandle } = {};
  function service(kind: string, payload: unknown = {}) {
    return new Promise<unknown>((resolve, reject) => {
      if (process.stdin.destroyed) return reject(new Error('Native window disconnected.'));
      const id = randomUUID();
      pending.set(id, { resolve, reject });
      send({ type: 'service', id, kind, payload });
    });
  }
  async function saveBackup(raw: string) {
    CoherentStore.parseBackup(raw);
    const file = await service('saveBackup');
    if (typeof file !== 'string' || !file) return false;
    if (!path.isAbsolute(file)) throw Error('Choose an absolute backup path.');
    const temporary = file + '.' + randomUUID() + '.pending';
    const handle = await open(temporary, 'wx', 0o600);
    try {
      await handle.writeFile(raw);
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (hash(await readFile(temporary)) !== hash(raw)) throw Error('Backup verification failed.');
    await rename(temporary, file);
    return true;
  }
  let autostart = false;
  const services: DesktopServices = {
    pick: async (kind) => {
      const v = await service('pick', { kind });
      if (!Array.isArray(v) || v.some((x) => typeof x !== 'string'))
        throw Error('Invalid native file selection.');
      return v as string[];
    },
    confirm: async (message) => (await service('confirm', { message })) === true,
    saveBackup,
    openDirectory: async (directory) => {
      await service('openDirectory', { directory });
    },
    autostart: async (enabled) => {
      autostart = (await service('autostart', { enabled })) === true;
    },
    autostartEnabled: () => autostart,
  };
  const protect = windowsProtection(path.join(packageRoot, 'native-dpapi.ps1'));
  const claudeTokens = new NativeCredentialStore(directory, 'claude', protect),
    groqKeys = new NativeCredentialStore(directory, 'groq', protect);
  await claudeTokens.initialize();
  await groqKeys.initialize();
  const store = new CoherentStore(directory);
  const telemetry = await createDesktopObserver(directory);
  const local = new OwnedOllama(),
    claude = new ClaudeRuntime(
      directory,
      () => store.state.claudeExecutable,
      undefined,
      undefined,
      claudeTokens,
      claudeTokens,
    ),
    groq = new GroqRuntime(groqKeys);
  // Acceptance/promotion checks can prohibit all inference even if a UI command is faulty.
  // No fake model output is injected into a real profile.
  if (process.env.COMPOST_NO_INFERENCE === '1') {
    const deny = () => {
      throw Error('Генерация отключена в этой проверке. Ни одного запроса не отправлено.');
    };
    local.generate = deny;
    groq.generate = deny;
    claude.generate = deny;
    local.start = deny;
  }
  const controller = new CoherentController(
    store,
    services,
    [packageRoot, directory],
    local,
    groq,
    claude,
    telemetry,
  );
  const external = async (url: string) => {
    if (
      !isAuthorLink(url) &&
      !store.state.references.some((r) => !r.removed && r.url === url && safeUrl(r.url) === url)
    )
      throw Error('Unapproved external link.');
    await service('openLink', { url });
  };
  const ui = new NativeUI(
    () => controller.view(),
    async (c) => {
      if (c.op === 'nativeLicenses') {
        await service('openDirectory', { directory: packageRoot });
        return;
      }
      if (
        process.env.COMPOST_NO_INFERENCE === '1' &&
        [
          'confirmRemote',
          'run',
          'tend',
          'decode',
          'proposePreferences',
          'revise',
          'checkNode',
          'check',
          'resume',
        ].includes(c.op)
      )
        throw Error('Генерация отключена в этой проверке.');
      await controller.command(c);
    },
    external,
  );
  const refresh = () =>
    webview
      ? send({ type: 'view', view: controller.view() })
      : send({ type: 'screen', screen: ui.render() });
  let dirty = false;
  controller.subscribe(() => {
    dirty = true;
  });
  let lastTick = Date.now(),
    tickBusy = false;
  const timer = setInterval(() => {
    if (closing) return;
    const now = Date.now();
    if (now - lastTick > 15000 && !tickBusy) {
      tickBusy = true;
      void controller
        .pause('Paused after sleep or delayed native host. Resume explicitly.')
        .finally(() => {
          tickBusy = false;
        });
    } else if (!tickBusy) controller.tick();
    lastTick = now;
    if (dirty) {
      dirty = false;
      if (webview) refresh();
      else
        send({ type: 'status', status: ui.status(), controls: ui.toolbarState(), changed: true });
    }
  }, 1000);
  async function shutdown(disconnected = false) {
    if (closing) return;
    closing = true;
    clearInterval(timer);
    try {
      await interrupting;
      await controller.close();
      await handles.operator?.close();
      await owner.close();
      send({ type: 'closed' });
      process.exitCode = 0;
      process.stdin.destroy();
    } catch (e) {
      closing = false;
      if (disconnected) {
        // Preserve evidence before allowing the orphan worker to exit. No UI service required.
        const raw = JSON.stringify(store.envelope());
        CoherentStore.parseBackup(raw);
        const file = path.join(
          directory,
          'emergency-native-exit-' + randomUUID() + '.private.json',
        );
        await writeFile(file, raw, { flag: 'wx', mode: 0o600 });
        await claude.saveSensitiveEmergency();
        await groq.saveSensitiveEmergency();
        store.close();
        await handles.operator?.close();
        await owner.close();
        process.exitCode = 1;
        process.stdin.destroy();
      } else {
        send({
          type: 'shutdownFailed',
          error: e instanceof Error ? e.message : 'Safe shutdown failed.',
        });
      }
    }
  }
  let queue = Promise.resolve();
  let buffer = '';
  let fatal = false;
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk: string) => {
    if (fatal) return;
    buffer += chunk;
    if (Buffer.byteLength(buffer) > 3 * 1024 * 1024) {
      fatal = true;
      send({ type: 'fatal', error: 'Native command exceeds the input limit.' });
      void shutdown(true);
      return;
    }
    let split: number;
    while ((split = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, split);
      buffer = buffer.slice(split + 1);
      let request: Record<string, unknown>;
      try {
        const value: unknown = JSON.parse(line);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error();
        request = value as Record<string, unknown>;
      } catch {
        send({ type: 'error', error: 'Invalid native protocol message.' });
        continue;
      }
      if (request.op === 'serviceResult') {
        const p = pending.get(String(request.id));
        if (p) {
          pending.delete(String(request.id));
          if (request.error) p.reject(new Error('Native dialog was not completed.'));
          else p.resolve(request.value);
        }
        continue;
      }
      if (webview && request.op === 'invoke') {
        try {
          request.command = rendererCommand(request.command);
          if (typeof request.id !== 'string' || !/^[\w-]{1,80}$/.test(request.id))
            throw Error('Invalid request identity.');
        } catch (e) {
          send({
            type: 'reply',
            id: request.id,
            error: e instanceof Error ? e.message : 'Invalid request.',
          });
          continue;
        }
        const command = request.command as import('./coherent-types').CoherentCommand;
        if (command.op === 'pause' || command.op === 'cancelRemote') {
          const stopped = controller
            .command(command)
            .then((view) => {
              send({ type: 'reply', id: request.id, view });
              refresh();
            })
            .catch((e: unknown) =>
              send({
                type: 'reply',
                id: request.id,
                error: e instanceof Error ? e.message : 'Cancellation failed.',
              }),
            );
          interrupting = Promise.all([interrupting, stopped]).then(() => {});
          continue;
        }
      }
      if (
        request.op === 'interrupt' &&
        (request.target === 'pause' || request.target === 'cancelRemote')
      ) {
        // Cancellation must not wait behind an authentication/dialog continuation.
        const interrupted = controller
          .command({ op: 'cancelRemote' })
          .then(async () => {
            if (request.target === 'pause') await controller.pause('Paused by native window.');
            send({
              type: 'status',
              status: ui.status(),
              controls: ui.toolbarState(),
              changed: true,
            });
          })
          .catch(() => {
            send({
              type: 'error',
              error: 'Не удалось подтвердить остановку. Сохраните копию и проверьте состояние.',
            });
          });
        interrupting = Promise.all([interrupting, interrupted]).then(() => {});
        continue;
      }
      queue = queue
        .then(async () => {
          if (closing) return;
          try {
            if (webview && request.op === 'invoke') {
              const command = request.command as import('./coherent-types').CoherentCommand;
              try {
                const previewOnly =
                  ['claude', 'groq'].includes(store.state.provider?.kind ?? '') &&
                  [
                    'run',
                    'eureka',
                    'tend',
                    'decode',
                    'proposePreferences',
                    'revise',
                    'checkNode',
                    'check',
                  ].includes(command.op);
                if (
                  process.env.COMPOST_NO_INFERENCE === '1' &&
                  inferenceOperations.has(command.op) &&
                  !previewOnly
                )
                  throw Error('Генерация отключена в этой проверке.');
                const view = await controller.command(command);
                send({ type: 'reply', id: request.id, view });
              } catch (e) {
                send({
                  type: 'reply',
                  id: request.id,
                  error: e instanceof Error ? e.message : 'Operation failed.',
                });
              }
              refresh();
              return;
            }
            if (webview && request.op === 'external') {
              await external(String(request.url));
              return;
            }
            if (request.op === 'shutdown') {
              await shutdown();
              return;
            }
            if (request.op === 'suspend') {
              await controller.pause('Paused for Windows suspend.');
              refresh();
              send({ type: 'done', id: request.id });
              return;
            }
            if (request.op === 'autostartState') {
              autostart = request.enabled === true;
              refresh();
              send({ type: 'done', id: request.id });
              return;
            }
            if (request.op === 'navigate')
              ui.navigate(
                String(request.page),
                typeof request.id === 'string' ? request.id : '',
                typeof request.garden === 'string' ? request.garden : undefined,
              );
            else if (request.op === 'action')
              await ui.act(
                String(request.renderId),
                String(request.action),
                (request.values ?? {}) as Record<string, unknown>,
              );
            else if (request.op !== 'snapshot') throw Error('Unsupported native operation.');
            ui.lastError = '';
            refresh();
            send({ type: 'done', id: request.id });
          } catch (e) {
            ui.lastError = e instanceof Error ? e.message : 'Native operation failed.';
            refresh();
            send({ type: 'done', id: request.id, error: true });
          }
        })
        .catch(() => {
          send({ type: 'fatal', error: 'Native host needs attention. Preserve the profile.' });
        });
    }
  });
  process.stdin.on('end', () => {
    for (const p of pending.values()) p.reject(new Error('Native window disconnected.'));
    pending.clear();
    void queue.finally(() => shutdown(true));
  });
  process.stdin.on('close', () => {
    if (!closing) void shutdown(true);
  });
  process.on('SIGTERM', () => {
    void shutdown(true);
  });
  process.on('SIGINT', () => {
    void shutdown(true);
  });
  await mkdir(path.join(directory, 'native-secrets'), { recursive: true });
  const marker = path.join(directory, 'native-ready.private.json');
  if ((await lstat(directory)).isSymbolicLink()) throw Error('Profile must not be a link.');
  await writeFile(
    marker,
    JSON.stringify({ format: 'compost-native-ready-1', pid: process.pid, at: Date.now() }),
    { mode: 0o600 },
  );
  handles.operator = await startOperator(
    directory,
    (command, confirmed) => {
      if (closing) return Promise.reject(new Error('Application is shutting down.'));
      if (
        process.env.COMPOST_NO_INFERENCE === '1' &&
        [
          'confirmRemote',
          'run',
          'eureka',
          'tend',
          'decode',
          'proposePreferences',
          'revise',
          'checkNode',
          'check',
          'resume',
        ].includes(command.op)
      )
        return Promise.reject(new Error('Inference is disabled for acceptance.'));
      return controller.command(command, confirmed);
    },
    () => {
      void shutdown();
    },
    async () => {
      const window = (await service('showWindow')) as {
        visible: boolean;
        minimized: boolean;
        focused: boolean;
        ready: boolean;
      };
      return { pid: process.pid, ...window };
    },
  );
  refresh();
  send({ type: 'ready', pid: process.pid, credentialMigration: claudeTokens.migration });
}
void main().catch(() => {
  process.stderr.write('Native host startup failed; original profile preserved.\n');
  process.exit(1);
});
