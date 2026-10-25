---
title: 'Let your wild ideas ferment: a quiet garden powered by local Gemma'
published: true
canonical_url: https://dev.to/drevendev/let-your-wild-ideas-ferment-a-quiet-garden-powered-by-local-gemma-1c0o
tags: devchallenge, hf26challenge, gemma, opensource
description: 'A quiet local AI garden where real project ideas become new possibilities, with local Gemma and their roots preserved.'
---

_Built for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)._

## What I Built

Some ideas are too odd to schedule and too interesting to delete.

Compost Club is for people who collect fragments of side projects and would rather explore one new connection than turn every note into a task. Add two scraps, ask local Gemma for one possibility, and decide whether it deserves to grow.

My projects already contain ideas worth revisiting. Scriptorium studies how a text is written. Quillgrain carries a writing voice between tools. They solve different problems, but what might grow between them? I built **Compost Club** to give those unfinished connections another small chance.

Drop a few scraps into a cozy garden. Let local Gemma combine two of them into one new concept. Read where it came from, keep what makes you curious, or compost it again with its roots attached. A friendly worm named Wiggle supervises absolutely nothing.

A kept idea can now grow a small branch, too. Ask Gemma to clarify its mechanism, add a constraint, explore an alternative, or suggest a one-day experiment. Each step waits for your review.

The garden has a deliberately slow rhythm: one welcome pairing, then another slot every fifteen minutes, up to three. Closing the tab earns time credits. Generation happens only when you ask for it. Nothing withers while you are away.

That is my interpretation of **Slow and Steady**: give a neglected idea a gentle next step without turning it into another daily obligation. There are no streaks, upgrades, payments, or productivity scores.

### The lazy payoff

My ten project cards offer **45 possible pairs**. I do not have to enumerate them or write a new prompt for each: the garden selects an unused pair, Gemma proposes one connection, and I review it. That is the effort this build aims to remove, rather than the decision about what is worth making.

The example below took about **8.5 seconds** of local inference. I kept it as a candidate for further exploration. That is an observed run, not a measured productivity saving or evidence that all 45 pairings would be useful.

## Demo

