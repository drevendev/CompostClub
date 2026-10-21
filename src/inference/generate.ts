import { inspectResponse } from '../domain/generation';
import type { Request } from '../domain/garden';

export async function generateWithEvidence(
  request: Request,
  signal: AbortSignal,
  generate: (repair: string) => Promise<string>,
  checkpoint: (raw: string) => Promise<void>,
): Promise<string> {
  let repair = '';
  for (let i = 0; i < 2; i++) {
    if (signal.aborted) throw new Error('Cancelled. Your slot has not been used.');
    const raw = await generate(repair);
    const response = inspectResponse(request, raw, i ? 'repair' : 'primary');
    // Retain every returned response before deciding whether to repair or finish.
    await checkpoint(raw);
    if (signal.aborted) throw new Error('Cancelled. Your slot has not been used.');
    if (response.validationError === null) return raw;
    if (i === 1) throw new Error(response.validationError);
    repair = response.validationError;
  }
  throw new Error('The model could not return a valid sprout.');
}
