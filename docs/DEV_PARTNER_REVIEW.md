# DEV partner-category review — 22 October 2026

Rechecked against the official Week 3 page, hub, template and contest rules on 22 October 2026 after PR #65 merged. The owner-approved article is now published on DEV and lists three substantiated categories: Gemma, GitHub Copilot via GitHub Actions, and Sentry Agent Tracing. Listing a category requests consideration; judging and participant eligibility remain with the organizers. Render and Entire were subsequently declined by the owner and are not being integrated.

## Sources and entry mechanism

- [Week 3 challenge and category descriptions](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)
- [HF26 hub and category FAQ](https://dev.to/challenges/hf26)
- [Week 3 launch and judging criteria](https://dev.to/devteam/join-the-hacktoberfest-open-source-ai-challenge-slow-and-steady-2850-in-prizes-across-21-3iee)
- [Week 3 official contest rules](https://dev.to/page/hacktoberfest-week3-2026-10-19-contest-rules)

The hub asks entrants to use the technology and list each entered category under Prize Categories. The two required DEV tags remain devchallenge and hf26challenge; the four-tag limit does not limit the number of genuinely applicable prize categories. One entry can qualify for several categories but win only once per challenge. Writing quality is weighted most heavily.

The Week 3 entry period is 19 October, 09:00 PDT through 25 October 2026, 23:59 PDT. The repository's first commit is dated 20 October, within that window. Required article sections, code/demo links and the two challenge tags are retained. The article was published on the owner's instruction; this category audit does not attest personal eligibility or guarantee a prize.

## All 20 categories checked

| Category | Article decision | Actual evidence or missing requirement |
| --- | --- | --- |
| Best Use of Gemma | Enter | Local Gemma 3 4B performs the central blend; original responses and exact parents retained; Echo Cartography shown in the video |
| Best Use of GitHub Copilot | Enter via the published GitHub Actions route | Repository checks automate verification, packaging and Chromium acceptance; successful Actions run linked below. This is an Actions claim, not a claim about Copilot authoring the code |
| Best Use of Render | Deferred; do not enter | Current video host is GitHub Pages. No verified Render deployment. A prepared build is not actual hosting |
| Best Use of a .tech Domain | Deferred; do not enter | No claimed and deployed .tech domain. Pages is not a .tech-domain integration |
| Best Use of Entire | Optional experiment not completed; do not enter | No verified Entire capture or published safe Entire session. The existence of a Codex conversation is not evidence of using Entire |
| Best Use of ElevenLabs | Do not enter | The approved voice is local Kokoro af_heart, not ElevenLabs |
| Best Use of TabPFN | Do not enter | No TabPFN model or tabular prediction integration |
| Best Use of Tinker | Do not enter | No Tinker fine-tuning or baseline improvement experiment |
| Best Use of Arduino | Do not enter | No Arduino UNO Q integration |
| Best Use of DigitalOcean | Do not enter | No DigitalOcean deployment or runtime |
| Best Use of Auth0 for AI Agents | Do not enter | No Auth0 integration; the product has no accounts |
| Best Use of Backboard | Do not enter | No R-CLI or Backboard API integration |
| Best Use of Browserbase | Do not enter | Chromium/Playwright acceptance and browser-assisted editing are not a Browserbase/Stagehand integration |
| Best Use of Mastra | Do not enter | No Mastra workflow or agent orchestration |
| Best Use of MongoDB Atlas | Do not enter | The application uses IndexedDB, not Atlas |
| Best Use of Ultramarine | Do not enter | No Ultramarine inference or cost evidence |
| Best Use of Sentry Agent Tracing | Enter | Actual optional Node Sentry integration; genuine local-model trace screenshot, latency/tokens, debugging findings and removal instructions included. Fresh trace uses merged code after the validation-span fix |
| Best Use of SerpApi | Do not enter | No SerpApi integration; researching this article is not product integration |
| Best Use of Temporal | Do not enter | Time credits and local recovery are implemented in the domain, not Temporal |
| Best Use of Tiger Data | Do not enter | No Tiger Data, pgvector or Tiger MCP data layer |

The partner wishlist is accounted for: Gemma and Sentry are implemented; Actions is used for real repository automation. Render has a manual static blueprint but no verified deployment, and Entire has preparation notes but no verified session. Both integrations were declined by the owner and neither is claimed as used. The approved voice is Kokoro, so ElevenLabs is excluded. No new partner account, domain or subscription was created during this review. The approved DEV article was subsequently published on the owner's explicit instruction; the video deployment is unchanged.

## GitHub Actions evidence

- [Repository checks workflow](https://github.com/drevendev/CompostClub/blob/main/.github/workflows/quality.yml)
- [Successful post-merge Repository checks run 39778088037](https://github.com/drevendev/CompostClub/actions/runs/39778088037), verified through GitHub: conclusion success, workflow quality.yml, commit 1519ccaf68ad908db6955ab3350f59af84c65843; 97 unit tests, three HTTP/Sentry regressions and 32 Chromium journeys
- [Successful Pages deployment of the new movie](https://github.com/drevendev/CompostClub/actions/runs/39747617849)

The Week 3 page and hub both explicitly include GitHub Actions automation in the category named Best Use of GitHub Copilot. The article identifies that route and links to the real workflow and run. It does not rename the category or claim an unperformed Copilot session. Final judging remains with the organizers.

## Sentry and growth evidence

- The saved accepted branch is Draft Timeline Exploration, a genuine local Gemma continuation of Echo Cartography. Its original response and parent are retained; acceptance/save/reload were verified. The suggested whiteboard experiment has not been performed.
- A separate fresh tending request on merged code produced Draft Timeline Visualization. Its original response is retained locally and the proposal is not presented as accepted. This additional call supplies the new Sentry screenshot: 16.43 seconds, 220 input/107 output tokens, approximately 0.48 ms structural validation. Its suggestion assumes three draft versions of a published passage; that assumption requires human review and is not presented as historical evidence about the book.
- The screenshot is captured from the real authenticated Sentry UI. It contains no captured model input or output, DSN, credentials, IP or location fields. It is included in the article, satisfying the category's request for trace/screenshot evidence without requiring judges to sign into the owner's account.
- The article explains opt-in setup, metadata boundaries, IP/geo scrubbing, the corrected validation-span placement and independent removal. It distinguishes local model API cost from hardware/electricity and monitoring-plan costs.
- The existing 49.93-second video remains unchanged and shows blending/recomposting. The new accepted-branch screenshot illustrates tending; the video is not claimed to contain the new workflow.

## Comparison with other Week 3 write-ups

These are comparisons of presentation, not independent audits of the authors' technical claims or predictions about who will win.

- [SlothLog](https://dev.to/alessio_bianchini/slothlog-why-i-built-an-offline-ai-powered-timesheet-generator-for-lazy-developers-2mak): establishes a specific audience and recurring nuisance before architecture. Compost Club now introduces its intended reader before discussing the two source projects.
- [Wait For It](https://dev.to/miawab/i-built-wait-for-it-tell-an-open-gemma-what-youre-waiting-for-it-checks-rarely-and-it-got-35-of-jgg): separates observed outcomes, evaluation limits and partner-specific contributions. Compost Club adds a concrete lazy-payoff section and a role/evidence description for each entered category.
- [SlothDesk](https://dev.to/ani0811/slothdesk-local-first-ai-downloads-organizer-less-sorting-more-living-398): walks through user decisions and visible safeguards. Compost Club retains its source/keep/recompost story and adds a minimal path to try the labelled sample.

The revision preserves the approved title, floral video, exact Gemma quotation and failure evidence. It condenses production details so the idea appears earlier, states that ten scraps yield 45 possible pairs, and keeps the measured 8.5-second call separate from unmeasured productivity or commercial value. No text, code or numerical claims from other entrants were copied into our article.
