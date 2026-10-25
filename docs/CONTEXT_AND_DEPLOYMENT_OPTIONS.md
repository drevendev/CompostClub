# Birth context, local insights and mobile/shared-storage deployment options

**Decision document, not an installation guide.** Owner requested options on 21 October 2026. Nothing is hosted, purchased, enrolled or connected by this document. Current **Idea DNA, micro-GA and Tree work locally without these options**: see [IDEA_EVOLUTION_SPEC.md](IDEA_EVOLUTION_SPEC.md) and [#60](https://github.com/drevendev/CompostClub/issues/60).

## A. Truthful metadata vs genetic traits

On new idea entry, keep UTC timestamp plus actual local timezone/offset if available, day-of-week/month/daypart (night/morning/afternoon/evening), and user-selected origin type. Text language is independently tagged with manually reviewable en/ru/mixed/other/unknown. Distinguish *entered into the app* from *originally thought/heard* as two different dates.

**Don't turn context into DNA.** The author being outdoors during a rainy evening is not a trait inherited by their offspring idea. Context belongs to a separate optional personal journal layer. Legacy records lacking historical timezone/weather/location are unknown, not retrospectively attributed current conditions.

### Tagging
- **Manual-first** works with no model.
- Optional local Gemma classification suggests 1–5 tags and up to 3 short genome genes, bounded JSON/taxonomy, OFF by default. Owner explicitly accepts/edits proposals; no model confidence = verified truth.
- No background inference on idea save, no third-party text upload. Details in [#55](https://github.com/drevendev/CompostClub/issues/55).

### Private analytics
- On-demand charts for weekday/daypart/month, language, tags, idea source category, manual vs generated, accepted offspring and tree depth; show missing/unknown counts and honest denominators.
- Prefer recompute from local records rather than persistent tracking events. Insights can be hidden/disabled. No SDK, cookies, server, or causation claims like "rain makes your brain smarter".
- Data can be filtered by garden only when named gardens ship. Details in [#56](https://github.com/drevendev/CompostClub/issues/56).

### Optional weather/location acquisition
Off by default and separately controlled:
1. **Manual weather**: user marks rainy/sunny/overcast/windy/indoors/unknown; works offline.
2. **Manual place**: optional text category such as home, walk, train, optional city. No GPS required.
3. **Browser geolocation**: user explicitly clicks to request a **one-time fix** using secure-context HTTPS API. Do not use watchPosition. Device permission does not equal weather-provider consent. Default do not store exact coordinates. Denied/unsupported => unknown, never blocks idea entry.
4. **Weather data**: only after another explicit switch and visible third-party host disclosure, fetch a coarse point/city and a valid weather snapshot for creation time, with source + fetchedAt and attribution. For historical idea entry, do not misrepresent today's forecast as yesterday's actual weather. Missing data => unknown.
5. Context deletion/export controls: disable stops future capture; past recorded environment stays until explicitly purged. Public shareable DNA cards omit geography/precise times/raw context by default.

**Candidate provider**: Open-Meteo no API key/card on the FREE **non-commercial** API; data license CC BY 4.0 attribution. Official terms classify commercial promotional apps as commercial use, so no free-tier integration should ship silently in a monetized product. Re-evaluate live terms before offering external API; manual weather avoids provider dependency. [Official terms](https://open-meteo.com/en/terms), [pricing](https://open-meteo.com/en/pricing), [historical API](https://open-meteo.com/en/docs/historical-weather-api), [MDN geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API).

## B. Four deployable architectures

| Setup | Data owner/source of truth | Phone user experience | Real local Gemma from phone? | Cash/ops | Near-term status |
| --- | --- | --- | --- | --- | --- |
| **A. Current static local** | IndexedDB, separate per device+origin | Mobile-responsive sample/edit in own browser; no shared state | Not the PC Ollama bridge; browser WebGPU candidate still quality-failing | $0 service; low ops | CURRENT code |
| **B. Manual file handoff** | Separate browser databases + explicit JSON backup | User shares file/imports and resolves conflict manually | Only after using that file on PC or installing supported mobile runtime | $0 service; user effort | Option, partial existing backup feature |
| **C. Private Home Hub** | PC-hosted SQLite + backups, one authenticated local user | SAME garden, read/write and model calls from authenticated phone, online when PC is awake | YES via private backend -> loopback Ollama on PC | $0 cloud subscription possible with existing PC & free personal tailnet, hardware/energy nonzero | **Recommended first REAL sync** after demand |
| **D. Hosted private/multiuser** | Durable hosted DB (Postgres) + auth + backups | Same shared garden anywhere with internet and mobile UX | Only with explicit home-worker bridge or hosted GPU model | Variable, potentially paid/card/ops/security | Research/defer |

### Option A — GitHub Pages & local app (current)
GitHub Pages serves HTML/CSS/JS only. It cannot store a user's common DB, host always-on Node/Ollama or sync phone and desktop by itself. IndexedDB is origin-scoped in each browser and device; switching domain from .github.io to a custom .tech origin does NOT magically migrate existing IndexedDB. Export/import is required. Hosted Sample Garden is visibly **recorded real Gemma outputs**, not a hidden live server. Browser ONNX 270M/1B previously ran but failed its four-response structural smoke; do not advertise it as dependable.

The current local Ollama bridge binds 127.0.0.1 and checks Origin/Host/token. Do NOT expose its port to LAN or turn wildcard CORS on to let public Pages call it.

### Option B — low-tech portability
Use explicit JSON export+import from phone Files or user-selected folder; preview conflicting idea revisions and restore backup. A user may carry their own file in Drive, but no direct background sync or Drive OAuth is implied. No shared authoritative DB: if phone and PC edited concurrently, conflicts require user action. A simple PWA install may make app easier to open, but does not solve sync.

### Option C — private one-user Home Hub (first plausible cross-device implementation)
Add a **separately secured** Node 24 HTTP API and local SQLite durable DB with transactional revisions, data migration, read/write/export routes, explicit backup/restore, rate-limit and sessions. The existing desktop browser and phone both talk to this **one** DB via **HTTPS** and authenticated access. Mobile interface remains the same responsive React client. The hub forwards bounded AI requests internally to Ollama listening only on loopback on PC.

For remote/private phone access, use Tailscale Serve (or audited equivalent) with personal tailnet and HTTPS instead of publicly exposing a router port. Tailscale personal currently advertises $0 for non-commercial use, up to six users and unlimited devices; verify eligibility/terms prior to installation. Device must be logged in and owner PC on. Add app-layer auth/CSRF/CORS/Origin & session controls rather than treating a private network as the only security. Do not use Tailscale Funnel (public internet) for a private personal archive.

First MVP **online-only writes** + polite disconnected state; no offline multi-master edit queue or last-write-wins merge. Test phone vs desktop optimistic concurrency, backup restoration, lost PC network, session revocation, trusted HTTPS and GPX/weather privacy. Real physical iOS/Android must be tested before claiming support. Source: [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve), [Personal pricing](https://tailscale.com/pricing).

### Option D — cloud-hosted service (only if genuine adoption)
API+authorization, durable database, backup/restore and privacy, versioned client/schema, per-account rate limits/abuse management, trusted model worker. A hosted database can be free trial, but **never accept 30-day-expiring free database as the sole canonical personal archive**: Render's Free Postgres expires after 30 days, lacks backups, and deletes after grace. [Render Free limits](https://render.com/docs/free).

The model can run (a) in browser only after genuine success on target hardware, (b) on user's authenticated PC worker connected outbound to service, or (c) on actual paid GPU provider. Cloud-hosted Gemma is not magically free. Multi-user collaboration requires another explicit design for sharing permission, consent, retention and payment; none is included in current local patch.

## C. What changes for mobile

Current code can be designed/responsive for mobile and can capture device local time without any backend. Precise location requires HTTPS and explicit device permission. If user expects to input ideas on phone and read/edit them later on PC, there must be **shared persistence**, so either manual JSON transfer (B) or hub/cloud DB (C/D). A PWA, local cache or putting the site on Pages does not unify databases.

Source: [IndexedDB same-origin scope (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology), [GitHub Pages static architecture](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [#59 Mobile](https://github.com/drevendev/CompostClub/issues/59).

## D. Recommended sequencing and decision gates

1. **NOW, zero new infrastructure:** deliver DNA/GA/Growth #50–#54 in current local app. Manual birth tags immediately, no weather/API/GPS.
2. **Small opt-in extras:** local tag suggestions #55, on-device charts #56, manual weather/context #57.
3. **Named gardens:** #42–#44 after schema proof, still all local.
4. **Only with validated two-device use case:** compare manual file import (B) against dedicated one-user Home Hub (C). Prefer C for actual live shared state, but it imposes extra operations/security even at $0 subscription.
5. **Only if real external demand/monetization:** evaluate D with a fresh pricing/legal/security check; never tie current contest launch to it.

Exact permissions before any new infrastructure: owner opt-in to Tailscale account, external weather calls, hosting terms, public URL/domain, migration of local personal data, authentication defaults, retention policy and any paid resource. No autonomous provisioning or billed service from this document.

### Architecture acceptance
- Local v0.1/next release still works without weather/location/sync and never calls a public endpoint unexpectedly.
- Browser/mobile prompts for GPS only on user-initiated opt-in, not on add or opening sample; 0 context means no data/identifiers are sent.
- Shared hub when built truly has one canonical DB (not synced IndexedDB copies) and testable two-device write conflict, login/session revocation and outage recovery.
- Export and deletion cover all application-owned data, including private recovery histories, generated DNA and manually provided places.