[Watch the demo](https://drevendev.github.io/CompostClub/?v=07c202852017).

The short English demo shows the actual application with ideas taken from my public projects. It opens the two source cards, shows **Echo Cartography**, keeps it, then follows two earlier discoveries back into the compost pile. The cream paper, small flowers, and hand-drawn garden are part of the invitation to slow down.

The result came from a fresh local Gemma 3 4B run on English summaries of two real repositories: [Scriptorium](https://github.com/drevendev/Scriptorium) and [Quillgrain](https://github.com/drevendev/Quillgrain). The summaries retain source links and describe current limits as well as the ideas behind each project. Gemma's unedited concept was:

> Scriptorium's reading observatory is layered with Quillgrain's voice packs, generating a dynamic 'cartography' of a text’s evolution across drafts, highlighting shifts in vocabulary and tone through visualized, context-aware measurements.

I can see a practical possibility: an editor comparing drafts could notice where a revision changes the author's voice. That is why I chose this result for the demo. Echo Cartography is an idea proposed by Gemma, not an implemented editor, a paying customer, or a claim that demand has been validated.

The walkthrough then switches to a separate saved garden containing **Lexigraph** and **ClawPulse**, two other genuine local results. Clicking **Compost again** turns them into two new source scraps: twelve scraps instead of ten, with their parent links intact. No second-generation blend is claimed. The scenes were filmed from validated saved gardens; no fresh inference click or waiting animation was staged for the camera.

Making the demo also improved the product: I folded the composer, paged long piles, and put both source texts side by side. The walkthrough needs no scrolling, while full text remains available. Its English voice, gentle guitar and floral frame are presentation elements; the actions inside are the real application.

The downloadable public sample is a separate experience: seven visibly labelled, unchanged recordings on fictional inputs, playable without a model download, including as a self-contained offline HTML file. Custom scraps need explicit local inference setup. Browser AI remains experimental.

### From an interesting idea to a small next step

After keeping Echo Cartography, I chose **Tend this idea** and asked for a one-day experiment. Local Gemma proposed **Draft Timeline Exploration**: take a 100-word passage, make three draft versions, and chart vocabulary and tone changes on a whiteboard. I accepted the branch, saved it, and verified that it survived a reload. The proposed whiteboard experiment itself has not been carried out.

![The actual Tend interface with Echo Cartography as parent and Draft Timeline Exploration saved as an accepted branch](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/wpqtq28mgvxrjpb7kkl4.png)

An accepted branch can become the parent of another request. Asking again from the same parent creates an alternative. Original responses, human edits, and parent snapshots stay separate. Accepting spends one ready slot; rejection, cancellation, failure, and `no_growth` keep it. This is the first small branching workflow; it runs when asked, with a person deciding what grows.

The video above shows blending and recomposting. This screenshot shows the newer tending workflow.

## Code

[Repository and local setup](https://github.com/drevendev/CompostClub) · [Model experiments and raw evidence](https://github.com/drevendev/CompostClub/blob/main/docs/MODEL_EVAL.md) · [Known issues and roadmap](https://github.com/drevendev/CompostClub/blob/main/docs/ROADMAP.md)

To try the labelled sample, use Node 24 and npm 11:

```sh
git clone https://github.com/drevendev/CompostClub.git
cd CompostClub
npm ci
npm run dev
```

Open the printed local URL and choose **Try the sample garden**. This route needs no model download. For fresh ideas, follow the separate [live local Gemma setup](https://github.com/drevendev/CompostClub/blob/main/docs/RUNNING.md#run-live-local-gemma).

The application and original SVG illustrations are MIT-licensed. Gemma weights have their own terms and are not bundled with the app.

## How I Built It

The UI uses React, TypeScript, and Vite. The garden rules live in a separate domain layer, independent of React and the inference runtime. IndexedDB stores the pile and discoveries; Markdown exports and validated JSON backups provide portable copies.

Gemma handles two bounded requests: blend two scraps into a concept with a source fragment from each, or propose one continuation of a kept idea. It receives no tools, shell, or archive search. The app renders input and output as text.

### The model experiments changed the design

My first prompt asked Gemma 3 1B to choose exact quotations from both parents. All 24 predetermined runs failed the final output contract. Paraphrasing a source made sense linguistically, but broke the provenance requirement.

The next version moved that mechanical work into code. The app selects short exact fragments and constrains those fields in the JSON schema; the model concentrates on inventing the concept.

| Local experiment                                      | Runs passing the shipped structural validator |
| ----------------------------------------------------- | --------------------------------------------: |
| Ollama Gemma 3 1B, first prompt                       |                                        0 / 24 |
| Ollama Gemma 3 1B, revised prompt                     |                                       23 / 24 |
| Ollama Gemma 3 4B, revised prompt                     |                                       24 / 24 |
| Browser Gemma 3 270M and 1B, small combined smoke set |                                         0 / 4 |

The Ollama set contains twelve public source-pair combinations, each run twice. Tuning reused the original holdout combinations, so these numbers describe a small regression experiment, not general performance on unseen ideas. The browser row is a separate, smaller experiment with a different runtime and setup.

The 4B pass needed no repair calls. On the tested Windows machine, Ollama selected CPU inference; its median call latency was about nine seconds. That is a measured result from one machine, not a hardware requirement or a promise about other devices.

For this new demo I also ran ten additional pairings from my public-project cards, after the first Lexigraph result. All ten passed the structural contract without repair. Human review still excluded three: one leaked field-like fragments into its concept, while two assumed evidence the source cards did not contain. Echo Cartography took about 8.5 seconds in its local run. These selected exploratory cases are not a held-out evaluation or proof of general creative quality.

The browser models genuinely loaded and generated with WebGPU. Their four outputs failed the contract, so browser AI stays visibly experimental. Those failures remain in the evidence. A failed call never becomes a successful recording behind the scenes.

Even **24/24 valid responses does not mean 24 useful ideas**. Some concepts were weak, and some Russian requests returned English. Human usefulness review and a fresh unseen evaluation set are still open. The seven sample recordings are a selected subset; the remaining results are retained.

### A garden also has to remember

The application preserves raw source revisions and the original model responses. Editing a scrap does not rewrite the parents of an older discovery. Saving a sprout, consuming its pair, and spending its slot happen atomically. Errors, cancellation, and a model's `no_blend` response keep the slot.

Recovery matters here because the scraps are the user's contribution. Backup validation, competing-tab checks, restore conflict detection, and cascade previews for deletion all protect that contribution. The current checks cover 97 unit tests, three HTTP/Sentry regressions, and 32 Chromium journeys, including growth review and privacy exports. Those application checks are separate from model-quality evidence.

GitHub Actions takes repetitive release checks off my hands. The [Repository checks workflow](https://github.com/drevendev/CompostClub/blob/main/.github/workflows/quality.yml) installs pinned dependencies, runs verification, builds the app and standalone sample, and exercises recovery, pairing workflows and the Pages subpath in Chromium. The [successful post-merge run](https://github.com/drevendev/CompostClub/actions/runs/39778088037) includes the tending workflow and optional Sentry adapter.

### Watching a local model without collecting its ideas

I connected **Sentry Agent Tracing** to the Node bridge as optional technical monitoring. It is **off by default**, and the connection status shows when the operator enables it. The browser and offline HTML contain no Sentry client. The [adapter and removal instructions](https://github.com/drevendev/CompostClub/blob/main/docs/OPTIONAL_SERVICES.md) keep it independent of the garden's data and local inference.

On a fresh tending request with the merged code, Sentry recorded **16.43 seconds**, **220 input tokens**, and **107 output tokens** for local Gemma 3 4B. The child span measured about **0.48 ms** of bridge-side structural validation. This is a separate request from the earlier 8.5-second blend and the accepted branch above. These are individual observations on my machine, not a benchmark or a measure of usefulness.

![A real Sentry trace showing local Gemma generation, validation, token counts and no captured input](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/wfe1oh3l1ksmw1tqkg0a.png)

The integration exposed two mistakes. Provider-side enrichment initially added location fields, so I added explicit IP anonymization and recursive server-side scrubbing, then checked the stored result. Review also caught a validation span starting after the check; moving the check inside it made that timing meaningful. The screenshot uses a fresh trace after both fixes. Uploaded events contain technical metadata, with idea text, prompts, outputs and raw errors excluded.

There is no hosted model API charge for those tokens: inference runs locally. Hardware, electricity, and the operator's Sentry plan are separate costs, not measured by this trace. Turning monitoring off and restarting the bridge stops new telemetry; removing the adapter needs no garden migration.

## Why Does Open Innovation Matter?

The core interaction can run on a machine the user controls. Ollama generation stays behind a loopback-only bridge. Scraps live in the browser, and the app needs no end-user account or hosted inference API. Optional Sentry monitoring sends technical metadata only when the operator enables it; local generation, saved gardens, and backups work with it off.

Initial dependency and model downloads still need a connection and explicit setup. The optional browser-model download contacts the disclosed model hosting endpoints. The offline sample contains recordings rather than weights or live inference.

Open weights made it possible to compare model sizes locally and keep the failed experiments inspectable. Open application code makes the rest inspectable too: the prompt, validator, pairing rules, storage boundaries, and record of what actually ran. The model licence remains separate from the code licence.

Compost Club is an experimental local application. It offers a small next step: put two unfinished thoughts together, read one possibility, and decide whether to keep it. Then close the tab. The garden can wait.

## Prize Categories

- **Best Use of Gemma** — Gemma provides the central idea-blending interaction through genuine local Ollama runs, including Echo Cartography. The separate offline sample replays exact Gemma 3 4B results.
- **Best Use of GitHub Copilot** — entered through the **GitHub Actions automation route** explicitly listed in the [published category criteria](https://dev.to/challenges/hf26). Repository checks automate builds, standalone packaging and Chromium acceptance; the linked workflow and successful run show the actual use.
- **Best Use of Sentry Agent Tracing** — the optional local-model integration records real timings and token counts. The trace screenshot, privacy fixes, validation-timing correction and setup/removal notes above show how it is used.

_AI assistance was used in implementation, testing, documentation, and preparing this article and demo. Numerical claims above come from the repository's recorded experiments and verification reports. Creative usefulness remains a human judgment._

_Demo audio credits: “Somewhere Sunny (ver 2)” by Kevin MacLeod ([incompetech.com](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100567)), downloaded from [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Somewhere_Sunny_%28ver_2%29_%28ISRC_USUAN1100567%29.mp3), licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Edited excerpt with reduced volume, ducking, and fades. Narration: [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0 model distribution, rendered locally with the MIT-licensed [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) runtime._
