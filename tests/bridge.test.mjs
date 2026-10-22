import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createObserver, cleanTransaction } from '../server/observability.mjs';

test('real HTTP bridge: early reservation, split UTF-8, URL containment, 404s and disabled telemetry', async () => {
  let captured = '',
    calls = 0;
  const upstream = http.createServer(async (req, res) => {
    if (req.url === '/api/tags') {
      res.end(JSON.stringify({ models: [{ name: 'gemma3:4b', digest: 'test-digest' }] }));
      return;
    }
    let body = '';
    for await (const b of req) body += b;
    captured = JSON.parse(body).prompt;
    calls++;
    await delay(75);
    res.end(
      JSON.stringify({
        response: 'TEST ONLY invalid original 🌱',
        prompt_eval_count: 5,
        eval_count: 3,
      }),
    );
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const probe = http.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server/index.mjs'], {
    env: {
      ...process.env,
      PORT: String(port),
      OLLAMA_URL: `http://127.0.0.1:${upstream.address().port}`,
      COMPOST_MODEL: 'gemma3:4b',
      COMPOST_SENTRY_ENABLED: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    let health;
    for (let i = 0; i < 100; i++) {
      try {
        health = await fetch(origin + '/api/health').then((r) => r.json());
        break;
      } catch {
        await delay(50);
      }
    }
    assert.ok(health?.token, JSON.stringify(health));
    const headers = { 'content-type': 'application/json', origin, 'x-compost-token': health.token };
    const body = Buffer.from(
      JSON.stringify({
        a: 'Русская библиотека собирает потерянные слова 🌱.',
        b: 'A fictional clockwork gardener grows tiny clouds.',
        language: 'ru',
        requestId: 'test',
      }),
    );
    const offset = body.indexOf(Buffer.from('Русская')) + 1;
    const first = http.request(origin + '/api/ferment', { method: 'POST', headers }, (res) => {
      res.resume();
    });
    const done = once(first, 'close');
    first.write(body.subarray(0, offset));
    await delay(50);
    const blocked = await fetch(origin + '/api/ferment', { method: 'POST', headers, body });
    assert.equal(blocked.status, 429);
    first.end(body.subarray(offset));
    await done;
    assert.equal(calls, 1);
    assert.ok(captured.includes('Русская библиотека'));
    assert.ok(captured.includes('🌱'));
    assert.equal((await fetch(origin + '/%ZZ')).status, 400);
    assert.equal((await fetch(origin + '/does-not-exist.js')).status, 404);
    assert.equal((await fetch(origin + '/does-not-exist.js', { method: 'HEAD' })).status, 404);
    assert.equal((await fetch(origin + '/api/health')).status, 200);
    assert.equal(
      (
        await fetch(origin + '/api/ferment', {
          method: 'POST',
          headers: { ...headers, 'x-compost-token': 'é'.repeat(health.token.length) },
          body,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(origin + '/api/tend', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: 'x',
            concept: 'y',
            direction: 'execute code',
            requestId: 'test',
          }),
        })
      ).status,
      400,
    );
    const invalid = await fetch(origin + '/api/ferment', {
      method: 'POST',
      headers,
      body: Buffer.from([0xff, 0xfe]),
    });
    assert.equal(invalid.status, 400);
    assert.equal((await fetch(origin + '/api/health')).status, 200);
  } finally {
    child.kill();
    await once(child, 'exit');
    upstream.closeAllConnections();
    await new Promise((r) => upstream.close(r));
  }
});

test('Sentry OFF never loads a client; opt-in actual envelopes exclude private data and survive rejection', async () => {
  const off = await createObserver({ env: { COMPOST_SENTRY_ENABLED: '0', SENTRY_DSN: 'ignored' } });
  assert.equal(off.enabled, false);
  assert.equal(await off.run({}, async () => 7), 7);
  const envelopes = [];
  const observer = await createObserver({
    env: {
      COMPOST_SENTRY_ENABLED: '1',
      SENTRY_DSN: 'https://11111111111111111111111111111111@o1.ingest.de.sentry.io/123',
    },
    transport: () => ({
      send: async (e) => {
        envelopes.push(e);
        return { statusCode: 200 };
      },
      flush: async () => true,
    }),
  });
  assert.equal(observer.enabled, true);
  await observer.run(
    { model: 'gemma3:4b', operation: 'blend', phase: 'primary' },
    async (trace) => {
      trace.tokens(12, 5);
      trace.validate(() => JSON.parse('not json PRIVATE_SENTINEL'));
      return 'PRIVATE_SENTINEL';
    },
  );
  await assert.rejects(
    observer.run({ model: 'gemma3:4b', operation: 'tend', phase: 'primary' }, async () => {
      throw new Error('PRIVATE_SENTINEL');
    }),
  );
  await observer.flush();
  const Sentry = await import('@sentry/node');
  let calls = 0;
  const sdkFailure = await observer.run(
    { model: 'gemma3:4b', operation: 'blend', phase: 'primary' },
    async () => {
      calls++;
      const span = Sentry.getActiveSpan();
      span.setAttribute = () => {
        throw new Error('TEST ONLY broken instrumentation');
      };
      return 'successful local result';
    },
  );
  assert.equal(sdkFailure, 'successful local result');
  assert.equal(calls, 1);
  const payload = JSON.stringify(envelopes);
  assert.ok(envelopes.length);
  const roots = envelopes
    .flatMap((e) => e[1])
    .filter((item) => item[0].type === 'transaction')
    .map((item) => item[1].contexts.trace.trace_id);
  assert.equal(
    new Set(roots).size,
    roots.length,
    'Independent calls must have different trace IDs',
  );
  assert.ok(payload.includes('gen_ai.usage.input_tokens'));
  assert.ok(payload.includes('Validate local response'));
  assert.ok(!payload.includes('PRIVATE_SENTINEL'));
  assert.ok(!payload.includes('server_name'));
  for (const e of envelopes)
    for (const [, item] of e[1]) if (item.user) assert.equal(item.user.ip_address, '0.0.0.0');
});

test('transaction allowlist discards automatic machine/request/user data', () => {
  const clean = JSON.stringify(
    cleanTransaction({
      user: { ip_address: 'SECRET' },
      request: { url: 'SECRET' },
      server_name: 'SECRET',
      contexts: { trace: { trace_id: 'a', span_id: 'b', data: { prompt: 'SECRET' } } },
      spans: [
        { data: { 'gen_ai.request.model': 'gemma3:4b', prompt: 'SECRET' }, description: 'SECRET' },
      ],
    }),
  );
  assert.ok(!clean.includes('SECRET'));
  assert.ok(clean.includes('gemma3:4b'));
});
