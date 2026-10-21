# Compost Club — Demo and video scripts (21 October 2026)

**Status:** storyboard and narration **prepared, not recorded or published**. Source baseline: public fixture set and [MODEL_EVAL.md](MODEL_EVAL.md), roadmap [section 7](ROADMAP.md#7-demo-and-video-plan--existing-release-now-future-garden-ecosystem-later), task [#46](https://github.com/drevendev/CompostClub/issues/46). Capture real UI and evidence before adding public URLs.

## Three kinds of footage — never disguise one as another

- **RECORDED SAMPLE:** six deliberately **fictional** public source scraps paired with seven *real, unchanged* Gemma 3 4B response recordings. Keep the UI's `recorded outputs / no live AI` disclosure in the frame, including exports.
- **GENUINE LOCAL LIVE:** two freshly typed public-safe inputs travel only to the local Ollama bridge; show the actual model ID, real waiting time and output/failure. Do not use hard-coded text, rerun until only best answers are shown without disclosure, or edit source screenshots to look like live generation.
- **FUTURE CONCEPT:** Books/Games/Tools gardens and Cross-Pollination are **not implemented** in this release. Any storyboard must be marked `Concept preview — planned feature, not current app`. Do **not** present a handcrafted projected idea as model output.

## Public-safe source→result cases (already included in the shipped recordings)

| Case | Original fictional scraps | Genuine recorded Gemma result | Best visual angle |
| --- | --- | --- | --- |
| **Clockwork Curios** | `demo-01 + demo-03`: self-running tiny town + vending machine for unfinished hobbies | A toy-town repair system salvages one component from abandoned hobbies | Most self-referential Compost Club story |
| **Postcard Echoes** | `demo-01 + demo-02`: self-running town + unsent postcards | Resident-solved problems become routes through linked observations | Clearest 60–90s story |
| **Cartographic Echoes** | `demo-02 + demo-04`: postcards + library lending pocket weather | Ephemeral routes mapped through borrowed fog/rain | Surreal creative hook |
| **Небесный Повар** | `demo-04 + demo-05`: pocket weather + kitchen word-collecting robot | Weather clouds alter recipes/aromas while text supplies dish names | Bilingual, visually playful |

Sources: [fixtures/public/scraps.json](../fixtures/public/scraps.json), [fixtures/public/recordings.json](../fixtures/public/recordings.json), [unchanged model transcripts](../evidence/model/ollama-gemma3-4b-2026-10-20T16-45-52.876Z.jsonl). These are **NOT** private owner archive successes, adoption proof or newly generated video outputs.

## Video A — 20–30 seconds · X / vertical or square cut

**0–4s · Hook.** Screen title: `Too many ideas. Not enough lifetimes.` Show paper scraps/idea pile.
Narration: “I don't need another backlog telling me to finish everything.”

**4–10s · The premise.** Open Sample Garden, show the worm Wiggle and a fictitious two-source pair.
Narration: “So I gave my unfinished ideas a compost heap.”

**10–21s · Surprise.** Discover an actual recorded `Clockwork Curios` result. Keep `recorded Gemma outputs · no live generation` visible. Open `Grew from`; show both original scraps.
Narration: “Two little scraps can still grow into a stranger third thing.”

**21–30s · Close.** Save/Keep and show exact tagline.
Screen: `Compost Club — Let your wild ideas ferment.` Add **only verified** link to code or published demo.
Narration: “And you don't have to finish every idea to enjoy it.”

## Video B — 75–90 seconds · one Week 3 DEV competition demo

**0–10s:** Title, worm and creator's problem. Caption: `A home for beautifully unfinished ideas.`
Narration: “I have more half-finished ideas than I can build, so I made somewhere for them to grow.”

**10–24s:** Pick two **public-safe** scraps from the sample or type truly new fictional inputs for locally verified Ollama. Clearly show which mode is being used.
Narration: “Drop in two scraps. A tiny local model tries to find one new thing they could become together.”

**24–42s:** Click `Discover a recorded sprout` in Sample mode or genuinely run local Gemma with model identity shown. If using sample, show actual `Postcard Echoes` or `Clockwork Curios` without editing original model response. For live Ollama, retain the original screen capture and real inference duration; label any edit cuts.
Narration: “This one crossed [name exact fictional input A] with [input B]. The result isn't a finished product. It's a new seed.”

**42–55s:** Expand `Grew from` and visibly inspect both immutable source fragments, then Keep, All Discoveries and one **reviewed safe-to-share** Markdown export (see [#40](https://github.com/drevendev/CompostClub/issues/40)).
Narration: “You see exactly where it grew from, and you decide whether it's worth keeping.”

**55–70s:** Demonstrate the **clearly labelled** `Demo clock +15 min` in Sample mode, or leave and reopen with actual elapsed time. Show credited pairings, not secretly computed AI results.
Narration: “When you're away, the compost rests. The timer earns pairing credits. No model runs behind your back.”

**70–90s:** Show source repo, model validation notes and local privacy notice. Narration: “The app is open source. Real new ideas can run on your computer with Gemma and Ollama. The public sample is recorded and says so. No account, paid API or forced daily streak. Let your wild ideas ferment.”
End slate: `Compost Club`, exact source URL, actual demo/video URL **only if verified**.

**If actual Pages isn't deployed:** official rules allow a real video as the demonstration. The video must still prove real working behavior; don't imply a static screenshot is hosted live AI.

## Video C — 2–3 minutes · technical DEV/OSS clip

Show actual public evidence while narrating:
1. What a single pair and five-field contract look like (fictional inputs only).
2. Initial local 1B `splice-1` quote selection: **0/24** final structurally valid runs; don't call that 0 good ideas.
3. Deterministic `sourceQuote` + constrained schema: local 1B `splice-2` **23/24**; local 4B **24/24** format-valid on fixed development cases; model/prompt identity and raw outputs must be visible.
4. A good-looking model JSON isn't necessarily a good blend; preliminary human-style **8/12** pair-level content+language acceptances are **not** owner confirmation.
5. Browser ONNX 270M/1B actually ran but the four initial smoke outputs were **0/4 structurally valid**; this is why browser mode remains experimental.
6. How saving, retries, provenance, and a human Keep decision limit overclaiming.

No network/market/adoption claims; source and model rights separate.

## Video D — future *concept* only: Books ↔ Games

**Do not use as shipped Week 3 evidence.**
- Show three card mockups: `Books`, `Games`, `Tools` (presets, not populated by default).
- Show receiver `Books: Cross-Pollination 0%` ⇒ no other garden is consulted.
- Flip to `10%`, separately enable `Games allows donation`. Display *10% chance to TRY one approved donor idea*, not a probability of a useful result.
- Set `100%` for an **illustrative** guaranteed eligible cross pair, one parent from Books + one from Games, preserving lineage.
- Reveal a handcrafted **concept sketch** of a storytelling-meets-idle mechanic, explicitly tagged `Proposed storyboard, not a model output`.
- Finish with `Planned after Week 3`, link feature Issues [#42](https://github.com/drevendev/CompostClub/issues/42)–[#44](https://github.com/drevendev/CompostClub/issues/44).

## Production and publication checklist

- Capture a fresh browser window with safe fictional sources only; no private vault, internal repo list, desktop wallpaper, credentials, local addresses or downloaded raw user backups.
- Include closed captions plus concise English text alternative/transcript; all original visuals/audio with checked rights. No background track needed.
- Test readability on phone, 16:9 DEV and a square/vertical cut for X. Keep the sample/live/future label visible throughout the relevant segment.
- Record **exact source SHA**, fixture source IDs and recording receipt for each model claim. A real video/file link is not invented.
- Publishing on GitHub Pages, uploading video, DEV submission and posting on X require separate owner approval; this planning file grants none.
