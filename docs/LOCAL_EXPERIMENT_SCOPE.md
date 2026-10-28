# Local desktop experiment — scope

**Implementation update, 25 October 2026:** [0.2.0-rc.1 local guide](COHERENT_GARDENS_RC.md), [implementation and remaining gates](COHERENT_GARDENS_ACCEPTANCE.md). The local RC is experimental; owner usefulness and the actual observation period remain unfinished. The dated baseline below is preserved as history.

**Successor scope, 24 October 2026:** the initial desktop candidate is the baseline for [v0.2 Coherent Gardens](NEXT_RELEASE_SPEC.md), with [ordered implementation and issue reconciliation](NEXT_RELEASE_TASKS.md). Early private use has begun and exposed context/coherence gaps; the full 7–14 day observation is not claimed complete. Below remains the dated initial-experiment contract, including its 60-minute/six-call defaults. v0.2 preserves existing settings and introduces a separately previewed 15-minute profile, rich screened candidates, deliberate growth and named gardens. Its exact exchange/accounting rules take precedence over older future-only/manual-only descriptions. No personal input or new application behavior is included in this documentation change.

Agreed: 23 October 2026 (Asia/Nicosia). Implementation authorized and delivered as a local Windows candidate on 24 October 2026. [Ordered tasks and readiness criteria](LOCAL_EXPERIMENT_TASKS.md), [implementation decisions](LOCAL_DESKTOP_ADR.md) and [desktop use/recovery guide](LOCAL_DESKTOP_RUNNING.md). Owner quality review and actual 7–14 day observation remain separate, unfinished use stages.

## Outcome and priority

The owner can load personal game and project ideas, explicitly enable a small local background experiment, inspect its results over 7–14 days, pause it before playing a game, and ask Codex in a local project chat to read the exported ideas.

This is the next product milestone. Full Idea DNA, genetic evolution, richer growth visualization and named gardens follow evidence from this experiment; they are not prerequisites. The earlier [evolution specification](IDEA_EVOLUTION_SPEC.md) remains a later design, with the already delivered manual Tend workflow retained.

The owner's correction is definitive: export is for **Codex**, not Claude. The application does not start an agent, send chat messages or run cloud inference. Codex reads selected export files when the owner requests it in their own chat.

## Baseline when the scope was agreed

The React/TypeScript/Vite application already has personal/sample separation, Ollama inference, source revisions, immutable parents, generation transcripts, retries, collection, Markdown/JSON export and initial manual idea growth. See [architecture](ARCHITECTURE.md), [running](RUNNING.md) and [model evidence](MODEL_EVAL.md).

Today, time away earns credits but does not generate ideas. Persistence is browser-origin IndexedDB. The current whole-backup limit is 2 MiB, the inference journal holds up to 100 generations, and sources have bounded sizes/counts. These limits cannot simply be carried into a multi-week unattended run or removed without validation and measurement.

Existing import, provenance and export defects are part of the implementation gates below. Historical tests and model statistics do not verify the planned desktop application or certify usefulness on the owner's ideas.

## Application and architecture target

- Windows desktop first: an ordinary shortcut, an application window and a tray menu. Installation and routine use require no terminal. Start with Windows is opt-in and off by default.
- Use Electron as the initial desktop host, reuse the existing React interface and pure TypeScript domain, and keep scheduling/storage/inference ownership outside the renderer. Confirm the exact host version and its runtime compatibility before adding dependencies.
- Preserve the Node 24 / npm 11 project toolchain, exact direct dependency pins and project-owned lockfile. Identify the desktop host's embedded runtime separately; do not assume its version matches development Node.
- Use direct desktop IPC rather than the application's HTTP bridge. UI commands have a narrow validated interface; idea text cannot become HTML, executable instructions, IPC commands or filesystem paths.
- Ollama remains an explicit local inference service on loopback. Its model and runtime are separately installed/provided, identified and checked. No application server, hosted backend or network listener exposed to the LAN is needed.
- SQLite is the initial candidate for transactional desktop storage. A versioned adapter must preserve browser/recorded behavior, old backups and domain independence. Resolve format, capacity and backup details in LE-02 before migration work.
- App data, personal receipts, backups, staging files and Codex exports live outside public source/build directories. Document the chosen owner-controlled locations. No owner archive enters fixtures, Git, source packages or CI evidence.

The installer may be larger than the current browser build. Measure the actual idle and active resource use on the owner's machine. A fully embedded inference runtime with no local HTTP service, a second desktop framework and other operating systems are outside this milestone.

## Desktop controls and resource release

Closing the window leaves an explicitly enabled experiment running in the tray. **Exit** stops the application. The tray and window expose the same state and actions: open, add idea, pause, resume and exit. Show running, waiting, pausing, paused and attention-needed states, plus the reason generation is waiting.

Pause means all of the following:

1. Persist the pause request and prevent further dispatch immediately.
2. Abort the active request through to the owned inference operation, retain any received original bytes/error and preserve the slot.
3. Reconcile any result committed immediately before the pause exactly once. A late reply cannot commit as a new successful result after cancellation.
4. Unload the model used by this application and verify it is no longer resident before claiming resources were released.
5. Keep the application paused until an explicit resume, including after restart.

