import { useEffect, useRef, useState } from 'react';
import {
  beginGrowth,
  decideGrowth,
  DIRECTIONS,
  growthMarkdown,
  parseGrowth,
  proposeGrowth,
  recordGrowth,
  stopGrowth,
  type Direction,
  type Growth,
  type GrowthOutput,
} from '../domain/growth';
import { MAX_BACKUP_BYTES, reconcile, serializeGarden, type Garden } from '../domain/garden';
import { ollamaHealth } from '../inference/provider';
import { Modal } from './Modal';

export function GrowthLab({
  garden,
  initial,
  disabled,
  commit,
  onBusy,
  onClose,
}: {
  garden: Garden;
  initial: string;
  disabled: boolean;
  commit: (fn: (g: Garden) => Garden) => Promise<Garden>;
  onBusy: (busy: boolean) => void;
  onClose: () => void;
}) {
  const [parent, setParent] = useState(`sprout:${initial}`);
  const [direction, setDirection] = useState<Direction>(DIRECTIONS[3]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [unfiled, setUnfiled] = useState<string[]>([]);
  const [edit, setEdit] = useState<GrowthOutput | null>(null);
  const abort = useRef<AbortController | null>(null);
  const running = useRef(false);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) abort.current?.abort();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      abort.current?.abort();
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
  useEffect(() => {
    if (!unfiled.length) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [unfiled.length]);
  const proposed = garden.growth?.find((n) => n.status === 'proposed');
  const choices: Growth['parent'][] = [
    ...garden.sprouts
      .filter((s) => s.kept)
      .map((s) => ({
        kind: 'sprout' as const,
        id: s.id,
        title: (s.edited ?? s.output).title,
        concept: (s.edited ?? s.output).concept,
      })),
    ...(garden.growth ?? [])
      .filter((n) => n.status === 'accepted')
      .map((n) => ({
        kind: 'growth' as const,
        id: n.id,
        title: (n.edited ?? n.output!).title,
        concept: (n.edited ?? n.output!).concept,
      })),
  ];
  function download(name: string, text: string) {
    const a = document.createElement('a'),
      url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function generate() {
    if (running.current || disabled || proposed || unfiled.length) return;
    running.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    const controller = new AbortController();
    abort.current = controller;
    let id = '';
    try {
      if (__OFFLINE__)
        throw new Error(
          'Tending requires the local app and real Gemma. No recorded growth fixtures are supplied.',
        );
      const source = choices.find((p) => `${p.kind}:${p.id}` === parent);
      if (!source) throw new Error('Choose a kept idea.');
      const health = await ollamaHealth();
      if (controller.signal.aborted) throw new Error('Cancelled.');
      const saved = await commit((g) => {
        const next = beginGrowth(
          reconcile(g, Date.now()),
          source,
          direction,
          health.model,
          health.digest,
          Date.now(),
        );
        if (
          new TextEncoder().encode(serializeGarden(next)).byteLength + 192 * 1024 >
          MAX_BACKUP_BYTES
        )
          throw new Error('Back up and free 192 KiB before tending.');
        return next;
      });
      id = saved.growth!.at(-1)!.id;
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetch('./api/tend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Compost-Token': health.token },
          body: JSON.stringify({
            title: source.title,
            concept: source.concept,
            direction,
            requestId: id,
            repair: attempt ? 'Invalid JSON contract' : '',
          }),
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          raw?: string;
          digest?: string;
          error?: string;
          upstreamError?: string;
        };
        if (typeof data.raw !== 'string') throw new Error(data.error ?? 'No model response.');
        const raw = data.raw;
        setUnfiled((old) => [...old, raw]);
        await commit((g) => recordGrowth(g, id, raw));
        setUnfiled([]);
        if (!response.ok || data.upstreamError || data.digest !== health.digest)
          throw new Error(
            'Model identity or upstream response changed. Original response retained.',
          );
        if (controller.signal.aborted) throw new Error('Cancelled.');
        try {
          parseGrowth(raw);
        } catch (e) {
          if (attempt === 0) continue;
          throw e;
        }
        await commit((g) => proposeGrowth(g, id));
        break;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      if (id) {
        try {
          await commit((g) => stopGrowth(g, id, controller.signal.aborted, message));
        } catch {
          setError(message + ' Save failed. Keep this window open and download unsaved evidence.');
        }
      }
    } finally {
      setBusy(false);
      running.current = false;
      onBusy(false);
    }
  }
  async function decide(accept: boolean) {
    if (!proposed || disabled || busy) return;
    try {
      await commit((g) => decideGrowth(g, proposed.id, accept, edit ?? undefined));
      setEdit(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <Modal
      title="Tend an idea"
      className="growth-lab"
      onClose={() => {
        if (!busy && !unfiled.length) onClose();
      }}
    >
      <p>
        Grow one small branch with local Gemma. Your parent stays unchanged. Accepting a proposal
        uses one ready slot; rejection, failure and cancellation keep it.
      </p>
      <label>
        Parent idea
        <select
          aria-label="Growth parent"
          value={parent}
          disabled={busy || !!proposed}
          onChange={(e) => setParent(e.target.value)}
        >
          {choices.map((p) => (
            <option key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Direction
        <select
          aria-label="Growth direction"
          value={direction}
          disabled={busy || !!proposed}
          onChange={(e) => setDirection(e.target.value as Direction)}
        >
          {DIRECTIONS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </label>
      <button
        className="button primary"
        disabled={
          busy ||
          disabled ||
          !!proposed ||
          !choices.length ||
          !!unfiled.length ||
          __OFFLINE__ ||
          garden.kind !== 'personal'
        }
        onClick={() => void generate()}
      >
        Grow one branch
      </button>
      {busy && (
        <button className="button secondary" onClick={() => abort.current?.abort()}>
          Cancel growth
        </button>
      )}
      {proposed?.output && (
        <section aria-label="Growth proposal">
          <h3>{proposed.output.title}</h3>
          <p>{proposed.output.concept}</p>
          <p>Try: {proposed.output.experiment}</p>
          <p>Model proposal · structure checked, usefulness is yours to judge.</p>
          {edit && (
            <>
              <label>
                Branch title
                <input
                  aria-label="Branch title"
                  maxLength={60}
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                />
              </label>
              <label>
                Branch concept
                <textarea
                  aria-label="Branch concept"
                  maxLength={420}
                  value={edit.concept}
                  onChange={(e) => setEdit({ ...edit, concept: e.target.value })}
                />
              </label>
              <label>
                Branch experiment
                <textarea
                  aria-label="Branch experiment"
                  maxLength={300}
                  value={edit.experiment}
                  onChange={(e) => setEdit({ ...edit, experiment: e.target.value })}
                />
              </label>
            </>
          )}
          <button className="button primary" disabled={disabled} onClick={() => void decide(true)}>
            Accept branch
          </button>
          <button
            className="button secondary"
            disabled={disabled}
            onClick={() => setEdit({ ...proposed.output! })}
          >
            Edit before accepting
          </button>
          <button
            className="button secondary"
            disabled={disabled}
            onClick={() => void decide(false)}
          >
            Reject proposal
          </button>
        </section>
      )}
      <h3>Branches and original evidence</h3>
      <p>
        {garden.growth?.length ?? 0} of 100 growth records. Each branch names its parent; choosing
        the same parent again creates an alternative.
      </p>
      {(garden.growth ?? []).map((n) => (
        <details key={n.id}>
          <summary>
            {n.edited?.title ?? n.output?.title ?? n.direction} · {n.status}
          </summary>
          <p>Parent: {n.parent.title}</p>
          <p>{(n.edited ?? n.output)?.concept}</p>
          <p>Try: {(n.edited ?? n.output)?.experiment}</p>
          <p>
            {n.model} · {n.modelRevision} · {n.promptVersion}
          </p>
          {n.responses.map((r, i) => (
            <pre className="recovery-copy-preview" key={i}>
              {r}
            </pre>
          ))}
          {n.error && <p>{n.error}</p>}
        </details>
      ))}
      <button
        className="button secondary"
        onClick={() => download('compost-club-growth.md', growthMarkdown(garden))}
      >
        Export branch outline
      </button>
      {!!unfiled.length && (
        <button
          className="button danger"
          onClick={() =>
            download('compost-club-unsaved-growth.json', JSON.stringify(unfiled, null, 2))
          }
        >
          Download unsaved evidence before closing
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </Modal>
  );
}
