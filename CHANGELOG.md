# Changelog

Changes describe the source tree. A version heading does not imply an npm package, GitHub release or deployed website.

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
