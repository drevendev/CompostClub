# Compost Club — publication roadmap and release-linked stories

**Status:** editorial strategy and scripts **PREPARED / NOT PUBLISHED**. Updated 22 October 2026, source baseline main commit ef5794980cc3dd3b4ae93a0283a89e7dfe944757 (merge PR #61). Later edits to this document do not imply any feature is implemented or video uploaded. Contest submission, X posts, GitHub Pages launch, and new releases require their own approvals and evidence.

**One sentence:** *Compost Club — Let your wild ideas ferment.* A cozy local-first idle garden turns two scraps of unfinished thoughts into one inspectable, human-selected new idea.

**Existing working copy:** [DEV Week 3 article](DEV_DRAFT.md), [DEV preparation/evidence](DEV_PREPARATION.md), [recorded demo + spoken lines](DEMO_SCRIPT.md), [music and voice credits](DEMO_MUSIC.md), [open model evaluation](MODEL_EVAL.md), [future design specs](IDEA_EVOLUTION_SPEC.md), and [main roadmap](ROADMAP.md). **Do not replace the current, well-prepared DEV_DRAFT with a generic newly generated article.**

## 1. Current truth inventory — what can be shown today

| Claim / screen | Status | Required disclosure |
| --- | --- | --- |
| Compact garden, edited scrap previews, recorded sprout, Grew from, Keep, Collection, reload, Markdown export | SHIPPED in source after PR #61; existing local demo capture documented | Sample uses 7 **unchanged recorded** Gemma 3 4B outputs on 6 fictional fixture scraps; no live generation |
| One immediate credit, then one per 15 minutes, max 3; tab can be closed | SHIPPED in current domain | Time accrues pairing **credits** only. No LLM runs in closed tabs |
| Local Ollama live Gemma 3 1B/4B | Historical real model executions are publicly recorded | Must be installed and run on visitor's own device; recorded sample is not its substitute |
| Ollama 1B: 0/24 initial quote contract -> 23/24 revised; local 4B: 24/24 | STRUCTURAL run results in MODEL_EVAL.md, from 20 Oct public fixtures | Not new unseen holdout or human usefulness claim; preliminary content+language 8/12, owner review pending |
| Browser Gemma 270M/1B through WebGPU | Both ran, but initial 4 EN/RU model outputs failed strict contract | Experimental, not certified live public AI |
| ~89s narrated floral demo (local file) | PREPARED locally per DEV_PREPARATION.md after PR #61, not published; this coordinator has not watched the MP4 bytes | Explicit Kokoro synthetic English narration, CC BY 3.0 Kevin MacLeod music credit, persistent recorded-sample badge |
| Public Pages URL | PREPARED workflow only; no independently verified deployed URL in README | Demo for Week 3 may be **video OR deployed URL**; never invent link |
| Idea DNA, actual GA, branching tree, tags, weather/location, named gardens and cross-pollination | ROADMAP / ISSUES ONLY | Future concept, **not current app footage or model evidence** |

**Visual caution:** the attractive flowers and 1920×1080 frame in the narrated **presentation video** are not proof that future in-app floral design #48 or pointer/butterfly animation #49 has shipped. Explicitly distinguish presentation graphics from product UI if showing those features.

## 2. Release-to-story ladder — publish on a verified development event, not a promise

| Phase & trigger | Public story / audience | One hero feature and evidence | DEV article | Video / X |
| --- | --- | --- | --- | --- |
| **L0 · NOW · Week 3 by Oct 25 PDT** | Creators, indie makers, OSS readers; core WHY | Toss two fictional thoughts → real **recorded** Gemma sprout → parents → Keep/Export; slow time-credit loop | **Official one Week 3 Entry**: [DEV_DRAFT.md](DEV_DRAFT.md). Human hook + Slow and Steady + real demo/code + meaningful Gemma. Status DRAFT | Existing ~89s master after author review/upload; 20–25s square/vertical cut + short X teaser/thread |
| **L1 · once L0 posted, no extra feature needed** | Developers who wrestle small local models; credible HOW | 1B original quote contract 0/24 → deterministic quote logic 23/24; 4B 24/24; browser initial 0/4 | Ordinary DEV technical article: **Gemma 3 1B Failed 24 Times. The Fix Wasn't a Bigger Model.** (pre-existing private draft); not second competition entry | 35–60s engineering comparison with counts labelled STRUCTURE, not idea quality. One X technical thread |
| **L2 · after L0, separate day/week** | Idle-game & product-design readers; design WHY | First credit, 15-minute cap, no streak, offline time reconciliation with **no** overnight model calls | Ordinary DEV essay: **What If an App Rewarded You for Not Opening It?** (private drafted) | 15–20s time-credit animation from real UI, no fake time passage (label Demo clock) |
| **L3 · #18 + #24 + #27 actual approved private pilot** | Real users, game designers; proof of USEFULNESS | One real human-approved archive-based combination and decision, failures and denominator; public snippets only by owner's explicit allow-list | **I Fed My Real Idea Archive into Compost Club. Here's What Survived.** No article until real result | 45–60s old source → tested output → human Keep/Reject → concrete experiment. No raw private notes before approval |
| **L4 · #47/#54/#51/#53 merged and tested** | Creators/workflow enthusiasts; explain lineage | Root origins, revisions, accepted semantic gene slots, truthful birth timezone/daypart/language | **I Gave My Ideas DNA. Now They Remember Where They Came From.** | 25–40s "open DNA" → parents → accepted genes → revision. Avoid fabricated ancestral percentages |
| **L5 · #50 accepted tree growth, tested** | Storytellers & planners; product value | Tend one idea in two small alternative branches and compare; reload/export genealogy | **Why I Stopped Asking AI to Finish My Ideas and Started Growing Them One Step at a Time** | 30–50s Seed → two accepted branches; ordinary user review, no auto-written whole novel |
| **L6 · #52 real micro-GA shipped/verified** | Dev/game dev audience; actual ALGORITHM | Small 4–8 population, seeded selection, real gene crossover + max-one-gene mutation, human fitness + preserved elite | **I Put a Real Genetic Algorithm in a Cozy Idea Garden** | 45–90s seed/pool/rating/selection/gene split/mutation/next gen. Show deterministic operator log; never let local LLM claim quality |
| **L7 · #42–#44 cross-garden consent/backup complete** | Writers + indie makers; surprise & privacy | Separate Books/Games/Tools gardens; receiver probability and donor permission; visible Books → Games result | **When My Game Ideas Started Pollinating My Stories** | 45–60s p=0 → OFF; p=100 with explicit allowed donor → actual one foreign parent → inspect origin. p=10 is probabilistic; do not stage a lucky 10% outcome as guaranteed |
| **L8 · #55–#57 optionally shipped, real data available** | Personal knowledge journaling; curiosity | Local tag suggestions, honest weekday/daypart charts, optional manual weather; privacy toggles | **When Do My Ideas Actually Arrive? An Offline Idea Observatory** only after sufficient owner-approved observations | 20–40s source capture → daypart chips → local chart; no fabricated correlation or GPS exposure |
| **L9 · #58/#59 explicit backend decision & real phone acceptance** | Local-first engineering readership | One truly shared authenticated PC↔phone garden and conflict/backup receipts, or candid manual JSON workflow | **My Ideas Live on My Laptop. Could My Phone Grow Them Too?** only for verified implementation | Actual two-device side-by-side capture. A static Pages/PWA alone is NOT sync |

**Release sequencing note:** L1 and L2 are independent editorial posts on the CURRENT version. All later stories are guarded by their specific shipped issues; a proposed architecture alone is not news of a working product. Do not create six near-identical articles from one release.

## 3. Near-term calendar / publication gates

| Suggested window (Cyprus local) | Action | Ready when | Owner approval |
| --- | --- | --- | --- |
| **22 Oct** | Watch/listen to the existing narrated 89s MP4, inspect English cover, screenshots, captions, attribution; decide final intro/title. Prepare a 20s social cut. | Local MP4 actually inspected by owner; no private text or license omission | Approve exact footage/text |
| **22–23 Oct** | Upload approved full demo video to an accessible platform (or activate and independently test Pages); preserve the source SHA, video URL and music attribution. | At least **one verified video OR live demo** accessible to judges; README remains truthful | Explicit external upload/Pages approval |
| **23–24 Oct (preferred)** | Publish the single official English DEV Week 3 article using the official template/tags, meaningful Best Use of Gemma and public source + verified demo. | Link check/preview, metrics/evidence readback, owner final voice review. **Do not need to finish DNA/GA.** | Explicit publish approval |
| **Same day, AFTER verified DEV post** | One 4–5 post X launch thread or one main X video post linking official DEV URL + code; no cross-post storm | X composer validates text, real media upload and URLs | Explicit post approval |
| **24–25 Oct** | 1–2 purposeful follow-ups: exact Gemma failure insight and a friendly question inviting *fictional* two-scrap suggestions; reply organically | Real post is live; no mass messaging or claimed results | Separate approval |
| **Before Oct 26 08:59 Cyprus** | Verify the DEV entry remains valid with required tags, source, demo/video and partner disclosure | Official contest deadline **Oct 25 23:59 PDT**; only ONE entry considered | Final owner go/no-go |
| **After the contest** | Technical DEV article L1, then idle-design essay L2 on separate days (suggest 3–7 days apart, adjustable from real engagement). | Existing drafts fact-checked to shipped version; no extra contest entry tags | Approve each |
| **With future releases** | New story only when feature merged/tested and one actual helpful user case exists | Release gate and receipts for corresponding L3–L9 | Approve each |

**IMPORTANT:** Official Week 3 rules: https://dev.to/page/hacktoberfest-week3-2026-10-19-contest-rules . Only ONE official Week 3 Entry per participant; ordinary additional DEV posts are allowed separately but should not use the Week 3 entry template/tags in a way that creates duplicate entries. The code/repository must be a new eligible project within Oct 19–25. Note **code commits after the submission deadline** in project README per contest FAQ.

## 4. Main 89-second video: reuse, don't reshoot needlessly

The full **exact** beat-by-beat shot list, spoken cues and verified local-media instructions are in [DEMO_SCRIPT.md](DEMO_SCRIPT.md). Here is the narrative viewing order we want:
1. 0–7s: "Some ideas are too odd to schedule..." calm title card.
2. 7–24s: enter Sample Garden; 6 fictional scraps; Worm Wiggle; clear recorded/no-live label.
3. 24–45s: Discover a recorded 4B sprout and **Grew from** two exact parent excerpts. This is the HERO shot.
4. 45–61s: Keep, Collection, reload, Markdown export. Prove it's a *tool*, not static illustration.
5. 61–70s: **labelled demo clock +15min** and available credits; explain no idle background inference.
6. 70–79s: very brief local model evidence and honesty about weak browser models (STRUCTURAL numbers only).
7. 79–89s: source code link, local-Ollama requirement, tagline and credits.

**Editorial improvement for short-form:** lead with the 24–45s reveal as a hook in social cuts; the full DEV video keeps explanatory order. Don't say "AI learned overnight" or claim the recorded sample is a live model.

### Derivative X cut (20–25s) from the actual current master
- 00–03 text: *Too many ideas. Not enough lifetimes.*
- 03–07 real pile, Wiggle, UI visibly **Recorded Sample**.
- 07–15 actual **Postcard Echoes** or **Clockwork Curios**, with roots expanded (only if actual footage supports it).
- 15–20 Keep action; *This one is worth keeping.* 
- 20–25 *Compost Club — Let your wild ideas ferment* + verified DEV URL / repo.
- Use original voice/music excerpt only with retained CC BY 3.0 music credit in post/video description, or choose silent original audio with captions instead.

### Separate 40–60s technical short (after main entry)
- 0–08: "My tiny Gemma was creative, but couldn't quote a source verbatim." Show a public quote mismatch from actual raw evidence.
- 08–22: sourceQuote() deterministic excerpt function/short validator and revised prompt.
- 22–34: actual evidence chart: 1B 0/24 initial, 23/24 revised, 4B 24/24; **structural validity only**.
- 34–48: browser WebGPU initial 0/4, sample transparently recorded, live Ollama local.
- 48–60: "A good idea still needs a human Keep button"; link raw evidence. No invented user outcomes.

## 5. Future video recipes tied to actual merges

| Milestone | Video length | Hook and 3 filmable beats | Proof gate |
| --- | --- | --- | --- |
| **DNA #51** | 30–40s | "This idea has parents" → open one root's time/origin → open child showing two sources and two accepted semantic genes → click ancestor | Real stored DAG references, correct import/reload; legacy unknown context not invented |
| **Growth #50** | 40–60s | "An idea doesn't need to become a finished book overnight" → Tend/choose ONE direction → accept branch A; choose alternative B → compare tree | One real local model proposal (or transparently labelled UI fixtures), provenance and separate human acceptance; branch backup roundtrip |
| **GA #52** | 60–90s | "Not another random AI mashup" → 4–8 population with genuine user ratings → seeded tournament selects parents and swaps typed gene slots → mutation and elite across two generations | Tests validate deterministic selection pressure, 0/100% mutation bounds, no invented gene sources; true model/prose separated from algorithm |
| **Cross-Pollination #42–44** | 45–60s | "Games and Books can meet" → show p=0 strictly local → enable receiver+donor and p=100 → actual traced cross-garden sprout and settings | Full consent and privacy/deletion/export verified. A p=10 screenshot alone does not prove anything |
| **Insights #55–57** | 30–45s | "When do ideas find you?" → add one new idea and its local daypart → display real private aggregate weekday chart → show all weather/location OFF by default | No hidden GPS/API, legitimate sample counts; no cause-and-effect claims |
| **Mobile #58–59** | 45–75s | "Same garden, two devices" → new thought on actual phone → appears in shared PC DB → deliberate edit conflict and recoverable backup | Actual phone+PC connected to a secured hub, not simulated Pages sync |

**Do NOT** make promotional videos of features that only exist as issues except a clearly watermarked *Concept / Not implemented* behind-the-scenes roadmap teaser.

## 6. X and DEV promotion ladder

**Before publishing official DEV** (only if the video isn't public yet):
> I have more unfinished ideas than time. I didn't want another backlog reminding me to finish them, so I built a little compost heap instead. 🌱  
> Compost Club is open source; the narrated demo is being prepared.  
> https://github.com/drevendev/CompostClub

**At launch, after published media:**
> I built a tiny garden for ideas I'll probably never finish. 🌱  
> Two scraps go in. A local Gemma can propose one new thought. The demo lets you explore unchanged recorded results, see both parents, keep a favorite and leave the pile alone.  
> [VERIFIED DEV ARTICLE LINK]  
> Code: https://github.com/drevendev/CompostClub

**Week 3 follow-up:**
> Gemma 3 1B didn't fail because it couldn't be creative. It failed because I asked it to select exact quotes *and* create a new concept.  
> Original test: 0/24 structurally valid. After code handled quotes: 23/24.  
> Format isn't quality.  
> [VERIFIED MODEL EVIDENCE LINK]

**Future release copy variants (publish only when shipped):**
- DNA: *My idea has a family tree now. I can trace the mechanics and constraints it inherited instead of guessing where a generated suggestion came from.*
- Tree: *The better prompt wasn't "write the whole thing." It was "grow this idea one careful step."*
- GA: *Not genetic-algorithm vibes. Actual parent selection, gene crossover, mutation and user-driven fitness — with one tiny model call at a time.*
- Gardens: *My game mechanics started borrowing plot twists from my story garden. Only when both gardens agreed.*
- Observations: *Apparently I record most of my ideas at night. That's a statement about timestamps, not proof that darkness makes me creative.* (Use **only if actually measured**, otherwise a hypothetical headline.)

**Recommended calls to action:** submit two *public fictional* scraps; ask which sample sprout viewers would keep; ask for plain-language UX critique; invite one ordinary, non-sensitive reproducible Issue. Do not invite users to publicly paste private manuscripts, client secrets or licensed source materials.

## 7. Media/quality gates and rights

1. **Contest template** must use #devchallenge and #hf26challenge, have What I Built, Demo, Code, How I Built It and Why Does Open Innovation Matter, and clearly identify Best Use of Gemma. One Entry max. Confirm publishing time before 25 Oct 23:59 PDT.
2. **Video**: author reviews full local MP4 + poster, subtitle legibility and wording; retain Kokoro-82M synthetic narrator disclosure. Music is Kevin MacLeod, “Somewhere Sunny (ver 2),” downloaded under CC BY 3.0. Include composer/title/source/license and excerpt/duck/fade changes in DEV/video description or adjacent credits. [Current credits](DEMO_MUSIC.md).
3. **Privacy**: only approved public-fictional fixtures; no private GameIdeas, Lanterra, unpublished notes or accidental absolute user paths. A full raw inference transcript may appear in sprout card export (#40), so inspect any file before sharing.
4. **Truth**: local MP4 is not independently verified by the editorial coordinator; repo docs only attest to its preparation. The current Pages workflow is prepared but not evidenced deployed. Do not put unverified URL or video file path in public article.
5. **Capture provenance**: date, HEAD SHA, sample/live mode labels and exact recording IDs; do not use later DNA/GA concepts as current functionality. Screenshot caption in README should be updated to accurately reflect current PR #61 compact layout, not claim it was captured from the initial v0.1 commit.
6. **Metrics**: human-reviewed feedback, real DEV reaction/comment counts and actual GitHub star/issue/clone or traffic reports at release+24h and release+7d when accessible. Do not install analytics by default or manufacture attribution/retention/sales.
7. **Cadence**: no automatic posting/mass replies, duplicate contest submissions, paid promotions, or scheduled tweets without explicit user action. A successful publication requires exact live URL and posting receipt.

## 8. Ownership and source of truth

- Source/code/feature truth: current repo README, relevant commit and evidence artifacts, and [ROADMAP.md](ROADMAP.md).
- Competition article source: [DEV_DRAFT.md](DEV_DRAFT.md). Keep one canonical **official** submission draft; private editorial proposals are alternatives for human review, not competing source copies.
- Video picture/speech: [DEMO_SCRIPT.md](DEMO_SCRIPT.md) + currently private/ignored recorded media, not a published YouTube or DEV upload.
- Roadmap/feature stories: specific closed feature Issues and current release commit; planned Issues #42–#60 alone are not evidence of shipped features.
- User-owned editorial calendar/copy may be held privately in Starforge Google Drive; never mirror private creative archive to public docs.

**Release program reference issues:** contest #19, GitHub Pages #15, editorial #28, video #46, real adoption #18/#24/#27, roadmap evolution epic #60.
