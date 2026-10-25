import { assertWorkspace as assertLegacy } from '../experiment';
import { importGarden, DESKTOP_LIMITS } from '../garden';
import { bytes, canonical, hash } from './hash';
import { key, pairKey, safeUrl } from './prepare';
import { active, INTERVALS, sizeGuard, underlyingOperation } from './workspace';
import { parseDraft } from './contract';
import type { Identity, Workspace } from './types';

function ensure(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const bounded = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
export function validate(w: Workspace): void {
  ensure(
    w && w.schemaVersion === 3 && Number.isSafeInteger(w.revision) && w.revision >= 0,
    'Unsupported workspace version/revision.',
  );
  sizeGuard(w);
  for (const [v, max] of [
    [w.gardens, 4],
    [w.sources, 800],
    [w.documents, 1000],
    [w.references, 4000],
    [w.preferences, 1000],
    [w.jobs, 1000],
    [w.nodes, 2000],
    [w.calls, 12000],
    [w.lifecycle, 12000],
  ] as const)
    ensure(Array.isArray(v) && v.length <= max, 'Invalid collection or capacity exceeded.');
  ensure(
    w.gardens.length > 0 &&
      typeof w.paused === 'boolean' &&
      Number.isSafeInteger(w.epoch) &&
      Number.isFinite(w.lastObservedAt),
    'Invalid workspace control state.',
  );
  const unique = (v: { id: string }[]) => {
    const ids = v.map((v) => v.id);
    ensure(
      ids.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 128) &&
        new Set(ids).size === ids.length,
      'Duplicate or invalid stable identity.',
    );
  };
  [
    w.gardens,
    w.sources,
    w.documents,
    w.references,
    w.preferences,
    w.jobs,
    w.nodes,
    w.calls,
    w.lifecycle,
  ].forEach(unique);
  const gardens = new Set(w.gardens.map((g) => g.id));
  for (const g of w.gardens) {
    if (g.plan)
      ensure(
        g.plan.garden === g.id &&
          ['local', 'cross'].includes(g.plan.route) &&
          Number.isSafeInteger(g.plan.seed) &&
          g.plan.seed >= 0 &&
          g.plan.seed <= 4294967295 &&
          g.plan.draw >= 0 &&
          g.plan.draw < 1 &&
          [0, 2].includes(g.plan.parents.length) &&
          (g.plan.parents.length === 0 ||
            (g.plan.route === 'local' && g.plan.parents.every((p) => p.garden === g.id)) ||
            (g.plan.route === 'cross' &&
              g.plan.parents.filter((p) => p.garden === g.id).length === 1)),
        'Invalid frozen selection plan.',
      );
    ensure(
      bounded(g.name, 80) &&
        g.name.trim() &&
        ['game', 'application', 'story', 'custom', 'unknown'].includes(g.profile) &&
        Number.isInteger(g.profileRevision) &&
        g.profileRevision > 0 &&
        bounded(g.objective, 2000),
      'Invalid garden profile.',
    );
    ensure(
      typeof g.background === 'boolean' &&
        INTERVALS.includes(g.interval) &&
        Number.isFinite(g.nextAt) &&
        Number.isFinite(g.lastServed) &&
        Number.isInteger(g.credits.balance) &&
        g.credits.balance >= 0 &&
        Number.isInteger(g.credits.cap ?? 3) &&
        (g.credits.cap ?? 3) >= 1 &&
        (g.credits.cap ?? 3) <= 10 &&
        g.credits.balance <= (g.credits.cap ?? 3) &&
        Number.isFinite(g.credits.at),
      'Invalid rhythm/credits.',
    );
    ensure(
      g.policy &&
        Number.isInteger(g.policy.revision) &&
        g.policy.revision > 0 &&
        Number.isInteger(g.policy.probability) &&
        g.policy.probability >= 0 &&
        g.policy.probability <= 100 &&
        typeof g.policy.donate === 'boolean' &&
        Array.isArray(g.policy.donors) &&
        g.policy.donors.every((id) => gardens.has(id) && id !== g.id),
      'Invalid exchange consent.',
    );
    ensure(
      w.sources.filter((s) => s.garden === g.id).length <= 200,
      'Garden source capacity exceeded.',
    );
    if (g.legacy) importGarden(JSON.stringify(g.legacy), 'local', DESKTOP_LIMITS);
  }
  for (const s of w.sources) {
    ensure(
      gardens.has(s.garden) &&
        typeof s.participating === 'boolean' &&
        [
          'user-authored',
          'imported assertion',
          'deterministic extraction',
          'local-model proposal',
        ].includes(s.origin) &&
        Array.isArray(s.tags) &&
        s.tags.length <= 8 &&
        s.tags.every((t) => bounded(t, 30)) &&
        s.revisions.length > 0 &&
        s.revisions.length <= 100,
      'Invalid source.',
    );
    let previous = 0;
    for (const r of s.revisions) {
      ensure(
        Number.isSafeInteger(r.revision) &&
          r.revision > previous &&
          bounded(r.title, 120) &&
          typeof r.text === 'string' &&
          bytes(r.text) <= 1024 * 1024 &&
          r.hash === hash(r.text) &&
          Number.isFinite(r.entry.at),
        'Invalid source revision/hash.',
      );
      previous = r.revision;
      const ids = new Set(r.spans.map((s) => s.id));
      ensure(ids.size === r.spans.length, 'Duplicate span identity.');
      for (const span of r.spans)
        ensure(
          Number.isSafeInteger(span.start) &&
            Number.isSafeInteger(span.end) &&
            span.start >= 0 &&
            span.end > span.start &&
            r.text.slice(span.start, span.end) === span.text,
          'Contradictory original span.',
        );
      const p = r.preparation;
      ensure(
        Number.isInteger(p.revision) &&
          p.revision > 0 &&
          p.selected.every((id) => ids.has(id)) &&
          p.essential.every((id) => ids.has(id)) &&
          p.facets.length <= 24 &&
          p.aliases.length <= 24,
        'Invalid context selection.',
      );
      for (const f of p.facets)
        ensure(
          bounded(f.id, 128) &&
            bounded(f.field, 60) &&
            (f.value === null || bounded(f.value, 240)) &&
            f.sourceRevision === r.revision &&
            f.spans.every((id) => ids.has(id)) &&
            typeof f.approved === 'boolean' &&
            [
              'user-authored',
              'imported assertion',
              'deterministic extraction',
              'local-model proposal',
            ].includes(f.origin),
          'Invalid facet provenance.',
        );
      for (const a of p.aliases)
        ensure(
          ids.has(a.span) &&
            r.spans.find((s) => s.id === a.span)!.text.includes(a.original) &&
            bounded(a.original, 120) &&
            a.original.length > 0 &&
            bounded(a.meaning, 240) &&
            typeof a.approved === 'boolean' &&
            typeof a.essential === 'boolean',
          'Alias must resolve to its original source span.',
        );
    }
  }
  for (const d of w.documents)
    ensure(
      bounded(d.name, 512) &&
        typeof d.text === 'string' &&
        bytes(d.text) <= 1024 * 1024 &&
        bounded(d.bytesBase64, 1400000) &&
        /^[A-Za-z0-9+/]*={0,2}$/.test(d.bytesBase64) &&
        bounded(d.hash, 64) &&
        d.hash === hash(Uint8Array.from(atob(d.bytesBase64), (c) => c.charCodeAt(0))),
      'Invalid retained original.',
    );
  for (const d of w.documents) {
    const decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      Uint8Array.from(atob(d.bytesBase64), (c) => c.charCodeAt(0)),
    );
    ensure(
      d.text === decoded || d.text === decoded.replace(/^\uFEFF/, ''),
      'Retained document text contradicts its original UTF-8 bytes.',
    );
  }
  for (const s of w.sources)
    ensure(
      s.fileId === null || w.documents.some((d) => d.id === s.fileId),
      'Missing retained original.',
    );
  for (const r of w.references) {
    ensure(gardens.has(r.garden) || r.removed, 'Missing reference garden.');
    ensure(
      Number.isInteger(r.revision) &&
        r.revision > 0 &&
        bounded(r.name, 120) &&
        bounded(r.property, 2000) &&
        bounded(r.differ, 1000) &&
        [
          'uninspected link',
          'imported assertion',
          'user-confirmed property',
          'source-supported property',
        ].includes(r.status) &&
        typeof r.essential === 'boolean' &&
        typeof r.removed === 'boolean',
      'Invalid reference.',
    );
    if (r.url) safeUrl(r.url);
    if (r.fileId)
      ensure(
        w.documents.some((d) => d.id === r.fileId),
        'Reference document unavailable.',
      );
    if (r.status === 'source-supported property' && !r.removed)
      ensure(
        r.source &&
          r.spans.length > 0 &&
          w.sources.some(
            (s) =>
              s.id === r.source!.id &&
              s.garden === r.source!.garden &&
              s.revisions.some(
                (v) =>
                  v.revision === r.source!.revision &&
                  r.spans.every((id) => v.spans.some((s) => s.id === id)),
              ),
          ),
        'Unsupported source-backed reference assertion.',
      );
  }
  for (const p of w.preferences)
    ensure(
      (p.garden === null || gardens.has(p.garden) || !p.enabled) &&
        Number.isInteger(p.revision) &&
        p.revision > 0 &&
        bounded(p.text, 240) &&
        typeof p.approved === 'boolean' &&
        typeof p.enabled === 'boolean' &&
        Array.isArray(p.reviews),
      'Invalid approved preference.',
    );
  const set = w.settings;
  ensure(
    set &&
      Number.isInteger(set.calls) &&
      set.calls >= 1 &&
      set.calls <= 96 &&
      Number.isInteger(set.attempts) &&
      set.attempts >= 1 &&
      set.attempts <= 48 &&
      Number.isInteger(set.candidates) &&
      set.candidates >= 1 &&
      set.candidates <= 48 &&
      Number.isInteger(set.backlog) &&
      set.backlog >= 1 &&
      set.backlog <= 20 &&
      ['en', 'ru'].includes(set.language) &&
      ['kept', 'all', 'filtered'].includes(set.exportScope),
    'Invalid global budget.',
  );
  new Intl.DateTimeFormat('en', { timeZone: set.timezone });
  ensure(
    w.runtime &&
      bounded(w.runtime.executable, 32768) &&
      bounded(w.runtime.models, 32768) &&
      ['gemma3:1b', 'gemma3:4b'].includes(w.runtime.model) &&
      bounded(w.exportDirectory, 32768),
    'Invalid installation-owned configuration.',
  );
  ensure(w.jobs.filter(active).length <= 1, 'Only one active local job is allowed.');
  for (const j of w.jobs) {
    underlyingOperation(w, j);
    ensure(
      ['blend', 'growth', 'check', 'dna', 'preferences', 'revise'].includes(j.operation) &&
        [
          'prepared',
          'generating',
          'draft retained',
          'screening',
          'screened',
          'needs_revision',
          'needs_context',
          'negative',
          'failed',
          'cancelled',
          'interrupted',
          'proposal',
          'accepted',
          'rejected',
        ].includes(j.stage) &&
        ['en', 'ru'].includes(j.language) &&
        typeof j.primaryFailure === 'string' &&
        typeof j.repairRefusal === 'string',
      'Unsupported job operation or stage.',
    );
    ensure(
      j.pack &&
        hash(j.pack.payload) === j.pack.hash &&
        j.pack.version === 'context-1' &&
        j.pack.counting === 'utf8-byte-upper-bound' &&
        j.pack.inputUpperBound === bytes(j.pack.payload) &&
        j.pack.inputUpperBound + 900 + 512 <= 4096,
      'Forged or oversized context pack.',
    );
    const manifest = JSON.parse(j.pack.payload) as { evidence: unknown };
    ensure(
      canonical(manifest.evidence) === canonical(j.pack.evidence),
      'Context payload/evidence mismatch.',
    );
    const evidenceIds = j.pack.evidence.map((e) => e.id);
    ensure(new Set(evidenceIds).size === evidenceIds.length, 'Duplicate context evidence ID.');
    const sourceParents = j.parents.filter((p) => p.kind === 'source');
    ensure(sourceParents.length === j.snapshots.length, 'Missing exact parent snapshot.');
    for (const [i, p] of sourceParents.entries()) {
      const snap = j.snapshots[i]!;
      ensure(
        snap.revision === p.revision && snap.hash === hash(snap.text),
        'Contradictory retained source revision.',
      );
      const known = w.sources
        .find((s) => s.id === p.id && s.garden === p.garden)
        ?.revisions.find((r) => r.revision === p.revision);
      if (known) ensure(known.hash === snap.hash, 'Contradictory known source revision.');
    }
    for (const d of j.dispatches ?? [])
      ensure(
        j.calls.includes(d.id) &&
          d.schemaHash === hash(d.schema) &&
          d.inputByteUpperBound === bytes(d.prompt) + 64 &&
          [480, 900].includes(d.outputTokens) &&
          d.timeoutMs === 180000 &&
          d.inputByteUpperBound + d.outputTokens <= 4096,
        'Invalid dispatch identity, prompt or context allowance.',
      );
    if (j.draft) parseDraft(JSON.stringify(j.draft), j);
    ensure(
      Number.isInteger(j.heldCalls) &&
        j.heldCalls >= 0 &&
        j.heldCalls <= 3 &&
        j.calls.length <= 3 &&
        j.calls.every((id) => w.calls.some((c) => c.id === id && c.job === j.id)) &&
        typeof j.observed === 'boolean' &&
        Array.isArray(j.history) &&
        j.history.length <= 24 &&
        j.raw.length <= 6,
      'Invalid job accounting/stages.',
    );
    if (active(j))
      ensure(gardens.has(j.garden) && j.epoch === w.epoch, 'Active job has stale ownership.');
    if (j.assessment)
      ensure(
        j.assessment.contextHash === j.pack.hash &&
          j.assessment.revisionHash === hash(canonical(j.draft)) &&
          ['pass', 'needs_revision', 'needs_context'].includes(j.assessment.decision) &&
          j.assessment.findings.every((f) => f.evidence.every((id) => evidenceIds.includes(id))),
        'Forged assessment hashes.',
      );
  }
  const nodeMap = new Map(w.nodes.map((n) => [n.id, n]));
  const exists = (p: Identity) =>
    p.kind === 'source'
      ? w.sources.some(
          (s) =>
            s.id === p.id &&
            s.garden === p.garden &&
            s.revisions.some((r) => r.revision === p.revision),
        )
      : !!nodeMap.get(p.id)?.revisions.some((r) => r.revision === p.revision) &&
        nodeMap.get(p.id)?.garden === p.garden &&
        nodeMap.get(p.id)?.kind === p.kind;
  const depths = new Map<string, number>(),
    visiting = new Set<string>();
  const visit = (p: Identity): number => {
    const id = key(p);
    ensure(exists(p), 'Orphan or contradictory parent revision: ' + id);
    ensure(!visiting.has(id), 'Ancestry cycle.');
    const known = depths.get(id);
    if (known !== undefined) return known;
    visiting.add(id);
    const parents =
      p.kind === 'source'
        ? w.sources.find((s) => s.id === p.id)!.ancestry
        : nodeMap.get(p.id)!.parents;
    const depth = parents.length ? 1 + Math.max(...parents.map(visit)) : 0;
    ensure(depth <= 32, 'Ancestry exceeds 32 accepted edges.');
    visiting.delete(id);
    depths.set(id, depth);
    return depth;
  };
  for (const s of w.sources)
    visit({ garden: s.garden, kind: 'source', id: s.id, revision: s.revisions.at(-1)!.revision });
  for (const n of w.nodes) {
    ensure(
      gardens.has(n.garden) &&
        ['candidate', 'growth'].includes(n.kind) &&
        n.revisions.length > 0 &&
        n.revisions.length <= 100 &&
        n.parents.length > 0 &&
        n.parents.length <= 2,
      'Invalid candidate graph.',
    );
    visit({ garden: n.garden, kind: n.kind, id: n.id, revision: n.revisions.at(-1)!.revision });
    let previous = 0;
    for (const r of n.revisions) {
      ensure(
        r.revision > previous && r.hash === hash(canonical(r.content)),
        'Contradictory candidate revision.',
      );
      previous = r.revision;
      if (r.assessment)
        ensure(r.assessment.revisionHash === r.hash, 'Assessment targets another revision.');
      if (!n.job.startsWith('legacy:')) {
        const job = w.jobs.find((j) => j.id === (r.job ?? n.job));
        ensure(job, 'Missing revision job.');
        parseDraft(JSON.stringify(r.content), job);
      }
    }
    for (const d of n.decisions)
      ensure(
        n.revisions.some((r) => r.revision === d.revision) &&
          bounded(d.note, 4000) &&
          ['new', 'kept', 'rejected', 'later'].includes(d.state),
        'Invalid human decision.',
      );
    ensure(
      n.accepted ===
        (n.decisions.filter((d) => d.revision === n.revisions.at(-1)!.revision).at(-1)?.state ===
          'kept'),
      'Contradictory current human decision.',
    );
    if (!n.job.startsWith('legacy:'))
      ensure(
        w.jobs.some((j) => j.id === n.job && j.garden === n.garden),
        'Candidate has no retained job.',
      );
  }
  ensure(
    w.nodes.filter((n) => n.creditHeld).length <= 3,
    'Too many credit-holding growth proposals.',
  );
  const pairs = new Set<string>();
  for (const c of w.consumed) {
    const n = nodeMap.get(c.node);
    ensure(
      n?.kind === 'candidate' && c.key === pairKey(n.parents) && !pairs.has(c.key),
      'Missing, forged or repeated consumed-pair/result relationship.',
    );
    pairs.add(c.key);
  }
  for (const n of w.nodes.filter((n) => n.kind === 'candidate'))
    ensure(
      w.consumed.some((c) => c.node === n.id),
      'Candidate missing consumed-pair index.',
    );
  for (const c of w.calls)
    ensure(
      /^\d{4}-\d{2}-\d{2}$/.test(c.date) &&
        Number.isFinite(c.at) &&
        bounded(c.job, 128) &&
        bounded(c.stage, 80),
      'Invalid durable call.',
    );
  for (const [d, v] of Object.entries(w.daily))
    ensure(
      /^\d{4}-\d{2}-\d{2}$/.test(d) &&
        Array.isArray(v.attempts) &&
        Array.isArray(v.candidates) &&
        new Set(v.attempts).size === v.attempts.length &&
        new Set(v.candidates).size === v.candidates.length,
      'Invalid daily counters.',
    );
  if (w.legacy) assertLegacy(w.legacy);
}
