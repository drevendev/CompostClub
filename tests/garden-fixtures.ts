import {
  addScrap,
  availablePairs,
  beginRequest,
  completeRequest,
  createGarden,
  pairKey,
} from '../src/domain/garden';
import recordings from '../fixtures/public/recordings.json' with { type: 'json' };

export function capacityGarden(count: number, status: 'success' | 'failed', now: number) {
  let g = createGarden('personal', now, 'cap');
  for (let i = 0; i < count; i++)
    g = addScrap(g, `Fictional source number ${i}.`, now, { id: i.toString(36).padStart(2, '0') });
  // Synthetic pairing-index data only, never a model response or inference receipt.
  g.attempts = availablePairs(g).map((parents) => ({
    key: pairKey(parents),
    status,
    requestId: 'x',
  }));
  return g;
}

export function recordedPersonal(now: number) {
  const r = recordings[0]!;
  let g = createGarden('personal', now, 'recorded-personal-fixture');
  g = addScrap(g, r.a, now, { id: 'a', origin: 'fixture' });
  g = addScrap(g, r.b, now, { id: 'b', origin: 'fixture' });
  g = beginRequest(g, now, 'replay', r.model, r.revision, r.language as 'en' | 'ru');
  return completeRequest(g, g.pending!.id, r.raw, now);
}
