import { useEffect, useState } from 'react';
import { storage } from '../application/storage';
import type { GardenKind } from '../domain/garden';

export function RetainedCopies({
  kind,
  disabled,
  onChanged,
}: {
  kind: GardenKind;
  disabled: boolean;
  onChanged: () => void;
}) {
  const [copies, setCopies] = useState<{ key: string; json: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void storage
      .retainedCopies(kind)
      .then(setCopies)
      .catch((e: Error) => setError(e.message));
  }, [kind]);
  async function remove(key: string, json: string) {
    setSaving(true);
    try {
      await storage.removeRetainedCopy(kind, key, json);
      setCopies(await storage.retainedCopies(kind));
      setSelected(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <section aria-label="Retained recovery copies">
      <h3>Retained recovery copies</h3>
      <p>
        These independent local copies can retain text removed from the active garden. Removing one
        is permanent. Downloaded files, other tabs and other browsers are separate.
      </p>
      {!copies.length && <p>No additional recovery copies in this garden.</p>}
      {copies.map((copy) => (
        <div key={copy.key}>
          <p>
            {copy.key.split(':')[0]} · {new TextEncoder().encode(copy.json).byteLength} bytes
          </p>
          <button
            className="button secondary"
            disabled={disabled || saving}
            onClick={() => setSelected(selected === copy.key ? null : copy.key)}
          >
            Review {copy.key.split(':')[0]} copy
          </button>
          {selected === copy.key && (
            <>
              <pre className="recovery-copy-preview">{copy.json}</pre>
              <button
                className="button danger"
                disabled={disabled || saving}
                onClick={() => void remove(copy.key, copy.json)}
              >
                Permanently remove {copy.key.split(':')[0]} copy
              </button>
            </>
          )}
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
