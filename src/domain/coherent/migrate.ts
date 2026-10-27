import { assertWorkspace, createWorkspace, type Workspace as Legacy } from '../experiment';
import { importGarden, DESKTOP_LIMITS } from '../garden';
import { canonical, hash } from './hash';
import { pairKey, revision } from './prepare';
import { create, uuid } from './workspace';
import { validate } from './validate';
import type { Candidate, Identity, Node, Workspace } from './types';

export function migrate(value: unknown, now: number): Workspace {
  const input = value as { schemaVersion?: number; version?: number };
  if (input.schemaVersion === 3) {
    const migrated = structuredClone(input as Workspace);
    migrated.requests ??= [];
    // Missing admission means historical contract, never retroactive screening.
    validate(migrated);
    return migrated;
  }
  let legacy: Legacy;
  if (input.schemaVersion === 2) {
    legacy = structuredClone(input as Legacy);
    assertWorkspace(legacy);
    legacy.garden = importGarden(JSON.stringify(legacy.garden), 'local', DESKTOP_LIMITS);
  } else {
    const personal = importGarden(JSON.stringify(input), 'import', DESKTOP_LIMITS);
    if (personal.kind === 'sample')
      throw new Error('Recorded public sample cannot become a private garden/donor.');
    legacy = createWorkspace(now);
    legacy.garden = personal;
    for (const s of personal.scraps)
      legacy.sources[s.id] = {
        title: s.text.slice(0, 120),
        tags: [],
        participating: false,
        origin: 'Imported browser backup',
      };
  }
  const w = create(now, legacy.settings.timezone),
    g = w.gardens[0]!;
  g.id = legacy.garden.id;
  g.name = 'My Garden';
  g.interval = legacy.settings.intervalMinutes;
  g.nextAt = Math.max(now + g.interval * 60000, legacy.experiment.nextAt);
  g.credits = { balance: legacy.garden.readySlots, at: legacy.garden.lastAccrualAt };
  g.legacy = structuredClone(legacy.garden);
  w.legacy = structuredClone(legacy);
  w.runtime = structuredClone(legacy.runtime);
  w.exportDirectory = legacy.exportDirectory;
  w.settings.calls = legacy.settings.dailyCalls;
  w.settings.backlog = legacy.settings.backlog;
  w.settings.language = legacy.settings.language;
  w.settings.exportScope = legacy.settings.exportScope;
  w.latestDate = legacy.experiment.latestDate;
  w.lastObservedAt = Math.max(now, legacy.experiment.lastObservedAt);
  w.calls = legacy.experiment.calls.map((c) => ({
    id: c.id,
    job: c.jobId,
    date: c.date,
    at: c.at,
    stage: 'legacy ' + c.phase + ' ' + c.kind,
  }));
  for (const f of legacy.files)
    w.documents.push({
      id: f.id,
      name: f.name,
      text: f.utf8,
      bytesBase64: f.bytesBase64,
      hash: hash(Uint8Array.from(atob(f.bytesBase64), (c) => c.charCodeAt(0))),
      decoding: 'Legacy retained bytes; historical decoding unavailable',
      entry: { at: now, timezone: null, offset: null },
    });
  for (const s of legacy.garden.scraps) {
    const info = legacy.sources[s.id];
    const revisions = [...(s.history ?? []), s].map((r) => {
      const v = revision(r.raw, info?.title ?? s.text.slice(0, 120), r.revision, s.createdAt, null);
      v.entry.offset = null;
      return v;
    });
    w.sources.push({
      sample: s.origin === 'fixture',
      id: s.id,
      garden: g.id,
      revisions,
      participating: info?.participating ?? false,
      tags: info?.tags ?? [],
      fileId: info?.importedFile ?? null,
      origin: s.origin === 'user' ? 'user-authored' : 'imported assertion',
      ancestry: [],
    });
  }
  const content = (title: string, concept: string): Candidate => ({
    outcome: 'candidate',
    title,
    summary: concept,
    target: 'custom',
    experience: 'Unavailable in legacy contract',
    core: concept,
    example: 'Unavailable in legacy contract',
    contributions: [],
    interaction: 'Unavailable in legacy contract',
    references: [],
    unknowns: [
      'Not screened under current contract. Legacy technical success is not semantic approval.',
    ],
    nextQuestion: 'Review before developing.',
    preservedCore: '',
    delta: '',
    changedAssumption: '',
    test: '',
  });
  const add = (
    id: string,
    kind: Node['kind'],
    parents: Identity[],
    title: string,
    concept: string,
    at: number,
    kept: boolean,
    edited: { title: string; concept: string } | undefined,
  ) => {
    const original = content(title, concept);
    const n: Node = {
      id,
      garden: g.id,
      kind,
      parents,
      job: 'legacy:' + id,
      revisions: [
        {
          revision: 1,
          content: original,
          hash: hash(canonical(original)),
          origin: 'imported assertion',
          entry: { at, timezone: null, offset: null },
          assessment: null,
        },
      ],
      decisions: [
        {
          id: uuid(),
          revision: 1,
          state: kept ? 'kept' : 'new',
          reasons: [],
          note: legacy.reviews[id]?.note ?? '',
          at: legacy.reviews[id]?.changedAt ?? at,
          override: false,
        },
      ],
      accepted: kept,
      creditHeld: false,
      imported: true,
      references: [],
    };
    if (edited) {
      const c = content(edited.title, edited.concept);
      n.revisions.push({
        revision: 2,
        content: c,
        hash: hash(canonical(c)),
        origin: 'user-authored',
        entry: { at, timezone: null, offset: null },
        assessment: null,
      });
      n.decisions[0]!.revision = 2;
    }
    w.nodes.push(n);
    if (kind === 'candidate') w.consumed.push({ key: pairKey(parents), node: id });
  };
  for (const s of legacy.garden.sprouts) {
    const ps = s.parents.map((p) => ({
      garden: g.id,
      kind: 'source' as const,
      id: p.id,
      revision: p.revision,
    }));
    add(s.id, 'candidate', ps, s.output.title, s.output.concept, s.createdAt, s.kept, s.edited);
    const n = w.nodes.at(-1)!;
    n.recorded = s.backend === 'replay';
    const review = legacy.reviews[s.id];
    if (review) n.decisions[0]!.state = review.state;
  }
  // Legacy sources whose older original is unavailable still have exact retained
  // parent text. Preserve that as an imported revision, never invent missing text.
  for (const sprout of legacy.garden.sprouts)
    for (const p of sprout.parents) {
      const s = w.sources.find((s) => s.id === p.id);
      if (!s) throw new Error('Legacy parent source missing.');
      if (!s.revisions.some((r) => r.revision === p.revision)) {
        const r = revision(p.text, s.revisions[0]!.title, p.revision, sprout.createdAt, null);
        s.revisions.push(r);
        s.revisions.sort((a, b) => a.revision - b.revision);
      }
    }
  for (const n of legacy.garden.growth ?? []) {
    if (!n.output || !['accepted', 'proposed', 'rejected'].includes(n.status)) continue;
    const p = w.nodes.find((p) => p.id === n.parent.id);
    if (!p) throw new Error('Legacy growth parent unavailable.');
    const parentRevision = p.revisions.find(
      (r) => r.content.title === n.parent.title && r.content.core === n.parent.concept,
    )?.revision;
    if (!parentRevision) throw new Error('Contradictory known legacy growth revision.');
    add(
      n.id,
      'growth',
      [{ garden: g.id, kind: p.kind, id: p.id, revision: parentRevision }],
      n.output.title,
      n.output.concept,
      n.createdAt,
      n.status === 'accepted',
      n.edited,
    );
    if (n.status === 'rejected') w.nodes.at(-1)!.decisions[0]!.state = 'rejected';
  }
  validate(w);
  return w;
}
