import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { fixture, NOW, candidate, retain, assess } from '../../../tests/coherent-fixtures';
import { bytes, canonical, hash } from './hash';
import { current, identity, key, pairKey, prepare, validPack, safeUrl } from './prepare';
import { parseDraft, parseAssessment } from './contract';
import {
  active,
  addSource,
  balance,
  commit,
  counts,
  credit,
  date,
  decide,
  deletionPreview,
  dispatch,
  due,
  editNode,
  editSource,
  fail,
  finish,
  makeGarden,
  pause,
  plan,
  prepareJob,
  recover,
  selection,
  stage,
  wait,
} from './workspace';
import { validate } from './validate';
import { migrate } from './migrate';
import { createWorkspace } from '../experiment';
import { recordedPersonal } from '../../../tests/garden-fixtures';
import type { Identity } from './types';

describe('coherent gardens · synthetic diagnostics, no inference claims', () => {
  it('an explicit ten-credit operator preset persists without changing the default cap or refunding calls', () => {
    const w = fixture(),
      g = w.gardens[0]!;
    expect(balance(g, NOW + 100 * 900000)).toBe(3);
    g.credits = { balance: 10, cap: 10, at: NOW };
    expect(balance(g, NOW + 100 * 900000)).toBe(10);
    g.credits.balance = 8;
    expect(balance(g, NOW + 900000)).toBe(9);
    expect(balance(g, NOW - 900000)).toBe(8);
    validate(w);
    g.credits.cap = 11;
    expect(() => validate(w)).toThrow('credits');
  });
  it('p0 selection does not inspect donor profiles or originals, including compatibility metadata', () => {
    const w = fixture(),
      g = w.gardens[0]!,
      d = makeGarden('Unselected donor', 'game', NOW);
    w.gardens.push(d);
    addSource(w, d.id, 'Private donor', 'Fictional donor assertion.', true, NOW);
    Object.defineProperty(w.sources[2]!, 'revisions', {
      get() {
        throw new Error('Donor content was read');
      },
    });
    expect(selection(w, plan(w, g.id, 123)).length).toBe(2);
  });
  it('manual work does not draw an automatic cross route or overwrite a frozen plan through DNA', () => {
    const w = fixture(),
      g = w.gardens[0]!;
    g.policy.probability = 100;
    const frozen = plan(w, g.id, 123, false);
    expect(frozen.route).toBe('cross');
    const j = prepareJob(w, g.id, 'dna', NOW, { parents: [identity(w.sources[0]!)] });
    expect(g.plan?.id).toBe(frozen.id);
    finish(w, j, 'screened', NOW);
    expect(() => prepareJob(w, g.id, 'blend', NOW)).toThrow('frozen');
    g.plan = null;
    expect(plan(w, g.id, 123, true).route).toBe('local');
  });
  it('a selected note change does not retarget an exact accepted growth parent', () => {
    const w = fixture(),
      g = w.gardens[0]!,
      j = prepareJob(w, g.id, 'blend', NOW);
    retain(j);
    const n = commit(w, j.id, NOW);
    decide(w, n.id, 'kept', 'Original note.', [], NOW);
    const parent = { garden: g.id, kind: 'candidate' as const, id: n.id, revision: 1 };
    const p = prepare(w, g.id, [parent]);
    decide(w, n.id, 'kept', 'Another note, not selected as a preference.', [], NOW);
    expect(validPack(w, p)).toBe(true);
  });
  it('human review preserves an accepted-despite-screening disclosure', () => {
    const w = fixture(),
      g = w.gardens[0]!,
      j = prepareJob(w, g.id, 'blend', NOW);
    retain(j);
    finish(w, j, 'needs_revision', NOW);
    const n = commit(w, j.id, NOW, true);
    decide(w, n.id, 'kept', 'My actual note.', [], NOW);
    expect(n.decisions.at(-1)!.override).toBe(true);
  });
  it('retained document text cannot contradict the original UTF-8 bytes even with a valid byte hash', () => {
    const w = fixture();
    w.documents.push({
      id: 'doc',
      name: 'fiction.txt',
      text: 'Altered claim.',
      bytesBase64: Buffer.from('Original bytes.').toString('base64'),
      hash: hash('Original bytes.'),
      decoding: 'UTF-8',
      entry: { at: NOW, timezone: 'UTC', offset: 0 },
    });
    expect(() => validate(w)).toThrow('contradicts');
  });
  it.each(['', 'abc', 'Жук 🌱', 'x'.repeat(10000)])('uses real SHA-256: %s', (s) =>
    expect(hash(s)).toBe(createHash('sha256').update(s).digest('hex')),
  );
  it('canonical tuples are unambiguous for hostile imported IDs and reverse routes', () => {
    const p: Identity = { garden: 'g,[]', kind: 'source', id: 'x], ["z"', revision: 1 },
      q = { ...p, id: 'x', garden: 'g,[]z' };
    expect(key(p)).not.toBe(key(q));
    expect(pairKey([p, q])).toBe(pairKey([q, p]));
    expect(canonical({ b: 1, a: 2 })).toBe(canonical({ a: 2, b: 1 }));
  });
  it('preserves Markdown originals and duplicate titles; normalizes only the pack', () => {
    const w = fixture(),
      g = w.gardens[0]!;
    addSource(w, g.id, 'Same', '## A\n[Genre%20label](../missing.md) and **gates**.', true, NOW);
    addSource(w, g.id, 'Same', 'Distinct source with the same title.', true, NOW);
    const s = w.sources[2]!,
      pack = prepare(w, g.id, [identity(s)]);
    expect(current(s).text).toContain('**gates**');
    expect(pack.payload).toContain('Genre label');
    expect(pack.payload).not.toContain('**gates**');
    expect(current(s).links).toEqual(['../missing.md']);
    expect(w.sources).toHaveLength(4);
  });
  it('refuses essential-context loss instead of truncating long originals', () => {
    const w = fixture(),
      g = w.gardens[0]!;
    addSource(w, g.id, 'Long', 'First complete section.\n\n' + 'z'.repeat(9000), true, NOW);
    const s = w.sources[2]!;
    expect(() => prepare(w, g.id, [identity(s)])).toThrow('admission:');
    current(s).preparation.selected = ['s0'];
    expect(() => prepare(w, g.id, [identity(s)])).toThrow('essential');
    current(s).preparation.essential = ['s0'];
    expect(prepare(w, g.id, [identity(s)]).omissions[0]!.spans).toEqual(['s1']);
    expect(current(s).text.length).toBeGreaterThan(9000);
  });
  it('scopes aliases, preserves spellings and invalidates prepared requests', () => {
    const w = fixture(),
      s = w.sources[0]!,
      g = w.gardens[0]!,
      p = prepare(w, g.id, [identity(s)]);
    current(s).preparation.aliases.push({
      id: 'alias',
      original: 'tide',
      meaning: 'a genre label, not a named world',
      span: 's0',
      approved: true,
      essential: false,
    });
    expect(validPack(w, p)).toBe(false);
    const next = prepare(w, g.id, [identity(s)]);
    expect(next.payload).toContain('genre label');
    expect(current(s).text).toContain('tide');
    expect(prepare(w, g.id, [identity(w.sources[1]!)]).payload).not.toContain('genre label');
  });
  it('blocks unresolved essential terminology and plain reference titles', () => {
    const w = fixture(),
      s = w.sources[0]!,
      g = w.gardens[0]!;
    current(s).preparation.aliases.push({
      id: 'alias',
      original: 'tide',
      meaning: 'unknown',
      span: 's0',
      approved: false,
      essential: true,
    });
    expect(() => prepare(w, g.id, [identity(s)])).toThrow('essential term');
    current(s).preparation.aliases = [];
    w.references.push({
      id: 'ref',
      revision: 1,
      garden: g.id,
      name: 'A title with no mechanics',
      url: 'https://example.com/',
      fileId: null,
      property: '',
      differ: '',
      status: 'uninspected link',
      essential: true,
      removed: false,
      source: null,
      spans: [],
    });
    current(s).preparation.references = ['ref'];
    expect(() => prepare(w, g.id, [identity(s)])).toThrow('not been inspected');
    w.references[0]!.essential = false;
    expect(prepare(w, g.id, [identity(s)]).payload).toContain('no facts supplied');
  });
  it.each([
    'javascript:alert(1)',
    'file:///C:/x',
    'data:text/html,x',
    'https://name:pass@example.com/',
    'compost://run',
  ])('blocks unsafe external reference %s', (url) => expect(() => safeUrl(url)).toThrow());
  it('accepts only approved scoped preferences; notes are excluded by default', () => {
    const w = fixture(),
      g = w.gardens[0]!;
    w.preferences.push({
      id: 'p',
      revision: 1,
      garden: g.id,
      text: 'Use consequential choices.',
      approved: false,
      enabled: true,
      reviews: ['diagnostic-review'],
      origin: 'user-authored',
    });
    expect(prepare(w, g.id, [identity(w.sources[0]!)]).payload).not.toContain('consequential');
    w.preferences[0]!.approved = true;
    const p = prepare(w, g.id, [identity(w.sources[0]!)]);
    expect(p.payload).toContain('consequential');
    w.preferences[0]!.revision++;
    expect(validPack(w, p)).toBe(false);
  });
  it.each([0, 1])('preflight with %s available calls spends no attempt or credit', (calls) => {
    const w = fixture(),
      g = w.gardens[0]!;
    w.settings.calls = Math.max(1, calls);
    if (calls === 0)
      w.calls.push({ id: 'old', job: 'legacy', date: date(w, NOW), at: NOW, stage: 'legacy' });
    expect(() => prepareJob(w, g.id, 'blend', NOW)).toThrow('Waiting for 2');
    expect(w.jobs).toHaveLength(0);
    expect(counts(w, NOW).attempts).toBe(0);
    expect(credit(w, g.id, NOW)).toBe(3);
  });
  it('two calls reserve no repair; holds are exclusive and durable charge precedes transport', () => {
    const w = fixture(),
      g = w.gardens[0]!;
    w.settings.calls = 2;
    const j = prepareJob(w, g.id, 'blend', NOW);
    expect(j.heldCalls).toBe(2);
    expect(w.calls).toHaveLength(0);
    expect(() => prepareJob(w, g.id, 'blend', NOW)).toThrow('owns');
    dispatch(w, j.id, 'generating', NOW);
    expect(counts(w, NOW)).toMatchObject({ attempts: 1, candidates: 0, calls: 1, held: 1 });
    expect(w.paused).toBe(true);
    expect(j.manualPermit).toBe(true);
  });
  it('commits candidate, pair and receiver credit once; rejection refunds nothing', () => {
    const w = fixture(),
      g = w.gardens[0]!,
      j = prepareJob(w, g.id, 'blend', NOW);
    dispatch(w, j.id, 'generating', NOW);
    retain(j);
    dispatch(w, j.id, 'screening', NOW + 1);
    const n = commit(w, j.id, NOW + 2);
    expect(w.consumed).toHaveLength(1);
    expect(g.credits.balance).toBe(2);
    expect(j.creditHeld).toBe(false);
    expect(j.heldCalls).toBe(0);
    expect(counts(w, NOW).candidates).toBe(1);
    expect(() => commit(w, j.id, NOW + 3)).toThrow();
    decide(w, n.id, 'rejected', 'Original\nreason.', [], NOW + 3);
    expect(g.credits.balance).toBe(2);
    expect(w.calls).toHaveLength(2);
    validate(w);
  });
  it.each(['no_blend', 'needs_context'] as const)(
    'terminal %s stops before checking, releases holds and retains explanation',
    (outcome) => {
      const w = fixture(),
        g = w.gardens[0]!,
        j = prepareJob(w, g.id, 'blend', NOW);
      dispatch(w, j.id, 'generating', NOW);
      j.draft = parseDraft(
        JSON.stringify({
          outcome,
          reason: 'Essential mechanism unavailable.',
          missing: ['A decision.'],
        }),
        j,
      );
      finish(w, j, outcome === 'no_blend' ? 'negative' : 'needs_context', NOW);
      expect(w.calls).toHaveLength(1);
      expect(w.nodes).toHaveLength(0);
      expect(credit(w, g.id, NOW)).toBe(3);
      expect(w.failures).toBe(0);
      expect(selection(w, plan(w, g.id, 2))).toHaveLength(0);
    },
  );
  it('malformed negative cannot carry a candidate or be sanitized', () => {
    const w = fixture(),
      j = prepareJob(w, w.gardens[0]!.id, 'blend', NOW);
    expect(() =>
      parseDraft(
        JSON.stringify({
          outcome: 'no_blend',
          reason: 'No.',
          missing: [],
          title: 'Hidden success',
        }),
        j,
      ),
    ).toThrow('fields');
  });
  it('one shared repair cap spans generator and checker', () => {
    const w = fixture(),
      j = prepareJob(w, w.gardens[0]!.id, 'blend', NOW);
    dispatch(w, j.id, 'generating', NOW);
    dispatch(w, j.id, 'generating', NOW + 1, true);
    retain(j);
    dispatch(w, j.id, 'screening', NOW + 2);
    expect(() => dispatch(w, j.id, 'screening', NOW + 3, true)).toThrow();
    expect(w.calls).toHaveLength(3);
  });
  it('rejects forged citations, parent contributions, oversized fields and schema excess', () => {
    const w = fixture(),
      j = prepareJob(w, w.gardens[0]!.id, 'blend', NOW),
      c = candidate(j);
    expect(parseDraft(JSON.stringify(c), j)).toEqual(c);
    c.contributions[0]!.evidence = ['not-selected'];
    expect(() => parseDraft(JSON.stringify(c), j)).toThrow('Citation');
    c.contributions = candidate(j).contributions;
    c.title = 'x'.repeat(81);
    expect(() => parseDraft(JSON.stringify(c), j)).toThrow('limit 80');
    expect(() => parseDraft('x'.repeat(8193), j)).toThrow('8 KiB');
  });
  it('assessment is bound to exact draft and evidence, never an unchecked model hash', () => {
    const w = fixture(),
      j = prepareJob(w, w.gardens[0]!.id, 'blend', NOW);
    j.draft = candidate(j);
    const a = parseAssessment(
      JSON.stringify({
        decision: 'needs_revision',
        findings: [
          {
            field: 'core',
            issue: 'Missing interaction.',
            evidence: ['e0'],
            missing: 'A consequence.',
          },
        ],
        limitations: 'Fallible model aid.',
      }),
      j,
      NOW,
    );
    expect(a.contextHash).toBe(j.pack.hash);
    j.assessment = a;
    validate(w);
    j.assessment.revisionHash = 'forged';
    expect(() => validate(w)).toThrow('assessment');
  });
  it('filtered draft retains evidence and costs; explicit override spends the slot', () => {
    const w = fixture(),
      g = w.gardens[0]!,
      j = prepareJob(w, g.id, 'blend', NOW);
    dispatch(w, j.id, 'generating', NOW);
    retain(j);
    j.assessment = assess(j, 'needs_revision');
    finish(w, j, 'needs_revision', NOW);
    expect(credit(w, g.id, NOW)).toBe(3);
    const n = commit(w, j.id, NOW + 1, true);
    expect(n.decisions[0]!.override).toBe(true);
    expect(n.accepted).toBe(true);
    expect(g.credits.balance).toBe(2);
    expect(n.revisions[0]!.assessment?.decision).toBe('needs_revision');
    validate(w);
  });
  it('human edits preserve originals, stale screening and do not spend a slot', () => {
    const w = fixture(),
      g = w.gardens[0]!,
      j = prepareJob(w, g.id, 'blend', NOW);
    retain(j);
    const n = commit(w, j.id, NOW);
    const before = g.credits.balance;
    editNode(w, n.id, { ...n.revisions[0]!.content, core: 'Human wording.' }, NOW + 1);
    expect(n.revisions).toHaveLength(2);
    expect(n.revisions[0]!.assessment).not.toBeNull();
    expect(n.revisions[1]!.assessment).toBeNull();
    expect(g.credits.balance).toBe(before);
    validate(w);
  });
  it.each(['source', 'pause', 'preference'] as const)(
    'revocation %s between stages prevents later dispatch and retains spent usage',
    (change) => {
      const w = fixture(),
        g = w.gardens[0]!,
        j = prepareJob(w, g.id, 'blend', NOW);
      dispatch(w, j.id, 'generating', NOW);
      retain(j);
      if (change === 'source')
        editSource(w, w.sources[0]!.id, 'Changed', 'Changed gate rule.', NOW);
      else if (change === 'pause') pause(w, NOW);
      else {
        w.preferences.push({
          id: 'p',
          revision: 1,
          garden: g.id,
          text: 'New approved rule.',
          approved: true,
          enabled: true,
          reviews: [],
          origin: 'user-authored',
        });
        g.profileRevision++;
      }
      expect(() => dispatch(w, j.id, 'screening', NOW + 1)).toThrow();
      expect(w.calls).toHaveLength(1);
      expect(w.nodes).toHaveLength(0);
    },
  );
  it('an unrelated source edit and display rename do not invalidate selected context', () => {
    const w = fixture(),
      g = w.gardens[0]!,
      j = prepareJob(w, g.id, 'blend', NOW);
    addSource(w, g.id, 'Unrelated', 'Unrelated fictional third idea.', true, NOW);
    editSource(w, w.sources[2]!.id, 'Unrelated revised', 'Still unrelated.', NOW);
    g.name = 'Renamed';
    expect(validPack(w, j.pack)).toBe(true);
  });
  it('date rollover refuses the next stage and never borrows tomorrow capacity', () => {
    const now = Date.UTC(2026, 9, 25, 21, 59, 59),
      w = fixture(now),
      g = w.gardens[0]!,
      j = prepareJob(w, g.id, 'blend', now);
    dispatch(w, j.id, 'generating', now);
    retain(j);
    expect(() => dispatch(w, j.id, 'screening', now + 2000)).toThrow('date changed');
    finish(w, j, 'interrupted', now + 2000);
    expect(w.calls[0]!.date).not.toBe(date(w, now + 2000));
    expect(j.heldCalls).toBe(0);
  });
  it('DST and rollback keep local-date and credit accounting conservative', () => {
    const w = fixture();
    expect(date(w, Date.UTC(2026, 9, 25, 0, 30))).toBe(date(w, Date.UTC(2026, 9, 25, 1, 30)));
    w.lastObservedAt = NOW + 60000;
    expect(wait(w, w.gardens[0]!.id, NOW, true)).toContain('backwards');
    expect(balance(w.gardens[0]!, NOW - 900000)).toBe(3);
  });
  it('crash recovery retains drafts/calls, clears holds and never reruns a stage', () => {
    const w = fixture(),
      j = prepareJob(w, w.gardens[0]!.id, 'blend', NOW);
    dispatch(w, j.id, 'generating', NOW);
    retain(j);
    stage(j, 'screening', NOW);
    recover(w, NOW + 5000);
    expect(j.stage).toBe('interrupted');
    expect(j.draft).not.toBeNull();
    expect(j.heldCalls).toBe(0);
    expect(w.calls).toHaveLength(1);
    expect(w.paused).toBe(true);
    expect(w.jobs.some(active)).toBe(false);
  });
  it('three failed jobs pause; valid negatives do not create operational failures', () => {
    const w = fixture(),
      g = w.gardens[0]!;
    for (let i = 0; i < 3; i++) {
      const j = prepareJob(w, g.id, 'blend', NOW, { parents: w.sources.map(identity) });
      dispatch(w, j.id, 'generating', NOW);
      fail(w, j, 'Malformed diagnostic response', NOW);
    }
    expect(w.failures).toBe(3);
    expect(w.attention).toContain('Three');
  });
  it('fair queue uses oldest due, then last served; never UI selection', () => {
    const w = fixture(),
      a = w.gardens[0]!,
      b = makeGarden('Games', 'game', NOW);
    w.gardens.push(b);
    a.background = b.background = true;
    a.nextAt = b.nextAt = NOW;
    a.lastServed = 20;
    b.lastServed = 10;
    expect(due(w, NOW).map((g) => g.id)).toEqual([b.id, a.id]);
    recover(w, NOW + 3600000);
    expect(due(w, NOW + 3600000)).toHaveLength(0);
  });
  it.each([0, 10, 100])(
    'exchange %s%% persists one draw and never changes reverse-pair identity',
    (p) => {
      const w = fixture(),
        g = w.gardens[0]!,
        d = makeGarden('Donor', 'game', NOW);
      w.gardens.push(d);
      addSource(w, d.id, 'Forecast', 'A fictional game: forecast next gate failure.', true, NOW);
      d.policy.donate = true;
      g.policy.donors = [d.id];
      g.policy.probability = p;
      const route = plan(w, g.id, 12345),
        again = plan(w, g.id, 99999);
      expect(again.id).toBe(route.id);
      const ps = selection(w, route);
      expect(ps).toHaveLength(2);
      expect(ps.filter((s) => s.garden !== g.id).length).toBe(route.route === 'cross' ? 1 : 0);
      if (p === 0) expect(route.route).toBe('local');
      if (p === 100) expect(route.route).toBe('cross');
      expect(pairKey(ps)).toBe(pairKey(ps.slice().reverse()));
    },
  );
  it('p0 never reads donor source content, and blocked cross route does not fall back', () => {
    const w = fixture(),
      g = w.gardens[0]!,
      d = makeGarden('Donor', 'game', NOW);
    w.gardens.push(d);
    g.policy.probability = 100;
    const p = plan(w, g.id, 4);
    expect(selection(w, p)).toEqual([]);
    expect(plan(w, g.id, 999).id).toBe(p.id);
    expect(p.route).toBe('cross');
    expect(w.calls).toHaveLength(0);
    g.plan = null;
    g.policy.probability = 0;
    const q = plan(w, g.id, 4);
    expect(selection(w, q).every((p) => p.garden === g.id)).toBe(true);
  });
  it('donor revocation invalidates a cross job between generation and screening', () => {
    const w = fixture(),
      g = w.gardens[0]!,
      d = makeGarden('Donor', 'game', NOW);
    w.gardens.push(d);
    addSource(w, d.id, 'Donor action', 'A fictional game: close forecast gates.', true, NOW);
    d.policy.donate = true;
    g.policy.donors = [d.id];
    g.policy.probability = 100;
    const j = prepareJob(w, g.id, 'blend', NOW, {
      parents: [identity(w.sources[0]!), identity(w.sources[2]!)],
    });
    dispatch(w, j.id, 'generating', NOW);
    retain(j);
    d.policy.donate = false;
    d.policy.revision++;
    expect(() => dispatch(w, j.id, 'screening', NOW + 1)).toThrow();
  });
  it('growth holds a credit until human acceptance, rejects release it and alternatives remain', () => {
    const w = fixture(),
      g = w.gardens[0]!,
      root = identity(w.sources[0]!);
    for (let i = 0; i < 2; i++) {
      const j = prepareJob(w, g.id, 'growth', NOW, {
        parents: [root],
        direction: 'explore an alternative',
      });
      retain(j);
      const n = commit(w, j.id, NOW);
      expect(n.creditHeld).toBe(true);
      expect(credit(w, g.id, NOW)).toBe(g.credits.balance - 1);
      decide(w, n.id, i ? 'kept' : 'rejected', 'Exact original review.', [], NOW);
      expect(n.creditHeld).toBe(false);
    }
    expect(w.nodes).toHaveLength(2);
    expect(w.nodes[0]!.accepted).toBe(false);
    expect(w.nodes[1]!.accepted).toBe(true);
    expect(g.credits.balance).toBe(2);
    expect(counts(w, NOW).candidates).toBe(2);
    validate(w);
  });
  it('growth outline supports three accepted steps and two alternatives without overwriting parents', () => {
    const w = fixture(),
      g = w.gardens[0]!;
    let parent = identity(w.sources[0]!);
    for (let i = 0; i < 3; i++) {
      g.credits.balance = 3;
      const j = prepareJob(w, g.id, 'growth', NOW, {
        parents: [parent],
        direction: 'clarify core action',
      });
      retain(j);
      const n = commit(w, j.id, NOW);
      decide(w, n.id, 'kept', '', [], NOW);
      parent = { garden: g.id, kind: 'growth', id: n.id, revision: 1 };
    }
    for (let i = 0; i < 2; i++) {
      g.credits.balance = 3;
      const j = prepareJob(w, g.id, 'growth', NOW, {
        parents: [parent],
        direction: 'explore an alternative',
      });
      retain(j);
      const n = commit(w, j.id, NOW);
      decide(w, n.id, 'rejected', 'Alternative retained.', [], NOW);
    }
    expect(w.nodes).toHaveLength(5);
    expect(w.nodes[0]!.revisions).toHaveLength(1);
    validate(w);
  });
  it('cascade preview includes descendants and preserves unrelated work', () => {
    const w = fixture(),
      g = w.gardens[0]!,
      j = prepareJob(w, g.id, 'blend', NOW);
    retain(j);
    const n = commit(w, j.id, NOW);
    const p = deletionPreview(w, null, w.sources[0]!.id);
    expect(p.nodes).toContain(n.id);
    expect(p.sources).toHaveLength(1);
    expect(p.retained).toContain('backups');
  });
  it('rejects cycles, orphan revisions and forged pair indexes before mutation', () => {
    const w = fixture(),
      g = w.gardens[0]!,
      j = prepareJob(w, g.id, 'blend', NOW);
    retain(j);
    const n = commit(w, j.id, NOW);
    const original = structuredClone(w);
    n.parents[0]!.revision = 99;
    expect(() => validate(w)).toThrow('Orphan');
    const pair = structuredClone(original);
    pair.consumed = [];
    expect(() => validate(pair)).toThrow('consumed-pair');
    const cycle = structuredClone(original);
    cycle.nodes[0]!.parents = [{ garden: g.id, kind: 'candidate', id: n.id, revision: 1 }];
    expect(() => validate(cycle)).toThrow('cycle');
  });
  it('migrates v2 without accelerating settings, altering source IDs, or claiming screening', () => {
    const legacy = createWorkspace(NOW);
    legacy.garden = recordedPersonal(NOW);
    for (const s of legacy.garden.scraps)
      legacy.sources[s.id] = {
        title: 'Fictional source',
        tags: [],
        origin: 'diagnostic fixture',
        participating: true,
      };
    legacy.settings.dailyCalls = 6;
    legacy.settings.intervalMinutes = 120;
    const next = migrate(legacy, NOW);
    expect(next.schemaVersion).toBe(3);
    expect(next.settings.calls).toBe(6);
    expect(next.gardens[0]!.interval).toBe(120);
    expect(next.gardens[0]!.policy.probability).toBe(0);
    expect(next.sources.map((s) => s.id)).toEqual(legacy.garden.scraps.map((s) => s.id));
    expect(next.nodes.every((n) => n.revisions.every((r) => r.assessment === null))).toBe(true);
    expect(next.legacy).toEqual(legacy);
    validate(next);
  });
  it('capacity accepts two 200-source gardens and 400 distinct retained originals within byte quotas', () => {
    const w = fixture(),
      g = w.gardens[0]!,
      d = makeGarden('Second', 'custom', NOW);
    w.gardens.push(d);
    w.sources = [];
    for (let i = 0; i < 400; i++) {
      const gid = i < 200 ? g.id : d.id;
      const id = addSource(w, gid, 'Fiction ' + i, 'Complete fictional original ' + i, false, NOW);
      const s = w.sources.find((s) => s.id === id)!;
      w.documents.push({
        id: 'doc' + i,
        name: 'fiction-' + i + '.txt',
        text: current(s).text,
        bytesBase64: Buffer.from(current(s).text).toString('base64'),
        hash: hash(current(s).text),
        decoding: 'UTF-8',
        entry: { at: NOW, timezone: 'UTC', offset: 0 },
      });
      s.fileId = 'doc' + i;
    }
    validate(w);
    expect(w.documents.length).toBeGreaterThan(200);
    expect(() => addSource(w, g.id, 'Overflow', 'No silent pruning.', false, NOW)).toThrow(
      'capacity',
    );
    expect(bytes(JSON.stringify(w))).toBeLessThan(32 * 1024 * 1024);
  });
});
