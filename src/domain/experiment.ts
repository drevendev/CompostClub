import {
  addScrap,
  availablePairs,
  createGarden,
  DESKTOP_LIMITS,
  reconcile,
  serializeGarden,
  type Garden,
  type Snapshot,
} from './garden';
import { normalize, validateScrap, type Language } from '../inference/contract';

export const EXPERIMENT_VERSION = 2;
export const HOUR = 3_600_000;
export interface SourceInfo {
  title: string;
  tags: string[];
  participating: boolean;
  origin: string;
  importedFile?: string;
}
export interface Review {
  state: 'new' | 'kept' | 'rejected' | 'later';
  note: string;
  changedAt: number;
}
export interface ExperimentSettings {
  intervalMinutes: number;
  dailyCalls: number;
  backlog: number;
  language: Language;
  tag: string;
  timezone: string;
  exportScope: 'kept' | 'all';
}
export interface RuntimeSettings {
  executable: string;
  models: string;
  model: 'gemma3:1b' | 'gemma3:4b';
}
export interface CallReservation {
  id: string;
  jobId: string;
  date: string;
  at: number;
  phase: 'primary' | 'repair';
  kind: 'blend' | 'tend';
}
export interface ExperimentEvent {
  at: number;
  kind: string;
  message: string;
  jobId?: string;
  durationMs?: number;
}
export interface ImportedFile {
  id: string;
  name: string;
  utf8: string;
  bytesBase64: string;
}
export interface Workspace {
  schemaVersion: 2;
  revision: number;
  garden: Garden;
  sources: Record<string, SourceInfo>;
  reviews: Record<string, Review>;
  files: ImportedFile[];
  settings: ExperimentSettings;
  runtime: RuntimeSettings;
  exportDirectory: string;
  experiment: {
    enabled: boolean;
    reason: string;
    nextAt: number;
    lastObservedAt: number;
    consecutiveFailures: number;
    latestDate: string;
    calls: CallReservation[];
  };
  events: ExperimentEvent[];
}
export interface ImportPart {
  fileId: string;
  text: string;
  title: string;
  duplicate: boolean;
}
export interface ImportPreview {
  id: string;
  revision: number;
  files: ImportedFile[];
  parts: ImportPart[];
}

export function createWorkspace(now: number): Workspace {
  return {
    schemaVersion: 2,
    revision: 0,
    garden: createGarden('personal', now),
    sources: {},
    reviews: {},
    files: [],
    settings: {
      intervalMinutes: 60,
      dailyCalls: 6,
      backlog: 5,
      language: 'en',
      tag: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      exportScope: 'kept',
    },
    runtime: { executable: '', models: '', model: 'gemma3:4b' },
    exportDirectory: '',
    experiment: {
      enabled: false,
      reason: 'Paused. Set up your local model and add participating ideas.',
      nextAt: now,
      lastObservedAt: now,
      consecutiveFailures: 0,
      latestDate: '',
      calls: [],
    },
    events: [],
  };
}

