# Optional operator services

Sentry is the only connected optional monitoring service. Local ideas, IndexedDB saves, Gemma, backups and the recorded standalone HTML do not require a service account. Separate owner-authorized manual Claude/Groq inference is described in [the provider guide](PROVIDER_PATCH.md); monitoring never gates it or local/offline work. No end-user account, paid upgrade, payment method or automatic download is introduced. Operator metadata authorization: 22 October, extended to desktop provider operations on 28 October 2026. Render and Entire remain declined; earlier notes below are historical.

## Sentry — operator metadata tracing only

Use a separate `compost-club` Node project in the existing organization. Never reuse another project's DSN or alter its configuration. The owner account was inspected on 22 October: Sponsored Business, no payment method, no billing details, pay-as-you-go limit $0. Quotas are shared across the organization; this is not a new independent free allowance. Sponsorship terms can change; recheck billing before use.

Copy `.env.example` to ignored `.env`. Set `COMPOST_SENTRY_ENABLED=1` and the Compost Club project DSN locally, then run:

```sh
npm run build
node --env-file=.env server/index.mjs
```

Do not put DSNs in Vite variables or frontend code. Health/connection status discloses whether monitoring is enabled. The SDK is imported only after explicit opt-in and a supported HTTPS ingest DSN. Browser bundles and recorded HTML contain no Sentry client. Automatic integrations, request/console breadcrumbs, logs, replay, profiles and client reports are disabled. Only fixed generation-stage labels, known model/prompt version, real durations and actual token counts are eligible for upload. Source text, prompts, repair details, outputs, raw errors, IDs, local paths, hostnames, users and request data are excluded. Final transaction serialization uses an allowlist. IP transport information inherently reaches the provider; the SDK sends the explicit anonymization placeholder `0.0.0.0` instead of allowing connection-IP fallback. Server-side IP scrubbing and recursive `$user.geo.**` removal, plus sensitive fields city/subdivision/subregion/region/country_code/ip_address, must be verified as well. Merely dropping a geo container did not remove enriched leaf attributes in an early test.

Traces represent the local bridge call and bridge-side structural validation. They do not measure browser validation, atomic persistence or semantic usefulness. A short response can be structurally valid and still be a poor idea. The client independently journals and validates raw results. Independent calls start isolated traces rather than inheriting one global trace ID. At most five buffered envelopes, three-second outbound timeout and no redirect/retry loop; rejected or unavailable telemetry must not block inference. Raw model failures stay local.

Before sending personal data, inspect actual envelopes with synthetic sentinels in prompts, responses and errors. Verify stored Sentry event JSON excludes source IP/geo, including provider enrichment. A genuine public-safe local Gemma trace is required before claiming Sentry Agent Tracing in an article. Do not use another project's evidence.

### Desktop provider tracing

The desktop adapter uses the same sanitizing observer for provider/model selection, authentication, consent, release, generation/screening and structural validation. A private profile may opt in using `operator-telemetry.private.json` with `format: "compost-operator-telemetry-1"`, `enabled: true` and the existing Compost Club project `dsn`. Process environment flags also work. No browser client or product analytics is added. Settings shows whether it is enabled. Invalid/disabled profile configuration turns monitoring OFF without blocking the garden. Even a monitoring promise that never settles cannot retry or gate a business operation. Model versions/usage are observed metadata, not quality or cost estimates.

This operator file and profile crypto metadata stay outside idea backups, reading exports, portable contents and source archives. For desktop opt-out set profile `enabled` to `false` and restart (this takes precedence over inherited opt-in); alternatively clear process opt-in where no profile configuration exists.

### Disable and remove

Set `COMPOST_SENTRY_ENABLED=0` (or remove the DSN), stop the local server and restart it. Environment changes apply at process startup. No network/SDK initialization occurs in the new OFF process. To remove the integration entirely, replace `createObserver()` with the documented no-op object in `server/observability.mjs`, remove the SDK dependency with `npm uninstall @sentry/node`, and remove the observer initialization/import if desired. Keep the small `run(meta, fn)`/`tokens`/`validate` interface or inline the original local function; no garden migration is needed. Run `npm run verify` and Chromium acceptance again. Uninstalling does not delete data already held by Sentry: separately review event retention/project deletion in its dashboard. Never delete shared organization/PatchPitch settings.

