import {
  normalize,
  parseOutput,
  validateOutput,
  validateScrap,
  type Language,
  type ModelOutput,
  PROMPT_VERSION,
} from '../inference/contract';

export const INTERVAL = 900_000;
export const MAX_SCRAPS = 200;
export type GardenKind = 'personal' | 'sample';
export type Backend = 'browser' | 'ollama' | 'replay';
export interface Scrap {
  id: string;
  raw: string;
  text: string;
  revision: number;
  createdAt: number;
  origin: 'user' | 'fixture' | 'sprout';
  parentSproutId?: string;
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
        { id: uid(), raw, text, revision: 1, createdAt: now, origin: 'user', ...extra },
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
  return {
    ...g,
    scraps: g.scraps.map((s) =>
      s.id === id ? { ...s, raw, text, revision: s.revision + 1, origin: 'user' } : s,
    ),
  };
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
  const pairs: [Snapshot, Snapshot][] = [];
  for (let i = 0; i < g.scraps.length; i++)
    for (let j = i + 1; j < g.scraps.length; j++) {
      const a = g.scraps[i],
        b = g.scraps[j];
      if (!a || !b || a.text === b.text) continue;
      const pair: [Snapshot, Snapshot] = [
        { id: a.id, text: a.text, revision: a.revision },
        { id: b.id, text: b.text, revision: b.revision },
      ];
      if (!g.attempts.some((p) => p.key === pairKey(pair))) pairs.push(pair);
    }
  return pairs.sort(
    (a, b) =>
      hash(g.seed + pairKey(a)) - hash(g.seed + pairKey(b)) || pairKey(a).localeCompare(pairKey(b)),
  );
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
  return {
    ...g,
    pending: {
      id: uid(),
      key: pairKey(parents),
      parents,
      backend,
      model,
      modelRevision,
      language,
      promptVersion: PROMPT_VERSION,
    },
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
  return {
    ...g,
    pending: null,
    readySlots: g.readySlots - 1,
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
export function failRequest(g: Garden, id: string): Garden {
  const r = g.pending;
  if (!r || r.id !== id) return g;
  return {
    ...g,
    pending: null,
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
export function deletionSet(g: Garden, id: string): { scraps: Set<string>; sprouts: Set<string> } {
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
  return { scraps, sprouts };
}
export function removeScrap(g: Garden, id: string): Garden {
  if (g.pending) throw new Error('Cancel the current blend before removing a source.');
  const affected = deletionSet(g, id);
  return {
    ...g,
    scraps: g.scraps.filter((s) => !affected.scraps.has(s.id)),
    sprouts: g.sprouts.filter((s) => !affected.sprouts.has(s.id)),
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
    `\n## Original scraps\n\n` +
    g.scraps.map((s) => `- ${s.raw}`).join('\n')
  );
}

export function importGarden(raw: string): Garden {
  if (new TextEncoder().encode(raw).byteLength > 2 * 1024 * 1024)
    throw new Error('Backups must be smaller than 2 MiB.');
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object') throw new Error('Invalid garden backup.');
  const g = data as Garden;
  if (g.version !== 1 || !['sample', 'personal'].includes(g.kind))
    throw new Error('Unsupported backup version or garden type.');
  if (
    typeof g.id !== 'string' ||
    typeof g.seed !== 'string' ||
    !Number.isSafeInteger(g.revision) ||
    g.revision < 0 ||
    !Array.isArray(g.scraps) ||
    g.scraps.length > 200 ||
    !Array.isArray(g.sprouts) ||
    g.sprouts.length > 1000 ||
    !Array.isArray(g.attempts) ||
    g.attempts.length > 19900
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
    if (
      JSON.stringify(parsed) !==
        JSON.stringify(validateOutput(s.output, s.parents[0].text, s.parents[1].text)) ||
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
  // A backup never resumes an old inference operation.
  return { ...g, pending: null };
}
function lengthLimit(s: string, max: number) {
  return [...s].length > max;
}
