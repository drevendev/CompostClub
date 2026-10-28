# Coherent Gardens RC acceptance — 25 October 2026

**Status: experimental local 0.2.0-rc.1; draft implementation review. The usefulness promotion gate is not passed.** The owner will evaluate future real cards. This does not waive the [specification §15](NEXT_RELEASE_SPEC.md) or mark R8 complete. Source implementation and deterministic diagnostics must be distinguished from observed model/human outcomes.

## Implementation trace

| Slice | Implemented surface and evidence                                                                                                                                           | Remaining release decision                                                                                                        |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| R0    | Browser late-load cancellation regression; honest disclosure of both browser model failures; prior browser recovery/sample and original contracts retained                 | No new browser-model quality claim                                                                                                |
| R1    | Schema-3 pure domain, exact revision tuples, prepared spans, source/reference/preferences provenance, SQLite single-writer migration and rollback                          | Owner validates own pre-upgrade copy before personal use                                                                          |
| R2    | Whole-file imports, duplicate preview, source reader/history, selected preparation/omissions, scoped aliases, editable references and approved DNA                         | Model proposals need human approval                                                                                               |
| R3    | Rich bounded generation, retained draft before checker, exact dispatch/schema metadata, shared repair cap, explicit negatives, failure evidence and human override         | Semantic checker remains fallible                                                                                                 |
| R4    | Per-garden interval/credit and one global compute owner; durable daily attempts/candidates/calls/backpressure; fair scheduling; pause/drain/release                        | Real long-term observation remains a separate pilot                                                                               |
| R5    | Accepted DAG, six growth directions, proposal holds, alternate branches, compare/edit/recheck/revise, exact previous-revision context, previewed cascade                   | Three accepted steps/two alternatives covered by labelled synthetic diagnostics; owner-accepted live growth demonstration pending |
| R6    | Four named gardens; receiver/donor permission; persistent 0/10/100 route; no p0 donor read, fallback or reroll; stage-time revocation and canonical cross pair             | Human usefulness of real cross-garden output pending                                                                              |
| R7    | Actual calm native UI, bundled licensed fonts/icon, complete readers and filtered drafts, keyboard/Escape, 430px/200%/reduced motion                                       | No decorative output substituted for model failures                                                                               |
| R8    | Frozen real local comparison retained all failures and drafts; actual stage Exit and next-launch checks; measured capacity; real-time tray observation recorded separately | **Not complete:** no owner scores, no promotion, no claim of an owner-accepted real candidate or live three-step growth           |
| R9    | Exact portable and recorded HTML, explicit reviewed source selection, manifest identities, rollback guide, Chromium and repository checks                                  | Local RC only; public release/deployment requires separate authorization                                                          |

Core code is in [pure domain](../src/domain/coherent/workspace.ts), [preparation](../src/domain/coherent/prepare.ts), [validation](../src/domain/coherent/validate.ts), [controller](../desktop/coherent-controller.ts), [SQLite store](../desktop/coherent-store.ts), [exports](../desktop/coherent-export.ts) and [native UI](../src/desktop/coherent-ui.tsx). These modules do not require model downloads to edit or validate source data.

## Deterministic and Chromium checks

The RC run passed 155 unit tests, 43 desktop/storage tests, 3 HTTP bridge/privacy tests and the reviewed-source packaging test. `npm run verify` includes type checking, lint, these tests and formatting. Dedicated regressions cover last-call malformed negatives, day-boundary repair refusal, primary-vs-repair errors, late/cancelled results, write aborts, two writers, no-refund restore, imported evidence, exact revision/reference history, p0 donor isolation, seeded waiting routes, quotas, cycles, growth alternatives and human override. Test doubles and accelerated clocks are explicitly diagnostic.

Actual Windows Electron Chromium acceptance migrates a fictional populated v2 workspace, preserves originals and participation, checks two named gardens, duplicate titles, persistent add drafts, source readers, Escape/focus, consent at 10%, 430px width, 200% zoom and reduced motion. Renderer checks observed zero outgoing HTTP(S) requests and zero page errors. The native harness uses automated consent only in an isolated fictional workspace; it supplies no owner quality scores. A public screenshot contains only newly authored fictional sources.

Final-package Exit tests use native process spawn and the authenticated local operator pipe, without UI automation or injected Electron hooks. The observed child PID equals the actual application PID. Idle Exit completed with code 0 in 214 ms; genuine generation/checking Exit used retained fictional model evidence and an installed Ollama/Gemma 3 4B, completing in 772 ms / 666 ms with the owned model process absent and dispatched calls retained. Reopening remains paused. These are individual observations, not a speed guarantee. Synthetic storage faults separately cover receipt/journal failure, recovery and blocked unsafe Exit.

The earlier 45-minute tray observation recorded three actual scheduled dispatches, spaced **901,368 ms and 903,510 ms**, with genuine generation/check calls. Two jobs were filtered `needs_revision`; one failed after generation and two checking calls. Pause during generation/checking released the owned process in 888 ms / 982 ms and preserved a separately running shared service. **The combined harness failed at its final idle Exit wait.** Its original receipt and error remain unchanged. A follow-up established that Windows Playwright's child PID differed from the actual Electron PID; a destroyed-WebContents error was also observed in that instrumented path. Final main-process callbacks now guard shutdown/destroyed contents, and final native operator tests observe the actual process directly. The earlier timing/pause evidence predates these additions and is not relabelled as a complete passing final-build long harness. Full R8 certification would require that combined run again; this RC remains experimental.

