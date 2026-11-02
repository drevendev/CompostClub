export interface Trace {
  tokens(input: number | null | undefined, output: number | null | undefined): void;
  httpStatus(status: number): void;
  reportedModel(model: string | null): void;
  outcome(result: 'returned' | 'invalid' | 'cancelled' | 'transport_error'): void;
  validate(fn: () => unknown): void;
}
export interface TraceMeta {
  model: string;
  operation: string;
  phase: string;
  system?: 'ollama' | 'anthropic' | 'groq';
  type?: 'inference' | 'control' | 'validation';
  contract?: string;
}
export interface Observer {
  enabled: boolean;
  run<T>(meta: TraceMeta, fn: (trace: Trace) => Promise<T>): Promise<T>;
  flush(): Promise<boolean>;
}
export const noopTrace: Trace;
export const noop: Observer;
export function createObserver(options?: {
  env?: NodeJS.ProcessEnv;
  onDelivery?: (status: number) => void;
}): Promise<Observer>;
export function cleanTransaction(event: Record<string, unknown>): Record<string, unknown>;
