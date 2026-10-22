import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addScrap,
  availablePairs,
  beginRequest,
  completeRequest,
  deletionSet,
  editScrap,
  exportMarkdown,
  exportSproutCard,
  failRequest,
  importGarden,
  INTERVAL,
  MAX_BACKUP_BYTES,
  MAX_SCRAPS,
  MAX_ATTEMPTS,
  reconcile,
  recordResponse,
  retryablePairs,
  pairKey,
  recompost,
  removeScrap,
  serializeGarden,
  sourceRevisions,
  type Backend,
  type Garden,
  type GardenKind,
  type Sprout,
} from './domain/garden';
import { storage } from './application/storage';
import {
  browserAI,
  findReplay,
  MODELS,
  ollamaGenerate,
  ollamaHealth,
  replay,
} from './inference/provider';
import type { Language } from './inference/contract';
import type { ModelKey } from './inference/models';
import fixtures from '../fixtures/public/scraps.json';
import { GardenScene } from './ui/GardenScene';
import { Icon } from './ui/Icons';
import { Modal } from './ui/Modal';
import { Recovery } from './ui/Recovery';
import { InferenceHistory } from './ui/InferenceHistory';
import { GrowthLab } from './ui/GrowthLab';
import { RetainedCopies } from './ui/RetainedCopies';
import { SourceHistory } from './ui/SourceHistory';
import type { Generation } from './domain/generation';
import './styles.css';
import licenceTexts from '../public/THIRD_PARTY_LICENSES.txt?raw';

