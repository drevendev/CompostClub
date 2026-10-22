// Operator opt-in only. No SDK import, initialization or transport when OFF.
const allowed = new Set([
  'gen_ai.system',
  'gen_ai.request.model',
  'gen_ai.operation.name',
  'gen_ai.usage.input_tokens',
  'gen_ai.usage.output_tokens',
  'compost.phase',
  'compost.result',
  'compost.contract_version',
]);
function attributes(data = {}) {
  return Object.fromEntries(
    Object.entries(data).filter(
      ([k, v]) =>
        allowed.has(k) &&
        (k.startsWith('gen_ai.usage.')
          ? Number.isSafeInteger(v) && v >= 0
          : typeof v === 'string' && /^[a-zA-Z0-9:_.-]{1,40}$/.test(v)),
    ),
  );
}
export function cleanTransaction(event) {
  const cleanSpan = (s) => ({
    trace_id: s.trace_id,
    span_id: s.span_id,
    parent_span_id: s.parent_span_id,
    start_timestamp: s.start_timestamp,
    timestamp: s.timestamp,
    op: ['gen_ai.chat', 'function'].includes(s.op) ? s.op : 'function',
    description: s.op === 'gen_ai.chat' ? 'Local Gemma generation' : 'Validate local response',
    status: s.status,
    data: attributes(s.data),
  });
  return {
    event_id: event.event_id,
    type: 'transaction',
    transaction: 'Compost local generation',
    start_timestamp: event.start_timestamp,
    timestamp: event.timestamp,
    platform: 'node',
    // Explicit anonymized address prevents fallback to the connection IP.
    user: { ip_address: '0.0.0.0' },
    environment: 'local-opt-in',
    contexts: {
      trace: {
        trace_id: event.contexts?.trace?.trace_id,
        span_id: event.contexts?.trace?.span_id,
        op: 'gen_ai.chat',
        status: event.contexts?.trace?.status,
        data: attributes(event.contexts?.trace?.data),
      },
    },
    spans: (event.spans ?? []).map(cleanSpan),
  };
}
const noopTrace = {
  tokens() {},
  validate(fn) {
    try {
      fn();
    } catch {
      /* Client retains and validates originals. */
    }
  },
};
const noop = { enabled: false, run: (_meta, fn) => fn(noopTrace), flush: async () => true };
export async function createObserver({ env = process.env, transport } = {}) {
  if (env.COMPOST_SENTRY_ENABLED !== '1' || !env.SENTRY_DSN) return noop;
  try {
    const url = new URL(env.SENTRY_DSN);
    if (
      url.protocol !== 'https:' ||
      !/^o\d+\.ingest\.(de\.)?sentry\.io$/.test(url.hostname) ||
      !/^[a-f0-9]{32}$/.test(url.username) ||
      url.password ||
      !/^\/\d+$/.test(url.pathname) ||
      url.search ||
      url.hash
    )
      throw new Error('Unsupported DSN');
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: env.SENTRY_DSN,
      defaultIntegrations: false,
      integrations: [],
      sendDefaultPii: false,
      sendClientReports: false,
      enableLogs: false,
      tracesSampleRate: 1,
      traceLifecycle: 'static',
      maxBreadcrumbs: 0,
      environment: 'local-opt-in',
      serverName: undefined,
      beforeSendTransaction: cleanTransaction,
      beforeSend: (e) => ({
        event_id: e.event_id,
        timestamp: e.timestamp,
        platform: 'node',
        user: { ip_address: '0.0.0.0' },
        level: 'error',
        message: 'Compost local generation failed',
        environment: 'local-opt-in',
        contexts: { trace: e.contexts?.trace },
      }),
      transport:
        transport ??
        ((options) =>
          Sentry.createTransport({ ...options, bufferSize: 5 }, async (request) => {
            const response = await fetch(options.url, {
              method: 'POST',
              body: request.body,
              headers: options.headers,
              signal: AbortSignal.timeout(3000),
              redirect: 'error',
            });
            await response.body?.cancel();
            return {
              statusCode: response.status,
              headers: {
                'retry-after': response.headers.get('retry-after'),
                'x-sentry-rate-limits': response.headers.get('x-sentry-rate-limits'),
              },
            };
          })),
    });
    return {
      enabled: true,
      async run(meta, fn) {
        let pending;
        // Keep the business promise independent: instrumentation must neither
        // retry inference nor turn its successful result into a model failure.
        const invoke = (trace) => (pending ??= Promise.resolve().then(() => fn(trace)));
        try {
          return await Sentry.withIsolationScope(() =>
            Sentry.startNewTrace(() =>
              Sentry.startSpan(
                {
                  name: 'Compost local generation',
                  op: 'gen_ai.chat',
                  attributes: {
                    'gen_ai.system': 'ollama',
                    'gen_ai.request.model': meta.model,
                    'gen_ai.operation.name': 'chat',
                    'compost.phase': meta.phase,
                    'compost.contract_version': meta.operation === 'tend' ? 'tend-1' : 'splice-2',
                  },
                },
                async (span) => {
                  const trace = {
                    tokens(input, output) {
                      try {
                        if (Number.isSafeInteger(input) && input >= 0)
                          span.setAttribute('gen_ai.usage.input_tokens', input);
                        if (Number.isSafeInteger(output) && output >= 0)
                          span.setAttribute('gen_ai.usage.output_tokens', output);
                      } catch {}
                    },
                    validate(fn) {
                      // Structural validation only; this never certifies usefulness.
                      let result = 'valid';
                      try {
                        fn();
                      } catch {
                        result = 'invalid';
                      }
                      try {
                        Sentry.startSpan(
                          {
                            name: 'Validate local response',
                            op: 'function',
                            attributes: { 'compost.result': result },
                          },
                          () => {},
                        );
                      } catch {}
                    },
                  };
                  try {
                    const result = await invoke(trace);
                    try {
                      span.setAttribute('compost.result', 'returned');
                    } catch {}
                    return result;
                  } catch (e) {
                    try {
                      span.setStatus({ code: 2 });
                      span.setAttribute('compost.result', 'transport_error');
                      Sentry.captureMessage('Compost local generation failed', 'error');
                    } catch {}
                    throw e;
                  }
                },
              ),
            ),
          );
        } catch {
          return pending ?? invoke(noopTrace);
        }
      },
      flush: () => Sentry.flush(2000).catch(() => false),
    };
  } catch {
    console.warn('Optional Sentry is unavailable; local inference remains enabled.');
    return noop;
  }
}
