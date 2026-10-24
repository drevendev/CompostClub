# Local desktop experiment — ordered implementation tasks

Agreed 23 October; implementation authorized 24 October 2026 (Asia/Nicosia). Canonical requirements: [local experiment scope](LOCAL_EXPERIMENT_SCOPE.md). [Desktop guide](LOCAL_DESKTOP_RUNNING.md), [architecture/capacities](LOCAL_DESKTOP_ADR.md) and [verification summary](../evidence/desktop-verification.json).

Task IDs are local tracking IDs, not newly created GitHub issues. Existing issue links identify related work; no GitHub issue was created or closed. The local implementation includes code, exact dependency pins, explicit backup migration and a portable Windows build. Existing installed owner-authorized model files were connected; weights were not downloaded or bundled.

## Delivery status — 24 October

| Tasks    | Status and remaining boundary                                                                                                                                                       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LE-01–04 | Implemented; integrity, packaging, SQLite transactions, native shell, second-instance and abrupt-restart checks passed                                                              |
| LE-05    | Implemented; real active cancellation/process release and diagnostic release-failure checks passed; physical Windows sleep/login and an actual game/GPU benchmark remain unmeasured |
| LE-06–09 | Implemented; batch/file import, review, Codex snapshots and bounded scheduling verified with explicitly separated fictional/recorded/live evidence                                  |
| LE-10    | Awaiting the owner's private sources and usefulness review; public diagnostic outputs do not complete it                                                                            |
| LE-11    | Local candidate and regression evidence delivered; the LE-10 human-use gate remains open and hardware/lifecycle limits are disclosed                                                |
| LE-12    | Not started; requires actual owner use for 7–14 days and review                                                                                                                     |

The real default-interval run identifies its compiled artifacts. Final lifecycle fixes (custom data-path login arguments, tray input navigation), result search, UTF-8 quota validation and unchanged-growth edit labels have separate final-build native/live checks; the scheduler/runtime algorithm was not accelerated or replaced. Raw receipts stay in ignored local evidence. The public summary contains no owner ideas or machine paths.

Checked criteria below identify implementation/covered acceptance, not an assertion that physical power loss, every OS lifecycle event or creative benefit was measured. The owner's empty personal profile remains paused with autostart off; fictional fixtures are confined to isolated acceptance profiles.

## Order and gates

Follow the table order for a reviewable first implementation. Dependencies name actual prerequisites; independent documentation/UI preparation can proceed when it does not bypass a gate.

| Order | Task                                                      | Depends on                 | Completion unlocks                                         |
| ----- | --------------------------------------------------------- | -------------------------- | ---------------------------------------------------------- |
| 1     | LE-01 — repair existing integrity and packaging defects   | —                          | Trustworthy imports, attribution and deliveries            |
| 2     | LE-02 — record desktop, runtime and data contracts        | LE-01 findings             | Versioned implementation boundaries and measured limits    |
| 3     | LE-03 — durable storage, migration and backups            | LE-01, LE-02               | Recoverable desktop workspace                              |
| 4     | LE-04 — desktop shell, tray and one process owner         | LE-02, LE-03               | App launched without terminal, stable background owner     |
| 5     | LE-05 — explicit model connection and resource-safe pause | LE-03, LE-04               | Safe manual local inference; mandatory gate for automation |
| 6     | LE-06 — batch input, tags and participation               | LE-01, LE-03, LE-04        | Owner-controlled experimental population                   |
| 7     | LE-07 — result review and private journal                 | LE-03, LE-04               | Review queue and preserved human decisions                 |
| 8     | LE-08 — continuous Codex export                           | LE-03, LE-06, LE-07        | Complete readable snapshots and safe notes separation      |
| 9     | LE-09 — bounded background scheduler                      | LE-05, LE-06, LE-07, LE-08 | Explicitly enabled unattended operation                    |
| 10    | LE-10 — private manual model pilot                        | LE-05, LE-06, LE-07, LE-08 | Owner-reviewed model/settings for longer use               |
| 11    | LE-11 — release and machine acceptance                    | LE-01 through LE-10        | Candidate ready to begin the personal experiment           |
| 12    | LE-12 — run and review the 7–14 day experiment            | LE-11                      | Observed evidence and next product decision                |

LE-03's new desktop migration is a bounded part of [migration issue #54](https://github.com/drevendev/CompostClub/issues/54), not an implicit implementation of the complete future DNA/GA schema. LE-06/LE-08 cover selected-file reuse related to [#45](https://github.com/drevendev/CompostClub/issues/45). LE-10/LE-12 relate to private pilot [#18](https://github.com/drevendev/CompostClub/issues/18) and human quality review [#20](https://github.com/drevendev/CompostClub/issues/20). No GitHub state change is part of this plan.

