# v0.2 — Coherent Gardens: next full local release

Status: finalized planning contract, reviewed 24 October 2026; implementation and release acceptance remain pending. **No feature in this document is implemented by the planning PR.** Baseline reviewed: `2afeb18de9f8c72e9938ca9eb973ed2e43e622de`. [Roadmap](ROADMAP.md), [ordered delivery tasks](NEXT_RELEASE_TASKS.md), canonical tracker [#29](https://github.com/drevendev/CompostClub/issues/29).

Implementation status, 25 October 2026: [local experimental RC and remaining acceptance gates](COHERENT_GARDENS_ACCEPTANCE.md). This specification remains the promotion contract; a local RC does not mark owner usefulness or R8 complete.

## 1. Outcome, evidence and precedence

A person can keep separate local gardens, combine selected ideas into a comprehensible candidate, see its sources and limitations, explain why they reject it, and deliberately develop a promising idea into inspectable branches. Background work has visible frequency, output and compute limits. A valid JSON response is never presented as proof of a useful concept.

The first private desktop observation exposed these failure classes: thematic juxtaposition without a mechanism; missing user/player decisions; incorrect attribution of a proposed feature to a reference work; incomplete source excerpts; feedback that is stored but not used; ambiguous genre terms promoted into invented proper names; and a format failure obscured by an unavailable repair. Private titles, texts, reviews, repository addresses, receipts and screenshots are withheld. The observation is formative evidence, not a public benchmark or a completed long-use study. Reproduction and public acceptance use newly authored, labelled fictional material.

This contract resolves release order after the [desktop experiment](LOCAL_EXPERIMENT_SCOPE.md) and the earlier [evolution design](IDEA_EVOLUTION_SPEC.md). Within v0.2 it takes precedence over their older manual-only, short-output, single-garden and cross-pollination fallback rules. The desktop has opt-in background operation; the browser/recorded entry retains its existing explicit-action behavior. The public sample never becomes a private source or donor.

The release includes useful typed DNA/provenance, a growth outline and named gardens. Full population selection/crossover/mutation/elitism from [#52](https://github.com/drevendev/CompostClub/issues/52) remains a concrete subsequent milestone under [#60](https://github.com/drevendev/CompostClub/issues/60). Its algorithm is preserved, not renamed into ordinary blending or claimed delivered by adding a critic. Quality preparation is now a dependency of that milestone.

## 2. Scope and priority decisions

| In v0.2                    | Required result                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Context and references     | Complete originals, explicit evidence-backed source profiles, readable reference records and reproducible bounded prompt packs |
| Coherent candidates        | Type-specific concept fields, specific parent contributions, visible unknowns and separate format/screening/human decisions    |
| Local semantic screening   | One bounded generation/check pipeline with source-grounded findings and retained failed drafts                                 |
| Feedback                   | Original rejection notes plus separately approved, versioned preferences used by later selected jobs                           |
| Rhythm                     | Visible interval, attempts/candidates/calls per day, backlog, next action and exact waiting reason                             |
| Deliberate growth          | Kept seed or accepted node, chosen question/direction, alternatives, comparison and human acceptance                           |
| Named gardens and exchange | Stable independent gardens, explicitly opted-in probability including a 10% setting, exact cross-garden lineage                |
| Integrity and delivery     | Lossless migration, consistent backups, deletion previews, safe exports, responsive local UI and measured local evidence       |

Games receive the full first quality acceptance profile. Applications, books and custom ideas share the same schema and editor, with their own required concept fields; their automatic profiles remain labelled experimental until separately evaluated. A garden type is a user preference, not a claim inferred from its name.

Outside v0.2: automatic development of unaccepted candidates; a complete game/book generator; autonomous GA populations; bulk model annotation on save/import; vector databases; retraining; remote inference; automatic reference browsing; cross-user sharing; accounts/sync; hosting; weather/GPS; automatic GitHub/Obsidian/Drive ingestion; agents or social publishing. Optional Sentry remains off, metadata-only and removable. Render and Entire remain declined.

## 3. Primary journeys

1. **Prepare:** create a garden, add a source or select local files, preview duplicates and complete originals, optionally add type/mechanism/reference notes, and enable individual sources for pairing. This causes no inference.
2. **Understand:** start one manual attempt. Read the proposed concept, one concrete scenario, exact parent contributions, screening findings and missing information. Keep, edit, reject with a reason, or request a targeted revision.
3. **Leave running:** enable selected gardens, inspect the effective budget, close to tray, and return to candidates plus a summary of attempted, filtered, failed and waiting work. Decorative activity cannot imply successful inference.
4. **Grow:** select a kept candidate or accepted branch, choose a direction/question, compare the proposal with its parent, then accept, edit or reject it. Explore two alternatives without overwriting either parent.
5. **Exchange:** explicitly allow a donor and a receiver, set a probability such as 10%, and inspect one source from each garden in the resulting candidate. Neither original moves or becomes an editable copy in the receiving pile.
6. **Recover:** export a validated full backup, inspect a migration/restore preview, restore atomically and reopen with the same original texts, decisions, ancestry and honest evidence labels. All launches and wake recovery start paused.

## 4. Domain and data contract

React, inference adapters and storage adapters do not own domain rules. Use versioned pure TypeScript transitions and an authoritative desktop writer. Do not add a second scheduler or model owner in the renderer.

| Record               | Required identity and meaning                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace            | Schema version, workspace revision, garden order, installation-owned paths, global budgets, model configuration and retained evidence                                              |
| Garden               | Stable UUID, display name, type/profile revision, source membership, own credits, background/due state and exchange policy revision                                                |
| Source/document      | Stable source ID/revision, original text/bytes, optional retained document and section anchors, entry metadata, participation and attribution                                      |
| Source profile / DNA | Typed facets with field IDs, value or unknown, origin, approval state, source revision and supporting spans; ancestry is separate from semantic traits                             |
| Reference            | Stable ID/revision, user-supplied name, local document or supplied URL, relevant properties, provenance/status and permitted selection scope                                       |
| Job                  | Stable ID, operation, target garden, exact parent/profile/reference/preference snapshots, context-pack hash, selection plan/seed, prompt/schema/model identities and stage history |
| Candidate revision   | Original structured model draft, optional human revision, selected output type, screening tied to exact revision/context, display/review state and lineage                         |
| Assessment           | Structural result, source-grounded semantic findings, reviewer/model identity, limitations and original raw answer                                                                 |
| Decision             | Human Keep/Reject/Later, reasons, note, exact candidate revision, time and any explicit screening override                                                                         |
| Growth node          | Exact accepted parent revision, requested direction/question, proposed delta, raw evidence, decision and accepted child identity                                                   |

Parent identity is a structured tuple of garden, entity kind, entity ID and revision. Canonical serialization must be unambiguous for every supported imported ID. Names and array positions never establish identity. Changing a label, profile or reference does not rewrite historical request snapshots.

Record entry UTC time and available timezone/offset for new records. Preserve legacy `createdAt` as entry time, with unknown historical zone/language/original conception time. Locale is not proof of text language. No fabricated author, historical weather, DNA percentage, popularity or commercial validation. [#51](https://github.com/drevendev/CompostClub/issues/51), [#53](https://github.com/drevendev/CompostClub/issues/53).

Field origin is one of user-authored, imported assertion, deterministic extraction or local-model proposal. Approval is separate. A quoted source assertion is not an externally verified fact. An approved creative constraint is not automatically a measured property of a real product.

## 5. Source preparation and references

### 5.1 Preserve the original and fix the model representation

- Adding/importing does not silently summarize, truncate or run a model. A long idea remains one source with a retained document; splitting creates separately previewed source records only at the user's choice.
- Distinct ideas with the same title remain distinct. Exact text/document matches, stable external IDs and similar titles are different duplicate signals. Preview link/skip/new-copy choices; never merge by normalized title alone.
- Keep original bytes, decoding decisions, supplied filename and content hash. Strip Markdown syntax and URL encoding from the inference representation without changing the original. Preserve reference labels as text and retain link targets separately.
- Use complete, source-anchored sections/sentences. A truncated catalog summary is explicitly incomplete and cannot masquerade as the entire source. Broken links and unresolved relative paths appear as missing context.
- The source reader displays the complete original, model-selected fragments, omitted sections and reason for omission. Users can edit the selected context or mark a missing mechanism; this makes a new preparation revision, not a rewritten original.
- File paths, imported titles and text do not become executable instructions, output paths, HTML or arbitrary IPC. Render as text. Block archive/path/reparse escapes and files outside the explicit selection.

### 5.2 Minimal useful profile

Manual entry works offline with no model. Optional **Decode DNA** on a selected source makes one explicit bounded local call proposing 2–4 facets for Accept/Edit/Reject; failures leave manual editing available. This implements the narrow convenience slice of #51, not bulk/automatic #55.

Common facets: product type, intended audience/experience, mechanism or central action, goal, constraint and twist. Unknown is a valid value. Known inheritance points to a source facet/revision; proposed new traits are labelled proposed, not inherited. A profile need not be completely filled to use the source.

| Profile          | Minimum useful context and output questions                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Game             | Format/genre if known; player role; repeatable action; meaningful choice and consequence; goal/obstacle; desired experience |
| Application/tool | Intended user; concrete task/problem; triggering situation; input/action/result workflow; constraint; hypothesized benefit  |
| Book/story       | Genre/tone if supplied; protagonist; desire; opposition/conflict; stakes; story engine; relevant author/canon constraints   |
| Custom/unknown   | User's purpose, central action and constraints; no automatic game/app/book claim                                            |

For cross-type use, the receiver explicitly chooses the target profile. Borrow a relevant donor facet; do not treat donor product features as facts about the recipient. Unknown target type requires clarification before automatic generation, while manual custom-profile drafting remains available.

### 5.3 Reference records

A reference has a name, user-supplied URL or selected local file, relevant property/excerpt, source pointer and status: uninspected link, imported assertion, user-confirmed property or source-supported property. The UI asks **what to borrow** and **what should differ**. Proposed internal ideas use source ID/revision links; external works use reference IDs. A reference can attach to a source, candidate revision or growth node.

Saving a URL performs no network request. v0.2 uses user-selected local reference documents and manually supplied property notes. Direct online fetching/import adapters remain #45; the core runs offline. A plain link or remembered model claim is not read evidence. Referencing a work does not grant copying rights or ownership; store concise relevant material selected by the user, not an automatically scraped library.

Opening a supplied external reference requires an explicit click and narrow validated HTTP(S) navigation through the system browser. Reject executable/custom/file/data/javascript URL schemes and credentials in URLs. Local reference reading is limited to the selected retained document; a reference cannot grant arbitrary filesystem access or shell execution.

Reference availability is explicit. If an essential comparison depends on an uninspected reference, return `needs_context` rather than inventing its mechanics. Optional references may be omitted with a visible warning. Removing a reference blocks future use; previous job snapshots remain disclosed until deliberate cleanup.

### 5.4 Terminology without invented facts

Distinguish a supplied proper name from a genre/mechanic label, transliteration, typo or unresolved word. A title alone is not evidence that a named world, character or mechanic exists. Preserve original spelling; propose a source-linked alias/glossary entry with original span, intended meaning, approval and scope. Never silently correct the source, globally replace a term across gardens, or infer a permanent rule from one rejection. If the intended meaning changes the core mechanism, return `needs_context`; otherwise show the uncertainty and avoid unsupported claims. Approved aliases enter versioned context packs and invalidate undispatched packs when changed. Imported reference assertions remain assertions even after spelling approval.

### 5.5 Reproducible context packs

The model receives a bounded manifest containing selected source revisions/facets, complete supporting spans, selected reference properties, target profile, user objective and approved preferences. It does not receive the entire archive, raw database, unselected reviews or every ancestor.

Persist exact normalized payload, original-span mapping, omissions, evidence status, preparation version and hash before dispatch. Select spans deterministically from explicit fields/sections, with user override. A changed source, profile, selected reference or preference invalidates an undispatched pack. Historical packs stay immutable.

Start with the existing installed model's 4,096-token context capability. Reserve room for prompt framing and stage output before admitting data; use the matching installed tokenizer when available. If exact counting is unavailable, use a documented conservative UTF-8 byte upper bound, disclose limited context and refuse essential-context loss. Never claim a precise count from a heuristic or rely on silent provider truncation. No hidden tokenizer/model download. The implementation slice must prove its actual counting capability and record prompt-token observations; increasing model context requires measured memory/latency evidence.

## 6. Pair selection and a meaningful candidate

### 6.1 Selection

Retain deterministic seeds and unused-pair accounting. Prefer eligible sources matching the receiver's target profile and explicit objective; approved facets may provide a documented compatibility/diversity heuristic. Record the rule version and actual reason. Such a heuristic is not a quality score. Unknown facets are not automatic zero-quality labels.

Expose chosen parents and which facets are intended to interact. Permit an explicit exploratory pairing and manual selection. Do not run an extra model call to rank every pair, import an embedding database, or label hash-order selection as semantic matching. Prevent repeated exposure of an unchanged rejected pair unless the user requests a targeted revision/retry.

### 6.2 Rich result, compact presentation

Replace the two-sentence/420-character live-only contract with a versioned structured candidate. Keep old contracts and exact public recordings readable. New records include:

- Short title and summary for the list.
- Target type and explicit intended user/player/reader experience.
- One coherent mechanism/workflow/story engine.
- One concrete example of action, decision and consequence (or protagonist/conflict progression for a story).
- Contribution from each parent, tied to selected facets/spans, and an explanation of how they interact.
- Relevant references with the precise property used, differences and evidence status.
- Open questions, assumptions and a modest next question/test. A test is a proposal, never an observed result.

Do not require every field to be invented. Missing essential information is `needs_context`; no coherent combination is `no_blend`. A merely decorative theme swap must be identified rather than inflated into a new mechanism. Names of real works cannot replace an explanation of the design.

Initial bounded output contract: title at most 80 characters, summary 360, core explanation 700, concrete example 500, two parent-contribution fields 240 each, and at most three unknowns of 180 characters each. Enforce both field and total UTF-8 limits (8 KiB), plus provider output limits. These are upper bounds, not a request to fill every field. Start with at most 900 generated tokens and measure the actual requested-language result; truncation is a retained failure, not a successful short card.

List cards retain a four-line preview and full reader. Show **draft**, **screened candidate**, **needs context**, **human edited** and **kept** as separate meanings. The reader shows the complete candidate and reference/parent evidence without raw transcripts by default.

## 7. Bounded semantic screening

### 7.1 Two stages and their limits

Normal candidate attempt: one local generation, deterministic format/source checks, then one separate local semantic assessment. A structurally valid terminal `no_blend`, `no_growth` or `needs_context` response stops before screening, retains its explanation and releases unused screening/repair holds. Each terminal outcome has its own discriminated schema; negative output cannot also carry a displayable candidate. A malformed negative remains a format failure, never an automatically sanitized honest negative. At most **one format repair across both stages**, giving a hard limit of **three dispatched calls per attempt**. Screening requests have a bounded output cap of 480 tokens and 4 KiB raw structured content. No automatic semantic rewrite loop in v0.2; **Revise this draft** is an explicit new job with the same parents and a selected finding/question.

The screening call sees the exact candidate revision and its prepared evidence, not hidden chain-of-thought or the generator's claimed confidence. Return decision, specific findings, affected candidate field, supporting/contradicting context IDs and missing information. Validate all cited IDs/spans mechanically. Do not request or store hidden reasoning; retain the actual returned findings and raw response.

| Outcome                  | Behavior                                                                   |
| ------------------------ | -------------------------------------------------------------------------- |
| `pass`                   | Eligible to show as a screened candidate, still speculative and unaccepted |
| `needs_revision`         | Retain draft and concrete issue; explicit targeted revision available      |
| `needs_context`          | Identify absent/ambiguous essential context; ask the user to prepare it    |
| `no_blend` / `no_growth` | Honest negative outcome; retain explanation and originals                  |
| invalid/timeout/error    | Retain original bytes/error; no success, no canned replacement             |

Screen for recognizable parent contributions, interaction rather than juxtaposition, understandable action/choice/consequence, internal consistency, requested language, constraints and unsupported attribution to references. A second call using the same small model is a fallible screening aid, not independent truth, market validation or proof that an idea is fun. Facts require supplied evidence; absence of evidence remains unknown.

Deterministic checks cover identity, citations, allowed fields/lengths, control characters and explicit constraints that have a reliable predicate. Heuristics and model findings display their basis. Human preference, novelty and commercial potential never become fabricated objective scores.

### 7.2 Durable stages and accounting

Persist a job before any model call. Stage progression: prepared selection/context → generating → draft retained → screening → screened/needs-revision/needs-context/negative/failed/cancelled. Store every actual response before validation; replay or imported claims cannot impersonate a locally observed stage.

Recheck enabled state, source revisions, permissions, target garden and selected policy revisions before **each dispatch and final commit**. A late response after pause, edit or revocation is retained as stale/cancelled evidence and cannot become a successful new result. Editing an unselected source does not cancel unrelated work.

A successful blend atomically saves the screened candidate, exact lineage, consumed pair and spent receiver slot. A filtered draft, format error, cancellation, timeout or `no_blend` consumes no slot and no successful pair. Its actual dispatched calls remain spent, and its unchanged pair requires an explicit retry/revision. Human rejection of an already committed screened candidate does not refund its slot or model calls.

Reserve an exclusive job/credit allowance and the two required stage calls before work; hold one optional format-repair call if budget remains. With exactly two calls available, the UI discloses that repair is unavailable rather than silently borrowing tomorrow's budget. Charge each call durably immediately before dispatch. No other job can use a held allowance. Release unspent holds on completion/cancel/recovery, but never refund dispatched calls. If storage cannot preserve the response, use the existing emergency retention/export path and pause further work.

With only one call available, a new two-stage job waits before dispatch and spends neither attempt nor credit. Preserve the primary failure, stage and validation detail separately from a secondary repair refusal (call limit, date change, cancellation or storage attention). The journal and card must not replace an invalid-response cause with only a budget message. A valid negative and a budget wait do not increment the operational-failure streak; a dispatched malformed response that cannot be repaired counts as one failed job. Refused repair adds no charge or second failure. Show the earliest remaining wait reason and actual spent calls. [Focused diagnostic task #72](https://github.com/drevendev/CompostClub/issues/72).

An unfinished job recovered after crash/restart is interrupted, preserves evidence/usage and starts paused. It never silently reruns the generator, checker or repair. If a checker is interrupted after a draft was saved, the draft remains recoverable with an explicit **Check this draft** action.

### 7.3 Human authority and false negatives

Retain filtered drafts in a separate reviewable view with reasons and costs; do not count a filter refusal as a useful idea. A user can explicitly inspect and keep/commit a disputed draft with an **accepted despite screening** label. This uses the same validated atomic candidate/pair/slot transition, requires a still-valid context/credit, and preserves the original findings. No extra model call is implied.

A human edit creates a separate revision and makes assessment of the old text visibly stale for the new text. The user may keep their own edit with that disclosure or explicitly request a new check. Pure human editing does not spend a generation slot. Historical model text and human wording remain distinct in every export.

## 8. Feedback and preferences

Keep original notes exactly. Offer optional structured rejection reasons: unclear interaction, unclear action/choice, lost source, contradiction, wrong reference, duplicate, language or simply not interesting to me. Free text and unknown reason remain valid; no forced rubric.

The application may propose concise reusable preferences from selected reviews through one explicit local operation. The user Accepts/Edits/Rejects the proposed rules. Approved rules have stable IDs, scope (garden or workspace), version and source-review links; they appear in the next context preview and can be disabled. Notes are untrusted material, not executable instructions. Do not send all historical comments on every request, infer a permanent preference from one rejection, retrain weights or claim learning when only context rules changed.

Retrospective rechecking of historical drafts is user-triggered and recorded as a new assessment. Never overwrite an old decision or call a revised checker result an original observation.

## 9. Frequency, quantity and resource controls

The top-level rhythm panel shows **attempt every**, **up to candidates/day**, **attempts/day**, **unreviewed limit**, the shared **model calls/day**, enabled gardens and the next scheduled action/reason. Candidate count, kept count and call count are distinct. Labels state that an attempt may produce no candidate. A Settings-only interval selector is insufficient discoverability.

| Control            | New-install default          | Supported v0.2 bound                                                                |
| ------------------ | ---------------------------- | ----------------------------------------------------------------------------------- |
| Background         | Off                          | Explicit per-garden opt-in; global Pause always wins                                |
| Interval           | 15 minutes                   | 15 / 30 / 60 / 120 / 240 per enabled garden                                         |
| New candidates/day | 8 across workspace           | 1–48; count on durable displayable-candidate commit, including growth proposals     |
| New attempts/day   | 12 across workspace          | 1–48; charge at first dispatched stage of a new job, including filtered/failed jobs |
| Model calls/day    | 24 across workspace          | 1–96; all generation, screening, repairs, DNA/preferences and growth calls share it |
| Pending review     | 5 across workspace           | 1–20; new/later blend candidates and growth proposals count                         |
| Concurrency        | 1                            | One owned local inference across all gardens and operations                         |
| Credits            | One/15 min, cap 3 per garden | Existing calm accrual; explicit reservations prevent double spending                |
| Automatic growth   | Off                          | Manual in v0.2; no self-growing tree                                                |

Existing installations retain their selected interval, budgets, timezone, source participation and data, and start paused. Offer a previewed switch to the new 15-minute profile; never silently accelerate an existing experiment or replace six calls with twenty-four. Show the effective limit: at two calls normally, 24 calls allow at most 12 ordinary attempts, fewer with repairs/other operations. Eight useful or even displayable candidates are not guaranteed.

Use persisted per-garden next times and a fair deterministic queue across due enabled gardens (oldest due, stable round-robin tie break). UI garden selection does not retarget or schedule jobs. No backlog catch-up after sleep/offline/clock gaps. The next due time advances from the actual dispatch time, not the completion animation. A job that spans another garden's due time still owns the single request.

Daily accounting uses the persisted installation timezone/date and survives DST, clock rollback, restart and restore. A scheduled multi-stage job must finish within the date/budget under which its allowances were reserved; crossing the accounting date stops before the next dispatch and retains the draft for explicit continuation under the new date. Prevent reservations from carrying unused old-day capacity forward. Clearly distinguish waiting for interval, credits, calls, attempt/candidate limit, review, sources, context or model/storage attention.

Three consecutive **operationally failed jobs** pause for attention. Semantic `needs_revision`, `needs_context` and honest negatives are visible outcomes rather than transport failures, but attempt/call caps still stop endless poor generation. A single blocked selection does not monopolize other eligible gardens. Default stage timeout is 180 seconds, at most 540 seconds per three-call attempt; these are hard stops, not latency promises. Measure typical/p95 latency and resource cost on the actual supported machine.

Changing global compute/model settings pauses the workspace; changing a garden's selection/exchange policy pauses that garden and cancels affected work before later dispatch. Editing/renaming a display label has no scheduling effect. Pause releases the application's owned model process and never kills shared services. Tray close, Exit, restart and wake keep their existing explicit semantics.

### 9.1 Auditable pause and shutdown

Keep bounded local lifecycle events for pause/exit request, active-stage cancellation/drain, owned-runtime release confirmed/failed and shutdown prepared/failed, with session/job correlation, UTC times and measured elapsed time. These records contain no idea/prompt/output text or private filesystem paths and do not imply cloud telemetry. They follow full-evidence backup/export consent, not default reading exports.

Close-to-tray is not Exit. Persist shutdown preparation only after owned-process termination is confirmed, active jobs and pending publishing drain and emergency raw responses are safely retained. Failed release, persistence or export remains visible and retryable; it cannot silently exit or claim success. A full journal must not prevent aborting compute: record an evidence gap through the available recovery path and preserve the error for the user. A process cannot certify its own subsequent OS termination. Check actual exit externally in native acceptance; next-start recovery can classify a prepared shutdown or interruption without inventing an exit timestamp. The legacy final reason alone cannot establish exact exit time or release latency. [Focused lifecycle task #73](https://github.com/drevendev/CompostClub/issues/73).

## 10. Deliberate growth and a readable tree

Complete the remaining [#50](https://github.com/drevendev/CompostClub/issues/50) behavior using the existing Tend work rather than introducing a parallel generator. A kept candidate or accepted growth revision is eligible; an original source can become a deliberate human-selected development root without fabricating a generated sprout or consuming a blend pair.

Directions: clarify core action/loop; add one constraint; resolve one contradiction; answer a selected question; explore one alternative; propose one small test. Use the selected RU/EN language throughout. A one-day experiment field is required only for the test direction, not every continuation. Return a small delta, preserved core and any changed assumption; do not regenerate a complete design document on each step.

The proposal goes through the same bounded screening pipeline against the exact accepted parent, selected root evidence, references and direction. It remains a proposal until a human Accepts/Edits/Rejects. Reserve one receiver/garden credit while a displayable proposal awaits decision; spend it atomically with the accepted node and lineage, release it on rejection/cancel. The proposal already counts against daily candidate and pending-review limits; acceptance does not count it twice. Limit unresolved credit-holding proposals to three across the workspace, at most one per parent revision. A filtered/failed growth draft holds no credit.

Show a keyboard-accessible outline with seed → accepted steps and alternatives, exact parent revisions, compare-parent and compare-alternatives views. The underlying graph is a DAG; a two-parent blend is not converted into a fictional single ancestor. Old parents and original responses are immutable. Visual plant stages reflect human-accepted steps, never elapsed time or model confidence.

Manual growth can be requested while scheduled blending is disabled: an explicit request authorizes only that bounded job and never enables the scheduler. Global Pause/cancellation and shared budgets still apply; the UI explains this distinction. No automatic growth, auto-accept, auto-recompost or population evolution in v0.2. Future automatic development needs its own consent, depth/branch/compute limits and evidence; it is not hidden in a frequency control.

Implement manual authorization as a single-use job permit, separate from persistent background-enable state. A later Pause invalidates that permit and every undispatched stage; attention/storage failures must be resolved before issuing another. A manual click is never permission to resume scheduled work afterward.

## 11. Named gardens and 10% cross-pollination

Implement [#42](https://github.com/drevendev/CompostClub/issues/42), safety [#44](https://github.com/drevendev/CompostClub/issues/44), then policy [#43](https://github.com/drevendev/CompostClub/issues/43). Presets such as Games, Projects and Books set a label/profile only; no owner's repository or idea is preloaded. Custom names and duplicate display names are allowed within bounds. Rename/reorder never changes IDs. Switching preserves add/edit drafts and displays the actual job's target garden even if another garden is open.

Receiver policy: off by default (`p=0`), explicit donor allow-list, integer probability 0–100%, and policy revision. Donor permission is a separate explicit opt-in plus per-source participation. An enable dialog may suggest **10%**, which only becomes active after confirmation. Migrated gardens remain at 0/off. No sample/recorded donors, cross-user sharing or external repository access.

For each new **automatic** eligible selection, persist one seeded draw and route before selecting/sending text. `p=0` selects two receiver sources and performs no donor-content read; `p=100` selects one receiver and one allowed donor; `p=10` is a probability per attempt, not one success in every ten or a quality probability. Cross mode never selects two donor parents. Record seed, draw, policy revision, selected parents and intended borrowed facets. Manual pairing explicitly chooses its route and is labelled manual; it does not pretend to be a probability outcome.

If the drawn route has no eligible unused pair or essential context, retain a **waiting selection plan** with its reason. Do not silently fall back to local or reroll on refresh, retry or the next timer tick. Other gardens can proceed. The user can add context/sources, change policy (invalidating the plan), or explicitly cancel it and choose a one-off local pair; that override is recorded. This supersedes #43's historical silent/local-fallback option. A frozen plan uses no call or spent credit until work can start.

Revalidate donor/receiver consent, source participation/revisions, context and policy before every stage and commit. Revocation cancels affected pending work, including between generation and screening. Changing an unrelated garden does not cancel it. Existing results retain disclosed immutable snapshots; revocation is not retroactive erasure.

The candidate belongs to the receiving garden. The donor original remains in place. Consumed cross-pair identity is canonical across A/B order and receiving route so the same exact two revisions cannot be silently regenerated in the opposite garden; an explicit revision job links to the prior pair instead. The receiver pays the slot; compute is global. No automatic copying into the receiver pile or passive spread. Recomposting remains an explicit action creating a new labelled source with ancestry.

## 12. Migration, capacity and deletion

### 12.1 Version and rollback

Use a new desktop workspace/backup schema **3**; do not reinterpret the current version-2 desktop envelope as already containing named gardens or semantic assessments. Legacy browser garden v1 and desktop workspace v2 import through explicit converters. New desktop fields do not silently migrate browser IndexedDB or give the recorded HTML background behavior.

Migration is a single-writer transaction after a validated consistent pre-migration backup. Preserve original personal garden once as My Garden, stable source/result IDs, raw texts, revisions, attempts, calls, reviews, imported originals, pending/interrupted evidence, legacy growth, retained copies and export configuration. Do not split existing sources into inferred topic gardens or manufacture missing DNA/reference facts. Map old parent references explicitly. Preserve the original backup for rollback with the previous executable; do not promise old binaries can open schema 3.

Historical `success` means the old technical outcome, not new semantic screening. Legacy candidates show **not screened under current contract** without rerunning, replacing or hiding their original decisions. Previously kept work remains kept. New assessments of old work are explicit and separately dated. Restoring cannot refund calls, replace installation-owned model/export paths, auto-enable background jobs or donor permissions, or upgrade imported claims into locally verified evidence.

Reject cycles, orphan edges, contradictory known source revisions, missing consumed-pair/result relationships, forged assessment hashes and unsupported versions before mutation. Distinguish unavailable legacy history from contradictory known history. Invalid data stays recoverable; never repair provenance by generating a new model answer.

### 12.2 Supported initial bounds

| Resource                     | v0.2 target bound                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Named private gardens        | 4, including custom types; default personal garden counts, public sample does not                              |
| Active source records        | 200 per garden; 800 across workspace                                                                           |
| Structured current workspace | 32 MiB UTF-8, including retained originals/profile data; reject before write                                   |
| Retained selected files      | 1,000 across workspace, 1 MiB each, at most 20 per import batch; shared workspace byte cap still applies       |
| Candidate/growth/job history | 1,000 candidates, 1,000 growth nodes, 1,000 jobs across workspace; all phases count toward raw evidence limits |
| Raw receipts                 | Existing 3,000 records / 128 MiB, with pre-dispatch headroom for all remaining stages                          |
| Full private backup          | 192 MiB validated bytes; measure exact serialized result before replacement                                    |
| Retained backups             | Existing 64 / 256 MiB, with visible manual cleanup                                                             |
| Managed Codex snapshots      | Existing 1,000 / 256 MiB, with previewed cleanup                                                               |
| Ancestry depth               | 32 accepted edges; graph traversal also bounded by total nodes                                                 |

Counts and byte quotas both apply; maxima are not a promise that every maximum-sized object fits simultaneously. No hidden pruning or source truncation to meet a quota. Increasing file count from the current 200 is necessary to support multiple independently imported gardens; benchmark a fixture with two 200-source gardens and more than 200 distinct original documents. Browser/standalone retains its smaller explicit limits. A graph edge to an archived/retained snapshot does not make that source eligible for future inference.

Deletion previews active descendants, job/assessment links, imported originals, recovery copies, backups and managed exports. Removing a source/garden cannot silently destroy the only copy of unrelated work. Retained copies have explicit, separately confirmed purge actions; references in preserved snapshots do not become dangling active parents. No recursive operation against an unchecked path.

## 13. Exports, privacy and trust

Full private backup includes complete originals, evidence, preparations, preferences, graphs and model/human decisions with versioned validation. Codex mirror remains an atomic immutable snapshot plus current pointer and a separately owned analysis area. Default reading export includes kept work; all-candidate and filtered-draft scopes are explicit choices.

Safe reading/sharing exports disclose generated/imported/recorded status, human edits, assessment limitations, target garden and redacted parent/reference IDs. Raw hidden ancestors, comments, context packs, full imported documents and model transcripts are omitted by default. Including them is a separate explicit full-evidence export, never an implication of choosing a garden.

Full-workspace backups carry all dependencies. Single-garden **recovery** export requires an explicit dependency-closure preview and consent to include donor evidence; otherwise offer a redacted reading export clearly labelled non-restorable. Import cannot overwrite a different garden by display name. Keep the validated old state and atomic replacement rules.

Do not put private inputs, preferences, exact rejection notes, raw receipts, owner paths, inference-pack hashes or private screenshots in public docs, PRs, fixtures, CI or source archives. Any public example is authored fictional material or exact separately approved content. Idea/reference text remains untrusted. No telemetry payload may include content; optional metadata tracing is independently removable and not required for any job.

## 14. Product presentation and accessibility

Bring the approved calm floral direction into actual working screens under [#48](https://github.com/drevendev/CompostClub/issues/48), not a fixed movie frame. Garden icon in the Windows executable/window/shortcut, locally bundled licensed typography, consistent compact controls, expandable cards and history, recent/tag suggestions, clear participation wording and visible rhythm controls are release requirements. Existing local refinements need separate integration/review; this documentation PR does not commit them.

Provide sources, references, pending review, filtered drafts, growth outline and journal without burying waiting/error reasons. A summary reports attempted jobs, operational failures, semantic outcomes, shown candidates and human decisions with denominators. This is minimal operational feedback, not the full statistical insights project #56.

Keyboard, Escape/focus return, screen-reader labels, 200% text, 390px browser width and the 430px native minimum must retain all reading/review/recovery controls. Status never depends only on color or animation. Reduced/off motion works from first paint; decoration pauses when hidden. Butterflies/pointer physics from #49 are optional after the core screens and do not block v0.2. No external fonts/assets at runtime.

## 15. Acceptance and model-quality release decision

### 15.1 Deterministic correctness

Include fictional terminology cases: supplied genre alias versus proper name, misspelling/transliteration with no approved correction, a correction scoped to one source/garden, changed alias invalidating a prepared pack, and a reference title that supplies no mechanic. Screening must expose uncertainty rather than invent a world or silently rewrite original text. Include last-call malformed-negative/repair-refusal cases from #72 and lifecycle interruption/persistence cases from #73.

Run pure domain/storage tests for tuple identity, DAG/revision validation, migration and failure rollback, all stage transitions, call/attempt/candidate/credit holds, human overrides, 0/10/100 exchange, no fallback/reroll, same-pair reverse route, revocation between stages, stale response, fair scheduling, date boundary/DST/clock rollback, quotas and every export scope. Synthetic models/clocks are labelled diagnostics, never live inference evidence.

### 15.2 Small real local evaluation

Before tuning, fix a cleared development set and a separate unseen set with case IDs, intended source contributions, supplied reference facts, languages, prompt/schema/model identities and review rubric. Use at most two candidate prompt revisions in one comparison. Previously seen failures are development/regression cases, never renamed holdout. Private content stays private; public cases are independently fictional and labelled.

The minimum new game set has **12 unseen compatible pairs**, six RU and six EN, plus **4 explicitly incompatible or insufficient-context controls**. Generate one raw draft per pair with the frozen candidate and assess it; retain every filtered/failed case. A human reviews all drafts, including screened-out ones, so a checker cannot improve reported quality by hiding everything. Repeat only for an explicitly new test purpose and disclose newly seen data.

Include at least four compatible cases with supplied, legally cleared primary-source descriptions of real reference works, plus a misleading-reference negative control. Use an isolated evaluation profile with explicitly configured attempt/candidate/call allowances sufficient for the fixed comparison; retain every dispatch and do not change the owner's running profile. Run the old baseline and the frozen new pipeline on the same unseen cases before human scoring, recording the distinct input preparation, contract and call cost of each. Looking at these outcomes makes that set seen; subsequent tuning requires a newly fixed unseen set for any renewed generalisation claim.

Human rubric: clear player action/decision/consequence; recognizable contribution from each source; interacting mechanism; coherent constraints; source-supported reference claims; requested language; Keep / Develop / Reject plus reason. Usefulness is the owner's decision. Pass gates for promoting the new game profile from experimental:

- At least **4 of the 12 compatible cases** are owner Keep or Develop, with at least one in each requested language. Report 12 as the denominator, including invalid/filtered drafts.
- Zero reviewed unsupported factual attributions to real reference works in the displayable set, and all cited spans resolve. A tested set is not a universal factual guarantee.
- The 4 negative controls produce explicit context/combination problems or human-reviewed safe outcomes; none masquerades as a proven working concept.
- Report screening false positives/negatives and raw-draft vs displayable quality. If more than one of the four-or-more human-positive drafts is hidden by screening, revise the checker/threshold before promotion.
- Report all calls, stage/job latency (median/p95/max), interruptions and measured memory/model release. No model speed or no-slowdown claim from old short-output measurements.

These are bounded product decision thresholds, not statistical significance or promised user benefit. If the gate fails, keep a clearly experimental/manual path, retain the negative result and revise or compare an explicitly installed local model on a new set. Do not mark the release ready for its usefulness claim, substitute recordings, silently enlarge inference, or declare the date/budget a reason to lower the gate. App/story profiles require their own disclosed evaluation before equivalent claims.

### 15.3 End-to-end and release artifacts

On actual Windows Electron/Chromium: migrate a fictional populated v2 workspace, preserve originals, create two named gardens, set a receiver to 10% with consent, perform and inspect one genuine cross-garden candidate (100% can force a separately labelled deterministic route), review outcomes, grow one kept seed through three accepted steps and two alternatives, compare, edit, reject, reload, export/restore and preview cascade deletion. Show one human-accepted real local candidate; a proposed paper test is not an actually performed experiment (#27 remains distinct).

Observe at least **three scheduled dispatches at the real configured 15-minute spacing** with the window closed, including genuine generation/check calls, without accelerated clocks. Pause during generation and screening; confirm no later dispatch/commit and measured owned-process release. Restart/wake stays paused. Test an interrupted stage, disk/export failure, budget exhaustion and consent revocation. Exercise idle Exit and Exit during each model stage; compare persisted lifecycle preparation with externally observed owned-process termination, shared-process survival and the next paused launch. Report missing legacy lifecycle timestamps as unavailable rather than estimated. Measure idle and active resources on the actual machine; do not require new downloads for acceptance.

Required release commands remain `npm run verify`, `npm run docs:check`, `npm run build`, `npm run package:single`, applicable browser recovery/P1/sample suites, exact packaged Windows acceptance and desktop lifecycle acceptance. Bind receipts to the final source/package, not an intermediate build. Include the verified **recorded** standalone HTML + SHA-256, reviewed source archive + manifest identity, portable desktop identity, migration/rollback guide and explicit limitations. Runtime weights, portable inference tools, private seeds and local evidence stay out of public source/builds. The planning PR explicitly lists the two new public documents in the reviewed source-file selection; the implementation release must audit its complete final selection again.

Merging a planning or implementation PR is not authorization for a GitHub Release, deployment, domain, competition entry, external account or public personal case study. Publication remains a separate owner action.

## 16. Decisions that replace ambiguous earlier rules

| Earlier ambiguity                                       | v0.2 decision                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Faster cards versus slower compute                      | Interval controls attempts; quality and shared daily call/output limits determine actual results |
| A second model proves quality                           | It provides visible, fallible evidence-grounded findings; human judgment remains separate        |
| 420 characters for all work                             | Rich bounded live contract with compact UI; old replay bytes/contracts remain unchanged          |
| Full original kept, short summary sent invisibly        | Explicit reproducible preparation with span/omission inspection                                  |
| Feedback saved means learned                            | Only approved versioned preferences enter later selected jobs; no retraining claim               |
| Every growth step must propose a one-day experiment     | Direction-specific delta; a test proposal only for the test direction                            |
| All manual work needs the background toggle             | Explicit bounded manual job is independent of enabling the scheduler                             |
| Exchange only after a human click, or fallback silently | Opt-in desktop scheduler may draw; blocked routes wait with an explicit manual override          |
| Each garden has an independent GPU/daily budget         | Credits/due state are per garden; one global compute owner and budget                            |
| Restore historical `success` as screened success        | Legacy technical success stays unscreened unless explicitly assessed later                       |
| Two gardens must wait for a full GA                     | Named gardens reuse v0.2 DNA/graph safety; population GA follows quality acceptance              |

## 17. Subsequent milestone retained: genuine Evolution Lab

After v0.2 quality and graph acceptance, #60/#52 delivers the existing bounded **4–8 member** population, user ratings with unrated unknowns, seeded tournament selection, typed approved-facet crossover with a contribution from each parent, at most one labelled mutation (20% initial probability), a preserved elite and repeatable genotype/operator history. It reuses v0.2 context preparation, rich candidate contract, screening, budgets and DAG exports; a model cannot rewrite selected ancestry.

Acceptance remains a real two-generation selection/crossover/mutation/elitism demonstration, boundary simulations, human preference influence and genuine local evidence. Manual facet entry is sufficient; bulk AI tags #55 are not a prerequisite. This is a named follow-up milestone with preserved requirements, not an indefinite replacement by random blending. It has no separate server, cloud, paid API or automatic population loop.