export function assertWorkspace(w: Workspace): void {
  if (
    !w ||
    w.schemaVersion !== 2 ||
    !Number.isSafeInteger(w.revision) ||
    w.revision < 0 ||
    w.garden?.kind !== 'personal'
  )
    throw new Error('Unsupported desktop workspace.');
  serializeGarden(w.garden, DESKTOP_LIMITS);
  if (new TextEncoder().encode(JSON.stringify(w)).byteLength > 32 * 1024 * 1024)
    throw new Error(
      'Desktop workspace reached its 32 MiB limit. Back up and review retained data.',
    );
  if (
    !w.sources ||
    !w.reviews ||
    !Array.isArray(w.events) ||
    w.events.length > 12000 ||
    !Array.isArray(w.files) ||
    w.files.length > 200
  )
    throw new Error('Invalid desktop records.');
  for (const [id, s] of Object.entries(w.sources)) {
    if (
      !w.garden.scraps.some((p) => p.id === id) ||
      !s ||
      typeof s.title !== 'string' ||
      s.title.length > 120 ||
      typeof s.participating !== 'boolean' ||
      typeof s.origin !== 'string' ||
      s.origin.length > 512 ||
      !Array.isArray(s.tags) ||
      s.tags.length > 8 ||
      s.tags.some((t) => typeof t !== 'string' || !t.trim() || t.length > 30)
    )
      throw new Error('Invalid source metadata.');
  }
  for (const [id, r] of Object.entries(w.reviews)) {
    if (
      !w.garden.sprouts.some((s) => s.id === id) ||
      !r ||
      !['new', 'kept', 'rejected', 'later'].includes(r.state) ||
      typeof r.note !== 'string' ||
      r.note.length > 4000 ||
      !Number.isFinite(r.changedAt)
    )
      throw new Error('Invalid review record.');
  }
  if (
    w.files.some(
      (f) =>
        !f ||
        typeof f.id !== 'string' ||
        typeof f.name !== 'string' ||
        typeof f.utf8 !== 'string' ||
        typeof f.bytesBase64 !== 'string',
    )
  )
    throw new Error('Invalid imported originals.');
  const s = w.settings,
    e = w.experiment,
    rt = w.runtime;
  if (
    !s ||
    !e ||
    !rt ||
    ![15, 30, 60, 120, 240].includes(s.intervalMinutes) ||
    !Number.isInteger(s.dailyCalls) ||
    s.dailyCalls < 1 ||
    s.dailyCalls > 24 ||
    !Number.isInteger(s.backlog) ||
    s.backlog < 1 ||
    s.backlog > 20 ||
    !['en', 'ru'].includes(s.language) ||
    typeof s.tag !== 'string' ||
    s.tag.length > 30 ||
    !['kept', 'all'].includes(s.exportScope)
  )
    throw new Error('Invalid experiment settings.');
  new Intl.DateTimeFormat('en', { timeZone: s.timezone });
  if (
    typeof rt.executable !== 'string' ||
    typeof rt.models !== 'string' ||
    !['gemma3:1b', 'gemma3:4b'].includes(rt.model) ||
    typeof w.exportDirectory !== 'string' ||
    typeof e.enabled !== 'boolean' ||
    typeof e.reason !== 'string' ||
    !Number.isFinite(e.nextAt) ||
    !Number.isFinite(e.lastObservedAt) ||
    !Number.isInteger(e.consecutiveFailures) ||
    e.consecutiveFailures < 0 ||
    typeof e.latestDate !== 'string' ||
    !Array.isArray(e.calls) ||
    e.calls.length > 3000
  )
    throw new Error('Invalid experiment runtime.');
  const ids = new Set<string>();
  for (const c of e.calls) {
    if (
      !c ||
      typeof c.id !== 'string' ||
      ids.has(c.id) ||
      typeof c.jobId !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(c.date) ||
      !Number.isFinite(c.at) ||
      !['primary', 'repair'].includes(c.phase) ||
      !['blend', 'tend'].includes(c.kind)
    )
      throw new Error('Invalid persisted call budget.');
    ids.add(c.id);
  }
}

