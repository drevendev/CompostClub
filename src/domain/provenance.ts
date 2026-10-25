import recordings from '../../fixtures/public/recordings.json' with { type: 'json' };
import { PROMPT_VERSION } from '../inference/contract';
import type { Request } from './garden';

export function exactRecording(request: Request, raw: string): boolean {
  return (
    request.backend === 'replay' &&
    request.promptVersion === PROMPT_VERSION &&
    recordings.some(
      (r) =>
        r.a === request.parents[0].text &&
        r.b === request.parents[1].text &&
        r.language === request.language &&
        r.model === request.model &&
        r.revision === request.modelRevision &&
        r.raw === raw,
    )
  );
}

export function provenanceLabel(request: Request, raw: string): string {
  if (exactRecording(request, raw)) return 'Recorded demo — no live AI';
  if (request.imported || request.backend === 'replay')
    return 'Imported — provenance not independently verified';
  return request.backend === 'ollama'
    ? 'Live local Ollama inference'
    : 'Live browser-local inference';
}
