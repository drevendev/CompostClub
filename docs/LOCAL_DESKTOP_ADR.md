# Desktop experiment — implementation decisions

Date: 24 October 2026. Implements the architecture gate LE-02 in the [ordered plan](LOCAL_EXPERIMENT_TASKS.md). Evidence and remaining owner acceptance are tracked separately; this document is not a claim that the 7–14 day experiment has occurred.

## Host and boundaries

Electron 45.0.0 is an exact direct development dependency; esbuild 0.28.2 bundles the host and isolated preload. The inspected real Windows runtime embeds Node 24.22.0 and Chromium 156.0.8078.48. The repository remains Node 24 / npm 11 with a project lockfile. Installing the Electron binary is a separate explicit command; model installation is never automatic.

The main process owns a single DesktopController, SQLite connection, model subprocess and five-second scheduler tick. The existing pure TypeScript garden/growth transitions are reused through an explicit desktop capacity profile. React renders state and sends validated commands through a sandboxed, context-isolated preload. There is no renderer Node integration, arbitrary shell IPC, application HTTP server, permission grant, remote navigation or product network client. Renderer requests outside bundled local assets are blocked. Ordinary idea text renders through React text nodes.

The Windows single-instance lock focuses the current window rather than creating a second writer. Close hides the window; Exit pauses and releases owned work before stopping. Start/wake begin paused, and no wake lock or missed-job catch-up is installed. Start with Windows is an explicit operating-system preference with the correct executable/entry path.

The browser/standalone entry stays separate. It retains IndexedDB, its original capacity limits and exact recorded fixture behavior. The desktop host does not silently read browser profiles or replace their data.

## Local inference ownership

The operator selects an existing `ollama.exe`, model directory and Gemma 3 1B/4B. The application starts its own process on a fresh loopback-only port with cloud disabled, one parallel request, one resident-model limit and keep-alive zero. It reads installed tags/digests and rechecks identity before inference. There is no weight/runtime download, endpoint supplied by idea content or connection to the owner's shared Ollama daemon.

Pause persists disabled state, aborts the owned request, requests model unload, inspects loaded models and terminates only the exact process tree created by this instance. Process exit supplies the fallback release proof if the server ignores cancellation/unload. Failure remains attention-needed rather than a false released status. A shared service or image-name-wide process kill is never used.

The main process serializes actual inference through one active-job owner across blend, retry and Tend. A primary/repair call is reserved in the persistent daily budget before dispatch. Success commits the original result, consumed pair and spent slot together. Failed, interrupted and `no_blend` attempts retain credits and are retried only explicitly. Already-dispatched calls remain counted even if a response is lost; restoring a backup cannot refund them or change the installation's accounting timezone.

## Data and capacities

The standard operating-system application-data directory holds `garden.sqlite`, its WAL files, retained original imports, raw receipts and backup snapshots. It is outside the portable executable/source package. An explicit operator/acceptance `COMPOST_DATA_DIR` or `--compost-data-dir` argument can select a stable separate directory; login registration preserves the resolved directory. Operator-selected model paths are references, not copied assets.

SQLite uses WAL, full synchronous writes, a revision guard and transactions. Workspace payloads have a SHA-256 integrity check, not an authenticity signature. Garden semantic validation includes source-history snapshots, DAG ancestry, consumed-pair/result/journal relationships and imported evidence labels. A full desktop backup is a `compost-desktop` version-2 envelope; old garden version-1 files are explicitly imported into it. Source participation is off after restore, inference is cancelled and local model/export paths remain installation-owned.

| Resource                          | Desktop bound                                                                    | Rationale / behavior                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Active workspace JSON             | 32 MiB UTF-8                                                                     | Reject before replacing current state                                                                           |
| Garden serializer profile         | 64 MiB; 1,000 inference records and 1,000 growth nodes                           | Explicit adapter profile; browser stays 2 MiB / 100                                                             |
| Sources / text / source revisions | Existing 200 sources, 800 normalized characters, 8 KiB raw source, 100 revisions | Imported text initially splits near 600 characters into editable cards; original selected bytes remain separate |
| Selected original files           | 1 MiB each, 20 per batch, 200 retained files within workspace quota              | No silent archive scraping or truncation                                                                        |
| Raw receipt journal               | 3,000 records / 128 MiB                                                          | Require headroom before dispatch; retain received transport/model bytes before validation                       |
| Transport response                | At most approximately 2 MiB received before stopping the reader                  | Any stopped response is disclosed as incomplete transport evidence, not a complete original                     |
| Local backup snapshots            | 64 copies / 256 MiB                                                              | On the next write after six hours, plus before restore; quota requires reviewed cleanup                         |
| Codex snapshots                   | 1,000 directories / 256 MiB                                                      | Explicit cleanup preview; no automatic destructive pruning                                                      |

At the default six calls/day, 14 days dispatch at most 84 calls including repairs/cancellations. The conservative bounds allow that small pilot without assuming unbounded retention; oversized input/evidence can reach a byte limit sooner and pauses work honestly. Receipt I/O failure retains the received text in memory for a full backup to another destination and blocks exit until it is durably exported. No implementation can promise durable storage on a full or unavailable device; the UI must disclose the failure.

Backups serialize a consistent in-process SQLite snapshot, not an unsafe copy of an active database file. A replacement is validated first and keeps a before-restore snapshot. Full external backups are staged, flushed and renamed so an incomplete write does not replace the last valid file. Restoring deduplicates retained receipts and preserves accumulated call usage. Backup checksums establish internal consistency, not external model attestation.

## Export and deletion

The owner selects an empty directory outside source/build/data roots. The application creates a marker, a stable README, `CURRENT.json`, immutable snapshot directories and a separate `analysis` directory. Every manifest identifies the generation, workspace revision, stable logical idea IDs/revisions and file hashes. The pointer moves only after all snapshot files are written/flushed. Windows transient file locks get bounded retries; failure leaves the previous complete pointer intact and stops background generation.

Kept ideas are the default; all candidates can be selected explicitly. Parent references/tags are included, while hidden source text, full raw responses and the complete recovery backup are separate. Human edits and imported/recorded/live distinctions remain visible. Notes under `analysis` are never overwritten or imported. No agent instructions or executable configuration are generated from ideas.

Paths and ancestor directories must be ordinary local directories without link/reparse escapes. The application refuses existing unowned directories and never recursively removes an unchecked directory. Source deletion previews descendants/revisions and discloses retained originals, snapshots and backups. Those retained copies have their own deliberate cleanup actions; active source deletion does not pretend that every historical backup has been erased.

## Acceptance targets and evidence boundary

Correctness targets: no new dispatch after pause, exactly one result commit, no credit charge on cancellation, no running owned process after successful release, restart/wake paused, no default scheduled spacing below 60 minutes, consistent current export and zero unexpected renderer errors/network destinations. Real default spacing is observed separately from controlled-clock tests.

Measure pause latency, aggregate Electron working set/CPU and the owned Ollama process tree on the actual owner machine. Report measured samples and unknowns instead of inventing a portable CPU/RAM ceiling. The initial real pre-final acceptance observed a 502 ms pause/owned-process stop; it is an individual observation, not a guaranteed bound for subsequent builds or hardware. Final candidate receipts identify their exact compiled artifacts and test scope.

Private owner quality review, a selection of participating personal ideas and the 7–14 day observation remain human-use gates. Structural regression tests and public fictional real-model calls cannot complete those gates.
