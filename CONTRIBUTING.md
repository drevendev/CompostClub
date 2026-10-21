# Contributing to Compost Club

Start with a small, reproducible problem. Search [existing issues](https://github.com/drevendev/CompostClub/issues) before opening a bug or proposing a larger change. Use an issue for setup questions too; there is no separate support service or response-time guarantee.

## Local setup

Use Node 24 and npm 11. From the repository root, run `npm ci`, then `npm run dev`. Follow the [sample first run](README.md#try-the-sample-garden). All public examples use fictional inputs. Nothing in the unit suite requires model weights, an account or a paid service.

Before a pull request:

```sh
npm run verify
npm run docs:check
npm run build
npm run package:single
```

For UI or static-asset changes, install the test browser with `npx playwright install chromium`, then run `node scripts/pages-smoke.mjs` and `npm run test:recovery` after building both variants. The recovery suite covers production and offline records without Ollama; see [save limits and recovery](docs/RECOVERY.md). For live-inference changes, follow [Ollama setup](docs/RUNNING.md#run-live-local-gemma) and run `npm run test:e2e` with the real model and bridge. Say explicitly when a hardware-dependent check was not run. Test doubles can test transport errors; label them and keep them out of model evidence.

## A useful pull request

- Explain the concrete behavior before and after the change, with issue links where relevant.
- Keep the patch focused. Add a regression test when it demonstrates a real failure.
- Include screenshots for a visible UI change, plus a text description of the difference.
- Name the checks actually run and any remaining limitations. Preserve failed model receipts.
- Keep domain logic independent of React and inference runtimes. Save results, spent slots and consumed pairs atomically.

Never replace a model failure with a canned success. Recorded mode must match the exact public fixture inputs and remain labelled. Avoid hidden downloads, telemetry, accounts, cloud inference and new paid services.

## Public data boundary

Do not commit private idea archives, user backups, personal paths, credentials, downloaded weights, runtime binaries, original briefing attachments or raw browser reports. Keep local experiments in ignored `.local/`. Public model evidence uses only `fixtures/public/` inputs. Check the staged diff and file list before publishing; `.gitignore` alone does not inspect file contents.

Issue forms ask for a minimal fictional example rather than a real garden export. Redact personal text and addresses from logs and screenshots. Do not post secrets or sensitive vulnerability details publicly. A repository-specific confidential intake and conduct-enforcement process have not been established; no email address or response promise is implied. For sensitive abuse on GitHub, use the platform's report controls.

## Working together

Discuss the code and the evidence respectfully. Harassment, personal attacks and publishing someone else's private data are unacceptable. The repository owner reviews contributions and may close or remove disruptive material using GitHub controls. This is a small experimental project; contribution review and release timing depend on maintainer availability.
