import http from 'node:http';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

// Adds local Kokoro narration and an attributed downloaded track to verified footage.
const out = path.resolve(process.env.COMPOST_DEMO_DIR ?? 'release/dev-article');
const capture = JSON.parse(await readFile(path.join(out, 'capture-receipt.json'), 'utf8'));
const frameSeconds = capture.video.verifiedFrameSeconds ?? [2, 18, 28, 39, 50, 57, 66, 75, 84];
const timing = JSON.parse(
  await readFile(path.join(out, 'narration-heart/narration-timing.json'), 'utf8'),
);
const picture = await readFile(path.join(out, 'compost-club-demo.mp4'));
const voice = await readFile(path.join(out, 'narration-heart/voiceover.wav'));
const music = await readFile(path.join(out, 'music/Somewhere-Sunny-ver-2.mp3'));
const musicCredit = JSON.parse(await readFile(path.join(out, 'music/provenance.json'), 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
if (
  hash(picture) !== capture.outputs['compost-club-demo.mp4'].sha256 ||
  hash(picture) !== timing.pictureSha256
)
  throw new Error('Picture master does not match verified capture and voice timing.');
if (hash(voice) !== timing.mixSha256)
  throw new Error('Narration mix changed after timing verification.');
if (hash(music) !== musicCredit.sha256)
  throw new Error('Music source differs from license receipt.');
if (timing.voice !== 'af_heart' || timing.speed !== 1)
  throw new Error('Previous voice profile changed.');
const output = path.join(out, 'compost-club-demo-heart-sunny.mp4');
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
  ['/music.mp3', { bytes: music, type: 'audio/mpeg' }],
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
  await page.exposeFunction('saveMixedWav', async (chunk) => {
    const bytes = Buffer.from(chunk, 'base64');
    await writeFile(path.join(out, 'music/final-mix.wav'), bytes);
    routes.set('/expected.wav', { bytes, type: 'audio/wav' });
  });
  await page.goto(origin);
  console.log('Encoding floral picture with af_heart and downloaded CC BY music; local only.');
  const encoding = await page.evaluate(async (cues) => {
    const video = document.querySelector('video');
    video.src = '/picture.mp4';
    await new Promise((resolve, reject) => {
      video.onloadeddata = resolve;
      video.onerror = () => reject(new Error('Picture decode failed'));
    });
    const audio = new AudioContext({ sampleRate: 48000 });
    await audio.resume();
    const [voice, music] = await Promise.all(
      ['/voice.wav', '/music.mp3'].map(async (url) =>
        audio.decodeAudioData(await (await fetch(url)).arrayBuffer()),
      ),
    );
    if (music.duration < video.duration) throw new Error('Track does not cover the picture.');
    const rate = audio.sampleRate;
    const frames = Math.round(video.duration * rate);
    const buffer = audio.createBuffer(2, frames, rate);
    const speech = voice.getChannelData(0);
    const musicChannels = [0, Math.min(1, music.numberOfChannels - 1)].map((c) =>
      music.getChannelData(c),
    );
    let musicPower = 0;
    for (let i = 0; i < frames; i++)
      musicPower += (musicChannels[0][i] ** 2 + musicChannels[1][i] ** 2) / 2;
    const musicRms = Math.sqrt(musicPower / frames);
    const musicGain = Math.min(1, 0.032 / musicRms);
    const bed = audio.createBuffer(2, frames, rate);
    let peak = 0;
    for (let i = 0; i < frames; i++) {
      const t = i / rate;
      let duck = 1;
      for (const cue of cues) {
        if (t < cue.start - 0.2 || t > cue.finish + 1.15) continue;
        const level =
          t < cue.start
            ? 1 - 0.68 * ((t - cue.start + 0.2) / 0.2)
            : t <= cue.finish + 0.15
              ? 0.32
              : 0.32 + 0.68 * ((t - cue.finish - 0.15) / 1);
        duck = Math.min(duck, level);
      }
      const fade = Math.max(0, Math.min(1, t / 1.5, (video.duration - t) / 2.3));
      for (let channel = 0; channel < 2; channel++) {
        const background = musicChannels[channel][i] * musicGain * duck * fade;
        bed.getChannelData(channel)[i] = background;
        const value = (speech[i] ?? 0) + background;
        buffer.getChannelData(channel)[i] = value;
        peak = Math.max(peak, Math.abs(value));
      }
    }
    const mixGain = Math.min(1, 0.92 / peak);
    const dominance = cues.map((cue) => {
      let voiceEnergy = 0,
        bedEnergy = 0,
        samples = 0;
      for (let i = Math.round(cue.start * rate); i < Math.round(cue.finish * rate); i++) {
        voiceEnergy += (speech[i] ?? 0) ** 2;
        bedEnergy += (bed.getChannelData(0)[i] ** 2 + bed.getChannelData(1)[i] ** 2) / 2;
        samples++;
      }
      return {
        start: cue.start,
        voiceRms: Math.sqrt(voiceEnergy / samples) * mixGain,
        musicRms: Math.sqrt(bedEnergy / samples) * mixGain,
        voiceOverMusicDb: 10 * Math.log10(voiceEnergy / bedEnergy),
      };
    });
    if (dominance.some((cue) => cue.voiceOverMusicDb < 18))
      throw new Error('Music masks narration.');
    // Keep an exact PCM reference for independent AAC synchronization checks.
    const wav = new ArrayBuffer(44 + frames * 4);
    const data = new DataView(wav);
    const word = (offset, text) =>
      [...text].forEach((c, i) => data.setUint8(offset + i, c.charCodeAt(0)));
    word(0, 'RIFF');
    data.setUint32(4, wav.byteLength - 8, true);
    word(8, 'WAVE');
    word(12, 'fmt ');
    data.setUint32(16, 16, true);
    data.setUint16(20, 1, true);
    data.setUint16(22, 2, true);
    data.setUint32(24, rate, true);
    data.setUint32(28, rate * 4, true);
    data.setUint16(32, 4, true);
    data.setUint16(34, 16, true);
    word(36, 'data');
    data.setUint32(40, frames * 4, true);
    for (let channel = 0; channel < 2; channel++) {
      const samples = buffer.getChannelData(channel);
      for (let i = 0; i < frames; i++) {
        samples[i] *= mixGain;
        data.setInt16(44 + (i * 2 + channel) * 2, Math.round(samples[i] * 32767), true);
      }
    }
    let binary = '';
    const bytes = new Uint8Array(wav);
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    await window.saveMixedWav(btoa(binary));
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
      paint.fillText(
        cues[0].projectSeeds
          ? 'REAL PROJECT SEEDS · SYNTHETIC ENGLISH NARRATION · CAPTIONS'
          : 'RECORDED SAMPLE · SYNTHETIC ENGLISH NARRATION · CAPTIONS',
        960,
        1006,
      );
      if (video.currentTime >= (cues.at(-1).sceneStart ?? 79)) {
        paint.font = '12px "Segoe UI", Arial, sans-serif';
        paint.letterSpacing = '0.4px';
        paint.fillText(
          'Music: Somewhere Sunny (ver 2) — Kevin MacLeod · CC BY 3.0 · incompetech.com',
          960,
          1031,
        );
      }
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
      audioMix: {
        musicDuration: music.duration,
        musicGain,
        mixGain,
        peak: peak * mixGain,
        duckLevel: 0.32,
        fadeInSeconds: 1.5,
        fadeOutSeconds: 2.3,
        dominance,
      },
      editorialFooter:
        'Silent-master no-audio text replaced with a synthetic-narration disclosure; application and floral frame unchanged',
    };
  }, timing.cues);
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
      fetch('/expected.wav')
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
      // Compare decoded AAC against the actual PCM mix, including the licensed music.
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
  if (
    verification.rms < 0.01 ||
    verification.peak >= 1 ||
    verification.audioDuration < capture.video.duration - 0.4
  )
    throw new Error('Narration is silent, clipped or incomplete.');
  for (const cue of verification.synchronization)
    if (cue.correlation < 0.75 || Math.abs(cue.lagMs) > 100)
      throw new Error(`Narration synchronization failed: ${JSON.stringify(cue)}`);
  for (const second of frameSeconds) {
    await page.evaluate(async (second) => {
      const video = document.querySelector('video');
      const seeked = new Promise((resolve) =>
        video.addEventListener('seeked', resolve, { once: true }),
      );
      video.currentTime = second;
      await seeked;
      if (video.error) throw new Error('Narrated video frame unavailable');
    }, second);
    await page.screenshot({ path: path.join(out, `soundtrack-frame-${second}.png`) });
  }
  const external = [...requests].filter((url) => !url.startsWith(origin));
  if (external.length || errors.length) throw new Error(JSON.stringify({ external, errors }));
  const receipt = {
    createdAt: new Date().toISOString(),
    status: 'local only; not uploaded or published',
    output: 'compost-club-demo-heart-sunny.mp4',
    sha256: hash(await readFile(output)),
    pictureSha256: hash(picture),
    voiceMixSha256: hash(voice),
    finalPcmSha256: hash(await readFile(path.join(out, 'music/final-mix.wav'))),
    music: musicCredit,
    synthesisRecipeSha256: hash(await readFile('scripts/synthesize-demo-kokoro.py')),
    engine: timing.engine,
    voice: timing.voice,
    synthetic: true,
    browser: browser.version(),
    encoding,
    verification,
    cues: timing.cues,
    assertions: [
      'Original application picture, flowers and recorded/live labels retained; editorial footer updated for narration',
      'Local Kokoro af_heart voice at natural speed 1; no cloud synthesis or voice cloning',
      'Downloaded Kevin MacLeod music; source/license/edits attributed in credits and end frame',
      'Music at least 18 dB below speech RMS for every cue; smooth ducking and edge fades',
      'Each speech clip fits its scene without cutting or time stretching',
      `AAC decoded and correlated against all ${timing.cues.length} expected voice segments`,
      'Final MP4 frames decoded at nine positions',
      'No page errors or external requests',
    ],
    recipeSha256: hash(await readFile('scripts/soundtrack-demo.mjs')),
    requests: [...requests].map((url) => url.replace(origin, 'LOOPBACK')),
  };
  await writeFile(
    path.join(out, 'soundtrack-receipt.json'),
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
