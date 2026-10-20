# v0.1 acceptance record — 20 October 2026

**Historical local acceptance record**, before public source import. The source repository is now public; the website has not been deployed. The checks below describe the recorded local run and do not close later review findings.

The implementation is independent and has no shared runtime dependency. The requested Pages workflow is prepared but has not run. The [initial code review](https://github.com/drevendev/CompostClub/issues?q=is%3Aissue+label%3Areview) subsequently reproduced defects in save limits, startup recovery, retries, bridge concurrency/UTF-8/request parsing and UI state. Earlier passing journeys do not establish correctness for those cases.

## Product gates

| Gate | Evidence / status |
|---|---|
| A01 brand and main cycle | Exact name/tagline, English cozy garden UI, original SVG, worm, responsive layout. |
| A02 new inputs reach a real local model | Chromium journey adds two new inputs and calls real Ollama 1B. Separate 4B fixture pass is real. |
| A03 both sources and quotes | Exact fragment validator, two immutable parent snapshots, Grew from disclosure; raw outputs retained. Semantic usefulness still needs owner review. |
| A04 one welcome slot | Domain tests and reload journey; no welcome farming. |
| A05 idle credit accounting | Boundary tests for 0, 14:59, 15:00, 30/45 minutes, 48 hours, rollback and overflow cap. |
| A06 persistence and absence | IndexedDB reload/restore and pure timestamp reconciliation; no background model claim. |
| A07 errors keep credits | Invalid/no_blend/failure domain tests, simulated transport failure then an explicit real-model retry. No automatic retry storm. |
| A08 request/revision identity | Stale response, duplicate commit, edited source and deterministic pairing tests. |
| A09 keep/recompost/exports | Real Chromium keep/reload/Markdown/JSON/restore journey; sample recompost and source linkage tests. |
| A10 safe import and deletion | 2 MiB/version/shape validation before replacement, counts preview, explicit cascade preview, dependent deletion test. |
| A11 no cloud requests in local journey | Listener before navigation recorded no external startup or inference requests during the real Ollama journey. Browser weight downloads are separately opt-in. |
| A12 local bridge boundary | Binds 127.0.0.1 only; Host, Origin, session token, body and concurrency bounds. API rejection checks cover foreign origin, missing token and oversized body. |
| A13 Chromium and mobile | Desktop + 390×844, keyboard skip/focus, reduced motion, expanded text spacing and modal controls checked. Physical mobile/assistive technology not certified. |
| A14 honest replay | Seven unchanged actual model outputs, exact-pair/language matching, persistent no-live label and labelled export. |
| A15 standalone | Real file:// in offline Chromium, original and renamed/moved path, normal and denied IndexedDB, meaningful replay/keep, JSON download/restore and reload. Listeners reject companion/network resources. |
| A16 actual model evaluation | 97 local calls across baseline/1B/4B, plus four completed browser calls. All raw responses retained, including failures. Owner content review pending. |
| A17 safe public build | Public fixtures only; no model weights, private archives, brief ZIP/DOCX or internal document IDs. Release source is explicitly allowlisted. |
| A18 artifact identity | Build and standalone receipts plus source SHA-256 manifest in release/. No Git metadata is required for the explicit source archive. |

## Verification commands

`npm run verify`: strict TypeScript, type-aware ESLint with zero warnings, 31 Vitest tests and formatting. `npm run build`: relative-path static production build. `npm run package:single`: self-contained recorded HTML under a justified 2 MiB limit. `npm run test:e2e`: seven production Chromium tests with real model calls, plus explicit test-only failure injection. The public-safe run receipt is `evidence/verification.json`; the raw local runner report is excluded from publication. `node scripts/pages-smoke.mjs` separately passed the actual build under `/CompostClub/`, including every worker/WASM asset, sample keep/reload and no external startup requests.

The first e2e pass found an exact-label locator/accessibility issue in the edit field. Explicit textarea accessible names fixed it, and the full suite was rerun. The earlier failure was not an inference success or a waived gate.

## Deliberate limits

- Browser ONNX inference executes but failed response quality/format; it is experimental, with no public live certification.
- 1B passes much of the strict structure contract after narrowing but has weak combinations. 4B is the larger explicit quality fallback; its owner usefulness review remains pending.
- Peak memory, controlled warm-cache loading, another GPU and physical phone tests were not performed.
- The selected fixture pairs are now seen. A future generalisation claim needs a new holdout.
- The UI is a scrollable garden tool to keep source text readable, with a centered responsive three-column patch and real fullscreen, rather than forcing long text into a fixed-height canvas.
- One blend runs per explicit action. There is no automatic background inference queue.
- Failed pair retry is explicit within the session; after reload, edit a source or add a fresh one if that pair was marked failed.
- No video recording, live Pages URL, domain purchase or contest submission is claimed.

These limits do not prevent the local sample garden, exports, offline artifact or live Ollama workflow from working. They do prevent describing the demo as fully certified public browser AI or competition-submitted.
