import {
  normalize,
  parseOutput,
  validateOutput,
  validateScrap,
  type Language,
  type ModelOutput,
  PROMPT_VERSION,
} from '../inference/contract';
import {
  GENERATION_HEADROOM,
  MAX_GENERATIONS,
  inspectResponse,
  type Generation,
} from './generation';

export const INTERVAL = 900_000;
export const MAX_SCRAPS = 200;
export const MAX_SPROUTS = 1000;
export const MAX_ATTEMPTS = 19900;
export const MAX_SOURCE_REVISIONS = 100;
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
export type GardenKind = 'personal' | 'sample';
export type Backend = 'browser' | 'ollama' | 'replay';
export interface SourceRevision {
  raw: string;
  text: string;
  revision: number;
  origin: 'user' | 'fixture' | 'sprout';
}
export interface Scrap {
  id: string;
  raw: string;
  text: string;
  revision: number;
  createdAt: number;
  origin: 'user' | 'fixture' | 'sprout';
  parentSproutId?: string;
  history?: SourceRevision[];
}
export interface Snapshot {
  id: string;
  text: string;
  revision: number;
}
export interface Request {
  id: string;
  key: string;
  parents: [Snapshot, Snapshot];
  backend: Backend;
  model: string;
  modelRevision: string;
  language: Language;
  promptVersion: string;
}
export interface Sprout extends Request {
  output: ModelOutput;
  rawOutput: string;
  createdAt: number;
  kept: boolean;
  edited?: { title: string; concept: string };
  recomposted: boolean;
}
export interface Attempt {
  key: string;
  status: 'success' | 'failed';
  requestId: string;
}
export interface Garden {
  version: 1;
  id: string;
  kind: GardenKind;
  revision: number;
  seed: string;
  scraps: Scrap[];
  sprouts: Sprout[];
  attempts: Attempt[];
  generations?: Generation[];
  pending: Request | null;
  welcomeGranted: boolean;
  readySlots: number;
  lastAccrualAt: number;
  demoOffset: number;
}
export const uid = () => crypto.randomUUID();
export function createGarden(kind: GardenKind, now: number, id: string = uid()): Garden {
  return {
    version: 1,
    id,
    kind,
    revision: 0,
    seed: id,
    scraps: [],
    sprouts: [],
    attempts: [],
    pending: null,
    welcomeGranted: false,
    readySlots: 0,
    lastAccrualAt: now,
    demoOffset: 0,
  };
}
export function reconcile(garden: Garden, now: number): Garden {
  const g = structuredClone(garden);
  const clock = now + g.demoOffset;
  if (!g.welcomeGranted && new Set(g.scraps.map((s) => s.text)).size >= 2) {
    g.welcomeGranted = true;
    g.readySlots = 1;
    g.lastAccrualAt = clock;
  } else if (g.welcomeGranted) {
    const ticks = Math.floor(Math.max(0, clock - g.lastAccrualAt) / INTERVAL);
    g.readySlots = Math.min(3, g.readySlots + ticks);
    g.lastAccrualAt += ticks * INTERVAL;
  }
  return g;
}
export function addScrap(
  garden: Garden,
  raw: string,
  now: number,
  extra: Partial<Pick<Scrap, 'id' | 'origin' | 'parentSproutId'>> = {},
): Garden {
  if (garden.scraps.length >= MAX_SCRAPS)
    throw new Error('Your pile holds 200 scraps. Back up your garden before removing any.');
  const text = validateScrap(raw);
  if (garden.scraps.some((s) => s.text === text))
    throw new Error('That thought is already in your pile. Try a different scrap.');
  return reconcile(
    {
      ...garden,
      scraps: [
        ...garden.scraps,
        {
          id: uid(),
          raw,
          text,
          revision: 1,
          createdAt: now,
          origin: 'user',
          history: [],
          ...extra,
        },
      ],
    },
    now,
  );
}
export function editScrap(g: Garden, id: string, raw: string): Garden {
  if (g.pending?.parents.some((p) => p.id === id))
    throw new Error('Cancel the current blend before editing its sources.');
  const text = validateScrap(raw);
  if (g.scraps.some((s) => s.id !== id && s.text === text))
    throw new Error('That thought is already in your pile.');
  const scrap = g.scraps.find((s) => s.id === id);
  if (!scrap) throw new Error('This source no longer exists.');
  if (scrap.raw === raw) return g;
  if ((scrap.history?.length ?? 0) >= MAX_SOURCE_REVISIONS - 1)
    throw new Error(
      'This source holds 100 saved text revisions. Export its history before removing the source; nothing was trimmed or changed.',
    );
  return {
    ...g,
    scraps: g.scraps.map((s) =>
      s.id === id
        ? { ...s, raw, text, revision: s.revision + 1, origin: 'user', history: sourceRevisions(s) }
        : s,
    ),
  };
}
export function sourceRevisions(s: Scrap): SourceRevision[] {
  return [
    ...(s.history ?? []),
    { raw: s.raw, text: s.text, revision: s.revision, origin: s.origin },
  ];
}
export function pairKey(parents: [Snapshot, Snapshot]): string {
  return parents
    .map((p) => `${p.id}@${p.revision}`)
    .sort()
    .join('|');
}
export function hash(text: string): number {
  let h = 2166136261;
  for (const c of text) {
    h ^= c.codePointAt(0) ?? 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function availablePairs(g: Garden): [Snapshot, Snapshot][] {
  const attempted = new Set(g.attempts.map((attempt) => attempt.key));
  const pairs: { parents: [Snapshot, Snapshot]; key: string; rank: number }[] = [];
  for (let i = 0; i < g.scraps.length; i++)
    for (let j = i + 1; j < g.scraps.length; j++) {
      const a = g.scraps[i],
        b = g.scraps[j];
      if (!a || !b || a.text === b.text) continue;
      const pair: [Snapshot, Snapshot] = [
        { id: a.id, text: a.text, revision: a.revision },
        { id: b.id, text: b.text, revision: b.revision },
      ];
      const key = pairKey(pair);
      if (!attempted.has(key)) pairs.push({ parents: pair, key, rank: hash(g.seed + key) });
    }
  return pairs
    .sort((a, b) => a.rank - b.rank || a.key.localeCompare(b.key))
    .map((pair) => pair.parents);
}
export function retryablePairs(g: Garden): [Snapshot, Snapshot][] {
  const failed = new Map(g.attempts.filter((a) => a.status === 'failed').map((a) => [a.key, a]));
  if (!failed.size) return [];
  const successful = new Set(g.attempts.filter((a) => a.status === 'success').map((a) => a.key));
  const runs = new Map((g.generations ?? []).map((run) => [run.id, run]));
  const pairs: [Snapshot, Snapshot][] = [];
  for (let i = 0; i < g.scraps.length; i++)
    for (let j = i + 1; j < g.scraps.length; j++) {
      const a = g.scraps[i]!,
        b = g.scraps[j]!;
      if (a.text === b.text) continue;
      const pair: [Snapshot, Snapshot] = [
        { id: a.id, text: a.text, revision: a.revision },
        { id: b.id, text: b.text, revision: b.revision },
      ];
      const key = pairKey(pair),
        attempt = failed.get(key);
      if (!attempt || successful.has(key)) continue;
      const run = runs.get(attempt.requestId);
      if (run) {
        // Preserve A/B orientation, but never revive a request for edited sources.
        if (
          run.key !== key ||
          run.parents.some(
            (p) =>
              !pair.some(
                (current) =>
                  current.id === p.id && current.revision === p.revision && current.text === p.text,
              ),
          )
        )
          continue;
        pairs.push(run.parents);
      } else {
        // Legacy backups have pairing records but no inference journal. Offer the
        // unchanged pair without inventing a historical request or model response.
        pairs.push(pair);
      }
    }
  return pairs;
}
export function beginRequest(
  garden: Garden,
  now: number,
  backend: Backend,
  model: string,
  modelRevision: string,
  language: Language,
  preferred?: [Snapshot, Snapshot],
): Garden {
  const g = reconcile(garden, now);
  if (g.pending) throw new Error('An idea is already growing.');
  if (!g.readySlots)
    throw new Error('Let your pile rest. A new pairing is ready every 15 minutes.');
  const parents = preferred ?? availablePairs(g)[0];
  if (!parents)
    throw new Error('Every pairing has been explored. Add a new scrap or edit an existing one.');
  if (
    parents.some(
      (p) => !g.scraps.some((s) => s.id === p.id && s.revision === p.revision && s.text === p.text),
    ) ||
    parents[0].id === parents[1].id ||
    parents[0].text === parents[1].text
  )
    throw new Error('The selected sources have changed.');
  if (g.attempts.some((a) => a.key === pairKey(parents) && a.status === 'success'))
    throw new Error('That pairing has already grown.');
  if (g.attempts.length >= MAX_ATTEMPTS && !g.attempts.some((a) => a.key === pairKey(parents)))
    throw new Error(
      'Pairing history holds 19,900 records. Export your garden, then review a source and its dependent history for removal before starting a new pair. Existing failed pairs can still be retried.',
    );
  const request: Request = {
    id: uid(),
    key: pairKey(parents),
    parents,
    backend,
    model,
    modelRevision,
    language,
    promptVersion: PROMPT_VERSION,
  };
  if ((g.generations?.length ?? 0) >= MAX_GENERATIONS)
    throw new Error(
      'The inference history holds 100 runs. Export it, then remove a source with its history before growing again.',
    );
  const next: Garden = {
    ...g,
    pending: request,
    generations: [
      ...(g.generations ?? []),
      { ...request, createdAt: now, status: 'pending', responses: [], error: null },
    ],
  };
  if (
    new TextEncoder().encode(serializeGarden(next)).byteLength + GENERATION_HEADROOM >
    MAX_BACKUP_BYTES
  )
    throw new Error(
      'The garden needs 192 KiB of free backup space for inference evidence. Export it and remove a source with its history before growing again.',
    );
  return next;
}
export function recordResponse(g: Garden, id: string, raw: string): Garden {
  const run = g.generations?.find((r) => r.id === id);
  if (!g.pending || g.pending.id !== id || !run || run.status !== 'pending')
    throw new Error('This response belongs to an interrupted request.');
  if (run.responses.length >= 2)
    throw new Error('Only one primary response and one repair are allowed.');
  const response = inspectResponse(run, raw, run.responses.length ? 'repair' : 'primary');
  return {
    ...g,
    generations:
      g.generations?.map((r) =>
        r.id === id ? { ...r, responses: [...r.responses, response] } : r,
      ) ?? [],
  };
}
export function completeRequest(g: Garden, requestId: string, raw: string, now: number): Garden {
  if (g.sprouts.some((s) => s.id === requestId)) return g;
  const r = g.pending;
  if (!r || r.id !== requestId) throw new Error('This response belongs to an interrupted request.');
  if (
    r.parents.some(
      (p) => !g.scraps.some((s) => s.id === p.id && s.revision === p.revision && s.text === p.text),
    )
  )
    throw new Error('The sources changed before the model finished.');
  const output = parseOutput(raw, r.parents[0].text, r.parents[1].text);
  if (output.outcome === 'no_blend') throw new Error(`No blend this time: ${output.concept}`);
  if (g.readySlots < 1) throw new Error('No harvest slot available.');
  const run = g.generations?.find((r) => r.id === requestId);
  if (run && run.responses.at(-1)?.raw !== raw) g = recordResponse(g, requestId, raw);
  return {
    ...g,
    pending: null,
    readySlots: g.readySlots - 1,
    generations:
      g.generations?.map((run) => (run.id === requestId ? { ...run, status: 'success' } : run)) ??
      [],
    sprouts: [
      ...g.sprouts,
      { ...r, output, rawOutput: raw, createdAt: now, kept: false, recomposted: false },
    ],
    attempts: [
      ...g.attempts.filter((a) => a.key !== r.key),
      { key: r.key, status: 'success', requestId: r.id },
    ],
  };
}
export function failRequest(
  g: Garden,
  id: string,
  error = 'The request was interrupted.',
  cancelled = false,
): Garden {
  const r = g.pending;
  if (!r || r.id !== id) return g;
  return {
    ...g,
    pending: null,
    generations:
      g.generations?.map((run) => {
        if (run.id !== id) return run;
        const last = run.responses.at(-1);
        const noBlend =
          last?.validationError === null &&
          parseOutput(last.raw, run.parents[0].text, run.parents[1].text).outcome === 'no_blend';
        const status: Generation['status'] = cancelled
          ? 'cancelled'
          : noBlend
            ? 'no_blend'
            : last
              ? 'failed'
              : 'transport_error';
        return { ...run, status, error };
      }) ?? [],
    attempts: [
      ...g.attempts.filter((a) => a.key !== r.key),
      { key: r.key, status: 'failed', requestId: id },
    ],
  };
}
export function recompost(g: Garden, id: string, now: number): Garden {
  const sprout = g.sprouts.find((s) => s.id === id);
  if (!sprout || sprout.recomposted)
    throw new Error('This sprout has already returned to the pile.');
  const content = sprout.edited ?? sprout.output;
  const next = addScrap(g, `${content.title}. ${content.concept}`, now, {
    origin: 'sprout',
    parentSproutId: id,
  });
  return {
    ...next,
    sprouts: next.sprouts.map((s) => (s.id === id ? { ...s, recomposted: true } : s)),
  };
}
export function deletionSet(
  g: Garden,
  id: string,
): {
  scraps: Set<string>;
  sprouts: Set<string>;
  generations: Set<string>;
  revisions: number;
  pairings: number;
} {
  const scraps = new Set([id]),
    sprouts = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of g.sprouts)
      if (s.parents.some((p) => scraps.has(p.id)) && !sprouts.has(s.id)) {
        sprouts.add(s.id);
        changed = true;
      }
    for (const s of g.scraps)
      if (s.parentSproutId && sprouts.has(s.parentSproutId) && !scraps.has(s.id)) {
        scraps.add(s.id);
        changed = true;
      }
  }
  const generations = new Set(
    (g.generations ?? []).filter((r) => r.parents.some((p) => scraps.has(p.id))).map((r) => r.id),
  );
  const revisions = g.scraps
    .filter((s) => scraps.has(s.id))
    .reduce((count, s) => count + 1 + (s.history?.length ?? 0), 0);
  const pairings = g.attempts.filter((a) =>
    a.key.split('|').some((p) => scraps.has(p.split('@')[0] ?? '')),
  ).length;
  return { scraps, sprouts, generations, revisions, pairings };
}
export function removeScrap(g: Garden, id: string): Garden {
  if (g.pending) throw new Error('Cancel the current blend before removing a source.');
  const affected = deletionSet(g, id);
  return {
    ...g,
    scraps: g.scraps.filter((s) => !affected.scraps.has(s.id)),
    sprouts: g.sprouts.filter((s) => !affected.sprouts.has(s.id)),
    generations: g.generations?.filter((r) => !affected.generations.has(r.id)) ?? [],
    attempts: g.attempts.filter(
      (a) => !a.key.split('|').some((p) => affected.scraps.has(p.split('@')[0] ?? '')),
    ),
  };
}
export function exportMarkdown(g: Garden): string {
  return (
    `# Compost Club\n\nLet your wild ideas ferment.\n\n${g.kind === 'sample' ? 'Sample garden · recorded Gemma outputs · no live generation' : 'Personal garden · local processing'}\n\n` +
    g.sprouts
      .map((s) => {
        const content = s.edited ?? s.output;
        return `## ${content.title}\n\n${content.concept}\n\n${s.edited ? 'Edited by you. Original model result preserved in JSON backup.\n\n' : ''}Grew from:\n\n- A: ${s.parents[0].text}\n- B: ${s.parents[1].text}\n\nExact contributions: “${s.output.fromA}” + “${s.output.fromB}”\n\nMode: ${s.backend === 'replay' ? 'Recorded demo — no live AI' : s.backend}. Model: ${s.model}, revision: ${s.modelRevision}. Prompt: ${s.promptVersion}. Request: ${s.id}.\n`;
      })
      .join('\n') +
    `\n## Current scraps\n\n` +
    g.scraps.map((s) => `- ${s.raw}`).join('\n') +
    `\n\n## Source revisions\n\n` +
    g.scraps
      .map(
        (s) =>
          `### ${s.id}\n\n${(s.history?.[0]?.revision ?? s.revision) > 1 ? 'Earlier revisions were not present in the imported legacy record.\n\n' : ''}${sourceRevisions(
            s,
          )
            .map((r) => `Revision ${r.revision} · ${r.origin}\n${JSON.stringify(r.raw)}\n`)
            .join('\n')}`,
      )
      .join('\n') +
    `\n\n## Inference history\n\n${(g.generations ?? []).map((r) => `${r.id} · ${r.status} · ${r.backend === 'replay' ? 'Recorded demo — no live AI' : r.backend}\nModel: ${r.model} @ ${r.modelRevision}; prompt: ${r.promptVersion}; language: ${r.language}\nA (revision ${r.parents[0].revision}): ${r.parents[0].text}\nB (revision ${r.parents[1].revision}): ${r.parents[1].text}\n${r.error ?? ''}\n${r.responses.map((s) => `${s.phase}: ${s.validationError ?? 'Structure valid; usefulness not certified'}\n${JSON.stringify(s.raw)}\n`).join('\n')}`).join('\n')}`
  );
}