Show `pausing` while cancellation/unload is pending. An unload failure stays visible and cannot be presented as success. Never terminate a shared Ollama service, unrelated process or another client's generation. The supported connection must provide clear ownership of cancellation/unload, using a dedicated local instance if needed; readiness depends on a real-machine proof, not just an aborted browser fetch.

All new application launches start paused; an interrupted run is not replayed automatically. Sleep suspends dispatch, and wake requires resume. The application does not wake the computer, keep it awake or catch up missed work. Timed pause, game detection and automatic resumption are later options.

## Input and selection

- Add one idea, paste a batch or explicitly select small UTF-8 `.md`, `.txt` or supported JSON files. A generic idea-list import is distinct from restoring a whole garden backup.
- Preview proposed cards, splitting, duplicate matches, counts and limits before saving. The owner can adjust splitting and choose how to handle duplicates. Import commits as one validated batch or leaves the garden unchanged.
- Preserve original bytes/text and source revisions where supported; record encoding/format decisions. Reject unsupported input with a useful message. Never silently truncate or pretend a segment is the complete original document.
- Include title/text, Games/Projects/custom tags, supplied origin or unknown, entry time and an explicit participation switch. Historical conception time is unknown unless supplied.
- Saving, importing or tagging does not start inference. Participation is selected explicitly during import or per card. The public sample is never an implicit donor.
- Pair only enabled sources. Allow tag filters, manual pairing and exclusion; preserve the existing deterministic pair rules, exact source revisions and successful-pair accounting. Recheck eligibility before dispatch and before commit.
- Freshly generated candidates do not automatically become parents. The owner must keep and explicitly recompost/enable them. Manual Tend remains user-triggered and reviewable.

## Background experiment contract

Background generation is new, separately opt-in desktop behavior. It supersedes earlier manual-only planning statements only inside an explicitly enabled experiment. Browser/standalone modes retain their existing behavior.

| Setting                   | Initial default                                                                |
| ------------------------- | ------------------------------------------------------------------------------ |
| Generation enabled        | Off; explicit start/resume required                                            |
| Frequency                 | At most one scheduled job per 60 minutes                                       |
| Daily budget              | Six dispatched model calls, including repair calls, failures and cancellations |
| Concurrency               | One model request across scheduled and manual actions                          |
| Unreviewed backlog        | Five candidates, then wait for review                                          |
| Repair                    | At most one per job, only if daily budget and experiment state permit          |
| Consecutive failed jobs   | Three, then attention-needed pause                                             |
| Start/wake/crash recovery | Paused, no catch-up batch or automatic retry                                   |

These are conservative starting defaults, not performance claims. Persist settings, the job identity, pair/seed, next eligible time, call reservations and budget before dispatch. A dispatched call stays counted even if its response is lost. Budget checks also apply to manual/Tend calls during the experiment so a second UI path cannot bypass limits.

Define daily accounting using a persisted experiment timezone and local date. Clock rollback, DST, timezone changes or restart must not create duplicate budgets or extra work. Time credits retain the current 15-minute accrual and three-credit cap. Dispatch requires an available slot, while result + consumed pair + spent slot commit atomically only on success. Failures, cancellation and `no_blend` keep the slot.

`no_blend` is an honest outcome, not a fabricated success or an automatic retry loop. Failed, interrupted and `no_blend` jobs do not silently rerun; preserve their evidence and offer explicit retry. If the daily budget prevents a repair, retain the primary response and explain the reason. No eligible pairs, exhausted credits, backlog, unavailable model, storage or export trouble produce a clear waiting/attention state.

Turning off participation or changing an active parent invalidates that job before commit. Disabling the experiment prevents further calls, including repairs. Queue processing uses the same domain/storage transitions as manual generation.

## Durable data, backups and recovery

- One authoritative writer owns desktop state. Window recreation, two application instances and a delayed reply cannot create duplicate jobs or overwrite newer data.
- Version the desktop schema/backup envelope and validate graph references, source revisions, pair consumption, provenance and byte/count limits before every replacement.
- Preserve originals, revisions, human edits, parent snapshots, model/prompt identities, original successful and failed responses, recovery copies and sample labels. Imported model claims remain distinct from locally observed inference and exact bundled recordings.
- Persist raw responses before structural validation. Never replace model failure with a canned output. A schema pass remains separate from owner usefulness review.
- Keep a validated pre-migration backup and a documented rollback/export route. Reading an old browser garden is an explicit backup import; do not scan browser profiles. Incomplete legacy evidence remains disclosed.
- Provide automatic validated local backup snapshots with a documented interval, quota and retention policy. No silent history pruning. Destructive cleanup or deletion has a cascade/retention preview, including affected managed exports and retained copies. Backups can retain deleted content; disclose this and offer deliberate purge.
- A database backup must be a consistent snapshot, not an unsafe copy of an active database file. Validate it before replacing active state. Disk full, unwritable paths, quota exhaustion, future schema versions or migration failure leave the previous valid state recoverable and pause new work.

