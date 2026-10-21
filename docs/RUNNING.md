# Running and packaging Compost Club

From the repository root with Node 24 and npm 11. Start with the [README first run](../README.md#try-the-sample-garden).

## Run live local Gemma

Install [Ollama](https://ollama.com/download) from its official source. Set `OLLAMA_NO_CLOUD=1` in the Ollama process environment and restart that process. Download the model explicitly:

```sh
ollama pull gemma3:1b
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:4173`, choose **Your garden**, add two new scraps, open **Choose your local AI**, then **Connect local Gemma**. The server uses only `http://127.0.0.1:11434`. It listens only on loopback, requires Host/Origin/session-token checks, limits requests and runs one inference at a time.

For the better-quality, larger fallback, explicitly download `gemma3:4b`, then launch with `COMPOST_MODEL=gemma3:4b`. PowerShell:

```powershell
$env:COMPOST_MODEL='gemma3:4b'
npm start
```

Linux/macOS: `COMPOST_MODEL=gemma3:4b npm start`. Model weights have separate licences and are not included in this repository. The local 4B download is about 3.35 GB; it is slower and needs more memory than 1B. File size is not peak RAM usage.

The development evaluation used an isolated portable Ollama 0.40.6 on `127.0.0.1:11743`. To use another loopback port, set `OLLAMA_URL=http://127.0.0.1:11743` for the app and evaluation process. No remote upstreams are accepted.

## Browser AI

Use a recent Chromium with WebGPU and `shader-f16`. Choose **In this browser**, select a model and explicitly accept its download. The pinned 270M payload is 293,284,073 bytes; 1B is approximately 784 MB including tokenizer, plus the app-served runtime. Downloading contacts Hugging Face/CDN; generation sends no ideas there. A capable GPU and substantial additional RAM are needed. The feature is an experiment because output quality/format failed the release gate.

## Verify and package

```sh
npm run verify
npm run build
npm run package:single
# Start the local bridge in another terminal before the full live e2e suite:
npm start
npm run test:e2e
npm run package:demo
```

`test:e2e` includes a **real** Ollama 1B call; it requires that model installed. It does not replace inference with a test double. Pure unit tests never download models. The browser experiment runner requires the separate compiled lab (`npx vite build --mode lab`, then `npx vite preview --outDir dist-lab --port 4188`); run `node scripts/eval-browser.mjs` to capture real ONNX calls. The lab is excluded from the normal production build.

Artifacts: `dist/` (static Pages build), `release/compost-club-preview.html` (standalone recorded demo), and `release/` receipts/source manifest. The HTML is below its 2 MiB budget. Browser/file-origin storage is not portable across renaming or moving the file: export a JSON backup.

### Generate a verification receipt

The receipt generator requires an explicit scope and a complete successful report. It rejects empty/subset, failed, skipped, flaky or duplicated tests. `sample` means exactly the four sample/offline journeys; `live` means all seven ordinary e2e tests, including both real-model journeys. Runtime/source/build identities come from test attachments; missing metadata is marked unverified. Live scope also requires unchanged model-response attachments from both real journeys. Transport stubs do not count as live evidence.

```sh
npm run test -- --reporter=default --reporter=json --outputFile=.local/unit-results.json
# With the local bridge and an explicitly installed model running:
npm run test:e2e
node scripts/verification-receipt.mjs --scope live --report evidence/e2e-results.json --unit-report .local/unit-results.json
```

The default output is a new timestamped file under `.local/`. An explicit `--out` must name a new file; existing historical receipts are never overwritten. Public-safe publication of a receipt is a separate review step: raw reports/attachments can contain local paths or user ideas. A receipt links raw returned model text and reports structural validity; it does not establish creative quality or external attestation. Git commit/dirty status is recorded where Git exists, while the hashed source-file list identifies the actual tested inputs. Source archives without Git keep that metadata null.

## Privacy and provenance

No telemetry, cloud generation, paid API, accounts or external fonts. User data stays in IndexedDB or explicit downloads. Local mode makes no external requests after setup. Browser mode contacts the disclosed model CDN only for weight/tokenizer downloads. Source content and model output render as text. Deleting a scrap previews dependent sprouts and removes their snapshots. Personal and sample gardens are separate.

The six public inputs are specially authored fictional fixtures. All shipped recordings were produced locally; raw transcripts and hashes remain available. No private portfolio or archive texts are included.
