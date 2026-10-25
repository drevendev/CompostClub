import { useEffect, useRef, useState } from 'react';
import { importGarden, MAX_BACKUP_BYTES, type Garden, type GardenKind } from '../domain/garden';
import { storage } from '../application/storage';
import { Icon } from './Icons';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
export function Recovery({
  kind,
  reason,
  locked,
  onOpen,
  onRestored,
  download,
}: {
  kind: GardenKind;
  reason: string;
  locked: boolean;
  onOpen: (kind: GardenKind) => Promise<void>;
  onRestored: (garden: Garden) => void;
  download: (name: string, content: string, type: string) => void;
}) {
  const [original, setOriginal] = useState<string | null>(null),
    [backup, setBackup] = useState<Garden | null>(null),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  const readEpoch = useRef(0);
  useEffect(() => {
    let cancelled = false;
    void storage.recoveryJSON(kind).then(
      (raw) => {
        if (!cancelled) setOriginal(raw);
      },
      (e: unknown) => {
        if (!cancelled) setError(message(e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [kind]);
  async function read(file: File | undefined) {
    const epoch = ++readEpoch.current;
    setBackup(null);
    setError('');
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw new Error('Choose a JSON backup no larger than 2 MiB.');
      const content = await file.text();
      if (epoch !== readEpoch.current) return;
      const candidate = importGarden(content);
      if (candidate.kind !== kind)
        throw new Error(`Choose a ${kind} garden backup. Your other garden is separate.`);
      setBackup(candidate);
    } catch (e) {
      if (epoch === readEpoch.current) setError(message(e));
    }
  }
  async function restore() {
    if (!backup || original === null || locked || saving) return;
    setSaving(true);
    setError('');
    try {
      onRestored(await storage.restoreFromRecovery(backup, original));
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="recovery">
      <Icon name="sprout" size={40} />
      <p className="eyebrow">COMPOST CLUB · {kind === 'sample' ? 'SAMPLE' : 'PERSONAL'} GARDEN</p>
      <h1>Your garden needs a little care.</h1>
      <p>The saved record could not be opened. It has not been overwritten or deleted.</p>
      <details>
        <summary>Why it could not open</summary>
        <p>{reason}</p>
      </details>
      <div className="backup-actions">
        <button
          className="button secondary"
          disabled={original === null || saving}
          onClick={() =>
            original !== null &&
            download(`compost-club-${kind}-recovery.json`, original, 'application/json')
          }
        >
          <Icon name="download" />
          Download original record
        </button>
        <label className="button secondary file-label">
          <Icon name="upload" />
          Choose a backup to restore
          <input
            aria-label="Recovery JSON backup"
            type="file"
            accept=".json,application/json"
            disabled={locked || saving || original === null}
            onChange={(e) => {
              void read(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <p className="small-print">
        The original download is a raw recovery record. It may exceed backup limits or need repair
        before import. A restore accepts a valid matching garden backup up to 2 MiB.
      </p>
      {locked && (
        <p role="status">
          Another tab is tending this garden. Close it and reload before restoring.
        </p>
      )}
      {backup && (
        <section className="recovery-preview" aria-labelledby="restore-heading">
          <h2 id="restore-heading">Replace this saved garden?</h2>
          <p>
            This backup has{' '}
            <strong>
              {backup.scraps.length} {backup.scraps.length === 1 ? 'scrap' : 'scraps'}
            </strong>
            ,{' '}
            <strong>
              {backup.sprouts.length} {backup.sprouts.length === 1 ? 'sprout' : 'sprouts'}
            </strong>{' '}
            and {backup.readySlots} ready slots.
          </p>
          <p>
            Confirming replaces only your {kind} garden. The current record will be kept on this
            device as the most recent recovery copy, available from Backup and export. A later
            recovery replaces that copy; download it if you need to keep it.
          </p>
          <div className="backup-actions">
            <button
              className="button primary"
              disabled={locked || saving || original === null}
              onClick={() => void restore()}
            >
              Replace saved garden with this backup
            </button>
            <button className="button secondary" disabled={saving} onClick={() => setBackup(null)}>
              Cancel restore
            </button>
          </div>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="recovery-navigation">
        <button className="button secondary" disabled={saving} onClick={() => location.reload()}>
          Reload recovery
        </button>
        <button
          className="button secondary"
          disabled={saving}
          onClick={() => void onOpen(kind === 'personal' ? 'sample' : 'personal')}
        >
          Open {kind === 'personal' ? 'sample' : 'personal'} garden
        </button>
      </div>
    </main>
  );
}
