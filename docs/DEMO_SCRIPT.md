# Compost Club — short DEV demo

Local preparation only. The approximately 89-second, 1920 × 1080 review copy has English narration, on-screen captions, and a gentle guitar background. Its picture comes from the verified standalone sample inside a separate floral presentation frame. The original silent picture master is retained. The current narrated MP4 uses local Kokoro-82M v1.0, `af_heart`, speed 1.0, en-us: the same voice profile as the previously approved PatchPitch demo. The explicitly installed model and isolated Python environment stay in ignored project-local storage. No cloned voice, cloud speech service, or publication is involved.

## Visual direction

Warm cream paper, deep moss text, sage leaves, butter-yellow and dusty-pink flowers. Original vector flowers sway slowly at the frame edges. Leave the product fully readable; no petals cross buttons, source text, or captions. Use quiet dissolves between title cards and the application, with no flashing or rapid zooms. The app's own SVG garden and Wiggle remain the focus.

Keep **RECORDED DEMO · NO LIVE GENERATION** visible for the entire video. The application retains its own recorded labels. The frame, captions, pointer highlight, opening, and closing cards are presentation graphics, not application features. The demo clock is used only through the existing labelled button.

## Shot list and recorded English narration

| Time  | Actual screen action                                                               | On-screen caption                                         | Narration                                                                                                |
| ----- | ---------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 00–07 | Floral opening card; application already loaded behind it                          | Let your wild ideas ferment.                              | Some ideas are too odd to schedule, and too interesting to delete. Give them a little garden.            |
| 07–15 | Dismiss opening card; click **Try the sample garden**                              | A quiet home for unfinished thoughts.                     | Welcome to Compost Club. The sample uses fictional scraps and unchanged Gemma recordings.                |
| 15–24 | Show the six-scrap count, first two previews and garden; move pointer to discovery | Two scraps. One new possibility.                          | Two scraps grow into one possibility. This is recorded mode, with no live generation.                    |
| 24–34 | Click **Discover a recorded sprout**; show the actual returned title and concept   | A real Gemma result, replayed exactly.                    | Here is a real Gemma result for these exact inputs. You decide whether the combination is worth keeping. |
| 34–45 | Open **Grew from**; read both full sources side by side in the dialog              | Every sprout keeps its roots.                             | Open its roots to read both parents and their exact fragments. The original model text stays attached.   |
| 45–53 | Close roots; click **Keep this idea** and then **Collection**                      | Keep what makes you curious.                              | Keep what makes you curious. Your collection is saved locally, in this browser.                          |
| 53–61 | Reload the iframe; show the kept result again; export this sprout                  | Still here after a reload. Yours to export.               | Reload: your keeper is still here. Export Markdown with its sources and recorded label.                  |
| 61–70 | Return to **My garden**; click **Demo clock: +15 min** once; show slot change      | Time earns slots. Generation waits for you.               | Earn a slot every fifteen minutes, up to three. The demo clock skips time, without generating.           |
| 70–79 | Separate model-evidence card, clearly headed **Earlier local experiments**         | 4B: 24/24 structural checks. Human usefulness still open. | Four B passed all twenty-four format checks. Browser models failed. You still judge usefulness.          |
| 79–88 | Floral closing card, repository address, existing garden visible behind            | Made for the beautifully unfinished.                      | Explore the public code and evidence. Live generation needs local Ollama. Let your wild ideas ferment.   |

## Capture and verification

For the current compact-layout edition, set `$env:COMPOST_DEMO_DIR = 'release/dev-article-no-scroll'` before capture, synthesis, and soundtrack encoding. Earlier review media stays in its original folder. The real app viewport is 1730 × 776 inside the 1920 × 1080 floral frame, with no injected app CSS or hidden scrollbars. Every scene checks document dimensions, nested scroll containers, actual scroll offsets, and scroll events. A button outside the visible frame fails capture; the recipe never calls `scrollIntoView`.

Run `node scripts/capture-demo.mjs` from the repository root with the already installed Playwright Chromium available. It opens only a loopback server, drives the real offline HTML in an iframe, captures the browser viewport, and produces the MP4, WebM master, poster, contact sheet, caption file, and capture receipt under `release/dev-article-no-scroll/`. It never starts a model or uses response interception.

The receipt records the standalone SHA-256, browser version, real interaction assertions, exported Markdown hash, video duration, output hashes, and observed network requests. The selected result is read from the actual UI and compared with the public recordings, rather than assigned an invented title. All requests must stay on loopback. The exported Markdown must retain its recorded label and parents.

The opening, evidence, and closing cards summarize existing evidence. They do not claim a fresh inference run. The video is a guided sample demonstration with paced captions, not a timing benchmark. No private scraps, accounts, full desktop capture, external fonts, or cloned voice are used.

## Add and verify narration

Use an isolated Python 3.10–3.13 environment with `scripts/requirements-voice.txt`. Explicitly obtain `kokoro-v1.0.onnx` and `voices-v1.0.bin` from the [kokoro-onnx model-files-v1.1 release](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1) into `.local/kokoro/`. Neither synthesis script nor application downloads a model automatically. With the licensed MP3 and `music/provenance.json` from the local review bundle under `release/dev-article-no-scroll/`, run:

```powershell
.local\tts313\Scripts\python.exe scripts/synthesize-demo-kokoro.py
node scripts/soundtrack-demo.mjs
```

