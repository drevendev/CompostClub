# Let your wild ideas ferment: a quiet garden powered by local Gemma

> Working draft for the Hacktoberfest Week 3 submission. Not submitted. Add the verified repository link and either a verified demo URL or an actual video before posting. Recheck current rules and the official submission template at that time.

## What I built

Compost Club is a small idle garden for unfinished thoughts. Drop two scraps into a pile, let a local model combine them, and decide whether the new thought is a keeper. You can take it away as Markdown, or return it to the compost with its origins intact.

The idle mechanic is deliberately small. There is one immediate welcome slot and another pairing every fifteen minutes, capped at three. Nothing dies while the tab is closed. The app only accrues time credits while you're away; it does not pretend a browser was generating ideas in the background.

## One model, one job

The task is narrow: invent one concept from two short scraps, with an exact fragment from each parent. Gemma gets no tools, shell, network access or archive search. A code validator checks the five-field response and both quotes before spending a slot. A valid schema proves the format and provenance, not the usefulness of a concept.

The model experiments changed the design. The initial Gemma 3 1B prompt failed all 24 predetermined runs because source quotes were paraphrased. Constraining exact fragments in the JSON schema fixed most structural errors, but the creative quality was uneven. Browser 270M and 1B really loaded and generated with WebGPU; both failed the output contract on the small EN/RU smoke set. Those failed raw responses are kept in the evidence.

The explicitly tested local 4B fallback was more useful. Its 24 predefined runs all passed the structural validator without a repair. Seven unchanged recordings became the sample garden. The final assessment of creative usefulness is still pending owner review; these are fixture experiments, not a broad benchmark.

## Three real experiments

**Postcard Echoes.** A town that solves problems while the player is away meets a box of unsent postcards. Gemma proposed linking postcards about solved problems into new walking routes. The original sources remain visible in the sprout.

**Cartographic Echoes.** Postcards meet a library lending tiny weather systems. The generated concept uses observations as coordinates for temporary routes through borrowed fog and rain. This is an imagined mechanism, not a claim that a real service exists.

**Небесный Повар.** A word-collecting kitchen robot meets the weather library. The local model proposed little weather clouds that affect a dish's aroma and texture. This is one of the Russian-input experiments; other Russian cases switched to English and are documented as language failures.

All examples above are real, unedited model results from the provided fictional fixtures. Include the exact raw snippets or screenshots from the model report when finalising the article.

## Why open innovation matters here

Open model weights let the central interaction run on a user's own machine with a small, inspectable interface. The model, prompt version, exact inputs, failures and limitations can be examined. There is no paid API or hidden cloud substitute. The project code and model licences remain separate.

## What the demo does today

The static sample is playable without downloading a model and is always labelled recorded. It supports real persistence, time reconciliation, editing, keep/recompost, export and backup restore. Live generation uses a loopback-only Ollama bridge. Browser-local ONNX is an opt-in experiment until it meets the quality gate.

## Slow and steady

The garden does not reward frantic clicking. It gives a forgotten thought a place to rest and a small chance to become something else. There are no streaks, upgrades, payments or productivity scores. The user remains the editor.

## Prize category and disclosure

Intended primary category: Best Use of Gemma. Do not claim qualification or a prize in advance. Pages is the intended free host; `.tech`, Render and Entire are not claimed integrations. AI assistance was used for implementation and documentation. No measured time savings, customers or owner testimonials are asserted.

Before submission: add verified links, review the final article in English, include the actual video, recheck the deadline and rules, and submit only after separate owner authorization.
