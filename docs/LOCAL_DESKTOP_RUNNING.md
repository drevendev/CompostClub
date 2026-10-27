# Run the personal desktop experiment

**0.2.0-rc.3:** local technical preview for [issue #81](https://github.com/drevendev/CompostClub/issues/81). See [RC3 regression](RC3_REGRESSION_ACCEPTANCE.md): bounded generator schema, visible background blockers, stale-block re-evaluation. Compatible RU regression cases still returned semantic refusals; this is not full generation acceptance. Keep a validated current data copy and previous executable before switching; start paused.

**0.2.0-rc.2 is a local review candidate, not an accepted release.** It adds whole-job admission, the global Pause/Eureka toolbar and durable operator requests. See [implementation](GENERATION_FIX_IMPLEMENTATION.md) and [honest acceptance outcome](GENERATION_FIX_ACCEPTANCE.md). The final RU generation gate remains open; the personal installation has not been replaced.

**0.2.0-rc.1:** use the current [Coherent Gardens RC guide](COHERENT_GARDENS_RC.md) for schema-3 migration, named gardens, budgets and rollback. The [acceptance record](COHERENT_GARDENS_ACCEPTANCE.md) retains the negative quality result. The instructions below preserve the earlier desktop baseline; its old defaults and screens are historical.

The behavior is defined in the [scope](LOCAL_EXPERIMENT_SCOPE.md); [implementation tasks](LOCAL_EXPERIMENT_TASKS.md) distinguish implemented application features from the owner's actual observation period. This guide covers the Windows desktop candidate. Browser and recorded HTML instructions remain in [RUNNING.md](RUNNING.md).

## Start the portable application

Open the supplied desktop folder and run its application executable/shortcut. Keep the folder's runtime files together. Node/npm and a terminal are not needed to use the portable build. The first launch is paused, and closing the window leaves the tray application available. Use the tray's Exit action to stop it completely.

Use the supplied local shortcut consistently when it selects a separate data directory. An operator can use `--compost-data-dir` or `COMPOST_DATA_DIR`, for example `%USERPROFILE%\CompostClubData`, with exports in `%USERPROFILE%\Compost Club Ideas`. This avoids ambiguous AppData redirection when launching from a sandboxed/MSIX host. Start with Windows retains that same resolved data path. The launcher and personal settings remain outside the public source package; the portable application contains no hardcoded owner paths.

Open **Настройки** and configure:

1. **Выбрать ollama.exe…**: select an already installed Ollama executable.
2. **Выбрать папку моделей…**: select its existing model store containing `gemma3:4b` or `gemma3:1b`.
3. Select the installed model and save settings. 4B is the initial candidate; historical structural checks do not guarantee useful ideas. 1B has weaker existing quality evidence.
4. **Проверить установленную модель** checks the local service/model without downloading weights. The application manages its own loopback process; your shared Ollama session is not stopped by Pause.
5. **Выбрать пустую папку экспорта…**: choose a stable empty directory outside application source/build/data directories. This is the reading folder for Codex, not a complete backup.

If a prerequisite is missing, install/select it explicitly following the official tool/model instructions. There are no hidden model downloads, cloud inference, API keys, accounts or paid service requirements in Compost Club. Optional metadata tracing stays off and is not part of the desktop execution path.

## Add ideas and start slowly

Use **Мой сад** to add a single idea or **Добавить пачку** to paste multiple ideas separated by blank lines or `---`. **Из файлов…** selects UTF-8 `.md`, `.txt` or idea-list JSON. JSON accepts an array of strings or objects with a text field; full garden backups use Restore instead.

Review and edit the proposed cards before confirming an import. Empty cards are excluded and exact duplicates are skipped; no partial batch is saved on error. Original selected file bytes are retained separately. Long text is segmented to the supported short-card format; the preview does not pretend that one segment is the complete original document. A garden currently holds up to 200 sources.

Add Games/Projects/custom tags as desired. Enable **Участвует в эксперименте** only for sources you want the model to receive. Adding/tagging alone does not run the model. Choose two enabled cards for a manual pair, or leave selection empty for the deterministic picker. Failed pairs have an explicit retry action in the journal.

The default experiment runs at most one scheduled job per hour, six model calls per day including repairs/failures/dispatched cancellations, and one concurrent request. Five unreviewed/deferred ideas stop further automatic generation until review. The first eligible pairing can start shortly after you explicitly resume; missed hours never generate a catch-up batch. Existing 15-minute time credits are separate from the daily compute budget.

Press **Продолжить эксперимент** when ready. Close the window to leave it in the tray. Use **Пауза и освобождение памяти** before gaming. Wait for the paused/released state; `pausing` or attention-needed means release has not yet been confirmed. Restart and sleep/wake leave the application paused until explicit resume. Start with Windows is opt-in and also starts paused.

## Review and reuse

**Новые идеи** provides new/deferred, kept and all-result views. Inspect both sources, then save, reject, defer or note the result. Deferring keeps it in the backlog. Human edits preserve the original model text. Useful ideas can be explicitly returned to the compost pile; new source participation defaults off. Unreviewed candidates never automatically become parents.

Manual Tend remains a small proposed continuation of a kept idea/accepted branch. Review/edit before acceptance; rejection/cancellation keeps its slot. The current Tend prompt remains English. A proposed one-day experiment has not been performed merely because it appears in the application.

**Наблюдения** retains actual calls/outcomes/latency, original responses and your decisions. Model errors are not replaced by recordings. A structurally valid response is not a usefulness score. Begin with a small owner-reviewed manual pilot before leaving the experiment enabled for days.

The 24 October fictional live checks exposed mixed-language output: a Russian request sometimes produced a Russian title with an English concept. Some Tend responses were unfinished and their acceptance was correctly refused. These remain original model outputs, not successful language/quality evaluations. Review, reject or deliberately edit them; no generated one-day experiment has been performed by the application.

## Read exports in Codex

Attach the chosen export directory to a local Codex project if needed, or provide its permitted path in your local chat. Ask, for example: “Read CURRENT.json, inspect new Compost Club game ideas since the previous snapshot, and help choose one prototype.”

`CURRENT.json` points to a complete immutable snapshot and gives the manifest hash. Pin that generation and read its INDEX/cards; each card has stable identity, review status and provenance. Files are not automatically added to the chat, and the application starts no Codex watcher, chat or cloud request. Your own explicit Codex use is separate from Compost Club's local inference.

Save analysis notes under `analysis/`. The application never overwrites those notes or reads edits back into the garden. Default export includes kept ideas; select all candidates in Settings if you want new/rejected candidates available too. Full private parents and raw transcripts are omitted; export a full private recovery backup separately when needed.

If export fails, the last complete snapshot stays readable and the application pauses further automatic generation. Fix permissions/free space, then **Обновить экспорт**; retrying export does not call the model or spend a slot. Cleanup of old/incomplete managed snapshots requires a preview. Old snapshots may retain ideas removed from the current garden.

## Backup, restore and retention

**Сохранить полный бэкап…** writes a validated private desktop JSON envelope containing originals, revisions, model evidence and reviews. Store it separately from public code and Codex exports. Local consistent snapshots are retained on the next write after six hours and before restore, subject to visible count/byte limits. No hidden history pruning occurs at a limit.

**Восстановить с предпросмотром…** accepts a validated desktop backup or old browser garden JSON. It previews counts and retains a before-restore copy. Sources start excluded; runtime/export paths and already-dispatched call usage remain local. Unsupported/corrupt files cannot replace the garden. A browser-origin garden is migrated only through an explicit export/import, not profile scanning.

Deletion previews active descendants/revisions and discloses retained copies. Old backups, original full imported files and previous export snapshots can still contain deleted text. Each has a separate reviewed purge action. Deleting one active card does not silently erase independent originals or all historical copies.

If the database cannot open or its integrity check fails, stop every instance and preserve `garden.sqlite`, `garden.sqlite-wal` and `garden.sqlite-shm` together before recovery. Do not copy an active SQLite file as a backup or delete its WAL. Retain the damaged files in a separate recovery directory, start a fresh workspace, and restore a known validated full JSON backup. No recovery step should destroy the last original copy.

An actual disk-write failure may leave a received response retained only in memory. The application reports that condition and requires exporting a full backup to another writable destination before exit. Never treat an unconfirmed save as durable.

## Build and verify from source

Use Node 24 / npm 11:

```sh
npm ci
npm run desktop:install-runtime
npm run verify
npm run docs:check
npm run build
npm run package:single
npm run desktop:build
npm run desktop:start
```

`desktop:install-runtime` explicitly downloads the pinned Electron application runtime, not AI weights. `desktop:package` produces a fresh portable directory with the runtime and required licences. Source release packaging uses `scripts/source-files.json`, a reviewed exact file list; new public files must be added deliberately. It never includes ignored/private material merely because it is under an allowed directory.

`test:desktop` checks domain budgets, migration/backup transactions, original import bytes, Codex snapshot hashes/notes and filesystem boundaries with labelled fictional diagnostics. Windows junction coverage may require running outside AppContainer restrictions; report skipped checks honestly. `scripts/desktop-acceptance.mjs` opens real Electron/Chromium; `--live` adds genuine calls to the already installed project-local model, and `--long` observes two real default-interval scheduled calls with the window closed. Native file-selection/confirmation is controlled in that diagnostic harness, while actual inference remains unstubbed. Its isolated profiles and raw receipts stay in ignored local evidence.

Before delivery, run the browser recovery/P1/sample acceptance, actual desktop lifecycle/resource checks and exact-candidate evidence collection. Include the verified recorded standalone HTML/hash and reviewed source archive identity. Start the private 7–14 day observation only after owner review; no publication or scheduled agent automation follows automatically.