export function importGarden(raw: string): Garden {
  checkBackupSize(raw);
  const data: unknown = JSON.parse(raw);
  const g = validateGarden(data);
  // A backup never resumes an old inference operation.
  const restored = g.pending
    ? failRequest(g, g.pending.id, 'Interrupted before reload or restore.', true)
    : g;
  const resumed = { ...restored, pending: null };
  serializeGarden(resumed);
  return resumed;
}
function checkBackupSize(raw: string) {
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES)
    throw new Error('The garden exceeds the 2 MiB backup limit. Nothing was saved or replaced.');
}
export function serializeGarden(garden: Garden): string {
  validateGarden(garden);
  const raw = JSON.stringify(garden, null, 2);
  // Reserve the longest revision counter so a 9 → 10 save/restore cannot
  // make an otherwise unchanged boundary-sized backup exceed the budget.
  checkBackupSize(JSON.stringify({ ...garden, revision: Number.MAX_SAFE_INTEGER }, null, 2));
  return raw;
}
function validateGarden(data: unknown): Garden {
  if (!data || typeof data !== 'object') throw new Error('Invalid garden backup.');
  const g = data as Garden;
  if (g.version !== 1 || !['sample', 'personal'].includes(g.kind))
    throw new Error('Unsupported backup version or garden type.');
  if (Array.isArray(g.scraps) && g.scraps.length > MAX_SCRAPS)
    throw new Error('The garden exceeds 200 scraps. Nothing was saved or replaced.');
  if (Array.isArray(g.sprouts) && g.sprouts.length > MAX_SPROUTS)
    throw new Error('The garden exceeds 1,000 sprouts. Nothing was saved or replaced.');
  if (Array.isArray(g.attempts) && g.attempts.length > MAX_ATTEMPTS)
    throw new Error('The garden exceeds 19,900 pairing records. Nothing was saved or replaced.');
  if (
    typeof g.id !== 'string' ||
    typeof g.seed !== 'string' ||
    !Number.isSafeInteger(g.revision) ||
    g.revision < 0 ||
    !Array.isArray(g.scraps) ||
    g.scraps.length > MAX_SCRAPS ||
    !Array.isArray(g.sprouts) ||
    g.sprouts.length > MAX_SPROUTS ||
    !Array.isArray(g.attempts) ||
    g.attempts.length > MAX_ATTEMPTS
  )
    throw new Error('Malformed garden records.');
  if (
    typeof g.welcomeGranted !== 'boolean' ||
    !Number.isInteger(g.readySlots) ||
    g.readySlots < 0 ||
    g.readySlots > 3 ||
    !Number.isFinite(g.lastAccrualAt) ||
    !Number.isFinite(g.demoOffset) ||
    g.demoOffset < 0 ||
    (g.kind === 'personal' && g.demoOffset !== 0)
  )
    throw new Error('Malformed fermentation clock.');
  const ids = new Set<string>();
  for (const s of g.scraps) {
    if (
      !s ||
      typeof s.id !== 'string' ||
      ids.has(s.id) ||
      !Number.isSafeInteger(s.revision) ||
      s.revision < 1 ||
      typeof s.raw !== 'string' ||
      s.text !== validateScrap(s.raw) ||
      !Number.isFinite(s.createdAt) ||
      !['user', 'fixture', 'sprout'].includes(s.origin)
    )
      throw new Error('Malformed or duplicate scrap.');
    ids.add(s.id);
    if (s.history !== undefined) {
      if (!Array.isArray(s.history) || s.history.length >= MAX_SOURCE_REVISIONS)
        throw new Error(
          'A source may contain at most 100 saved text revisions, including the current text.',
        );
      for (const [i, r] of s.history.entries()) {
        if (
          !r ||
          typeof r.raw !== 'string' ||
          r.text !== validateScrap(r.raw) ||
          !Number.isSafeInteger(r.revision) ||
          r.revision < 1 ||
          !['user', 'fixture', 'sprout'].includes(r.origin) ||
          r.revision + 1 !== (s.history[i + 1]?.revision ?? s.revision)
        )
          throw new Error('Malformed or out-of-order source revision history.');
      }
    }
  }
  const resultIds = new Set<string>();
  for (const s of g.sprouts) {
    if (
      !s ||
      typeof s.id !== 'string' ||
      resultIds.has(s.id) ||
      !Array.isArray(s.parents) ||
      s.parents.length !== 2 ||
      s.parents[0].id === s.parents[1].id ||
      typeof s.rawOutput !== 'string' ||
      typeof s.model !== 'string' ||
      typeof s.modelRevision !== 'string' ||
      typeof s.promptVersion !== 'string' ||
      !['browser', 'ollama', 'replay'].includes(s.backend) ||
      !['en', 'ru'].includes(s.language) ||
      typeof s.kept !== 'boolean' ||
      typeof s.recomposted !== 'boolean' ||
      !Number.isFinite(s.createdAt)
    )
      throw new Error('Malformed sprout provenance.');
    for (const p of s.parents)
      if (
        !ids.has(p.id) ||
        !Number.isSafeInteger(p.revision) ||
        p.revision < 1 ||
        typeof p.text !== 'string' ||
        normalize(p.text) !== validateScrap(p.text)
      )
        throw new Error('A source snapshot is missing or invalid.');
    if (s.key !== pairKey(s.parents)) throw new Error('A source pair does not match its record.');
    const parsed = parseOutput(s.rawOutput, s.parents[0].text, s.parents[1].text);
    const stored = validateOutput(s.output, s.parents[0].text, s.parents[1].text);
    if (
      (Object.keys(parsed) as (keyof ModelOutput)[]).some((key) => parsed[key] !== stored[key]) ||
      parsed.outcome !== 'sprout'
    )
      throw new Error('The original model result was changed.');
    if (
      s.edited &&
      (typeof s.edited.title !== 'string' ||
        !s.edited.title.trim() ||
        lengthLimit(s.edited.title, 60) ||
        typeof s.edited.concept !== 'string' ||
        !s.edited.concept.trim() ||
        lengthLimit(s.edited.concept, 420))
    )
      throw new Error('Malformed edited sprout.');
    resultIds.add(s.id);
  }
  for (const s of g.scraps)
    if (s.parentSproutId && !resultIds.has(s.parentSproutId))
      throw new Error('A recomposted scrap has no parent sprout.');
  for (const a of g.attempts)
    if (
      !a ||
      typeof a.key !== 'string' ||
      typeof a.requestId !== 'string' ||
      !['success', 'failed'].includes(a.status)
    )
      throw new Error('Malformed pairing history.');
  if (g.generations !== undefined) {
    if (!Array.isArray(g.generations) || g.generations.length > MAX_GENERATIONS)
      throw new Error('Inference history must contain at most 100 runs.');
    const runIds = new Set<string>();
    for (const run of g.generations) {
      if (
        !run ||
        typeof run.id !== 'string' ||
        runIds.has(run.id) ||
        !Number.isFinite(run.createdAt) ||
        !['pending', 'success', 'failed', 'no_blend', 'cancelled', 'transport_error'].includes(
          run.status,
        ) ||
        !['browser', 'ollama', 'replay'].includes(run.backend) ||
        !['en', 'ru'].includes(run.language) ||
        typeof run.model !== 'string' ||
        typeof run.modelRevision !== 'string' ||
        typeof run.promptVersion !== 'string' ||
        (run.error !== null && typeof run.error !== 'string') ||
        !Array.isArray(run.parents) ||
        run.parents.length !== 2 ||
        !Array.isArray(run.responses) ||
        run.responses.length > 2
      )
        throw new Error('Malformed inference history.');
      for (const p of run.parents)
        if (
          !p ||
          !ids.has(p.id) ||
          !Number.isSafeInteger(p.revision) ||
          p.revision < 1 ||
          typeof p.text !== 'string' ||
          validateScrap(p.text) !== p.text
        )
          throw new Error('Invalid inference source snapshot.');
      if (run.parents[0].id === run.parents[1].id || run.key !== pairKey(run.parents))
        throw new Error('Invalid inference pair.');
      for (const [i, response] of run.responses.entries()) {
        if (
          !response ||
          typeof response.raw !== 'string' ||
          response.phase !== (i ? 'repair' : 'primary') ||
          (response.validationError !== null && typeof response.validationError !== 'string')
        )
          throw new Error('Malformed original inference response.');
        // Validation messages can differ between JS engines; preserve the recorded message.
        if (
          (inspectResponse(run, response.raw, response.phase).validationError === null) !==
          (response.validationError === null)
        )
          throw new Error('The inference validation status does not match its original response.');
      }
      runIds.add(run.id);
    }
  }
  return g;
}
function lengthLimit(s: string, max: number) {
  return [...s].length > max;
}
