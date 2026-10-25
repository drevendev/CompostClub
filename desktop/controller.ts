import { readFile, lstat, readdir, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import {
  addScrap,
  beginRequest,
  completeRequest,
  DESKTOP_LIMITS,
  deletionSet,
  editScrap,
  failRequest,
  hash,
  pairKey,
  reconcile,
  recompost,
  recordResponse,
  removeScrap,
  retryablePairs,
} from '../src/domain/garden';
import {
  beginGrowth,
  decideGrowth,
  DIRECTIONS,
  parseGrowth,
  proposeGrowth,
  recordGrowth,
  stopGrowth,
  type Direction,
  type Growth,
} from '../src/domain/growth';
import {
  acceptImport,
  callsToday,
  eligiblePairs,
  noteEvent,
  parseTags,
  prepareImport,
  reserveCall,
  unreviewed,
  waitReason,
  type ImportedFile,
  type ImportPreview,
  type Workspace,
} from '../src/domain/experiment';
import { prompt, schemaFor } from '../src/inference/contract';
import { generateWithEvidence } from '../src/inference/generate';
import { growthSchema, tendPrompt } from '../src/inference/tend';
import { DesktopStore, digest } from './store';
import { exportWorkspace, initializeExport, safeDirectory } from './export';
import { OwnedOllama } from './runtime';
import type { DesktopCommand, DesktopView } from './types';

export interface DesktopServices {
  pick(kind: 'executable' | 'models' | 'export' | 'import' | 'restore'): Promise<string[]>;
  saveBackup(raw: string): Promise<boolean | void>;
  confirm(message: string): Promise<boolean>;
  openDirectory(directory: string): Promise<void>;
  autostart(enabled: boolean): void;
  autostartEnabled?(): boolean;
}
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
export class DesktopController {
  readonly runtime = new OwnedOllama();
  private abort: AbortController | undefined;
  private active: Promise<void> | undefined;
  private pausing = false;
  private attention = '';
  private preview: ImportPreview | null = null;
  private lastExport: DesktopView['exportStatus'] = null;
  private publishing: Promise<void> = Promise.resolve();
  private subscribers = new Set<(view: DesktopView) => void>();
  private closed = false;
  private controlEpoch = 0;
  private safetyStopped = false;
  private checkedModel: { digest: string; at: number } | undefined;
  constructor(
    readonly store: DesktopStore,
    private services: DesktopServices,
    readonly forbidden: string[],
  ) {}
  subscribe(fn: (view: DesktopView) => void): () => void {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }
  view(): DesktopView {
    const w = structuredClone(this.store.state),
      reason = waitReason(
        {
          ...w,
          experiment: { ...w.experiment, enabled: w.experiment.enabled && !this.safetyStopped },
        },
        Date.now(),
      );
    if (this.safetyStopped) w.experiment.enabled = false;
    w.garden = reconcile(w.garden, Date.now());
    return {
      workspace: structuredClone(w),
      status: this.pausing
        ? 'pausing'
        : this.attention
          ? 'attention'
          : this.active
            ? 'running'
            : w.experiment.enabled
              ? 'waiting'
              : 'paused',
      reason: this.attention || reason,
      busy: !!this.active || this.pausing,
      model: {
        connected: this.runtime.running,
        digest: this.runtime.digest || this.checkedModel?.digest || '',
        ...(this.checkedModel ? { checkedAt: this.checkedModel.at } : {}),
        ...(this.runtime.pid ? { pid: this.runtime.pid } : {}),
      },
      exportStatus: this.lastExport,
      preview: this.preview,
      backups: this.store.backups(),
      receiptCount: this.store.receipts().length,
      dataDirectory: this.store.directory,
      autostart: this.services.autostartEnabled?.() ?? false,
    };
  }
  private emit(): void {
    if (!this.closed) for (const fn of this.subscribers) fn(this.view());
  }
  private change(fn: (w: Workspace) => void, backup = true, purgeJobs: string[] = []): void {
    this.store.change(fn, backup, purgeJobs);
    this.emit();
  }
  private fail(e: unknown): void {
    this.safetyStopped = true;
    this.attention = message(e);
    try {
      this.change((w) => {
        w.experiment.enabled = false;
        w.experiment.reason = this.attention;
      }, false);
    } catch {
      /* Preserve the original database and expose the storage error. */
    }
    this.emit();
  }
  async publish(): Promise<void> {
    if (!this.store.state.exportDirectory) return;
    const task = this.publishing.then(async () => {
      this.lastExport = await exportWorkspace(structuredClone(this.store.state), this.forbidden);
      this.emit();
    });
    this.publishing = task.catch(() => {});
    try {
      await task;
    } catch (e) {
      this.fail(new Error('Export is stale: ' + message(e)));
      throw e;
    }
  }
  async pause(reason = 'Paused by you. Model resources released.'): Promise<void> {
    ++this.controlEpoch;
    this.safetyStopped = true;
    this.pausing = true;
    this.abort?.abort();
    let persistenceError: unknown;
    try {
      try {
        this.change((w) => {
          w.experiment.enabled = false;
          w.experiment.reason = 'Stopping work and releasing model resources…';
        }, false);
      } catch (e) {
        persistenceError = e;
        this.fail(e);
      }
      // Killing the owned tree also cancels a runtime that ignores HTTP disconnect.
      await this.runtime.release();
      await this.active;
      try {
        this.change((w) => {
          w.experiment.enabled = false;
          w.experiment.reason = reason;
        }, false);
      } catch (e) {
        persistenceError = e;
        this.fail(e);
      }
      if (persistenceError)
        throw new Error(
          'Compute was stopped, but pause could not be saved. Export a full backup before exit.',
          { cause: persistenceError },
        );
    } catch (e) {
      this.fail(e);
      throw e;
    } finally {
      this.pausing = false;
      this.emit();
    }
  }
  private assertIdle(): void {
    if (this.active || this.pausing)
      throw new Error('Pause and finish the current operation first.');
  }
  async command(input: unknown): Promise<DesktopView> {
    if (!input || typeof input !== 'object' || JSON.stringify(input).length > 2 * 1024 * 1024)
      throw new Error('Invalid desktop command.');
    const c = input as DesktopCommand;
    const str = (value: unknown, max = 8192) => {
      if (typeof value !== 'string' || value.length > max) throw new Error('Invalid command text.');
      return value;
    };
    const bool = (v: unknown) => {
      if (typeof v !== 'boolean') throw new Error('Invalid command flag.');
      return v;
    };
    switch (c.op) {
      case 'snapshot':
        break;
      case 'pause':
        await this.pause();
        break;
      case 'resume': {
        this.assertIdle();
        const epoch = this.controlEpoch;
        if (!this.store.state.exportDirectory)
          throw new Error('Choose a Codex export folder before starting the experiment.');
        await this.publish();
        if (epoch !== this.controlEpoch) throw new Error('Resume was cancelled by a newer pause.');
        try {
          const model = await this.runtime.start(this.store.state.runtime);
          this.checkedModel = { digest: model.digest, at: Date.now() };
          if (epoch !== this.controlEpoch)
            throw new Error('Resume was cancelled by a newer pause.');
        } catch (e) {
          await this.runtime.release();
          throw e;
        }
        this.attention = '';
        this.change((w) => {
          w.experiment.enabled = true;
          w.experiment.reason = 'Experiment enabled.';
          w.experiment.consecutiveFailures = 0;
          if (Date.now() < w.experiment.lastObservedAt - 1000)
            throw new Error('System clock moved backwards. Wait until it catches up.');
        });
        this.safetyStopped = false;
        break;
      }
      case 'connect':
        this.assertIdle();
        try {
          const model = await this.runtime.start(this.store.state.runtime);
          this.checkedModel = { digest: model.digest, at: Date.now() };
        } finally {
          await this.runtime.release();
        }
        break;
      case 'pickExecutable':
      case 'pickModels': {
        await this.pause('Paused after changing local model setup.');
        const [selected] = await this.services.pick(
          c.op === 'pickExecutable' ? 'executable' : 'models',
        );
        if (selected)
          this.change((w) => {
            if (c.op === 'pickExecutable') w.runtime.executable = selected;
            else w.runtime.models = selected;
          });
        break;
      }
      case 'pickExport': {
        this.assertIdle();
        const [selected] = await this.services.pick('export');
        if (!selected) break;
        await initializeExport(selected, this.forbidden);
        this.change((w) => {
          w.exportDirectory = selected;
        });
        await this.publish();
        break;
      }
      case 'openExport':
        if (this.store.state.exportDirectory)
          await this.services.openDirectory(this.store.state.exportDirectory);
        break;
      case 'openData':
        await this.services.openDirectory(this.store.directory);
        break;
      case 'autostart':
        this.services.autostart(bool(c.enabled));
        break;
      case 'add': {
        const text = str(c.text),
          title = str(c.title, 120),
          tags = parseTags(str(c.tags, 256)),
          participating = bool(c.participating);
        this.change((w) => {
          w.garden = addScrap(w.garden, text, Date.now());
          const id = w.garden.scraps.at(-1)!.id;
          w.sources[id] = {
            title: title || w.garden.scraps.at(-1)!.text.slice(0, 120),
            tags,
            participating,
            origin: 'Entered by you',
          };
        });
        await this.publish();
        break;
      }
      case 'editSource': {
        const id = str(c.id, 128),
          text = str(c.text),
          title = str(c.title, 120),
          tags = parseTags(str(c.tags, 256)),
          participating = bool(c.participating);
        if (this.store.state.garden.pending?.parents.some((p) => p.id === id))
          await this.pause('Paused because an active source changed.');
        this.change((w) => {
          w.garden = editScrap(w.garden, id, text);
          const previous = w.sources[id];
          if (!previous) throw new Error('Source not found.');
          w.sources[id] = { ...previous, title, tags, participating };
        });
        await this.publish();
        break;
      }
      case 'participate': {
        const id = str(c.id, 128),
          value = bool(c.value);
        if (!value && this.store.state.garden.pending?.parents.some((p) => p.id === id))
          await this.pause('Paused because an active source was excluded.');
        this.change((w) => {
          const info = w.sources[id];
          if (!info) throw new Error('Source not found.');
          info.participating = value;
        });
        await this.publish();
        break;
      }
      case 'pasteImport':
      case 'chooseImport': {
        this.assertIdle();
        let files: ImportedFile[] = [];
        if (c.op === 'pasteImport') {
          const utf8 = str(c.text, 1024 * 1024);
          files = [
            {
              id: crypto.randomUUID(),
              name: 'pasted-ideas.txt',
              utf8,
              bytesBase64: Buffer.from(utf8).toString('base64'),
            },
          ];
        } else
          for (const filename of await this.services.pick('import')) {
            const info = await lstat(filename);
            if (
              !info.isFile() ||
              info.isSymbolicLink() ||
              info.size > 1024 * 1024 ||
              !['.md', '.txt', '.json'].includes(path.extname(filename).toLowerCase())
            )
              throw new Error(
                'Choose regular UTF-8 .md, .txt or idea-list .json files under 1 MiB.',
              );
            const bytes = await readFile(filename);
            files.push({
              id: crypto.randomUUID(),
              name: path.basename(filename),
              utf8: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
              bytesBase64: bytes.toString('base64'),
            });
          }
        if (files.length) this.preview = prepareImport(this.store.state, files);
        break;
      }
      case 'cancelImport':
        this.preview = null;
        break;
      case 'acceptImport': {
        this.assertIdle();
        if (!this.preview || c.id !== this.preview.id) throw new Error('Import preview expired.');
        if (!Array.isArray(c.texts) || c.texts.some((s) => typeof s !== 'string'))
          throw new Error('Invalid import cards.');
        const preview = this.preview,
          tags = parseTags(str(c.tags, 256)),
          participate = bool(c.participating);
        this.change((w) => acceptImport(w, preview, c.texts, tags, participate, Date.now()));
        this.preview = null;
        await this.publish();
        break;
      }
      case 'settings': {
        this.assertIdle();
        await this.pause('Paused after settings changed.');
        this.change((w) => {
          w.settings = {
            ...w.settings,
            intervalMinutes: c.intervalMinutes,
            dailyCalls: c.dailyCalls,
            backlog: c.backlog,
            language: c.language,
            tag: str(c.tag, 30),
            exportScope: c.exportScope,
          };
          w.runtime.model = c.model;
        });
        await this.publish();
        break;
      }
      case 'review': {
        const id = str(c.id, 128),
          note = str(c.note, 4000);
        if (!['kept', 'rejected', 'later'].includes(c.state))
          throw new Error('Invalid review state.');
        this.change((w) => {
          const s = w.garden.sprouts.find((s) => s.id === id);
          if (!s) throw new Error('Idea not found.');
          s.kept = c.state === 'kept';
          w.reviews[id] = { state: c.state, note, changedAt: Date.now() };
        });
        await this.publish();
        break;
      }
      case 'editIdea': {
        const id = str(c.id, 128),
          title = str(c.title, 60).trim(),
          concept = str(c.concept, 420).trim();
        if (!title || !concept) throw new Error('Use a title and a short concept.');
        this.change((w) => {
          const s = w.garden.sprouts.find((s) => s.id === id);
          if (!s) throw new Error('Idea not found.');
          s.edited = { title, concept };
        });
        await this.publish();
        break;
      }
      case 'run': {
        this.assertIdle();
        let pair = eligiblePairs(this.store.state)[0];
        if (c.parents) {
          if (!Array.isArray(c.parents) || c.parents.length !== 2)
            throw new Error('Choose two sources.');
          pair = eligiblePairs(this.store.state).find(
            (p) =>
              p
                .map((s) => s.id)
                .sort()
                .join() === c.parents!.slice().sort().join(),
          );
        }
        if (c.retryId) {
          const run = this.store.state.garden.generations?.find((r) => r.id === c.retryId);
          pair = retryablePairs(this.store.state.garden).find(
            (p) =>
              pairKey(p) === run?.key &&
              p.every((s) => this.store.state.sources[s.id]?.participating),
          );
        }
        if (!pair)
          throw new Error(
            'No eligible unused pair. Add or enable sources; failed pairs require explicit Retry.',
          );
        this.startBlend(pair, false);
        break;
      }
      case 'recompost': {
        const id = str(c.id, 128);
        this.change((w) => {
          const s = w.garden.sprouts.find((s) => s.id === id);
          if (!s?.kept) throw new Error('Keep an idea before returning it to the pile.');
          w.garden = recompost(w.garden, id, Date.now());
          const source = w.garden.scraps.at(-1)!;
          w.sources[source.id] = {
            title: (s.edited ?? s.output).title,
            tags: [],
            participating: false,
            origin: 'Recomposted idea — enable explicitly',
          };
        });
        await this.publish();
        break;
      }
      case 'deleteSource': {
        await this.pause();
        const id = str(c.id, 128),
          affected = deletionSet(this.store.state.garden, id);
        if (
          !(await this.services.confirm(
            `Remove ${affected.scraps.size} sources (${affected.revisions} revisions), ${affected.sprouts.size} results and ${affected.growth.size} branches? Existing backups, original imported files and older Codex snapshots retain their copies until deliberately purged. Analysis notes are never removed.`,
          ))
        )
          break;
        this.change(
          (w) => {
            w.garden = removeScrap(w.garden, id);
            for (const id of affected.scraps) delete w.sources[id];
            for (const id of affected.sprouts) delete w.reviews[id];
          },
          true,
          [...affected.generations, ...affected.growth],
        );
        await this.publish();
        break;
      }
      case 'tend':
        this.assertIdle();
        if (!DIRECTIONS.includes(c.direction as Direction)) throw new Error('Choose a direction.');
        this.startTend(str(c.id, 128), c.kind, c.direction as Direction);
        break;
      case 'growthDecision': {
        const id = str(c.id, 128),
          accept = bool(c.accept),
          title = str(c.title, 60),
          concept = str(c.concept, 420),
          experiment = str(c.experiment, 300);
        this.change((w) => {
          w.garden = decideGrowth(
            w.garden,
            id,
            accept,
            accept ? { outcome: 'growth', title, concept, experiment } : undefined,
          );
        });
        await this.publish();
        break;
      }
      case 'backup':
        if (await this.services.saveBackup(JSON.stringify(this.store.envelope(), null, 2))) {
          this.store.emergency = [];
          this.attention = '';
        }
        break;
      case 'restore': {
        await this.pause();
        const [file] = await this.services.pick('restore');
        if (!file) break;
        const info = await lstat(file);
        if (!info.isFile() || info.isSymbolicLink() || info.size > 192 * 1024 * 1024)
          throw new Error('Choose a regular backup smaller than 192 MiB.');
        const raw = await readFile(file, 'utf8'),
          preview = DesktopStore.parseBackup(raw),
          garden = 'format' in preview ? preview.workspace.garden : preview;
        if (
          await this.services.confirm(
            `Replace the active garden with ${garden.scraps.length} sources, ${garden.sprouts.length} ideas and ${garden.growth?.length ?? 0} branches? A validated before-restore copy will be retained. Model paths and daily call usage remain local; all sources start excluded.`,
          )
        ) {
          this.store.restore(raw);
          this.preview = null;
          await this.publish();
        }
        break;
      }
      case 'purgeBackup': {
        this.assertIdle();
        if (!Number.isSafeInteger(c.id)) throw new Error('Invalid backup.');
        const backup = this.store.backups().find((b) => b.id === c.id && b.sha === c.sha);
        if (!backup) throw new Error('Backup changed.');
        if (
          await this.services.confirm(
            `Permanently remove the retained backup from ${new Date(backup.at).toLocaleString()} (${backup.bytes} bytes)? The active garden is unchanged.`,
          )
        )
          this.store.purgeBackup(c.id, c.sha);
        break;
      }
      case 'purgeOriginal': {
        this.assertIdle();
        const id = str(c.id, 128),
          file = this.store.state.files.find((f) => f.id === id);
        if (!file) throw new Error('Original not found.');
        if (
          await this.services.confirm(
            `Permanently remove retained original ${file.name}? Current cards/revisions remain. Backups may retain copies. This removes the original full-file bytes from the active workspace.`,
          )
        )
          this.change((w) => {
            w.files = w.files.filter((f) => f.id !== id);
          });
        break;
      }
      case 'cleanupExports':
        await this.cleanupExports();
        break;
      case 'export':
        await this.publish();
        break;
      default:
        throw new Error('Unknown desktop operation.');
    }
    this.emit();
    return this.view();
  }
  private canGenerate(): void {
    if (this.safetyStopped || this.attention)
      throw new Error('Resume explicitly after resolving the attention state.');
    this.store.requireReceiptHeadroom();
    if (!this.store.state.experiment.enabled || this.pausing)
      throw new Error('Resume the experiment before generating.');
    if (unreviewed(this.store.state) >= this.store.state.settings.backlog)
      throw new Error('Review new ideas first.');
    if (callsToday(this.store.state, Date.now()) >= this.store.state.settings.dailyCalls)
      throw new Error('Daily model-call budget reached.');
  }
  private launchJob(fn: (signal: AbortSignal) => Promise<void>): void {
    this.canGenerate();
    this.abort = new AbortController();
    const signal = this.abort.signal;
    this.active = Promise.resolve()
      .then(() => fn(signal))
      .catch((e: unknown) => {
        if (!signal.aborted) this.fail(e);
      })
      .finally(async () => {
        if (!this.store.state.experiment.enabled || signal.aborted || this.attention)
          try {
            await this.runtime.release();
          } catch (e) {
            this.fail(e);
          }
        this.active = undefined;
        this.abort = undefined;
        this.emit();
      });
    this.emit();
  }
  private startBlend(parents: Parameters<typeof beginRequest>[6], scheduled: boolean): void {
    this.launchJob(async (signal) => {
      let id = '';
      let committed = false;
      const started = Date.now();
      try {
        const model = await this.runtime.start(this.store.state.runtime);
        if (signal.aborted) throw new Error('Cancelled.');
        this.change((w) => {
          w.garden = beginRequest(
            w.garden,
            Date.now(),
            'ollama',
            model.model,
            model.digest,
            w.settings.language,
            parents,
            DESKTOP_LIMITS,
          );
          id = w.garden.pending!.id;
          w.experiment.nextAt = Date.now() + w.settings.intervalMinutes * 60000;
          noteEvent(w, scheduled ? 'scheduled' : 'manual', 'Pairing started.', Date.now(), id);
        });
        const request = this.store.state.garden.pending!;
        const raw = await generateWithEvidence(
          request,
          signal,
          async (repair) => {
            this.canGenerate();
            return this.runtime.generate(
              prompt(request.parents[0].text, request.parents[1].text, request.language, repair),
              schemaFor(request.parents[0].text, request.parents[1].text),
              hash(request.id),
              signal,
              (body) => this.store.receipt(id, 'transport', body),
              () => {
                this.canGenerate();
                this.change((w) =>
                  reserveCall(w, id, repair ? 'repair' : 'primary', 'blend', Date.now()),
                );
              },
            );
          },
          (raw) => {
            this.store.receipt(id, 'model', raw);
            this.change((w) => {
              w.garden = recordResponse(w.garden, id, raw);
            });
            return Promise.resolve();
          },
        );
        if (signal.aborted || !this.store.state.experiment.enabled) throw new Error('Cancelled.');
        this.change((w) => {
          if (request.parents.some((p) => !w.sources[p.id]?.participating))
            throw new Error('A parent was excluded.');
          w.garden = completeRequest(w.garden, id, raw, Date.now());
          w.reviews[id] = { state: 'new', note: '', changedAt: Date.now() };
          w.experiment.consecutiveFailures = 0;
          noteEvent(
            w,
            'success',
            'New candidate saved; usefulness awaits your review.',
            Date.now(),
            id,
            Date.now() - started,
          );
        });
        committed = true;
        await this.publish();
      } catch (e) {
        if (committed) throw e;
        if (id)
          this.change((w) => {
            w.garden = failRequest(w.garden, id, message(e), signal.aborted);
            const status = w.garden.generations?.find((r) => r.id === id)?.status;
            if (status === 'no_blend') w.experiment.consecutiveFailures = 0;
            else if (!signal.aborted) w.experiment.consecutiveFailures++;
            if (w.experiment.consecutiveFailures >= 3) {
              w.experiment.enabled = false;
              w.experiment.reason =
                'Three consecutive failed jobs. Review original responses before resuming.';
            }
            noteEvent(w, status ?? 'failed', message(e), Date.now(), id, Date.now() - started);
          }, false);
        if (!signal.aborted && this.store.state.experiment.consecutiveFailures < 3) {
          this.change((w) => {
            w.experiment.reason = message(e);
          }, false);
        }
        if (!id && !signal.aborted) throw e;
        await this.runtime.release();
      }
    });
  }
  private startTend(id: string, kind: Growth['parent']['kind'], direction: Direction): void {
    this.launchJob(async (signal) => {
      let jobId = '';
      const started = Date.now();
      try {
        const model = await this.runtime.start(this.store.state.runtime);
        if (signal.aborted) throw new Error('Cancelled.');
        const item =
          kind === 'sprout'
            ? this.store.state.garden.sprouts.find((s) => s.id === id)
            : this.store.state.garden.growth?.find((s) => s.id === id);
        const content = item?.edited ?? item?.output;
        if (!content) throw new Error('Parent idea not found.');
        this.change((w) => {
          w.garden = beginGrowth(
            reconcile(w.garden, Date.now()),
            { kind, id, title: content.title, concept: content.concept },
            direction,
            model.model,
            model.digest,
            Date.now(),
            DESKTOP_LIMITS.growth,
          );
          jobId = w.garden.growth!.at(-1)!.id;
        });
        let repair = '';
        for (let i = 0; i < 2; i++) {
          if (signal.aborted) throw new Error('Cancelled.');
          this.canGenerate();
          const raw = await this.runtime.generate(
            tendPrompt(content.title, content.concept, direction, repair),
            growthSchema,
            hash(jobId),
            signal,
            (body) => this.store.receipt(jobId, 'transport', body),
            () => {
              this.canGenerate();
              this.change((w) =>
                reserveCall(w, jobId, i ? 'repair' : 'primary', 'tend', Date.now()),
              );
            },
          );
          this.store.receipt(jobId, 'model', raw);
          this.change((w) => {
            w.garden = recordGrowth(w.garden, jobId, raw);
          });
          if (signal.aborted) throw new Error('Cancelled.');
          try {
            parseGrowth(raw);
          } catch (e) {
            repair = message(e);
            if (!i) continue;
            throw e;
          }
          this.change((w) => {
            w.garden = proposeGrowth(w.garden, jobId);
            noteEvent(
              w,
              'tend',
              'Proposal saved for your review; the experiment has not been performed.',
              Date.now(),
              jobId,
              Date.now() - started,
            );
          });
          await this.publish();
          return;
        }
      } catch (e) {
        if (jobId)
          this.change((w) => {
            w.garden = stopGrowth(w.garden, jobId, signal.aborted, message(e));
            noteEvent(w, 'tend-stopped', message(e), Date.now(), jobId);
          }, false);
        if (!signal.aborted) throw e;
      }
    });
  }
  tick(now = Date.now()): void {
    if (
      this.closed ||
      this.active ||
      this.pausing ||
      this.safetyStopped ||
      this.attention ||
      !this.store.state.experiment.enabled
    )
      return;
    if (now < this.store.state.experiment.lastObservedAt - 1000) {
      void this.pause('Clock moved backwards. Check the system clock.').catch((e: unknown) =>
        this.fail(e),
      );
      return;
    }
    if (waitReason(this.store.state, now)) return;
    const pair = eligiblePairs(this.store.state)[0];
    if (pair)
      try {
        this.startBlend(pair, true);
      } catch (e) {
        this.fail(e);
      }
  }
  private async cleanupExports(): Promise<void> {
    this.assertIdle();
    const root = this.store.state.exportDirectory;
    if (!root) throw new Error('Choose an export folder.');
    await initializeExport(root, this.forbidden);
    const dir = await safeDirectory(path.join(root, 'snapshots'));
    const pointer = JSON.parse(await readFile(path.join(root, 'CURRENT.json'), 'utf8')) as {
      generation: string;
      manifest: string;
      sha256: string;
    };
    if (
      !/^\d{13}-[0-9a-f-]{36}$/.test(pointer.generation) ||
      pointer.manifest !== `snapshots/${pointer.generation}/manifest.json` ||
      digest(await readFile(path.join(root, pointer.manifest))) !== pointer.sha256
    )
      throw new Error(
        'Current export pointer is invalid. Preserve the snapshots and refresh export before cleanup.',
      );
    const names = (await readdir(dir, { withFileTypes: true })).filter(
      (e) => e.name !== pointer.generation,
    );
    if (
      !(await this.services.confirm(
        `Permanently remove ${names.length} older/incomplete managed export snapshots? The current snapshot and analysis notes stay. Backups and original files are separate.`,
      ))
    )
      return;
    for (const e of names) {
      if (
        !e.isDirectory() ||
        e.isSymbolicLink() ||
        !/^(?:\.pending-)?\d{13}-[0-9a-f-]{36}$/.test(e.name)
      )
        throw new Error('Unexpected export directory; no recursive removal performed.');
      const target = await safeDirectory(path.join(dir, e.name));
      for (const f of await readdir(target, { withFileTypes: true })) {
        if (
          !f.isFile() ||
          f.isSymbolicLink() ||
          !/^(?:manifest\.json|INDEX\.md|(?:idea|branch)-[0-9a-f]{24}\.md)$/.test(f.name)
        )
          throw new Error('Unexpected export file; cleanup stopped.');
        await unlink(path.join(target, f.name));
      }
      await rmdir(target);
    }
  }
  async close(): Promise<void> {
    await this.pause('Application exited.');
    await this.publishing;
    if (this.store.emergency.length)
      throw new Error(
        'An original response is still retained only in memory. Save a full backup before exiting.',
      );
    this.closed = true;
    this.store.close();
  }
}
