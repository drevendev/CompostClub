# Roadmap — 21 October 2026

The next milestone is a dependable small creative workflow and an evidence-backed project story. [Current audit](AUDIT-2026-10-21.md). [Release tracking issue #29](https://github.com/drevendev/CompostClub/issues/29).

The first P1 implementation batch merged in [PR #37](https://github.com/drevendev/CompostClub/pull/37), closing #31, #32 and #36: persisted inference transcripts, stale-restore protection and evidence-derived acceptance receipts. Its [live acceptance](../evidence/p1-verification.json) contains 63 unit results and seven Chromium journeys with two real local-model outputs. Six additional P1 diagnostics and eight recovery scenarios passed separately. The earlier [real model error](../evidence/model/p1-live-failure.json) is retained alongside the later successful run; neither run is a new creative-quality benchmark.

The workflow batch merged in [PR #38](https://github.com/drevendev/CompostClub/pull/38), closing #11, #12, #13 and #21: explicit retries after reload, independent add/edit drafts, access to all discoveries and order-independent JSON field comparison. Its validation covered 76 unit tests, eleven P1/workflow Chromium scenarios and eight recovery cases. The [sample/offline receipt](../evidence/workflow-verification.json) records four ordinary Chromium journeys and identifies that tested source/build. This batch did not rerun live inference.

The next local batch addresses the remaining phase-1 issues #34, #14, #17 and #35: retained source originals, independent skip focus, clear slot/pair exhaustion and indexed selection at supported capacity. It is prepared for review; these four issues stay open until merge. Validation covers 91 unit tests, nineteen P1/workflow/stability Chromium cases, eight recovery cases and four ordinary sample/offline journeys. See the [new sample receipt](../evidence/stability-verification.json) and [synthetic capacity diagnostic](../evidence/pairing-capacity.json). Live inference was not rerun. After this batch, the next implementation priority is the bridge reliability group #8/#9/#10/#23, followed by the browser lifecycle/provenance work.

## Baseline delivered

- Public MIT React/TypeScript/Vite source, exact direct pins, project lockfile, Node 24 / npm 11.
- Separate personal/sample gardens, exact-fixture replay, earned slots, immutable sprout parents, keep/edit/recompost and Markdown/JSON export.
- Save/load limits and startup recovery shipped in [PR #30](https://github.com/drevendev/CompostClub/pull/30), closing #6/#7. The audit reran 42 unit tests, eight recovery and four sample/offline Chromium scenarios successfully.
- Standalone recorded HTML and production build tested under a Pages-style subpath. Hosting has not been deployed.
- Historical real Ollama/browser experiments with unchanged public transcripts. Creative usefulness still needs human review; the audit did not rerun live-model evaluation.

## 1. Stabilize the user's work

| Outcome | Issues | Exit criterion |
| --- | --- | --- |
| Inspectable failures and deliberate retries | [#31](https://github.com/drevendev/CompostClub/issues/31), [#11](https://github.com/drevendev/CompostClub/issues/11) | Invalid primary/repair responses and no_blend survive reload/export; retry preserves slots and checks source revisions. |
| Safe backup replacement | [#32](https://github.com/drevendev/CompostClub/issues/32), [#21](https://github.com/drevendev/CompostClub/issues/21) | Stale restores fail safely without Web Locks; JSON key order does not invalidate unchanged values. |
| Recoverable text and discoveries | [#12](https://github.com/drevendev/CompostClub/issues/12), [#13](https://github.com/drevendev/CompostClub/issues/13), [#34](https://github.com/drevendev/CompostClub/issues/34) | Edits preserve unrelated drafts and source history; earlier unkept results remain accessible. |
| Clear and responsive pairing | [#14](https://github.com/drevendev/CompostClub/issues/14), [#17](https://github.com/drevendev/CompostClub/issues/17), [#35](https://github.com/drevendev/CompostClub/issues/35) | Skip navigation preserves the garden; exhausted pairs differ from earned slots; selection at supported capacity does not freeze interaction. |

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
