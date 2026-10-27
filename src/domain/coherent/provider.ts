import { canonical, hash } from './hash';

export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_MODEL = 'openai/gpt-oss-20b';
export interface ProviderConfig {
  kind: 'local' | 'groq' | 'claude';
  revision: number;
}
export interface ProviderSnapshot {
  kind: 'local' | 'groq' | 'claude';
  revision: number;
  endpoint: string;
  requestedModel: string;
  capability: 'ollama-gemma-4096-v1' | 'groq-json-object-v1' | 'claude-code-single-turn-v1';
  contextLimit: number;
  seed: boolean;
  schema: 'ollama-grammar' | 'json-object-domain-validated' | 'cli-json-domain-validated';
}
export function providerSnapshot(
  config: ProviderConfig | undefined,
  localModel: string,
): ProviderSnapshot {
  if (
    config &&
    (!['local', 'groq', 'claude'].includes(config.kind) ||
      !Number.isSafeInteger(config.revision) ||
      config.revision < 1)
  )
    throw new Error('Invalid provider configuration.');
  if (config?.kind === 'claude')
    return {
      kind: 'claude',
      revision: config.revision,
      endpoint: 'official-claude-code',
      requestedModel: 'sonnet',
      capability: 'claude-code-single-turn-v1',
      contextLimit: 16384,
      seed: false,
      schema: 'cli-json-domain-validated',
    };
  return config?.kind === 'groq'
    ? {
        kind: 'groq',
        revision: config.revision,
        endpoint: GROQ_ENDPOINT,
        requestedModel: GROQ_MODEL,
        capability: 'groq-json-object-v1',
        contextLimit: 16384,
        seed: false,
        schema: 'json-object-domain-validated',
      }
    : {
        kind: 'local',
        revision: config?.revision ?? 1,
        endpoint: 'owned-loopback',
        requestedModel: localModel,
        capability: 'ollama-gemma-4096-v1',
        contextLimit: 4096,
        seed: true,
        schema: 'ollama-grammar',
      };
}
export const providerHash = (p: ProviderSnapshot) => hash(canonical(p));
export function validProvider(p: ProviderSnapshot) {
  const expected = providerSnapshot({ kind: p.kind, revision: p.revision }, p.requestedModel);
  if (canonical(expected) !== canonical(p)) throw new Error('Unsupported provider snapshot.');
}

export const isRemote = (p: { kind: string } | undefined) =>
  p?.kind === 'groq' || p?.kind === 'claude';
