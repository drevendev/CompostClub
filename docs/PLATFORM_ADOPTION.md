# Application platform adoption — 2026-10-24

Compost Club remains an independent application. The owner requested extracting reusable
Windows application standards into AppDevelopmentPlatform and reviewing GameDevelopmentPlatform.
This record describes selective guidance adoption; it does not certify a shared runtime.

## Reviewed sources

GameDevelopmentPlatform revision `9a1844451a66a921a126c4972993a3c525119e3c`, read on
2026-10-24: platform boundaries, author identity/profile, atomic commands, guided first run,
recovery artifacts, staged release acceptance and human-directed AI assistance.
The reference repository was read only. Its private URL is deliberately absent from public UI.

| Practice | Compost Club disposition | Evidence / limit |
| --- | --- | --- |
| Independent app, copied guidance, project-owned lockfile | Retained | No platform runtime or automatic synchronization |
| Atomic commands and authoritative previews | Already implemented | Domain transitions and SQLite transaction tests; failures keep pairing slots |
| Preserve originals and distinguish recovery artifacts | Already implemented | Raw responses, retained revisions, validated backups, cascade previews; Codex exports are not full backups |
| Guided first success | Adapted guidance | Existing welcome and paused desktop first run; no new tutorial state machine |
| Stage and test the exact delivery | Adapted and corrected | Acceptance screenshots now stay in run artifacts instead of changing source PNGs; standalone/source hashes, real Chromium and exact packaged EXE acceptance remain separate |
| App-owned author identity | Added | Browser/offline About and desktop About; local profile and exact external-link allowlist |
| Human-directed, AI-assisted attribution | Added narrowly | Attribution describes the process; dependency licenses and model provenance remain separate |

## Identity copy

`src/content/author.ts` is an app-owned, selected copy. Author: **Dreven**, public name
**Aleksei Bogun**, solo developer. Telegram and itch.io come from the reviewed profile
(`identity/dreven/profile.json`, blob `d25b9a1fc0ff540cce9c7d21294f60f630b27075`).
GitHub and DEV match the owner's established project/profile links; the owner supplied the
current `https://x.com/drevendev` destination on 2026-10-24. No logo bytes were copied.
The legacy disabled Twitter entry was not enabled automatically. These are account links,
not evidence that another repository is public. HTTPS destination availability is not certified.

Desktop navigation permits only the five exact selected destinations, opens them in the
system browser on selection, and denies embedded popups and other external destinations.
Imported ideas and model responses cannot supply these URLs. Merely opening About causes no
network request. Browser links use `noopener noreferrer`.

## Scope and rollback

AppDevelopmentPlatform v0.1 captures a Windows-first standard, architecture/security/lifecycle
contracts, acceptance matrices, versioned adoption and release templates. macOS is a planned
adapter and acceptance target, not supported by Windows evidence. Compost Club is the first
source project; two independent adopters are required before promoting common runtime code.

Rollback removes the local author component/profile, their imports/desktop navigation policy,
About page and styling together. This changes no save schema, model contract or persisted data.
Do not roll back unrelated existing desktop work or change the reference platform.

## Verification for this delivery

Use the current release identity and acceptance results delivered alongside the standalone
HTML and source archive. Historical receipts remain historical. Sample replay, unit diagnostics,
real desktop acceptance, live model quality and the owner's long-running pilot are separate claims.