## Render — declined, no deployment performed

The owner decided not to use Render. `render.yaml` remains an inert static frontend blueprint from PR #65: Node 24, `npm ci && npm run build`, output `dist`, automatic deployment OFF. No service or account was connected, and the blueprint does not establish eligibility for a Render category. Do not deploy or connect an account without a new explicit request. It cannot reach the owner's loopback Gemma. The existing Pages video remains unchanged.

Render has bandwidth/build limits; without a payment method free resources can be suspended. Promo credits are optional, expiring billing credits, not a hard budget cap. The official [HF26 hub](https://dev.to/challenges/hf26) points to [participant promos](https://hacktoberfest.com/my/promos). No code/value/expiry was verified in the owner's unavailable promo dashboard. Do not select paid resources while waiting for a bonus.

Each Render/Pages/local origin has its own IndexedDB garden. Export then import explicitly before changing origin; hosting is not synchronization. To remove Render, disable/delete only that service, revoke its repository permission if unused and remove `render.yaml`. Pages and local operation are unaffected. No database, domain or hosted Ollama is provisioned.

## Entire — declined, not installed

The owner decided not to use Entire. No account connection, CLI installation or session capture was performed for this project. The earlier investigation concerned [Entire](https://entire.io/login) and its separate [MIT CLI](https://github.com/entireio/cli); no verified public promo code was found. The following safety/removal notes are retained only for a future separately requested evaluation.

Use a clean separate checkout and a new public-safe task. Check the exact installed version and Windows/Codex support. Do not capture this private conversation, ignored briefing files or owner idea data. Disable optional usage telemetry and inspect hooks/remotes/checkpoint push behavior. GitHub stays canonical; no automatic mirroring. Public session sharing follows a separate content review and owner approval. Until then, no Entire category claim.

Disable with the installed CLI's documented `entire disable`. Inspect its uninstall options and remove only its hooks/config/credentials/remotes, preserving unrelated hooks. Test Git, Codex and npm workflows with it removed. Disable/uninstall stops new capture but does not erase Git objects or published session data; cleanup requires a separate reviewed action. No history rewrite or automatic garbage collection.

## Small idea branches

Keep a personal sprout, choose **Tend this idea**, select a direction and ask installed local Gemma for one short English continuation. Review, optionally edit, then Accept or Reject. An accepted branch can be selected as a parent, or the same parent can produce alternatives. An unfinished experiment requires human editing before acceptance. One ready slot is consumed atomically on acceptance; reject, failure, `no_growth` and cancel retain it. No background inference, growth replay or claim of proven market demand.

`tend-1` growth records are an additive optional field in v1 backups. Old backups without it remain valid; pending runs become cancelled on restore. The bound is 100 records, two original responses per run, 64 KiB per response and the existing validated 2 MiB garden cap. A 192 KiB reserve is checked before requesting a proposal. Parent order rejects cycles/orphans; source deletion previews and cascades through dependent branches. Original model text, edited accepted text and parent snapshots remain separate. JSON backup retains full evidence; branch-outline export is readable and omits raw transcripts.

Before using an older build, export a complete current backup and restore a pre-growth backup there. Older builds do not understand the new ancestry field and must not edit/delete a garden containing growth records. This slice is incremental growth, not the full DNA/genetic-algorithm epic #60.

## Privacy exports and retained copies

Single-idea export opens a preview explaining that both source texts are included. Raw inference is OFF by default and requires its own checkbox. Full garden JSON/Markdown exports include private history. Source deletion affects the active garden only; Backup and export lists independent recovery/before-restore/inference copies. Each can be reviewed and permanently removed using exact-original comparison in one transaction. Changed copies are rejected; downloaded files and other browsers remain separate.
