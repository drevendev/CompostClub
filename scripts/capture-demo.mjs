import http from 'node:http';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, stat, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

// Local editorial media only. No model, mock responses, publication, or app modifications.
const root = process.cwd();
const out = path.resolve(process.env.COMPOST_DEMO_DIR ?? 'release/dev-article');
const preview = process.argv.includes('--preview');
await mkdir(out, { recursive: true });
const standalone = await readFile(path.join(root, 'release/compost-club-preview.html'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const recordings = JSON.parse(await readFile('fixtures/public/recordings.json', 'utf8'));
const summaryBytes = await readFile('evidence/model/summary.json');
const summary = JSON.parse(summaryBytes.toString('utf8'));
const evidenceHash = sha(summaryBytes);
for (const [modelFile, expected] of [
  ['ollama-gemma3-1b-2026-10-20T16-34-38.533Z.jsonl', 0],
  ['ollama-gemma3-1b-2026-10-20T16-40-50.005Z.jsonl', 23],
  ['ollama-gemma3-4b-2026-10-20T16-45-52.876Z.jsonl', 24],
]) {
  const result = summary.find((entry) => entry.file === modelFile);
  if (result?.primaryCalls !== 24 || result.finalValidatorSuccessfulRuns !== expected)
    throw new Error('Model evidence changed; review the editorial claims before capturing.');
}

const cues = [
  [0, 7, 'Let your wild ideas ferment.'],
  [7, 15, 'A quiet home for unfinished thoughts.'],
  [15, 24, 'Two scraps. One new possibility.'],
  [24, 34, 'A real Gemma result, replayed exactly.'],
  [34, 45, 'Every sprout keeps its roots.'],
  [45, 53, 'Keep what makes you curious.'],
  [53, 61, 'Still here after a reload. Yours to export.'],
  [61, 70, 'Time earns slots. Generation waits for you.'],
  [70, 79, '4B: 24/24 structural checks. Human usefulness still open.'],
  [79, 88, 'Made for the beautifully unfinished.'],
];

function flowers() {
  const positions = [
    [28, 160, 0.9, '#dfaaa1', -13],
    [55, 388, 0.62, '#e7c66a', 8],
    [26, 702, 0.8, '#d8c1db', -8],
    [1846, 215, 0.72, '#e7c66a', 13],
    [1826, 494, 0.9, '#dfaaa1', -8],
    [1852, 784, 0.7, '#d8c1db', 12],
  ];
  return `<svg class="flowers" viewBox="0 0 1920 1080" aria-hidden="true">${positions
    .map(
      (
        [x, y, scale, colour, angle],
        i,
      ) => `<g transform="translate(${x} ${y}) scale(${scale}) rotate(${angle})"><g class="bloom" style="animation-delay:-${i}s">
      <path d="M0 3 Q-10 60 5 150" fill="none" stroke="#8f9e75" stroke-width="4"/>
      <path d="M0 82C-43 81-45 45-4 64M2 116C45 107 41 77 2 98" fill="#a9b58b"/>
      ${Array.from({ length: 7 }, (_, n) => `<ellipse cx="0" cy="-22" rx="12" ry="24" fill="${colour}" transform="rotate(${(n * 360) / 7})"/>`).join('')}
      <circle r="12" fill="#c2974f"/><circle cx="-3" cy="-3" r="3" fill="#f2d78e"/>
      </g></g>`,
    )
    .join('')}</svg>`;
}

const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Compost Club — local demo presentation</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#f6f1e6;color:#344732;font-family:'Segoe UI',Arial,sans-serif}
body{background-image:radial-gradient(#b8ae9829 .8px,transparent .8px);background-size:7px 7px}
.flowers{position:absolute;inset:0;width:1920px;height:1080px;pointer-events:none;z-index:5}.bloom{transform-origin:0 150px;animation:sway 7s ease-in-out infinite alternate}@keyframes sway{to{transform:rotate(5deg)}}
.mast{position:absolute;top:31px;left:94px;right:94px;display:flex;justify-content:space-between;align-items:center}.brand{font:700 30px Georgia,serif;letter-spacing:-.6px}.brand span{color:#8b9e74;margin-right:10px}.edition{font-size:14px;letter-spacing:2px;color:#6b765d}.badge{padding:12px 20px;border:1px solid #b8c39e;border-radius:24px;background:#edf0df;font-size:13px;letter-spacing:1.3px;font-weight:700}
.window{position:absolute;left:94px;top:98px;width:1732px;height:812px;border:1px solid #d7d8c2;border-radius:18px;background:#fffdf7;box-shadow:0 20px 55px #3f513316;overflow:hidden}
.window-bar{height:34px;background:#e9eadc;display:flex;align-items:center;padding:0 17px;gap:7px}.dot{width:7px;height:7px;border-radius:50%;background:#c7b4a2}.dot:nth-child(2){background:#c7c397}.dot:nth-child(3){background:#a7b394}.address{font-size:11px;color:#78816b;margin-left:20px;letter-spacing:1.2px}
iframe{border:0;width:1730px;height:776px;background:#f6f3eb;display:block}
.captions{position:absolute;top:944px;left:130px;right:130px;text-align:center;font:28px/1.25 Georgia,serif;letter-spacing:-.3px}.sub{font:13px 'Segoe UI',Arial,sans-serif;color:#7c826d;letter-spacing:2px;text-transform:uppercase;margin-top:12px}
.track{position:absolute;bottom:28px;left:94px;width:1732px;height:3px;background:#dedfce;border-radius:4px}.track i{display:block;width:0;height:100%;background:#8c9d71;transition:width 1s linear}
.card{position:absolute;inset:98px 94px 170px;z-index:4;background:#f6f3e9;border:1px solid #d7d8c2;border-radius:18px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;opacity:1;transition:opacity .75s ease;pointer-events:none}
.card.hidden{opacity:0}.kicker{font-size:15px;letter-spacing:4px;text-transform:uppercase;color:#7b8d63;margin:0 0 27px}.card h1{font:76px/1.04 Georgia,serif;letter-spacing:-2.5px;font-weight:400;margin:0 0 27px}.card em{color:#778951}.card p{font-size:23px;line-height:1.7;color:#69755c;margin:0}.mini-garden{font-size:53px;letter-spacing:20px;margin-bottom:27px;color:#85956b}.pill-row{display:flex;gap:18px;margin-top:32px}.pill{padding:11px 19px;border:1px solid #d1d8bf;border-radius:25px;background:#fdfbf3;font-size:15px;color:#657655}
.evidence{display:flex;gap:30px;margin:18px 0 26px}.metric{width:310px;background:#fffdf7;border:1px solid #d9dec9;border-radius:18px;padding:24px}.number{font:58px Georgia,serif;color:#516a42}.metric span{display:block;font-size:16px;color:#758365;line-height:1.7}.repo{font-size:22px!important;color:#3f5c3c!important;letter-spacing:1px;margin-top:25px!important}
.pointer{position:absolute;width:30px;height:30px;border:2px solid #d1a353;border-radius:50%;background:#e7c66a22;z-index:6;pointer-events:none;left:950px;top:520px;transform:translate(-50%,-50%);transition:opacity .2s;opacity:0}.pointer.click{box-shadow:0 0 0 14px #e7c66a24}
</style>
<div class="mast"><div class="brand"><span>✳</span>Compost Club</div><div class="edition">SLOW AND STEADY · HACKTOBERFEST 2026</div><div class="badge">RECORDED DEMO · NO LIVE GENERATION</div></div>
<div class="window"><div class="window-bar"><i class="dot"></i><i class="dot"></i><i class="dot"></i><span class="address">LOCAL OFFLINE SAMPLE · ACTUAL APPLICATION</span></div><iframe id="app" src="/app.html" title="Actual Compost Club sample"></iframe></div>
<section id="card" class="card"><div class="mini-garden">✿ ❋ ✿</div><div class="kicker">A quieter kind of creativity</div><h1>Let your wild ideas<br><em>ferment.</em></h1><p>A little garden for the beautifully unfinished.</p><div class="pill-row"><span class="pill">Local Gemma</span><span class="pill">Your ideas, your device</span><span class="pill">No rush</span></div></section>
${flowers()}<div id="pointer" class="pointer"></div><div class="captions"><div id="caption">Let your wild ideas ferment.</div><div id="subtitle" class="sub">Guided sample walkthrough · English captions · no audio</div></div><div class="track"><i id="progress"></i></div>
<script>window.present=(caption,progress,card)=>{document.querySelector('#caption').textContent=caption;document.querySelector('#progress').style.width=progress+'%';if(card===false)document.querySelector('#card').classList.add('hidden');else if(typeof card==='string'){document.querySelector('#card').innerHTML=card;document.querySelector('#card').classList.remove('hidden')}};</script></html>`;

await writeFile(path.join(out, 'presentation.html'), html);
const routes = new Map([
  ['/', { bytes: Buffer.from(html), type: 'text/html' }],
  ['/app.html', { bytes: standalone, type: 'text/html' }],
]);
const server = http.createServer(async (req, res) => {
  const route = routes.get(req.url);
  if (!route) return res.writeHead(404).end();
  const bytes = route.file ? await readFile(route.file) : route.bytes;
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '');
  const headers = { 'Content-Type': route.type, 'Cache-Control': 'no-store' };
  if (range) {
    const start = Number(range[1]);
    const end = range[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
      'Content-Length': end - start + 1,
      'Accept-Ranges': 'bytes',
    });
    return res.end(bytes.subarray(start, end + 1));
  }
  res.writeHead(200, { ...headers, 'Content-Length': bytes.length });
  res.end(bytes);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const assertions = [];
const requests = new Set();
const errors = [];
let context;
try {
  context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    acceptDownloads: true,
    ...(preview ? {} : { recordVideo: { dir: out, size: { width: 1920, height: 1080 } } }),
  });
  context.on('request', (request) => requests.add(request.url()));
  context.setDefaultTimeout(5000);
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin);
  const app = page.frameLocator('#app');
  const appFrame = await (await page.locator('#app').elementHandle()).contentFrame();
  await appFrame.evaluate(() => {
    window.__demoScrolls = [];
    document.addEventListener(
      'scroll',
      (event) => {
        const target = event.target;
        window.__demoScrolls.push({
          target: target instanceof Element ? target.className : 'document',
          x: window.scrollX,
          y: window.scrollY,
        });
      },
      true,
    );
  });
  await expect(
    app.getByRole('button', { name: 'Try the sample garden', exact: true }),
  ).toBeVisible();
  const started = Date.now();
  const shots = [];
  const layoutChecks = [];
  async function assertNoScroll(label) {
    const metrics = await appFrame.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scrollX,
      scrollY,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      events: window.__demoScrolls ?? [],
      nested: [...document.querySelectorAll('*')]
        .filter(
          (element) =>
            element.clientHeight &&
            element.scrollHeight > element.clientHeight + 1 &&
            /auto|scroll/.test(getComputedStyle(element).overflowY),
        )
        .map((element) => element.className),
    }));
    if (
      metrics.scrollX ||
      metrics.scrollY ||
      metrics.documentHeight > metrics.height + 1 ||
      metrics.documentWidth > metrics.width + 1 ||
      metrics.events.length ||
      metrics.nested.length
    )
      throw new Error(`Demo requires scrolling at ${label}: ${JSON.stringify(metrics)}`);
    layoutChecks.push({ label, ...metrics });
  }
  async function holdUntil(second) {
    if (!preview) await page.waitForTimeout(Math.max(0, second * 1000 - (Date.now() - started)));
  }
  async function cue(index, card) {
    const [second, , text] = cues[index];
    await holdUntil(second);
    await page.evaluate(({ text, progress, card }) => window.present(text, progress, card), {
      text,
      progress: (second / 88) * 100,
      card,
    });
    console.log(`Scene ${index + 1}: ${text}`);
  }
  async function shot(name) {
    await assertNoScroll(name);
    await page.waitForTimeout(preview ? 850 : 300);
    const filename = `${preview ? 'preview-' : ''}${name}.png`;
    await page.screenshot({ path: path.join(out, filename) });
    shots.push({ filename, timeSeconds: (Date.now() - started) / 1000 });
  }
  async function click(locator) {
    const target = await locator.boundingBox();
    if (
      !target ||
      target.x < 94 ||
      target.y < 132 ||
      target.x + target.width > 1826 ||
      target.y + target.height > 910
    )
      throw new Error('Demo target is not fully visible without scrolling.');
    const box = await locator.boundingBox();
    if (!box) throw new Error('Cannot locate visible app target');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.evaluate(
      ({ x, y }) => {
        const pointer = document.querySelector('#pointer');
        pointer.style.left = `${x}px`;
        pointer.style.top = `${y}px`;
        pointer.style.opacity = '1';
      },
      { x, y },
    );
    await page.mouse.move(x, y, { steps: 15 });
    if (!preview) await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelector('#pointer').classList.add('click'));
    await locator.click();
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      document.querySelector('#pointer').classList.remove('click');
      document.querySelector('#pointer').style.opacity = '0';
    });
  }
  await shot('cover');
  await cue(1, false);
  await page.waitForTimeout(850);
  await click(app.getByRole('button', { name: 'Try the sample garden', exact: true }));
  await expect(app.getByText(/recorded Gemma outputs · no live generation/)).toBeVisible();
  assertions.push('Sample garden retains the real recorded/no-live banner.');
  await cue(2);
  await shot('garden');
  await cue(3);
  await click(app.getByRole('button', { name: 'Discover a recorded sprout', exact: true }));
  await expect(app.locator('.sprout-card')).toBeVisible();
  const resultTitle = await app.locator('.sprout-card h3').innerText();
  const resultConcept = await app.locator('.sprout-concept').innerText();
  const fixture = recordings.find((item) => {
    const raw = JSON.parse(item.raw);
    return raw.title === resultTitle && raw.concept === resultConcept;
  });
  if (!fixture)
    throw new Error('Displayed result does not match an unchanged public model recording.');
  assertions.push(`Displayed result matches exact public recording: ${resultTitle}.`);
  await shot('sprout');
  await cue(4);
  await click(app.getByRole('button', { name: 'Grew from', exact: false }));
  const parents = await app.locator('.roots .parent p').allTextContents();
  if (parents[0] !== fixture.a || parents[1] !== fixture.b)
    throw new Error('Displayed parents differ from fixture.');
  assertions.push('Both displayed parents equal the model recording inputs.');
  await shot('roots');
  await cue(5);
  await click(app.getByRole('button', { name: 'Close dialog', exact: true }));
  await click(app.getByRole('button', { name: 'Keep this idea', exact: true }));
  await expect(app.getByRole('button', { name: 'Kept', exact: true })).toBeVisible();
  await click(app.getByRole('button', { name: /^Collection/ }));
  await shot('collection');
  await cue(6);
  await Promise.all([
    appFrame.waitForNavigation({ waitUntil: 'load' }),
    appFrame.evaluate(() => window.location.reload()),
  ]);
  await appFrame.evaluate(() => {
    window.__demoScrolls = [];
    document.addEventListener(
      'scroll',
      () => window.__demoScrolls.push({ x: scrollX, y: scrollY }),
      true,
    );
  });
  // Reload restores the garden tab; Collection remains an explicit user action.
  await click(app.getByRole('button', { name: /^Collection/ }));
  await expect(app.locator('.sprout-card h3')).toHaveText(resultTitle);
  await expect(app.getByRole('button', { name: 'Kept', exact: true })).toBeVisible();
  assertions.push('Kept result persists after a real iframe reload.');
  const downloadPromise = page.waitForEvent('download');
  await click(app.getByRole('button', { name: 'Export this sprout', exact: true }));
  const download = await downloadPromise;
  const markdown = await readFile(await download.path(), 'utf8');
  if (
    !/recorded/i.test(markdown) ||
    !markdown.includes(resultTitle) ||
    !markdown.includes('Grew from:')
  )
    throw new Error('Export lost provenance or recorded label.');
  await writeFile(path.join(out, 'demo-export.md'), markdown);
  assertions.push('Actual downloaded Markdown preserves result, parents and recorded provenance.');
  await shot('reload-export');
  await cue(7);
  await click(app.getByRole('button', { name: 'My garden', exact: true }));
  await click(app.getByRole('button', { name: 'Demo clock: +15 min', exact: true }));
  await expect(app.getByRole('heading', { name: '1 slot is ready', exact: true })).toBeVisible();
  assertions.push('The labelled demo clock restores one ready slot through the UI.');
  await shot('clock');
  await cue(
    8,
    '<div class="kicker">Earlier local experiments · fixed public fixtures</div><h1>Format is a start.<br><em>Usefulness is your call.</em></h1><div class="evidence"><div class="metric"><div class="number">24 / 24</div><span>Gemma 3 4B · Ollama<br>structural checks passed</span></div><div class="metric"><div class="number">0 / 4</div><span>Browser 270M + 1B<br>small combined smoke set</span></div></div><p>Different experiment sizes and setups. Human usefulness review remains open.</p>',
  );
  await shot('evidence');
  await cue(
    9,
    '<div class="mini-garden">✿ ❋ ✿</div><div class="kicker">A small open garden</div><h1>Made for the<br><em>beautifully unfinished.</em></h1><p>Try the recorded sample. Explore the code and evidence.</p><p class="repo">github.com/drevendev/CompostClub</p><div class="pill-row"><span class="pill">Live Ollama: separate local setup</span><span class="pill">No account. No paid API.</span></div>',
  );
  await shot('end');
  await holdUntil(88);
  const video = page.video();
  await context.close();
  context = undefined;
  const external = [...requests].filter(
    (url) => !url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:'),
  );
  if (errors.length || external.length) throw new Error(JSON.stringify({ errors, external }));
  assertions.push('No page errors and no external requests during capture.');
  let videoMetadata;
  const outputNames = [];
  if (!preview) {
    const master = path.join(out, 'compost-club-demo.webm');
    await rename(await video.path(), master);
    outputNames.push('compost-club-demo.webm');
    routes.set('/master.webm', { file: master, type: 'video/webm' });
    const encodeContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const encoder = await encodeContext.newPage();
    const mp4 = path.join(out, 'compost-club-demo.mp4');
    await writeFile(mp4, Buffer.alloc(0));
    await encoder.exposeFunction('saveVideoChunk', async (base64) =>
      appendFile(mp4, Buffer.from(base64, 'base64')),
    );
    await encoder.goto(origin);
    console.log('Encoding the captured WebM to H.264 MP4 in local Chromium.');
    const encoding = await encoder.evaluate(async () => {
      document.body.innerHTML = '<video id="source" muted playsinline></video>';
      const v = document.querySelector('video');
      v.style.cssText = 'width:1920px;height:1080px';
      v.src = '/master.webm';
      await new Promise((resolve, reject) => {
        v.onloadeddata = resolve;
        v.onerror = () => reject(new Error('WebM decode failed'));
      });
      const stream = v.captureStream();
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/mp4;codecs=avc1.420028',
        videoBitsPerSecond: 7000000,
      });
      let writeChain = Promise.resolve();
      const ended = new Promise((resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size)
            writeChain = writeChain
              .then(() => event.data.arrayBuffer())
              .then((buffer) => {
                const bytes = new Uint8Array(buffer);
                let binary = '';
                for (let i = 0; i < bytes.length; i += 8192)
                  binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
                return window.saveVideoChunk(btoa(binary));
              });
        };
        recorder.onerror = (event) => reject(event.error);
        recorder.onstop = resolve;
      });
      v.onended = () => recorder.stop();
      recorder.start(1000);
      await v.play();
      await ended;
      await writeChain;
      stream.getTracks().forEach((track) => track.stop());
      return {
        mimeType: recorder.mimeType,
        sourceDuration: v.duration,
        width: v.videoWidth,
        height: v.videoHeight,
      };
    });
    await encodeContext.close();
    routes.set('/demo.mp4', { file: mp4, type: 'video/mp4' });
    const check = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await check.goto(origin);
    const metadata = await check.evaluate(async () => {
      document.body.innerHTML =
        '<video id="final" muted playsinline style="width:1920px;height:1080px" src="/demo.mp4"></video>';
      const v = document.querySelector('video');
      await new Promise((resolve, reject) => {
        v.onloadeddata = resolve;
        v.onerror = () => reject(new Error('MP4 decode failed'));
      });
      return { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
    });
    if (
      metadata.duration < 85 ||
      metadata.duration > 100 ||
      metadata.width !== 1920 ||
      metadata.height !== 1080
    )
      throw new Error(`Unexpected MP4 metadata: ${JSON.stringify(metadata)}`);
    const checks = [2, 18, 28, 39, 50, 57, 66, 75, 84];
    for (const second of checks) {
      await check.evaluate(async (second) => {
        const v = document.querySelector('video');
        const seek = new Promise((resolve) =>
          v.addEventListener('seeked', resolve, { once: true }),
        );
        v.currentTime = second;
        await seek;
        if (v.error || v.readyState < 2) throw new Error('MP4 frame unavailable');
      }, second);
      await check.screenshot({ path: path.join(out, `video-frame-${second}.png`) });
    }
    await check.close();
    videoMetadata = {
      ...metadata,
      encoding,
      verifiedFrameSeconds: checks,
      audio: 'none',
      captions: 'burned-in English text',
    };
    outputNames.push('compost-club-demo.mp4');
    assertions.push('Final H.264 MP4 decodes in Chromium at nine positions across its duration.');
  }
  // Compose a visual QA sheet from the final MP4 frames, or preview shots.
  const sheetNames = preview
    ? shots.map((shot) => shot.filename)
    : [2, 18, 28, 39, 50, 57, 66, 75, 84].map((second) => `video-frame-${second}.png`);
  for (const filename of sheetNames)
    routes.set(`/${filename}`, { file: path.join(out, filename), type: 'image/png' });
  const sheet = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  await sheet.goto(origin);
  await sheet.setContent(
    `<html><body style="margin:0;padding:18px;background:#eee9dc;font:14px Arial;color:#344732;display:grid;grid-template-columns:repeat(3,1fr);gap:14px">${sheetNames.map((filename) => `<div><img style="width:100%;border-radius:7px" src="${origin}/${filename}"><p style="margin:5px">${filename}</p></div>`).join('')}</body></html>`,
  );
  await sheet
    .locator('img')
    .evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
  await sheet.screenshot({
    path: path.join(out, `${preview ? 'preview-' : ''}contact-sheet.png`),
    fullPage: true,
  });
  await sheet.close();
  const timestamp = (seconds) =>
    `00:${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')},000`;
  await writeFile(
    path.join(out, 'captions.srt'),
    cues
      .map(([from, to, text], i) => `${i + 1}\n${timestamp(from)} --> ${timestamp(to)}\n${text}\n`)
      .join('\n'),
  );
  await writeFile(path.join(out, 'caption-cues.json'), JSON.stringify(cues, null, 2) + '\n');
  if (!preview) {
    await writeFile(
      path.join(out, 'cover.png'),
      await readFile(path.join(out, 'video-frame-2.png')),
    );
    outputNames.push('cover.png', 'contact-sheet.png', 'captions.srt', 'demo-export.md');
  }
  const hashes = {};
  for (const name of outputNames)
    hashes[name] = {
      sha256: sha(await readFile(path.join(out, name))),
      bytes: (await stat(path.join(out, name))).size,
    };
  await writeFile(
    path.join(out, `${preview ? 'preview-' : ''}capture-receipt.json`),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        status: 'local-only; not published',
        mode: 'Exact public-fixture replay; no live generation',
        browser: browser.version(),
        captureRecipeSha256: sha(await readFile('scripts/capture-demo.mjs')),
        standaloneSha256: sha(standalone),
        modelEvidenceSummarySha256: evidenceHash,
        result: {
          title: resultTitle,
          concept: resultConcept,
          receipt: fixture.receipt,
          rawSha256: fixture.rawSha256,
        },
        assertions,
        video: videoMetadata,
        shots,
        layoutChecks,
        requests: [...requests].map((url) => url.replace(origin, 'LOOPBACK')),
        outputs: hashes,
        presentation:
          'Original SVG floral frame, title/evidence cards and burned-in captions around an unchanged app iframe. No audio.',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Done: ${path.relative(root, out)} (${preview ? 'preview only' : 'verified local media'})`,
  );
} finally {
  await context?.close();
  await browser.close();
  server.close();
}