The final portable includes a direct operator client and an optional explicitly authorized 1–10 credit capacity (default three). Authentication, explicit consent, serialized commands and refusal to open native file dialogs are covered by the desktop suite. The actual native tests persist ten credits and mutual 10% donor settings across restart. See [operator access](OPERATOR.md).

A measured two-garden capacity fixture retained **400 distinct complete documents and 400 sources**, 1,930,165 workspace bytes: preparation 82 ms, validation 117 ms, pair selection 441 ms, SQLite save 283 ms and reopen 421 ms. Node RSS was approximately 174 MiB during this diagnostic. This small fictional workload is evidence for count handling, not a claim that all count and byte maxima fit together or that model inference has no resource cost.

Final browser suites, exact portable identity, real-time scheduler/resource observation and artifact verification are summarized in the [sanitized verification receipt](../evidence/coherent-rc-verification.json). Full raw workspaces and process observations stay local. Interrupted preliminary background runs are excluded from completed observations. No accelerated timer counts toward the real 15-minute gate.

## Frozen local comparison and negative outcome

The independently authored [public fixture](../fixtures/public/coherent-evaluation.json) fixes 12 compatible pairs (6 EN, 6 RU) and four incompatible/insufficient-context controls. Four compatible cases include short supplied primary-source facts for 2048, Baba Is You, Into the Breach and Return of the Obra Dinn, each attributed to its creator/developer in the fixture. No game assets or third-party code were copied. Reference descriptions are evidence inputs, not a claim that the model recalled them correctly.

The baseline is the existing `splice-1` short contract with original source texts and at most one format repair. The new frozen `coherent-2` pipeline adds complete prepared source/objective/reference context, rich candidate and checker. Different preparation and call costs are disclosed; the comparison does not isolate a single causal variable. Both used the explicitly installed local Gemma 3 4B on the same fixed cases, with isolated sufficient allowances and no owner-running-profile changes.

The completed comparison made **40 genuine calls: 17 baseline + 23 new**. The new pipeline produced **0 screened/displayable candidates out of 16 cases**. Among compatible cases, four ended `needs_revision`, one `needs_context` after a retained draft, six returned a terminal negative and one failed after three calls. Controls returned one preflight context refusal and three terminal negatives. Every filtered/failed case remains in the local review file; the checker cannot improve the denominator by hiding them. No Keep/Develop/Reject scores or reference-attribution judgments have been invented.

Baseline stage latency: median 9,930 ms, p95/max 15,216 ms. The new pipeline's exact dispatch, stage/job timings, observed provider tokens and raw transport remain in the private evidence; aggregates are in the sanitized receipt. These rich-contract observations supersede any inference about speed from the old short-output model smoke test.

Before this completed comparison, the harness failed after the first development case because of an out-of-scope reference variable. Its new-pipeline evidence was preserved; its baseline raw response had not been durably retained. That observed case `cg-en-01` was excluded and replaced by a genuinely different steam-elevator/counterweight case `cg-en-07`, not renamed as unseen. The harness now persists baseline transport immediately, before parsing, and refuses already-seen evaluation cases unless an explicit new repeat purpose is supplied. The completed set is now **seen**. No prompt was tuned against its outcomes; any subsequent tuning needs a newly fixed unseen set for renewed generalization claims.

All game/application/story profiles remain experimental. Owner review must include raw filtered drafts, contributions, interacting action/decision/consequence, language, reference support and false positive/negative screening. The promotion rule remains at least 4/12 compatible Keep or Develop with both languages represented, together with the reference/control/screening gates. An operationally correct RC can be trialled locally while this result remains negative; it is not a completed usefulness release.

## Reproduce without hidden services

```sh
npm run verify
npm run docs:check
npm run build
npm run package:single
npm run test:recovery
npm run test:p1
npm run test:sample
node scripts/pages-smoke.mjs
node --import tsx scripts/coherent-capacity.ts
npm run desktop:package
node --import tsx scripts/coherent-native.ts --package <portable-directory>
```

For genuine local evaluation, background and lifecycle harnesses, explicitly supply `COMPOST_TEST_EXE` and `COMPOST_TEST_MODELS` pointing to an already installed runtime/model. `coherent-lifecycle.ts` additionally requires `--fictional-backup <retained-fictional-evidence.json>`. `coherent-background.ts` uses real 15-minute intervals and keeps minute-by-minute process/resource observations locally. `coherent-evaluate.ts` performs real calls, labels repeats and does not generate human scores. Do not run these against owner data or publish their private profiles, paths, pack hashes or raw receipts.

The [RC guide](COHERENT_GARDENS_RC.md) describes migration, rollback, budgets, filtered drafts, exports and recovery. The source archive uses [an explicit reviewed allowlist](../scripts/source-files.json). Release identities are generated after the final selected sources, preventing a receipt from pretending to describe later changes. The portable contains Electron/application assets and licences, no inference runtime or weights. The standalone is explicitly **recorded**, independently verified and separately hashed.