The first command reads [the narration cues](demo-narration.json), produces ten English PCM segments, places them on the measured picture timeline, adds short fades, and checks that every full phrase fits its scene. No speech is cut, overlapped, or time-stretched. Exact starts, finishes, model/voice hashes, package versions, and the synthetic-voice identity are in `release/dev-article-no-scroll/narration-heart/narration-timing.json`; `narration.srt` follows the actual spoken wording, while the original short on-screen captions remain burned in.

The final file is `release/dev-article-no-scroll/compost-club-demo-heart-sunny.mp4`. The encoder preserves the application and flowers, replaces the separate presentation footer's obsolete “no audio” label with a synthetic-narration disclosure, and adds a short closing music credit. It encodes H.264/AAC locally in Chromium, decodes the resulting audio, and compares all ten cue envelopes against the actual mixed PCM to check timing. It also checks duration, clipping, non-silence, final video frames, and absence of external requests. Results are in `soundtrack-receipt.json`.

## Background music

“Somewhere Sunny (ver 2)” — Kevin MacLeod (incompetech.com), downloaded from Wikimedia Commons under CC BY 3.0. The first approximately 89 seconds are used with a 1.5-second fade-in, 2.3-second fade-out, and smooth ducking. The mix checks that the music RMS stays at least 18 dB below the voice RMS in every spoken cue. The track is an existing recording, not generated music. [Full source, license, attribution, and changes](DEMO_MUSIC.md) are also included in `CREDITS.txt` beside the video; retain them in any future authorized publication.

The earlier Windows SAPI scripts and narrated file are historical alternatives. They are not used as an automatic fallback for Kokoro failures.

## Before publication

Review the article and watch and listen to the narrated MP4. Upload the approved video only after separate owner authorization, then replace the hidden video placeholder in `DEV_DRAFT.md` with its verified URL or DEV-supported embed. Use the poster/cover from the same media directory. The original silent master remains available as an alternative.

## Additional storyboards and future concepts

The recorded local DEV edition and its exact narration are specified above. The following previously approved storyboards remain planning references for other cuts or future features; they do not describe additional completed recordings. Publication still requires owner authorization.

## Three kinds of footage — never disguise one as another

- **RECORDED SAMPLE:** six deliberately **fictional** public source scraps paired with seven _real, unchanged_ Gemma 3 4B response recordings. Keep the UI's `recorded outputs / no live AI` disclosure in the frame, including exports.
- **GENUINE LOCAL LIVE:** two freshly typed public-safe inputs travel only to the local Ollama bridge; show the actual model ID, real waiting time and output/failure. Do not use hard-coded text, rerun until only best answers are shown without disclosure, or edit source screenshots to look like live generation.
- **FUTURE CONCEPT:** Books/Games/Tools gardens and Cross-Pollination are **not implemented** in this release. Any storyboard must be marked `Concept preview — planned feature, not current app`. Do **not** present a handcrafted projected idea as model output.

## Public-safe source→result cases (already included in the shipped recordings)

| Case                    | Original fictional scraps                                                            | Genuine recorded Gemma result                                          | Best visual angle                        |
| ----------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------- |
| **Clockwork Curios**    | `demo-01 + demo-03`: self-running tiny town + vending machine for unfinished hobbies | A toy-town repair system salvages one component from abandoned hobbies | Most self-referential Compost Club story |
| **Postcard Echoes**     | `demo-01 + demo-02`: self-running town + unsent postcards                            | Resident-solved problems become routes through linked observations     | Clearest 60–90s story                    |
| **Cartographic Echoes** | `demo-02 + demo-04`: postcards + library lending pocket weather                      | Ephemeral routes mapped through borrowed fog/rain                      | Surreal creative hook                    |
| **Небесный Повар**      | `demo-04 + demo-05`: pocket weather + kitchen word-collecting robot                  | Weather clouds alter recipes/aromas while text supplies dish names     | Bilingual, visually playful              |

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

## Video B — alternative DEV storyboard (planning reference)

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

## Video D — future _concept_ only: Books ↔ Games

**Do not use as shipped Week 3 evidence.**

- Show three card mockups: `Books`, `Games`, `Tools` (presets, not populated by default).
- Show receiver `Books: Cross-Pollination 0%` ⇒ no other garden is consulted.
- Flip to `10%`, separately enable `Games allows donation`. Display _10% chance to TRY one approved donor idea_, not a probability of a useful result.
- Set `100%` for an **illustrative** guaranteed eligible cross pair, one parent from Books + one from Games, preserving lineage.
- Reveal a handcrafted **concept sketch** of a storytelling-meets-idle mechanic, explicitly tagged `Proposed storyboard, not a model output`.
- Finish with `Planned after Week 3`, link feature Issues [#42](https://github.com/drevendev/CompostClub/issues/42)–[#44](https://github.com/drevendev/CompostClub/issues/44).

## Production and publication checklist

- Capture a fresh browser window with safe fictional sources only; no private vault, internal repo list, desktop wallpaper, credentials, local addresses or downloaded raw user backups.
- Include closed captions plus concise English text alternative/transcript; original visuals and audio with checked rights. Retain the current soundtrack attribution if using that track; other cuts may be silent.
- Test readability on phone, 16:9 DEV and a square/vertical cut for X. Keep the sample/live/future label visible throughout the relevant segment.
- Record **exact source SHA**, fixture source IDs and recording receipt for each model claim. A real video/file link is not invented.
- Publishing on GitHub Pages, uploading video, DEV submission and posting on X require separate owner approval; this planning file grants none.
