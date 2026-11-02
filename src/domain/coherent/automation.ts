import { canonical, hash } from './hash';
import { providerSnapshot } from './provider';
import type { Workspace } from './types';

export const executionMode = (w: Workspace) => w.settings.executionMode ?? 'automatic';

// A session grant covers current/future participating text in explicitly selected
// gardens, including their approved donors. It never authorizes another provider,
// a newly included garden or changed sharing policy. Content snapshots stay per job.
export function automationScope(w: Workspace): string {
  return hash(
    canonical({
      provider: providerSnapshot(w.provider, w.runtime.model),
      gardens: w.gardens
        .filter((g) => g.background)
        .map((g) => ({
          id: g.id,
          interval: g.interval,
          policy: g.policy,
          donors: w.gardens
            .filter((d) => g.policy.donors.includes(d.id))
            .map((d) => ({ id: d.id, donate: d.policy.donate })),
        })),
      limits: w.settings,
    }),
  );
}
