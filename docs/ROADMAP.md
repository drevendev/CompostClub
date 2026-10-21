# Roadmap — 21 October 2026

The next milestone is a dependable small creative workflow and an evidence-backed project story. [Current audit](AUDIT-2026-10-21.md). [Release tracking issue #29](https://github.com/drevendev/CompostClub/issues/29).

**Publication sequence approved for planning, not yet published (22 October 2026):** [Publication Roadmap — DEV/X articles and feature-triggered video scripts](PUBLICATION_ROADMAP.md). **Launch the current v0.1 first:** one official Week 3 DEV entry supported by a real reviewed/uploaded ~89s narrated sample video or independently verified Pages, plus lightweight X cuts. Then stagger the small-model engineering and idle-design ordinary DEV essays. **Only after tested releases** tell DNA → Tree Growth → real GA → Named Gardens / Cross-Pollination → Insights → Mobile stories. No future functionality may be edited into the current contest demonstration as if shipped. Media credits / synthetic narrator disclosures belong with each uploaded asset.

**Owner decision, 21 October 2026:** the **next LOCAL implementation package** is **Idea DNA + small real genetic algorithm + deliberate growth tree** with truthful birth metadata, all in the current React/TypeScript/IndexedDB/local Ollama setup. [Current evolution specification](IDEA_EVOLUTION_SPEC.md) and [implementation epic #60](https://github.com/drevendev/CompostClub/issues/60). This is **NOT shipped in the public v0.1**, needs separate tests, and does **not** require mobile/cloud servers. Optional hosted/mobile options are documented separately in [Context & Deployment Options](CONTEXT_AND_DEPLOYMENT_OPTIONS.md).

The first P1 implementation batch merged in [PR #37](https://github.com/drevendev/CompostClub/pull/37), closing #31, #32 and #36: persisted inference transcripts, stale-restore protection and evidence-derived acceptance receipts. Its [live acceptance](../evidence/p1-verification.json) contains 63 unit results and seven Chromium journeys with two real local-model outputs. Six additional P1 diagnostics and eight recovery scenarios passed separately. The earlier [real model error](../evidence/model/p1-live-failure.json) is retained alongside the later successful run; neither run is a new creative-quality benchmark.

The workflow batch merged in [PR #38](https://github.com/drevendev/CompostClub/pull/38), closing #11, #12, #13 and #21: explicit retries after reload, independent add/edit drafts, access to all discoveries and order-independent JSON field comparison. Its validation covered 76 unit tests, eleven P1/workflow Chromium scenarios and eight recovery cases. The [sample/offline receipt](../evidence/workflow-verification.json) records four ordinary Chromium journeys and identifies that tested source/build. This batch did not rerun live inference.

The source-history/pairing batch merged in [PR #41](https://github.com/drevendev/CompostClub/pull/41), closing #34, #14, #17 and #35: raw text revision history, independent skip navigation, separate slot/pair-exhaustion copy and indexed selection at the supported capacity. The repository reports 91 unit tests, nineteen P1/workflow/stability Chromium cases, eight recovery cases and four ordinary sample/offline journeys from its recorded checks. The [stability receipt](../evidence/stability-verification.json) explicitly binds an intermediate dirty source/build rather than certifying a fresh exact-main post-merge run; [synthetic capacity data](../evidence/pairing-capacity.json) is not model speed. Live inference was not rerun in this batch. The next reliability work remains bridge #8/#9/#10/#23, then browser lifecycle/provenance and #39/#40 privacy/export behaviour.

## Baseline delivered

Local UX revision prepared after video review: compact workspace, paged source previews with full-text readers, a collapsible composer, paged discoveries, and source dialogs replace the nested pile scrollbar and expanding root cards. A fresh floral demo verifies zero scrolling throughout its real sample journey. This revision is prepared for a draft PR; article/video publication remains separately gated; it does not change inference or storage rules.

- Public MIT React/TypeScript/Vite source, exact direct pins, project lockfile, Node 24 / npm 11.
- Separate personal/sample gardens, exact-fixture replay, earned slots, immutable sprout parents, keep/edit/recompost and Markdown/JSON export.
- Save/load limits and startup recovery shipped in [PR #30](https://github.com/drevendev/CompostClub/pull/30), closing #6/#7. The audit reran 42 unit tests, eight recovery and four sample/offline Chromium scenarios successfully.
- Standalone recorded HTML and production build tested under a Pages-style subpath. Hosting has not been deployed.
- Historical real Ollama/browser experiments with unchanged public transcripts. Creative usefulness still needs human review; the audit did not rerun live-model evaluation.

## 1. Stabilize the user's work

| Outcome                                     | Issues                                                                                                                                                                          | Exit criterion                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Inspectable failures and deliberate retries | [#31](https://github.com/drevendev/CompostClub/issues/31), [#11](https://github.com/drevendev/CompostClub/issues/11)                                                            | Invalid primary/repair responses and no_blend survive reload/export; retry preserves slots and checks source revisions.                      |
| Safe backup replacement                     | [#32](https://github.com/drevendev/CompostClub/issues/32), [#21](https://github.com/drevendev/CompostClub/issues/21)                                                            | Stale restores fail safely without Web Locks; JSON key order does not invalidate unchanged values.                                           |
| Recoverable text and discoveries            | [#12](https://github.com/drevendev/CompostClub/issues/12), [#13](https://github.com/drevendev/CompostClub/issues/13), [#34](https://github.com/drevendev/CompostClub/issues/34) | Edits preserve unrelated drafts and source history; earlier unkept results remain accessible.                                                |
| Clear and responsive pairing                | [#14](https://github.com/drevendev/CompostClub/issues/14), [#17](https://github.com/drevendev/CompostClub/issues/17), [#35](https://github.com/drevendev/CompostClub/issues/35) | Skip navigation preserves the garden; exhausted pairs differ from earned slots; selection at supported capacity does not freeze interaction. |

Prioritize data/trust defects before extra features. Retain atomic result/pair/slot writes, bounded backups and existing recovery regressions throughout.

## 2. Make the AI boundary trustworthy

- Fix bridge concurrency, UTF-8 decoding and request-target error containment [#8](https://github.com/drevendev/CompostClub/issues/8), [#9](https://github.com/drevendev/CompostClub/issues/9), [#10](https://github.com/drevendev/CompostClub/issues/10), plus static 404s [#23](https://github.com/drevendev/CompostClub/issues/23). Exit: isolated real-HTTP regressions and actual Ollama journeys pass on the release candidate.
- Gate known-failing browser generation clearly [#16](https://github.com/drevendev/CompostClub/issues/16); fix cancellation before adapter acquisition [#33](https://github.com/drevendev/CompostClub/issues/33). Use a bounded repair experiment before recommending another large download.
- Distinguish imported claims from verified bundled recordings [#22](https://github.com/drevendev/CompostClub/issues/22); derive verification receipts from the actual complete run [#36](https://github.com/drevendev/CompostClub/issues/36).
- Human-review both-parent synthesis, concrete mechanism and requested language [#20](https://github.com/drevendev/CompostClub/issues/20). Preserve failures/denominators and use a new unseen set for generalisation claims. Keep 4B as the explicit larger quality option while 1B remains weaker.

Exit: UI, exports, article and receipts agree on generated/replayed/imported/failed/verified status. A JSON pass never certifies usefulness.

## 3. Prepare the Week 3 article and demonstration

Start this alongside stabilization; a private-archive case or new feature set is not required.

1. Adapt [DEV_DRAFT.md](DEV_DRAFT.md) to the official English template: What I Built, Demo, Code, How I Built It, Why Does Open Innovation Matter, optional actual payoff, and applicable prize category.
2. Show three exact fictional-fixture Gemma examples and meaningful failures. Explain the credit mechanic and provenance/usefulness distinction. Claim no measured savings or adoption without evidence.
3. Provide either an owner-authorized verified Pages deployment [#15](https://github.com/drevendev/CompostClub/issues/15), or a real video of the recorded sample and clearly identified local live generation. Hosting is not mandatory when a video is provided.
4. Check exact source/build identities, public-data boundaries, external links and limitations. Prepare repository presentation [#25](https://github.com/drevendev/CompostClub/issues/25) and review Actions changes [#26](https://github.com/drevendev/CompostClub/issues/26) within the chosen release path.
5. Owner reviews and separately authorizes publication/submission [#19](https://github.com/drevendev/CompostClub/issues/19). Retain the real article URL/time; disclose later code commits as required by the contest FAQ.

[Official Week 3 rules](https://dev.to/page/hacktoberfest-week3-2026-10-19-contest-rules), checked 21 October: new project built within 19–25 October, open-source AI core, Slow and Steady theme, explanation of open innovation, source, demo **or video**, DEV template/tag. Deadline: **25 October 2026, 23:59 PDT = 26 October, 08:59 Asia/Nicosia**. Writing quality carries the highest weight. This deadline does not promise that every backlog item will be closed by then.

Best Use of Gemma fits the demonstrated implementation. Additional partners, domains and paid services are unnecessary for this path. The article must identify remaining experimental behavior.

## 4. Prove usefulness in one real workflow

Complete the private, owner-reviewed pilot [#18](https://github.com/drevendev/CompostClub/issues/18). Keep archive text and private receipts private. For each fixed pair record A/B contribution, integrated mechanism, language, keep/maybe/discard and the owner's reason.

Publish paraphrased real-derived excerpts only after approval of their exact content [#24](https://github.com/drevendev/CompostClub/issues/24). Take one owner-chosen sprout into a tiny experiment, or record a reason to reject/hold it [#27](https://github.com/drevendev/CompostClub/issues/27). Export alone does not prove adoption. This case can strengthen the story, but private disclosure is not a contest prerequisite.

Exit: a traceable human decision and, where chosen, a reviewed experiment artifact, with denominators and negative results.

## 5. Choose a small v0.2 from observed use

- Measure controlled warm-cache loading, peak RAM/GPU memory, another desktop and a physical phone before broad browser support claims.
- Improve source-fragment choice if human review shows a benefit.
- Consider plant variations or a shareable static card only after save/history/retry behavior is dependable.
- Prepare optional technical follow-up/social drafts [#28](https://github.com/drevendev/CompostClub/issues/28) from approved evidence and actual links.

Continue without accounts, cloud inference, analytics, paid integrations or hidden downloads. Push, publication, deployment, domain registration, private excerpts and contest submission retain their separate owner-authorization boundaries.

- Bring the owner-liked floral demo direction into the product [#48](https://github.com/drevendev/CompostClub/issues/48), then add butterflies, gentle cursor-following and click/action feedback [#49](https://github.com/drevendev/CompostClub/issues/49). Keep text and controls clear, pause hidden-tab animation, and provide reduced/off motion. These are requested enhancements, not shipped app features.

## 6. Named Gardens and Cross-Pollination — post-contest milestone (NOT shipped)

**Owner concept approved for roadmap research on 21 October 2026.** Build only after a stable public demonstration of the existing single-garden experience; do not add this to the Hacktoberfest Week 3 release or market it as implemented. The public `Sample Garden` remains exactly labelled recorded and is never an implicit knowledge donor.

### 6A. Independent gardens — [#42](https://github.com/drevendev/CompostClub/issues/42)

- A user can keep separate **Books**, **Games**, **Tools** gardens and any number of **custom named gardens** within explicit local storage/performance limits. A preset is an optional look/label, never automatic content ingestion.
- Give each garden a stable ID, own ideas/sprouts/inference history, 15-minute accrual clock and independent retry/save state. Renames and reordering do not change lineage or IDs.
- Preserve the existing `personal` record as **My Garden** through validated, recoverable one-time IndexedDB/JSON migration. Protect `recovery`, `before-restore` and separate inference evidence. Legacy backups still import; malformed/mixed-version imports fail without destroying data.
- A global garden selector is a navigation tool, not an account system. No cloud sync or external repository permission is implied.

### 6B. Exchange knowledge / Cross-Pollination — [#43](https://github.com/drevendev/CompostClub/issues/43)

- **Off by default**. Receiving garden sets a **0–100% probability**, selected donor allow-list, and optional visual indication; the donor garden separately grants permission to contribute scraps. Both opt-ins are required.
- Chance is evaluated **once per eligible user-triggered harvest**: `p=0` only same-garden pairs; `p=100` one local + one eligible other-garden parent when available. Otherwise ordinary local blend; a missing donor is not fabricated.
- Persist a seeded, reproducible decision per harvest/request, including source revisions. Reload and retry cannot reroll the chance by repeated clicks. Closing the app accrues _credits_, not generated ideas; selection remains deterministic/testable code, inference still runs locally on explicit action.
- Display clear `Books → Games` lineage and honest results, not an invented probability of good ideas. Cross-pollination is **within one local user's device/profile**, not collaboration between people.

### 6C. Consent, provenance, deletion and backups — [#44](https://github.com/drevendev/CompostClub/issues/44)

- Parent identity becomes `(gardenId, scrapId, revision)` with unambiguous structured encoding; fix the current imported-ID delimiter collision [#47](https://github.com/drevendev/CompostClub/issues/47) **before** migrating pair keys across gardens. Immutable cross-garden text snapshots must validate against the exact generation request. Garden names can change without losing source history.
- Full-workspace and per-garden exports/imports need versioned, bounded, atomic migration/restore with a clear dependency policy and preview. No orphaned snapshots or silent private garden copies.
- Consent OFF stops **future** borrowing; existing results that contain borrowed text remain until the user deliberately removes them. Show retention and provide a reviewed cross-garden cascade/purge, aligned with [#39](https://github.com/drevendev/CompostClub/issues/39) and [#40](https://github.com/drevendev/CompostClub/issues/40). Preserve generated/replayed/imported status from [#22](https://github.com/drevendev/CompostClub/issues/22).
- No private source content in public demos, GitHub Issues, CI logs or preloaded Sample Garden.

### 6D. Real reuse adapters — [#45](https://github.com/drevendev/CompostClub/issues/45)

Begin with **explicit user-selected small Markdown/JSON files**, preview and human approval. Do not add automatic GitHub/Obsidian/Drive readers/writers or publishing. Potential separately owned uses: Games/indie design ideas; Books/lore as noncanonical candidates; [Scriptorium](https://github.com/drevendev/Scriptorium) language insights; [TradeCraftSimulation](https://github.com/drevendev/trade_simulation) deterministic market mechanisms; [PatchPitch](https://github.com/drevendev/PatchPitch) human-reviewed copy about a selected public idea. The model must not claim a validated game or audience. OSS extraction comes only after actual multiple consumer proof.

### v0.2 acceptance gates

| Gate        | Required proof                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| Isolation   | Each garden can be used, renamed, backed up and restored without moving or deleting other gardens. Sample isolation proven. |
| Migration   | An existing personal garden, receipts, revisions and recovery copies survive one-way migration, crash and rollback.         |
| Determinism | Synthetic policy tests cover p=0, p=100, p=10, consent changes, no donor, retry/reload and stable parent selection.         |
| Privacy     | No borrowing without two opt-ins; a donor deletion or permission OFF cannot cause future unauthorised model inputs.         |
| Provenance  | Cross-garden sprout source references and quote checks survive editing, rename, export/import and intentional deletion.     |
| Release     | Source and tests are verified on exact candidate; no extra accounts, backend, paid API, telemetry or unlicensed material.   |

## 7. Demo and video plan — existing release now, future garden ecosystem later

Full implementation issue: **[#46 — verified public showcase and storyboards](https://github.com/drevendev/CompostClub/issues/46)**. This may advance immediately with the current app and is independent of future Named Gardens.

**Currently runnable, recorded-fact demonstrations** (inputs are fictional public fixtures, outputs are unchanged local Gemma 3 4B recordings in [recordings.json](../fixtures/public/recordings.json)):

- **Postcard Echoes:** auto-running tiny town + forgotten postcards, `demo-01 + demo-02`.
- **Clockwork Curios:** auto-running town + vending machine for abandoned hobbies, `demo-01 + demo-03`. Strongest self-referential Compost Club example.
- **Небесный Повар:** pocket weather library + word-collecting kitchen robot, `demo-04 + demo-05`. Good bilingual example; model outputs and locale must be displayed honestly.
- **Cartographic Echoes:** postcards + weather library, `demo-02 + demo-04`.

**Video A · 20–30 seconds for X:** "Too many ideas" → paper scraps in pile → Wiggle → one **labelled recorded** sprout with its two source cards → brand and verified repository link.

**Video B · 75–90 seconds for DEV:** first two scraps → real recorded mode or explicitly identified **genuine local Ollama** → sprout + both parents → Keep / All Discoveries / Markdown export → labelled `Demo clock +15 min` and no-background-inference explanation → Gemma/OSS/privacy/limitations + real verified code/video/site link.

**Video C · 2–3 minutes engineering breakdown:** source quote failure on small Gemma (0/24) → narrower prompt/validation (1B 23/24, 4B 24/24 structural; NOT idea-quality metrics) → browser WebGPU 0/4 initial smoke → raw source evidence. No misleading reconstructed model transcripts.

**Future concept storyboard:** Books ↔ Games gardens with donor and receiver opt-ins and a 0→10→100% slider; visually tag _"Planned feature — concept preview, not the current application"_. Do not splice mock into a real demo without disclosure. Once #42–#44 ship and pass their checks, produce a separate real multi-garden video.

**Publication gate:** actual page or video must be verified; #15 remains the hosted Pages path and #19 the single Week 3 official entry. Original media, proper captions, accessibility, rights, no private archives, no fabricated use claims. No autonomous publication or transfer of private materials.

## 8. Current local next patch — Idea DNA, Evolution Lab and gradual Idea Tree (now prioritized; NOT SHIPPED)

**Owner-directed implementation target:** current Node 24 / React / TypeScript / IndexedDB / local Ollama application, **no new backend**. Authoritative [full product + code/acceptance spec](IDEA_EVOLUTION_SPEC.md); [master implementation epic #60](https://github.com/drevendev/CompostClub/issues/60). Develop independently of the Week 3 submission freeze; do not represent these features as part of existing Sample Garden until working model tests and accepted artifacts prove them.

| Order | Work                                                                                                     | Ticket                                                                                                               | Done means                                                                                                                        |
| ----- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Repair ambiguous imported pair IDs and adopt versioned schema migration                                  | [#47](https://github.com/drevendev/CompostClub/issues/47), [#54](https://github.com/drevendev/CompostClub/issues/54) | Legacy source/backup/history and model receipts recover losslessly with new graph IDs, no silent truncate/orphan/cycle.           |
| 1     | **Idea DNA**: typed root, source traits and immutable ancestors                                          | [#51](https://github.com/drevendev/CompostClub/issues/51)                                                            | User inspects source, accepted/inherited/mutated genes and exact parent versions; no artificial inheritance percentage.           |
| 1     | Minimal **birth metadata**: UTC+zone/daypart, input language, self/heard/import source                   | [#53](https://github.com/drevendev/CompostClub/issues/53)                                                            | Timestamp/date tags accurate (DST tests), manual correction, historical unknowns preserved; GPS/weather never silently collected. |
| 2     | **Tend this idea**: one explicit, tiny growth action / branch with human review                          | [#50](https://github.com/drevendev/CompostClub/issues/50)                                                            | One kept seed grows three accepted steps and two alternative branches, remains inspectable after reload/export.                   |
| 3     | **Actual micro-GA**: small rated population, tournament selection, crossover, one-gene mutation, elitism | [#52](https://github.com/drevendev/CompostClub/issues/52)                                                            | One new offspring per user-triggered credit, deterministic genotype/selection proof, human feedback influences later generations. |

**Scope of "real genetics":** a bounded steady-state evolutionary search with a pool of 4–8 candidates, explicit owner ratings, seeded tournament parent selection, structured gene crossover, optional one-slot mutation and preserved elite. One short local model call verbalizes the preselected gene composition. No evolution of executable code, massive GPU batches, LLM self-scoring as objective quality or fake results.

**Scope of "growth":** a chosen idea can branch one small step at a time (`clarify`, `constraint`, `alternative`, `question`, `tiny experiment`). Underlying ancestry is a DAG; "tree" is the readable UI projection. Accepted nodes have actual sources and model/user attribution. Keep existing 15-minute credits for successful model-generated children; manual edits/free scores remain free; failures never spend credits.

**Testing:** exact new prompt/validator runs for GA offspring and growth (old `splice-2` statistics are not evidence), pure deterministic selection/mutation/elitism, two-generation ancestry, cycle detection, migration/restore and deletion, 390px + keyboard + reduced-motion, no model in background, privacy and source stamps; run `verify`, `build`, `package:single`, Chromium on an exact candidate SHA. No auto-publication.

## 9. Optional creative context and local insights — no backend required

Detailed privacy and platform comparison: [Context & Deployment Options](CONTEXT_AND_DEPLOYMENT_OPTIONS.md).

- [#55](https://github.com/drevendev/CompostClub/issues/55): optional small local Gemma **tag/trait suggestions** after idea entry. OFF by default, strict 1–5 controlled tag output, human approval; manual tags work without a model.
- [#56](https://github.com/drevendev/CompostClub/issues/56): private on-demand **idea journal statistics** grouped by weekday, month, local daypart, language, tags, accepted offspring and evolution history. No analytics tracking SDK, no causation claims and clear unknown counts.
- [#57](https://github.com/drevendev/CompostClub/issues/57): **weather, coarse city/location, mood** as separate optional context. Manual data works offline; device location and external weather are _separate explicit opt-ins_. Timezone metadata is not GPS. Weather values record time/source and API licence; don't attach today's weather to an old idea or silently persist precise coordinates.

All these contextual measurements are **birth environment**, not inheritable DNA or fitness input unless a person explicitly chooses a creative weather trait. No compulsory forms, browser GPS prompts or external calls upon saving a new idea.

## 10. Mobile/shared persistence and deployment options (research only)

Comparison and security gates: [Context & Deployment Options](CONTEXT_AND_DEPLOYMENT_OPTIONS.md), [architecture issue #58](https://github.com/drevendev/CompostClub/issues/58), [mobile UX issue #59](https://github.com/drevendev/CompostClub/issues/59).

| Setup                                              | Working mode                                                                                      | Shared PC ↔ phone garden?                             | Expenses/constraints                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **A. Current static Pages + separate IndexedDB**   | Browser UI/sample, local client-only DNA/GA; desktop Ollama when locally served                   | **No**; every device/browser has an independent store | $0 static site, no backend; browser WebGPU remains experimental                          |
| **B. User-controlled JSON export/import**          | Carry data between devices manually with conflict preview                                         | **Manual only**, not automatic sync                   | $0 infra, handling conflicts is work                                                     |
| **C. One-user Home Hub on owner's PC (candidate)** | Local Node+SQLite shared API, loopback Ollama, HTTPS/private Tailscale Serve, authenticated phone | **Yes when host PC is online**                        | Potential $0 subscriptions on existing hardware, nonzero electricity/security/operations |
| **D. Hosted private or future multi-user cloud**   | Hosted authenticated API + durable DB + explicit Gemma worker/GPU route                           | **Yes**                                               | Real hosting/backup/auth/security costs; no free/paid service claim without checks       |

**Do not make a server by rebinding existing loopback Ollama bridge to 0.0.0.0**. The current local bridge is intentionally Host/Origin/session-token guarded. Mobile sync requires distinct authentication, durable shared storage, rate limits, HTTPS, conflict management and backups, not just a responsive page. Tailscale Personal is one **optional** tool, not an account already connected. The free Open-Meteo API currently applies **non-commercial-only** service terms (CC BY 4.0 data attribution) and is not automatically permissible for future paid SaaS. No infrastructure provisioning or payment authorized.

**Decision gate:** build shared server only if manually importing JSON becomes a real repeated pain point; prefer a small private home hub for owner-only use, not an early commercial SaaS. Keep the current core fully functional when all optional context and network services are disabled.
