import { canonical, hash } from './hash';

export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_MODEL = 'openai/gpt-oss-20b';
// Official Claude Code aliases, verified on 28 October 2026. Each requested
// alias is frozen per job; actual reported model versions remain separate evidence.
export const CLAUDE_MODELS = [
  { id: 'haiku', label: 'Haiku', purpose: 'Быстрые задачи' },
  { id: 'sonnet', label: 'Sonnet', purpose: 'Повседневные задачи' },
  { id: 'opus', label: 'Opus', purpose: 'Сложные задачи' },
] as const;
export function assertClaudeModel(model: string) {
  if (!CLAUDE_MODELS.some((m) => m.id === model))
    throw new Error('Выберите поддерживаемую модель Claude. Автоматической замены модели нет.');
}
export interface ProviderConfig {
  kind: 'local' | 'groq' | 'claude';
  revision: number;
  model?: string;
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
      config.revision < 1 ||
      (config.model !== undefined &&
        (config.kind !== 'claude' || typeof config.model !== 'string')))
  )
    throw new Error('Invalid provider configuration.');
  if (config?.kind === 'claude') {
    assertClaudeModel(config.model ?? 'sonnet');
    return {
      kind: 'claude',
      revision: config.revision,
      endpoint: 'official-claude-code',
      requestedModel: config.model ?? 'sonnet',
      capability: 'claude-code-single-turn-v1',
      contextLimit: 16384,
      seed: false,
      schema: 'cli-json-domain-validated',
    };
  }
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
  const expected = providerSnapshot(
    {
      kind: p.kind,
      revision: p.revision,
      ...(p.kind === 'claude' ? { model: p.requestedModel } : {}),
    },
    p.requestedModel,
  );
  if (canonical(expected) !== canonical(p)) throw new Error('Unsupported provider snapshot.');
}

export const isRemote = (p: { kind: string } | undefined) =>
  p?.kind === 'groq' || p?.kind === 'claude';
