// Authored fictional diagnostics. Never live-model evaluation evidence.
import { addSource, create, stage } from '../src/domain/coherent/workspace';
import { canonical, hash } from '../src/domain/coherent/hash';
import { key } from '../src/domain/coherent/prepare';
import type { Candidate, Job } from '../src/domain/coherent/types';
export const NOW = Date.UTC(2026, 9, 25, 8);
export function fixture(now = NOW) {
  const w = create(now, 'Europe/Nicosia'),
    g = w.gardens[0]!;
  g.profile = 'game';
  g.credits.balance = 3;
  addSource(
    w,
    g.id,
    'Tide tiles',
    'A fictional game: rotate tide gates to route boats; opening one floods another route.',
    true,
    now,
  );
  addSource(
    w,
    g.id,
    'Signal debts',
    'A fictional game: borrow signal tokens now, then repay by blocking a later turn.',
    true,
    now,
  );
  return w;
}
export function candidate(j: Job): Candidate {
  return {
    outcome: 'candidate',
    title: 'Tide debts',
    summary: 'Route boats with gates funded by future signal closures.',
    target: 'game',
    experience: 'Tactical planning with visible future costs.',
    core: 'Spend a signal to open a gate, then close one gate next turn to repay it.',
    example:
      'Open the east gate to save a boat; next turn choose which gate closes and reroute the other boat.',
    contributions: j.parents.map((p) => ({
      parent: key(p),
      text:
        p.kind === 'source'
          ? 'The selected source action constrains routing.'
          : 'Preserve the accepted routing core.',
      evidence: j.pack.evidence
        .filter((e) => e.parent && key(e.parent) === key(p))
        .map((e) => e.id)
        .slice(0, 1),
    })),
    interaction: 'Borrowing changes which gate can remain open.',
    references: [],
    unknowns: ['Whether the closure creates interesting decisions is untested.'],
    nextQuestion: 'Can two boats be routed while paying one debt?',
    preservedCore: j.operation === 'growth' ? 'Gate routing with delayed debt.' : '',
    delta: j.operation === 'growth' ? 'Add one forecast token.' : '',
    changedAssumption: '',
    test:
      j.direction === 'propose a small test'
        ? 'Sketch three turns on paper; this has not been performed.'
        : '',
  };
}
export function assess(j: Job, decision: 'pass' | 'needs_revision' | 'needs_context' = 'pass') {
  return {
    decision,
    findings:
      decision === 'pass'
        ? []
        : [
            {
              field: 'core',
              issue: 'The interaction is not explained.',
              evidence: [j.pack.evidence[0]!.id],
              missing: 'A consequence for the choice.',
            },
          ],
    limitations: 'DIAGNOSTIC ONLY; fallible structural scenario, not a quality judgment.',
    revisionHash: hash(canonical(j.draft)),
    contextHash: j.pack.hash,
    model: 'diagnostic-only',
    at: NOW,
    raw: 'DIAGNOSTIC ONLY',
    observed: false,
  };
}
export function retain(j: Job) {
  j.draft = candidate(j);
  stage(j, 'draft retained', NOW);
  j.assessment = assess(j);
}
