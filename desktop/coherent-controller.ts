import { ClaudeRuntime } from './claude-runtime';
import { boundedRepairFeedback } from '../src/domain/coherent/response-limits';
import {
  noop,
  noopTrace,
  type Observer,
  type Trace,
  type TraceMeta,
} from '../server/observability.mjs';
import { assertClaudeModel, CLAUDE_MODELS, isRemote } from '../src/domain/coherent/provider';
import { GroqRuntime } from './groq-runtime';
import { providerHash, providerSnapshot, validProvider } from '../src/domain/coherent/provider';
import { lstat, readFile, realpath, readdir, unlink, rmdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CoherentStore } from './coherent-store';
import { OwnedOllama } from './runtime';
import type { DesktopServices } from './controller';
import type { CoherentCommand, CoherentView, ImportPreview } from './coherent-types';
import { exportCoherent } from './coherent-export';
import { initializeExport, safeDirectory } from './export';
import { bytes, canonical, hash } from '../src/domain/coherent/hash';
import {
  schemaForAssessment,
  schemaForJob,
  dnaSchema,
  preferenceSchema,
  generationPrompt,
  screeningPrompt,
  parseDraft,
  parseAssessment,
  text,
} from '../src/domain/coherent/contract';
import { current, identity, safeUrl, validPack } from '../src/domain/coherent/prepare';
import {
  STAGE_TIMEOUT_MS,
  STOP_TIMEOUT_MS,
  TEMPLATE_RESERVE,
  compactContext,
} from '../src/domain/coherent/admission';
import {
  active,
  admissionConditions,
  backgroundReason,
  addSource,
  commit,
  decide,
  deletionPreview,
  dispatch,
  due,
  editNode,
  editSource,
  fail,
  finish,
  garden,
  INTERVALS,
  makeGarden,
  pause,
  plan,
  prepareJob,
  revalidate,
  remove,
  selection,
  stage,
  uuid,
  wait,
} from '../src/domain/coherent/workspace';
import {
  DIRECTIONS,
  type Candidate,
  type Identity,
  type Job,
  type Lifecycle,
  type Profile,
  type Workspace,
} from '../src/domain/coherent/types';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const boolean = (v: unknown) => {
  if (typeof v !== 'boolean') throw new Error('Expected a boolean.');
  return v;
};
const integer = (v: unknown, min: number, max: number) => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
    throw new Error(`Choose an integer from ${min} to ${max}.`);
  return v;
};
const strings = (v: unknown, max = 200) => {
  if (!Array.isArray(v) || v.length > max) throw new Error('Invalid list.');
  return v.map((v) => text(v, 128));
};
export class CoherentController {
  private previewState: Workspace | undefined;
  private pendingRemote: {
    id: string;
    expires: number;
    revision: number;
    workspace: Workspace;
    job: string;
  } | null = null;
  private authorizedRemote = new Set<string>();
  private active: Promise<void> | undefined;
  private abort: AbortController | undefined;
  private pausing = false;
  private error = '';
  private exportError = '';
  private session = uuid();
  private listeners = new Set<() => void>();
  private preview: ImportPreview | null = null;
  private publishing = Promise.resolve();
  private exportStatus: CoherentView['exportStatus'] = null;
  private currentId: string | null = null;
  private stopUnconfirmed = false;
  private claudeCheckEpoch = 0;
  private claudeCheck: {
    state: 'unchecked' | 'checking' | 'ready' | 'failed';
    model: string;
    version: string;
  } = {
    state: 'unchecked',
    model: '',
    version: '',
  };
  constructor(
    readonly store: CoherentStore,
    private services: DesktopServices,
    private forbidden: string[],
    readonly runtime = new OwnedOllama(),
    readonly remote = new GroqRuntime(),
    readonly claude = new ClaudeRuntime(store.directory, () => store.state.claudeExecutable),
    private telemetry: Observer = noop,
  ) {
    this.lifecycle('launch', 0, '');
  }
  private async observe<T>(meta: TraceMeta, fn: (trace: Trace) => T | Promise<T>): Promise<T> {
    let pending: Promise<T> | undefined;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const once = (trace: Trace) =>
      (pending ??= Promise.resolve().then(() => {
        const safe: Trace = {
          tokens: (input, output) => {
            try {
              trace.tokens(input, output);
            } catch {
              /* Optional. */
            }
          },
          httpStatus: (status) => {
            try {
              trace.httpStatus(status);
            } catch {
              /* Optional. */
            }
          },
          reportedModel: (model) => {
            try {
              trace.reportedModel(model);
            } catch {
              /* Optional. */
            }
          },
          outcome: (result) => {
            try {
              trace.outcome(result);
            } catch {
              /* Optional. */
            }
          },
          validate: (validate) => {
            let called = false;
            const once = () => {
              if (called) return;
              called = true;
              return validate();
            };
            try {
              trace.validate(once);
            } catch {
              /* Parser outcome is retained by its caller. */
            }
            if (!called)
              try {
                once();
              } catch {
                /* Same parser error handling. */
              }
          },
        };
        markStarted();
        return fn(safe);
      }));
    try {
      // Do not await the monitoring promise: it may fail or never settle.
      void this.telemetry.run(meta, once).catch(() => {});
    } catch {
      // Preserve the single business result/error even if instrumentation fails.
    }
    if (!pending) {
      await Promise.race([started, new Promise<void>((resolve) => setImmediate(resolve))]);
    }
    return pending ?? once(noopTrace);
  }
  private resetClaudeCheck() {
    this.claudeCheckEpoch++;
    this.claudeCheck = { state: 'unchecked', model: '', version: '' };
  }
  private traceMeta(
    operation: string,
    phase: string,
    type: TraceMeta['type'] = 'control',
    job?: Job,
  ): TraceMeta {
    let provider: ReturnType<typeof providerSnapshot>;
    try {
      provider =
        job?.provider ??
        providerSnapshot(this.store.state.provider, this.store.state.runtime.model);
    } catch {
      return { model: 'other', operation, phase, type };
    }
    return {
      model: job?.model ?? provider.requestedModel,
      system:
        provider.kind === 'claude' ? 'anthropic' : provider.kind === 'groq' ? 'groq' : 'ollama',
      operation,
      phase,
      type,
      contract: job?.promptVersion ?? 'provider-1',
    };
  }
  private async releaseResources() {
    await this.observe(this.traceMeta('release', 'release'), () =>
      Promise.all([this.runtime.release(), this.claude.release()]),
    );
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    if (this.previewState) return;
    for (const fn of this.listeners) fn();
  }
  private change(fn: (w: Workspace) => void) {
    if (this.previewState) {
      fn(this.previewState);
      return this.previewState;
    }
    return this.store.change(fn);
  }
  private lifecycle(kind: Lifecycle['kind'], elapsed: number, error: string) {
    try {
      this.change((w) => {
        if (w.lifecycle.length >= 12000) throw new Error('Lifecycle journal full.');
        w.lifecycle.push({
          id: uuid(),
          session: this.session,
          job: this.currentId,
          kind,
          elapsed,
          at: Date.now(),
          error: error ? 'Operation failed; inspect local attention state.' : '',
        });
      });
    } catch (e) {
      this.error = 'Lifecycle evidence gap: ' + message(e);
      this.store.emergency.push({
        id: -this.store.emergency.length - 1,
        jobId: this.currentId ?? this.session,
        phase: 'lifecycle-gap',
        at: Date.now(),
        raw: JSON.stringify({ kind, elapsed, error: 'Lifecycle persistence failed' }),
      });
    }
  }
  view(): CoherentView {
    const w = this.store.state;
    const reasons = w.gardens
      .filter((g) => g.background)
      .map((g) => g.name + ': ' + backgroundReason(w, g.id, Date.now()));
    const pending = this.pendingRemote;
    const pendingJob = pending?.workspace.jobs.find((j) => j.id === pending.job);
    return {
      telemetry: { enabled: this.telemetry.enabled },
      claudeConnection: { ...this.claudeCheck },
      claudeToken: {
        available: this.claude.tokenStore?.available() ?? false,
        present: this.claude.tokenStore?.has() ?? false,
      },
      provider: {
        ...providerSnapshot(w.provider, w.runtime.model),
        credentialAvailable:
          w.provider?.kind === 'claude'
            ? this.claude.available()
            : this.remote.credentials.available(),
        credentialPresent:
          w.provider?.kind === 'claude'
            ? this.claude.tokenStore?.has() ||
              ['claude.ai', 'oauth_token'].includes(this.claude.authMethod)
            : this.remote.credentials.has(),
      },
      remotePreview:
        pending && pendingJob
          ? {
              id: pending.id,
              expires: pending.expires,
              garden: pendingJob.garden,
              provider: pendingJob.provider!,
              context: compactContext(pendingJob),
              sections: pendingJob.pack.evidence.map((e, i) => ({
                title: e.parent
                  ? 'Источник ' +
                    (pendingJob.parents.findIndex((p) => p.id === e.parent!.id) + 1) +
                    ' · ' +
                    (w.gardens.find((g) => g.id === e.parent!.garden)?.name ?? 'сад')
                  : 'Дополнительный выбранный контекст ' + (i + 1),
                text: e.text,
              })),
              objective: (JSON.parse(pendingJob.pack.payload) as { objective: string }).objective,
              draft: pendingJob.draft,
              prompt:
                pendingJob.operation === 'check'
                  ? screeningPrompt(pendingJob)
                  : generationPrompt(pendingJob),
              calls: pendingJob.heldCalls,
              donorGardens: [
                ...new Set(
                  pendingJob.parents
                    .filter((p) => p.garden !== pendingJob.garden)
                    .map((p) => p.garden),
                ),
              ],
            }
          : null,
      eureka: w.gardens.map((g) => ({ garden: g.id, reason: this.eurekaReason(g.id) })),
      workspace: w,
      busy: !!this.active || this.pausing,
      status: this.pausing
        ? 'pausing'
        : this.error || w.attention
          ? 'attention'
          : this.active
            ? 'running'
            : w.paused
              ? 'paused'
              : 'waiting',
      reason:
        this.error ||
        w.attention ||
        (this.active
          ? `Job ${this.currentId} → ${w.jobs.find((j) => j.id === this.currentId)?.stage ?? 'starting'}`
          : w.paused
            ? 'Background paused. Manual requests authorize one bounded job.'
            : reasons.join(' · ') || 'Choose gardens for background work.'),
      activeJob: this.currentId,
      preview: this.preview,
      backups: this.store.backups(),
      receiptCount: this.store.receipts().length,
      dataDirectory: this.store.directory,
      model: {
        connected: this.runtime.running,
        digest: this.runtime.digest,
        ...(this.runtime.pid ? { pid: this.runtime.pid } : {}),
      },
      exportStatus: this.exportStatus,
      autostart: this.services.autostartEnabled?.() ?? false,
    };
  }
  private eurekaSeed(g: string) {
    return parseInt(
      hash(canonical([g, this.store.state.jobs.length, 'eureka-draw-1'])).slice(0, 8),
      16,
    );
  }
  private eurekaReason(g: string) {
    if (this.pausing) return 'Останавливаем работу и освобождаем модель. Дождитесь подтверждения.';
    if (this.stopUnconfirmed)
      return 'Не удалось подтвердить остановку. Сохраните копию и завершите приложение.';
    if (this.active) {
      const j = this.store.state.jobs.find((j) => j.id === this.currentId);
      return `Модель занята садом «${this.store.state.gardens.find((g) => g.id === j?.garden)?.name ?? 'другой сад'}». Дождитесь результата или нажмите «Пауза».`;
    }
    if (this.error || this.store.state.attention) return this.error || this.store.state.attention;
    try {
      this.store.requireReceiptHeadroom();
      prepareJob(structuredClone(this.store.state), g, 'blend', Date.now(), {
        manual: true,
        probabilistic: true,
        seed: this.eurekaSeed(g),
      });
      return '';
    } catch (e) {
      return message(e);
    }
  }
  async pause(reason = 'Paused by you. Model resources released.') {
    if (this.pausing) {
      if (this.active)
        await Promise.race([
          this.active,
          new Promise<void>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    'Не удалось подтвердить остановку. Сохраните копию и завершите приложение.',
                  ),
                ),
              STOP_TIMEOUT_MS,
            ).unref(),
          ),
        ]);
      await this.releaseResources();
      return;
    }
    this.pausing = true;
    const started = Date.now();
    this.abort?.abort();
    this.lifecycle('pause requested', 0, '');
    let saveError: unknown;
    try {
      this.change((w) => pause(w, Date.now()));
    } catch (e) {
      saveError = e;
    }
    this.emit();
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          Promise.all([this.active, this.releaseResources()]),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error(
                    'Не удалось подтвердить остановку. Новый запуск запрещён; сохраните копию и завершите приложение.',
                  ),
                ),
              STOP_TIMEOUT_MS,
            );
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
      this.lifecycle('stage drained', Date.now() - started, '');
      this.lifecycle(
        isRemote(this.store.state.provider) ? 'remote wait drained' : 'release confirmed',
        Date.now() - started,
        '',
      );
      if (saveError) throw saveError;
      this.error = this.store.emergency.length
        ? 'Original responses need a full recovery backup before exit.'
        : this.exportError ||
          (/Persistence|Lifecycle|evidence gap/.test(this.error) ? this.error : '');
      this.stopUnconfirmed = false;
      if (!this.error && reason) this.error = '';
    } catch (e) {
      this.stopUnconfirmed = true;
      this.error = message(e);
      this.lifecycle('release failed', Date.now() - started, this.error);
      throw e;
    } finally {
      this.pausing = false;
      this.emit();
    }
  }
  private async publish() {
    const task = this.publishing.then(async () => {
      const w = this.store.state;
      if (w.exportDirectory) this.exportStatus = await exportCoherent(w, this.forbidden);
      this.exportError = '';
      if (this.error.startsWith('Export needs attention:')) this.error = '';
    });
    this.publishing = task.catch(() => {});
    try {
      await task;
    } catch (e) {
      this.exportError = this.error = 'Export needs attention: ' + message(e);
      throw e;
    }
  }
  private async mutateSelected(fn: (w: Workspace) => void) {
    const copy = structuredClone(this.store.state);
    fn(copy);
    const job = this.store.state.jobs.find((j) => j.id === this.currentId);
    if (
      job &&
      (!validPack(copy, job.pack) ||
        job.parents.some(
          (p) => p.kind === 'source' && !copy.sources.find((s) => s.id === p.id)?.participating,
        ))
    ) {
      const backgroundWasPaused = this.store.state.paused;
      await this.pause('Selected context changed.');
      this.change((w) => {
        w.paused = backgroundWasPaused;
      });
    }
    // Reapply against the authoritative state after draining; never replace a
    // newly retained response with a renderer's earlier workspace snapshot.
    this.change(fn);
  }
  async command(
    input: unknown,
    operatorConfirmed = false,
    previewOnly = false,
  ): Promise<CoherentView> {
    const op = input && typeof input === 'object' ? (input as CoherentCommand).op : '';
    if (
      previewOnly ||
      ![
        'configureProvider',
        'configureClaude',
        'configureClaudeModel',
        'checkClaude',
        'setClaudeToken',
        'removeClaudeToken',
        'setGroqCredential',
        'removeGroqCredential',
        'confirmRemote',
        'cancelRemote',
        'pause',
        'resume',
      ].includes(op)
    )
      return this.executeCommand(input, operatorConfirmed, previewOnly);
    const phase =
      op === 'checkClaude'
        ? 'authentication'
        : op === 'configureClaudeModel'
          ? 'model_selection'
          : ['confirmRemote', 'cancelRemote'].includes(op)
            ? 'consent'
            : 'configuration';
    const meta = this.traceMeta(op, phase);
    const c = input as CoherentCommand;
    if (
      [
        'configureClaude',
        'configureClaudeModel',
        'checkClaude',
        'setClaudeToken',
        'removeClaudeToken',
      ].includes(op)
    ) {
      meta.system = 'anthropic';
      if (this.store.state.provider?.kind !== 'claude')
        meta.model = op === 'checkClaude' ? 'sonnet' : 'other';
    }
    if (['setGroqCredential', 'removeGroqCredential'].includes(op)) {
      meta.system = 'groq';
      meta.model = providerSnapshot({ kind: 'groq', revision: 1 }, '').requestedModel;
    }
    if (op === 'configureClaudeModel' && CLAUDE_MODELS.some((m) => m.id === c.model))
      meta.model = c.model as string;
    if (op === 'configureProvider' && ['local', 'claude', 'groq'].includes(c.kind as string)) {
      const provider = providerSnapshot(
        { kind: c.kind as 'local' | 'claude' | 'groq', revision: 1 },
        this.store.state.runtime.model,
      );
      meta.system =
        provider.kind === 'claude' ? 'anthropic' : provider.kind === 'groq' ? 'groq' : 'ollama';
      meta.model = provider.requestedModel;
    }
    return this.observe(meta, () => this.executeCommand(input, operatorConfirmed, previewOnly));
  }
  private async executeCommand(
    input: unknown,
    operatorConfirmed = false,
    previewOnly = false,
  ): Promise<CoherentView> {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      typeof (input as CoherentCommand).op !== 'string' ||
      bytes(JSON.stringify(input)) > 2 * 1024 * 1024
    )
      throw new Error('Invalid desktop command.');
    const c = input as CoherentCommand,
      now = Date.now(),
      id = () => text(c.id, 128);
    if (
      !previewOnly &&
      isRemote(this.store.state.provider) &&
      [
        'run',
        'eureka',
        'tend',
        'revise',
        'check',
        'checkNode',
        'decode',
        'proposePreferences',
      ].includes(c.op)
    ) {
      if (this.active || this.pausing || this.error)
        throw new Error('Дождитесь завершения работы или устраните причину остановки.');
      this.previewState = structuredClone(this.store.state);
      try {
        await this.command(c, operatorConfirmed, true);
      } finally {
        this.previewState = undefined;
      }
      this.emit();
      return this.view();
    }
    switch (c.op) {
      case 'configureProvider': {
        if (c.kind !== 'local' && c.kind !== 'groq' && c.kind !== 'claude')
          throw new Error('Unsupported provider.');
        await this.pause();
        this.pendingRemote = null;
        this.resetClaudeCheck();
        this.change((w) => {
          w.provider = {
            kind: c.kind as 'local' | 'groq' | 'claude',
            revision: (w.provider?.revision ?? 0) + 1,
          };
        });
        break;
      }
      case 'checkClaude': {
        if (this.active || this.pausing) throw new Error('Wait for active work.');
        if (this.claudeCheck.state === 'checking')
          throw new Error('Проверка входа уже выполняется.');
        const model =
          this.store.state.provider?.kind === 'claude'
            ? providerSnapshot(this.store.state.provider, this.store.state.runtime.model)
                .requestedModel
            : 'sonnet';
        const epoch = ++this.claudeCheckEpoch;
        this.claudeCheck = { state: 'checking', model, version: '' };
        this.emit();
        try {
          await this.claude.start(model);
          if (epoch === this.claudeCheckEpoch)
            this.claudeCheck = { state: 'ready', model, version: this.claude.version };
        } catch (e) {
          if (epoch === this.claudeCheckEpoch)
            this.claudeCheck = { state: 'failed', model, version: this.claude.version };
          this.emit();
          throw e;
        }
        break;
      }
      case 'configureClaudeModel': {
        if (this.store.state.provider?.kind !== 'claude')
          throw new Error('Сначала выберите подключение Claude.');
        const model = text(c.model, 80);
        assertClaudeModel(model);
        await this.pause();
        this.pendingRemote = null;
        this.resetClaudeCheck();
        this.change((w) => {
          w.provider = {
            kind: 'claude',
            revision: (w.provider?.revision ?? 0) + 1,
            model,
          };
        });
        break;
      }
      case 'configureClaude': {
        const executable = text(c.executable, 32768);
        if (!path.isAbsolute(executable) || path.extname(executable).toLowerCase() !== '.exe')
          throw new Error('Укажите абсолютный путь к официальному claude.exe.');
        const info = await lstat(executable);
        if (
          !info.isFile() ||
          info.isSymbolicLink() ||
          (await realpath(executable)).toLowerCase() !== path.resolve(executable).toLowerCase()
        )
          throw new Error('Выберите обычный локальный файл.');
        await this.pause();
        this.pendingRemote = null;
        this.resetClaudeCheck();
        this.change((w) => {
          w.claudeExecutable = executable;
          if (w.provider) w.provider.revision++;
        });
        break;
      }
      case 'setClaudeToken':
        await this.pause();
        this.pendingRemote = null;
        this.resetClaudeCheck();
        if (!this.claude.tokenStore) throw new Error('Защищённое хранилище токена недоступно.');
        await this.claude.tokenStore.set(text(c.token, 4096));
        break;
      case 'removeClaudeToken':
        await this.pause();
        this.pendingRemote = null;
        this.resetClaudeCheck();
        if (!this.claude.tokenStore) throw new Error('Защищённое хранилище токена недоступно.');
        await this.claude.tokenStore.remove();
        break;
      case 'setGroqCredential':
        await this.pause();
        this.pendingRemote = null;
        await this.remote.credentials.set(text(c.key, 204, true));
        break;
      case 'saveSensitiveEmergency':
        await this.remote.saveSensitiveEmergency();
        await this.claude.saveSensitiveEmergency();
        break;
      case 'removeGroqCredential':
        await this.pause();
        this.pendingRemote = null;
        await this.remote.credentials.remove();
        break;
      case 'cancelRemote':
        this.pendingRemote = null;
        break;
      case 'confirmRemote': {
        const token = text(c.previewId, 128),
          tombstone = (this.store.state.requests ?? []).find((r) => r.id === 'remote:' + token);
        if (tombstone) break;
        const p = this.pendingRemote;
        if (!p || p.id !== token || p.expires < now)
          throw new Error('Предпросмотр истёк. Подготовьте и подтвердите новый запрос.');
        if (c.consent !== true)
          throw new Error('Подтвердите передачу выбранного контекста провайдеру.');
        if (this.active || this.pausing || this.error || this.store.state.revision !== p.revision)
          throw new Error('Состояние изменилось. Просмотрите новый состав контекста.');
        if (p.workspace.provider?.kind === 'claude')
          await this.claude.start(p.workspace.jobs.find((j) => j.id === p.job)!.model);
        else await this.remote.credentials.get();
        if ((this.store.state.requests ?? []).some((r) => r.id === 'remote:' + token)) break;
        // Authentication can yield to cancellation, a replacement preview, or expiry.
        // Its success does not renew the user's permission to send this context.
        const confirmedAt = Date.now();
        if (this.pendingRemote !== p || p.expires <= confirmedAt)
          throw new Error(
            'Предпросмотр отменён или истёк. Подготовьте и подтвердите новый запрос.',
          );
        if (this.active || this.pausing || this.error)
          throw new Error('Состояние изменилось. Просмотрите новый состав контекста.');
        this.change((w) => {
          if (w.revision !== p.revision) throw new Error('State changed during consent.');
          Object.assign(w, structuredClone(p.workspace));
          const j = w.jobs.find((j) => j.id === p.job)!;
          validProvider(j.provider!);
          j.remoteConsent = {
            contextHash: j.pack.hash,
            providerHash: providerHash(j.provider!),
            at: confirmedAt,
            expires: p.expires,
          };
          revalidate(w, j, confirmedAt);
          const requests = (w.requests ??= []);
          if (requests.length >= 4000) throw new Error('Request journal full.');
          requests.push({
            id: 'remote:' + token,
            fingerprint: hash(canonical(j.remoteConsent)),
            garden: j.garden,
            job: j.id,
            at: confirmedAt,
            state: 'started',
            reason: '',
          });
        });
        this.authorizedRemote.add(p.job);
        this.pendingRemote = null;
        this.launch(p.job);
        break;
      }
      case 'snapshot':
        break;
      case 'pause':
        await this.pause();
        break;
      case 'resume':
        if (isRemote(this.store.state.provider))
          throw new Error(
            'Удалённое расписание выключено. Используйте ручную отправку с предпросмотром.',
          );
        if (this.active || this.pausing) throw new Error('Wait for active work to drain.');
        if (this.remote.emergencyPending || this.claude.emergencyPending)
          throw new Error(
            'Секретный исходный ответ удерживается в памяти. Восстановите защищённое хранилище и сохраните recovery до выхода.',
          );
        if (this.store.emergency.length)
          throw new Error('Save emergency evidence before resuming.');
        if (this.stopUnconfirmed || this.error || this.exportError || this.store.state.attention)
          throw new Error(
            'Продолжение недоступно: сначала устраните причину в настройках и проверьте сохранность ответов.',
          );
        if (!this.store.state.gardens.some((g) => g.background))
          throw new Error(
            'В расписание не включён ни один сад. В настройках сада включите «Включать этот сад в расписание».',
          );
        this.change((w) => {
          w.paused = false;
          for (const g of w.gardens)
            if (g.background) g.nextAt = Math.max(g.nextAt, now + g.interval * 60000);
        });
        break;
      case 'clearAttention':
        if (this.active || this.pausing || this.stopUnconfirmed || this.store.emergency.length)
          throw new Error('Drain work and save emergency evidence first.');
        this.error = '';
        this.change((w) => {
          w.attention = '';
          w.failures = 0;
        });
        break;
      case 'requestState': {
        const rid = text(c.requestId, 128);
        if (!(this.store.state.requests ?? []).some((r) => r.id === rid))
          throw new Error(
            'Запрос с таким ID не найден. Автоматический повтор с новым ID не выполняется.',
          );
        break;
      }
      case 'eureka': {
        const rid = text(c.requestId, 128),
          gid = text(c.garden, 128),
          fingerprint = hash(canonical(c));
        const prior = (this.store.state.requests ?? []).find((r) => r.id === rid);
        if (prior) {
          if (prior.fingerprint !== fingerprint || prior.garden !== gid)
            throw new Error(
              'Конфликт request ID: этот запрос уже связан с другим садом или параметрами.',
            );
          break;
        }
        if (this.active || this.pausing || this.stopUnconfirmed || this.error)
          throw new Error(this.eurekaReason(gid));
        let jid = '';
        this.change((w) => {
          const requests = (w.requests ??= []);
          if (requests.length >= 4000)
            throw new Error('Журнал запросов заполнен. Сохраните полную копию.');
          const p = plan(w, gid, this.eurekaSeed(gid), false);
          selection(w, p);
          let reason = '';
          try {
            this.store.requireReceiptHeadroom();
            const j = prepareJob(w, gid, 'blend', now, {
              manual: true,
              probabilistic: true,
              seed: p.seed,
            });
            j.trigger = 'eureka';
            j.requestId = rid;
            jid = j.id;
          } catch (e) {
            reason = message(e);
            p.reason = reason;
            if (reason.startsWith('admission:'))
              p.blocked = { fingerprint: admissionConditions(w, gid), reason };
          }
          requests.push({
            id: rid,
            fingerprint,
            garden: gid,
            job: jid || null,
            at: now,
            state: jid ? 'started' : 'blocked',
            reason,
          });
        });
        if (jid) this.launch(jid);
        break;
      }
      case 'createGarden':
        this.change((w) => {
          if (w.gardens.length >= 4) throw new Error('Four gardens maximum.');
          w.gardens.push(makeGarden(text(c.name, 80), text(c.profile, 20) as Profile, now));
        });
        break;
      case 'renameGarden':
        this.change((w) => {
          garden(w, id()).name = text(c.name, 80);
        });
        break;
      case 'reorderGarden':
        this.change((w) => {
          const ids = strings(c.ids, 4);
          if (ids.length !== w.gardens.length || new Set(ids).size !== ids.length)
            throw new Error('Include each garden once.');
          w.gardens = ids.map((id) => garden(w, id));
        });
        break;
      case 'gardenSettings':
        await this.mutateSelected((w) => {
          const g = garden(w, id());
          g.profile = text(c.profile, 20) as Profile;
          g.profileRevision++;
          g.objective = text(c.objective, 2000, true);
          g.background = false;
          g.interval = integer(c.interval, 15, 240);
          if (!INTERVALS.includes(g.interval)) throw new Error('Unsupported interval.');
          g.nextAt = now + g.interval * 60000;
          g.plan = null;
        });
        break;
      case 'background':
        this.change((w) => {
          const g = garden(w, id());
          g.background = boolean(c.enabled);
          g.nextAt = now + g.interval * 60000;
        });
        if (
          c.enabled === false &&
          this.store.state.jobs.find((j) => j.id === this.currentId)?.garden === id()
        )
          await this.pause();
        break;
      case 'operatorCredits': {
        if (!operatorConfirmed) throw new Error('Explicit operator authorization is required.');
        const cap = integer(c.cap, 1, 10),
          balance = integer(c.balance, 0, cap);
        await this.pause('Operator explicitly changed credit capacity.');
        this.change((w) => {
          const g = garden(w, id());
          g.credits = { cap, balance, at: now };
        });
        break;
      }
      case 'operatorParticipation': {
        if (!operatorConfirmed) throw new Error('Explicit operator authorization is required.');
        const selected = strings(c.sources, 200),
          gid = id();
        await this.mutateSelected((w) => {
          const sources = w.sources.filter((s) => s.garden === gid);
          if (
            !w.gardens.some((g) => g.id === gid) ||
            selected.some((id) => !sources.some((s) => s.id === id))
          )
            throw new Error('Participation list must contain existing sources from this garden.');
          for (const s of sources) s.participating = selected.includes(s.id);
        });
        break;
      }
      case 'exchange': {
        const probability = integer(c.probability, 0, 100),
          donors = strings(c.donors, 3),
          donate = boolean(c.donate);
        if (
          (probability > 0 || donate) &&
          !operatorConfirmed &&
          !(await this.services.confirm(
            `Разрешить обмен выбранными исходными идеями между садами? Вероятность получения идеи от донора: ${probability}%. Этот сад ${donate ? 'разрешает' : 'не разрешает'} донорство. В попытке используется одна идея донора. При отмене разрешения прежние сохранённые снимки остаются.`,
          ))
        )
          break;
        await this.mutateSelected((w) => {
          const g = garden(w, id());
          g.policy = { revision: g.policy.revision + 1, probability, donors, donate };
          g.background = false;
          g.plan = null;
        });
        break;
      }
      case 'add':
        this.change((w) => {
          const sid = addSource(
            w,
            text(c.garden, 128),
            text(c.title, 120, true),
            text(c.text, 1024 * 1024),
            boolean(c.participating),
            now,
          );
          w.sources.find((s) => s.id === sid)!.tags =
            typeof c.tags === 'string'
              ? c.tags
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .slice(0, 8)
              : [];
        });
        break;
      case 'editSource':
        await this.mutateSelected((w) =>
          editSource(w, id(), text(c.title, 120, true), text(c.text, 1024 * 1024), now),
        );
        break;
      case 'participate':
        await this.mutateSelected((w) => {
          const s = w.sources.find((s) => s.id === id());
          if (!s) throw new Error('Source missing.');
          s.participating = boolean(c.value);
          if (!s.participating)
            for (const g of w.gardens)
              if (g.plan?.parents.some((p) => p.id === s.id)) {
                g.plan.parents = [];
                g.plan.reason = 'Participation changed; retaining seed and route.';
              }
        });
        break;
      case 'preparation':
        await this.mutateSelected((w) => {
          const s = w.sources.find((s) => s.id === id());
          if (!s) throw new Error('Source missing.');
          const r = current(s),
            p = r.preparation;
          p.revision++;
          p.selected = strings(c.selected, 2000);
          p.essential = strings(c.essential, 2000);
          p.missingMechanism = boolean(c.missingMechanism);
        });
        break;
      case 'facet':
        await this.mutateSelected((w) => {
          const s = w.sources.find((s) => s.id === id());
          if (!s) throw new Error('Source missing.');
          const r = current(s),
            p = r.preparation;
          const fid = typeof c.facetId === 'string' ? c.facetId : uuid(),
            f = {
              id: fid,
              field: text(c.field, 60),
              value: c.value === null ? null : text(c.value, 240, true),
              origin:
                p.facets.find((f) => f.id === fid && f.value === c.value && f.field === c.field)
                  ?.origin ?? ('user-authored' as const),
              approved: boolean(c.approved),
              sourceRevision: r.revision,
              spans: strings(c.spans, 8),
              inheritedFrom: null,
            };
          p.facets = p.facets.filter((f) => f.id !== fid);
          p.facets.push(f);
          p.revision++;
        });
        break;
      case 'alias':
        await this.mutateSelected((w) => {
          const s = w.sources.find((s) => s.id === id());
          if (!s) throw new Error('Source missing.');
          const p = current(s).preparation;
          const aliasId = typeof c.aliasId === 'string' ? text(c.aliasId, 128) : uuid();
          p.aliases = p.aliases.filter((a) => a.id !== aliasId);
          p.aliases.push({
            id: aliasId,
            original: text(c.original, 120),
            meaning: text(c.meaning, 240),
            span: text(c.span, 128),
            approved: boolean(c.approved),
            essential: boolean(c.essential),
          });
          p.revision++;
        });
        break;
      case 'reference':
        await this.mutateSelected((w) => {
          const s = w.sources.find((s) => s.id === text(c.source, 128));
          if (!s) throw new Error('Select a source.');
          const rid = typeof c.referenceId === 'string' ? c.referenceId : uuid(),
            previous = w.references.find((r) => r.id === rid),
            url = text(c.url, 2048, true);
          if (url) safeUrl(url);
          const status = text(c.status, 40) as Workspace['references'][number]['status'];
          const ref = {
            id: rid,
            revision: (previous?.revision ?? 0) + 1,
            garden: s.garden,
            name: text(c.name, 120),
            url,
            fileId: typeof c.fileId === 'string' ? c.fileId : null,
            property: text(c.property, 2000, true),
            differ: text(c.differ, 1000, true),
            status,
            essential: boolean(c.essential),
            removed: false,
            source: status === 'source-supported property' ? identity(s) : null,
            spans: Array.isArray(c.spans) ? strings(c.spans, 8) : [],
          };
          w.references = w.references.filter((r) => r.id !== rid);
          w.references.push(ref);
          const p = current(s).preparation;
          if (!p.references.includes(rid)) p.references.push(rid);
          p.revision++;
        });
        break;
      case 'removeReference':
        await this.mutateSelected((w) => {
          const r = w.references.find((r) => r.id === id());
          if (!r) throw new Error('Reference missing.');
          r.removed = true;
          r.revision++;
          for (const s of w.sources) {
            const p = current(s).preparation;
            if (p.references.includes(r.id)) {
              p.references = p.references.filter((id) => id !== r.id);
              p.revision++;
            }
          }
        });
        break;
      case 'preference':
        await this.mutateSelected((w) => {
          const pid = typeof c.id === 'string' ? id() : uuid(),
            previous = w.preferences.find((p) => p.id === pid);
          const p = {
            id: pid,
            revision: (previous?.revision ?? 0) + 1,
            garden: c.garden === null ? null : text(c.garden, 128),
            text: text(c.text, 240),
            approved: boolean(c.approved),
            enabled: boolean(c.enabled),
            reviews: Array.isArray(c.reviews) ? strings(c.reviews, 20) : [],
            origin:
              previous && previous.text === c.text ? previous.origin : ('user-authored' as const),
          };
          w.preferences = w.preferences.filter((p) => p.id !== pid);
          w.preferences.push(p);
        });
        break;
      case 'settings':
        await this.pause('Compute settings changed.');
        this.change((w) => {
          w.settings = {
            ...w.settings,
            attempts: integer(c.attempts, 1, 48),
            candidates: integer(c.candidates, 1, 48),
            calls: integer(c.calls, 1, 96),
            backlog: integer(c.backlog, 1, 20),
            language: text(c.language, 2) as 'ru' | 'en',
            exportScope: text(c.exportScope, 8) as 'kept' | 'all' | 'filtered',
          };
          w.runtime.model = text(c.model, 30) as Workspace['runtime']['model'];
        });
        break;
      case 'pickExecutable':
      case 'pickModels':
        await this.pause('Model setup changed.');
        {
          const [value] = await this.services.pick(
            c.op === 'pickExecutable' ? 'executable' : 'models',
          );
          if (value)
            this.change((w) => {
              if (c.op === 'pickExecutable') w.runtime.executable = value;
              else w.runtime.models = value;
            });
        }
        break;
      case 'connect':
        if (this.active) throw new Error('One model owner at a time.');
        try {
          await this.runtime.start(this.store.state.runtime);
        } finally {
          await this.releaseResources();
        }
        break;
      case 'configureRuntime': {
        const executable = text(c.executable, 32768),
          models = text(c.models, 32768);
        if (!path.isAbsolute(executable) || path.extname(executable).toLowerCase() !== '.exe')
          throw new Error('Укажите абсолютный путь к установленной ollama.exe.');
        const info = await lstat(executable);
        if (
          !info.isFile() ||
          info.isSymbolicLink() ||
          (await realpath(executable)).toLowerCase() !== path.resolve(executable).toLowerCase()
        )
          throw new Error('Выберите обычный локальный файл Ollama.');
        await safeDirectory(models);
        await this.pause();
        this.change((w) => {
          w.runtime.executable = executable;
          w.runtime.models = models;
        });
        break;
      }
      case 'configureExport': {
        const directory = text(c.directory, 32768);
        await initializeExport(directory, this.forbidden);
        this.change((w) => {
          w.exportDirectory = directory;
        });
        await this.publish();
        break;
      }
      case 'backupTo': {
        const file = text(c.path, 32768);
        if (!path.isAbsolute(file)) throw new Error('Для приватной копии нужен абсолютный путь.');
        await safeDirectory(path.dirname(file));
        const raw = JSON.stringify(this.store.envelope());
        CoherentStore.parseBackup(raw);
        await writeFile(file, raw, { flag: 'wx', mode: 0o600 });
        if (hash(await readFile(file)) !== hash(raw))
          throw new Error('Проверка сохранённой копии не прошла. Прежние данные сохранены.');
        break;
      }
      case 'run':
      case 'tend':
      case 'decode':
      case 'proposePreferences':
      case 'revise': {
        if (this.active || this.pausing || this.error)
          throw new Error('Resolve attention or wait for the current job.');
        this.store.requireReceiptHeadroom();
        const gid = text(c.garden, 128);
        let operation: Job['operation'] =
          c.op === 'run'
            ? 'blend'
            : c.op === 'tend'
              ? 'growth'
              : c.op === 'decode'
                ? 'dna'
                : c.op === 'proposePreferences'
                  ? 'preferences'
                  : 'revise';
        let parents: Identity[] | undefined;
        if (c.parents !== undefined) {
          if (!Array.isArray(c.parents) || c.parents.length > 2)
            throw new Error('Choose at most two exact parents.');
          parents = c.parents as Identity[];
        }
        let direction =
          c.direction === undefined ? null : (text(c.direction, 80) as Job['direction']);
        if (operation === 'growth' && (!direction || !DIRECTIONS.includes(direction)))
          throw new Error('Choose a growth direction.');
        let question = typeof c.question === 'string' ? text(c.question, 1200, true) : '';
        if (operation === 'preferences') {
          const reviewIds = strings(c.reviews, 20);
          const reviews = this.store.state.nodes
            .filter((n) => n.garden === gid)
            .flatMap((n) => n.decisions)
            .filter((d) => reviewIds.includes(d.id));
          if (!reviews.length || reviews.length !== reviewIds.length)
            throw new Error('Select existing reviews explicitly.');
          question = canonical({
            reviews: reviews.map((d) => ({ id: d.id, note: d.note, reasons: d.reasons })),
          });
        }
        let targetRevision: Identity | undefined;
        if (operation === 'revise' && typeof c.previousJob === 'string') {
          const old = this.store.state.jobs.find((j) => j.id === c.previousJob);
          if (!old || old.garden !== gid) throw new Error('Previous draft unavailable.');
          if (old.operation === 'growth') {
            operation = 'growth';
            direction = old.direction;
          }
          const node =
            typeof c.previousNode === 'string'
              ? this.store.state.nodes.find((n) => n.id === c.previousNode && n.garden === gid)
              : undefined;
          const selected = node?.revisions.find(
            (r) => r.revision === integer(c.previousRevision, 1, Number.MAX_SAFE_INTEGER),
          );
          if (c.previousNode && !selected)
            throw new Error('Selected candidate revision unavailable.');
          if (node && selected)
            targetRevision = {
              garden: node.garden,
              kind: node.kind,
              id: node.id,
              revision: selected.revision,
            };
          const prior = selected?.content ?? old.draft;
          question = canonical({
            question,
            previousJob: old.id,
            targetRevision: targetRevision ?? null,
            previousDraft:
              prior?.outcome === 'candidate'
                ? { title: prior.title, core: prior.core, example: prior.example }
                : prior,
            omittedDraftFields:
              prior?.outcome === 'candidate'
                ? [
                    'summary',
                    'experience',
                    'contributions',
                    'references',
                    'unknowns',
                    'nextQuestion',
                    'preservedCore',
                    'delta',
                    'changedAssumption',
                    'test',
                  ]
                : [],
            omissionReason:
              'Targeted revision selects complete title/core/example fields; full original remains in the linked job/revision. Source evidence remains separately prepared.',
          });
        }
        let jid = '';
        this.change((w) => {
          jid = prepareJob(w, gid, operation, now, {
            ...(parents ? { parents } : {}),
            question,
            direction,
            ...(typeof c.previousJob === 'string' ? { previousJob: text(c.previousJob, 128) } : {}),
            manual: true,
            ...(targetRevision ? { targetRevision } : {}),
          }).id;
        });
        this.launch(jid);
        break;
      }
      case 'checkNode': {
        const n = this.store.state.nodes.find((n) => n.id === id());
        if (!n) throw new Error('Candidate missing.');
        if (n.job.startsWith('legacy:')) {
          this.change((w) => {
            const node = w.nodes.find((n) => n.id === id())!,
              r = node.revisions.at(-1)!;
            const a = {
              decision: 'needs_context' as const,
              findings: [
                {
                  field: 'legacy contract',
                  issue:
                    'The legacy contract did not retain all rich candidate fields or current evidence citations.',
                  evidence: [],
                  missing:
                    'Prepare a concrete example, parent contributions and reference evidence before semantic screening.',
                },
              ],
              limitations:
                'Deterministic missing-field check; no model was called and no semantic success is claimed.',
              revisionHash: r.hash,
              contextHash: hash(canonical(node.parents)),
              model: 'deterministic legacy-field check',
              at: now,
              raw: '',
              observed: false,
            };
            r.assessments ??= [];
            if (r.assessment) r.assessments.push(structuredClone(r.assessment));
            r.assessments.push(a);
            r.assessment = a;
          });
          break;
        }
        if (this.active || this.pausing || this.error)
          throw new Error('Resolve attention before checking.');
        let jid = '';
        this.change((w) => {
          const n = w.nodes.find((n) => n.id === id())!;
          const r = n.revisions.at(-1)!;
          const j = prepareJob(w, n.garden, 'check', now, {
            parents: n.parents,
            previousJob: r.job ?? n.job,
            existingNode: true,
            targetRevision: { garden: n.garden, kind: n.kind, id: n.id, revision: r.revision },
            exactDraft: r.content,
          });
          j.draft = structuredClone(n.revisions.at(-1)!.content);
          jid = j.id;
        });
        this.launch(jid);
        break;
      }
      case 'check': {
        if (this.active || this.pausing || this.error)
          throw new Error('Resolve attention before checking.');
        let jid = '';
        this.change((w) => {
          const old = w.jobs.find((j) => j.id === id());
          if (old?.draft?.outcome !== 'candidate') throw new Error('Choose a retained draft.');
          const draftHash = hash(canonical(old.draft));
          const existing = w.nodes.find(
            (n) =>
              n.garden === old.garden &&
              n.revisions.some((r) => r.hash === draftHash && (r.job ?? n.job) === old.id),
          );
          const exactRevision = existing?.revisions.find((r) => r.hash === draftHash);
          const j = prepareJob(w, old.garden, 'check', now, {
            parents: old.parents,
            question: old.question,
            previousJob: old.id,
            exactDraft: old.draft,
            existingNode: !!existing,
            ...(existing && exactRevision
              ? {
                  targetRevision: {
                    garden: existing.garden,
                    kind: existing.kind,
                    id: existing.id,
                    revision: exactRevision.revision,
                  },
                }
              : {}),
          });
          // Preserve exact evidence/preference/profile provenance. A newer
          // source or approval is never silently substituted into an old draft.
          const before = JSON.parse(old.pack.payload) as {
            target: string;
            objective: string;
            request: string;
          };
          const after = JSON.parse(j.pack.payload) as {
            target: string;
            objective: string;
            request: string;
          };
          if (
            canonical(j.pack.evidence) !== canonical(old.pack.evidence) ||
            before.target !== after.target ||
            before.objective !== after.objective ||
            before.request !== after.request
          )
            throw new Error(
              'Прежние доказательства изменились или недоступны. Начните явную новую попытку; прежний черновик сохранён.',
            );
          j.draft = structuredClone(old.draft);
          j.heldCalls = Math.min(2, j.heldCalls);
          jid = j.id;
        });
        this.launch(jid);
        break;
      }
      case 'override':
        if (this.active || this.pausing)
          throw new Error('Wait for the active job before committing an override.');
        if (
          await this.services.confirm(
            'Сохранить черновик вопреки замечаниям или незавершённой проверке? Это будет явно отмеченное решение человека. Замечания остаются. Сохранение расходует один свободный слот сада и закрепляет эту пару; вызова модели не будет.',
          )
        )
          this.change((w) => commit(w, id(), now, true));
        break;
      case 'review':
        this.change((w) =>
          decide(
            w,
            id(),
            text(c.state, 10) as 'kept' | 'rejected' | 'later',
            text(c.note, 4000, true),
            Array.isArray(c.reasons) ? strings(c.reasons, 8) : [],
            now,
          ),
        );
        await this.publish();
        break;
      case 'editIdea':
        await this.mutateSelected((w) => {
          const n = w.nodes.find((n) => n.id === id());
          if (!n) throw new Error('Candidate missing.');
          const content = { ...n.revisions.at(-1)!.content, ...(c.content as Partial<Candidate>) };
          const j = w.jobs.find((j) => j.id === (n.revisions.at(-1)!.job ?? n.job));
          if (j) parseDraft(JSON.stringify(content), j);
          editNode(w, id(), content, now);
        });
        await this.publish();
        break;
      case 'recompost':
        this.change((w) => {
          const n = w.nodes.find((n) => n.id === id());
          if (!n?.accepted) throw new Error('Keep an idea before recomposting.');
          const r = n.revisions.at(-1)!,
            sid = addSource(w, n.garden, r.content.title, canonical(r.content), false, now),
            s = w.sources.find((s) => s.id === sid)!;
          s.ancestry = [{ garden: n.garden, kind: n.kind, id: n.id, revision: r.revision }];
          s.origin = 'deterministic extraction';
        });
        break;
      case 'cancelPlan':
        this.change((w) => {
          const g = garden(w, id());
          g.plan = null;
        });
        break;
      case 'localOverride':
        this.change((w) => {
          const g = garden(w, id()),
            previous = g.plan?.id ?? null;
          const p = plan(w, g.id, now >>> 0, true);
          p.route = 'local';
          p.override = previous;
          p.parents = [];
          g.plan = p;
        });
        break;
      case 'chooseImport':
        await this.importFiles(text(c.garden, 128));
        break;
      case 'pasteImport':
        this.makePreview(text(c.garden, 128), [
          {
            name: 'Pasted text',
            text: text(c.text, 1024 * 1024),
            bytesBase64: Buffer.from(text(c.text, 1024 * 1024)).toString('base64'),
            hash: hash(text(c.text, 1024 * 1024)),
          },
        ]);
        break;
      case 'cancelImport':
        this.preview = null;
        break;
      case 'acceptImport':
        this.acceptImport(c);
        break;
      case 'backup':
        {
          const raw = JSON.stringify(this.store.envelope(), null, 2);
          CoherentStore.parseBackup(raw);
          if (await this.services.saveBackup(raw)) {
            this.store.emergency = [];
            this.error = '';
          }
        }
        break;
      case 'restore':
        {
          await this.pause();
          const [file] = await this.services.pick('restore');
          if (!file) break;
          const info = await lstat(file);
          if (
            !info.isFile() ||
            info.isSymbolicLink() ||
            info.size > 192 * 1024 * 1024 ||
            (await realpath(file)).toLowerCase() !== path.resolve(file).toLowerCase()
          )
            throw new Error('Choose a regular recovery backup up to 192 MiB.');
          const raw = await readFile(file, 'utf8'),
            preview = CoherentStore.parseBackup(raw);
          if (
            await this.services.confirm(
              `Восстановить сады: ${preview.workspace.gardens.length}, исходные идеи: ${preview.workspace.sources.length}, карточки и ветви: ${preview.workspace.nodes.length}? Зависимости доноров включены. Проверенная копия для отката останется; расходы вызовов и пути установки сохранятся. После восстановления автозапуск на паузе, обмен выключен.`,
            )
          ) {
            this.store.restore(raw);
            await this.publish();
          }
        }
        break;
      case 'deleteSource':
      case 'deleteGarden':
        {
          const gid = c.op === 'deleteGarden' ? id() : null,
            sid = c.op === 'deleteSource' ? id() : null,
            p = deletionPreview(this.store.state, gid, sid);
          if (
            await this.services.confirm(
              `Будут удалены исходные идеи: ${p.sources.length}, карточки и ветви: ${p.nodes.length}, связанные задания: ${p.jobs.length}. Сохранённых документов в связях: ${p.documents.length}. Исторические снимки заданий, оригиналы файлов, резервные копии и экспорты остаются до отдельного удаления. Проверьте связи перед подтверждением.`,
            )
          ) {
            await this.pause();
            this.change((w) => remove(w, gid, sid, Date.now()));
            await this.publish();
          }
        }
        break;
      case 'purgeBackup':
        {
          const bid = integer(c.id, 1, Number.MAX_SAFE_INTEGER),
            sha = text(c.sha, 64);
          if (
            await this.services.confirm(
              'Безвозвратно удалить эту приватную резервную копию? Другие копии и экспорты останутся.',
            )
          )
            this.store.purgeBackup(bid, sha);
        }
        break;
      case 'purgeOriginal':
        if (
          await this.services.confirm(
            'Удалить сохранённый документ? Версии исходных идей и копии в резервных файлах и экспортах останутся.',
          )
        )
          this.change((w) => {
            if (
              w.sources.some((s) => s.fileId === id()) ||
              w.references.some((r) => r.fileId === id() && !r.removed)
            )
              throw new Error('Original still referenced by active sources/references.');
            w.documents = w.documents.filter((d) => d.id !== id());
          });
        break;
      case 'purgeLegacy':
        if (
          await this.services.confirm(
            'Удалить сохранённую прежнюю рабочую область и её журнал? Перенесённые записи и отдельные копии для отката останутся. Старая история исчезнет из новых полных резервных копий.',
          )
        )
          this.change((w) => {
            w.legacy = null;
            for (const g of w.gardens) g.legacy = null;
          });
        break;
      case 'cleanupLifecycle': {
        await this.pause('Lifecycle cleanup requested.');
        const count = this.store.state.lifecycle.length;
        if (
          !(await this.services.confirm(
            `Сохранить полную приватную копию, затем очистить ${count} записей о запуске и остановке? Ответы модели и ваши решения останутся. Прежние резервные копии сохраняют историю.`,
          ))
        )
          break;
        const raw = JSON.stringify(this.store.envelope());
        CoherentStore.parseBackup(raw);
        if (await this.services.saveBackup(raw)) {
          this.change((w) => {
            w.lifecycle = [];
          });
          this.store.emergency = [];
          this.error = this.exportError;
        }
        break;
      }
      case 'purgeJob': {
        if (this.active || this.store.emergency.length)
          throw new Error('Drain work and save emergency evidence before purging.');
        const jid = id(),
          w = this.store.state,
          j = w.jobs.find((j) => j.id === jid);
        if (!j || active(j)) throw new Error('Choose a completed job.');
        if (
          w.nodes.some((n) => n.job === jid || n.revisions.some((r) => r.job === jid)) ||
          w.jobs.some((j) => j.previousJob === jid)
        )
          throw new Error(
            'Active work or another retained job depends on this evidence. Review the cascade first.',
          );
        if (
          await this.services.confirm(
            `Удалить это задание, его ответы (${j.raw.length}), контекст, оценки и сырые квитанции (${this.store.receipts().filter((r) => r.jobId === jid).length})? Расходы вызовов и попыток, остальные записи, резервные копии и экспорты останутся. Повторный ID запроса не запустит работу заново.`,
          )
        )
          this.store.change(
            (w) => {
              w.jobs = w.jobs.filter((j) => j.id !== jid);
              for (const r of w.requests ?? [])
                if (r.job === jid) {
                  r.job = null;
                  r.state = 'settled';
                }
            },
            true,
            [jid],
          );
        break;
      }
      case 'pickExport':
        {
          const [directory] = await this.services.pick('export');
          if (directory) {
            await initializeExport(directory, this.forbidden);
            this.change((w) => {
              w.exportDirectory = directory;
            });
            await this.publish();
          }
        }
        break;
      case 'export':
        await this.publish();
        break;
      case 'openExport':
        if (this.store.state.exportDirectory)
          await this.services.openDirectory(this.store.state.exportDirectory);
        break;
      case 'openData':
        await this.services.openDirectory(this.store.directory);
        break;
      case 'autostart':
        this.services.autostart(boolean(c.enabled));
        break;
      case 'cleanupExports':
        await this.cleanupExports();
        break;
      default:
        throw new Error('Unknown desktop operation.');
    }
    this.emit();
    return this.view();
  }
  private async importFiles(g: string) {
    const paths = await this.services.pick('import');
    if (paths.length > 20) throw new Error('Select at most 20 files per batch.');
    const files: ImportPreview['files'] = [];
    for (const file of paths) {
      const info = await lstat(file);
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        info.size > 1024 * 1024 ||
        (await realpath(file)).toLowerCase() !== path.resolve(file).toLowerCase() ||
        !['.md', '.txt', '.json'].includes(path.extname(file).toLowerCase())
      )
        throw new Error(
          'Only explicitly selected regular UTF-8 files up to 1 MiB; archives and linked paths are refused.',
        );
      const raw = await readFile(file),
        value = new TextDecoder('utf-8', { fatal: true }).decode(raw);
      files.push({
        name: path.basename(file),
        bytesBase64: raw.toString('base64'),
        text: value,
        hash: hash(raw),
      });
    }
    if (files.length) this.makePreview(g, files);
  }
  private makePreview(g: string, files: ImportPreview['files']) {
    garden(this.store.state, g);
    this.preview = {
      id: uuid(),
      garden: g,
      revision: this.store.state.revision,
      files,
      items: files.map((f, i) => {
        const exact = this.store.state.sources.find(
            (s) => s.garden === g && current(s).text === f.text,
          ),
          similar = this.store.state.sources.some(
            (s) => s.garden === g && current(s).title.toLowerCase() === f.name.toLowerCase(),
          );
        return {
          title: f.name,
          text: f.text,
          file: i,
          duplicate: exact ? 'exact' : similar ? 'similar title' : 'new',
          existing: exact?.id ?? null,
        };
      }),
    };
  }
  private acceptImport(c: CoherentCommand) {
    const p = this.preview;
    if (!p || p.id !== c.id || p.revision !== this.store.state.revision)
      throw new Error('Import preview changed; reopen it.');
    if (!Array.isArray(c.choices) || c.choices.length !== p.items.length)
      throw new Error('Choose link/skip/new-copy for each item.');
    this.change((w) => {
      for (const [i, item] of p.items.entries()) {
        const choice = (c.choices as unknown[])[i];
        if (choice === 'skip' || choice === 'link') {
          if (choice === 'link' && !item.existing)
            throw new Error('No exact existing source to link.');
          continue;
        }
        if (choice !== 'new-copy') throw new Error('Invalid import choice.');
        if (w.documents.length >= 1000) throw new Error('Retained original capacity reached.');
        const f = p.files[item.file]!,
          doc = {
            id: uuid(),
            name: f.name,
            text: f.text,
            bytesBase64: f.bytesBase64,
            hash: f.hash,
            decoding: 'UTF-8 fatal decoder; original bytes retained',
            entry: {
              at: Date.now(),
              timezone: w.settings.timezone,
              offset: new Date().getTimezoneOffset(),
            },
          };
        w.documents.push(doc);
        const sid = addSource(
            w,
            p.garden,
            item.title,
            item.text,
            boolean(c.participating),
            Date.now(),
          ),
          s = w.sources.find((s) => s.id === sid)!;
        s.fileId = doc.id;
        s.origin = 'imported assertion';
      }
    });
    this.preview = null;
  }
  private launch(id: string) {
    if (this.previewState) {
      this.pendingRemote = {
        id: uuid(),
        expires: Date.now() + 300000,
        revision: this.store.state.revision,
        workspace: structuredClone(this.previewState),
        job: id,
      };
      return;
    }
    this.currentId = id;
    this.abort = new AbortController();
    const signal = AbortSignal.any([this.abort.signal, AbortSignal.timeout(540000)]);
    this.active = this.pipeline(id, signal)
      .catch((e) => {
        this.error = message(e);
      })
      .finally(async () => {
        const releaseAt = Date.now();
        try {
          await this.releaseResources();
          this.lifecycle(
            this.store.state.jobs.find((j) => j.id === id)?.provider &&
              isRemote(this.store.state.jobs.find((j) => j.id === id)?.provider)
              ? 'remote wait drained'
              : 'release confirmed',
            Date.now() - releaseAt,
            '',
          );
          this.authorizedRemote.delete(id);
        } catch (e) {
          this.stopUnconfirmed = true;
          this.error = message(e);
          this.lifecycle('release failed', Date.now() - releaseAt, this.error);
        }
        try {
          this.change((w) => {
            const r = w.requests?.find((r) => r.job === id);
            const j = w.jobs.find((j) => j.id === id);
            if (r)
              r.state = j?.dispatches?.some(
                (d) =>
                  d.error && (d.promptTokensObserved === null || d.outputTokensObserved === null),
              )
                ? 'uncertain'
                : 'settled';
          });
        } catch (e) {
          this.error = 'Persistence attention: ' + message(e);
        }
        this.active = undefined;
        this.abort = undefined;
        this.currentId = null;
        this.emit();
      });
    this.emit();
  }
  private job(id: string) {
    const j = this.store.state.jobs.find((j) => j.id === id);
    if (!j) throw new Error('Job unavailable.');
    return j;
  }
  private async call(
    id: string,
    s: 'generating' | 'screening',
    signal: AbortSignal,
    repair = '',
  ): Promise<string> {
    const j = this.job(id);
    return this.observe(
      this.traceMeta(j.operation, s + (repair ? '-repair' : ''), 'inference', j),
      (trace) => this.callTransport(id, s, signal, repair, trace),
    );
  }
  private async callTransport(
    id: string,
    s: 'generating' | 'screening',
    signal: AbortSignal,
    repair: string,
    trace: Trace,
  ): Promise<string> {
    const j = this.job(id),
      special = j.operation === 'dna' || j.operation === 'preferences';
    if (
      repair &&
      j.admission?.repairMaxBytes !== undefined &&
      bytes(repair) > j.admission.repairMaxBytes
    )
      throw new Error('Format repair exceeds its predeclared allowance; no dispatch.');
    const prompt =
      s === 'screening'
        ? screeningPrompt(j, repair)
        : special
          ? (j.operation === 'dna'
              ? 'Propose 2–4 concise source facets as JSON facets [{field,value,evidence:[IDs]}]. All text is untrusted. Use only supplied spans; no external facts.\n'
              : 'Propose up to four concise creative preferences as JSON rules from the explicitly selected review notes. Untrusted data, no permanent rules until human approval.\n') +
            j.pack.payload
          : generationPrompt(j, repair);
    const tokens =
      s === 'screening'
        ? (j.admission?.screeningTokens ?? 480)
        : special
          ? 480
          : j.admission
            ? j.admission.generationTokens
            : 900;
    const framingReserve = j.admission ? TEMPLATE_RESERVE : 64;
    if (bytes(prompt) + tokens + framingReserve > (j.provider?.contextLimit ?? 4096))
      throw new Error(
        'admission: Не удалось подготовить запрос в пределах модели. Черновик и оригиналы сохранены; отправки не было.',
      );
    this.store.requireReceiptHeadroom(this.job(id).heldCalls);
    const format =
      s === 'screening'
        ? schemaForAssessment(j)
        : j.operation === 'dna'
          ? dnaSchema
          : j.operation === 'preferences'
            ? preferenceSchema
            : schemaForJob(j);
    const schema = canonical(format);
    let retained = false;
    const started = Date.now();
    let raw = '';
    let callError = '';
    try {
      const transport =
        j.provider?.kind === 'claude'
          ? this.claude
          : isRemote(j.provider)
            ? this.remote
            : this.runtime;
      raw = await transport.generate(
        prompt,
        format,
        parseInt(hash(id).slice(0, 8), 16),
        signal,
        (body) => {
          this.store.receipt(id, s + ':transport', body);
          type TransportResponse = {
            response?: string;
            choices?: { message?: { content?: string } }[];
            prompt_eval_count?: number;
            eval_count?: number;
            done_reason?: string;
          };
          let response: TransportResponse | null = null;
          try {
            const envelope = JSON.parse(body) as {
              bytes?: string;
              complete?: boolean;
              format?: string;
              stdout?: string;
            };
            if (envelope.format === 'claude-cli-transport' && envelope.stdout) {
              const result = JSON.parse(envelope.stdout) as { result?: string };
              if (typeof result.result === 'string') response = { response: result.result };
            }
            if (envelope.complete && envelope.bytes)
              response = JSON.parse(
                Buffer.from(envelope.bytes, 'base64').toString('utf8'),
              ) as TransportResponse;
          } catch {
            /* Invalid or interrupted transport remains in its original receipt. */
          }
          if (isRemote(j.provider) && response?.choices?.[0]?.message?.content)
            response.response = response.choices[0].message.content;
          if (typeof response?.response === 'string') {
            const original = response.response;
            this.store.receipt(id, s + ':model', original);
            this.change((w) => {
              const job = w.jobs.find((j) => j.id === id)!;
              job.raw.push({ stage: s + (repair ? ':repair' : ''), raw: original, at: Date.now() });
            });
            retained = true;
          }
          if (response)
            this.change((w) => {
              const d = w.jobs.find((j) => j.id === id)!.dispatches?.at(-1);
              if (d) {
                d.promptTokensObserved = Number.isSafeInteger(response!.prompt_eval_count)
                  ? response!.prompt_eval_count!
                  : null;
                d.outputTokensObserved = Number.isSafeInteger(response!.eval_count)
                  ? response!.eval_count!
                  : null;
                d.doneReason = response!.done_reason ?? null;
              }
            });
          if (response) trace.tokens(response.prompt_eval_count, response.eval_count);
        },
        () => {
          if (signal.aborted || this.pausing || this.stopUnconfirmed)
            throw new Error('Cancelled before dispatch.');
          this.change((w) => {
            const call = dispatch(w, id, s, Date.now(), !!repair),
              job = w.jobs.find((j) => j.id === id)!;
            if (
              isRemote(job.provider) &&
              (!this.authorizedRemote.has(id) ||
                !job.remoteConsent ||
                job.remoteConsent.contextHash !== job.pack.hash ||
                job.remoteConsent.providerHash !== providerHash(job.provider!))
            )
              throw new Error('Remote consent invalid.');
            (job.dispatches ??= []).push({
              id: call,
              stage: s + (repair ? ':repair' : ''),
              at: Date.now(),
              prompt,
              schema,
              schemaHash: hash(schema),
              outputTokens: tokens,
              timeoutMs: 180000,
              inputByteUpperBound:
                bytes(prompt) +
                framingReserve +
                (isRemote(j.provider) ? bytes(JSON.stringify(format)) + 128 : 0),
              framingReserve,
              counting: 'utf8-byte-upper-bound',
              admissionVersion: j.admission?.version ?? 'historical-stage-check',
              promptVersion: j.promptVersion,
              schemaVersion:
                s === 'screening'
                  ? ['coherent-4', 'coherent-5', 'coherent-6'].includes(j.promptVersion)
                    ? 'assessment-2'
                    : 'assessment-1'
                  : j.schemaVersion,
              promptTokensObserved: null,
              outputTokensObserved: null,
              doneReason: null,
            });
          });
          this.emit();
        },
        { tokens, timeout: STAGE_TIMEOUT_MS, requestedModel: j.model },
        ...(isRemote(j.provider)
          ? [
              (o: import('./groq-runtime').RemoteObservation) => {
                trace.tokens(o.promptTokens, o.outputTokens);
                trace.httpStatus(o.httpStatus);
                trace.reportedModel(o.reportedModel);
                this.change((w) => {
                  const d = w.jobs.find((j) => j.id === id)!.dispatches!.at(-1)!;
                  d.remote = o;
                  d.promptTokensObserved = o.promptTokens;
                  d.outputTokensObserved = o.outputTokens;
                  d.doneReason = o.finishReason;
                });
              },
            ]
          : []),
      );
    } catch (e) {
      trace.outcome(signal.aborted ? 'cancelled' : 'transport_error');
      callError = message(e);
      throw e;
    } finally {
      this.change((w) => {
        const d = w.jobs.find((j) => j.id === id)?.dispatches?.at(-1);
        if (d && !d.completedAt) {
          d.completedAt = Date.now();
          d.durationMs = Date.now() - started;
          d.error = callError;
        }
      });
    }
    if (!retained) {
      this.store.receipt(id, s + ':model', raw);
      this.change((w) => {
        const j = w.jobs.find((j) => j.id === id)!;
        j.raw.push({ stage: s + (repair ? ':repair' : ''), raw, at: Date.now() });
      });
    }
    return raw;
  }
  private async formatted<T>(
    id: string,
    s: 'generating' | 'screening',
    signal: AbortSignal,
    parse: (raw: string, j: Job) => T,
  ): Promise<T> {
    let raw = await this.call(id, s, signal);
    const validate = (value: string) =>
      this.observe(
        this.traceMeta(this.job(id).operation, s + '-validation', 'validation', this.job(id)),
        (trace) => {
          let result: T | undefined,
            invalid: unknown,
            failed = false;
          trace.validate(() => {
            try {
              result = parse(value, this.job(id));
            } catch (e) {
              failed = true;
              invalid = e;
              throw e;
            }
          });
          if (failed) {
            trace.outcome('invalid');
            throw invalid;
          }
          return result as T;
        },
      );
    try {
      return await validate(raw);
    } catch (e) {
      const primary = message(e);
      this.change((w) => {
        w.jobs.find((j) => j.id === id)!.primaryFailure = primary;
      });
      const j = this.job(id);
      // A generation repair must leave a held call for the checker.
      if (j.repairUsed || j.heldCalls < (s === 'generating' ? 2 : 1)) {
        this.change((w) => {
          w.jobs.find((j) => j.id === id)!.repairRefusal =
            'Format repair unavailable: reserved call budget or shared repair cap.';
        });
        throw new Error(primary, { cause: e });
      }
      try {
        const repair =
          j.promptVersion === 'provider-2'
            ? boundedRepairFeedback(
                raw,
                s === 'generating' ? schemaForJob(j) : schemaForAssessment(j),
              )
            : (j.admission?.repairInstruction ?? primary);
        raw = await this.call(id, s, signal, repair);
        return await validate(raw);
      } catch (repairError) {
        this.change((w) => {
          w.jobs.find((j) => j.id === id)!.repairRefusal = message(repairError);
        });
        throw new Error(primary + '; repair: ' + message(repairError), { cause: repairError });
      }
    }
  }
  private async pipeline(id: string, signal: AbortSignal) {
    const started = Date.now();
    try {
      const remote = isRemote(this.job(id).provider);
      if (remote && !this.authorizedRemote.has(id))
        throw new Error('Remote job needs fresh session consent.');
      const model = remote
        ? this.job(id).provider?.kind === 'claude'
          ? await this.claude.start(this.job(id).model)
          : await this.remote.start()
        : await this.runtime.start(this.store.state.runtime);
      if (signal.aborted) throw new Error('Cancelled during model startup.');
      this.change((w) => {
        const j = w.jobs.find((j) => j.id === id)!;
        revalidate(w, j, Date.now());
        j.model = model.model;
        j.modelDigest = model.digest;
      });
      const operation = this.job(id).operation;
      if (operation === 'dna' || operation === 'preferences') {
        const raw = await this.call(id, 'generating', signal),
          o = JSON.parse(raw) as {
            facets?: { field: string; value: string; evidence: string[] }[];
            rules?: string[];
          };
        this.change((w) => {
          const j = w.jobs.find((j) => j.id === id)!;
          revalidate(w, j, Date.now());
          if (operation === 'dna') {
            if (!Array.isArray(o.facets) || o.facets.length < 2 || o.facets.length > 4)
              throw new Error('Decode DNA must propose 2–4 facets.');
            const s = w.sources.find((s) => s.id === j.parents[0]!.id)!;
            for (const f of o.facets) {
              if (
                !Array.isArray(f.evidence) ||
                !f.evidence.length ||
                f.evidence.some(
                  (id) =>
                    !j.pack.evidence.some(
                      (e) =>
                        e.id === id && e.parent?.id === j.parents[0]?.id && e.originalSpan !== null,
                    ),
                )
              )
                throw new Error('Unresolved proposed facet evidence.');
              current(s).preparation.facets.push({
                id: uuid(),
                field: text(f.field, 60),
                value: text(f.value, 240),
                origin: 'local-model proposal',
                approved: false,
                sourceRevision: current(s).revision,
                spans: f.evidence
                  .map((id) => j.pack.evidence.find((e) => e.id === id)!.originalSpan!)
                  .filter(Boolean),
                inheritedFrom: null,
              });
            }
          } else {
            if (!Array.isArray(o.rules) || o.rules.length > 4)
              throw new Error('Invalid preference proposals.');
            for (const rule of o.rules)
              w.preferences.push({
                id: uuid(),
                revision: 1,
                garden: j.garden,
                text: text(rule, 240),
                approved: false,
                enabled: false,
                reviews: j.question
                  ? (JSON.parse(j.question) as { reviews: { id: string }[] }).reviews.map(
                      (r) => r.id,
                    )
                  : [],
                origin: 'local-model proposal',
              });
          }
          finish(w, j, 'screened', Date.now());
        });
        return;
      }
      if (operation !== 'check') {
        const draft = await this.formatted(id, 'generating', signal, (raw, job) =>
          parseDraft(raw, job, 'generated'),
        );
        this.change((w) => {
          const j = w.jobs.find((j) => j.id === id)!;
          j.draft = draft;
          if (active(j)) stage(j, 'draft retained', Date.now());
        });
        revalidate(this.store.state, this.job(id), Date.now());
        if (draft.outcome !== 'candidate') {
          this.change((w) =>
            finish(
              w,
              w.jobs.find((j) => j.id === id)!,
              draft.outcome === 'needs_context' ? 'needs_context' : 'negative',
              Date.now(),
            ),
          );
          return;
        }
      } else
        this.change((w) => {
          stage(
            w.jobs.find((j) => j.id === id)!,
            'draft retained',
            Date.now(),
          );
        });
      const assessment = await this.formatted(id, 'screening', signal, (raw, j) =>
        parseAssessment(raw, j, Date.now()),
      );
      this.change((w) => {
        w.jobs.find((j) => j.id === id)!.assessment = assessment;
      });
      this.change((w) => {
        const j = w.jobs.find((j) => j.id === id)!;
        revalidate(w, j, Date.now());
        j.assessment = assessment;
        if (assessment.decision === 'pass') commit(w, id, Date.now());
        else {
          if (j.operation === 'check' && j.targetRevision) {
            const node = w.nodes.find((n) => n.id === j.targetRevision!.id);
            const revision = node?.revisions.find((r) => r.revision === j.targetRevision!.revision);
            if (revision) {
              revision.assessments ??= [];
              if (
                revision.assessment &&
                !revision.assessments.some((a) => canonical(a) === canonical(revision.assessment))
              )
                revision.assessments.push(structuredClone(revision.assessment));
              revision.assessments.push(structuredClone(assessment));
              revision.assessment = structuredClone(assessment);
            }
          }
          finish(w, j, assessment.decision, Date.now());
        }
      });
      await this.publish();
    } catch (e) {
      const error = message(e);
      try {
        this.change((w) => {
          const j = w.jobs.find((j) => j.id === id)!;
          if (!active(j)) {
            j.primaryFailure ||= error;
            return;
          }
          if (error.startsWith('needs_context:')) {
            j.primaryFailure ||= error;
            finish(w, j, 'needs_context', Date.now());
          } else if (
            /Accounting date|Selected source|Consent, participation|Job cancelled/.test(error) &&
            !(j.primaryFailure && j.repairRefusal)
          ) {
            j.primaryFailure ||= error;
            finish(w, j, 'interrupted', Date.now());
          } else {
            if (!j.attemptCharged) this.error = error;
            fail(w, j, error, Date.now(), signal.aborted || j.epoch !== w.epoch);
          }
        });
      } catch (saveError) {
        this.error = 'Persistence attention: ' + message(saveError);
      }
      if (this.remote.emergencyPending || this.claude.emergencyPending)
        this.error =
          'Секретный исходный ответ удерживается в памяти. Восстановите защищённое хранилище и сохраните recovery до выхода.';
      if (this.store.emergency.length)
        this.error = 'Original responses retained in memory; export a full backup.';
    } finally {
      if (Date.now() - started > 540000)
        this.error ||=
          'Job exceeded the three-stage wall-clock budget; inspect retained stage timing.';
      this.emit();
    }
  }
  tick(now = Date.now()) {
    if (isRemote(this.store.state.provider)) return;
    if (this.active || this.pausing || this.error || this.store.state.paused) return;
    if (now < this.store.state.lastObservedAt - 1000) {
      void this.pause('Clock moved backwards.');
      return;
    }
    for (const g of due(this.store.state, now)) {
      if (wait(this.store.state, g.id, now)) continue;
      if (g.plan?.blocked?.fingerprint === admissionConditions(this.store.state, g.id)) continue;
      try {
        let id = '';
        this.change((w) => {
          const p = plan(w, g.id, crypto.getRandomValues(new Uint32Array(1))[0]!, false);
          if (!selection(w, p).length) return;
        });
        if (!garden(this.store.state, g.id).plan?.parents.length) {
          this.emit();
          continue;
        }
        this.change((w) => {
          id = prepareJob(w, g.id, 'blend', now, {
            manual: false,
            seed: garden(w, g.id).plan!.seed,
          }).id;
        });
        if (id) {
          this.launch(id);
          return;
        }
      } catch (e) {
        if (/^admission:|^needs_context:|Selection consent|Selection policy/.test(message(e))) {
          this.change((w) => {
            const target = garden(w, g.id);
            if (target.plan) target.plan.reason = message(e);
            if (target.plan && message(e).startsWith('admission:'))
              target.plan.blocked = {
                fingerprint: admissionConditions(w, g.id),
                reason: message(e),
              };
          });
          this.emit();
          continue;
        }
        this.error = message(e);
        this.emit();
        return;
      }
    }
  }
  private async cleanupExports() {
    const root = this.store.state.exportDirectory;
    await initializeExport(root, this.forbidden);
    const dir = await safeDirectory(path.join(root, 'snapshots'));
    const pointer = JSON.parse(await readFile(path.join(root, 'CURRENT.json'), 'utf8')) as {
      generation: string;
    };
    if (!/^\d{13}-[0-9a-f-]{36}$/.test(pointer.generation))
      throw new Error('Invalid export pointer.');
    const old = (await readdir(dir, { withFileTypes: true })).filter(
      (e) => e.name !== pointer.generation,
    );
    if (
      !(await this.services.confirm(
        `Удалить ${old.length} прежних снимков папки для чтения? Текущий снимок и ваши заметки анализа останутся.`,
      ))
    )
      return;
    for (const e of old) {
      if (
        !e.isDirectory() ||
        e.isSymbolicLink() ||
        !/^(?:\.pending-)?\d{13}-[0-9a-f-]{36}$/.test(e.name)
      )
        throw new Error('Unexpected snapshot path.');
      const target = await safeDirectory(path.join(dir, e.name));
      for (const f of await readdir(target, { withFileTypes: true })) {
        if (
          !f.isFile() ||
          f.isSymbolicLink() ||
          !/^(?:manifest\.json|INDEX\.md|(?:idea|branch)-[0-9a-f]{24}\.md)$/.test(f.name)
        )
          throw new Error('Unexpected export file.');
        await unlink(path.join(target, f.name));
      }
      await rmdir(target);
    }
  }
  async close() {
    const start = Date.now();
    try {
      await this.pause('Exit requested.');
      await this.publishing;
      if (this.remote.emergencyPending || this.claude.emergencyPending)
        throw new Error(
          'Секретный исходный ответ удерживается в памяти. Восстановите защищённое хранилище и сохраните recovery до выхода.',
        );
      if (this.store.emergency.length) throw new Error('Save emergency responses before exit.');
      if (this.error) throw new Error(this.error);
      this.lifecycle('shutdown prepared', Date.now() - start, '');
      if (this.remote.emergencyPending || this.claude.emergencyPending)
        throw new Error(
          'Секретный исходный ответ удерживается в памяти. Восстановите защищённое хранилище и сохраните recovery до выхода.',
        );
      if (this.store.emergency.length)
        throw new Error('Shutdown preparation could not be persisted.');
      this.store.close();
      let flushTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          this.telemetry.flush().catch(() => false),
          new Promise((resolve) => {
            flushTimer = setTimeout(resolve, 2000);
          }),
        ]);
      } catch {
        /* Optional monitoring never blocks a safe shutdown. */
      } finally {
        if (flushTimer) clearTimeout(flushTimer);
      }
    } catch (e) {
      this.lifecycle('shutdown failed', Date.now() - start, message(e));
      throw e;
    }
  }
}
