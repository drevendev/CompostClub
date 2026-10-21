---
title: 'Let your wild ideas ferment: a quiet garden powered by local Gemma'
published: false
tags: devchallenge, hf26challenge, gemma, opensource
---

_This is a submission draft for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)._

## What I Built

Some ideas are too odd to schedule and too interesting to delete.

A town that carries on without its player. A box of unsent postcards. A library that lends pocket-sized weather. Each could sit in a notes file forever. I built **Compost Club** to give unfinished thoughts another small chance to grow.

Drop a few scraps into a cozy garden. Let local Gemma combine two of them into one new concept. Read where it came from, keep what makes you curious, or compost it again with its roots attached. A friendly worm named Wiggle supervises absolutely nothing.

The garden has a deliberately slow rhythm: one welcome pairing, then another slot every fifteen minutes, up to three. Closing the tab earns time credits. Generation happens only when you ask for it. Nothing withers while you are away.

That is my interpretation of **Slow and Steady**: give a neglected idea a gentle next step without turning it into another daily obligation. There are no streaks, upgrades, payments, or productivity scores.

## Demo

<!-- LOCAL DRAFT: insert the approved, uploaded video here before submitting. The local MP4 and poster are in release/dev-article-no-scroll/. Nothing has been uploaded. -->

The short demo shows the actual application: open the sample garden, discover a sprout, inspect its two parents, keep it, reload, and export it. The cream paper, small flowers, and hand-drawn garden are part of the invitation to slow down.

The workspace keeps that path in view: scraps have short previews and full-text readers, and a sprout's two sources open side by side. The demo follows the whole journey without scrolling.

Its English narration uses local Kokoro-82M, voice `af_heart`, at natural speed. The spoken script follows the actual screen actions. A gentle guitar duet sits underneath, fading down during speech. No cloud speech service or cloned voice is used.

**The video uses recorded mode throughout.** The sample contains seven unchanged outputs from actual local Gemma 3 4B runs on fictional public inputs. It matches exact source text and language; custom scraps cannot receive an unrelated canned answer. The recording is labelled in the interface and video, and the export keeps that distinction.

Here is one of those results, **Postcard Echoes**. Its parents are a tiny town whose residents solve problems while the player is away, and a box of postcards that can turn forgotten observations into walking routes. Gemma's unedited concept was:

> The town’s priorities trigger postcards detailing solved problems, inspiring new walking routes built from linked observations – two forgotten postcards coalesce into a path, echoing the town’s quiet ingenuity.

I can see a mechanism there: the town's activity leaves observations that become a route for the returning player. Whether it deserves to become a game is still a human decision.

Another result, **Cartographic Echoes**, combines postcards with borrowed weather: observations become coordinates for temporary paths through fog and rain. A Russian-input example, **Небесный Повар**, uses miniature weather clouds to change a dish's aroma and texture. These are fictional concepts produced by the model, not existing products or user testimonials.

The sample runs without a model download, including as a self-contained offline HTML file. Live generation is a separate, explicit setup using local Ollama. Browser AI remains experimental.

## Code

{% github drevendev/CompostClub %}

[Repository and local setup](https://github.com/drevendev/CompostClub) · [Model experiments and raw evidence](https://github.com/drevendev/CompostClub/blob/main/docs/MODEL_EVAL.md) · [Known issues and roadmap](https://github.com/drevendev/CompostClub/blob/main/docs/ROADMAP.md)

The application and original SVG illustrations are MIT-licensed. Gemma weights have their own terms and are not bundled with the app.

## How I Built It

The UI uses React, TypeScript, and Vite. The garden rules live in a separate domain layer, independent of React and the inference runtime. IndexedDB stores the pile and discoveries; Markdown exports and validated JSON backups provide portable copies.

Gemma has one narrow job: propose a title and a concept from two short scraps, with a source fragment from each. It receives no tools, shell, or archive search. The app renders input and output as text.

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

The browser models genuinely loaded and generated with WebGPU. Their four outputs failed the contract, so browser AI stays visibly experimental. Those failures remain in the evidence. A failed call never becomes a successful recording behind the scenes.

Even **24/24 valid responses does not mean 24 useful ideas**. Some concepts were weak, and some Russian requests returned English. Human usefulness review and a fresh unseen evaluation set are still open. The seven sample recordings are a selected subset; the remaining results are retained.

### A garden also has to remember

The application preserves raw source revisions and the original model responses. Editing a scrap does not rewrite the parents of an older discovery. Saving a sprout, consuming its pair, and spending its slot happen atomically. Errors, cancellation, and a model's `no_blend` response keep the slot.

Recovery matters here because the scraps are the user's contribution. Backup validation, competing-tab checks, restore conflict detection, and cascade previews for deletion all protect that contribution. The application has 91 unit tests and Chromium checks for offline use, recovery, competing tabs, and save/reload journeys. Those application checks are separate from model-quality evidence.

## Why Does Open Innovation Matter?

The core interaction can run on a machine the user controls. Ollama generation stays behind a loopback-only bridge. Scraps live in the browser, and the app has no account system, analytics, paid inference API, or cloud substitute.

Initial dependency and model downloads still need a connection and explicit setup. The optional browser-model download contacts the disclosed model hosting endpoints. The offline sample contains recordings rather than weights or live inference.

Open weights made it possible to compare model sizes locally and keep the failed experiments inspectable. Open application code makes the rest inspectable too: the prompt, validator, pairing rules, storage boundaries, and record of what actually ran. The model licence remains separate from the code licence.

Compost Club is an experimental local application. I have not measured time savings or demonstrated a productivity improvement. What exists today is a working invitation to revisit unfinished thoughts, together with evidence of where the local models succeeded and failed.

## Prize Categories

**Best Use of Gemma** — Gemma provides the idea-blending interaction through tested local Ollama runs; the sample replays exact results from Gemma 3 4B. No other partner integration is claimed.

_AI assistance was used in implementation, testing, documentation, and preparing this article and demo. Numerical claims above come from the repository's recorded experiments and verification reports. Creative usefulness remains a human judgment._

_Demo audio credits: “Somewhere Sunny (ver 2)” by Kevin MacLeod ([incompetech.com](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100567)), downloaded from [Wikimedia Commons](<https://commons.wikimedia.org/wiki/File:Somewhere_Sunny_(ver_2)_(ISRC_USUAN1100567).mp3>), licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Edited excerpt with reduced volume, ducking, and fades. Narration: [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0 model distribution, rendered locally with the MIT-licensed [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) runtime._