type Dialog =
  | 'about'
  | 'engine'
  | 'backup'
  | 'edit'
  | 'delete'
  | 'import'
  | 'history'
  | 'source-history'
  | 'discard-evidence'
  | 'growth'
  | 'share'
  | null;
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function App() {
  const initialKind: GardenKind = location.hash === '#sample' ? 'sample' : 'personal';
  const [garden, setGarden] = useState<Garden | null>(null),
    ref = useRef<Garden | null>(null);
  const [kind, setKind] = useState<GardenKind>(initialKind),
    [tab, setTab] = useState<'garden' | 'collection'>('garden');
  const [collectionView, setCollectionView] = useState<'kept' | 'all'>('kept');
  const [dialog, setDialog] = useState<Dialog>(null),
    [text, setText] = useState(''),
    [editText, setEditText] = useState(''),
    [editId, setEditId] = useState(''),
    [sproutEdit, setSproutEdit] = useState(false),
    [editTitle, setEditTitle] = useState('');
  const [error, setError] = useState(''),
    [startupError, setStartupError] = useState(''),
    [notice, setNotice] = useState(''),
    [storageWarning, setStorageWarning] = useState('');
  const [retryKey, setRetryKey] = useState('');
  const [retryPage, setRetryPage] = useState(0);
  const [pilePage, setPilePage] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const focusComposer = () => {
    setComposerOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const [readingScrap, setReadingScrap] = useState<string | null>(null);
  const [collectionPage, setCollectionPage] = useState(0);
  const [backend, setBackend] = useState<Backend>('ollama'),
    [modelKey, setModelKey] = useState<ModelKey>('1b'),
    [language, setLanguage] = useState<Language>('en');
  const [engineBusy, setEngineBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [progressLabel, setProgressLabel] = useState(''),
    [loaded, setLoaded] = useState(false);
  const [local, setLocal] = useState<{
    token: string;
    model: string;
    digest: string;
    monitoring?: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    busyRef = useRef(false),
    [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now()),
    [locked, setLocked] = useState(false),
    [lockEpoch, setLockEpoch] = useState(0);
  const [pendingImport, setPendingImport] = useState<Garden | null>(null),
    [welcome, setWelcome] = useState(true);
  const [growthParent, setGrowthParent] = useState('');
  const [shareSprout, setShareSprout] = useState<Sprout | null>(null);
  const [shareEvidence, setShareEvidence] = useState(false);
  const [hasRecoveryCopy, setHasRecoveryCopy] = useState(false);
  const [hasRestoreCopy, setHasRestoreCopy] = useState(false);
  const [inferenceRecovery, setInferenceRecovery] = useState<Generation | null>(null);
  const [importRevision, setImportRevision] = useState(0);
  const controller = useRef<AbortController | null>(null),
    serial = useRef(false),
    inputRef = useRef<HTMLTextAreaElement>(null);
  const setCurrent = useCallback((g: Garden) => {
    ref.current = g;
    setGarden(g);
  }, []);
  const pairs = useMemo(() => (garden ? availablePairs(garden) : []), [garden]);
  const availableCount = useMemo(
    () =>
      garden?.kind === 'sample'
        ? pairs.filter(
            ([a, b]) =>
              findReplay(a.text, b.text, language) || findReplay(b.text, a.text, language),
          ).length
        : pairs.length,
    [pairs, garden?.kind, language],
  );
  const retries = useMemo(() => (garden ? retryablePairs(garden) : []), [garden]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await storage.open();
        if (cancelled) return;
        setStorageWarning(storage.warning);
        const g = await storage.load(initialKind);
        if (cancelled) return;
        setCurrent(g);
        setWelcome(g.scraps.length === 0);
      } catch (e) {
        if (!cancelled) setStartupError(errorText(e));
      }
    })();
    return () => {
      cancelled = true;
      controller.current?.abort();
      browserAI.cancel();
    };
  }, [setCurrent]);
  useEffect(() => {
    let cancelled = false;
    void storage
      .inferenceRecovery(kind)
      .then((run) => {
        if (!cancelled) setInferenceRecovery(run ?? null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorText(e));
      });
    return () => {
      cancelled = true;
    };
  }, [kind, garden?.id]);
  useEffect(() => {
    if (!navigator.locks) {
      setStorageWarning(
        (s) =>
          s ||
          'This browser cannot coordinate tabs. Keep only one garden tab open; conflicting saves will be rejected.',
      );
      return;
    }
    let released = false,
      release = () => {};
    setLocked(true);
    void navigator.locks.request(
      `compost-club-writer-${kind}`,
      { ifAvailable: true },
      async (lock) => {
        if (!lock || released) return;
        setLocked(false);
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    );
    return () => {
      released = true;
      release();
    };
  }, [kind, lockEpoch]);
  useEffect(() => {
    if (dialog !== 'backup') return;
    let cancelled = false;
    setHasRecoveryCopy(false);
    setHasRestoreCopy(false);
    void storage.beforeRestoreJSON(kind).then(
      () => {
        if (!cancelled) setHasRestoreCopy(true);
      },
      () => {
        if (!cancelled) setHasRestoreCopy(false);
      },
    );
    void storage.recoveryJSON(kind, true).then(
      () => {
        if (!cancelled) setHasRecoveryCopy(true);
      },
      () => {
        if (!cancelled) setHasRecoveryCopy(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [dialog, kind]);
  const commit = useCallback(
    async (fn: (g: Garden) => Garden, restoreRevision?: number): Promise<Garden> => {
      if (serial.current)
        throw new Error('Your previous change is still saving. Please try again.');
      const current = ref.current;
      if (!current) throw new Error('The garden is still opening.');
      serial.current = true;
      setSaving(true);
      try {
        const next = fn(current);
        const saved =
          restoreRevision === undefined
            ? await storage.save(next, current.revision)
            : await storage.restore(next, restoreRevision);
        setCurrent(saved);
        return saved;
      } finally {
        serial.current = false;
        setSaving(false);
      }
    },
    [setCurrent],
  );
  useEffect(() => {
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (locked || serial.current || !ref.current || busyRef.current) return;
      const current = ref.current,
        next = reconcile(current, time);
      if (next.readySlots !== current.readySlots || next.lastAccrualAt !== current.lastAccrualAt)
        void commit(() => next).catch((e) => setError(errorText(e)));
    }, 1000);
    const visibility = () => {
      if (document.hidden) controller.current?.abort();
      else setNow(Date.now());
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [commit, locked]);
  const action = useCallback(async (fn: () => Promise<void> | void) => {
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  const switchGarden = useCallback(
    async (next: GardenKind) => {
      if (busyRef.current || saving) return;
      await action(async () => {
        let saved: Garden;
        try {
          saved = await storage.load(next);
        } catch (e) {
          ref.current = null;
          setGarden(null);
          setKind(next);
          setStartupError(errorText(e));
          location.hash = next === 'sample' ? 'sample' : 'garden';
          return;
        }
        let g = saved;
        if (next === 'sample' && g.scraps.length === 0) {
          for (const s of fixtures.scraps)
            g = addScrap(g, s.text, Date.now(), { id: s.id, origin: 'fixture' });
          g = await storage.save(g, saved.revision);
        }
        setCurrent(g);
        setStartupError('');
        setKind(next);
        location.hash = next === 'sample' ? 'sample' : 'garden';
        setTab('garden');
        setWelcome(false);
        setPilePage(0);
        setCollectionPage(0);
        setComposerOpen(next === 'personal');
        setNotice('');
        setError('');
        setRetryKey('');
        setRetryPage(0);
        setDialog(null);
      });
    },
    [action, saving, setCurrent],
  );
  useEffect(() => {
    const navigate = () => {
      const next =
        location.hash === '#sample'
          ? 'sample'
          : ['#garden', ''].includes(location.hash)
            ? 'personal'
            : null;
      if (!next || next === kind) return;
      if (busyRef.current || saving) {
        history.replaceState(null, '', kind === 'sample' ? '#sample' : '#garden');
        setError('Finish or cancel the current operation before switching gardens.');
        return;
      }
      void switchGarden(next);
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, [kind, saving, switchGarden]);
  async function submit() {
    await action(async () => {
      await commit((g) => addScrap(g, text, Date.now()));
      setPilePage(Math.floor(((ref.current?.scraps.length ?? 1) - 1) / 2));
      setText('');
      setWelcome(false);
      setNotice('A little thought, safely in the pile.');
      inputRef.current?.focus();
    });
  }
  async function grow(retry?: string) {
    if (busyRef.current || locked || saving || document.hidden) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    const abort = new AbortController();
    controller.current = abort;
    let requestId = '';
    try {
      const current = ref.current;
      if (!current) return;
      if (inferenceRecovery || (await storage.inferenceRecovery(current.kind)))
        throw new Error(
          'An inference recovery copy needs attention. Open Backup and export before growing again.',
        );
      const mode = current.kind === 'sample' ? 'replay' : backend;
      if (__OFFLINE__ && mode !== 'replay')
        throw new Error(
          'The offline HTML uses recorded sample pairings. Open the hosted or local app for live AI.',
        );
      let model = '',
        revision = '';
      let preferred: ReturnType<typeof availablePairs>[number] | undefined =
        retry !== undefined
          ? retryablePairs(current).find((pair) => pairKey(pair) === retry)
          : undefined;
      if (retry !== undefined && !preferred)
        throw new Error('The selected sources have changed or this pairing has already grown.');
      if (mode === 'replay') {
        const pairs = preferred ? [preferred] : availablePairs(current);
        for (const p of pairs) {
          const r = findReplay(p[0].text, p[1].text, language);
          const reverse = findReplay(p[1].text, p[0].text, language);
          if (r) {
            preferred = p;
            model = r.model;
            revision = r.revision;
            break;
          }
          if (reverse) {
            preferred = [p[1], p[0]];
            model = reverse.model;
            revision = reverse.revision;
            break;
          }
        }
        if (!preferred || !model || !revision)
          throw new Error(
            'No unused recording matches these exact scraps and this language. Your own scraps need live local AI. Try another language or start your own pile.',
          );
      } else if (mode === 'browser') {
        if (!loaded || browserAI.loaded !== modelKey) {
          setDialog('engine');
          throw new Error('First choose and load a local model with your consent.');
        }
        model = MODELS[modelKey].id;
        revision = MODELS[modelKey].revision;
      } else {
        if (!local) {
          setDialog('engine');
          throw new Error('Connect local Ollama before growing your own ideas.');
        }
        model = local.model;
        revision = local.digest;
      }
      const active = await commit((g) =>
        beginRequest(g, Date.now(), mode, model, revision, language, preferred),
      );
      const request = active.pending;
      if (!request) throw new Error('Could not start the pairing.');
      requestId = request.id;
      const checkpoint = async (raw: string) => {
        const current = ref.current;
        if (!current) throw new Error('The garden closed before saving the response.');
        const next = recordResponse(current, request.id, raw);
        try {
          await commit(() => next);
        } catch (e) {
          const run = next.generations!.find((r) => r.id === request.id)!;
          const recovery: Generation = { ...run, status: 'failed', error: errorText(e) };
          setInferenceRecovery(recovery);
          try {
            await storage.retainInference(current.kind, recovery);
          } catch {
            throw new Error(
              'Evidence could not be saved. Download the inference recovery copy from Backup and export before closing this page.',
            );
          }
          throw new Error(
            'The response is retained in a separate inference recovery copy. Open Backup and export. ' +
              errorText(e),
            { cause: e },
          );
        }
      };
      const raw =
        mode === 'replay'
          ? replay(request)
          : mode === 'browser'
            ? await browserAI.generate(request, abort.signal, checkpoint)
            : await ollamaGenerate(request, local?.token ?? '', abort.signal, checkpoint);
      if (mode === 'replay') await checkpoint(raw);
      if (abort.signal.aborted) throw new Error('Cancelled. Your pairing slot is still here.');
      await commit((g) => completeRequest(g, request.id, raw, Date.now()));
      setNotice(
        mode === 'replay'
          ? 'A recorded Gemma idea has sprouted.'
          : 'A new idea has sprouted. See what you think.',
      );
    } catch (e) {
      if (requestId)
        try {
          await commit((g) => failRequest(g, requestId, errorText(e), abort.signal.aborted));
        } catch (saveError) {
          setError(errorText(saveError));
        }
      setError(errorText(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
      controller.current = null;
      if (!browserAI.loaded) setLoaded(false);
    }
  }
  async function connect() {
    setEngineBusy(true);
    setError('');
    try {
      const h = await ollamaHealth();
      setLocal(h);
      setBackend('ollama');
      setNotice(`Local ${h.model} connected. Your ideas stay on this device.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setEngineBusy(false);
    }
  }
  async function loadModel() {
    setEngineBusy(true);
    setLoaded(false);
    setError('');
    setProgress(0);
    setProgressLabel('Checking your GPU…');
    try {
      await browserAI.load(modelKey, (p, l) => {
        setProgress(p);
        setProgressLabel(l);
      });
      setLoaded(true);
      setBackend('browser');
      setNotice('Model loaded locally. Generation is experimental; every result is validated.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setEngineBusy(false);
    }
  }
  function showEdit(id: string, isSprout = false) {
    const g = ref.current;
    if (!g) return;
    setEditId(id);
    setSproutEdit(isSprout);
    if (isSprout) {
      const s = g.sprouts.find((s) => s.id === id);
      setEditText(s?.edited?.concept ?? s?.output.concept ?? '');
      setEditTitle(s?.edited?.title ?? s?.output.title ?? '');
    } else setEditText(g.scraps.find((s) => s.id === id)?.raw ?? '');
    setDialog('edit');
  }
  async function saveEdit() {
    await action(async () => {
      if (sproutEdit) {
        if (
          !editTitle.trim() ||
          [...editTitle].length > 60 ||
          !editText.trim() ||
          [...editText].length > 420
        )
          throw new Error('Use a title of 1–60 characters and a concept of 1–420 characters.');
        await commit((g) => ({
          ...g,
          sprouts: g.sprouts.map((s) =>
            s.id === editId ? { ...s, edited: { title: editTitle, concept: editText } } : s,
          ),
        }));
      } else await commit((g) => editScrap(g, editId, editText));
      setEditText('');
      setDialog(null);
      setNotice('Your edit is saved. Original model text stays in the provenance.');
    });
  }
  async function readBackup(file: File | undefined) {
    if (!file) return;
    await action(async () => {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Backups must be no larger than 2 MiB.');
      setPendingImport(importGarden(await file.text()));
      setImportRevision(ref.current?.revision ?? 0);
      setDialog('import');
    });
  }
  function exportSprout(s: Sprout) {
    setShareSprout(s);
    setShareEvidence(false);
    setDialog('share');
  }
  async function fullscreen() {
    await action(async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    });
  }
  if (!garden)
    if (startupError)
      return (
        <Recovery
          key={kind}
          kind={kind}
          reason={startupError}
          locked={locked}
          onOpen={switchGarden}
          download={download}
          onRestored={(restored) => {
            setCurrent(restored);
            setStartupError('');
            setError('');
            setWelcome(false);
            setNotice(
              'Garden restored. The previous record is available as a recovery copy in Backup and export.',
            );
          }}
        />
      );
    else
      return (
        <main className="loading">
          <Icon name="sprout" size={40} />
          <h1>Opening your little garden…</h1>
          {error && <p role="alert">{error}</p>}
        </main>
      );
  const shown = reconcile(garden, now),
    elapsed = Math.max(0, now + garden.demoOffset - shown.lastAccrualAt),
    remaining = Math.max(0, INTERVAL - elapsed);
  const kept = garden.sprouts.filter((s) => s.kept).length,
    collection =
      tab === 'collection'
        ? garden.sprouts.filter((s) => collectionView === 'all' || s.kept)
        : garden.sprouts.slice(-1);
  const retryPageIndex = Math.min(retryPage, Math.max(0, Math.ceil(retries.length / 50) - 1));
  const pilePageIndex = Math.min(pilePage, Math.max(0, Math.ceil(garden.scraps.length / 2) - 1));
  const collectionPageIndex = Math.min(
    collectionPage,
    Math.max(0, Math.ceil(collection.length / 3) - 1),
  );
  const reading = garden.scraps.find((scrap) => scrap.id === readingScrap);
  const retryChoices = retries.slice(retryPageIndex * 50, (retryPageIndex + 1) * 50);
  const retrySelection = retryChoices.find((pair) => pairKey(pair) === retryKey) ?? retryChoices[0];
  const fullPairHistory = garden.attempts.length >= MAX_ATTEMPTS;
  const affected = deletionSet(garden, editId);
  return (
    <div className="app-shell">
      <a
        className="skip"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById('main-content');
          main?.focus({ preventScroll: true });
          main?.scrollIntoView({ block: 'start' });
        }}
      >
        Skip to garden
      </a>
      <header className="header">
        <button className="brand" onClick={() => setTab('garden')} aria-label="Compost Club garden">
          <span className="brand-icon">
            <Icon name="sprout" size={27} />
          </span>
          compost club<span className="version">v0.1</span>
        </button>
        <nav aria-label="Main navigation">
          <button className={tab === 'garden' ? 'active' : ''} onClick={() => setTab('garden')}>
            <Icon name="leaf" size={17} />
            My garden
          </button>
          <button
            className={tab === 'collection' ? 'active' : ''}
            onClick={() => {
              setCollectionView('kept');
              setCollectionPage(0);
              setTab('collection');
            }}
          >
            <Icon name="book" size={17} />
            Collection <span className="nav-count">{kept}</span>
          </button>
        </nav>
        <button className="about-button" onClick={() => setDialog('about')}>
          How it works <Icon name="info" size={17} />
        </button>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section className="intro">
          <div>
            <p className="eyebrow">
              <span /> A QUIETER KIND OF CREATIVITY
            </p>
            <h1>
              {tab === 'garden' ? (
                <>
                  Let your wild ideas
                  <br />
                  <em>ferment.</em>
                  <span className="heading-flower">✳</span>
                </>
              ) : (
                <>
                  Good ideas,
                  <br />
                  <em>kept growing.</em>
                </>
              )}
            </h1>
            <p className="intro-copy">
              {tab === 'garden'
                ? 'A home for your half-baked thoughts. Toss them in, let them rest, and discover what grows together.'
                : 'Your small collection of happy accidents. Take a thought with you, or give it another life in the pile.'}
            </p>
          </div>
          <div className="intro-aside">
            <span className="tiny-flower">✳</span>
            <p>
              No rush.
              <br />
              No perfect ideas.
              <br />
              <em>Just a little possibility.</em>
            </p>
          </div>
        </section>
        {welcome && (
          <section className="welcome">
            <div>
              <strong>Too weird to build? Too good to delete?</strong>
              <span> Your first pairing is ready as soon as you add two ideas.</span>
            </div>
            <div>
              <button
                className="button primary"
                onClick={() => {
                  setWelcome(false);
                  focusComposer();
                }}
              >
                Start your pile <Icon name="arrow" size={17} />
              </button>
              <button className="button subtle" onClick={() => void switchGarden('sample')}>
                Try the sample garden
              </button>
            </div>
          </section>
        )}
        <div className="toolbar">
          <div className="garden-switch" aria-label="Garden mode">
            <button
              aria-pressed={kind === 'personal'}
              onClick={() => void switchGarden('personal')}
              disabled={busy || saving}
            >
              <Icon name="leaf" size={15} />
              Your garden
            </button>
            <button
              aria-pressed={kind === 'sample'}
              onClick={() => void switchGarden('sample')}
              disabled={busy || saving}
            >
              Sample garden <span className="small-tag">recorded</span>
            </button>
          </div>
          <div className="toolbar-right">
            <span className="save-status">
              <span className={storage.persistent ? 'status-dot' : 'status-dot warning-dot'} />
              {saving
                ? 'Saving…'
                : storage.persistent
                  ? 'Saved on this device'
                  : 'Session in memory'}
            </span>
            <button
              className="icon-button"
              aria-label="Backup and export"
              onClick={() => setDialog('backup')}
            >
              <Icon name="download" size={18} />
            </button>
            <button
              className="icon-button fullscreen"
              aria-label="Toggle fullscreen"
              onClick={() => void fullscreen()}
            >
              <Icon name="expand" size={17} />
            </button>
          </div>
        </div>
        {kind === 'sample' && (
          <div className="replay-banner">
            <Icon name="sun" size={18} />
            <span>
              <strong>Sample garden</strong> · recorded Gemma outputs · no live generation. Real
              ideas, replayed from public-safe test scraps.
            </span>
          </div>
        )}
        {storageWarning && (
          <div className="message info" role="status">
            {storageWarning}
          </div>
        )}
        {locked && (
          <div className="message info">
            Another tab is tending this garden. This tab is read-only.{' '}
            <button
              className="text-button"
              onClick={() => {
                setLockEpoch((v) => v + 1);
                void action(async () => setCurrent(await storage.load(kind)));
              }}
            >
              Check again
            </button>
          </div>
        )}
        {error && (
          <div className="message error" role="alert">
            <Icon name="info" />
            <span>{error}</span>
            <button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}>
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            <Icon name="check" size={16} />
            {notice}
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setNotice('')}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        )}
        {tab === 'garden' && retrySelection && (
          <section className="retry-panel" aria-label="Unfinished pairings">
            <h2>Try an unfinished pairing</h2>
            <p>An unsuccessful blend keeps its slot. Retry only when you choose.</p>
            {retries.length > 1 && (
              <label className="field-label">
                Pairing to retry
                <select
                  aria-label="Pairing to retry"
                  value={pairKey(retrySelection)}
                  onChange={(e) => setRetryKey(e.target.value)}
                >
                  {retryChoices.map((pair, index) => (
                    <option key={pairKey(pair)} value={pairKey(pair)}>
                      {retryPageIndex * 50 + index + 1}. {pair[0].text.slice(0, 60)} +{' '}
                      {pair[1].text.slice(0, 60)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {retries.length > 50 && (
              <div className="retry-pagination">
                <span>
                  Pairings {retryPageIndex * 50 + 1}–
                  {Math.min((retryPageIndex + 1) * 50, retries.length)} of {retries.length}
                </span>
                <button
                  className="text-button"
                  disabled={retryPageIndex === 0 || busy || saving}
                  onClick={() => setRetryPage(retryPageIndex - 1)}
                >
                  Previous retry choices
                </button>
                <button
                  className="text-button"
                  disabled={(retryPageIndex + 1) * 50 >= retries.length || busy || saving}
                  onClick={() => setRetryPage(retryPageIndex + 1)}
                >
                  Next retry choices
                </button>
              </div>
            )}
            <details className="retry-sources">
              <summary>View retry sources</summary>
              <p>
                A · revision {retrySelection[0].revision}: {retrySelection[0].text}
              </p>
              <p>
                B · revision {retrySelection[1].revision}: {retrySelection[1].text}
              </p>
            </details>
            <button
              className="button secondary"
              disabled={busy || saving || locked || shown.readySlots === 0 || !!inferenceRecovery}
              onClick={() => void grow(pairKey(retrySelection))}
            >
              Retry this pairing
            </button>
          </section>
        )}
        {tab === 'garden' ? (
          <div className="garden-layout">
            <section className="pile-panel panel">
              <div className="section-title">
                <h2>The idea pile</h2>
                <span className="count-badge">{garden.scraps.length}</span>
              </div>
              <p className="section-subtitle">Old, odd, unfinished. All welcome here.</p>
              <details
                className="scrap-composer"
                open={composerOpen}
                onToggle={(e) => setComposerOpen(e.currentTarget.open)}
              >
                <summary>
                  <Icon name="plus" size={16} /> Add a scrap
                </summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                >
                  <label className="sr-only" htmlFor="new-scrap">
                    Your idea scrap
                  </label>
                  <div className="paper-input">
                    <textarea
                      id="new-scrap"
                      ref={inputRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="A half-baked game, a strange tool, something you heard…"
                      rows={4}
                      disabled={locked || saving || dialog === 'edit'}
                    />
                    <div className="input-meta">
                      <span>Just a thought is enough.</span>
                      <span>{[...text].length}/800</span>
                    </div>
                  </div>
                  <button
                    className="button primary add-button"
                    disabled={locked || saving || busy || dialog === 'edit' || !text.trim()}
                    type="submit"
                  >
                    <Icon name="plus" size={18} />
                    Toss it in
                  </button>
                </form>
              </details>
              <div className="scrap-list">
                {garden.scraps.length === 0 ? (
                  <div className="empty-pile">
                    <span>↳</span>
                    <p>
                      Every good garden
                      <br />
                      starts with a little scrap.
                    </p>
                  </div>
                ) : (
                  garden.scraps
                    .slice(pilePageIndex * 2, pilePageIndex * 2 + 2)
                    .map((scrap, offset) => {
                      const index = pilePageIndex * 2 + offset;
                      return (
                        <article className={`scrap paper-${index % 3}`} key={scrap.id}>
                          <div className="scrap-top">
                            <span className="scrap-number">
                              SCRAP {String(index + 1).padStart(2, '0')}
                              {scrap.origin === 'sprout' && ' · returned'}
                            </span>
                            <button
                              className="read-scrap"
                              aria-label={`Read scrap ${index + 1}`}
                              onClick={() => setReadingScrap(scrap.id)}
                            >
                              Read ↗
                            </button>
                          </div>
                          <p>{scrap.text}</p>
                          <div className="scrap-actions">
                            <button
                              aria-label={`Edit scrap ${index + 1}`}
                              onClick={() => showEdit(scrap.id)}
                              disabled={locked || busy}
                            >
                              <Icon name="edit" size={14} />
                              Edit
                            </button>
                            <button
                              aria-label={`View history of scrap ${index + 1}`}
                              onClick={() => {
                                setEditId(scrap.id);
                                setDialog('source-history');
                              }}
                            >
                              <Icon name="clock" size={14} /> History
                            </button>
                            <button
                              aria-label={`Remove scrap ${index + 1}`}
                              onClick={() => {
                                setEditId(scrap.id);
                                setDialog('delete');
                              }}
                              disabled={locked || busy}
                            >
                              <Icon name="trash" size={14} />
                            </button>
                          </div>
                        </article>
                      );
                    })
                )}
              </div>
              <PageNavigation
                label="Idea pile"
                page={pilePageIndex}
                count={garden.scraps.length}
                size={2}
                onChange={setPilePage}
              />
              <p className="pile-footnote">
                <Icon name="lock" size={13} />
                Your originals always stay yours.
              </p>
            </section>
            <section className="patch-panel">
              <div className="patch-title">
                <span className="eyebrow">YOUR LITTLE PATCH</span>
                <span className="season">
                  <Icon name="sun" size={14} />a good day to do less
                </span>
              </div>
              <GardenScene
                growing={busy}
                count={garden.sprouts.length}
                ready={availableCount && !fullPairHistory ? shown.readySlots : 0}
              />
              <div className="worm-note">
                <span>“</span>
                {busy
                  ? 'A little mixing, a little magic…'
                  : garden.scraps.length < 2
                    ? 'Got an idea? I like the weird ones.'
                    : !availableCount
                      ? 'A fresh ingredient can start something new.'
                      : shown.readySlots
                        ? 'Something good is ready to happen.'
                        : 'Nothing needs your attention. Let it ferment.'}
                <small>— Wiggle, resident optimist</small>
              </div>
              <div className="ferment-card">
                <div className="ferment-header">
                  <span className="ferment-icon">
                    <Icon name={busy ? 'cycle' : 'clock'} size={22} />
                  </span>
                  <div>
                    <h3>
                      {busy
                        ? 'Growing a new idea…'
                        : fullPairHistory
                          ? 'Pairing history is full'
                          : garden.scraps.length >= 2 && !availableCount
                            ? retries.length
                              ? 'An unfinished pairing awaits'
                              : kind === 'sample'
                                ? 'No unused recording matches'
                                : 'Your pile needs a new ingredient'
                            : shown.readySlots
                              ? `${shown.readySlots} slot${shown.readySlots === 1 ? ' is' : 's are'} ready`
                              : 'Let time do its thing'}
                    </h3>
                    <p>
                      {garden.scraps.length < 2
                        ? 'Add two different scraps to begin.'
                        : busy
                          ? kind === 'sample'
                            ? 'Opening a recorded result.'
                            : 'Your model is mixing two thoughts locally.'
                          : fullPairHistory
                            ? `${shown.readySlots} ready slot${shown.readySlots === 1 ? ' remains' : 's remain'}. Export your garden, then review a source and its dependent history for removal. Existing unfinished pairs can still be retried.`
                            : !availableCount
                              ? `${shown.readySlots} ready slot${shown.readySlots === 1 ? '' : 's'} ${shown.readySlots === 1 ? 'stays' : 'stay'} yours. ${retries.length ? `Use Retry this pairing above, or ${garden.scraps.length >= MAX_SCRAPS ? 'edit a source' : 'add another scrap'}.` : kind === 'sample' ? 'Try another language or use local AI for your own scraps.' : 'Add or edit a scrap, or return a sprout to the pile.'}`
                              : shown.readySlots === 3
                                ? 'Your pile is rested. Three slots is a full harvest.'
                                : `Next slot in ${Math.floor(remaining / 60000)}:${String(Math.floor(remaining / 1000) % 60).padStart(2, '0')}`}
                    </p>
                  </div>
                  <div className="slots" aria-label={`${shown.readySlots} of 3 slots ready`}>
                    {[0, 1, 2].map((i) => (
                      <span className={i < shown.readySlots ? 'filled' : ''} key={i} />
                    ))}
                  </div>
                </div>
                <p className="pairing-count">
                  {availableCount} unused {kind === 'sample' ? 'recorded ' : ''}combination
                  {availableCount === 1 ? '' : 's'} · {retries.length} unfinished pairing
                  {retries.length === 1 ? '' : 's'}
                </p>
                <div className="progress-track">
                  <span
                    style={{
                      width: `${shown.readySlots === 3 ? 100 : Math.min(100, (elapsed / INTERVAL) * 100)}%`,
                    }}
                  />
                </div>
                <button
                  className="button primary grow-button"
                  disabled={
                    locked ||
                    saving ||
                    busy ||
                    shown.readySlots === 0 ||
                    !availableCount ||
                    fullPairHistory
                  }
                  onClick={() => void grow()}
                >
                  <Icon name="sprout" size={19} />
                  {busy
                    ? 'Growing…'
                    : kind === 'sample'
                      ? 'Discover a recorded sprout'
                      : 'Let it ferment'}
                  <Icon name="arrow" size={18} />
                </button>
                {garden.scraps.length >= 2 && (!availableCount || fullPairHistory) && !busy && (
                  <button
                    className="button secondary ingredient-button"
                    disabled={locked || saving}
                    onClick={() => {
                      if (fullPairHistory) {
                        setEditId(garden.scraps[0]!.id);
                        setDialog('delete');
                      } else if (kind === 'sample' && !retries.length)
                        void switchGarden('personal');
                      else if (garden.scraps.length >= MAX_SCRAPS) showEdit(garden.scraps[0]!.id);
                      else {
                        focusComposer();
                      }
                    }}
                  >
                    {fullPairHistory
                      ? 'Review a source for removal'
                      : kind === 'sample' && !retries.length
                        ? 'Start your own pile'
                        : garden.scraps.length >= MAX_SCRAPS
                          ? 'Edit a source'
                          : 'Add another scrap'}
                  </button>
                )}
                {busy && (
                  <button
                    className="text-button cancel"
                    onClick={() => controller.current?.abort()}
                  >
                    Cancel · keep my slot
                  </button>
                )}
                <div className="ferment-footer">
                  <span>One new slot every 15 min · up to 3</span>
                  {kind === 'sample' && (
                    <button
                      disabled={busy || locked || saving}
                      onClick={() =>
                        void action(async () => {
                          await commit((g) =>
                            reconcile({ ...g, demoOffset: g.demoOffset + INTERVAL }, Date.now()),
                          );
                          setNotice('Demo clock advanced 15 minutes. No AI ran while away.');
                        })
                      }
                    >
                      Demo clock: +15 min
                    </button>
                  )}
                </div>
              </div>
              <button className="engine-pill" onClick={() => setDialog('engine')}>
                <span className="status-dot" />
                <span>
                  {kind === 'sample'
                    ? 'Recorded demo · no live AI'
                    : backend === 'browser'
                      ? loaded
                        ? `${MODELS[modelKey].label} · browser-local`
                        : 'Browser AI · model not loaded'
                      : local
                        ? `${local.model} · local Ollama`
                        : 'Choose your local AI'}
                </span>
                <Icon name="settings" size={15} />
              </button>
            </section>
            <section className="sprouts-panel panel">
              <div className="section-title">
                <h2>Fresh from the soil</h2>
                <Icon name="sprout" size={21} />
              </div>
              <p className="section-subtitle">New possibilities, with a little history.</p>
              {collection.length === 0 ? (
                <div className="empty-sprout">
                  <div className="empty-sprout-art">
                    <Icon name="sprout" size={56} />
                    <span>✧</span>
                  </div>
                  <h3>
                    A happy accident
                    <br />
                    is on its way.
                  </h3>
                  <p>
                    Two scraps. A little time.
                    <br />
                    Something neither could
                    <br />
                    have been alone.
                  </p>
                  <span className="dashed-arrow">↖</span>
                  <small>Your first sprout will appear here.</small>
                </div>
              ) : (
                collection.map((s) => (
                  <SproutCard
                    key={s.id}
                    sprout={s}
                    onTend={() => {
                      setGrowthParent(s.id);
                      setDialog('growth');
                    }}
                    disabled={locked || busy || saving}
                    onKeep={() =>
                      void action(async () => {
                        await commit((g) => ({
                          ...g,
                          sprouts: g.sprouts.map((item) =>
                            item.id === s.id ? { ...item, kept: !item.kept } : item,
                          ),
                        }));
                        setNotice(
                          s.kept
                            ? 'Removed from your collection.'
                            : 'A keeper. Added to your collection.',
                        );
                      })
                    }
                    onCompost={() =>
                      void action(async () => {
                        await commit((g) => recompost(g, s.id, Date.now()));
                        setNotice('Back in the pile, with its roots intact.');
                      })
                    }
                    onExport={() => exportSprout(s)}
                    onEdit={() => showEdit(s.id, true)}
                  />
                ))
              )}
              {garden.sprouts.length > 1 && (
                <button
                  className="text-button all-sprouts"
                  onClick={() => {
                    setCollectionView('all');
                    setCollectionPage(0);
                    setTab('collection');
                  }}
                >
                  View all discoveries <Icon name="arrow" size={16} />
                </button>
              )}
              <div className="quiet-note">
                <span>✳</span>
                <p>
                  A new idea, not a promise.
                  <br />
                  Keep what makes you curious.
                </p>
              </div>
            </section>
          </div>
        ) : (
          <section aria-label="Discoveries">
            <div className="discovery-filters" role="group" aria-label="Discovery filter">
              <button
                className="button secondary"
                aria-pressed={collectionView === 'kept'}
                onClick={() => {
                  setCollectionView('kept');
                  setCollectionPage(0);
                }}
              >
                Kept ideas ({kept})
              </button>
              <button
                className="button secondary"
                aria-pressed={collectionView === 'all'}
                onClick={() => {
                  setCollectionView('all');
                  setCollectionPage(0);
                }}
              >
                All discoveries ({garden.sprouts.length})
              </button>
            </div>
            <div className="collection-grid">
              {collection.length ? (
                collection.slice(collectionPageIndex * 3, collectionPageIndex * 3 + 3).map((s) => (
                  <SproutCard
                    key={s.id}
                    sprout={s}
                    onTend={() => {
                      setGrowthParent(s.id);
                      setDialog('growth');
                    }}
                    disabled={locked || busy || saving}
                    onKeep={() =>
                      void action(async () => {
                        await commit((g) => ({
                          ...g,
                          sprouts: g.sprouts.map((item) =>
                            item.id === s.id ? { ...item, kept: !item.kept } : item,
                          ),
                        }));
                      })
                    }
                    onCompost={() =>
                      void action(async () => {
                        await commit((g) => recompost(g, s.id, Date.now()));
                      })
                    }
                    onExport={() => exportSprout(s)}
                    onEdit={() => showEdit(s.id, true)}
                  />
                ))
              ) : (
                <div className="collection-empty">
                  <Icon name="book" size={46} />
                  <h2>Your herbarium of possibilities.</h2>
                  <p>
                    {collectionView === 'all'
                      ? 'Every discovery stays here, even before you keep it.'
                      : 'Tap Keep on a sprout to give it a place here.'}
                  </p>
                  <button className="button primary" onClick={() => setTab('garden')}>
                    Back to the garden <Icon name="arrow" size={16} />
                  </button>
                </div>
              )}
            </div>
            <PageNavigation
              label="Discoveries"
              page={collectionPageIndex}
              count={collection.length}
              size={3}
              onChange={setCollectionPage}
            />
          </section>
        )}
      </main>
      {reading && (
        <Modal title="Full scrap" onClose={() => setReadingScrap(null)}>
          <p className="full-scrap">{reading.raw}</p>
          <p className="small-print">
            Full text of the current revision. Your original and earlier revisions stay available in
            History.
          </p>
        </Modal>
      )}
      <footer>
        <span>
          <Icon name="sprout" size={15} />
          Made for the beautifully unfinished.
        </span>
        <span>
          <Icon name="lock" size={13} />
          {__OFFLINE__ ? (
            <button onClick={() => setDialog('backup')}>Offline demo · save a backup ↗</button>
          ) : (
            'Local first. No account. No paid API.'
          )}
        </span>
        <button onClick={() => setDialog('about')}>
          A little more about this garden <span>↗</span>
        </button>
      </footer>
      {dialog === 'about' && (
        <Modal title="Good things grow slowly." onClose={() => setDialog(null)}>
          <div className="prose">
            <p>
              Compost Club is a quiet home for unfinished ideas. Add two different scraps, let Gemma
              blend them, and decide whether the new thought deserves to grow.
            </p>
            <h3>Time gives you space</h3>
            <p>
              Your first pairing is available immediately. After that, one slot matures every 15
              minutes, up to three. Closing the page only accrues slots. No model runs in the
              background, and nothing dies while you're away.
            </p>
            <h3>Your ideas stay on your device</h3>
            <p>
              Scraps and sprouts live in this browser's IndexedDB. They are not synced. There is no
              analytics, account, cloud generation or paid API. Download JSON backups to keep a
              portable copy.
            </p>
            <p>
              Optional technical monitoring is off by default. The person running the local server
              can enable timings and token counts in Sentry. Idea texts and model responses stay
              local; the local AI connection shows when monitoring is on.
            </p>
            <h3>Three honest ways to play</h3>
            <p>
              <strong>Sample garden:</strong> real recorded Gemma results for exact public-safe
              fixtures. No live generation. Custom scraps cannot receive a canned answer.
            </p>
            <p>
              <strong>Browser AI (experimental):</strong> Gemma 3 ONNX q4f16 in a worker via
              Transformers.js 4.3.1 and WebGPU. Opt-in downloads contact Hugging Face and its model
              CDN; this reveals ordinary connection metadata, never your idea text. Quality is
              limited and outputs can fail validation. Mobile GPU memory varies.
            </p>
            <p>
              <strong>Local Ollama:</strong> Gemma 3 1B via a loopback-only server. Install Ollama,
              set <code>OLLAMA_NO_CLOUD=1</code> for its process, run{' '}
              <code>ollama pull gemma3:1b</code>, then in this project run <code>npm ci</code>,{' '}
              <code>npm run build</code> and <code>npm start</code>. Open{' '}
              <code>http://127.0.0.1:4173</code>. The server never exposes Ollama to the internet.
            </p>
            <h3>A small open garden</h3>
            <p>
              App code: MIT. Gemma weights: Google's Gemma Terms, separately licensed. Model
              creators: Google DeepMind; ONNX conversions: ONNX Community. The drawings are original
              SVG made for this app. No weights are included.
            </p>
            <p>
              Browser generation is a local experiment, not certified on a public Pages origin. An
              exact quote proves provenance, not that a new idea is useful. That's your call.
            </p>
            <details>
              <summary>Third-party licence texts</summary>
              <pre className="licence-texts">{licenceTexts}</pre>
            </details>
          </div>
        </Modal>
      )}
      {dialog === 'engine' && (
        <Modal
          title="A little local intelligence."
          onClose={() => {
            if (!engineBusy) setDialog(null);
          }}
        >
          <p className="modal-intro">
            One small task: turn two scraps into one concrete idea. Your ideas stay here.
          </p>
          {kind === 'sample' && (
            <div className="message info">
              You're in the sample garden. It always replays real recordings. Switch to Your garden
              to use live AI.
            </div>
          )}
          <div className="engine-options">
            <button
              className={backend === 'browser' ? 'selected' : ''}
              disabled={__OFFLINE__ || engineBusy || busy}
              onClick={() => setBackend('browser')}
            >
              <Icon name="sprout" />
              <strong>In this browser</strong>
              <small>WebGPU · experimental</small>
            </button>
            <button
              className={backend === 'ollama' ? 'selected' : ''}
              disabled={__OFFLINE__ || engineBusy || busy}
              onClick={() => setBackend('ollama')}
            >
              <Icon name="lock" />
              <strong>Local Ollama</strong>
              <small>Gemma 3 1B / 4B · loopback</small>
            </button>
          </div>
          {__OFFLINE__ ? (
            <p>
              Live generation is available in the web or local app. This self-contained file is a
              recorded demo.
            </p>
          ) : backend === 'browser' ? (
            <div className="engine-detail">
              <label htmlFor="model-choice">Choose a model</label>
              <select
                id="model-choice"
                value={modelKey}
                disabled={engineBusy || busy}
                onChange={(e) => {
                  setModelKey(e.target.value as ModelKey);
                  setLoaded(false);
                }}
              >
                <option value="1b">Gemma 3 1B · ~784 MB</option>
                <option value="270m">Gemma 3 270M · ~294 MB</option>
              </select>
              <p>
                {modelKey === '270m'
                  ? '270M failed our initial blend quality check. It remains available for experiments.'
                  : '1B is more capable, but still makes mistakes. Strict source validation can reject a result.'}{' '}
                Downloads may need more than 1 GB of free RAM; file size is not GPU memory usage.
              </p>
              <p>
                Download: {Math.ceil(MODELS[modelKey].bytes / 1e6)} MB of pinned model/tokenizer
                files plus local runtime. Cached by your browser when supported. Provider: Hugging
                Face / model CDN. Licence: Gemma Terms. You can cancel at any time.
              </p>
              <details>
                <summary>Exact model identity</summary>
                <code>
                  {MODELS[modelKey].id}
                  <br />
                  {MODELS[modelKey].revision}
                  <br />
                  q4f16 · Transformers.js 4.3.1
                </code>
              </details>
              {engineBusy && (
                <div className="download-progress" role="status">
                  <span>
                    {progressLabel} · {Math.floor(progress)}%
                  </span>
                  <progress value={progress} max={100} />
                </div>
              )}
              <button
                className="button primary"
                onClick={() => void loadModel()}
                disabled={engineBusy || busy}
              >
                {loaded ? 'Reload local model' : 'I agree · download & load model'}
                <Icon name="download" size={17} />
              </button>
              {engineBusy && (
                <button
                  className="button subtle"
                  onClick={() => {
                    browserAI.cancel();
                    setEngineBusy(false);
                  }}
                >
                  Cancel download
                </button>
              )}
            </div>
          ) : (
            <div className="engine-detail">
              <p>
                The app's local server connects only to <code>127.0.0.1</code>. No weights are
                downloaded by this button. Install <code>gemma3:1b</code> in Ollama first.
              </p>
              <button
                className="button primary"
                disabled={engineBusy || busy}
                onClick={() => void connect()}
              >
                {local ? 'Check connection' : 'Connect local Gemma'}
                <Icon name="arrow" size={17} />
              </button>
              {local && (
                <p className="success-text">
                  Connected: {local.model}
                  {local.monitoring ? ' · optional technical monitoring ON (no idea text)' : ''}
                  <br />
                  <code>{local.digest.slice(0, 24)}…</code>
                </p>
              )}
              <button className="text-button" onClick={() => setDialog('about')}>
                Run locally: instructions
              </button>
            </div>
          )}
          <label className="language-choice">
            Sprout language
            <select
              aria-label="Sprout language"
              value={language}
              disabled={busy}
              onChange={(e) => setLanguage(e.target.value as Language)}
            >
              <option value="en">English</option>
              <option value="ru">Русский</option>
            </select>
          </label>
          <p className="small-print">
            You choose when to run each blend. Invalid quotes, cancellation and model errors never
            use a slot.
          </p>
          {error && (
            <p role="alert" className="modal-error">
              {error}
            </p>
          )}
        </Modal>
      )}
      {dialog === 'share' && shareSprout && (
        <Modal title="Export this idea" onClose={() => setDialog(null)}>
          <p>
            The card includes the idea, both source texts and model attribution. Review these before
            sharing. Raw model responses are excluded by default.
          </p>
          <label>
            <input
              type="checkbox"
              checked={shareEvidence}
              onChange={(e) => setShareEvidence(e.target.checked)}
            />
            Include original inference transcript for this idea
          </label>
          <button
            className="button primary"
            onClick={() =>
              download(
                'compost-club-sprout.md',
                exportSproutCard(garden, shareSprout, shareEvidence),
                'text/markdown;charset=utf-8',
              )
            }
          >
            Download idea card
          </button>
        </Modal>
      )}
      {dialog === 'growth' && (
        <GrowthLab
          garden={garden}
          initial={growthParent}
          disabled={locked || saving || !!inferenceRecovery}
          commit={commit}
          onBusy={(value) => {
            busyRef.current = value;
            setBusy(value);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'backup' && (
        <Modal title="Take a little growth with you." onClose={() => setDialog(null)}>
          {__OFFLINE__ && (
            <p className="modal-intro">
              Offline demo: file-origin storage can change when this HTML is moved or renamed.
              Export JSON to carry your garden with you. Live AI requires the web or local app.
            </p>
          )}
          <p className="modal-intro">
            Your garden lives on this device. A JSON backup carries originals, sprouts, edits and
            their roots.
          </p>
          <div className="backup-actions">
            {hasRestoreCopy && (
              <button
                className="button secondary"
                onClick={() =>
                  void action(async () =>
                    download(
                      'compost-club-before-restore.json',
                      await storage.beforeRestoreJSON(kind),
                      'application/json',
                    ),
                  )
                }
              >
                Download before-restore copy
              </button>
            )}
            {!!garden.growth?.length && (
              <button
                className="button secondary"
                onClick={() => {
                  setGrowthParent(garden.sprouts.find((s) => s.kept)?.id ?? '');
                  setDialog('growth');
                }}
              >
                Review idea branches
              </button>
            )}
            <button className="button secondary" onClick={() => setDialog('history')}>
              Inspect inference history
            </button>
            {inferenceRecovery && (
              <>
                <p>
                  A response did not fit the normal save. This recovery copy is separate from the
                  JSON garden backup. Download it before removing it.
                </p>
                <button
                  className="button secondary"
                  onClick={() =>
                    download(
                      'compost-club-inference-recovery.json',
                      JSON.stringify(inferenceRecovery, null, 2),
                      'application/json',
                    )
                  }
                >
                  Download inference recovery copy
                </button>
                <button
                  className="button secondary"
                  disabled={locked || busy || saving}
                  onClick={() => setDialog('discard-evidence')}
                >
                  Remove inference recovery copy…
                </button>
              </>
            )}
            <button
              className="button primary"
              onClick={() =>
                download(
                  'compost-club-garden.md',
                  exportMarkdown(garden),
                  'text/markdown;charset=utf-8',
                )
              }
            >
              <Icon name="download" />
              Export Markdown
            </button>
            <button
              className="button secondary"
              onClick={() =>
                void action(() =>
                  download('compost-club-backup.json', serializeGarden(garden), 'application/json'),
                )
              }
            >
              <Icon name="download" />
              Save JSON backup
            </button>
            {hasRecoveryCopy && (
              <button
                className="button secondary"
                onClick={() =>
                  void action(async () =>
                    download(
                      `compost-club-${kind}-previous-recovery.json`,
                      await storage.recoveryJSON(kind, true),
                      'application/json',
                    ),
                  )
                }
              >
                <Icon name="download" />
                Download previous recovery copy
              </button>
            )}
            <label className="button secondary file-label">
              <Icon name="upload" />
              Restore JSON backup
              <input
                aria-label="Restore JSON backup"
                type="file"
                accept=".json,application/json"
                disabled={locked || busy}
                onChange={(e) => void readBackup(e.target.files?.[0])}
              />
            </label>
          </div>
          <RetainedCopies
            kind={kind}
            disabled={locked || busy || saving}
            onChanged={() => {
              void Promise.all([storage.inferenceRecovery(kind), storage.retainedCopies(kind)])
                .then(([r, copies]) => {
                  setInferenceRecovery(r ?? null);
                  setHasRestoreCopy(copies.some((c) => c.key === `before-restore:${kind}`));
                  setHasRecoveryCopy(copies.some((c) => c.key === `recovery:${kind}`));
                })
                .catch((e) => setError(errorText(e)));
            }}
          />
          <p className="small-print">
            Full Markdown and JSON backups include private source history and raw model responses.
            Restore checks the entire file before showing a replacement preview. Maximum 2 MiB.
            Export labels always distinguish recorded and live model results.
          </p>
          {error && (
            <p role="alert" className="modal-error">
              {error}
            </p>
          )}
        </Modal>
      )}
      {dialog === 'history' && (
        <Modal title="Inference history" onClose={() => setDialog(null)}>
          <button
            className="button secondary"
            onClick={() =>
              download(
                'compost-club-inference-history.json',
                JSON.stringify(
                  {
                    disclosure:
                      kind === 'sample'
                        ? 'Recorded demo — no live AI'
                        : 'Local inference history; imported claims are not independently certified',
                    generations: garden.generations ?? [],
                  },
                  null,
                  2,
                ),
                'application/json',
              )
            }
          >
            Download inference history
          </button>
          <InferenceHistory runs={garden.generations ?? []} />
        </Modal>
      )}
      {dialog === 'source-history' && garden.scraps.find((s) => s.id === editId) && (
        <Modal title="Source history" onClose={() => setDialog(null)}>
          <button
            className="button secondary"
            onClick={() => {
              const scrap = garden.scraps.find((s) => s.id === editId)!;
              download(
                'compost-club-source-history.json',
                JSON.stringify(
                  {
                    id: scrap.id,
                    knownFromRevision: scrap.history?.[0]?.revision ?? scrap.revision,
                    revisions: sourceRevisions(scrap),
                  },
                  null,
                  2,
                ),
                'application/json',
              );
            }}
          >
            Download source history
          </button>
          <SourceHistory scrap={garden.scraps.find((s) => s.id === editId)!} />
        </Modal>
      )}
      {dialog === 'discard-evidence' && inferenceRecovery && (
        <Modal title="Remove this inference recovery copy?" onClose={() => setDialog('backup')}>
          <p>
            This removes one run with {inferenceRecovery.responses.length} original responses and
            its two source snapshots from this device. The garden and saved sprouts stay. Download
            the copy first if you need it.
          </p>
          <InferenceHistory runs={[inferenceRecovery]} />
          <button
            className="button danger"
            disabled={locked || busy || saving}
            onClick={() =>
              void action(async () => {
                const saved = await storage.inferenceRecovery(kind);
                if (saved) await storage.discardInference(kind, inferenceRecovery);
                setInferenceRecovery(null);
                setDialog('backup');
              })
            }
          >
            Remove this recovery copy
          </button>
        </Modal>
      )}
      {dialog === 'edit' && (
        <Modal
          title={sproutEdit ? 'Make this thought your own.' : 'A thought can change.'}
          onClose={() => {
            setEditText('');
            setDialog(null);
          }}
        >
          {sproutEdit && (
            <label className="field-label">
              Title
              <input
                aria-label="Title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </label>
          )}
          <label className="field-label">
            {sproutEdit ? 'Your version' : 'Idea scrap'}
            <textarea
              aria-label={sproutEdit ? 'Your version' : 'Idea scrap'}
              rows={6}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />
          </label>
          <p className="small-print">
            {sproutEdit
              ? 'Marked “Edited by you”. The original model response stays available in the roots and JSON backup.'
              : 'A new revision keeps older sprouts tied to the exact text that made them.'}
          </p>
          <button
            className="button primary"
            disabled={saving || locked}
            onClick={() => void saveEdit()}
          >
            Save edit <Icon name="check" size={17} />
          </button>
          {error && (
            <p role="alert" className="modal-error">
              {error}
            </p>
          )}
        </Modal>
      )}
      {dialog === 'delete' && (
        <Modal title="Let this scrap go?" onClose={() => setDialog(null)}>
          <p>
            This removes {affected.scraps.size} scrap{affected.scraps.size === 1 ? '' : 's'}{' '}
            containing {affected.revisions} saved text revision{affected.revisions === 1 ? '' : 's'}
            , and {affected.sprouts.size} dependent sprout{affected.sprouts.size === 1 ? '' : 's'},
            and {affected.generations.size} inference history record
            {affected.generations.size === 1 ? '' : 's'}, including their saved source snapshots.{' '}
            {affected.pairings} pairing record{affected.pairings === 1 ? '' : 's'} will also be
            removed from the active garden, along with {affected.growth.size} growth records.
            Recovery and before-restore copies may still contain this text. Downloaded files and
            other browsers are separate copies; they are not erased.
          </p>
          <ul className="delete-list">
            {garden.scraps
              .filter((s) => affected.scraps.has(s.id))
              .map((s) => (
                <li key={s.id}>{s.text.slice(0, 100)}…</li>
              ))}
          </ul>
          <button className="button secondary" onClick={() => setDialog('backup')}>
            Review recovery copies before deletion
          </button>
          <button
            className="button secondary"
            onClick={() =>
              download(
                'compost-club-before-removal.json',
                JSON.stringify(garden, null, 2),
                'application/json',
              )
            }
          >
            Save a backup first
          </button>
          <button
            className="button danger"
            disabled={locked || saving || busy || !!inferenceRecovery}
            onClick={() =>
              void action(async () => {
                await commit((g) => removeScrap(g, editId));
                setDialog(null);
                setNotice('Scrap and dependent roots removed.');
              })
            }
          >
            Remove scrap and dependent sprouts
          </button>
          {error && (
            <p role="alert" className="modal-error">
              {error}
            </p>
          )}
        </Modal>
      )}
      {dialog === 'import' && pendingImport && (
        <Modal
          title="Restore this little garden?"
          onClose={() => {
            setPendingImport(null);
            setDialog(null);
          }}
        >
          <p>
            This backup has <strong>{pendingImport.scraps.length} scraps</strong>,{' '}
            <strong>{pendingImport.sprouts.length} sprouts</strong> and {pendingImport.readySlots}{' '}
            ready slots.
          </p>
          <p>
            It replaces your{' '}
            <strong>{pendingImport.kind === 'sample' ? 'sample' : 'personal'} garden</strong>. Your
            other garden is separate. Save a backup first if you want to keep both versions. The
            replaced garden is also retained as the most recent before-restore copy; a later restore
            replaces that copy. Startup recovery originals are separate.
          </p>
          <button
            className="button secondary"
            onClick={() =>
              void action(() =>
                download(
                  'compost-club-before-restore.json',
                  serializeGarden(garden),
                  'application/json',
                ),
              )
            }
          >
            Back up current garden
          </button>
          <button
            className="button primary"
            disabled={locked || saving || busy}
            onClick={() =>
              void action(async () => {
                const target = pendingImport;
                if (target.kind !== kind)
                  throw new Error('Switch to the matching garden before restoring this backup.');
                await commit(() => target, importRevision);
                setPendingImport(null);
                setDialog(null);
                setNotice('Garden restored. Interrupted model calls were not resumed.');
              })
            }
          >
            Replace garden with this backup
          </button>
          {error && (
            <p role="alert" className="modal-error">
              {error}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
function SproutCard({
  sprout: s,
  disabled,
  onKeep,
  onCompost,
  onExport,
  onEdit,
  onTend,
}: {
  sprout: Sprout;
  disabled: boolean;
  onKeep: () => void;
  onCompost: () => void;
  onExport: () => void;
  onEdit: () => void;
  onTend: () => void;
}) {
  const content = s.edited ?? s.output;
  const [rootsOpen, setRootsOpen] = useState(false);
  return (
    <article className="sprout-card">
      <div className="sprout-card-top">
        <span>
          <Icon name="sprout" size={15} />
          {s.backend === 'replay' ? 'RECORDED SPROUT' : 'NEW SPROUT'}
        </span>
        <span>✧</span>
      </div>
      <h3>{content.title}</h3>
      <p className="sprout-concept">{content.concept}</p>
      {s.edited && <span className="edited-tag">Edited by you</span>}
      <button className="roots-button" onClick={() => setRootsOpen(true)}>
        Grew from <span>2 scraps ↗</span>
      </button>
      {rootsOpen && (
        <Modal
          title="Every sprout keeps its roots."
          className="roots-modal"
          onClose={() => setRootsOpen(false)}
        >
          <div className="roots">
            <div className="root-sources">
              <section>
                <div className="parent">
                  <span>A</span>
                  <p>{s.parents[0].text}</p>
                </div>
                <blockquote>“{s.output.fromA}”</blockquote>
              </section>
              <section>
                <div className="parent">
                  <span>B</span>
                  <p>{s.parents[1].text}</p>
                </div>
                <blockquote>“{s.output.fromB}”</blockquote>
              </section>
            </div>
            <small>
              {s.backend === 'replay'
                ? 'Recorded demo — no live AI'
                : s.backend === 'browser'
                  ? 'Live browser-local inference'
                  : 'Live local Ollama inference'}
              <br />
              {s.model}
              <br />
              Revision: {s.modelRevision}
              <br />
              Prompt: {s.promptVersion}
            </small>
            {s.edited && (
              <div className="original-output">
                <strong>Original model result</strong>
                <p>
                  {s.output.title}: {s.output.concept}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
      <div className="sprout-buttons">
        <button
          className={`button ${s.kept ? 'kept-button' : 'primary'}`}
          disabled={disabled}
          onClick={onKeep}
        >
          <Icon name={s.kept ? 'check' : 'leaf'} size={16} />
          {s.kept ? 'Kept' : 'Keep this idea'}
        </button>
        <button className="icon-button" onClick={onExport} aria-label="Export this sprout">
          <Icon name="download" size={18} />
        </button>
      </div>
      {s.kept && (
        <button className="button secondary" disabled={disabled} onClick={onTend}>
          Tend this idea
        </button>
      )}
      <div className="sprout-bottom">
        <button disabled={disabled || s.recomposted} onClick={onCompost}>
          <Icon name="cycle" size={14} />
          {s.recomposted ? 'Back in the pile' : 'Compost again'}
        </button>
        <button disabled={disabled} onClick={onEdit}>
          <Icon name="edit" size={13} />
          Edit
        </button>
      </div>
    </article>
  );
}

function PageNavigation({
  label,
  page,
  count,
  size,
  onChange,
}: {
  label: string;
  page: number;
  count: number;
  size: number;
  onChange: (page: number) => void;
}) {
  if (count <= size) return null;
  return (
    <nav className="page-navigation" aria-label={label}>
      <button
        aria-label={`Previous ${label.toLowerCase()} page`}
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        ←
      </button>
      <span aria-live="polite">
        {page * size + 1}–{Math.min(count, (page + 1) * size)} of {count}
      </span>
      <button
        aria-label={`Next ${label.toLowerCase()} page`}
        disabled={(page + 1) * size >= count}
        onClick={() => onChange(page + 1)}
      >
        →
      </button>
    </nav>
  );
}
