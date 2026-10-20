# GitHub Pages deployment preparation

Website status: **PREPARED, NOT DEPLOYED**. The source repository is public at [drevendev/CompostClub](https://github.com/drevendev/CompostClub). Repository publication and website deployment are separate actions. No domain has been registered and no contest entry submitted.

## Local artifact

`npm ci`, `npm run verify`, `npm run build`. `dist/` contains the actual interactive app. Vite uses `base: './'`; app state uses an internal screen and `#sample` / `#garden`, with no history routing or rewrite requirement. Static assets, worker and WASM resolve beneath the current directory.

`npm run package:single` produces `release/compost-club-preview.html`: standalone recorded mode, not a weight bundle. `npm run package:demo` copies the Pages build and writes hashes. Run from the explicit source archive, or a clean source checkout, preserving the exact verified candidate if another build fails.

## Website deployment after separate owner authorization

1. Review current open issues and verify the intended source commit on `main`.
2. Run the local checks and review the source/build boundary before publishing any new artifact.
3. Include only the allowed source manifest, safe `docs/`, public fixtures, tests and public-safe model evidence. Exclude `brief/`, original ZIP/DOCX, `.local/`, model weights, attachment contents, secrets, private paths/URLs and raw owner archives. Never upload the whole workspace wholesale.
4. Configure Pages → Source → GitHub Actions, then manually dispatch `.github/workflows/pages.yml` on `main`. Pushes and pull requests do not deploy. The prepared workflow uses the official configure/upload/deploy Pages actions, a read-only build job, a scoped deployment job and concurrency protection.
5. Read the actual deployment receipt. Check its real HTTPS URL with a fresh Chromium profile, including relative assets, worker/WASM, sample cycle, persistence, export, 390 px mobile, keyboard and console/network errors.
6. Only after that readback mark the website published. The browser AI requires a fresh real model smoke test on the actual Pages origin before any public live certification.

The source repository is not evidence of a live site. Do not advertise an anticipated Pages URL as a working demo.

## Static host limits

Pages serves the sample garden and optional browser experiment. It cannot run the Ollama bridge. Live Ollama requires `npm start` on the visitor's own device. No public localhost tunnels, wildcard CORS, secrets or inference backend are introduced.

The `.tech` domain is deferred. Do not register a domain, accept paid renewals, provide a payment card or claim a sponsor category based only on Pages. Render and Entire are optional future work, not launch dependencies.

References: [official Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