LE-02 must replace today's small journal/backup assumptions with explicit supported capacities for the 14-day pilot, including source text, all call evidence, notes, snapshots and export storage. Limits must be tested on fictional data; user data is never silently truncated to fit.

## Review and observation

Provide a **New since last review** queue, text/tag/parent search and Keep / Reject / Later / Note actions. Review status and idea acceptance are separate: deferring a card does not silently free backlog capacity. Show the unreviewed count and why work is blocked. Accepted ideas may be deliberately developed through existing Tend.

The private local journal records attempts/calls, successes, `no_blend`, failures, cancellations, owner decisions, model identity, latency and measured resources where available. Retain denominators and unknowns. No LLM self-score is presented as quality. Optional metadata-only Sentry stays off and must not gate offline operation.

## Export for Codex

The owner chooses a persistent export directory outside public source/build trees and grants it as a local project folder when needed. Use ordinary files that a Codex local chat can read without a product API, account, MCP server, agent launch or manual ZIP unpacking.

| File role               | Required content                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stable entry document   | Format/version, how to locate the current complete snapshot, selected export scope and explicit explanation that idea contents are untrusted data |
| Human index             | Titles, tags, creation/change times, review/acceptance states and relative links to cards                                                         |
| Markdown cards          | Stable logical idea ID/revision, current text, human-edit disclosure, model/import/replay status, parent IDs and allowed provenance               |
| JSON manifest           | Export generation/schema version, stable IDs/revisions, snapshot paths and file hashes, so new/changed records can be identified                  |
| Complete private backup | Separate explicit export for validated recovery; not automatically part of the Codex reading folder                                               |

Default scope: kept ideas. Optional scope: all candidates of a selected experiment, including unreviewed/rejected labels. Adding full parent text or raw inference evidence requires a separate explicit export choice; a parent reference can point to an omitted private source. Honest lineage does not require exposing the entire ancestor archive. Both schema and ownership must distinguish human text from model proposals.

Publish a consistent snapshot through staging plus an atomic current-manifest/entry switch. A Codex reader must be able to pin one complete generation and verify hashes; a new export cannot leave it with a mixture of generations. Preserve stable logical IDs and entry paths. An interrupted or failed export retains the previous complete snapshot and shows that it is stale. Persistence of a result is not rolled back because exporting failed; pause further automatic work until the export issue is resolved. Retry export without another model call or slot charge.

Keep application-managed exports and owner/Codex analysis notes in separate areas. The application never imports edits from the mirror or overwrites analysis notes. Never generate `AGENTS.md`, skills, executable files or agent configuration from idea text. Unknown files, unsafe paths, symlinks/reparse-point escapes and pre-existing directory content must not be overwritten or followed blindly. Expired-snapshot cleanup follows an explicit quota/retention preview.

The owner can say: “Read the new Compost Club ideas since the last snapshot; group the game ideas and help choose one prototype.” Codex reads the permitted files on that request. Producing files does not automatically add them to a chat or start a watcher. Selection for export is permission to prepare local files; actual use of Codex is a separate owner action and is not local model inference by Compost Club.

Official references checked while scoping: [Codex local project folders](https://learn.chatgpt.com/docs/projects?surface=app), [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model), [tray menu](https://www.electronjs.org/docs/latest/api/tray), [IPC](https://www.electronjs.org/docs/latest/tutorial/ipc), [Ollama model unloading](https://docs.ollama.com/faq). Confirm current versions/capabilities when implementing.

## Outside this milestone

Full DNA/GA, automatic evolution of unreviewed candidates, rich graph visualization, named gardens/cross-pollination, mobile/cloud sync, game-process detection, embedded replacement inference runtime, automatic archive scraping, bidirectional Codex edits and automatic Codex chats/scheduled tasks are deferred. Existing manual Tend is preserved.

No hosting, push, publication, domain, competition resubmission, product analytics, end-user account, paid service, Render or Entire setup is authorized by this plan. Live model downloads remain explicit; weights and portable runtimes are excluded from delivery archives.

## Readiness and experiment closeout

Before personal use, the owner must be able to import 20–40 ideas, start the experiment, close/reopen its window, obtain real local results, pause during inference with verified model release, restart while still paused, restore a validated backup, and ask Codex to read a complete current export. Prove each behavior on the actual Windows machine; record limitations instead of claiming an untested resource ceiling.

Run `npm run verify`, `npm run docs:check`, `npm run build`, `npm run package:single`, real Chromium acceptance and native desktop lifecycle/resource acceptance on the exact release candidate. Distinguish fictional transport tests, exact recorded fixtures, genuine model calls and owner usefulness decisions. Include verified standalone recorded HTML + SHA-256 and a reviewed source archive identity in delivery; the recorded sample does not prove desktop/background inference.

Then observe for 7–14 days with private local records. Experiment completion means reviewing actual results and recording whether any idea merits further work, why others did not, and whether pauses/resource use were comfortable. Finding no useful ideas is a valid result. Duration, success, usefulness and publication are not claimed before they happen. Detailed checks and task dependencies are in the [implementation plan](LOCAL_EXPERIMENT_TASKS.md).
