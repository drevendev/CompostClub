import type { CredentialStore } from './credentials';
import { GROQ_ENDPOINT, GROQ_MODEL } from '../src/domain/coherent/provider';
import { bytes } from '../src/domain/coherent/hash';

export interface RemoteObservation {
  reportedModel: string | null;
  requestId: string | null;
  promptTokens: number | null;
  outputTokens: number | null;
  finishReason: string | null;
  httpStatus: number;
  retryAfter: string | null;
}
const missing: CredentialStore = {
  available: () => false,
  has: () => false,
  get: () => Promise.reject(new Error('Сначала сохраните ключ Groq в настройках.')),
  set: () => Promise.reject(new Error('Secure credential store unavailable.')),
  remove: () => Promise.resolve(),
  retainSensitive: () => Promise.reject(new Error('Secure recovery unavailable.')),
};
export class GroqRuntime {
  private sensitiveEmergency: string[] = [];
  get emergencyPending() {
    return this.sensitiveEmergency.length > 0;
  }
  async saveSensitiveEmergency() {
    for (const raw of [...this.sensitiveEmergency]) {
      await this.credentials.retainSensitive(raw);
      this.sensitiveEmergency.shift();
    }
  }
  constructor(
    readonly credentials: CredentialStore = missing,
    private request: typeof fetch = fetch,
  ) {}
  async start() {
    await this.credentials.get();
    return { model: GROQ_MODEL, digest: '' };
  }
  async release() {
    /* HTTP cancellation is owned by the controller signal; server outcome remains unknown. */
  }
  async generate(
    prompt: string,
    format: unknown,
    _seed: number,
    signal: AbortSignal,
    onTransport: (raw: string) => void,
    beforeDispatch: () => void,
    limits = { tokens: 2048, timeout: 180000 },
    onObservation?: (o: RemoteObservation) => void,
  ): Promise<string> {
    const key = await this.credentials.get();
    if (signal.aborted) throw new Error('Cancelled before remote dispatch.');
    const content =
      prompt +
      '\nReturn one JSON object matching this contract. No tools, no external research.\nJSON schema: ' +
      JSON.stringify(format);
    if (bytes(content) + limits.tokens + 512 > 16384)
      throw new Error('admission: Remote request exceeds the declared context allowance.');
    beforeDispatch();
    let response: Response;
    try {
      response = await this.request(GROQ_ENDPOINT, {
        method: 'POST',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: 'user', content }],
          response_format: { type: 'json_object' },
          max_completion_tokens: limits.tokens,
          reasoning_effort: 'low',
          stream: false,
        }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(limits.timeout)]),
      });
    } catch {
      throw new Error(
        'Удалённый исход неизвестен: ожидание отменено или соединение потеряно. Вызов учтён; автоматического повтора нет.',
      );
    }
    const chunks: Uint8Array[] = [];
    let size = 0,
      complete = false;
    const reader = response.body?.getReader();
    let readError: unknown;
    try {
      if (!reader) throw new Error('Remote response has no body.');
      while (true) {
        const part = await reader.read();
        if (part.done) {
          complete = true;
          break;
        }
        chunks.push(part.value);
        size += part.value.length;
        if (size > 2 * 1024 * 1024) {
          await reader.cancel();
          throw new Error('Remote response exceeds 2 MiB; received bytes retained.');
        }
      }
    } catch (error) {
      readError = error;
    }
    const body = Buffer.concat(chunks).toString('utf8');
    // Credentials are never part of ordinary transport evidence, even if reflected by a failed server.
    if (body.includes(key)) {
      this.sensitiveEmergency.push(body);
      await this.saveSensitiveEmergency();
      onTransport(
        JSON.stringify({
          format: 'groq-transport',
          complete: false,
          httpStatus: response.status,
          credentialReflection: true,
          protectedOriginal: true,
        }),
      );
      throw new Error(
        'Сервер отразил секрет в ответе. Ответ изолирован от обычной истории; удалите и замените ключ.',
      );
    }
    onTransport(
      JSON.stringify({
        format: 'groq-transport',
        complete,
        httpStatus: response.status,
        bytes: Buffer.concat(chunks).toString('base64'),
      }),
    );
    if (readError)
      throw new Error('Remote response interrupted; received bytes retained.', {
        cause: readError,
      });
    const decodedBody = new TextDecoder('utf8', { fatal: true }).decode(Buffer.concat(chunks));
    let data: {
      model?: string;
      id?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      choices?: { finish_reason?: string; message?: { content?: string; refusal?: string } }[];
    };
    try {
      data = JSON.parse(decodedBody) as typeof data;
    } catch {
      throw new Error('Remote transport JSON malformed; original body retained.');
    }
    const choice = data.choices?.[0],
      count = (v: unknown) => (Number.isSafeInteger(v) && Number(v) >= 0 ? Number(v) : null);
    onObservation?.({
      reportedModel: typeof data.model === 'string' ? data.model : null,
      requestId: typeof data.id === 'string' ? data.id : null,
      promptTokens: count(data.usage?.prompt_tokens),
      outputTokens: count(data.usage?.completion_tokens),
      finishReason: choice?.finish_reason ?? null,
      httpStatus: response.status,
      retryAfter: response.headers.get('retry-after')?.slice(0, 100) ?? null,
    });
    if (!response.ok)
      throw new Error(
        response.status === 401 || response.status === 403
          ? 'Groq: ключ недействителен или доступ запрещён.'
          : response.status === 429
            ? 'Groq: лимит запросов или квота исчерпаны. Повтор только вручную; см. сохранённый ответ.'
            : `Groq HTTP ${response.status}; original body retained. No automatic retry.`,
      );
    if (choice?.message?.refusal || choice?.finish_reason === 'content_filter')
      throw new Error('Groq отказал в ответе; исходный отказ сохранён.');
    if (choice?.finish_reason !== 'stop')
      throw new Error('Groq: незавершённый или обрезанный ответ; исходный ответ сохранён.');
    if (typeof choice.message?.content !== 'string')
      throw new Error('Groq: отсутствует текст ответа.');
    return choice.message.content;
  }
}