## LE-01 — Existing integrity, trust and packaging

**Deliver:** fix the known defects used by importing, repeated generation, Codex export and release packaging. Retain originals and current public sample behavior.

Related issues: [#68 consumed pairs](https://github.com/drevendev/CompostClub/issues/68), [#69 ancestry/revisions](https://github.com/drevendev/CompostClub/issues/69), [#22 imported trust](https://github.com/drevendev/CompostClub/issues/22), [#70 edited growth export](https://github.com/drevendev/CompostClub/issues/70), [#67 source packaging](https://github.com/drevendev/CompostClub/issues/67). Recheck current implementation before changing anything already repaired.

- [x] Contradictory consumed-pair/request/sprout records, duplicate references, cycles and demonstrably nonexistent or mismatched revisions are rejected before replacement; valid legacy missing history stays disclosed.
- [x] Imported provenance is explicitly unverified unless an exact bundled recording is matched. Human-edited growth text is distinguished from the original model proposal in all Markdown paths.
- [x] Packaging uses a reviewed explicit public file set and fresh/verified output. Ignored/untracked sentinels and stale files cannot enter the source archive.
- [x] Meaningful domain/import/export/packaging regressions and Chromium restore scenarios pass on fictional inputs; failure and `no_blend` slot semantics remain unchanged.

## LE-02 — Desktop architecture and compatibility contract

**Deliver:** a project-local decision record selecting the concrete Electron host, storage driver/envelope, IPC surface, Ollama ownership/cancellation protocol, data/export locations and capacity/backup policy before dependency or schema work.

- [x] Explain Electron/TypeScript reuse and SQLite choice against the existing domain boundaries. Pin exact direct dependencies and account for licences; keep Node 24 / npm 11 and the project lockfile. Identify embedded runtime compatibility explicitly.
- [x] Define job, source/revision, result, review, call-budget and export-generation identities; atomic commit/cancellation ordering; single-writer ownership; version/rollback rules; and restart/sleep behavior.
- [x] Define model service ownership so pause can cancel/unload this app's work without killing a shared service or another client's request. A loopback model service is disclosed; there is no application HTTP server or LAN exposure.
- [x] Set documented byte/count/quota bounds sufficient for the proposed 14-day workload, including failed/repair responses and exports. Set measurable idle/active resource and pause acceptance targets using the actual machine, with unknowns explicitly recorded.
- [x] Specify backup cadence, retained copies and export-snapshot retention, plus preview/manual cleanup when a quota is reached. No hidden destructive pruning.

## LE-03 — Durable desktop data and migration

**Deliver:** a versioned transactional desktop storage adapter, validated old-backup import and consistent recoverable backups. Reuse pure domain transitions; do not access browser profiles directly.

- [x] A committed result, consumed pair and spent slot either all persist or none do. Evidence, source snapshots, human edits and review state survive reopening and export/restore.
- [x] Existing personal/sample/recovery data imports from explicitly selected valid backups without semantic loss or upgraded provenance; original backup bytes and a pre-migration recovery copy remain available. Unsupported future versions fail safely.
- [x] Stale writes, second writers, forced shutdown and interrupted migration cannot overwrite the latest complete state or automatically resume a pending inference. No received failure response is intentionally discarded by validation.
- [x] Backup uses a consistent snapshot and is validated before replacement. Disk full, corruption, missing permissions and quotas preserve the previous state and pause work with a useful recovery route.
- [x] Capacity, legacy round-trip, graph invariants, crash points and cascade/retention previews have meaningful automated coverage. Public sample and standalone storage remain supported.

## LE-04 — Desktop shell and lifecycle

**Deliver:** a Windows launch artifact with the existing UI, tray controls and a background owner independent of the renderer.

- [x] Launch by shortcut with no terminal. Closing the window keeps an enabled experiment in the tray; reopening the window preserves state. Exit ends owned application work cleanly.
- [x] A second launch focuses the existing instance; it cannot create another writer or generation loop. Window destruction/recreation does not lose the scheduler state.
- [x] Tray/window consistently expose open, add, pause, resume and exit, with running/waiting/pausing/paused/attention states. Start with Windows defaults off.
- [x] New launches and wake start paused; no sleep prevention, automatic catch-up or automatic interrupted-job retry occurs.
- [x] Narrow IPC, renderer isolation and path validation prevent idea text from invoking privileged behavior. Bundled UI loads without an application server; existing browser build remains usable.

## LE-05 — Model setup, cancellation and verified pause

**Deliver:** explicit local Gemma connection and pause semantics that actually stop owned compute and release the model.

- [x] Setup discovers/checks only the configured loopback service, identifies installed model/digest and explains missing prerequisites. No hidden download, cloud fallback, service rebinding or silent install occurs. Model changes invalidate stale requests.
- [x] One request owns inference across manual blend, Tend and background paths. Pause prevents a new primary or repair dispatch immediately and persists its state before awaiting shutdown.
- [x] Cancel at loading, generation, validation and commit boundaries; preserve raw response/error and slot. A concurrent commit is recorded exactly once, and late/stale callbacks cannot install a cancelled result or resume work.
- [ ] Observe request cancellation and model disappearance from the supported service's loaded-model list. Measure latency and CPU/RAM/GPU use where applicable on the owner's machine. The UI remains `pausing`/attention-needed if release is unconfirmed.
- [x] Unrelated clients/processes are unaffected. Repeated pause/resume, offline service, unload failure, exit, sleep and restart have deterministic state and real desktop acceptance evidence. No promise of zero total application memory is made.

## LE-06 — Controlled batch import and source selection

**Deliver:** single/batch entry, selected-file import, tag filters and participation controls.

- [x] Paste or select supported UTF-8 Markdown/text/JSON files, then preview splitting, duplicates and limits. The owner can adjust/cancel. Oversized/unsupported files fail before mutation; originals and source attribution are preserved without silent truncation.
- [x] Commit an import as one validated batch. Repeating it exposes duplicates instead of silently multiplying sources; each new source receives a stable app identity.
- [x] Games/Projects/custom tags and an explicit participation choice work without a model. Import/save/tagging does not generate anything. Sample content is isolated.
- [x] Pairing uses enabled sources and exact revisions; filters/manual choice/exclusion are visible. Editing/disabling a parent invalidates a pending job before commit. Generated candidates require deliberate keep/recompost/enable to join future pairs.
- [x] Complete a fictional 20–40 idea import, reload, validated backup restore, Cyrillic/English search and cancelled-import check before owner material is loaded.

## LE-07 — Review queue and private observation

**Deliver:** new-results review, human decisions/notes and a local experiment journal.

- [x] Open each candidate with both parents and honest live/recorded/imported/edited status. Keep, reject, defer and note persist across reload and backup restore. Search text/tags/parents; existing manual Tend remains usable.
- [x] Distinguish reviewed/accepted/deferred states. Unreviewed count remains correct after manual generation, editing, crash and restore; deferral does not silently bypass the backlog cap.
- [x] Log jobs, actual model calls, repairs, successes, `no_blend`, failures, cancellations, latency and owner decisions with honest denominators. Schema validity is separate from human usefulness.
- [x] Records/measurements remain private and local. Optional Sentry is off; the product works offline with it removed. No text enters public diagnostic fixtures or CI output.

## LE-08 — Persistent export readable by Codex

**Deliver:** an explicitly selected local directory with an entry document, human index, Markdown cards, versioned JSON manifest and a separate area for analysis notes. A full private recovery backup remains a distinct export.

- [x] Default to kept ideas; allow all candidates of a chosen experiment. Card IDs/revisions, timestamps, tags, review states, human edits and provenance are stable and explicit. Parent references can disclose omitted private sources without copying them.
- [x] Publish a complete generation through staging and atomic pointer/entry update. A reader pins one snapshot with matching manifest hashes. Mid-export crash, locked files, disk full or lost permission leaves the previous snapshot readable and clearly stale.
- [x] Export failure preserves committed results/slots, pauses further automatic work and can be retried without inference. Invalid paths, traversal, reparse/symlink escapes, user files and filename collisions cannot cause unintended reads/writes.
- [x] The application never overwrites owner/Codex analysis notes, ingests mirror edits or creates agent instructions/executables from idea text. Raw model transcripts and full hidden ancestors are excluded unless separately selected.
- [x] Removal/unexporting previews affected managed copies; retained snapshots/backups are disclosed. Quota handling follows LE-02 and never silently deletes owner notes.
- [x] Document how the owner attaches the export folder to a local Codex project and requests a read. In a real local chat, locate new/changed ideas, read Cyrillic cards/lineage and save analysis separately without manual download/ZIP extraction. No MCP, watcher, cloud inference or automatic chat launch is required.

## LE-09 — Bounded background execution

**Deliver:** an explicitly enabled, persistent scheduler independent of UI timers, using the same validated transitions and storage as manual work.

- [x] Enforce the scope defaults: 60-minute spacing, six daily model calls including repairs/dispatched failures/cancellations, one concurrent request, five unreviewed candidates and pause after three consecutive failed jobs. Successful/no_blend jobs end a failure streak; `no_blend` does not trigger retry loops.
- [x] Persist call reservation/job identity, source revisions, seed, next time and timezone/date budget before dispatch. Test restart, two instances, clock rollback, DST/timezone changes and pause races; no extra calls or duplicate commits result.
- [x] Credits still accrue every 15 minutes up to three. A successful result atomically spends one; cancellation, failure and `no_blend` keep it. Check budget/state before repair and document skipping repair when budget is exhausted.
- [x] Manual blend/Tend cannot bypass the shared concurrency/budget limits. Parent changes, opt-out or pause cancel pending work; failed/no_blend/interrupted pairs require explicit retry.
- [x] Sleep, exit, unavailable model, exhausted pairs/credits/budget, full backlog, storage/export fault and crash produce correct persisted waiting/paused states. No wake lock, catch-up burst or unreviewed self-feeding occurs.
- [x] Controlled scheduler/transport diagnostics are labelled as synthetic. Real closed-window execution and pause are separately proven in LE-11; fake timers do not count as machine acceptance.

## LE-10 — Small private manual model pilot

**Deliver:** a private owner-reviewed set of real outputs before the unattended run.

- [ ] Select approximately 10–15 fixed game/project pairs from explicitly included owner sources, covering requested output languages. Use installed local Gemma 3 4B as the initial candidate when compatible; disclose that earlier structural results are not a quality promise.
- [ ] Retain exact model/digest/prompt/parameters, raw primary/repair responses, failures, calls/latency and source revisions privately. Never replace poor results with public recordings.
- [ ] The owner reviews both-source contribution, integrated mechanism, language and Keep / Maybe / Reject with a reason. Tuning on these examples is recorded; they are not later described as unseen holdout data.
- [ ] The owner chooses model/settings and acceptable resource cost for longer use, or records that the output is currently too weak. Failure to find a useful result is not repaired by fabricated success; resolve the product decision before starting LE-12.

## LE-11 — Release and actual-machine readiness

**Deliver:** an exact identified candidate, meaningful regression evidence and a practical local-use guide.

- [x] Run `npm run verify`, `npm run docs:check`, `npm run build`, `npm run package:single` and applicable real Chromium suites on the candidate. Record dependency/runtime/source/build identities and all missing checks; old receipts are references only.
- [x] In the Windows app: import 20–40 fictional ideas, enable generation, close/reopen the window and observe at least two genuinely scheduled dispatches at the real default spacing with real local model evidence. Accelerated-clock checks are separately labelled.
- [x] Pause a real active call; prove no later dispatch, preserved slot/evidence, confirmed owned-model unload and measured resource release. Relaunch/wake remains paused. Reopen, explicitly resume, exhaust a controlled budget/backlog and verify waiting behavior.
- [x] Test forced shutdown/late response, second instance, unavailable service, export write failure, invalid backup and consistent restore; existing results remain recoverable and no duplicate result/call is hidden.
- [x] With optional tracing off and model already installed, verify no external application requests. Confirm private text/weights/runtimes are absent from source/build/fixtures and that optional integrations do not gate use.
- [x] In a local Codex project, read the complete export generation, identify new cards and write separate notes. Confirm permission-limited scope and that no automatic agent request was sent.
- [x] Supply the launch artifact/use-and-recovery guide, verified labelled recorded standalone HTML with SHA-256, reviewed source archive + manifest identity and evidence/limitations. Recorded HTML acceptance remains distinct from desktop/live acceptance.

## LE-12 — Observe use and choose the next milestone

**Deliver:** a private 7–14 day observation record and an owner decision, following LE-11 readiness. This is actual use, not a synthetic acceptance receipt.

- [ ] Load the owner's chosen participating ideas, choose export scope/model/budgets, validate the initial backup, and explicitly start. The owner may pause or end the experiment at any time; do not schedule a Codex automation without a separate request.
- [ ] Record actual attempted calls, results/negative outcomes, keep/reject reasons, interruptions, pause comfort and measured resource/storage cost. Retain all raw failures and disclose days the application was paused/off.
- [ ] Ask Codex to review selected new exports and record whether the workflow was convenient. Do not claim file export alone proves repeated use or creative benefit.
- [ ] At closeout record one selected idea/next small experiment, or an honest decision that none merits work. Keep owner material private.
- [ ] Decide from observations whether next work should improve generation/pairing, usability/resources, or advance the deferred DNA/GA/tree milestone. No public post, push, service setup or contest submission follows automatically.

## Definition of completion

LE-01 through LE-11 complete means **ready to begin personal use**. LE-12 complete means **the observation was actually performed and reviewed**. Neither milestone is achieved by writing this plan, passing a schema validator or opening a recorded demo. Every unchecked criterion remains work to do.
