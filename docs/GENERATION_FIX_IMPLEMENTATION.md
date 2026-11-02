# Generation and UX · local RC 2

Implements [the fix contract](GENERATION_UX_FIX_SPEC.md). Technical acceptance and owner usefulness are separate. Publication is not authorized; usefulness/R8 stays open.

**Final status: review candidate, not accepted as ready.** [Complete outcome table and open gate](GENERATION_FIX_ACCEPTANCE.md): 40 comparison calls, one RU card in variant 1 and three EN cards in variant 2, no new RU card in the final generator. The owner's installed application and background settings were not replaced/resumed.

## Admission and provenance

The domain prepares the entire job before saving it or starting the owned runtime. Context remains 4096. No tokenizer/model/runtime is downloaded. The matching installed tokenizer is unavailable: `utf8-byte-upper-bound` is a conservative text-token bound for Gemma's byte-fallback vocabulary, never an observed count. The separate 512-token reserve bounds ordinary Gemma role/start/end framing. JSON schema is a grammar constraint, not an additional prompt message. Per-dispatch prompt/schema/version, bounds, real provider counts, completion reason, errors and duration remain in the private receipts.

`job-admission-2` reserves generation, checking, both outputs and the exact bounded repair instruction in either stage. One repair is shared across the job: at most three calls. Two remaining calls permit the normal pipeline without optional repair; one cannot authorize generation. A model-negative result needs no checker. Technical admission refusal is `admission:`, distinct from model `needs_context` and format failure. It spends no call, attempt, pair or slot and starts no runtime. A blocked plan retains its route and condition fingerprint; polling does not reroll or heat the model.

`context-tuple-2` replaces repeated parent identities with reversible `pN` aliases while retaining every selected evidence text, status, objective and approved preference. Targeted revisions send the selected previous-draft fields and user question; redundant provenance/omission metadata stays in the full saved pack. `screening-tuple-1` replaces field names with its documented order and omits constant candidate outcome. All creative text, contributions, interaction, example, constraints and reference claims remain. Full original responses, expanded candidate, original spans, fingerprints and omission manifest remain available. The aggregate serialized tuple byte limit is declared before generation in prompt/schema comment and enforced by the domain validator. A schema-only pass does not satisfy that contract. Every domain-valid admitted draft fits the checker, repair and output reserve. Original `coherent-2` / `coherent-3` jobs keep their versions and are not retroactively declared checked under the new contract.

## Commands and lifecycle

UI, tray and authenticated operator pipe use one controller. The toolbar's two primary commands are «Пауза / Продолжить» and «Эврика». Schedule membership is a garden checkbox. Resume preserves membership, intervals, credits, limits and consent, and moves due times at least one interval ahead. It cannot clear persistence/evidence/resource-release blockers. Startup and wake stay paused.

Pause invalidates the epoch, aborts HTTP and releases only this instance's owned process tree. Stage timeout is 180 seconds, job timeout 540 seconds, stop timeout 20 seconds. Unconfirmed release stays visible, blocks dispatch and is never labelled paused. Stage and release timing are retained; missing historical measurements remain unknown.

`eureka` authorizes one normal immediate two-stage job for the supplied garden while preserving pause and membership. A saved seeded route is independent of the one-off trigger. Exact manual pairs remain `run`. Normal global budgets, credits and queue limits apply. Only real first dispatch changes that garden's next due time; other gardens retain their queue. A busy owner has no hidden queue.

Request ID binds the entire immutable command and garden. Identical repeats return stored state; different content conflicts. Pending renderer IDs survive reload. Lost responses trigger lookup, never a fresh automatic ID. Startup marks unfinished requests uncertain without refunding dispatches or resuming work. Restore preserves call debt and request tombstones, including requests whose jobs are absent from an older snapshot. Card, pair and credit commit remain one SQLite transaction.

`check` explicitly assesses a saved exact draft. Current preparation must reproduce its exact evidence, objective and profile under current source participation and donor consent. New source text cannot substitute an old revision. A fresh dated assessment and real call are added while original responses/errors remain. Already committed pairs target their existing card; no duplicate card/pair/slot spend. Missing evidence requires an explicit new attempt. Human override remains a marked separate decision and never counts as technical success.

## Interface and evidence

The toolbar names both selected garden and actual active garden/stage. Disabled reasons, local-time schedules, understandable empty states, editable source preparation, review and recovery explanations are visible. Raw errors/JSON and detailed accounting live in disclosures. The journal reports attempts, retained drafts, dispatched checks, assessment results and new cards for the stated contract/scope. Historical/imported cards and human decisions stay separate.

Controls retain native semantics, bundled fonts and the garden mark. Styles cover pointer/pressed/disabled/error/focus, selects, checkboxes, disclosures, usable scrollbars, forced colors and reduced motion. Exact native 430px and 200% text acceptance is required.

Ten fictional cases were frozen before the first contract edit: four compatible RU, four EN, two controls. Compatibility is an expected rubric, never a prescribed model answer. After observation they are development regressions. At most two variants, one initial generation per case/variant, three calls/job and sixty comparison calls total. The first variant spent 19 calls: one RU pass, no EN pass, two filtered controls, one truncated checker and all failures retained. Variant 2 improves operational-rule instructions and bounds checker verbosity while preserving every semantic criterion; its results must be reported without suppressing failures. An initial sandbox infrastructure start made zero dispatches; a guarded infrastructure retry verifies zero saved calls and retains that evidence. This is not a repeated model answer.

Native/operator acceptance has a separate declared allowance and isolated profiles. It must not consume personal budgets or manufacture human decisions. Exact package/source identity, command results, final comparison counts and remaining gates are recorded with the delivery. No model assessment is an owner usefulness approval.

Before replacing an installed build, preserve a consistent verified SQLite backup and previous portable. Compare original content/IDs/revisions, full files, card links, notes, decisions and charges before/after. Never mix SQLite/WAL files across versions. Old executable uses its own compatible verified copy. Keep newer data available during rollback; no silent loss of new results.
