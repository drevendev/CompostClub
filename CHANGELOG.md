# Changelog

Changes describe the source tree. A version heading does not imply an npm package, GitHub release or deployed website.

## Unreleased

- Derive explicit retry choices from saved failed pairs after reload, retaining exact source revisions and previous transcripts, including legacy backups without invented history.
- Keep the add-scrap draft independent of scrap/sprout edit buffers across dismissal, validation failures and successful edits.
- Add an all-discoveries filter alongside kept ideas, so earlier unkept results remain inspectable, editable, exportable and recompostable.
- Accept semantically unchanged output fields in any JSON key order while rejecting actual changes to the original model result.
- Extend Chromium diagnostics to cover reload retries, draft preservation and discovery navigation; retain standalone/offline recovery coverage.

- Retain immutable inference transcripts across retries/reload, including invalid primary/repair responses, no_blend, cancellation and no-response transport errors; add inspection and export.
- Reserve evidence capacity before generation and retain unexpectedly oversized responses in a separate, explicitly managed recovery copy.
- Reject stale normal restores even without Web Locks; keep a distinct before-restore copy without replacing damaged startup-recovery originals.
- Require a complete selected acceptance suite and actual runtime/source/build/model attachments for verification receipts; remove hardcoded live/browser/unit claims and prevent historical receipt overwrites.
- Add focused unit and Chromium P1 regressions with labelled diagnostic stubs; keep real-model acceptance separate.

- Reject oversized original text, history and pretty-printed backups before writing; accepted gardens share save/load/export validation.
- Add recovery for unreadable records with raw download, matching-backup preview, explicit replacement and an atomic retained original copy.
- Add 11 unit regressions and eight Chromium recovery scenarios for production and offline HTML; run the latter in CI.

## 0.1.0 — 2026-10-20

First public source import of the experimental Compost Club garden.

- Add scraps, grow revision-aware pairs, keep/edit/recompost sprouts and inspect exact parent fragments.
- Accrue one pairing every 15 minutes, capped at three, with an immediate welcome slot.
- Store gardens in IndexedDB; export Markdown and versioned JSON backups.
- Ship seven labelled, unchanged local Gemma 3 4B recordings for fictional sample inputs.
- Add a loopback Ollama bridge and opt-in experimental browser WebGPU inference.
- Package a standalone recorded HTML demo and preserve model evaluation evidence, including failures.
- Add contribution guidance, issue forms and repository verification CI. Pages deployment is manual and has not been launched.

Known persistence, recovery, retry and UI defects from the initial review are tracked in [GitHub issues](https://github.com/drevendev/CompostClub/issues?q=is%3Aissue+label%3Areview). Browser model output did not pass its release gate. Model usefulness and additional hardware coverage remain pending.
