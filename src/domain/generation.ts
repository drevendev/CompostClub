import { parseOutput } from '../inference/contract';
import type { Request } from './garden';

export const MAX_GENERATIONS = 100;
// Two short model responses plus their snapshots and a possible successful sprout.
export const GENERATION_HEADROOM = 192 * 1024;
export interface ModelResponse {
  phase: 'primary' | 'repair';
  raw: string;
  validationError: string | null;
}
export interface Generation extends Request {
  status: 'pending' | 'success' | 'failed' | 'no_blend' | 'cancelled' | 'transport_error';
  createdAt: number;
  responses: ModelResponse[];
  error: string | null;
}
export function inspectResponse(
  request: Request,
  raw: string,
  phase: ModelResponse['phase'],
): ModelResponse {
  try {
    parseOutput(raw, request.parents[0].text, request.parents[1].text);
    return { phase, raw, validationError: null };
  } catch (e) {
    return { phase, raw, validationError: e instanceof Error ? e.message : String(e) };
  }
}
