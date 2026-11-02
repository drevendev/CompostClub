# Native Windows host (RC8)

The owner rejected both an unsigned custom EXE and a loopback web application. RC8 adds a Windows Presentation Foundation UI in a local PowerShell script, plus a bundled JavaScript worker executed by installed Node 24. A `.lnk` starts the native window with its console hidden. No browser, Electron host, HTTP listener, application server, new native executable, native addon or runtime download is required for this host.

Windows still executes its signed PowerShell/.NET and the installed signed Node runtime. The launcher checks Node's signature and major version, and verifies every package file against its SHA-256 manifest. A manifest is **integrity evidence, not a publisher signature**. Windows policy remains authoritative: do not disable Smart App Control/Defender, add exclusions or use ExecutionPolicy bypass. Test the actual shortcut on the target device. The existing optional Ollama provider retains its own explicitly selected model-runtime behavior; it is not the application's UI transport.

## Architecture and lifecycle

- `scripts/start-native.ps1`: fixed reviewed XAML and built-in WPF controls; native file/folder/save/confirmation dialogs and tray. User/model text is assigned to text properties, never parsed as XAML, HTML or PowerShell. Long text is selectable. No third-party UI DLL is loaded.
- `desktop/native-worker.ts`: bounded JSON-line messages over redirected stdin/stdout, serialized actions and asynchronous native dialog replies. Stderr is drained independently. It reuses CoherentController, SQLite, model adapters, consent, bounded repair, call accounting and optional metadata observer.
- `desktop/native-ui.ts`: declarative screen/action/field definitions. Stale render actions and out-of-list selections are rejected. A background status update does not destroy an unsent form. Passwords are cleared after submission and excluded from draft caching. Async toolbar state updates without reusing an old generation request ID.
- `desktop/profile-owner.ts`: a shared OS-held SQLite exclusive sidecar lock prevents two modern hosts opening one writable profile. It also refuses a live older Electron operator discovery. Repeated WPF shortcut launch signals the first native window through a Windows event; it does not start another worker. A crash releases the OS lock without a stale-PID deletion race.
- Close hides the window in the tray; **Exit** drains owned work and closes the store. A sleep/long scheduling gap pauses work. There is no automatic remote scheduling or generation on launch/reconnect. Shutdown failures remain visible; emergency evidence must be preserved before exit.

The existing authenticated operator interface is preserved as an owner-only **Windows named pipe**, not an HTTP/TCP service. The package includes `operator.mjs`; its previous explicit-consent and command restrictions remain. Normal UI communication uses the inherited stdio pipes. Cancellation and Pause have a priority path so they cannot wait behind an authentication continuation; Exit waits for that interruption before closing the store.

PowerShell 7 can pass its module path through ShellExecute. The native shell and protection helper use Windows PowerShell's own built-in module directories for that process only, avoiding incompatible module autoload. This changes neither execution policy nor global environment settings. UTF-8 protocol input uses an explicit StreamWriter because .NET Framework's ProcessStartInfo has no StandardInputEncoding property.

## Function map

| Native section | Preserved operations |
| --- | --- |
| Global toolbar/tray | Pause/Continue, one-shot Eureka, bounded remote context preview/consent/cancel, backup/restore, safe Exit, window reuse |
| Cards | Full candidate text, provenance, parent revisions, references, assessment findings, human decisions/reasons/notes, human revisions, sibling comparisons, recheck/revise, recompost |
| Sources | Add/edit retaining originals, participation/tags, file/pasted import preview with individual duplicate choices, exact context preview, chosen/essential spans, DNA facets, aliases, references and cascade deletion preview |
| References/preferences | Source-specific evidence/status/difference, removal from future context, manually approved global/garden preferences, suggestions from explicitly selected review IDs |
| Growth | Accepted-parent selection, exact revision identities, direction/question, branch lineage and alternatives |
| Drafts/attempts | Filtered/negative/failed outcomes, original model text and complete job evidence, bounded recheck/revise, explicit override and evidence purge preview |
| Garden settings | Name/type/objective/interval, inclusion in schedule, donor permissions/probability, route cancellation/local override, creation/reorder/delete |
| Connections/limits | Local Ollama, optional Groq, installed official Claude Code; Sonnet/Opus/Haiku; protected credential save/remove; auth-only check; paths, budgets, language, export scope, autostart, attention/recovery |
| Journal/data | Stage funnel, calls, request/lifecycle history, documents, validated full backup/restore, readable exports, explicit previews for backup/document/legacy/job/export cleanup |
| About | Version, owner-selected author links and packaged licenses |

The inference contract and historic evidence are unchanged. The React/Electron host remains in source for compatibility and regression tests; it is not needed to start the WPF package. UI redesign can proceed separately under #76/#77.

## Protected credentials

The native host uses Windows DPAPI CurrentUser via a fixed helper with redirected stdin/stdout, never secret command-line arguments, plaintext files or browser storage. Its files live in `native-secrets/`, outside ordinary workspace/backup/export data. Protected sensitive-response recovery is separate too.

Supported legacy Electron v10/v11 envelopes are migrated only after DPAPI key unwrapping, AES-GCM authentication, credential validation and a verified new protected round-trip. A direct legacy DPAPI envelope is supported as well. The old `Local State` and credential files are never rewritten/deleted. Unknown/app-bound/corrupt formats fail closed and require token re-entry. A removal tombstone prevents a deleted token being silently imported again from the preserved old vault. Same-user Windows protection is not cross-account portability.

## Build, acceptance and promotion

`npm run native:build` creates a versioned `release/CompostClub-WPF-*` folder and `native-latest.json`; the package contains no EXE/DLL. Installed Node 24 and Windows PowerShell/WPF are prerequisites. No runtime installation is performed by a shortcut.

The package's `Create-Shortcut.ps1` creates a normal Windows `.lnk` targeting the signed Windows PowerShell host in STA mode with a hidden console. It accepts a chosen data profile and installed Node path. It refuses an existing shortcut unless replacement is explicitly requested, and retains a copy before replacement. It does not start the application, install a service or change execution policy.

`npm run test:native` is real Windows acceptance via ShellExecute of a `.lnk`. It uses only a marked isolated fictional profile, real WPF controls and real Windows protection. The test-mode shell itself disables all inference in its child; it does not rely on environment inheritance through Explorer. Test results are private under `.local/native-acceptance-*`; synthetic cards remain visibly recorded/diagnostic, never genuine inference receipts. Existing domain/process/transport/Chromium tests remain mandatory.

Before changing the main shortcut: validate a complete private SQLite/envelope backup; preserve the old launcher/descriptor and encrypted files; test the exact package on a copy of the owner's profile without inference; compare originals/documents/revisions/cards/jobs/receipts/calls; exercise repeated shortcut launch and safe exit with Smart App Control enabled. Keep a separate pre-migration rollback profile; never replace newer live data with an old snapshot during rollback. Runtime/signature and local Windows acceptance do not establish creative usefulness or authorize a model call, paid signing, external file submission or publication.
