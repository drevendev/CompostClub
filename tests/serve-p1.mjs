import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

// Explicit transport diagnostic server. Never a real model or an evaluation receipt.
let mode = 'invalid',
  calls = 0;
const noBlend = JSON.stringify({
  outcome: 'no_blend',
  title: '',
  concept: 'TEST-ONLY no blend reason.',
  fromA: '',
  fromB: '',
});
const upstream = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url?.startsWith('/control/')) {
    mode = req.url.slice(9);
    calls = 0;
    res.end('{}');
    return;
  }
  if (req.url === '/api/tags') {
    res.end(
      JSON.stringify({
        models: [{ name: 'gemma3:1b', digest: 'test-only-transport-digest-not-model-evidence' }],
      }),
    );
    return;
  }
  for await (const chunk of req) {
    void chunk;
  }
  const index = calls++;
  if (mode === 'transport') {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: 'TEST-ONLY simulated transport failure.' }));
    return;
  }
  if (mode === 'cancel' && index) await new Promise((resolve) => setTimeout(resolve, 5000));
  const response =
    mode === 'oversized'
      ? 'TEST-ONLY oversized response ' + 'x'.repeat(2097152)
      : mode === 'no_blend' || (mode === 'repair_no_blend' && index)
        ? noBlend
        : `TEST-ONLY invalid ${index ? 'repair' : 'primary'} 🌱\r\n`;
  res.end(JSON.stringify({ response }));
});
upstream.listen(4193, '127.0.0.1');
await once(upstream, 'listening');
const bridge = spawn(process.execPath, ['server/index.mjs'], {
  env: {
    ...process.env,
    PORT: '4192',
    OLLAMA_URL: 'http://127.0.0.1:4193',
    COMPOST_MODEL: 'gemma3:1b',
  },
  stdio: 'inherit',
});
function close() {
  bridge.kill();
  upstream.close();
}
process.on('SIGTERM', close);
process.on('SIGINT', close);
bridge.on('exit', () => upstream.close());
