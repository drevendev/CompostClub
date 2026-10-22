# Third-party notices

The MIT app licence does not relicense model weights, runtimes or dependencies.

- **Gemma 3** by Google DeepMind: open weights governed by [Gemma Terms](https://ai.google.dev/gemma/terms) and [Prohibited Use Policy](https://ai.google.dev/gemma/prohibited_use_policy), not MIT. Weights are downloaded by explicit user choice, never bundled. Gemma model cards: [270M ONNX](https://huggingface.co/onnx-community/gemma-3-270m-it-ONNX), [1B ONNX](https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX), [Google model card](https://ai.google.dev/gemma/docs/core/model_card_3). ONNX conversions by ONNX Community.
- **Transformers.js 4.3.1** by Hugging Face: Apache-2.0; licence in `node_modules/@huggingface/transformers/LICENSE`.
- **ONNX Runtime Web** by Microsoft: MIT; browser runtime supplied through the pinned Transformers.js dependency tree. Runtime WASM is served from the app origin.
- **Sentry Node SDK 11.8.0** by Functional Software, Inc.: MIT, operator-only optional dependency; licence in `node_modules/@sentry/node/LICENSE`. It is not bundled into browser or recorded HTML builds.
- **React / React DOM** by Meta and contributors: MIT.
- **Vite, Vitest, TypeScript, Playwright, ESLint, Prettier, tsx, fake-indexeddb and vite-plugin-singlefile** retain their respective upstream licences as distributed in `node_modules`. They are development/build tools; the project lockfile records exact versions and integrity.
- **Ollama** runtime: MIT. The portable runtime and downloaded model files used for local evaluation are excluded from source and release artifacts.

Garden illustration, favicon, line icons, paper treatments and worm are original code/SVG drawn for this project. System fonts only; no purchased assets, external font requests or generated bitmap art.

The public scraps were provided as authored fictional demonstration fixtures for this project. The seven replay outputs are unchanged results of the documented local Gemma 3 4B runs. They are not samples of private user work. Full receipts identify their model, digest and source pair.
