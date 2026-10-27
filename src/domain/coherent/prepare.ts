import { isRemote } from './provider';
import { bytes, canonical, hash, controls } from './hash';
import type {
  ContextPack,
  Evidence,
  Identity,
  Source,
  SourceRevision,
  Span,
  Workspace,
} from './types';

export const key = (p: Identity) => canonical([p.garden, p.kind, p.id, p.revision]);
export const pairKey = (parents: Identity[]) => canonical(parents.map(key).sort());
export const current = (s: Source) => s.revisions.at(-1)!;
export const identity = (s: Source): Identity => ({
  garden: s.garden,
  kind: 'source',
  id: s.id,
  revision: current(s).revision,
});
export function plain(text: string): { text: string; links: string[] } {
  const links: string[] = [];
  const decode = (v: string) => {
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  return {
    text: text
      .replace(/!?\[([^\]]*)\]\(([^)]+)\)/g, (_m, label: string, url: string) => {
        links.push(decode(url));
        return decode(label);
      })
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/[*_`~]/g, '')
      .trim(),
    links,
  };
}
export function sections(text: string): Span[] {
  const spans: Span[] = [];
  const pattern = /[^\n]+(?:\n(?!\s*\n)[^\n]+)*/g;
  for (const m of text.matchAll(pattern))
    spans.push({ id: 's' + spans.length, start: m.index, end: m.index + m[0].length, text: m[0] });
  return spans;
}
export function safeUrl(value: string): string {
  const u = new URL(value);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password)
    throw new Error('Only HTTP(S) references without credentials can be opened.');
  return u.href;
}
export function revision(
  text: string,
  title: string,
  n: number,
  now: number,
  timezone: string | null,
): SourceRevision {
  if (!text.trim() || bytes(text) > 1024 * 1024 || title.length > 120 || controls(text))
    throw new Error('Use a nonempty source up to 1 MiB and a title up to 120 characters.');
  const spans = sections(text);
  return {
    revision: n,
    title,
    text,
    hash: hash(text),
    entry: { at: now, timezone, offset: timezone ? new Date(now).getTimezoneOffset() : null },
    spans,
    links: plain(text).links,
    preparation: {
      revision: 1,
      selected: spans.map((s) => s.id),
      essential: spans.map((s) => s.id),
      missingMechanism: false,
      facets: [],
      aliases: [],
      references: [],
    },
  };
}
export function fingerprint(w: Workspace, k: string): string {
  const [kind, id, revision] = JSON.parse(k) as [string, string, number?];
  const item =
    kind === 'source'
      ? w.sources.find((s) => s.id === id)
      : kind === 'garden'
        ? w.gardens.find((g) => g.id === id)
        : kind === 'reference'
          ? w.references.find((r) => r.id === id)
          : kind === 'preference'
            ? w.preferences.find((p) => p.id === id)
            : w.nodes.find((n) => n.id === id);
  if (!item) return '';
  if (kind === 'garden') {
    const g = item as Workspace['gardens'][number];
    return hash(
      canonical({
        profile: g.profile,
        profileRevision: g.profileRevision,
        objective: g.objective,
        policy: g.policy,
      }),
    );
  }
  if (kind === 'node') {
    const n = item as Workspace['nodes'][number],
      r = n.revisions.find((r) => r.revision === revision);
    return r
      ? hash(
          canonical({
            content: r.content,
            hash: r.hash,
            accepted: n.decisions.filter((d) => d.revision === revision).at(-1)?.state === 'kept',
            references: n.references,
          }),
        )
      : '';
  }
  if (kind === 'node-current' || kind === 'revision-body') {
    const node = item as Workspace['nodes'][number],
      r =
        kind === 'node-current'
          ? node.revisions.at(-1)
          : node.revisions.find((r) => r.revision === revision);
    return r ? hash(canonical({ revision: r.revision, content: r.content, hash: r.hash })) : '';
  }
  return hash(canonical(item));
}
export function prepare(
  w: Workspace,
  gardenId: string,
  parents: Identity[],
  extra: string = '',
): ContextPack {
  const garden = w.gardens.find((g) => g.id === gardenId);
  if (!garden) throw new Error('Garden unavailable.');
  const evidence: Evidence[] = [],
    omissions: ContextPack['omissions'] = [],
    fingerprints: ContextPack['fingerprints'] = [];
  const addFingerprint = (kind: string, id: string) => {
    const k = canonical([kind, id]);
    fingerprints.push({ key: k, hash: fingerprint(w, k) });
  };
  addFingerprint('garden', gardenId);
  for (const p of parents) {
    if (p.kind !== 'source') {
      const n = w.nodes.find((n) => n.id === p.id && n.garden === p.garden),
        r = n?.revisions.find((r) => r.revision === p.revision);
      if (!n || n.decisions.filter((d) => d.revision === p.revision).at(-1)?.state !== 'kept' || !r)
        throw new Error('Growth requires an accepted exact parent revision.');
      const nodeKey = canonical(['node', p.id, p.revision]);
      fingerprints.push({ key: nodeKey, hash: fingerprint(w, nodeKey) });
      evidence.push({
        id: 'e' + evidence.length,
        parent: p,
        originalSpan: null,
        text: canonical(r.content),
        status: r.origin,
      });
      for (const previous of r.references ?? n.references) {
        const ref = w.references.find((r) => r.id === previous.id && !r.removed);
        if (!ref) {
          if (previous.essential)
            throw new Error('needs_context: essential parent reference unavailable.');
          evidence.push({
            id: 'e' + evidence.length,
            parent: null,
            originalSpan: null,
            text: previous.name,
            status: 'Historical reference unavailable; no property verified for this job',
          });
          continue;
        }
        addFingerprint('reference', ref.id);
        evidence.push({
          id: 'e' + evidence.length,
          parent: null,
          originalSpan: null,
          text: canonical({
            reference: ref.id,
            name: ref.name,
            property: ref.property,
            differ: ref.differ,
          }),
          status: ref.status,
        });
      }
      continue;
    }
    const s = w.sources.find((s) => s.id === p.id && s.garden === p.garden),
      r = s?.revisions.find((r) => r.revision === p.revision);
    if (!s || !r || current(s).revision !== p.revision)
      throw new Error('Source revision unavailable or stale.');
    addFingerprint('source', s.id);
    if (p.garden !== gardenId) addFingerprint('garden', p.garden);
    if (
      r.preparation.missingMechanism ||
      r.preparation.aliases.some((a) => a.essential && !a.approved)
    )
      throw new Error('needs_context: clarify the missing mechanism or essential term.');
    for (const id of r.preparation.selected) {
      const span = r.spans.find((s) => s.id === id);
      if (!span) throw new Error('Selected original span unavailable.');
      const normalized = plain(span.text);
      evidence.push({
        id: 'e' + evidence.length,
        parent: p,
        originalSpan: span.id,
        text: normalized.text,
        status: 'Source assertion; not externally verified',
      });
    }
    const omitted = r.spans.filter((s) => !r.preparation.selected.includes(s.id)).map((s) => s.id);
    if (r.preparation.essential.some((id) => omitted.includes(id)))
      throw new Error('needs_context: an essential section is omitted.');
    if (omitted.length)
      omissions.push({ parent: p, spans: omitted, reason: 'Explicit preparation selection' });
    for (const f of r.preparation.facets.filter((f) => f.approved && f.value !== null))
      evidence.push({
        id: 'e' + evidence.length,
        parent: p,
        originalSpan: f.spans[0] ?? null,
        text: f.field + ': ' + f.value,
        status: f.origin + '; approved',
      });
    for (const a of r.preparation.aliases.filter((a) => a.approved))
      evidence.push({
        id: 'e' + evidence.length,
        parent: p,
        originalSpan: a.span,
        text: a.original + ' means ' + a.meaning,
        status: 'Approved alias; scoped to exact source, not external verification',
      });
    for (const id of r.preparation.references) {
      const ref = w.references.find((r) => r.id === id && !r.removed && r.garden === p.garden);
      if (!ref) throw new Error('needs_context: selected reference removed or unavailable.');
      addFingerprint('reference', id);
      if (ref.status === 'uninspected link') {
        if (ref.essential)
          throw new Error('needs_context: essential reference has not been inspected.');
        evidence.push({
          id: 'e' + evidence.length,
          parent: null,
          originalSpan: null,
          text: ref.name,
          status: 'Optional uninspected reference omitted; no facts supplied',
        });
        continue;
      }
      evidence.push({
        id: 'e' + evidence.length,
        parent: null,
        originalSpan: null,
        text: canonical({
          reference: ref.id,
          name: ref.name,
          property: ref.property,
          differ: ref.differ,
        }),
        status: ref.status,
      });
    }
  }
  for (const pref of w.preferences.filter(
    (p) => p.approved && p.enabled && (p.garden === null || p.garden === gardenId),
  )) {
    addFingerprint('preference', pref.id);
    evidence.push({
      id: 'e' + evidence.length,
      parent: null,
      originalSpan: null,
      text: canonical({
        preference: pref.id,
        revision: pref.revision,
        scope: pref.garden,
        text: pref.text,
      }),
      status: 'Approved creative preference; not a fact',
    });
  }
  // The manifest admits complete spans only. One UTF-8 byte per token is a
  // conservative upper bound for the installed byte-fallback Gemma tokenizer.
  // No exact tokenizer is installed or downloaded by this code.
  const payload = canonical({
    receiverGarden: gardenId,
    target: garden.profile,
    objective: garden.objective,
    request: extra,
    evidence,
  });
  const inputUpperBound = bytes(payload);
  if (inputUpperBound + 900 + 512 > (isRemote(w.provider) ? 7000 : 4096))
    throw new Error(
      'admission: Не удалось подготовить запрос в пределах модели. Выберите меньше необязательных полных разделов; оригиналы сохранены.',
    );
  return {
    version: 'context-1',
    hash: hash(payload),
    payload,
    evidence,
    omissions,
    fingerprints,
    counting: 'utf8-byte-upper-bound',
    inputUpperBound,
    contextLimit: isRemote(w.provider) ? 7000 : 4096,
    outputReserve: 900,
    framingReserve: 512,
  };
}
export function validPack(w: Workspace, pack: ContextPack): boolean {
  return (
    hash(pack.payload) === pack.hash &&
    pack.fingerprints.every((f) => fingerprint(w, f.key) === f.hash) &&
    w.preferences
      .filter(
        (p) =>
          p.approved &&
          p.enabled &&
          (p.garden === null ||
            p.garden === (JSON.parse(pack.payload) as { receiverGarden: string }).receiverGarden),
      )
      .every((p) => pack.fingerprints.some((f) => f.key === canonical(['preference', p.id])))
  );
}
