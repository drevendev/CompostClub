# GitHub Pages deployment preparation

Application website status: **PREPARED, NOT DEPLOYED**. The separate [video player](https://drevendev.github.io/CompostClub/?v=07c202852017) is hosted on GitHub Pages from the `codex/video-pages` branch. That branch contains the approved MP4, cover/poster, captions, credits, and player; it does not serve the interactive application. The source repository is public at [drevendev/CompostClub](https://github.com/drevendev/CompostClub), and the [DEV Week 3 article](https://dev.to/drevendev/let-your-wild-ideas-ferment-a-quiet-garden-powered-by-local-gemma-1c0o) was published on 22 October 2026. No domain has been registered. Deploying the application workflow below would replace the current video site and requires its own authorization.

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

The `.tech` domain is deferred. Do not register a domain, accept paid renewals, provide a payment card or claim a sponsor category based only on Pages. The owner declined Render and Entire on 22 October; neither is used or planned for this launch. The existing inert Render blueprint is not a deployment or category claim.

References: [official Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## Authorized Echo update completed — 22 October 2026

Commit bdb0c942dcae77aa097bc959237b1e020c5cb7ce updated only the eight allowlisted static video/player files on codex/video-pages. Pages CI: https://github.com/drevendev/CompostClub/actions/runs/39747617849 (success). The article's video link is https://drevendev.github.io/CompostClub/?v=07c202852017. Actual HTTPS playback, eight English cues, desktop/mobile layout and all seven payload SHA-256 values were verified. The later DEV publication is recorded in [publication materials](DEV_PUBLICATION.md); X is left to the owner.
