import http from 'node:http';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

// Adds a disclosed, locally synthesized narration to an already verified picture master.
const out = path.resolve('release/dev-article');
const capture = JSON.parse(await readFile(path.join(out, 'capture-receipt.json'), 'utf8'));
const timing = JSON.parse(
  await readFile(path.join(out, 'narration/narration-timing.json'), 'utf8'),
);
const picture = await readFile(path.join(out, 'compost-club-demo.mp4'));
const voice = await readFile(path.join(out, 'narration/voiceover.wav'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
if (
  hash(picture) !== capture.outputs['compost-club-demo.mp4'].sha256 ||
  hash(picture) !== timing.pictureSha256
)
  throw new Error('Picture master does not match verified capture and voice timing.');
if (hash(voice) !== timing.mixSha256)
  throw new Error('Narration mix changed after timing verification.');
const output = path.join(out, 'compost-club-demo-narrated.mp4');
const routes = new Map([
  [
    '/',
    {
      bytes: Buffer.from(
        '<!doctype html><html lang="en"><meta charset="utf-8"><title>Local narration encoding</title><body style="margin:0;background:#f6f1e6"><video muted playsinline style="width:1920px;height:1080px"></video></body></html>',
      ),
      type: 'text/html',
    },
  ],
  ['/picture.mp4', { bytes: picture, type: 'video/mp4' }],
  ['/voice.wav', { bytes: voice, type: 'audio/wav' }],
]);
const server = http.createServer(async (req, res) => {
  const entry = routes.get(req.url);
  if (!entry) return res.writeHead(404).end();
  const bytes = entry.file ? await readFile(entry.file) : entry.bytes;
  const headers = {
    'Content-Type': entry.type,
    'Cache-Control': 'no-store',
    'Accept-Ranges': 'bytes',
  };
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '');
  if (range) {
    const start = Number(range[1]);
    const end = range[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
      'Content-Length': end - start + 1,
    });
    return res.end(bytes.subarray(start, end + 1));
  }
  res.writeHead(200, { ...headers, 'Content-Length': bytes.length });
  res.end(bytes);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const requests = new Set();
const errors = [];
context.on('request', (request) => requests.add(request.url()));
try {
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await writeFile(output, Buffer.alloc(0));
  await page.exposeFunction('saveNarratedChunk', (chunk) =>
    appendFile(output, Buffer.from(chunk, 'base64')),
  );
  await page.goto(origin);
  console.log(
    'Encoding existing floral picture with local English voice; no model or publication.',
  );
  const encoding = await page.evaluate(async () => {
    const video = document.querySelector('video');
    video.src = '/picture.mp4';
    await new Promise((resolve, reject) => {
      video.onloadeddata = resolve;
      video.onerror = () => reject(new Error('Picture decode failed'));
    });
    const audio = new AudioContext({ sampleRate: 48000 });
    await audio.resume();
    const buffer = await audio.decodeAudioData(await (await fetch('/voice.wav')).arrayBuffer());
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const destination = audio.createMediaStreamDestination();
    source.connect(destination);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const paint = canvas.getContext('2d');
    let framesPainted = 0;
    const drawFrame = () => {
      paint.drawImage(video, 0, 0);
      // The silent master says "no audio" only in this editorial footer, outside the app.
      paint.fillStyle = '#f6f1e6';
      paint.fillRect(130, 986, 1660, 31);
      paint.fillStyle = '#7c826d';
      paint.font = '13px "Segoe UI", Arial, sans-serif';
      paint.letterSpacing = '2px';
      paint.textAlign = 'center';
      paint.textBaseline = 'alphabetic';
      paint.fillText('RECORDED SAMPLE · SYNTHETIC ENGLISH NARRATION · CAPTIONS', 960, 1006);
      framesPainted++;
    };
    const nextFrame = () => {
      drawFrame();
      if (!video.ended) video.requestVideoFrameCallback(nextFrame);
    };
    drawFrame();
    video.requestVideoFrameCallback(nextFrame);
    const picture = canvas.captureStream(25);
    const stream = new MediaStream([
      ...picture.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/mp4;codecs=avc1.420028,mp4a.40.2',
      videoBitsPerSecond: 7000000,
      audioBitsPerSecond: 128000,
    });
    let writing = Promise.resolve();
    const completion = new Promise((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (!event.data.size) return;
        writing = writing
          .then(() => event.data.arrayBuffer())
          .then((buffer) => {
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i += 8192)
              binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
            return window.saveNarratedChunk(btoa(binary));
          });
      };
      recorder.onerror = (event) => reject(event.error);
      recorder.onstop = resolve;
    });
    video.onended = () => recorder.stop();
    recorder.start(1000);
    await video.play();
    const audioOffset = video.currentTime;
    source.start(audio.currentTime, audioOffset);
    await completion;
    await writing;
    source.stop();
    await audio.close();
    stream.getTracks().forEach((track) => track.stop());
    return {
      mimeType: recorder.mimeType,
      audioStartVideoOffset: audioOffset,
      width: video.videoWidth,
      height: video.videoHeight,
      sourceDuration: video.duration,
      framesPainted,
      editorialFooter:
        'Silent-master no-audio text replaced with a synthetic-narration disclosure; application and floral frame unchanged',
    };
  });
  routes.set('/narrated.mp4', { file: output, type: 'video/mp4' });
  await page.goto(origin);
  const verification = await page.evaluate(async (cues) => {
    const video = document.querySelector('video');
    video.src = '/narrated.mp4';
    await new Promise((resolve, reject) => {
      video.onloadeddata = resolve;
      video.onerror = () => reject(new Error('Narrated MP4 does not decode'));
    });
    const audio = new AudioContext({ sampleRate: 48000 });
    const [actual, expected] = await Promise.all([
      fetch('/narrated.mp4')
        .then((r) => r.arrayBuffer())
        .then((bytes) => audio.decodeAudioData(bytes)),
      fetch('/voice.wav')
        .then((r) => r.arrayBuffer())
        .then((bytes) => audio.decodeAudioData(bytes)),
    ]);
    const a = actual.getChannelData(0);
    const e = expected.getChannelData(0);
    const rate = actual.sampleRate;
    if (expected.sampleRate !== rate) throw new Error('Audio sample rates differ');
    let peak = 0,
      energy = 0;
    for (const value of a) {
      peak = Math.max(peak, Math.abs(value));
      energy += value * value;
    }
    const hop = Math.round(rate * 0.005);
    const envelope = (samples) => {
      const result = [];
      for (let i = 0; i < samples.length; i += hop) {
        let power = 0,
          count = 0;
        for (let j = i; j < Math.min(i + hop * 2, samples.length); j += 8) {
          power += samples[j] * samples[j];
          count++;
        }
        result.push(Math.sqrt(power / (count || 1)));
      }
      return result;
    };
    const actualEnvelope = envelope(a),
      expectedEnvelope = envelope(e);
    const synchronization = cues.map((cue) => {
      let best = { correlation: -1, lagMs: 0 };
      // Compare decoded AAC against the actual voice mix, not its text or an assumed duration.
      for (let lagMs = -250; lagMs <= 250; lagMs += 5) {
        const lag = Math.round(lagMs / 5);
        let xy = 0,
          xx = 0,
          yy = 0;
        for (let i = Math.round(cue.start / 0.005); i < Math.round(cue.finish / 0.005); i++) {
          const x = expectedEnvelope[i] ?? 0,
            y = actualEnvelope[i + lag] ?? 0;
          xy += x * y;
          xx += x * x;
          yy += y * y;
        }
        const correlation = xy / Math.sqrt(xx * yy || 1);
        if (correlation > best.correlation) best = { correlation, lagMs };
      }
      return { start: cue.start, finish: cue.finish, ...best };
    });
    await audio.close();
    return {
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      audioDuration: actual.duration,
      sampleRate: actual.sampleRate,
      channels: actual.numberOfChannels,
      peak,
      rms: Math.sqrt(energy / a.length),
      synchronization,
    };
  }, timing.cues);
  if (
    verification.width !== 1920 ||
    verification.height !== 1080 ||
    Math.abs(verification.duration - capture.video.duration) > 0.3
  )
    throw new Error('Narrated picture duration/dimensions changed unexpectedly.');
  if (verification.rms < 0.01 || verification.peak >= 1 || verification.audioDuration < 88.7)
    throw new Error('Narration is silent, clipped or incomplete.');
  for (const cue of verification.synchronization)
    if (cue.correlation < 0.75 || Math.abs(cue.lagMs) > 100)
      throw new Error(`Narration synchronization failed: ${JSON.stringify(cue)}`);
  for (const second of [2, 18, 28, 39, 50, 57, 66, 75, 84]) {
    await page.evaluate(async (second) => {
      const video = document.querySelector('video');
      const seeked = new Promise((resolve) =>
        video.addEventListener('seeked', resolve, { once: true }),
      );
      video.currentTime = second;
      await seeked;
      if (video.error) throw new Error('Narrated video frame unavailable');
    }, second);
    await page.screenshot({ path: path.join(out, `narrated-frame-${second}.png`) });
  }
  const external = [...requests].filter((url) => !url.startsWith(origin));
  if (external.length || errors.length) throw new Error(JSON.stringify({ external, errors }));
  const receipt = {
    createdAt: new Date().toISOString(),
    status: 'local only; not uploaded or published',
    output: 'compost-club-demo-narrated.mp4',
    sha256: hash(await readFile(output)),
    pictureSha256: hash(picture),
    voiceMixSha256: hash(voice),
    engine: timing.engine,
    voice: timing.voice,
    synthetic: true,
    browser: browser.version(),
    encoding,
    verification,
    cues: timing.cues,
    assertions: [
      'Original application picture, flowers and recorded/live labels retained; editorial footer updated for narration',
      'Local installed English voice; no network service or download',
      'Each speech clip fits its scene without cutting or time stretching',
      'AAC decoded and correlated against all ten expected voice segments',
      'Final MP4 frames decoded at nine positions',
      'No page errors or external requests',
    ],
    recipeSha256: hash(await readFile('scripts/narrate-demo.mjs')),
    requests: [...requests].map((url) => url.replace(origin, 'LOOPBACK')),
  };
  await writeFile(
    path.join(out, 'narration-receipt.json'),
    JSON.stringify(receipt, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      output: receipt.output,
      sha256: receipt.sha256,
      duration: verification.duration,
      audioRms: verification.rms,
      maximumSyncLagMs: Math.max(...verification.synchronization.map((cue) => Math.abs(cue.lagMs))),
    }),
  );
} finally {
  await context.close();
  await browser.close();
  server.close();
}
