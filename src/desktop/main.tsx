import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useState } from 'react';
import type { DesktopAPI, DesktopCommand, DesktopView } from '../../desktop/types';
import type { Sprout } from '../domain/garden';
import { callsToday, unreviewed } from '../domain/experiment';
import { provenanceLabel } from '../domain/provenance';
import { DIRECTIONS, type Growth } from '../domain/growth';
import { Author } from '../ui/Author';
import licenceTexts from '../../public/THIRD_PARTY_LICENSES.txt?raw';
import '../styles.css';
import './style.css';

declare global {
  interface Window {
    compost: DesktopAPI;
  }
}
const shortDate = (n: number) =>
  new Date(n).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
const statusLabels = {
  paused: 'На паузе',
  pausing: 'Освобождаем ресурсы…',
  running: 'Растёт новая идея',
  waiting: 'Сад работает',
  attention: 'Нужно внимание',
};
function friendlyReason(reason: string, nextAt: number): string {
  const messages: Record<string, string> = {
    'Paused after launch. Resume explicitly when ready.':
      'После запуска сад на паузе. Продолжите, когда будет удобно.',
    'Paused by you. Model resources released.':
      'Вы поставили сад на паузу. Модель выгружена, её процесс остановлен.',
    'Stopping work and releasing model resources…':
      'Останавливаем задание и освобождаем память модели…',
    'Review your new ideas before more are generated.':
      'Посмотрите новые идеи, прежде чем сад создаст следующие.',
    'Daily model-call budget reached.':
      'Дневной предел вызовов достигнут. Продолжим в другой день.',
    'Waiting for a pairing credit.': 'Ждём следующий слот. Он появляется каждые 15 минут.',
    'No unused participating pair matches your filter.':
      'Нет новых пар с выбранными тегами. Добавьте или включите исходные идеи.',
    'Finish or review the current proposal.':
      'Сейчас выполняется задание или ожидает просмотра предложенная ветвь.',
    'Paused after changing local model setup.': 'Настройка модели изменена. Сад остаётся на паузе.',
    'Paused after settings changed.':
      'Настройки сохранены. Продолжите эксперимент, когда будете готовы.',
    'Paused after wake. Resume explicitly when ready.':
      'Компьютер проснулся. Сад остаётся на паузе.',
  };
  if (reason === 'Resting until the next scheduled pairing.')
    return `Следующая пара — после ${shortDate(nextAt)}.`;
  return messages[reason] ?? reason;
}

