import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prompt, schemaFor, validateScrap, parseOutput } from '../src/inference/contract.ts';

import { DIRECTIONS, parseGrowth } from '../src/domain/growth.ts';
import { growthSchema, tendPrompt } from '../src/inference/tend.ts';
import { createObserver } from './observability.mjs';

const observer = await createObserver();
const port = Number(process.env.PORT ?? 4173);
const upstream = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(upstream))
  throw new Error('Ollama must use a fixed loopback URL.');
const model = process.env.COMPOST_MODEL ?? 'gemma3:1b';
if (!['gemma3:1b', 'gemma3:4b'].includes(model))
  throw new Error('Only local Gemma 3 1B or 4B is supported.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const token = randomBytes(32).toString('hex');
let busy = false;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};
const origin = `http://127.0.0.1:${port}`;
function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
export const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.headers.host !== `127.0.0.1:${port}`) {
    json(res, 403, { error: 'Invalid Host' });
    return;
  }
  if (req.headers.origin && req.headers.origin !== origin) {
    json(res, 403, { error: 'Invalid Origin' });
    return;
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    json(res, 403, { error: 'Cross-site access denied' });
    return;
  }
  try {
    let url;
    try {
      url = new URL(req.url ?? '/', origin);
      decodeURIComponent(url.pathname);
    } catch {
      json(res, 400, { error: 'Invalid request URL' });
      return;
    }
    if (url.pathname === '/api/health' && req.method === 'GET') {
      const tags = await fetch(upstream + '/api/tags', { signal: AbortSignal.timeout(4000) }).then(
        (r) => r.json(),
      );
      const installed = tags.models?.find((m) => m.name === model);
      if (!installed) {
        json(res, 503, { error: `Run ollama pull ${model} before connecting.` });
        return;
      }
      json(res, 200, { token, model, digest: installed.digest, monitoring: observer.enabled });
      return;
    }
    if (['/api/ferment', '/api/tend'].includes(url.pathname) && req.method === 'POST') {
      const supplied = req.headers['x-compost-token'];
      if (
        req.headers.origin !== origin ||
        typeof supplied !== 'string' ||
        Buffer.byteLength(supplied) !== Buffer.byteLength(token) ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
      ) {
        json(res, 403, { error: 'Session token and same-origin request required.' });
        return;
      }
      if (busy) {
        json(res, 429, { error: 'One local idea is already growing.' });
        return;
      }
      if (!req.headers['content-type']?.startsWith('application/json')) {
        json(res, 415, { error: 'JSON required' });
        return;
      }
      // Reserve the slot before awaiting body bytes or model discovery.
      busy = true;
      let bodyTimer;
      try {
        const chunks = [];
        let bytes = 0;
        bodyTimer = setTimeout(() => req.destroy(), 15000);
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 16384) {
            json(res, 413, { error: 'Request too large' });
            return;
          }
          chunks.push(chunk);
        }
        clearTimeout(bodyTimer);
        let data;
        try {
          data = JSON.parse(
            new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
          );
        } catch {
          json(res, 400, { error: 'Valid UTF-8 JSON required' });
          return;
        }
        if (
          !data ||
          typeof data !== 'object' ||
          typeof data.requestId !== 'string' ||
          data.requestId.length > 100 ||
          (data.repair !== undefined &&
            (typeof data.repair !== 'string' || data.repair.length > 2000))
        ) {
          json(res, 400, { error: 'Invalid inputs' });
          return;
        }
        const tending = url.pathname === '/api/tend';
        let a, b, modelPrompt, modelSchema;
        try {
          if (tending) {
            if (
              typeof data.title !== 'string' ||
              !data.title.trim() ||
              [...data.title].length > 60 ||
              typeof data.concept !== 'string' ||
              !data.concept.trim() ||
              [...data.concept].length > 420 ||
              !DIRECTIONS.includes(data.direction)
            )
              throw new Error('Invalid growth inputs');
            modelPrompt = tendPrompt(data.title, data.concept, data.direction, data.repair);
            modelSchema = growthSchema;
          } else {
            if (!['en', 'ru'].includes(data.language)) throw new Error('Invalid language');
            a = validateScrap(data.a);
            b = validateScrap(data.b);
            if (a === b) throw new Error('Two different ideas are needed');
            modelPrompt = prompt(a, b, data.language, data.repair);
            modelSchema = schemaFor(a, b);
          }
        } catch {
          json(res, 400, { error: 'Invalid inputs' });
          return;
        }
        const tags = await fetch(upstream + '/api/tags', {
          signal: AbortSignal.timeout(4000),
        }).then((r) => r.json());
        const digest = tags.models?.find((m) => m.name === model)?.digest;
        if (!digest) throw new Error(`${model} is not installed.`);
        const controller = new AbortController(),
          timer = setTimeout(() => controller.abort(), 120000);
        res.on('close', () => {
          if (!res.writableEnded) controller.abort();
        });
        try {
          const generated = await observer.run(
            {
              model,
              operation: tending ? 'tend' : 'blend',
              phase: data.repair ? 'repair' : 'primary',
            },
            async (trace) => {
              const generated = await fetch(upstream + '/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model,
                  prompt: modelPrompt,
                  format: modelSchema,
                  stream: false,
                  keep_alive: '60s',
                  options: { num_ctx: 4096, num_predict: 384, temperature: 0.6 },
                }),
                signal: controller.signal,
              }).then((r) => r.json());
              trace.tokens(generated.prompt_eval_count, generated.eval_count);
              if (typeof generated.response !== 'string')
                throw new Error(generated.error ?? 'Ollama returned no model response.');
              trace.validate(() =>
                tending ? parseGrowth(generated.response) : parseOutput(generated.response, a, b),
              );
              return generated;
            },
          );
          // One response per HTTP call. The client journals it before validation
          // and before explicitly requesting at most one repair.
          json(res, 200, {
            raw: generated.response,
            digest,
            upstreamError: generated.error ? String(generated.error) : null,
          });
          return;
        } finally {
          clearTimeout(timer);
        }
      } finally {
        clearTimeout(bodyTimer);
        busy = false;
      }
    } else if (url.pathname.startsWith('/api/')) {
      json(res, 404, { error: 'Unknown API route' });
      return;
    } else {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        json(res, 405, { error: 'Method not allowed' });
        return;
      }
      const file = path.resolve(
        root,
        '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname),
      );
      if (!file.startsWith(root + path.sep)) {
        json(res, 403, { error: 'Invalid path' });
        return;
      }
      let info;
      try {
        info = await stat(file);
      } catch (e) {
        if (['ENOENT', 'ENOTDIR'].includes(e.code)) {
          json(res, 404, { error: 'Not found' });
          return;
        }
        throw e;
      }
      if (!info.isFile()) {
        json(res, 404, { error: 'Not found' });
        return;
      }
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    }
  } catch (error) {
    if (!res.writableEnded)
      json(res, error.name === 'AbortError' ? 504 : 500, {
        error: error.message ?? 'Local inference failed. Your sources are safe.',
      });
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(`Compost Club: ${origin} · local ${model} bridge`),
);