export function dateKey(now: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function callsToday(w: Workspace, now: number): number {
  const day = dateKey(now, w.settings.timezone);
  return w.experiment.calls.filter((c) => c.date === day).length;
}
export function reserveCall(
  w: Workspace,
  jobId: string,
  phase: CallReservation['phase'],
  kind: CallReservation['kind'],
  now: number,
): void {
  const date = dateKey(now, w.settings.timezone);
  if (
    (w.experiment.latestDate && date < w.experiment.latestDate) ||
    now < w.experiment.lastObservedAt - 1000
  )
    throw new Error('Clock moved backwards. Pause until the clock catches up.');
  if (callsToday(w, now) >= w.settings.dailyCalls)
    throw new Error('Daily model-call budget reached; no repair or new call was sent.');
  w.experiment.latestDate = date;
  w.experiment.lastObservedAt = now;
  w.experiment.calls.push({ id: crypto.randomUUID(), jobId, date, at: now, phase, kind });
}
export function eligiblePairs(w: Workspace): [Snapshot, Snapshot][] {
  return availablePairs(w.garden).filter((parents) =>
    parents.every(
      (p) =>
        w.sources[p.id]?.participating &&
        (!w.settings.tag || w.sources[p.id]!.tags.includes(w.settings.tag)),
    ),
  );
}
export function unreviewed(w: Workspace): number {
  return w.garden.sprouts.filter(
    (s) => !w.reviews[s.id] || ['new', 'later'].includes(w.reviews[s.id]!.state),
  ).length;
}
export function waitReason(w: Workspace, now: number): string {
  if (!w.experiment.enabled) return w.experiment.reason;
  if (now < w.experiment.lastObservedAt - 1000)
    return 'Clock moved backwards; pause and check system time.';
  if (w.garden.pending || w.garden.growth?.some((n) => ['pending', 'proposed'].includes(n.status)))
    return 'Finish or review the current proposal.';
  if (unreviewed(w) >= w.settings.backlog)
    return 'Review your new ideas before more are generated.';
  if (callsToday(w, now) >= w.settings.dailyCalls) return 'Daily model-call budget reached.';
  if (now < w.experiment.nextAt) return 'Resting until the next scheduled pairing.';
  if (!reconcile(w.garden, now).readySlots) return 'Waiting for a pairing credit.';
  if (!eligiblePairs(w).length) return 'No unused participating pair matches your filter.';
  return '';
}
export function noteEvent(
  w: Workspace,
  kind: string,
  message: string,
  now: number,
  jobId?: string,
  durationMs?: number,
): void {
  if (w.events.length >= 12000)
    throw new Error('Journal is full. Back up and review retained records.');
  w.events.push({
    at: now,
    kind,
    message,
    ...(jobId ? { jobId } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
  });
}
export function parseTags(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}
export function splitIdeas(raw: string): string[] {
  const blocks = raw.split(/\n\s*---\s*\n|\n\s*\n/).filter((s) => s.trim());
  const result: string[] = [];
  for (const block of blocks) {
    const chars = [...block];
    while (chars.length > 600) {
      let cut = chars.slice(0, 600).lastIndexOf(' ');
      if (cut < 200) cut = 600;
      if (chars.length - cut < 8) cut = chars.length - 8;
      result.push(chars.splice(0, cut).join(''));
    }
    if (chars.join('').trim()) result.push(chars.join(''));
  }
  return result;
}
export function prepareImport(w: Workspace, files: ImportedFile[]): ImportPreview {
  if (!files.length || files.length > 20) throw new Error('Choose 1–20 small UTF-8 files.');
  const seen = new Set(w.garden.scraps.map((s) => s.text));
  const parts: ImportPart[] = [];
  for (const file of files) {
    let texts: string[];
    if (file.name.toLowerCase().endsWith('.json')) {
      const value: unknown = JSON.parse(file.utf8);
      if (
        !Array.isArray(value) ||
        !(value as unknown[]).every(
          (v) =>
            typeof v === 'string' ||
            (v && typeof v === 'object' && 'text' in v && typeof v.text === 'string'),
        )
      )
        throw new Error(
          'Idea JSON must be an array of strings or objects with a text field. Use Restore for garden backups.',
        );
      texts = (value as (string | { text: string })[]).flatMap((v) =>
        splitIdeas(typeof v === 'string' ? v : v.text),
      );
    } else texts = splitIdeas(file.utf8);
    for (const raw of texts) {
      const text = normalize(raw),
        duplicate = seen.has(text);
      parts.push({
        fileId: file.id,
        text: raw,
        title: [...normalize(raw).split('\n')[0]!].slice(0, 120).join(''),
        duplicate,
      });
      seen.add(text);
    }
  }
  if (!parts.length || parts.length > 200)
    throw new Error('Import must contain 1–200 cards; adjust the selected files.');
  return { id: crypto.randomUUID(), revision: w.revision, files, parts };
}
export function acceptImport(
  w: Workspace,
  preview: ImportPreview,
  texts: string[],
  tags: string[],
  participate: boolean,
  now: number,
): void {
  if (w.revision !== preview.revision)
    throw new Error('The garden changed. Preview the import again.');
  if (!texts.length || texts.length !== preview.parts.length)
    throw new Error('Invalid import selection.');
  const seen = new Set(w.garden.scraps.map((s) => s.text));
  let added = 0;
  for (const [index, raw] of texts.entries()) {
    if (!raw.trim()) continue;
    const text = validateScrap(raw);
    if (seen.has(text)) continue;
    w.garden = addScrap(w.garden, raw, now);
    const source = w.garden.scraps.at(-1)!;
    w.sources[source.id] = {
      title: [...text.split('\n')[0]!].slice(0, 120).join(''),
      tags,
      participating: participate,
      origin:
        'Imported: ' +
        (preview.files.find((f) => f.id === preview.parts[index]!.fileId)?.name ?? 'selected text'),
      importedFile: preview.parts[index]!.fileId,
    };
    seen.add(text);
    added++;
  }
  if (!added) throw new Error('No new cards selected. Exact duplicates are skipped.');
  w.files.push(...preview.files);
  noteEvent(w, 'import', `Imported ${added} ideas; original selected files retained.`, now);
}