function DesktopApp() {
  const [view, setView] = useState<DesktopView | null>(null),
    [error, setError] = useState(''),
    [tab, setTab] = useState<'garden' | 'inbox' | 'settings' | 'journal' | 'about'>('garden'),
    [pending, setPending] = useState(false);
  const [text, setText] = useState(''),
    [title, setTitle] = useState(''),
    [tags, setTags] = useState('Игры'),
    [participating, setParticipating] = useState(false),
    [batch, setBatch] = useState(false),
    [query, setQuery] = useState('');
  const [parts, setParts] = useState<string[]>([]),
    [filter, setFilter] = useState<'new' | 'kept' | 'all'>('new'),
    [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const invoke = useCallback(async (command: DesktopCommand) => {
    setPending(true);
    setError('');
    try {
      const next = await window.compost.invoke(command);
      setView(next);
      if (next.error) setError(next.error);
      return !next.error;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setPending(false);
    }
  }, []);
  useEffect(() => {
    void invoke({ op: 'snapshot' });
    return window.compost.subscribe((next) => setView(next));
  }, [invoke]);
  useEffect(() => {
    if (view?.preview) setParts(view.preview.parts.map((p) => p.text));
  }, [view?.preview?.id]);
  useEffect(() => {
    const add = () => {
      setTab('garden');
      requestAnimationFrame(() => document.getElementById('idea-text')?.focus());
    };
    window.addEventListener('compost:add-idea', add);
    return () => window.removeEventListener('compost:add-idea', add);
  }, []);
  if (!view)
    return (
      <main className="desktop-loading">
        <h1>Compost Club</h1>
        <p>Открываем ваш сад…</p>
        {error && <p role="alert">{error}</p>}
      </main>
    );
  const w = view.workspace,
    newCount = unreviewed(w),
    disabled = pending || view.busy;
  const visible = w.garden.sprouts
    .filter((s) => {
      const state = w.reviews[s.id]?.state ?? 'new',
        content = s.edited ?? s.output;
      return (
        (filter === 'all' ||
          (filter === 'kept' && s.kept) ||
          (filter === 'new' && ['new', 'later'].includes(state))) &&
        `${content.title} ${content.concept} ${w.reviews[s.id]?.note ?? ''} ${s.parents.map((p) => `${p.text} ${w.sources[p.id]?.title ?? ''} ${w.sources[p.id]?.tags.join(' ') ?? ''}`).join(' ')}`
          .toLowerCase()
          .includes(query.toLowerCase())
      );
    })
    .slice()
    .reverse();
  const submit = async () => {
    const ok = batch
      ? await invoke({ op: 'pasteImport', text })
      : editing
        ? await invoke({ op: 'editSource', id: editing, text, title, tags, participating })
        : await invoke({ op: 'add', text, title, tags, participating });
    if (ok) {
      setText('');
      setTitle('');
      setEditing(null);
    }
  };
  return (
    <div className="desktop-app">
      <aside className="desktop-sidebar">
        <div className="desktop-brand">
          <span className="brand-sprout">♧</span>
          <div>
            <strong>Compost Club</strong>
            <small>Место для новых связей</small>
          </div>
        </div>
        <nav aria-label="Разделы">
          <button className={tab === 'garden' ? 'active' : ''} onClick={() => setTab('garden')}>
            ✿ Мой сад <span>{w.garden.scraps.length}</span>
          </button>
          <button className={tab === 'inbox' ? 'active' : ''} onClick={() => setTab('inbox')}>
            ✧ Новые идеи <span>{newCount}</span>
          </button>
          <button className={tab === 'journal' ? 'active' : ''} onClick={() => setTab('journal')}>
            ☷ Наблюдения
          </button>
          <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
            ⚙ Настройки
          </button>
          <button className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>
            Об авторе
          </button>
        </nav>
        <div className="sidebar-bottom">
          <span className={`state-dot ${view.status}`} />
          <strong>{statusLabels[view.status]}</strong>
          <p>
            Локальная Gemma.
            <br />
            Ваши идеи остаются у вас.
          </p>
          <small>Закройте окно, чтобы оставить сад в трее.</small>
        </div>
      </aside>
      <main className="desktop-main">
        <header className="desktop-header">
          <div>
            <p className="eyebrow">ВАШ ТИХИЙ ТВОРЧЕСКИЙ ЭКСПЕРИМЕНТ</p>
            <h1>
              {tab === 'garden'
                ? 'Пусть идеи прорастают.'
                : tab === 'inbox'
                  ? 'Что нового в саду?'
                  : tab === 'settings'
                    ? 'Удобный вам ритм.'
                    : tab === 'about'
                      ? 'О саде и его авторе.'
                      : 'Посмотрим, что получилось.'}
            </h1>
          </div>
          <div className="desktop-controls">
            <span className={`status-pill ${view.status}`}>{statusLabels[view.status]}</span>
            {w.experiment.enabled || view.busy ? (
              <button
                className="pause-button"
                disabled={pending || view.status === 'pausing'}
                onClick={() => {
                  void invoke({ op: 'pause' });
                }}
              >
                Ⅱ Пауза и освобождение памяти
              </button>
            ) : (
              <button
                className="primary"
                disabled={disabled}
                onClick={() => {
                  void invoke({ op: 'resume' });
                }}
              >
                ▷ Продолжить эксперимент
              </button>
            )}
          </div>
        </header>
        {error && (
          <div className="desktop-error" role="alert">
            {error}
            <button aria-label="Закрыть сообщение" onClick={() => setError('')}>
              ×
            </button>
          </div>
        )}
        <div className="desktop-status" role="status">
          <span className={`state-dot ${view.status}`} />
          <span>{friendlyReason(view.reason, w.experiment.nextAt)}</span>
          <small>
            {callsToday(w, Date.now())}/{w.settings.dailyCalls} вызовов сегодня ·{' '}
            {w.garden.readySlots} слотов
          </small>
        </div>
        {tab === 'garden' && (
          <>
            <section className="desktop-welcome">
              <div>
                <p className="eyebrow">МАЛЕНЬКИЕ ШАГИ, НЕОЖИДАННЫЕ СОЧЕТАНИЯ</p>
                <h2>
                  Добавьте то, что
                  <br />
                  хочется однажды сделать.
                </h2>
                <p>
                  Идеи игр, проекты, странные механики. Вы выбираете, что участвует в эксперименте,
                  и сохраняете интересные находки.
                </p>
                <div className="rhythm-chips">
                  <span>Одна пара за раз</span>
                  <span>{w.settings.intervalMinutes} минут между запусками</span>
                  <span>До {w.settings.backlog} новых идей</span>
                </div>
              </div>
              <div className="desktop-garden-art" aria-hidden="true">
                <div className="sun" />
                <div className="ground" />
                <div className="plant p1">✿</div>
                <div className="plant p2">✿</div>
                <div className="plant p3">❀</div>
                <div className="leaf l1" />
                <div className="leaf l2" />
                <span className="worm">〰</span>
                <small>Дайте мыслям немного времени</small>
              </div>
            </section>
            <section className="desktop-panel composer">
              <div className="section-heading">
                <h2>{editing ? 'Изменить исходную идею' : 'Посадить идею'}</h2>
                <button
                  onClick={() => {
                    setBatch(!batch);
                    setEditing(null);
                  }}
                >
                  {batch ? 'Одна идея' : 'Добавить пачку'}
                </button>
              </div>
              {!batch && (
                <label>
                  Короткое название
                  <input
                    value={title}
                    maxLength={120}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Например, кооперативная игра про сад"
                  />
                </label>
              )}
              <label>
                {batch ? 'Идеи через пустую строку или ---' : 'Ваша мысль'}
                <textarea
                  id="idea-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={batch ? 7 : 3}
                  placeholder={
                    batch
                      ? 'Первая идея…\n\nВторая идея…'
                      : 'Как это устроено? Что здесь интересного?'
                  }
                  maxLength={batch ? 100000 : 8192}
                />
              </label>
              <div className="composer-bottom">
                <label>
                  Теги через запятую
                  <input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="Игры, механика"
                  />
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={participating}
                    onChange={(e) => setParticipating(e.target.checked)}
                  />
                  Участвует в эксперименте
                </label>
                <button
                  className="primary"
                  disabled={disabled || !text.trim()}
                  onClick={() => {
                    void submit();
                  }}
                >
                  {batch ? 'Предпросмотр импорта' : editing ? 'Сохранить ревизию' : 'Добавить идею'}
                </button>
                <button
                  disabled={disabled}
                  onClick={() => {
                    void invoke({ op: 'chooseImport' });
                  }}
                >
                  Из файлов…
                </button>
              </div>
              <small>
                Оригиналы и ревизии сохраняются. Добавление само по себе не запускает модель.
              </small>
            </section>
            <div className="section-heading">
              <h2>
                Ваши исходные идеи <span className="subtle">{w.garden.scraps.length}</span>
              </h2>
              <div className="inline-controls">
                <input
                  aria-label="Поиск исходных идей"
                  placeholder="Найти идею или тег…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button
                  disabled={disabled || !w.experiment.enabled}
                  onClick={() => {
                    void invoke(
                      selected.length === 2
                        ? { op: 'run', parents: [selected[0]!, selected[1]!] }
                        : { op: 'run' },
                    );
                  }}
                >
                  Смешать {selected.length === 2 ? 'выбранные' : 'одну пару'}
                </button>
              </div>
            </div>
            <div className="source-grid">
              {w.garden.scraps
                .filter((s) =>
                  `${s.text} ${w.sources[s.id]?.tags.join(' ')}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((s) => {
                  const info = w.sources[s.id];
                  return (
                    <article className="desktop-source" key={s.id}>
                      <div className="source-top">
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={selected.includes(s.id)}
                            disabled={!selected.includes(s.id) && selected.length >= 2}
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? [...selected, s.id]
                                  : selected.filter((id) => id !== s.id),
                              )
                            }
                          />
                          Выбрать пару
                        </label>
                        <span>rev. {s.revision}</span>
                      </div>
                      <h3>{info?.title || s.text.slice(0, 80)}</h3>
                      <p>{s.text}</p>
                      <div className="tag-row">
                        {info?.tags.map((t) => (
                          <span key={t}>{t}</span>
                        ))}
                      </div>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={info?.participating ?? false}
                          disabled={pending}
                          onChange={(e) => {
                            void invoke({ op: 'participate', id: s.id, value: e.target.checked });
                          }}
                        />
                        Участвует
                      </label>
                      <div className="source-actions">
                        <button
                          onClick={() => {
                            setEditing(s.id);
                            setBatch(false);
                            setText(s.raw);
                            setTitle(info?.title ?? '');
                            setTags(info?.tags.join(', ') ?? '');
                            setParticipating(info?.participating ?? false);
                            document.getElementById('idea-text')?.focus();
                          }}
                        >
                          Изменить
                        </button>
                        <details>
                          <summary>Оригинал и история</summary>
                          <pre>{s.raw}</pre>
                          {s.history?.map((h) => (
                            <section key={h.revision}>
                              <strong>Ревизия {h.revision}</strong>
                              <pre>{h.raw}</pre>
                            </section>
                          ))}
                        </details>
                        <button
                          className="danger-link"
                          disabled={disabled}
                          onClick={() => {
                            void invoke({ op: 'deleteSource', id: s.id });
                          }}
                        >
                          Удалить…
                        </button>
                      </div>
                    </article>
                  );
                })}
            </div>
            {!w.garden.scraps.length && (
              <div className="desktop-empty">
                <span>♧</span>
                <h3>Здесь начинается ваш сад</h3>
                <p>Добавьте две разные мысли и выберите, какие из них можно смешивать.</p>
              </div>
            )}
          </>
        )}
        {tab === 'inbox' && (
          <>
            <div className="section-heading">
              <div className="segmented">
                {(['new', 'kept', 'all'] as const).map((f) => (
                  <button
                    className={filter === f ? 'active' : ''}
                    key={f}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'new' ? 'На просмотр' : f === 'kept' ? 'Сохранённое' : 'Все находки'}
                  </button>
                ))}
              </div>
              <input
                aria-label="Поиск результатов"
                placeholder="Поиск по тексту и тегам…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="result-grid">
              {visible.map((s) => (
                <IdeaCard key={s.id} sprout={s} view={view} invoke={invoke} disabled={disabled} />
              ))}
            </div>
            {!visible.length && (
              <div className="desktop-empty">
                <span>✧</span>
                <h3>Пока тихо</h3>
                <p>
                  Новые результаты появятся здесь. Генерация начнётся после настройки модели и
                  включения эксперимента.
                </p>
                <button onClick={() => setTab('settings')}>Открыть настройки</button>
              </div>
            )}
            {!!w.garden.growth?.length && (
              <section>
                <h2>Ветви идей</h2>
                {w.garden.growth
                  .slice()
                  .reverse()
                  .map((n) => (
                    <GrowthCard key={n.id} node={n} invoke={invoke} disabled={disabled} />
                  ))}
              </section>
            )}
          </>
        )}
        {tab === 'settings' && <Settings view={view} invoke={invoke} disabled={disabled} />}
        {tab === 'about' && (
          <article className="desktop-panel prose">
            <h2>Compost Club</h2>
            <p>
              Тихое место для незаконченных идей. Приложение соединяет два исходника с помощью
              локальной Gemma и сохраняет их историю. Полезность результата оцениваете вы.
            </p>
            <Author language="ru" />
            <h3>Авторы и лицензии</h3>
            <p>
              Код и оригинальные материалы приложения: MIT, Dreven. Gemma: Google DeepMind,
              отдельные Gemma Terms. Веса не включены. Разработка под руководством человека с
              использованием ИИ; сведения о сторонних материалах сохранены ниже.
            </p>
            <details>
              <summary>Тексты лицензий зависимостей</summary>
              <pre className="licence-texts">{licenceTexts}</pre>
            </details>
          </article>
        )}
        {tab === 'journal' && (
          <>
            <section className="metrics-row">
              <div>
                <strong>{w.experiment.calls.length}</strong>
                <span>Вызовов модели</span>
              </div>
              <div>
                <strong>{w.garden.sprouts.length}</strong>
                <span>Кандидатов</span>
              </div>
              <div>
                <strong>{w.garden.sprouts.filter((s) => s.kept).length}</strong>
                <span>Вы сохранили</span>
              </div>
              <div>
                <strong>
                  {w.garden.generations?.filter((r) => !['success', 'pending'].includes(r.status))
                    .length ?? 0}
                </strong>
                <span>Прочих исходов</span>
              </div>
            </section>
            <p className="subtle">
              Корректный формат ответа не означает полезную идею. Ваши решения и причины важнее
              количества.
            </p>
            <section className="desktop-panel">
              {w.events
                .slice()
                .reverse()
                .map((e, i) => (
                  <div className="journal-event" key={i}>
                    <time>{shortDate(e.at)}</time>
                    <strong>{e.kind}</strong>
                    <span>{e.message}</span>
                    {e.durationMs !== undefined && (
                      <small>{(e.durationMs / 1000).toFixed(1)} с</small>
                    )}
                  </div>
                ))}
              {!w.events.length && <p>Здесь появится история эксперимента.</p>}
            </section>
            <h2>Оригинальные ответы модели</h2>
            {w.garden.generations
              ?.slice()
              .reverse()
              .map((r) => (
                <details className="desktop-panel" key={r.id}>
                  <summary>
                    {r.status} · {shortDate(r.createdAt)} · {r.model}
                  </summary>
                  <p>{r.error}</p>
                  {r.parents.map((p) => (
                    <p key={p.id}>
                      Источник {p.id}, rev. {p.revision}: {p.text}
                    </p>
                  ))}
                  {r.responses.map((response, i) => (
                    <section key={i}>
                      <strong>
                        {response.phase}:{' '}
                        {response.validationError ?? 'Структура корректна; полезность не оценена'}
                      </strong>
                      <pre>{response.raw}</pre>
                    </section>
                  ))}
                  {r.status !== 'success' && r.status !== 'pending' && (
                    <button
                      disabled={disabled || !w.experiment.enabled}
                      onClick={() => {
                        void invoke({ op: 'run', retryId: r.id });
                      }}
                    >
                      Повторить эту пару явно
                    </button>
                  )}
                </details>
              ))}
          </>
        )}
        {view.preview && (
          <div className="desktop-modal-backdrop">
            <section
              className="desktop-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Предпросмотр импорта"
            >
              <div className="section-heading">
                <h2>Проверьте будущие карточки</h2>
                <button
                  onClick={() => {
                    void invoke({ op: 'cancelImport' });
                  }}
                >
                  Отмена
                </button>
              </div>
              <p>
                {view.preview.files.length} файлов · {parts.length} карточек. Точные дубликаты будут
                пропущены. Пустая карточка исключается. Оригинальные файлы сохранятся отдельно.
              </p>
              {parts.map((part, i) => (
                <label key={i}>
                  Идея {i + 1} {view.preview!.parts[i]?.duplicate ? '· дубликат' : ''}
                  <textarea
                    rows={3}
                    value={part}
                    onChange={(e) => setParts(parts.map((s, n) => (n === i ? e.target.value : s)))}
                  />
                </label>
              ))}
              <label>
                Теги
                <input value={tags} onChange={(e) => setTags(e.target.value)} />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={participating}
                  onChange={(e) => setParticipating(e.target.checked)}
                />
                Разрешить этим идеям участвовать
              </label>
              <button
                className="primary"
                disabled={pending}
                onClick={() => {
                  void invoke({
                    op: 'acceptImport',
                    id: view.preview!.id,
                    texts: parts,
                    tags,
                    participating,
                  });
                }}
              >
                Импортировать выбранное
              </button>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

type Invoke = (command: DesktopCommand) => Promise<boolean>;
function IdeaCard({
  sprout: s,
  view,
  invoke,
  disabled,
}: {
  sprout: Sprout;
  view: DesktopView;
  invoke: Invoke;
  disabled: boolean;
}) {
  const review = view.workspace.reviews[s.id],
    content = s.edited ?? s.output;
  const [note, setNote] = useState(review?.note ?? ''),
    [edit, setEdit] = useState(false),
    [title, setTitle] = useState(content.title),
    [concept, setConcept] = useState(content.concept);
  return (
    <article className="desktop-result">
      <div className="result-eyebrow">
        ✧{' '}
        {review?.state === 'kept'
          ? 'СОХРАНЕНО'
          : review?.state === 'rejected'
            ? 'ОТКЛОНЕНО'
            : review?.state === 'later'
              ? 'ОТЛОЖЕНО'
              : 'НОВАЯ НАХОДКА'}{' '}
        <time>{shortDate(s.createdAt)}</time>
      </div>
      {edit ? (
        <>
          <label>
            Название
            <input maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Идея
            <textarea
              maxLength={420}
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
            />
          </label>
          <button
            onClick={() => {
              void invoke({ op: 'editIdea', id: s.id, title, concept }).then((ok) => {
                if (ok) setEdit(false);
              });
            }}
          >
            Сохранить правку
          </button>
        </>
      ) : (
        <>
          <h2>{content.title}</h2>
          <p className="idea-concept">{content.concept}</p>
        </>
      )}
      {s.edited && <small>Изменено вами · оригинал сохранён</small>}
      <details>
        <summary>Откуда выросла идея</summary>
        {s.parents.map((p) => (
          <section key={p.id}>
            <strong>
              {view.workspace.sources[p.id]?.title ?? p.id} · rev. {p.revision}
            </strong>
            <p>{p.text}</p>
          </section>
        ))}
        <small>
          {provenanceLabel(s, s.rawOutput)} · {s.model} @ {s.modelRevision}
        </small>
      </details>
      <label>
        Ваша заметка
        <textarea
          rows={2}
          maxLength={4000}
          placeholder="Что интересно? Что стоит проверить?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="review-actions">
        <button
          className="primary"
          disabled={disabled}
          onClick={() => {
            void invoke({ op: 'review', id: s.id, state: 'kept', note });
          }}
        >
          Сохранить
        </button>
        <button
          disabled={disabled}
          onClick={() => {
            void invoke({ op: 'review', id: s.id, state: 'rejected', note });
          }}
        >
          Отклонить
        </button>
        <button
          disabled={disabled}
          onClick={() => {
            void invoke({ op: 'review', id: s.id, state: 'later', note });
          }}
        >
          Позже
        </button>
        <button disabled={disabled} onClick={() => setEdit(!edit)}>
          Правка
        </button>
      </div>
      {s.kept && (
        <div className="tend-actions">
          <button
            disabled={disabled || s.recomposted}
            onClick={() => {
              void invoke({ op: 'recompost', id: s.id });
            }}
          >
            {s.recomposted ? 'Вернулась в компост' : 'Вернуть в компост'}
          </button>
          <select
            aria-label="Направление развития"
            defaultValue=""
            disabled={disabled || !view.workspace.experiment.enabled}
            onChange={(e) => {
              if (e.target.value)
                void invoke({ op: 'tend', id: s.id, kind: 'sprout', direction: e.target.value });
              e.target.value = '';
            }}
          >
            <option value="">Развить маленьким шагом…</option>
            {DIRECTIONS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
      )}
    </article>
  );
}
function GrowthCard({
  node: n,
  invoke,
  disabled,
}: {
  node: Growth;
  invoke: Invoke;
  disabled: boolean;
}) {
  const content = n.edited ?? n.output;
  const [title, setTitle] = useState(content?.title ?? ''),
    [concept, setConcept] = useState(content?.concept ?? ''),
    [experiment, setExperiment] = useState(content?.experiment ?? '');
  return (
    <article className="desktop-panel">
      <p className="eyebrow">
        ВЕТВЬ · {n.status} · {n.imported ? 'ИМПОРТИРОВАНО' : 'ЛОКАЛЬНАЯ GEMMA'}
      </p>
      <h3>{content?.title ?? n.direction}</h3>
      <p>Родитель: {n.parent.title}</p>
      <p>{content?.concept}</p>
      <p>{content?.experiment}</p>
      <small>Предложение эксперимента. Его проведение не подтверждено.</small>
      {n.edited && <p>Изменено вами; оригинал сохранён.</p>}
      {n.status === 'proposed' && (
        <>
          <label>
            Название
            <input maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Продолжение
            <textarea
              maxLength={420}
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
            />
          </label>
          <label>
            Маленькая проверка
            <textarea
              maxLength={300}
              value={experiment}
              onChange={(e) => setExperiment(e.target.value)}
            />
          </label>
          <div className="review-actions">
            <button
              disabled={disabled}
              className="primary"
              onClick={() => {
                void invoke({
                  op: 'growthDecision',
                  id: n.id,
                  accept: true,
                  title,
                  concept,
                  experiment,
                });
              }}
            >
              Принять ветвь
            </button>
            <button
              disabled={disabled}
              onClick={() => {
                void invoke({
                  op: 'growthDecision',
                  id: n.id,
                  accept: false,
                  title,
                  concept,
                  experiment,
                });
              }}
            >
              Отклонить
            </button>
          </div>
        </>
      )}
      {n.status === 'accepted' && (
        <select
          aria-label="Продолжить ветвь"
          defaultValue=""
          disabled={disabled}
          onChange={(e) => {
            if (e.target.value)
              void invoke({ op: 'tend', id: n.id, kind: 'growth', direction: e.target.value });
            e.target.value = '';
          }}
        >
          <option value="">Продолжить ветвь…</option>
          {DIRECTIONS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      )}
      <details>
        <summary>Оригинальные ответы</summary>
        {n.responses.map((r, i) => (
          <pre key={i}>{r}</pre>
        ))}
      </details>
      {n.error && <p>{n.error}</p>}
    </article>
  );
}
function Settings({
  view,
  invoke,
  disabled,
}: {
  view: DesktopView;
  invoke: Invoke;
  disabled: boolean;
}) {
  const w = view.workspace,
    [settings, setSettings] = useState(w.settings),
    [model, setModel] = useState(w.runtime.model);
  return (
    <div className="settings-grid">
      <section className="desktop-panel">
        <p className="eyebrow">01 · ЛОКАЛЬНАЯ МОДЕЛЬ</p>
        <h2>Gemma на вашем компьютере</h2>
        <p>
          Выберите уже установленный Ollama и папку его моделей. Скачивание не запускается. Клуб
          использует отдельный локальный процесс и освобождает его на паузе.
        </p>
        <label>
          Ollama
          <button
            disabled={disabled}
            onClick={() => {
              void invoke({ op: 'pickExecutable' });
            }}
          >
            Выбрать ollama.exe…
          </button>
          <span className="path-text">{w.runtime.executable || 'Пока не выбран'}</span>
        </label>
        <label>
          Модели
          <button
            disabled={disabled}
            onClick={() => {
              void invoke({ op: 'pickModels' });
            }}
          >
            Выбрать папку моделей…
          </button>
          <span className="path-text">{w.runtime.models || 'Пока не выбрана'}</span>
        </label>
        <label>
          Модель
          <select value={model} onChange={(e) => setModel(e.target.value as typeof model)}>
            <option value="gemma3:4b">Gemma 3 4B · начальный кандидат</option>
            <option value="gemma3:1b">Gemma 3 1B · меньше, качество слабее</option>
          </select>
        </label>
        <button
          disabled={disabled}
          onClick={() => {
            void invoke({ op: 'connect' });
          }}
        >
          Проверить установленную модель
        </button>
        {view.model.checkedAt && (
          <p>
            Модель найдена · {shortDate(view.model.checkedAt)}
            <br />
            <small>
              Версия: {view.model.digest.slice(0, 16)}… · проверка установки не оценивает качество
              идей.
            </small>
          </p>
        )}
      </section>
      <section className="desktop-panel">
        <p className="eyebrow">02 · РИТМ И ПРЕДЕЛЫ</p>
        <h2>Немного идей за раз</h2>
        <label>
          Интервал между заданиями
          <select
            value={settings.intervalMinutes}
            onChange={(e) => setSettings({ ...settings, intervalMinutes: Number(e.target.value) })}
          >
            {[15, 30, 60, 120, 240].map((n) => (
              <option value={n} key={n}>
                {n} минут
              </option>
            ))}
          </select>
        </label>
        <label>
          Максимум вызовов в день
          <input
            type="number"
            min={1}
            max={24}
            value={settings.dailyCalls}
            onChange={(e) => setSettings({ ...settings, dailyCalls: Number(e.target.value) })}
          />
        </label>
        <small>Ошибки, отменённые вызовы и исправления также учитываются.</small>
        <label>
          Сколько новых идей ждать разбора
          <input
            type="number"
            min={1}
            max={20}
            value={settings.backlog}
            onChange={(e) => setSettings({ ...settings, backlog: Number(e.target.value) })}
          />
        </label>
        <label>
          Язык результатов
          <select
            value={settings.language}
            onChange={(e) => setSettings({ ...settings, language: e.target.value as 'en' | 'ru' })}
          >
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>
        </label>
        <label>
          Использовать только тег
          <input
            maxLength={30}
            value={settings.tag}
            onChange={(e) => setSettings({ ...settings, tag: e.target.value })}
            placeholder="Любой участвующий источник"
          />
        </label>
        <button
          className="primary"
          disabled={disabled}
          onClick={() => {
            void invoke({ op: 'settings', ...settings, model });
          }}
        >
          Сохранить настройки и поставить на паузу
        </button>
        <label className="check">
          <input
            type="checkbox"
            checked={view.autostart}
            onChange={(e) => {
              void invoke({ op: 'autostart', enabled: e.target.checked });
            }}
          />
          Запускать вместе с Windows
        </label>
        <small>После запуска и сна сад всегда на паузе.</small>
      </section>
      <section className="desktop-panel">
        <p className="eyebrow">03 · ЭКСПОРТ ДЛЯ CODEX</p>
        <h2>Результаты под рукой</h2>
        <p>
          Клуб обновляет обычные файлы. Подключите эту папку к локальному проекту Codex и попросите
          прочитать новые идеи. Заметки сохраняйте в analysis/.
        </p>
        <button
          disabled={disabled}
          onClick={() => {
            void invoke({ op: 'pickExport' });
          }}
        >
          Выбрать пустую папку экспорта…
        </button>
        <p className="path-text">{w.exportDirectory || 'Папка пока не выбрана'}</p>
        <label>
          Что включать
          <select
            value={settings.exportScope}
            onChange={(e) =>
              setSettings({ ...settings, exportScope: e.target.value as 'kept' | 'all' })
            }
          >
            <option value="kept">Только сохранённые идеи</option>
            <option value="all">Все кандидаты с отметкой статуса</option>
          </select>
        </label>
        <small>
          Выбор применяется кнопкой «Сохранить настройки». Полные исходники и сырые ответы модели
          сюда не попадают.
        </small>
        <div className="review-actions">
          <button
            disabled={disabled || !w.exportDirectory}
            onClick={() => {
              void invoke({ op: 'export' });
            }}
          >
            Обновить экспорт
          </button>
          <button
            disabled={!w.exportDirectory}
            onClick={() => {
              void invoke({ op: 'openExport' });
            }}
          >
            Открыть папку
          </button>
        </div>
        <p>
          {view.exportStatus
            ? `${view.exportStatus.count} карточек · ${shortDate(view.exportStatus.at)}`
            : 'Полный снимок ещё не опубликован.'}
        </p>
        <button
          disabled={disabled || !w.exportDirectory}
          onClick={() => {
            void invoke({ op: 'cleanupExports' });
          }}
        >
          Просмотреть удаление старых снимков…
        </button>
      </section>
      <section className="desktop-panel">
        <p className="eyebrow">04 · СОХРАННОСТЬ</p>
        <h2>Резервные копии</h2>
        <p>
          Полный бэкап содержит частные исходники и оригинальные ответы модели. Храните его отдельно
          от папки для Codex.
        </p>
        <div className="review-actions">
          <button
            disabled={disabled}
            onClick={() => {
              void invoke({ op: 'backup' });
            }}
          >
            Сохранить полный бэкап…
          </button>
          <button
            disabled={disabled}
            onClick={() => {
              void invoke({ op: 'restore' });
            }}
          >
            Восстановить с предпросмотром…
          </button>
          <button
            onClick={() => {
              void invoke({ op: 'openData' });
            }}
          >
            Открыть папку данных
          </button>
        </div>
        <p className="path-text">{view.dataDirectory}</p>
        <details>
          <summary>Сохранённые копии: {view.backups.length}</summary>
          {view.backups.map((b) => (
            <div className="backup-row" key={b.id}>
              <span>
                {shortDate(b.at)} · {(b.bytes / 1024).toFixed(0)} КБ · {b.reason}
              </span>
              <button
                disabled={disabled}
                onClick={() => {
                  void invoke({ op: 'purgeBackup', id: b.id, sha: b.sha });
                }}
              >
                Удалить…
              </button>
            </div>
          ))}
        </details>
        <details>
          <summary>Оригинальные импортированные файлы: {w.files.length}</summary>
          {w.files.map((f) => (
            <div className="backup-row" key={f.id}>
              <span>{f.name}</span>
              <button
                disabled={disabled}
                onClick={() => {
                  void invoke({ op: 'purgeOriginal', id: f.id });
                }}
              >
                Удалить оригинал…
              </button>
            </div>
          ))}
        </details>
        <p>{view.receiptCount} записей исходных ответов в частном журнале.</p>
      </section>
    </div>
  );
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<DesktopApp />);
