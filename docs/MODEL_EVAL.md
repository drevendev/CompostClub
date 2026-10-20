# Real model evaluation — 20 October 2026

Status: **MODEL_VERIFIED for actual execution; browser quality gate failed; OWNER_REVIEW_PENDING for creative usefulness.** No public-origin certification or cloud inference is claimed.

## Setup

Windows 11 (10.0.26200), x64, AMD Ryzen AI 7 350 with Radeon 860M, 33,597,272,064 bytes physical RAM. Browser: test Chromium 156.0.0.0; WebGPU adapter reported AMD / rdna-3 with shader-f16. Ollama 0.40.6 was started separately on 127.0.0.1:11743 with OLLAMA_NO_CLOUD=1 and project-owned weights. Its AMD driver check selected CPU inference; no driver or security settings were changed. Peak GPU/RAM usage was not measured.

The public fixture set was fixed before tuning: twelve source-pair combinations, two repetitions each, six labelled development and six labelled holdout, with EN and RU output requests. The second pass reused the now-seen holdout combinations, so it is a regression set, **not an untouched generalisation benchmark**. No private archive text was used in the public fixtures or recordings.

## Results

| Runtime / model | Prompt | Primary + repair calls | Final-validator successful runs | Median / maximum call latency |
|---|---|---:|---:|---:|
| Ollama Gemma 3 1B Q4_K_M | splice-1 | 24 + 24 | 0 / 24 | 3.56 / 6.36 s |
| Ollama Gemma 3 1B Q4_K_M | splice-2 | 24 + 1 | 23 / 24 | 2.53 / 6.54 s |
| Ollama Gemma 3 4B Q4_K_M | splice-2 | 24 + 0 | 24 / 24 | 9.05 / 11.75 s |

The narrower 1B pass originally reported 24/24 under the earlier validator. A later audit detected C1 control characters in one concept; the final validator rejects that response. This is deliberately reported as **23/24 under the shipped validator**, without rewriting the raw transcript. One other quote failure was successfully repaired. The final 4B pass still validates 24/24. No `no_blend` occurred in those ordinary fixture runs.

The original prompt demanded model-selected exact quotations. Every baseline call failed that requirement. In splice-2, `sourceQuote` deterministically selects short input fragments; the prompt shows them and `schemaFor` restricts quote values. The model invents the title/concept, while code checks all five fields, exact substrings, Unicode limits, control characters, request identity and source revision. The actual raw response is retained unchanged. A complete markdown JSON envelope may be unwrapped; arbitrary surrounding prose is rejected.

Ollama digests:

- 1B: `97558784bdc9175075a72655bf360b15da17df6b3b9e5182af9f8c0c8e58ba7c` (806,067,407 model bytes).
- 4B: `68ceab7e468a31c988b44d5a4984a0e21f58c4f7158c6ce29c1804babac38df7` (about 3.35 GB).

Generation parameters: structured JSON schema, num_ctx=4096, num_predict=384, temperature=0.6, seeds 42/43, keep_alive=60s, stream=false, timeout=120s, at most one repair. Exact prompt hashes, inputs, raw output, load duration and latency are stored per call. Medians include all performed calls, including failures and repairs; they are not an independent sustained throughput benchmark. First load costs are separately in `summary.json`.

## Browser ONNX gate

Both candidates really downloaded and ran with Transformers.js **4.3.1**, WebGPU, **q4f16**, a Web Worker, greedy generation and max_new_tokens=300.

| Model | Pinned revision | Files including tokenizer | Measured load | EN / RU generation |
|---|---|---:|---:|---:|
| onnx-community/gemma-3-270m-it-ONNX | `2dbbfdb1b59bd034eb959428c6a7da9dd7ea27f0` | 293,284,073 bytes | 18.02 s | 29.02 / 26.57 s |
| onnx-community/gemma-3-1b-it-ONNX | `a58439f40017d3b99c7d378ff525e54e0ba08ebf` | 783,856,804 bytes | 39.85 s | 9.59 / 6.84 s |

All four completed browser smoke outputs failed the final model contract. 270M generated malformed/repetitive JSON and copied placeholder prose. 1B produced plausible three-field concepts but omitted both source contribution fields. Neither is advertised as a proven public live mode. No fallback recording is substituted when a browser call fails.

Earlier manual in-app Chromium calls also loaded both candidates (about 15.4 / 35.5 seconds) and returned invalid outputs. The first automated development-server attempt was interrupted by hot reload and is explicitly incomplete; it is not counted as a completed inference. The final compiled-lab receipt is the reproducible four-call experiment. Separate browser profiles/cache states were used, so these load numbers are not a controlled cold-versus-warm comparison. Warm-cache load, physical mobile performance and peak memory remain open.

## Content review, not a model self-score

The agent's preliminary review found at least one recognizable combined mechanism in 10 of the 12 4B pair combinations. Two weaker pairs remain borderline: development-03-04 and holdout-02-03. Two RU requests (holdout-03-06 and holdout-04-06) returned English concepts in both repetitions, and are language failures even where the combination is understandable. This gives **8/12 preliminary joint content/language passes**, not an owner approval or accuracy claim.

For the 1B pass, many concepts merely juxtaposed inputs or lost a source. For example development-04-05 invented cats instead of using the word robot, and holdout-04-06 barely incorporated the promise garden. It is functional local inference with limited creative quality, not the recommended quality tier.

Seven reviewed 4B outputs are shipped unchanged as recordings, selected by the explicit case list in `scripts/select-recordings.ts`. Exact hashes and source receipts accompany each. Recorded mode only matches exact source texts and requested language. Selection does not erase the other results.

Three concrete real outputs to inspect:

1. **Postcard Echoes**, development-01-02 / rep0: solved town problems become linked postcard routes.
2. **Cartographic Echoes**, development-02-04 / rep0: observations map paths through borrowed weather.
3. **Небесный Повар**, development-04-05 / rep0: kitchen words and weather clouds become an unusual recipe mechanism.

## Evidence and reproduction

- [All baseline failures](../evidence/model/ollama-gemma3-1b-2026-10-20T16-34-38.533Z.jsonl)
- [Narrower 1B pass](../evidence/model/ollama-gemma3-1b-2026-10-20T16-40-50.005Z.jsonl)
- [4B pass](../evidence/model/ollama-gemma3-4b-2026-10-20T16-45-52.876Z.jsonl)
- [Completed browser experiment](../evidence/model/browser-2026-10-20T16-47-23.436Z.jsonl)
- [Machine-readable summary under the final validator](../evidence/model/summary.json)

`npm run eval:local` uses loopback port 11743 by default. Set EVAL_MODEL to the explicit supported candidate; install it first. The browser runner and compiled-lab commands are in README. Records are append-only per timestamp. `npx tsx scripts/model-report.ts` revalidates raw outputs and writes summary/prompt documents.

Remaining acceptance: owner usefulness review, a fresh unseen holdout, physical phone checks, peak memory measurement, controlled warm-cache timings and actual deployed-origin WebGPU testing. No measured time-savings claim was manufactured to fill those gaps.
