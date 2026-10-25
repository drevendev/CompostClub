# Roadmap — 24 October 2026

The next full local release is **v0.2 — Coherent Gardens**: source context and references, comprehensible candidates with visible screening, useful human feedback, deliberate growth, configurable background work and independent named gardens with opt-in cross-pollination.

**Authoritative proposal:** [release specification](NEXT_RELEASE_SPEC.md) and [ordered implementation/backlog plan](NEXT_RELEASE_TASKS.md). These documents describe planned behavior, not shipped functionality. Canonical tracker remains [#29](https://github.com/drevendev/CompostClub/issues/29); the retained evolution epic is [#60](https://github.com/drevendev/CompostClub/issues/60). This roadmap update contains no application implementation or private case material.

## Current baseline and what it proves

Reviewed main: `2afeb18de9f8c72e9938ca9eb973ed2e43e622de`, with a Windows desktop candidate using Electron, the pure TypeScript domain, transactional SQLite, an explicitly selected installed local Ollama/model, tray/pause, bounded background scheduling, review, backups and an atomic folder mirror for Codex. [Desktop guide](LOCAL_DESKTOP_RUNNING.md), [as-built decisions](LOCAL_DESKTOP_ADR.md), [initial experiment scope](LOCAL_EXPERIMENT_SCOPE.md) and [historical implementation tasks](LOCAL_EXPERIMENT_TASKS.md).

The owner has begun private use. Early observations identify input-context, reference-attribution and conceptual-coherence gaps; private texts, reviews and receipts remain outside Git. The 7–14 day observation is not declared completed. Passing the output schema or saving a candidate is not a usefulness result, and neither public historical recordings nor private formative cases are an unseen evaluation of the next prompts.

Existing browser/personal/sample behavior remains supported. Sample Garden and the standalone HTML replay only exact public fixtures and stay visibly recorded. The published [DEV article](https://dev.to/drevendev/let-your-wild-ideas-ferment-a-quiet-garden-powered-by-local-gemma-1c0o) and [English Echo Cartography movie](https://drevendev.github.io/CompostClub/?v=07c202852017) are historical launch artifacts; Pages hosts the movie, not the interactive application. No new contest entry or hosting work follows from this roadmap.

Local interface refinements may exist outside main; they require a separate implementation review and are not smuggled into this documentation PR. Optional operator Sentry remains off/removable and excludes content. Render and Entire remain declined.

## 1. Integrity before expanding stored work — R0/R1

Audit existing fixes before rewriting them: [#67](https://github.com/drevendev/CompostClub/issues/67) explicit packaging, [#68](https://github.com/drevendev/CompostClub/issues/68) pair/result reconciliation, [#69](https://github.com/drevendev/CompostClub/issues/69) ancestry/revisions, [#22](https://github.com/drevendev/CompostClub/issues/22) imported provenance and [#70](https://github.com/drevendev/CompostClub/issues/70) edited branch exports have relevant code in current main but remain open pending evidence/closure review. [#33](https://github.com/drevendev/CompostClub/issues/33) cancellation before GPU acquisition and [#16](https://github.com/drevendev/CompostClub/issues/16) experimental browser disclosure still need focused work. Do not claim the full issue closed just because one related function exists.

Then [#54](https://github.com/drevendev/CompostClub/issues/54) defines desktop schema/backup 3, explicit browser-v1/desktop-v2 import, rollback, structured identities and bounded cross-garden DAG/assessment records. Preserve originals, known revisions, prior decisions, calls and exact recording labels. Historical technical success stays labelled unscreened under the new contract. Existing #39/#40/#47 protections remain mandatory.

## 2. A comprehensible candidate — R2/R3, #20

The central release gate is [actual two-parent synthesis #20](https://github.com/drevendev/CompostClub/issues/20), with source-backed [DNA #51](https://github.com/drevendev/CompostClub/issues/51) and truthful [entry context #53](https://github.com/drevendev/CompostClub/issues/53).

- Preserve full input documents, expose selected context and omissions, clean inference text without destroying originals, and never merge distinct ideas by title alone.
- Preserve ambiguous genre labels, transliterations and proper names without inventing facts; approve corrections/aliases explicitly and scope them to source/garden.
- Add reference records to original ideas and results: what a reference actually supplies, what should differ, where the statement comes from and what is still uninspected. Saving a link does not browse it.
- Store a rich typed concept: player/user/reader role, mechanism/workflow/conflict, one concrete decision/example, both-source contributions and open questions. Keep list previews compact.
- Generate one draft and perform one bounded separate local screening call. At most one shared format repair; no hidden semantic rewrite loop. A model checker is fallible and needs evidence.
- Preserve the primary validation cause when repair cannot run ([#72](https://github.com/drevendev/CompostClub/issues/72)); terminal negatives skip screening, and a one-call remainder cannot start a two-stage job.
- Retain failed/filtered drafts and raw responses. Show structural validity, screening and the owner's Keep/Reject as different decisions. Failed/negative/cancelled work keeps the slot; dispatched calls remain counted.

Manual facets and selected local reference material work offline. Optional one-source Decode DNA is reviewable; automatic bulk tagging [#55](https://github.com/drevendev/CompostClub/issues/55) is not a prerequisite. Basic file reuse from [#45](https://github.com/drevendev/CompostClub/issues/45) is included; repository/service adapters are deferred.

## 3. Rhythm, feedback and deliberate growth — R4/R5

Make interval, attempted jobs, shown candidates, pending review and model-call budgets visible. New-install profile: **15-minute attempts, up to 8 candidates/day, 12 attempts/day, 24 total model calls/day and 5 pending reviews**. Existing installations keep their chosen settings and start paused; switching profiles is previewed. Extra assessment/repair/growth/DNA calls share the budget. Frequency never promises a useful idea at every tick.

Keep original rejection notes; optionally turn selected notes into user-approved versioned preferences for later jobs. Saving feedback alone is not model training. No hidden use of every comment in every prompt.

Complete [#50](https://github.com/drevendev/CompostClub/issues/50) with chosen-language, direction-specific growth, a readable outline, alternatives and comparison. Each accepted node preserves its parent and original model proposal; tests are proposals until performed. Manual growth is independent of turning background scheduling on. Automatic tree growth and unreviewed self-feeding remain off/outside v0.2.

## 4. Named gardens and controlled exchange — R6

Promote [#42](https://github.com/drevendev/CompostClub/issues/42) and its safety dependency [#44](https://github.com/drevendev/CompostClub/issues/44) into this release after schema/context foundations; then implement [#43](https://github.com/drevendev/CompostClub/issues/43). A full population GA is not a prerequisite for independent gardens.

Games/Projects/Books and custom names are empty local spaces with stable IDs. Credits and due state are per garden; one model owner and daily compute budget are shared. Source IDs, decisions and histories survive rename/switching. The public sample is never a donor.

Exchange is off by default. Receiver and donor both opt in. On confirmation, a **10%** setting means one persisted probability draw per new automatic attempt: one receiver source plus one allowed donor source when cross mode is selected. Manual pairs explicitly choose their route. No refresh/retry reroll or silent local fallback; an unavailable drawn route waits with an explicit one-off override. Source and permission changes are rechecked between stages. Results belong to the receiver; originals remain in place, and retained donor snapshots have explicit export/deletion rules.

This supersedes the older click-only and optional-fallback descriptions; exact state/accounting rules are in [spec §11](NEXT_RELEASE_SPEC.md#11-named-gardens-and-10-cross-pollination).

## 5. A complete local product and a measured release — R7/R8/R9

Ship a coherent working-screen treatment under [#48](https://github.com/drevendev/CompostClub/issues/48): garden icon, local licensed typography, compact expandable source/result cards, recent tags, reference and review views, visible waiting reasons and accessible growth outlines. Preserve keyboard, 200% text, reduced motion and narrow layouts. Butterflies/pointer physics [#49](https://github.com/drevendev/CompostClub/issues/49) follow the core; decoration never signals an unsaved result.

Freeze new development and unseen evaluation sets before tuning. The minimum game gate uses 12 unseen compatible pairs (six RU/six EN) plus four negative controls. A human reviews **all drafts**, including filtered cases. Require at least four Keep/Develop decisions across the 12, with both languages represented, reviewed source-supported reference assertions, and reported screening false positives/negatives. This is a bounded release decision, not an accuracy certification. Failure preserves the experimental status and blocks the usefulness claim; it does not justify fabricated examples or silent larger-model downloads.

Observe three real 15-minute scheduled dispatches with the window closed and genuine generation/check stages. Test pause in both stages, resource release, restart/wake, interruption, budgets, multi-garden migration/restore, 0/10/100 exchange and exact release artifacts. Run the required verify/build/standalone/Chromium/native checks and supply recorded HTML + SHA-256 and reviewed source archive identity. Document stage latency and resource measurements from the exact candidate. [#73](https://github.com/drevendev/CompostClub/issues/73) adds local pause/release/shutdown-preparation events; actual process exit is verified externally, with no fabricated historical timestamps.

Private pilot [#18](https://github.com/drevendev/CompostClub/issues/18) remains private and scoped. A real follow-up experiment [#27](https://github.com/drevendev/CompostClub/issues/27) requires an actual chosen paper/mock-up artifact/outcome; generation alone does not complete it. Application/story profiles remain experimental until their own evidence supports equivalent quality claims.

## 6. Subsequent milestone retained — genuine Evolution Lab

After the quality/graph gates, [#60](https://github.com/drevendev/CompostClub/issues/60)/[#52](https://github.com/drevendev/CompostClub/issues/52) delivers a human-selected 4–8 population, seeded tournament selection, approved-facet crossover, at most one labelled mutation, elite preservation, ratings and two generations of actual descent. The [earlier algorithm contract](IDEA_EVOLUTION_SPEC.md) remains binding, reusing v0.2 context, rich output, screening and accounting. A pairwise prompt or model self-score is not a genetic algorithm. This is explicit follow-up scope, not delivered by the new checker.

## 7. Optional and separate lanes

| Work                                                                                                                 | Disposition                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [#25](https://github.com/drevendev/CompostClub/issues/25), [#26](https://github.com/drevendev/CompostClub/issues/26) | Truthful repository entry and separately reviewed Actions maintenance; open Dependabot PRs are not auto-merged |
| [#55](https://github.com/drevendev/CompostClub/issues/55), [#56](https://github.com/drevendev/CompostClub/issues/56) | Broader tagging/insights later; basic manual facets and operational counters do not claim completion           |
| [#57](https://github.com/drevendev/CompostClub/issues/57)                                                            | Weather/location/mood deferred, separate explicit consent and provider decision                                |
| [#58](https://github.com/drevendev/CompostClub/issues/58), [#59](https://github.com/drevendev/CompostClub/issues/59) | Shared storage and physical mobile certification separate; responsive emulation does not establish sync        |
| [#15](https://github.com/drevendev/CompostClub/issues/15)                                                            | Interactive hosting remains an optional owner decision; preserve existing movie hosting                        |
| [#28](https://github.com/drevendev/CompostClub/issues/28)                                                            | Follow-up stories/media only after shipped evidence and separate exact-content publication approval            |

The [complete 32-issue reconciliation](NEXT_RELEASE_TASKS.md#3-reconcile-all-currently-open-issues) records what already appears in code, what v0.2 extends and what remains later. No new issue closure, runtime feature, benchmark, deployment or publication is implied by this plan. The owner-authorized PR publishes only these generic planning documents; personal material stays private.
