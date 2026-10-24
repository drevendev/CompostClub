# Idea DNA, Evolution Lab & Growth Tree — current local-stack specification

**Priority update, 23 October 2026:** the [local desktop experiment](LOCAL_EXPERIMENT_SCOPE.md) and its [ordered tasks](LOCAL_EXPERIMENT_TASKS.md) come first. This document remains the later DNA/GA feature design. Its manual-only/background and IndexedDB statements describe the earlier target; explicitly enabled desktop experiments follow the new scope, and future evolution must reconcile storage with its accepted versioned adapter. The initial manual Tend workflow is already delivered; full DNA/GA and richer tree work remain unimplemented.

**Earlier state, 21 October 2026:** prepared, NOT implemented as a complete package. The owner requested Idea DNA, real micro-genetic evolution and incremental idea growth in the CURRENT React/TypeScript + IndexedDB + local Gemma/Ollama setup. **Server, multi-garden migration and cloud sync are NOT prerequisites.** Implementation epic: https://github.com/drevendev/CompostClub/issues/60

## 1. Existing foundations
Current garden domain provides source scraps, revisions, two-parent immutable snapshots, saved sprouts, retryable inference attempts, 15-minute credits and backups. See src/domain/garden.ts, src/inference/contract.ts, src/application/storage.ts. Existing single personal + sample garden scope remains intact; use the current source history and model evidence without rewriting it.

Dependencies: #47 correct unambiguous imported source IDs, #54 validate/restore versioned schema, #51 Idea DNA, #50 Growth Tree, #52 Evolution Lab, #53 birth metadata. All are detailed acceptance Issues; this document binds them to one coherent implementation contract.

## 2. Meaning of Idea DNA
Idea DNA has two distinct layers:

A. **Ancestry**: immutable root idea identifier, author/supplied origin or unknown, original text and revision, source snapshots, parent references, exact model/prompt/response identity, human edits, and relation type (blend, crossover, mutation, tend, manual). A child can have two parents: underlying ancestry is a directed acyclic graph (DAG), even if drawn as a tree in the UI.

B. **Semantic genes**: controlled short slots: mechanism, setting, goal/audience, constraint, twist. Each contains short value, type, user-approved status, source pointer (source idea ID + revision + gene ID) and whether inherited, manually created, suggested by local model or mutated. Unknown genes are allowed and never auto-filled with invented claims.

An original thought entered by a user is a root with no parents. A successful initial blend has two parents. A later expansion has one parent. A GA offspring has two parents, a specifically documented operator/seed, and optionally a mutation event. A user correction makes a new revision or child rather than silently changing earlier output.

Historical v0.1 ideas without gene annotations remain valid roots. Optional owner approval is required for model-proposed gene extraction. Numeric ancestry percentages must be computed from an explicit count of actually inherited accepted gene slots and labelled as such; do NOT infer how much of the creative concept truly came from each ancestor.

Never make personal birth time, weather, location or mood part of inherited genetic traits: these are context, not genotype.

## 3. Real tiny genetic algorithm — steady-state, not random prompt roulette

