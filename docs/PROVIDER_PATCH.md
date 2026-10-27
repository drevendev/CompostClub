# Manual providers · 0.2.0-rc.4 candidate

This patch implements #91 with the owner's 27 October clarification: **Claude through the owner's subscription is the primary external connection**. Groq is an optional separate API service. The launcher/updater, arbitrary endpoints, remote scheduling and mixed-provider stages remain separate work.

This is an experimental source/PR candidate. A successful schema check or synthetic transport test is not model quality evidence. Local Gemma RU issues #82/#83 and the owner usefulness gate remain open. No existing installation or personal garden is replaced by building this candidate.

## Claude subscription setup

1. Install official Claude Code yourself, or use the existing installation. Compost Club never bundles, patches or downloads it. The Windows adapter requires the official `claude.exe`, version 2.1.259 or later.
2. If you already created a setup-token, enter it in **Settings → Claude subscription → Claude setup-token → Save setup-token securely**. It is stored separately from ideas using operating-system encryption. Do not paste it into a chat, source file or `.env`. Ordinary `claude auth login` is an alternative; a new login is not required merely because you already have a setup-token. The adapter does not activate API billing.
3. Open desktop **Settings → Generation connection → Claude Code**. The normal npm installation is detected; another official native installation can be selected by its absolute executable path.
4. Choose **Check Claude login without generation**. This checks CLI version/authentication and makes no creative model call. A missing login is an actionable refusal, not a successful inference receipt.
5. Add/select fictional test sources, then use Eureka, manual pairing, development or recheck. Read the complete context preview, including donor material and any retained draft. Authorize this one task explicitly.

For an operator-owned script environment, official `claude setup-token` may provide `CLAUDE_CODE_OAUTH_TOKEN` to the application process. The optional UI field stores it in a separate OS-encrypted credential file; environment-based usage remains available. Neither path copies it into the idea database, command arguments, backups or exports. The adapter accepts subscription authentication, not an implicit switch to a paid API key. Account and organization policies still apply.

Claude Code runs as published by Anthropic. Each stage receives text through stdin in an isolated application directory. The invocation disables tools, MCP servers, skills, customizations, hooks, session persistence, auto-updates, telemetry, API retries and agent continuation; it limits the CLI to one turn. No project folder, extra directories, resume ID, fallback model or executable idea content is supplied. An unexpected turn count is a failure. Known managed-policy files require a separate review because application flags cannot override administrator policy. This is a bounded CLI configuration, not an OS security sandbox.

The requested model alias is `sonnet`; the actually reported model is retained separately when present. No weight digest is invented. The application counts each dispatched CLI stage conservatively even if cancellation leaves remote usage uncertain.

## Optional Groq setup

Groq is unrelated to a Claude subscription. It offers model-dependent API quotas, whose availability and limits must be checked in the owner's account.

1. Visit [Groq Console](https://console.groq.com/), sign in yourself and open **API Keys → Create API Key**. Do not enable a paid plan for this preview.
2. Select **Groq API** in desktop Settings and enter the key in its password field. It is encrypted by Electron `safeStorage` using the operating system. If encryption is unavailable there is no plaintext fallback.
3. The fixed endpoint is `https://api.groq.com/openai/v1/chat/completions`; the requested model is `openai/gpt-oss-20b`. Other endpoints/models are not silently substituted. JSON object mode is domain-validated; strict schema decoding is not claimed.
4. Preview and authorize one task as with Claude. Authentication, rate/quota failures and truncation remain visible. No SDK retries or redirect forwarding are enabled.

The application neither creates a provider account nor pays for usage. Keys can be removed in Settings. Removing a credential does not erase previously generated ideas or provider-held data.

## Consent, accounting and recovery

- Local Ollama remains the default. Choosing an external provider pauses automation. The timer never dispatches remote work, including after restore, wake or restart.
- Preview is read-only and expires after five minutes. Consent binds the exact workspace revision, source revisions, frozen pair/route, provider configuration, context and optional retained draft. Any intervening state change requires a new preview.
- Consent covers generation, screening of its future draft and at most one shared format repair, within the displayed reserved call count. No other source context or provider is added. Donor permission is checked separately; p=0 includes no donor text.
- Duplicate confirmation returns the existing request state. Preview/consent does not survive restart as authority to send. Restoring imported consent metadata cannot grant permission in a new session.
- Calls are reserved durably before possible dispatch. Cancellation, missing responses, quota errors and restore cannot refund spent calls. A successful card, consumed pair and credit commit atomically. Errors, cancellation and honest negative results keep the credit.
- Remote Pause means local waiting and future dispatch are stopped. It cannot certify cancellation on the server, remove already transmitted data or refund subscription/API use. Late replies are retained and cannot commit after pause.
- Original model/transport responses remain private and inspectable. Authentication headers are never stored. If a server reflects an explicitly known credential, the original is isolated in encrypted recovery; ordinary journals receive only a disclosure. If secure retention fails, the original remains in memory and Exit is blocked until protected recovery succeeds.
- Idea backups contain jobs, decisions, provenance and raw evidence, but no credential file. Safe reading exports omit private parent context and transcripts. Provider/requested/reported model and human edits remain disclosed.
- Restore retains the installation's provider settings, CLI/runtime paths and charged calls. Historical jobs retain their original contracts and judgments. New provider metadata does not retroactively verify imported claims.

## Acceptance boundaries

Automated diagnostics use explicitly fictional sources, sentinel credentials and fake transports/processes. They test Unicode schema/parser consistency, repeated echo failures, preview/consent races, cancellation, errors, debt, provenance and backup/export boundaries. They never count as genuine Claude/Groq results.

The new fictional matched RU/EN set and controls are frozen in `fixtures/public/provider-acceptance.json`. The opt-in environment-token `node --import tsx scripts/provider-evaluate.ts --run-genuine-claude` harness (or `node scripts/run-provider-evaluation.mjs --run-genuine-claude --token-profile ABSOLUTE_PREVIEW_PROFILE` for the OS-encrypted UI token) allows one variant, ten pipeline attempts (at most 30 calls) and three explicitly authored damaged-draft checker probes (at most six calls), with a total ceiling of 36. It probes authentication before creative calls and never runs as part of verify. Record the input/rubric, provider, variants, maximum calls and stop condition before sending. Previously observed cases stay regressions. Do not repeat until a convenient pass, generate missing citations, remove failed cases or promote a model self-check into owner usefulness approval.

The complete validation and actual authentication/live status for the final package are recorded in `PROVIDER_PATCH_ACCEPTANCE.md`. A draft PR may expose an uncompleted live gate honestly; release promotion requires the applicable genuine checks. Recorded standalone HTML proves only its labelled fixed-fixture journeys.

Official references checked 27 October 2026: [Claude authentication](https://code.claude.com/docs/en/authentication), [programmatic CLI](https://code.claude.com/docs/en/headless), [CLI flags](https://code.claude.com/docs/en/cli-reference), [environment variables](https://code.claude.com/docs/en/env-vars), [Claude Code integration terms](https://code.claude.com/docs/en/legal-and-compliance), [Groq quickstart](https://console.groq.com/docs/quickstart), [Groq structured output](https://console.groq.com/docs/structured-outputs), [Groq quotas](https://console.groq.com/docs/rate-limits).
