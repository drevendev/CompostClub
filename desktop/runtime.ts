import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { RuntimeSettings } from '../src/domain/experiment';
import { safeDirectory } from './export';

const run = promisify(execFile);
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export class OwnedOllama {
  private child: ChildProcess | undefined;
  private url = '';
  private starting: Promise<{ model: string; digest: string }> | undefined;
  digest = '';
  model = '';
  private stderr = '';
  private epoch = 0;
  private releasing: Promise<void> | undefined;
  get running(): boolean {
    return !!this.child && this.child.exitCode === null;
  }
  get pid(): number | undefined {
    return this.child?.pid;
  }
  async start(settings: RuntimeSettings): Promise<{ model: string; digest: string }> {
    if (this.starting) return this.starting;
    if (this.running && this.model === settings.model)
      return { model: this.model, digest: this.digest };
    const task = this.launch(settings);
    this.starting = task;
    try {
      return await task;
    } finally {
      this.starting = undefined;
    }
  }
  private async launch(settings: RuntimeSettings): Promise<{ model: string; digest: string }> {
    const epoch = ++this.epoch;
    if (
      !path.isAbsolute(settings.executable) ||
      path.extname(settings.executable).toLowerCase() !== '.exe'
    )
      throw new Error('Choose your installed ollama.exe. No model or runtime is downloaded.');
    const info = await lstat(settings.executable);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      (await realpath(settings.executable)).toLowerCase() !==
        path.resolve(settings.executable).toLowerCase()
    )
      throw new Error('Ollama executable must be a regular local file.');
    await safeDirectory(settings.models);
    const port = await new Promise<number>((resolve, reject) => {
      const server = createServer();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string')
          return reject(new Error('No local model port available.'));
        const port = address.port;
        server.close((e) => (e ? reject(e) : resolve(port)));
      });
    });
    if (epoch !== this.epoch) throw new Error('Model startup cancelled.');
    this.stderr = '';
    this.url = `http://127.0.0.1:${port}`;
    const child = spawn(settings.executable, ['serve'], {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
      env: {
        ...process.env,
        OLLAMA_HOST: `127.0.0.1:${port}`,
        OLLAMA_MODELS: settings.models,
        OLLAMA_NO_CLOUD: '1',
        OLLAMA_KEEP_ALIVE: '0',
        OLLAMA_NUM_PARALLEL: '1',
        OLLAMA_MAX_LOADED_MODELS: '1',
      },
    });
    this.child = child;
    this.model = settings.model;
    child.on('error', (e) => {
      this.stderr = e.message;
    });
    child.stderr?.on('data', (buffer: Buffer) => {
      this.stderr = (this.stderr + buffer.toString()).slice(-8000);
    });
    for (let i = 0; i < 100; i++) {
      if (epoch !== this.epoch) throw new Error('Model startup cancelled.');
      if (child.exitCode !== null || !child.pid)
        throw new Error('Owned Ollama could not start. ' + this.stderr);
      try {
        const response = await fetch(this.url + '/api/tags', { signal: AbortSignal.timeout(1000) });
        if (response.ok) {
          const data = (await response.json()) as { models: { name: string; digest: string }[] };
          const model = data.models.find((m) => m.name === settings.model);
          if (!model?.digest)
            throw new Error(
              `Install ${settings.model} explicitly in the selected model directory first.`,
            );
          this.digest = model.digest;
          return { model: this.model, digest: this.digest };
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('Install ')) throw e;
      }
      await delay(200);
    }
    throw new Error('Owned Ollama did not become ready. ' + this.stderr);
  }
  async generate(
    prompt: string,
    format: unknown,
    seed: number,
    signal: AbortSignal,
    onTransport: (raw: string) => void,
    beforeDispatch: () => void,
  ): Promise<string> {
    if (!this.running) throw new Error('Local model is not connected.');
    const tagsResponse = await fetch(this.url + '/api/tags', {
      signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]),
    });
    const tags = (await tagsResponse.json()) as { models: { name: string; digest: string }[] };
    if (!tagsResponse.ok || tags.models.find((m) => m.name === this.model)?.digest !== this.digest)
      throw new Error(
        'Installed model changed. Reconnect before generating; no inference was sent.',
      );
    if (signal.aborted) throw new Error('Cancelled before inference dispatch.');
    beforeDispatch();
    const response = await fetch(this.url + '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        format,
        stream: false,
        keep_alive: 0,
        options: { num_ctx: 4096, num_predict: 384, temperature: 0.6, seed },
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]),
    });
    if (!response.body) throw new Error('No model response body.');
    const reader = response.body.getReader(),
      chunks: Buffer[] = [];
    let size = 0;
    let complete = false;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) {
          complete = true;
          break;
        }
        const b = Buffer.from(part.value);
        chunks.push(b);
        size += b.length;
        if (size > 2 * 1024 * 1024) {
          await reader.cancel();
          throw new Error(
            'Model response exceeded 2 MiB; received bytes retained as incomplete transport evidence.',
          );
        }
      }
    } finally {
      onTransport(
        JSON.stringify({
          format: 'ollama-transport-bytes',
          encoding: 'base64',
          complete,
          bytes: Buffer.concat(chunks).toString('base64'),
        }),
      );
    }
    const body = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    let data: { response?: string; error?: string };
    try {
      data = JSON.parse(body) as typeof data;
    } catch {
      throw new Error('Local model returned malformed transport JSON; original bytes retained.');
    }
    if (!response.ok || typeof data.response !== 'string')
      throw new Error(
        data.error ?? `Local model HTTP ${response.status}; original response retained.`,
      );
    return data.response;
  }
  async release(): Promise<void> {
    if (this.releasing) return this.releasing;
    const task = this.releaseOwned();
    this.releasing = task;
    try {
      await task;
    } finally {
      this.releasing = undefined;
    }
  }
  private async releaseOwned(): Promise<void> {
    ++this.epoch;
    const child = this.child;
    if (!child) return;
    let unloadError: unknown;
    if (this.running && this.model)
      try {
        await fetch(this.url + '/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: this.model, keep_alive: 0, stream: false }),
          signal: AbortSignal.timeout(4000),
        });
        const response = await fetch(this.url + '/api/ps', { signal: AbortSignal.timeout(3000) });
        const data = (await response.json()) as { models: unknown[] };
        if (!response.ok || data.models.length) throw new Error('Model is still resident.');
      } catch (e) {
        unloadError = e;
      }
    // This exact process was spawned by this instance on a fresh private port.
    // Kill only its owned tree, never a system-wide image or shared Ollama service.
    if (child.pid && child.exitCode === null) {
      if (process.platform === 'win32')
        await run('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }).catch(
          (e: unknown) => {
            if (child.exitCode === null) throw e;
          },
        );
      else child.kill('SIGTERM');
      for (let i = 0; i < 50 && child.exitCode === null; i++) await delay(100);
      if (child.exitCode === null)
        throw new Error(
          'Owned model process has not stopped. ' +
            (unloadError instanceof Error ? unloadError.message : ''),
        );
    }
    this.child = undefined;
    this.digest = '';
    this.model = '';
    this.url = '';
  }
}
