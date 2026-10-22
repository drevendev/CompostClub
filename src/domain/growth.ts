import type { Garden } from './garden';

export const GROWTH_VERSION = 'tend-1';
export const DIRECTIONS = [
  'Clarify the mechanism',
  'Add a useful constraint',
  'Explore an alternative',
  'Propose a one-day experiment',
] as const;
export type Direction = (typeof DIRECTIONS)[number];
export interface GrowthOutput {
  outcome: 'growth' | 'no_growth';
  title: string;
  concept: string;
  experiment: string;
}
export interface Growth {
  id: string;
  parent: { kind: 'sprout' | 'growth'; id: string; title: string; concept: string };
  direction: Direction;
  createdAt: number;
  model: string;
  modelRevision: string;
  promptVersion: typeof GROWTH_VERSION;
  status: 'pending' | 'proposed' | 'accepted' | 'rejected' | 'failed' | 'cancelled' | 'no_growth';
  responses: string[];
  output?: GrowthOutput;
  edited?: GrowthOutput;
  error: string | null;
}
export function parseGrowth(raw: string): GrowthOutput {
  if (typeof raw !== 'string') throw new Error('No growth response.');
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Growth must be a JSON object.');
  const o = value as GrowthOutput;
  if (
    Object.keys(o).sort().join() !== 'concept,experiment,outcome,title' ||
    !['growth', 'no_growth'].includes(o.outcome)
  )
    throw new Error('Invalid growth contract.');
  for (const [key, max] of [
    ['title', 60],
    ['concept', 420],
    ['experiment', 300],
  ] as const)
    if (typeof o[key] !== 'string' || !o[key].trim() || [...o[key]].length > max)
      throw new Error(`Invalid growth ${key}.`);
  return { outcome: o.outcome, title: o.title, concept: o.concept, experiment: o.experiment };
}
export function beginGrowth(
  g: Garden,
  parent: Growth['parent'],
  direction: Direction,
  model: string,
  digest: string,
  now: number,
): Garden {
  if (g.kind !== 'personal') throw new Error('Tending uses live local AI in your personal garden.');
  if (g.pending || g.growth?.some((n) => ['pending', 'proposed'].includes(n.status)))
    throw new Error('Finish or reject the current proposal first.');
  if (g.readySlots < 1) throw new Error('Wait for a ready slot before tending.');
  if ((g.growth?.length ?? 0) >= 100)
    throw new Error('Growth history holds 100 records. Back up and review a source for removal.');
  if (!DIRECTIONS.includes(direction)) throw new Error('Choose a growth direction.');
  const source =
    parent.kind === 'sprout'
      ? g.sprouts.find((s) => s.id === parent.id && s.kept)
      : g.growth?.find((n) => n.id === parent.id && n.status === 'accepted');
  if (!source) throw new Error('Choose a kept idea or an accepted branch.');
  const content = source.edited ?? source.output;
  if (!content || content.title !== parent.title || content.concept !== parent.concept)
    throw new Error('The parent idea changed.');
  return {
    ...g,
    growth: [
      ...(g.growth ?? []),
      {
        id: crypto.randomUUID(),
        parent: { ...parent },
        direction,
        createdAt: now,
        model,
        modelRevision: digest,
        promptVersion: GROWTH_VERSION,
        status: 'pending',
        responses: [],
        error: null,
      },
    ],
  };
}
export function recordGrowth(g: Garden, id: string, raw: string): Garden {
  return update(g, id, (n) => {
    if (
      n.status !== 'pending' ||
      n.responses.length >= 2 ||
      new TextEncoder().encode(raw).byteLength > 65536
    )
      throw new Error('Growth evidence exceeds its bound or request is closed.');
    return { ...n, responses: [...n.responses, raw] };
  });
}
export function proposeGrowth(g: Garden, id: string): Garden {
  return update(g, id, (n) => {
    if (n.status !== 'pending') throw new Error('This growth request is closed.');
    const output = parseGrowth(n.responses.at(-1) ?? '');
    return { ...n, output, status: output.outcome === 'growth' ? 'proposed' : 'no_growth' };
  });
}
export function decideGrowth(
  g: Garden,
  id: string,
  accept: boolean,
  edited?: GrowthOutput,
): Garden {
  const next = update(g, id, (n) => {
    if (n.status !== 'proposed') throw new Error('This proposal has already been reviewed.');
    if (accept && g.readySlots < 1) throw new Error('No ready slot available.');
    if (accept && !/[.!?]$/.test((edited ?? n.output)!.experiment.trim()))
      throw new Error(
        'The experiment seems unfinished. Edit or reject the proposal before accepting.',
      );
    if (accept && !/[.!?]$/.test((edited ?? n.output)!.experiment.trim()))
      throw new Error(
        'The experiment seems unfinished. Edit or reject the proposal before accepting.',
      );
    if (edited) {
      parseGrowth(JSON.stringify(edited));
      if (edited.outcome !== 'growth') throw new Error('An accepted branch must be growth.');
    }
    return {
      ...n,
      status: accept ? 'accepted' : 'rejected',
      ...(accept && edited ? { edited } : {}),
    };
  });
  return { ...next, readySlots: next.readySlots - (accept ? 1 : 0) };
}
export function stopGrowth(g: Garden, id: string, cancelled: boolean, error: string): Garden {
  return update(g, id, (n) =>
    n.status === 'pending' ? { ...n, status: cancelled ? 'cancelled' : 'failed', error } : n,
  );
}
function update(g: Garden, id: string, fn: (n: Growth) => Growth): Garden {
  if (!g.growth?.some((n) => n.id === id)) throw new Error('Growth request not found.');
  return { ...g, growth: g.growth.map((n) => (n.id === id ? fn(n) : n)) };
}
export function validateGrowth(g: Garden): void {
  if (g.growth === undefined) return;
  if (!Array.isArray(g.growth) || g.growth.length > 100) throw new Error('Invalid growth history.');
  const seen = new Set<string>();
  let active = 0;
  for (const n of g.growth) {
    if (
      !n ||
      typeof n.id !== 'string' ||
      !n.id ||
      seen.has(n.id) ||
      g.sprouts.some((s) => s.id === n.id) ||
      !n.parent ||
      !['sprout', 'growth'].includes(n.parent.kind) ||
      !DIRECTIONS.includes(n.direction) ||
      !Number.isFinite(n.createdAt) ||
      typeof n.model !== 'string' ||
      !['gemma3:1b', 'gemma3:4b'].includes(n.model) ||
      typeof n.modelRevision !== 'string' ||
      !n.modelRevision ||
      n.promptVersion !== GROWTH_VERSION ||
      !['pending', 'proposed', 'accepted', 'rejected', 'failed', 'cancelled', 'no_growth'].includes(
        n.status,
      ) ||
      !Array.isArray(n.responses) ||
      n.responses.length > 2 ||
      n.responses.some(
        (r) => typeof r !== 'string' || new TextEncoder().encode(r).byteLength > 65536,
      ) ||
      (n.error !== null && typeof n.error !== 'string')
    )
      throw new Error('Malformed growth provenance.');
    if (
      typeof n.parent.title !== 'string' ||
      !n.parent.title.trim() ||
      [...n.parent.title].length > 60 ||
      typeof n.parent.concept !== 'string' ||
      !n.parent.concept.trim() ||
      [...n.parent.concept].length > 420
    )
      throw new Error('Invalid growth parent snapshot.');
    if (
      n.parent.kind === 'sprout'
        ? !g.sprouts.some((s) => s.id === n.parent.id)
        : !seen.has(n.parent.id) ||
          !g.growth.some((p) => p.id === n.parent.id && p.status === 'accepted')
    )
      throw new Error('Growth parent is missing, cyclic or not accepted.');
    if (['proposed', 'accepted', 'rejected', 'no_growth'].includes(n.status)) {
      const parsed = parseGrowth(n.responses.at(-1) ?? '');
      if (
        !n.output ||
        Object.keys(parsed).some(
          (k) => parsed[k as keyof GrowthOutput] !== n.output![k as keyof GrowthOutput],
        ) ||
        (n.status === 'no_growth') !== (parsed.outcome === 'no_growth')
      )
        throw new Error('Growth output was changed.');
    } else if (n.output !== undefined) throw new Error('Unexpected growth output.');
    if (n.edited) {
      parseGrowth(JSON.stringify(n.edited));
      if (n.status !== 'accepted' || n.edited.outcome !== 'growth')
        throw new Error('Invalid growth edit.');
    }
    if (['pending', 'proposed'].includes(n.status)) active++;
    seen.add(n.id);
  }
  if (active > 1 || (active && g.pending)) throw new Error('Conflicting pending operations.');
}
export function growthMarkdown(g: Garden): string {
  return (g.growth ?? [])
    .map(
      (n) =>
        `### ${n.edited?.title ?? n.output?.title ?? n.direction}\n\nParent: ${n.parent.title} (${n.parent.kind} ${n.parent.id})\nStatus: ${n.status}; model: ${n.model} @ ${n.modelRevision}; prompt: ${n.promptVersion}\n\n${n.edited?.concept ?? n.output?.concept ?? ''}\n\nExperiment: ${n.edited?.experiment ?? n.output?.experiment ?? ''}`,
    )
    .join('\n\n');
}