Population: 4–8 user-selected ideas/candidates, 2 minimum to start. Only confirmed semantic genes can be recombined. User can manually mark genes; no local model install required to inspect ancestry or rate candidates. For low-friction onboarding, a separate user-triggered **Decode DNA** button can make one short local Gemma classification call to propose 2–4 typed genes for owner approval, never silently on save (#51); if the model fails, one or two manual gene chips still allow the GA. Automatic tags on add and batch tagging remain a later option (#55).

Selection: seeded tournament selection (size 2) preferring user-rated or explicitly kept candidates, with bounded deterministic exploration of unrated/diverse candidates. Fitness is user feedback: Keep/Discard and optional 1–5 usefulness, novelty, would-build ratings. Unrated means unknown, not zero. A simple deterministic allele-overlap diversity heuristic is allowed but is NOT a measured quality score.

Crossover: uniform gene-slot recombination, at least one inherited accepted gene from EACH parent. Each child carries actual source gene pointers. If parents lack compatible approved genes, display an honest manual annotation requirement or offer the existing normal blend; never silently invent genes.

Mutation: initial 20% probability per candidate, configurable (0–100%). Mutate MAXIMUM ONE gene via seeded replacement from allowed gene pool or one separately prompted local-model suggestion. A mutation is labelled as newly proposed, not inherited from either parent, unless it is an explicit gene-pool swap with its actual source pointer. The parent is never overwritten.

Phenotype: ONE bounded local Gemma call generates a short 1–2 sentence human-readable idea from the fixed preselected child genotype, under a NEW versioned output contract. One repair allowed with raw evidence if validation fails. The model cannot silently change genealogy. One candidate per explicit user click; do not run large populations of many model calls.

Steady-state survivor loop: after user rating/Keep, preserve the top accepted elite across iterations, compare candidates via explicit rating with deterministic diversity tie-breaker, and replace only the weakest non-elite in the active pool. Keep bounded historical lineage even when a candidate leaves active population, subject to backup limits. This yields actual parent selection, crossover, mutation, evaluation and repeated descent: a real evolutionary search.

All randomness is seeded, persisted and replayable in pure domain code. Repeated click/reload cannot change selected parents or mutation for one pending request. Prompt text still may vary between model runs; do not promise bit-for-bit deterministic language generation. Fitness never comes solely from the LLM.

Credits: one existing 15-minute credit for successfully committed new model-produced offspring. Errors, cancellation and no_blend keep the credit; manual tag/fitness edits are free. No background inference while app closed.

## 4. Tend and grow an idea into a tree

Extend the existing #50 feature, now promoted to Now/P1. An accepted sprout gets a small "Tend this idea" action. Direction choices: clarify mechanism; add a constraint; explore one alternative; answer one open question; propose a one-day experiment.

A single model call receives one accepted parent snapshot, bounded direction and optionally a few selected approved genes, and returns ONE short, separately reviewable continuation. Proposed child is distinct from original. User can Accept, Edit then accept, Reject or branch elsewhere. Accepting makes a new immutable child with exact lineage and model evidence; rejecting does not overwrite or destroy ancestors.

An idea may become more detailed by repeated small deliberate steps, not by a one-shot novel/game generator. A tree-like outline view first, with keyboard and 390px mobile support. Actual data is a DAG where blends have two parents. Stage labels Seed/Sprout/Sapling/Tree reflect human-accepted development milestones, not age, model confidence or marketplace validation.

Use the SAME existing 15-minute credit for a successfully committed model-generated growth child in the first implementation. Manual human editing remains free. Future separate growth currency needs evidence and a new decision, not a sneaky gamification expansion.

## 5. Metadata at idea birth

Automatic and cheap, no server: entry UTC timestamp, timezone offset and IANA timezone when available, derived local date/week day/month and daypart (night 00:00–04:59, morning 05:00–11:59, afternoon 12:00–16:59, evening 17:00–23:59). The language of a text can be en/ru/mixed/other/unknown; do not use browser locale as proof. Manual edit or a modest heuristic is allowed. Source type self/heard/observed/imported/generated/unknown is user-supplied or unknown; original conception date is separate optional user input, not the app entry date.

Do not retroactively guess timezone, original idea conception time, weather or location for legacy input. Preserve source revisions and timestamps through edits. Optional AI tags #55: one explicit locally run tiny Gemma classification, 1–5 suggested tags and up to 3 gene proposals, every suggestion reviewed by owner; OFF by default and manual editing always works. The existing Gemma 1B output failures mean no quality promise until actually tested.

Optional private insights #56: local weekday/daypart/month/language/tag and keep/discard counts with honest denominators and missing values, no telemetry. Weather, coarse location and mood are future optional contextual snapshots #57 and NEVER become genetic genes automatically.

## 6. Versioning and privacy

New DNA, tree nodes and GA score/operator records require deliberate v1->v2 migration or explicitly versioned additive schema with rollback; see #54. Retain original v0.1 source backups, failed model transcripts and sample fixture labels. Reject invalid IDs, cycles, orphaned parents, tampered model evidence, oversized backups and stale writes before replacement. Pair key delimiter ambiguity #47 must be solved ahead of extending identity. Preserve existing deletion/recovery privacy #39 and share-safe export #40.

Current data stays per browser IndexedDB origin or locally run Ollama; no accounts, cloud generation, paid backend, hidden third-party tags or forced upgrades. Exact source/provenance is private unless user explicitly exports; if generating a shareable card, omit raw hidden model transcript, full private ancestor text, GPS and weather by default.

Current storage constraints are 2 MiB validated backup and bounded inference history; implementation may propose safe revised caps after measurement, never silently truncate an idea tree. No automatic full-archive ingestion or copying private ideas to public fixtures.

## 7. Delivery plan for Codex (reviewable slices)

1. **Data integrity**: #47 pair-key fix + #54 migration contracts, unit/IndexedDB tests, old Sample Garden and standalone smoke.
2. **Roots and birth context**: #51 Idea DNA and #53 entry tags/time/lang, minimal editing UI. No required model.
3. **Grow one branch**: #50 small local-model direction prompt, user review, branching outline, preservation of ancestor snapshots.
4. **Actual micro-GA**: #52 tournament/crossover/mutation/elitism in pure TypeScript, a single bounded model call per child, optional user ratings and reproducible history.
5. **Extras**: #55 model tags, #56 stats, #57 weather/location. These do not block core delivery.
6. Named Gardens #42 and Cross-Pollination #43/#44 re-use the tested graph later; no platform rewrite upfront.

## 8. Acceptance demo to record

Create four public-safe fictional seeds. Manually assign 2–4 accepted genes each. Give at least two seeds distinct user ratings. Run two explicit GA steps with seeded selection; inspect parent gene contributions and one labelled mutation (when operator triggers). Keep an elite, Tend that sprout twice into two alternative branches, inspect the original parents, close/reload, export/restore and compare genealogy/genotypes/scores. Cancel one real inference and ensure credits and ancestors survive.

Run pure selection-pressure and mutation boundary tests (0%, 100%, seeded reproducibility) plus graph cycle/orphan/revision and migration tests. Validate real Gemma outputs on NEW safe holdout; distinguish schema success from human-rated conceptual usefulness. Verify UTF-8 RU/EN and Nicosia DST daypart. Test actual Chromium on desktop + 390px, offline recorded Sample and rollback. Record exact code SHA and evidence; don't re-use old splice-2 structural metrics as evidence for new evolve/tend prompts.

**Done means:** on the EXISTING local app, with no new infrastructure, the owner can inspect an idea's genuine DNA, deliberately breed/mutate a child under meaningful selection pressure, grow and branch a kept idea, and retain all ancestry after export/import.
