import net from 'node:net';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CoherentCommand, CoherentView } from './coherent-types';

export const OPERATOR_FILE = 'operator-connection.private.json';
const safe = new Set([
  'snapshot',
  'pause',
  'resume',
  'clearAttention',
  'createGarden',
  'renameGarden',
  'reorderGarden',
  'gardenSettings',
  'background',
  'exchange',
  'settings',
  'add',
  'editSource',
  'participate',
  'preparation',
  'facet',
  'alias',
  'reference',
  'preference',
  'run',
  'tend',
  'decode',
  'proposePreferences',
  'revise',
  'checkNode',
  'check',
  'review',
  'editIdea',
  'recompost',
  'cancelPlan',
  'localOverride',
  'export',
  'operatorCredits',
  'operatorParticipation',
]);
export interface OperatorHandle {
  close(): Promise<void>;
}
export async function startOperator(
  directory: string,
  execute: (command: CoherentCommand, confirmed: boolean) => Promise<CoherentView>,
  quit: () => void,
): Promise<OperatorHandle> {
  await mkdir(directory, { recursive: true });
  const token = randomBytes(32).toString('hex'),
    nonce = randomBytes(12).toString('hex');
  const address =
    process.platform === 'win32'
      ? `\\\\.\\pipe\\compost-club-${nonce}`
      : path.join(directory, `.operator-${nonce}.sock`);
  const discovery = path.join(directory, OPERATOR_FILE),
    temporary = discovery + '.' + nonce + '.tmp';
  const clients = new Set<net.Socket>();
  let closing = false,
    queue = Promise.resolve();
  const server = net.createServer({ allowHalfOpen: true }, (socket) => {
    clients.add(socket);
    socket.setTimeout(15000, () => socket.destroy());
    let input = '',
      size = 0,
      dispatched = false;
    socket.setEncoding('utf8');
    socket.on('error', () => {});
    socket.once('close', () => clients.delete(socket));
    const reply = (value: unknown) => {
      if (!socket.destroyed) socket.end(JSON.stringify(value) + '\n');
    };
    socket.on('data', (chunk: string) => {
      if (dispatched) return;
      size += Buffer.byteLength(chunk);
      if (size > 2 * 1024 * 1024) {
        dispatched = true;
        reply({ ok: false, error: 'Operator request exceeds 2 MiB.' });
        return;
      }
      input += chunk;
      if (!input.includes('\n')) return;
      dispatched = true;
      queue = queue
        .then(async () => {
          try {
            const request = JSON.parse(input.slice(0, input.indexOf('\n'))) as {
              version?: number;
              token?: string;
              command?: CoherentCommand;
              confirm?: boolean;
            };
            if (
              request.version !== 1 ||
              typeof request.token !== 'string' ||
              !/^[a-f0-9]{64}$/.test(request.token) ||
              !timingSafeEqual(Buffer.from(request.token, 'hex'), Buffer.from(token, 'hex'))
            )
              throw new Error('Unauthorized operator request.');
            if (closing) throw new Error('Operator is shutting down.');
            const c = request.command;
            if (!c || typeof c.op !== 'string') throw new Error('A typed command is required.');
            if (c.op === 'exit') {
              reply({ ok: true, status: 'shutdown requested' });
              setTimeout(quit, 50).unref();
              return;
            }
            if (!safe.has(c.op))
              throw new Error(
                'This command requires a programmatic preview/path workflow and is unavailable on the operator interface. No native dialog was opened.',
              );
            if (
              ['exchange', 'operatorCredits', 'operatorParticipation'].includes(c.op) &&
              request.confirm !== true
            ) {
              reply({
                ok: false,
                needsConfirmation: true,
                error:
                  'Resend this exact command with confirm:true to authorize its explicit settings. No setting changed.',
              });
              return;
            }
            const view = await execute(c, request.confirm === true);
            reply({ ok: !view.error, view, ...(view.error ? { error: view.error } : {}) });
          } catch (e) {
            reply({ ok: false, error: e instanceof Error ? e.message : String(e) });
          }
        })
        .catch(() => {});
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen({ path: address, readableAll: false, writableAll: false }, () => {
      server.off('error', reject);
      resolve();
    });
  });
  try {
    try {
      const info = await lstat(discovery);
      if (!info.isFile() || info.isSymbolicLink())
        throw new Error('Operator discovery must be a regular owner file.');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    await writeFile(
      temporary,
      JSON.stringify({ format: 'compost-operator-1', pid: process.pid, address, token }) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    await rename(temporary, discovery);
  } catch (e) {
    server.close();
    throw e;
  }
  return {
    async close() {
      if (closing) return;
      closing = true;
      for (const socket of clients) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      try {
        const current = JSON.parse(await readFile(discovery, 'utf8')) as { token?: string };
        if (current.token === token) await unlink(discovery);
      } catch {
        /* Stale discovery cannot keep a released process alive. */
      }
    },
  };
}
