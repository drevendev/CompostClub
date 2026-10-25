import { canonical, hash, bytes } from './hash';
import {
  current,
  identity,
  key,
  pairKey,
  prepare,
  revision,
  validPack,
  fingerprint,
} from './prepare';
import { text } from './contract';
import type {
  Candidate,
  Garden,
  Identity,
  Job,
  Node,
  Operation,
  Profile,
  SelectionPlan,
  Workspace,
} from './types';

export const INTERVALS = [15, 30, 60, 120, 240];
export const active = (j: Job) =>
  ['prepared', 'generating', 'draft retained', 'screening'].includes(j.stage);
export const uuid = () => crypto.randomUUID();
export function underlyingOperation(
  w: Workspace,
  j: Pick<Job, 'operation' | 'previousJob'>,
): Operation {
  let current = j;
  const seen = new Set<string>();
  while (current.operation === 'check' && current.previousJob) {
    if (seen.has(current.previousJob)) throw new Error('Cyclic assessment job history.');
    seen.add(current.previousJob);
    const previous = w.jobs.find((j) => j.id === current.previousJob);
    if (!previous) throw new Error('Assessment source job is unavailable.');
    current = previous;
  }
  return current.operation;
}
export function makeGarden(name: string, profile: Profile, now: number, id = uuid()): Garden {
  text(name, 80);
  if (!['game', 'application', 'story', 'custom', 'unknown'].includes(profile))
    throw new Error('Choose a garden type.');
  return {
    id,
    name,
    profile,
    profileRevision: 1,
    objective: '',
    background: false,
    interval: 15,
    nextAt: now + 900000,
    lastServed: 0,
    credits: { balance: 1, at: now },
    policy: { revision: 1, probability: 0, donors: [], donate: false },
    plan: null,
    legacy: null,
  };
}
export function create(
  now: number,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): Workspace {
  return {
    schemaVersion: 3,
    revision: 0,
    gardens: [makeGarden('My Garden', 'unknown', now)],
    sources: [],
    documents: [],
    references: [],
    preferences: [],
    jobs: [],
    nodes: [],
    consumed: [],
    calls: [],
    daily: {},
    settings: {
      attempts: 12,
      candidates: 8,
      calls: 24,
      backlog: 5,
      timezone,
      language: 'en',
      exportScope: 'kept',
    },
    runtime: { executable: '', models: '', model: 'gemma3:4b' },
    exportDirectory: '',
    paused: true,
    epoch: 0,
    failures: 0,
    attention: '',
    latestDate: '',
    lastObservedAt: now,
    lifecycle: [],
    legacy: null,
  };
}
export function garden(w: Workspace, id: string): Garden {
  const g = w.gardens.find((g) => g.id === id);
  if (!g) throw new Error('Garden unavailable.');
  return g;
}
export function addSource(
  w: Workspace,
  g: string,
  title: string,
  value: string,
  participating: boolean,
  now: number,
  id = uuid(),
): string {
  garden(w, g);
  if (w.sources.length >= 800 || w.sources.filter((s) => s.garden === g).length >= 200)
    throw new Error('Source capacity reached. Review a deletion preview before making space.');
  w.sources.push({
    id,
    garden: g,
    revisions: [revision(value, title, 1, now, w.settings.timezone)],
    participating,
    tags: [],
    fileId: null,
    origin: 'user-authored',
    ancestry: [],
  });
  return id;
}
export function editSource(w: Workspace, id: string, title: string, value: string, now: number) {
  const s = w.sources.find((s) => s.id === id);
  if (!s) throw new Error('Source unavailable.');
  if (s.revisions.length >= 100) throw new Error('Source revision history is full.');
  s.revisions.push(revision(value, title, current(s).revision + 1, now, w.settings.timezone));
  for (const g of w.gardens)
    if (g.plan?.parents.some((p) => p.kind === 'source' && p.id === id)) {
      g.plan.parents = [];
      g.plan.reason = 'Context changed; retaining the same seed and route.';
    }
}
export function balance(g: Garden, now: number): number {
  return Math.min(
    g.credits.cap ?? 3,
    g.credits.balance + Math.max(0, Math.floor((now - g.credits.at) / 900000)),
  );
}
export function reconcile(g: Garden, now: number) {
  const n = Math.max(0, Math.floor((now - g.credits.at) / 900000));
  g.credits.balance = Math.min(g.credits.cap ?? 3, g.credits.balance + n);
  g.credits.at += n * 900000;
}
export function credit(w: Workspace, g: string, now: number) {
  return (
    balance(garden(w, g), now) -
    w.jobs.filter((j) => j.garden === g && j.creditHeld).length -
    w.nodes.filter((n) => n.garden === g && n.creditHeld).length
  );
}
export function date(w: Workspace, now: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: w.settings.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function counts(w: Workspace, now: number) {
  const d = date(w, now),
    daily = w.daily[d];
  return {
    date: d,
    attempts: daily?.attempts.length ?? 0,
    candidates: daily?.candidates.length ?? 0,
    calls: w.calls.filter((c) => c.date === d).length,
    held: w.jobs.filter((j) => active(j) && j.date === d).reduce((n, j) => n + j.heldCalls, 0),
    pending: w.nodes.filter((n) =>
      n.kind === 'growth'
        ? n.creditHeld
        : ['new', 'later'].includes(n.decisions.at(-1)?.state ?? 'new'),
    ).length,
  };
}
export function wait(
  w: Workspace,
  g: string,
  now: number,
  manual = false,
  calls = 2,
  candidateJob = true,
): string {
  const c = counts(w, now),
    target = garden(w, g);
  if (w.attention) return w.attention;
  if (now < w.lastObservedAt - 1000 || c.date < w.latestDate)
    return 'Clock moved backwards; pause and check the installation clock.';
  if (w.jobs.some(active)) return 'One local job owns the model.';
  if (!manual && w.paused)
    return 'Global background pause. Manual work authorizes one bounded job.';
  if (!manual && !target.background) return 'This garden has background work disabled.';
  if (c.calls + c.held + calls > w.settings.calls)
    return `Waiting for ${calls} model calls; ${c.calls} spent, ${c.held} held today. Repair may be unavailable.`;
  if (c.attempts >= w.settings.attempts) return 'Daily attempt limit reached.';
  if (candidateJob && c.candidates >= w.settings.candidates)
    return 'Daily candidate limit reached.';
  if (candidateJob && c.pending >= w.settings.backlog)
    return 'Review pending candidates and growth proposals first.';
  if (candidateJob && credit(w, g, now) < 1) return 'Waiting for a garden credit.';
  if (!manual && now < target.nextAt)
    return 'Waiting for interval; next attempt ' + new Date(target.nextAt).toISOString();
  if (target.profile === 'unknown' && calls > 1)
    return 'needs_context: choose the target profile; manual custom drafting is available.';
  return '';
}
export function random(seed: number): number {
  let n = seed >>> 0;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  return (n >>> 0) / 4294967296;
}
export function plan(
  w: Workspace,
  id: string,
  seed: number,
  manual = false,
  parents: Identity[] | null = null,
): SelectionPlan {
  const g = garden(w, id);
  if (g.plan && !manual && g.plan.policyRevision === g.policy.revision) return g.plan;
  const draw = random(seed),
    route = parents
      ? parents.some((p) => p.garden !== id)
        ? 'cross'
        : 'local'
      : !manual && draw < g.policy.probability / 100
        ? 'cross'
        : 'local';
  const p: SelectionPlan = {
    id: uuid(),
    garden: id,
    seed,
    draw,
    route,
    manual,
    policyRevision: g.policy.revision,
    parents: parents ?? [],
    reason:
      (manual ? 'Explicit manual route. ' : 'One persisted probability draw. ') +
      'Seeded hash order among eligible pairs; approved matching facets preferred, not a quality score.',
    override: manual ? (g.plan?.id ?? null) : null,
  };
  g.plan = p;
  return p;
}
function allowed(w: Workspace, p: Identity, receiver: string): boolean {
  const s = w.sources.find((s) => s.id === p.id && s.garden === p.garden);
  if (!s?.participating || current(s).revision !== p.revision) return false;
  if (s.sample) return false;
  if (p.garden === receiver) return true;
  const g = garden(w, receiver),
    donor = garden(w, p.garden);
  return donor.policy.donate && g.policy.donors.includes(p.garden);
}
export function selection(w: Workspace, p: SelectionPlan, retry = false): Identity[] {
  const g = garden(w, p.garden);
  if (p.policyRevision !== g.policy.revision) throw new Error('Selection policy changed.');
  if (p.parents.length) {
    if (!p.parents.every((a) => allowed(w, a, g.id)))
      throw new Error('Selection consent or revision changed.');
    return p.parents;
  }
  const own = w.sources.filter((s) => s.garden === g.id && s.participating && !s.sample),
    donors =
      p.route === 'cross'
        ? w.sources.filter(
            (s) =>
              s.garden !== g.id &&
              s.participating &&
              !s.sample &&
              g.policy.donors.includes(s.garden) &&
              garden(w, s.garden).policy.donate,
          )
        : [];
  const candidates: { parents: Identity[]; score: number; rank: string }[] = [];
  const consumed = new Set(w.consumed.map((c) => c.key));
  const attempted = new Set(
    retry
      ? []
      : w.jobs
          .filter((j) => ['blend', 'revise'].includes(j.operation))
          .map((j) => pairKey(j.parents)),
  );
  const approvedType = new Map(
    [...own, ...donors].map((s) => [
      s.id,
      current(s).preparation.facets.some(
        (f) => f.approved && f.field === 'product type' && f.value === g.profile,
      ),
    ]),
  );
  for (let i = 0; i < own.length; i++)
    for (const b of p.route === 'local' ? own.slice(i + 1) : donors) {
      const a = own[i]!;
      const pair = [identity(a), identity(b)],
        k = pairKey(pair);
      if (consumed.has(k) || attempted.has(k)) continue;
      candidates.push({
        parents: pair,
        score: pair.reduce((n, p) => n + (approvedType.get(p.id) ? 1 : 0), 0),
        rank: hash(canonical([p.seed, pair])),
      });
    }
  candidates.sort((a, b) => b.score - a.score || a.rank.localeCompare(b.rank));
  if (!candidates[0]) {
    p.reason = `Waiting: no eligible unused ${p.route} pair. Route is frozen; add context or explicitly cancel and override.`;
    return [];
  }
  p.parents = candidates[0].parents;
  return p.parents;
}
export function prepareJob(
  w: Workspace,
  g: string,
  operation: Operation,
  now: number,
  options: {
    parents?: Identity[];
    seed?: number;
    question?: string;
    direction?: Job['direction'];
    previousJob?: string;
    manual?: boolean;
    existingNode?: boolean;
    targetRevision?: Identity;
  } = {},
): Job {
  const manual = options.manual ?? true,
    reason = wait(
      w,
      g,
      now,
      manual,
      ['dna', 'preferences', 'check'].includes(operation) ? 1 : 2,
      !['dna', 'preferences'].includes(operation) && !options.existingNode,
    );
  if (reason) throw new Error(reason);
  if (w.jobs.length >= 1000)
    throw new Error('Job history is full; preview cleanup before continuing.');
  const target = garden(w, g);
  if (manual && operation === 'blend' && !options.parents && target.plan && !target.plan.manual)
    throw new Error(
      'A frozen selection plan is waiting. Explicitly cancel it and choose a local override, or inspect a manual pair.',
    );
  const seed = options.seed ?? Math.floor(now % 4294967296);
  let p: SelectionPlan = ['blend', 'revise'].includes(operation)
    ? plan(w, g, seed, manual, options.parents ?? null)
    : {
        id: uuid(),
        garden: g,
        seed,
        draw: 0,
        route: options.parents?.some((p) => p.garden !== g) ? 'cross' : 'local',
        manual,
        policyRevision: target.policy.revision,
        parents: options.parents ?? [],
        reason: 'Explicit bounded operation; no probability draw.',
        override: null,
      };
  if (operation === 'growth') {
    if (!options.parents?.length || options.parents.length !== 1)
      throw new Error('Choose one accepted parent or deliberate source root.');
    if (options.parents[0]!.garden !== g)
      throw new Error(
        'Development roots belong to the selected garden; use an explicit two-parent exchange for donor material.',
      );
    if (
      w.nodes.filter((n) => n.creditHeld).length >= 3 ||
      w.nodes.some(
        (n) => n.creditHeld && n.parents.some((a) => key(a) === key(options.parents![0]!)),
      )
    )
      throw new Error(
        'Review the existing proposal for this parent (three unresolved proposals maximum).',
      );
    p = { ...p, parents: options.parents };
  } else if (operation === 'dna' || operation === 'preferences')
    p = { ...p, parents: options.parents ?? [] };
  else if (operation !== 'check' && operation !== 'revise') p.parents = selection(w, p);
  if (!p.parents.length && operation !== 'preferences') throw new Error(p.reason);
  if (
    operation === 'dna' &&
    (p.parents.length !== 1 || p.parents[0]!.kind !== 'source' || p.parents[0]!.garden !== g)
  )
    throw new Error('Decode one selected source in its own garden.');
  if (
    operation === 'check' &&
    underlyingOperation(w, { operation, previousJob: options.previousJob ?? null }) !== 'growth' &&
    p.parents.some((p) => p.kind === 'source' && !allowed(w, p, g))
  )
    throw new Error('Consent, participation or source revision is unavailable for this check.');
  if (operation === 'revise') {
    const existing = w.nodes.find((n) => pairKey(n.parents) === pairKey(p.parents));
    if (existing && existing.revisions.length >= 100)
      throw new Error('Candidate revision history is full.');
  }
  if (operation === 'blend' || operation === 'revise') {
    if (
      p.parents.length !== 2 ||
      p.parents.filter((p) => p.garden !== g).length > 1 ||
      !p.parents.some((p) => p.garden === g) ||
      !p.parents.every((p) => allowed(w, p, g))
    )
      throw new Error('A blend needs a receiver and at most one opted-in donor source.');
    if (
      w.consumed.some((c) => c.key === pairKey(p.parents)) &&
      !(
        operation === 'revise' &&
        options.previousJob &&
        w.jobs.some(
          (j) => j.id === options.previousJob && pairKey(j.parents) === pairKey(p.parents),
        )
      )
    )
      throw new Error('This pair is already consumed. Develop its kept candidate instead.');
  }
  const request = options.question ?? '',
    pack = prepare(w, g, p.parents, request),
    c = counts(w, now),
    required = ['dna', 'preferences', 'check'].includes(operation) ? 1 : 2;
  if (options.targetRevision) {
    const p = options.targetRevision,
      node = w.nodes.find((n) => n.id === p.id && n.garden === p.garden && n.kind === p.kind),
      r = node?.revisions.find((r) => r.revision === p.revision);
    if (!node || !r || (operation === 'revise' && node.revisions.at(-1)!.revision !== p.revision))
      throw new Error('Selected candidate revision changed or is unavailable.');
    const k = canonical([
      operation === 'revise' ? 'node-current' : 'revision-body',
      p.id,
      p.revision,
    ]);
    pack.fingerprints.push({ key: k, hash: fingerprint(w, k) });
  }
  const j: Job = {
    id: uuid(),
    operation,
    garden: g,
    parents: structuredClone(p.parents),
    snapshots: p.parents
      .filter((p) => p.kind === 'source')
      .map((p) => structuredClone(current(w.sources.find((s) => s.id === p.id)!))),
    plan: structuredClone(p),
    pack,
    date: c.date,
    entry: { at: now, timezone: w.settings.timezone, offset: new Date(now).getTimezoneOffset() },
    stage: 'prepared',
    history: [{ stage: 'prepared', at: now }],
    heldCalls: Math.min(
      operation === 'check' ? 2 : required === 1 ? 1 : 3,
      w.settings.calls - c.calls - c.held,
    ),
    creditHeld: !['dna', 'preferences'].includes(operation) && !options.existingNode,
    repairUsed: false,
    calls: [],
    dispatches: [],
    attemptCharged: false,
    candidateCharged: false,
    manualPermit: manual,
    epoch: w.epoch,
    model: w.runtime.model,
    modelDigest: '',
    promptVersion: 'coherent-2',
    schemaVersion: 'candidate-1',
    language: w.settings.language,
    direction: options.direction ?? null,
    question: request,
    previousJob: options.previousJob ?? null,
    ...(options.targetRevision ? { targetRevision: structuredClone(options.targetRevision) } : {}),
    draft: null,
    assessment: null,
    raw: [],
    primaryFailure: '',
    repairRefusal: '',
    observed: true,
  };
  w.jobs.push(j);
  return j;
}
export function stage(j: Job, s: Job['stage'], now: number) {
  j.stage = s;
  j.history.push({ stage: s, at: now });
}
export function revalidate(w: Workspace, j: Job, now: number) {
  if (!active(j) || j.epoch !== w.epoch || (!j.manualPermit && w.paused) || w.attention)
    throw new Error('Job cancelled or paused.');
  if (date(w, now) !== j.date || j.date < w.latestDate || now < w.lastObservedAt - 1000)
    throw new Error(
      'Accounting date changed or clock moved backwards; continue explicitly under the new date.',
    );
  if (!validPack(w, j.pack))
    throw new Error('Selected source, profile, reference or approved preference changed.');
  if (
    ['blend', 'revise', 'check'].includes(j.operation) &&
    underlyingOperation(w, j) !== 'growth' &&
    j.parents.every((p) => p.kind === 'source') &&
    (!j.parents.every((p) => allowed(w, p, j.garden)) ||
      garden(w, j.garden).policy.revision !== j.plan.policyRevision)
  )
    throw new Error('Consent, participation or policy revoked.');
}
export function dispatch(
  w: Workspace,
  id: string,
  s: 'generating' | 'screening',
  now: number,
  repair = false,
): string {
  const j = w.jobs.find((j) => j.id === id)!;
  revalidate(w, j, now);
  if (j.heldCalls < 1) throw new Error('Repair unavailable: reserved model-call budget exhausted.');
  if (repair && j.repairUsed) throw new Error('The one shared format repair was already used.');
  if (!repair && s === 'screening' && j.draft?.outcome !== 'candidate')
    throw new Error('Screening requires a retained valid draft.');
  if (!repair && s === 'generating' && j.calls.length)
    throw new Error('Generation was already dispatched.');
  const c: Workspace['calls'][number] = {
    id: uuid(),
    job: j.id,
    date: j.date,
    at: now,
    stage: s + (repair ? ':repair' : ''),
  };
  if (!w.daily[j.date]) w.daily[j.date] = { attempts: [], candidates: [] };
  if (!j.attemptCharged) {
    w.daily[j.date]!.attempts.push(j.id);
    j.attemptCharged = true;
    const g = garden(w, j.garden);
    g.nextAt = now + g.interval * 60000;
    g.lastServed = now;
    if (g.plan?.id === j.plan.id) g.plan = null;
  }
  w.calls.push(c);
  j.calls.push(c.id);
  j.heldCalls--;
  if (repair) j.repairUsed = true;
  w.latestDate = j.date;
  w.lastObservedAt = Math.max(now, w.lastObservedAt);
  stage(j, s, now);
  return c.id;
}
export function finish(w: Workspace, j: Job, s: Job['stage'], now: number) {
  stage(j, s, now);
  j.heldCalls = 0;
  j.creditHeld = false;
  j.manualPermit = false;
  if (['negative', 'needs_context', 'needs_revision', 'screened', 'proposal'].includes(s))
    w.failures = 0;
}
export function fail(w: Workspace, j: Job, error: string, now: number, cancelled = false) {
  j.primaryFailure ||= error;
  finish(w, j, cancelled ? 'cancelled' : 'failed', now);
  if (!cancelled && j.attemptCharged) {
    w.failures++;
    if (w.failures >= 3) {
      w.paused = true;
      w.attention =
        'Three consecutive operationally failed jobs. Inspect retained responses before clearing attention.';
    }
  }
}
function chargeCandidate(w: Workspace, j: Job) {
  if (j.candidateCharged) return;
  if (!w.daily[j.date]) w.daily[j.date] = { attempts: [], candidates: [] };
  if (w.daily[j.date]!.candidates.length >= w.settings.candidates)
    throw new Error('Daily candidate limit reached.');
  w.daily[j.date]!.candidates.push(j.id);
  j.candidateCharged = true;
}
function spend(w: Workspace, g: string, now: number) {
  const target = garden(w, g);
  reconcile(target, now);
  if (target.credits.balance < 1) throw new Error('Garden credit unavailable.');
  target.credits.balance--;
}
export function commit(w: Workspace, id: string, now: number, override = false): Node {
  const j = w.jobs.find((j) => j.id === id);
  if (!j || j.draft?.outcome !== 'candidate') throw new Error('No valid retained candidate.');
  const originalStage = j.stage;
  if (override) {
    if (!['needs_revision', 'needs_context', 'interrupted', 'failed'].includes(j.stage))
      throw new Error('Inspect a filtered draft before overriding screening.');
    stage(j, 'draft retained', now);
    j.epoch = w.epoch;
    j.manualPermit = true;
    j.date = date(w, now);
    j.creditHeld = true;
  }
  revalidate(w, j, now);
  if (!override && j.assessment?.decision !== 'pass')
    throw new Error('A passing assessment is required.');
  const prior =
    j.operation === 'check' && j.previousJob
      ? w.nodes.find((n) =>
          j.targetRevision
            ? n.id === j.targetRevision.id && n.garden === j.targetRevision.garden
            : n.job === j.previousJob,
        )
      : undefined;
  if (prior) {
    const target = prior.revisions.find((r) => r.hash === hash(canonical(j.draft)));
    if (!target) throw new Error('Recheck targets an unavailable candidate revision.');
    target.assessments ??= [];
    if (
      target.assessment &&
      !target.assessments.some((a) => canonical(a) === canonical(target.assessment))
    )
      target.assessments.push(structuredClone(target.assessment));
    if (j.assessment) target.assessments.push(structuredClone(j.assessment));
    target.assessment = structuredClone(j.assessment);
    finish(w, j, 'screened', now);
    return prior;
  }
  const isGrowth = underlyingOperation(w, j) === 'growth';
  const revised =
    j.operation === 'revise'
      ? w.nodes.find((n) => n.kind === 'candidate' && pairKey(n.parents) === pairKey(j.parents))
      : undefined;
  if (revised) {
    if (credit(w, j.garden, now) + (j.creditHeld ? 1 : 0) < 1)
      throw new Error('Credit is unavailable for this revision.');
    chargeCandidate(w, j);
    spend(w, j.garden, now);
    revised.revisions.push({
      job: j.id,
      revision: revised.revisions.at(-1)!.revision + 1,
      content: structuredClone(j.draft),
      hash: hash(canonical(j.draft)),
      origin: 'local-model proposal',
      references: w.references
        .filter((r) => j.pack.fingerprints.some((f) => f.key === canonical(['reference', r.id])))
        .map((r) => structuredClone(r)),
      entry: { at: now, timezone: w.settings.timezone, offset: new Date(now).getTimezoneOffset() },
      assessment: structuredClone(j.assessment),
    });
    revised.decisions.push({
      id: uuid(),
      revision: revised.revisions.at(-1)!.revision,
      state: override ? 'kept' : 'new',
      reasons: [],
      note: '',
      at: now,
      override,
    });
    revised.accepted = override;
    finish(w, j, 'screened', now);
    return revised;
  }
  if (
    w.nodes.length >= 2000 ||
    w.nodes.filter((n) => n.kind === (j.operation === 'growth' ? 'growth' : 'candidate')).length >=
      1000
  )
    throw new Error('Candidate/growth capacity reached.');
  if (
    w.nodes.some((n) => n.job === id) ||
    (['blend', 'revise'].includes(j.operation) &&
      w.consumed.some((c) => c.key === pairKey(j.parents)))
  )
    throw new Error('Candidate or pair already committed.');
  if (credit(w, j.garden, now) + (j.creditHeld ? 1 : 0) < 1)
    throw new Error('Credit is unavailable for this draft.');
  chargeCandidate(w, j);
  const n: Node = {
    id: uuid(),
    garden: j.garden,
    kind: isGrowth ? 'growth' : 'candidate',
    parents: structuredClone(j.parents),
    job: j.id,
    revisions: [
      {
        revision: 1,
        content: structuredClone(j.draft),
        hash: hash(canonical(j.draft)),
        origin: 'local-model proposal',
        job: j.id,
        entry: {
          at: now,
          timezone: w.settings.timezone,
          offset: new Date(now).getTimezoneOffset(),
        },
        assessment: j.assessment ? structuredClone(j.assessment) : null,
      },
    ],
    decisions: [
      {
        id: uuid(),
        revision: 1,
        state: override ? 'kept' : 'new',
        reasons: [],
        note: '',
        at: now,
        override,
      },
    ],
    accepted: override,
    creditHeld: isGrowth,
    imported: !j.observed,
    references: w.references
      .filter((r) => j.pack.fingerprints.some((f) => f.key === canonical(['reference', r.id])))
      .map((r) => structuredClone(r)),
  };
  if (n.kind === 'candidate') {
    spend(w, j.garden, now);
    w.consumed.push({ key: pairKey(j.parents), node: n.id });
  }
  w.nodes.push(n);
  finish(w, j, n.kind === 'growth' ? 'proposal' : 'screened', now);
  if (override && n.kind === 'growth') {
    n.creditHeld = false;
    spend(w, j.garden, now);
    j.stage = 'accepted';
  }
  if (originalStage === 'interrupted' && override)
    n.decisions[0]!.note =
      'Human override of an interrupted screening; no successful screening claimed.';
  return n;
}
export function decide(
  w: Workspace,
  id: string,
  state: 'kept' | 'rejected' | 'later',
  note: string,
  reasons: string[],
  now: number,
) {
  const n = w.nodes.find((n) => n.id === id);
  if (!n) throw new Error('Candidate unavailable.');
  text(note, 4000, true);
  if (reasons.length > 8) throw new Error('Too many reasons.');
  reasons.forEach((r) => text(r, 100));
  const r = n.revisions.at(-1)!;
  if (
    n.kind === 'growth' &&
    state === 'kept' &&
    !n.creditHeld &&
    !n.decisions.some((d) => d.state === 'kept')
  )
    throw new Error('Rejected proposal requires a new bounded growth request.');
  if (n.kind === 'growth' && n.creditHeld && state !== 'later') {
    if (state === 'kept') spend(w, n.garden, now);
    n.creditHeld = false;
    const job = w.jobs.find((j) => j.id === n.job);
    if (job) stage(job, state === 'kept' ? 'accepted' : 'rejected', now);
  }
  n.decisions.push({
    id: uuid(),
    revision: r.revision,
    state,
    note,
    reasons,
    at: now,
    override: n.decisions.some((d) => d.revision === r.revision && d.override),
  });
  n.accepted = state === 'kept';
  // Already accepted nodes can have descendants. Historical acceptance remains
  // in decisions and exact revisions; later review never rewrites those edges.
}
export function editNode(w: Workspace, id: string, candidate: Candidate, now: number) {
  const n = w.nodes.find((n) => n.id === id);
  if (!n) throw new Error('Candidate unavailable.');
  if (n.revisions.length >= 100) throw new Error('Revision limit reached.');
  n.revisions.push({
    job: n.revisions.at(-1)!.job ?? n.job,
    references: structuredClone(n.revisions.at(-1)!.references ?? n.references),
    revision: n.revisions.at(-1)!.revision + 1,
    content: structuredClone(candidate),
    hash: hash(canonical(candidate)),
    origin: 'user-authored',
    entry: { at: now, timezone: w.settings.timezone, offset: new Date(now).getTimezoneOffset() },
    assessment: null,
  });
  n.accepted = false;
  n.decisions.push({
    id: uuid(),
    revision: n.revisions.at(-1)!.revision,
    state: 'later',
    reasons: [],
    note: '',
    at: now,
    override: false,
  });
}
export function due(w: Workspace, now: number): Garden[] {
  return w.gardens
    .filter((g) => g.background && g.nextAt <= now)
    .sort((a, b) => a.nextAt - b.nextAt || a.lastServed - b.lastServed || a.id.localeCompare(b.id));
}
export function pause(w: Workspace, now: number) {
  w.paused = true;
  w.epoch++;
  for (const j of w.jobs.filter(active)) finish(w, j, 'cancelled', now);
}
export function recover(w: Workspace, now: number) {
  w.paused = true;
  w.epoch++;
  for (const j of w.jobs.filter(active)) {
    j.primaryFailure ||= 'Interrupted during ' + j.stage;
    finish(w, j, 'interrupted', now);
  }
  for (const g of w.gardens) g.nextAt = Math.max(g.nextAt, now + g.interval * 60000);
}
export function deletionPreview(w: Workspace, gardenId: string | null, sourceId: string | null) {
  const sources = new Set(
      w.sources
        .filter((s) => (gardenId ? s.garden === gardenId : s.id === sourceId))
        .map((s) => s.id),
    ),
    nodes = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of w.sources)
      if (
        !sources.has(s.id) &&
        s.ancestry.some((p) => (p.kind === 'source' ? sources.has(p.id) : nodes.has(p.id)))
      ) {
        sources.add(s.id);
        changed = true;
      }
    for (const n of w.nodes)
      if (
        !nodes.has(n.id) &&
        (gardenId === n.garden ||
          n.parents.some((p) => (p.kind === 'source' ? sources.has(p.id) : nodes.has(p.id))))
      ) {
        nodes.add(n.id);
        changed = true;
      }
  }
  const jobs = w.jobs
    .filter(
      (j) =>
        gardenId === j.garden ||
        j.parents.some((p) => (p.kind === 'source' ? sources.has(p.id) : nodes.has(p.id))) ||
        nodes.has(w.nodes.find((n) => n.job === j.id)?.id ?? ''),
    )
    .map((j) => j.id);
  return {
    sources: [...sources],
    nodes: [...nodes],
    jobs,
    documents: w.sources.filter((s) => sources.has(s.id) && s.fileId).map((s) => s.fileId!),
    retained:
      'Historical job snapshots, imported originals, existing backups and managed reading exports retain copies until separately purged. Unrelated work is preserved.',
  };
}
export function remove(w: Workspace, g: string | null, s: string | null, now: number) {
  const p = deletionPreview(w, g, s);
  if (w.jobs.some((j) => active(j) && p.jobs.includes(j.id)))
    throw new Error('Pause affected work first.');
  w.sources = w.sources.filter((s) => !p.sources.includes(s.id));
  w.nodes = w.nodes.filter((n) => !p.nodes.includes(n.id));
  w.consumed = w.consumed.filter((c) => !p.nodes.includes(c.node));
  if (g) {
    if (w.gardens.length === 1) throw new Error('Keep at least one garden.');
    w.gardens = w.gardens.filter((x) => x.id !== g);
    for (const x of w.gardens) {
      x.policy.donors = x.policy.donors.filter((id) => id !== g);
      x.policy.revision++;
      x.plan = null;
    }
  }
  for (const r of w.references)
    if ((r.source && p.sources.includes(r.source.id)) || r.garden === g) {
      r.removed = true;
      r.revision++;
    }
  for (const s of w.sources) {
    const prep = current(s).preparation;
    const kept = prep.references.filter((id) => !w.references.find((r) => r.id === id)?.removed);
    if (kept.length !== prep.references.length) {
      prep.references = kept;
      prep.revision++;
    }
  }
  for (const pref of w.preferences) if (pref.garden === g) pref.enabled = false;
  for (const j of w.jobs.filter((j) => p.jobs.includes(j.id) && active(j)))
    finish(w, j, 'cancelled', now);
}
export function sizeGuard(w: Workspace) {
  if (bytes(JSON.stringify(w)) > 32 * 1024 * 1024)
    throw new Error('Structured workspace exceeds 32 MiB; no state was replaced.');
}
