import { isRemote } from '../domain/coherent/provider';
import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { CoherentAPI, CoherentCommand, CoherentView } from '../../desktop/coherent-types';
import { backgroundReason, counts, credit, INTERVALS } from '../domain/coherent/workspace';
import { current, identity, prepare } from '../domain/coherent/prepare';
import { explain, funnel, jobTitle, label, modelReason } from '../domain/coherent/presentation';
import {
  DIRECTIONS,
  type Candidate,
  type Identity,
  type Job,
  type Node,
  type Source,
  type Workspace,
} from '../domain/coherent/types';
import { Modal } from '../ui/Modal';
import { Author } from '../ui/Author';
import licences from '../../public/THIRD_PARTY_LICENSES.txt?raw';
import golos from './fonts/GolosText-OFL.txt?raw';
import literata from './fonts/Literata-OFL.txt?raw';
import '../styles.css';
import './style.css';
declare global {
  interface Window {
    compost: CoherentAPI;
  }
}
type Send = (c: CoherentCommand) => Promise<void>;
const when = (n: number) => new Date(n).toLocaleString('ru-RU');
const val = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' ? v : '';
};
const all = (f: FormData, k: string) =>
  f.getAll(k).filter((v): v is string => typeof v === 'string');
const profiles = {
  unknown: 'Тип неизвестен',
  game: 'Игра',
  application: 'Приложение / инструмент',
  story: 'Книга / история',
  custom: 'Свой формат',
};
function evidenceMode(w: Workspace, n: Node) {
  const r = n.revisions.at(-1)!,
    j = w.jobs.find((j) => j.id === (r.job ?? n.job));
  return n.recorded
    ? 'Записанный публичный результат · без новой генерации'
    : r.origin === 'imported assertion' || (!r.job && n.imported) || j?.observed === false
      ? 'Импортированное; происхождение не подтверждено новым локальным запуском'
      : j?.observed
        ? isRemote(j.provider)
          ? 'Удалённая генерация · ' + j.provider!.kind + ' · ' + j.model
          : 'Сгенерировано на этом компьютере'
        : 'Прежняя карточка · новая проверка ещё не проводилась';
}
function Form({ children, submit }: { children: ReactNode; submit: (f: FormData) => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget));
      }}
    >
      {children}
    </form>
  );
}
function Field({
  label,
  name,
  v = '',
  type = 'text',
}: {
  label: string;
  name: string;
  v?: string | number;
  type?: string;
}) {
  return (
    <label>
      {label}
      <input aria-label={label} name={name} defaultValue={v} type={type} />
    </label>
  );
}
function Area({ label, name, v = '' }: { label: string; name: string; v?: string }) {
  return (
    <label>
      {label}
      <textarea aria-label={label} name={name} defaultValue={v} rows={4} />
    </label>
  );
}
function Check({
  label,
  name,
  v = 'on',
  on = false,
}: {
  label: string;
  name: string;
  v?: string;
  on?: boolean;
}) {
  return (
    <label className="check">
      <input type="checkbox" name={name} value={v} defaultChecked={on} />
      {label}
    </label>
  );
}
function ProfileSelect({ v }: { v: string }) {
  return (
    <label>
      Тип сада
      <select name="profile" defaultValue={v}>
        {Object.entries(profiles).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
}
function Context({ w, g, parents }: { w: Workspace; g: string; parents: Identity[] }) {
  try {
    const p = prepare(w, g, parents);
    return (
      <>
        <p>
          {p.inputUpperBound} UTF-8 байт как верхняя граница токенов; точный tokenizer не
          установлен. Место для оформления и ответа зарезервировано; оригиналы не обрезаются.
        </p>
        <pre>{p.payload}</pre>
        <p>SHA-256 {p.hash}</p>
        <pre>{JSON.stringify(p.omissions, null, 2)}</pre>
      </>
    );
  } catch (e) {
    return <p role="status">{String(e)}</p>;
  }
}

function App() {
  const [view, setView] = useState<CoherentView | null>(null),
    [error, setError] = useState(''),
    [selected, setSelected] = useState(''),
    [tab, setTab] = useState('sources'),
    [modal, setModal] = useState<ReactNode>(null),
    [source, setSource] = useState<string | null>(null),
    [node, setNode] = useState<string | null>(null),
    [grow, setGrow] = useState<Identity[] | null>(null),
    [picked, setPicked] = useState<string[]>([]),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('pending');
  const [drafts, setDrafts] = useState<
    Record<string, { title: string; text: string; tags: string }>
  >({});
  const eurekaPending = useRef(false);
  const [sendingEureka, setSendingEureka] = useState(false);
  const send = useCallback(async (c: CoherentCommand) => {
    setError('');
    try {
      const n = await window.compost.invoke(c);
      setView(n);
      if (n.error) setError(n.error);
    } catch (e) {
      setError(String(e));
    }
  }, []);
  useEffect(() => {
    void send({ op: 'snapshot' });
    return window.compost.subscribe(setView);
  }, [send]);
  useEffect(() => {
    const add = () => {
      setTab('sources');
      document.getElementById('source-text')?.focus();
    };
    window.addEventListener('compost:add-idea', add);
    return () => window.removeEventListener('compost:add-idea', add);
  }, []);
  useEffect(() => {
    for (const r of view?.workspace.requests ?? []) {
      const storageKey = 'compost-eureka-' + r.garden;
      if (
        ['blocked', 'settled', 'uncertain'].includes(r.state) &&
        localStorage.getItem(storageKey) === r.id
      )
        localStorage.removeItem(storageKey);
    }
  }, [view]);
  useEffect(() => {
    const toolbar = document.querySelector('.global-toolbar');
    if (!toolbar) return;
    const observer = new ResizeObserver(() =>
      document.documentElement.style.setProperty(
        '--toolbar-height',
        toolbar.getBoundingClientRect().height + 'px',
      ),
    );
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, [!!view]);
  if (!view)
    return (
      <main>
        <p role="status">Открываем локальный сад…</p>
      </main>
    );
  const w = view.workspace,
    g = w.gardens.find((g) => g.id === selected) ?? w.gardens[0]!,
    count = counts(w, Date.now()),
    sources = w.sources.filter((s) => s.garden === g.id),
    nodes = w.nodes.filter((n) => n.garden === g.id),
    jobs = w.jobs.filter((j) => j.garden === g.id),
    draft = drafts[g.id] ?? { title: '', text: '', tags: '' },
    flow = funnel(w, g.id),
    eurekaReason = explain(view.eureka.find((e) => e.garden === g.id)?.reason ?? ''),
    activeJob = w.jobs.find((j) => j.id === view.activeJob),
    activeGarden = w.gardens.find((g) => g.id === activeJob?.garden),
    stopping = view.status === 'pausing',
    canPause = view.busy || !w.paused,
    resumeBlocked =
      !canPause &&
      (isRemote(w.provider) || view.status === 'attention' || !w.gardens.some((g) => g.background)),
    statusText = stopping
      ? isRemote(w.provider)
        ? 'Останавливаем ожидание и следующие вызовы…'
        : 'Останавливаем работу и освобождаем модель…'
      : view.status === 'attention'
        ? explain(view.reason)
        : activeJob
          ? `${label(activeJob.stage)} для сада «${activeGarden?.name}»`
          : w.paused
            ? 'Автозапуск на паузе'
            : g.background
              ? explain(backgroundReason(w, g.id, Date.now()))
              : `Сад «${g.name}» не включён в расписание`;
  const eureka = async () => {
    if (isRemote(w.provider)) {
      await send({ op: 'eureka', garden: g.id, requestId: crypto.randomUUID() });
      return;
    }
    if (eurekaPending.current) return;
    eurekaPending.current = true;
    setSendingEureka(true);
    const storageKey = 'compost-eureka-' + g.id;
    const pendingId = localStorage.getItem(storageKey);
    const requestId = pendingId ?? crypto.randomUUID();
    if (!pendingId) localStorage.setItem(storageKey, requestId);
    try {
      const result = await window.compost.invoke(
        pendingId ? { op: 'requestState', requestId } : { op: 'eureka', garden: g.id, requestId },
      );
      setView(result);
      if (result.error) setError(result.error);
      const r = result.workspace.requests?.find((r) => r.id === requestId);
      if (r?.reason) setError(r.reason);
    } catch (e) {
      setError(
        'Ответ на команду не получен. Повторное нажатие проверит состояние того же запроса. ' +
          String(e),
      );
    } finally {
      eurekaPending.current = false;
      setSendingEureka(false);
    }
  };
  const update = (field: 'title' | 'text' | 'tags', v: string) =>
    setDrafts((d) => ({ ...d, [g.id]: { ...draft, [field]: v } }));
  const dialog = (title: string, body: ReactNode) =>
    setModal(
      <Modal title={title} onClose={() => setModal(null)}>
        {body}
      </Modal>,
    );
  const gardenSettings = () =>
    dialog(
      'Настроить сад',
      <Form
        submit={(f) => {
          void send({
            op: 'gardenSettings',
            id: g.id,
            profile: val(f, 'profile'),
            objective: val(f, 'objective'),
            interval: Number(val(f, 'interval')),
          });
          setModal(null);
        }}
      >
        <ProfileSelect v={g.profile} />
        <Area label="Цель и ограничения сада" name="objective" v={g.objective} />
        <label>
          Попытка каждые
          <select name="interval" defaultValue={g.interval}>
            {INTERVALS.map((n) => (
              <option key={n} value={n}>
                {n} мин
              </option>
            ))}
          </select>
        </label>
        <p>
          Изменение приостанавливает фон этого сада. Ручной запрос разрешает только одно
          ограниченное задание.
        </p>
        <button className="primary">Сохранить</button>
      </Form>,
    );
  const exchange = () =>
    dialog(
      'Обмен между садами',
      <Form
        submit={(f) => {
          void send({
            op: 'exchange',
            id: g.id,
            probability: Number(val(f, 'probability')),
            donate: f.has('donate'),
            donors: all(f, 'donors'),
          });
          setModal(null);
        }}
      >
        <p>
          Одна исходная идея остаётся из принимающего сада, вторая может быть из разрешённого
          донора. Оригинал не перемещается. 10% — вероятность маршрута попытки, а не гарантия
          результата.
        </p>
        <Field
          label="Вероятность 0–100%, предложение: 10%"
          name="probability"
          v={g.policy.probability}
          type="number"
        />
        <Check label="Разрешить этому саду быть донором" name="donate" on={g.policy.donate} />
        <fieldset>
          <legend>Разрешённые доноры</legend>
          {w.gardens
            .filter((d) => d.id !== g.id)
            .map((d) => (
              <Check
                key={d.id}
                label={d.name + (d.policy.donate ? ' · разрешён' : ' · донор выключен')}
                name="donors"
                v={d.id}
                on={g.policy.donors.includes(d.id)}
              />
            ))}
        </fieldset>
        <button>Проверить и подтвердить</button>
      </Form>,
    );
  const pair = () => {
    const parents = picked.map((id) => identity(w.sources.find((s) => s.id === id)!));
    dialog(
      'Контекст выбранной пары',
      <>
        <Context w={w} g={g.id} parents={parents} />
        <button
          onClick={() => {
            void send({ op: 'run', garden: g.id, parents });
            setModal(null);
          }}
        >
          Начать одну попытку
        </button>
      </>,
    );
  };
  return (
    <div className="desktop-app coherent-app">
      <div className="global-toolbar" aria-label="Управление приложением">
        <div className="toolbar-state">
          <strong>Выбран сад: {g.name}</strong>
          <small>
            {activeJob?.provider?.requestedModel ??
              view.provider?.requestedModel ??
              w.runtime.model}{' '}
            · {activeJob?.provider?.kind ?? view.provider?.kind ?? 'local'}
            {isRemote(w.provider) ? ' · ручная внешняя отправка' : ''}
          </small>
          <p role="status" aria-live="polite">
            {statusText}
          </p>
          {w.paused && activeJob && <small>Автозапуск на паузе · выполняется разовая работа</small>}
        </div>
        <div className="toolbar-commands">
          <button
            aria-describedby="global-command-hint"
            disabled={stopping || resumeBlocked}
            onClick={() => void send({ op: canPause ? 'pause' : 'resume' })}
          >
            {stopping ? 'Останавливаем…' : canPause ? 'Пауза' : 'Продолжить'}
          </button>
          <button
            className="primary"
            aria-describedby="eureka-hint"
            disabled={!!eurekaReason || sendingEureka}
            onClick={() => void eureka()}
          >
            Эврика
          </button>
        </div>
        <div className="toolbar-hints">
          <small id="global-command-hint">
            {isRemote(w.provider)
              ? 'Внешняя обработка только вручную. Отмена не гарантирует остановку сервера или возврат квоты.'
              : resumeBlocked
                ? view.status === 'attention'
                  ? 'Устраните причину в настройках перед продолжением.'
                  : 'Выберите сады для расписания в настройках сада.'
                : canPause
                  ? 'Остановить работу во всех садах и освободить модель.'
                  : 'Продолжить расписание ранее включённых садов.'}
          </small>
          <small id="eureka-hint">
            {eurekaReason ||
              `Одна попытка прямо сейчас для сада «${g.name}». Автозапуск не включается.`}
          </small>
        </div>
      </div>
      <aside className="desktop-sidebar">
        <div className="desktop-brand">
          <img src="./garden-icon.svg" width="42" height="42" alt="" />
          <div>
            <strong>Compost Club</strong>
            <small>Тихий сад новых идей</small>
          </div>
        </div>
        <label>
          Ваши сады
          <select
            aria-label="Ваши сады"
            value={g.id}
            onChange={(e) => {
              setSelected(e.target.value);
              setPicked([]);
            }}
          >
            {w.gardens.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <div className="actions">
          <button
            disabled={w.gardens.length >= 4}
            onClick={() =>
              dialog(
                'Новый сад',
                <Form
                  submit={(f) => {
                    void send({
                      op: 'createGarden',
                      name: val(f, 'name'),
                      profile: val(f, 'profile'),
                    });
                    setModal(null);
                  }}
                >
                  <Field label="Название сада" name="name" />
                  <ProfileSelect v="unknown" />
                  <button>Создать сад</button>
                </Form>,
              )
            }
          >
            Создать сад
          </button>
          <button
            onClick={() =>
              dialog(
                'Название сада',
                <Form
                  submit={(f) => {
                    void send({ op: 'renameGarden', id: g.id, name: val(f, 'name') });
                    setModal(null);
                  }}
                >
                  <Field label="Название сада" name="name" v={g.name} />
                  <button>Переименовать</button>
                </Form>,
              )
            }
          >
            Переименовать сад
          </button>
        </div>
        <nav aria-label="Разделы сада">
          {[
            ['sources', 'Исходные идеи'],
            ['references', 'Референсы и ДНК'],
            ['review', 'На просмотр'],
            ['filtered', 'Черновики'],
            ['growth', 'Развитие'],
            ['journal', 'Журнал'],
            ['settings', 'Настройки'],
            ['about', 'Об авторе'],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id!)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-end">
          <p>
            v0.2 · экспериментальный профиль
            <br />
            Локальное хранение · внешняя обработка по выбору
          </p>
          <button onClick={() => void send({ op: 'backup' })}>Полная приватная копия</button>
          <button onClick={() => void send({ op: 'restore' })}>Восстановить с просмотром</button>
        </div>
      </aside>
      <main className="desktop-main">
        {view.remotePreview && (
          <Modal
            title={
              'Передача контекста ' +
              (view.remotePreview.provider.kind === 'claude' ? 'Claude' : 'Groq')
            }
            onClose={() => void send({ op: 'cancelRemote' })}
          >
            <p>
              Получатель: {view.remotePreview.provider.endpoint}. Модель:{' '}
              {view.remotePreview.provider.requestedModel}.
            </p>
            <p>
              Одно задание: генерация и проверка нового черновика, максимум{' '}
              {view.remotePreview.calls} вызова, включая единственный общий ремонт формата. Будущий
              черновик будет отправлен тому же провайдеру для проверки. Нет автоматического повтора
              или переключения.
            </p>
            <p>
              Донорские сады:{' '}
              {view.remotePreview.donorGardens
                .map((id) => w.gardens.find((g) => g.id === id)?.name ?? id)
                .join(', ') || 'нет'}
              . Согласие на локальное донорство отдельно от разрешения этой отправки.
            </p>
            <h3>Выбранные тексты</h3>
            {view.remotePreview.objective && <p>Цель: {view.remotePreview.objective}</p>}
            {view.remotePreview.sections.map((section, index) => (
              <section key={index}>
                <h4>{section.title}</h4>
                <p style={{ whiteSpace: 'pre-wrap' }}>{section.text}</p>
              </section>
            ))}
            <details>
              <summary>Точный сериализованный контекст</summary>
              <pre>{view.remotePreview.context}</pre>
            </details>
            {view.remotePreview.draft && (
              <details open>
                <summary>Точный сохранённый черновик для проверки</summary>
                <pre>{JSON.stringify(view.remotePreview.draft, null, 2)}</pre>
              </details>
            )}
            <details>
              <summary>Инструкция модели</summary>
              <pre>{view.remotePreview.prompt}</pre>
            </details>
            <p>
              Контекст обрабатывает внешний сервис по своим условиям хранения. Отмена прекращает
              ожидание и следующие вызовы; уже отправленные данные и расход квоты нельзя
              гарантированно отозвать.
            </p>
            <button
              className="primary"
              onClick={() =>
                void send({ op: 'confirmRemote', previewId: view.remotePreview!.id, consent: true })
              }
            >
              Разрешить эту отправку и начать
            </button>
            <button onClick={() => void send({ op: 'cancelRemote' })}>Отмена</button>
          </Modal>
        )}
        <header className="garden-header">
          <div>
            <p className="eyebrow">ВАШ ЛОКАЛЬНЫЙ САД</p>
            <h1>{g.name}</h1>
            <p>{profiles[g.profile]} · соберите исходные идеи и выберите, что развивать</p>
          </div>
          <div className="actions">
            <button onClick={gardenSettings}>Настроить сад</button>
            <button onClick={exchange}>Обмен · {g.policy.probability}%</button>
          </div>
        </header>
        <section className="rhythm" aria-label="Ритм сада">
          <strong>Ритм сада «{g.name}»</strong>
          <p>
            {g.background
              ? `В расписании · интервал ${g.interval} минут`
              : 'Только разовые попытки. Участие в расписании можно включить ниже.'}
          </p>
          <details>
            <summary>Технические подробности состояния</summary>
            <pre>{view.reason}</pre>
          </details>
          {view.activeJob && (
            <p>
              Задание относится к саду{' '}
              {
                w.gardens.find((g) => g.id === w.jobs.find((j) => j.id === view.activeJob)?.garden)
                  ?.name
              }
              ; переключение экрана не меняет цель.
            </p>
          )}
          <div className="rhythm-counts">
            <span>
              Попытка каждые <button onClick={gardenSettings}>{g.interval} мин</button>
            </span>
            <span>
              Попыток {count.attempts}/{w.settings.attempts}
            </span>
            <span>
              Новых карточек {count.candidates}/{w.settings.candidates}
            </span>
            <span>
              Вызовов {count.calls}/{w.settings.calls}, резерв {count.held}
            </span>
            <span>
              На просмотр {count.pending}/{w.settings.backlog}
            </span>
            <span>
              Слотов {credit(w, g.id, Date.now())}/{g.credits.cap ?? 3}
            </span>
          </div>
          <p>
            Попытка может не дать кандидата. Включены сады:{' '}
            {w.gardens
              .filter((g) => g.background)
              .map((g) => g.name)
              .join(', ') || 'нет'}
            . Следующий срок: {when(g.nextAt)}.
          </p>
          <div className="actions">
            <label className="check">
              <input
                type="checkbox"
                checked={g.background}
                onChange={(e) =>
                  void send({ op: 'background', id: g.id, enabled: e.target.checked })
                }
              />
              Включать этот сад в расписание
            </label>
            <button onClick={() => setTab('settings')}>Лимиты за день</button>
            {view.status === 'attention' && (
              <button onClick={() => void send({ op: 'clearAttention' })}>
                Я проверил причины
              </button>
            )}
          </div>
          {g.plan && (
            <p>
              Маршрут: {label(g.plan.route)}. {explain(g.plan.reason)}{' '}
              <button onClick={() => void send({ op: 'localOverride', id: g.id })}>
                Отменить маршрут и выбрать локальную пару
              </button>
            </p>
          )}
        </section>
        {error && (
          <div role="alert" className="error">
            <p>{explain(error)}</p>
            <details>
              <summary>Точная причина</summary>
              <pre>{error}</pre>
            </details>
            <button onClick={() => setError('')}>Закрыть сообщение</button>
          </div>
        )}
        {tab === 'sources' && (
          <>
            <section className="panel">
              <h2>Добавьте то, чему ещё предстоит вырасти</h2>
              <p>Оригинал останется целиком. Сохранение и импорт не вызывают модель.</p>
              <Form
                submit={(f) => {
                  void send({
                    op: 'add',
                    garden: g.id,
                    ...draft,
                    participating: f.has('participating'),
                  });
                }}
              >
                <label>
                  Название
                  <input
                    maxLength={120}
                    value={draft.title}
                    onChange={(e) => update('title', e.target.value)}
                  />
                </label>
                <label>
                  Полный текст идеи
                  <textarea
                    id="source-text"
                    aria-label="Полный текст идеи"
                    value={draft.text}
                    onChange={(e) => update('text', e.target.value)}
                    rows={4}
                  />
                </label>
                <label>
                  Теги через запятую
                  <input
                    list="recent-tags"
                    value={draft.tags}
                    onChange={(e) => update('tags', e.target.value)}
                  />
                </label>
                <datalist id="recent-tags">
                  {[...new Set(sources.flatMap((s) => s.tags))].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </datalist>
                <Check label="Разрешить использовать эту идею в парах" name="participating" />
                <div className="actions">
                  <button className="primary">Добавить исходную идею</button>
                  <button
                    type="button"
                    onClick={() => void send({ op: 'chooseImport', garden: g.id })}
                  >
                    Выбрать локальные файлы
                  </button>
                  <button
                    type="button"
                    onClick={() => void send({ op: 'pasteImport', garden: g.id, text: draft.text })}
                  >
                    Предпросмотр импорта текста
                  </button>
                </div>
              </Form>
            </section>
            <section className="panel">
              <div className="section-heading">
                <h2>Исходные идеи · {sources.length}/200</h2>
                <button disabled={picked.length !== 2 || view.busy} onClick={pair}>
                  Контекст выбранной пары
                </button>
                <button
                  onClick={() =>
                    dialog(
                      'Ручная пара из двух садов',
                      <Form
                        submit={(f) => {
                          if (
                            ![val(f, 'receiver'), val(f, 'donor')].every(
                              (id) => id && w.sources.some((s) => s.id === id),
                            )
                          ) {
                            setError('Выберите источник принимающего сада и разрешённого донора.');
                            return;
                          }
                          const parents = [val(f, 'receiver'), val(f, 'donor')].map((id) =>
                            identity(w.sources.find((s) => s.id === id)!),
                          );
                          dialog(
                            'Контекст ручного обмена',
                            <>
                              <Context w={w} g={g.id} parents={parents} />
                              <button
                                onClick={() => {
                                  void send({ op: 'run', garden: g.id, parents });
                                  setModal(null);
                                }}
                              >
                                Начать одну ручную пару
                              </button>
                            </>,
                          );
                        }}
                      >
                        <p>
                          Явный выбор маршрута; результат не объявляется вероятностным выпадением.
                        </p>
                        <label>
                          Источник принимающего сада
                          <select name="receiver">
                            {sources
                              .filter((s) => s.participating && !s.sample)
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {current(s).title}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Источник разрешённого донора
                          <select name="donor">
                            {w.sources
                              .filter(
                                (s) =>
                                  s.garden !== g.id &&
                                  s.participating &&
                                  !s.sample &&
                                  g.policy.donors.includes(s.garden) &&
                                  w.gardens.find((g) => g.id === s.garden)?.policy.donate,
                              )
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {w.gardens.find((g) => g.id === s.garden)?.name} ·{' '}
                                  {current(s).title}
                                </option>
                              ))}
                          </select>
                        </label>
                        <button>Посмотреть контекст перед вызовом</button>
                      </Form>,
                    )
                  }
                >
                  Ручная пара из двух садов
                </button>
              </div>
              <label>
                Поиск
                <input value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              <div className="card-grid">
                {sources
                  .filter((s) =>
                    (current(s).title + ' ' + current(s).text)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((s) => (
                    <article className="source-card" key={s.id}>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={picked.includes(s.id)}
                          onChange={(e) =>
                            setPicked((ids) =>
                              e.target.checked
                                ? [...ids, s.id].slice(-2)
                                : ids.filter((id) => id !== s.id),
                            )
                          }
                        />
                        Выбрать для ручной пары
                      </label>
                      <h3>{current(s).title || 'Без названия'}</h3>
                      <p className="preview">{current(s).text}</p>
                      <small>
                        {s.tags.join(' · ')} · v{current(s).revision} · {when(current(s).entry.at)}
                      </small>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={s.participating}
                          onChange={(e) =>
                            void send({ op: 'participate', id: s.id, value: e.target.checked })
                          }
                        />
                        Участвует в парах
                      </label>
                      <div className="actions">
                        <button onClick={() => setSource(s.id)}>Читать оригинал и контекст</button>
                        <button onClick={() => setGrow([identity(s)])}>
                          Развить выбранный корень
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
              {!sources.length && (
                <p>Добавьте две исходные идеи для пары или одну для выбранного корня развития.</p>
              )}
            </section>
          </>
        )}
        {tab === 'references' && (
          <section className="panel">
            <h2>ДНК, референсы и правила</h2>
            <p>
              Поля имеют происхождение и отдельное одобрение. Название произведения и непрочитанная
              ссылка не доказывают его свойства.
            </p>
            {sources.map((s) => (
              <p key={s.id}>
                <button onClick={() => setSource(s.id)}>
                  {current(s).title || 'Без названия'} · {current(s).preparation.facets.length}{' '}
                  полей · {current(s).preparation.references.length} референсов
                </button>
              </p>
            ))}
            <h3>Одобренные предпочтения</h3>
            <p>
              Только одобренные и включённые правила входят в новые выбранные запросы. Это контекст,
              не обучение весов.
            </p>
            {w.preferences
              .filter((p) => p.garden === g.id || p.garden === null)
              .map((p) => (
                <Form
                  key={p.id + p.revision}
                  submit={(f) =>
                    void send({
                      op: 'preference',
                      id: p.id,
                      garden: p.garden,
                      text: val(f, 'text'),
                      approved: f.has('approved'),
                      enabled: f.has('enabled'),
                      reviews: p.reviews,
                    })
                  }
                >
                  <Area label={label(p.origin) + ' · v' + p.revision} name="text" v={p.text} />
                  <Check label="Одобрено" name="approved" on={p.approved} />
                  <Check label="Включено" name="enabled" on={p.enabled} />
                  <button>Сохранить ревизию правила</button>
                </Form>
              ))}
            <Form
              submit={(f) =>
                void send({
                  op: 'preference',
                  garden: f.has('workspace') ? null : g.id,
                  text: val(f, 'text'),
                  approved: f.has('approved'),
                  enabled: f.has('enabled'),
                  reviews: [],
                })
              }
            >
              <Area label="Новое правило вручную" name="text" />
              <Check label="Одобрено" name="approved" />
              <Check label="Включено" name="enabled" />
              <Check label="Для всех садов" name="workspace" />
              <button>Добавить правило</button>
            </Form>
            <h3>Предложить правила из выбранных отзывов</h3>
            <Form
              submit={(f) =>
                void send({ op: 'proposePreferences', garden: g.id, reviews: all(f, 'reviews') })
              }
            >
              {nodes.flatMap((n) =>
                n.decisions
                  .filter((d) => d.note)
                  .map((d) => <Check key={d.id} label={d.note} name="reviews" v={d.id} />),
              )}
              <button disabled={view.busy}>Один локальный вызов предложений</button>
            </Form>
          </section>
        )}
        {tab === 'review' && (
          <section className="panel">
            <div className="section-heading">
              <h2>Идеи на просмотр</h2>
              <label>
                Показать
                <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="pending">Новые и отложенные</option>
                  <option value="kept">Сохранённые</option>
                  <option value="all">Все решения</option>
                </select>
              </label>
            </div>
            <p>
              Прочитайте идею и её исходники, затем решите: сохранить, отложить или отклонить.
              Проверка модели помогает заметить проблемы; полезность оцениваете вы.
            </p>
            {!nodes.some(
              (n) =>
                filter === 'all' ||
                (filter === 'kept'
                  ? n.accepted
                  : ['new', 'later'].includes(n.decisions.at(-1)?.state ?? 'new')),
            ) && (
              <div className="empty-state">
                <h3>Здесь пока нет идей для выбранного списка</h3>
                <p>
                  В этом саду: {flow.attempts} новых попыток, {flow.drafts} сохранённых черновиков,{' '}
                  {flow.dispatched} отправленных проверок.{' '}
                  {w.paused ? 'Автозапуск на паузе.' : `Следующая попытка: ${when(g.nextAt)}.`}
                </p>
                <button onClick={() => setTab('filtered')}>Посмотреть черновики и причины</button>
              </div>
            )}
            <div className="card-grid">
              {nodes
                .filter(
                  (n) =>
                    filter === 'all' ||
                    (filter === 'kept' && n.accepted) ||
                    (filter === 'pending' &&
                      ['new', 'later'].includes(n.decisions.at(-1)?.state ?? 'new')),
                )
                .map((n) => (
                  <article className="source-card" key={n.id}>
                    <small>
                      {evidenceMode(w, n)} ·{' '}
                      {n.revisions.at(-1)!.origin === 'user-authored' ? 'изменено человеком' : ''} ·{' '}
                      {label(n.decisions.at(-1)?.state)}
                    </small>
                    <h3>{n.revisions.at(-1)!.content.title}</h3>
                    <p className="preview">{n.revisions.at(-1)!.content.summary}</p>
                    <button onClick={() => setNode(n.id)}>Читать, сравнить и решить</button>
                  </article>
                ))}
            </div>
          </section>
        )}
        {tab === 'filtered' && (
          <section className="panel">
            <h2>Черновики и остановки</h2>
            <p>
              Здесь остаются черновики с замечаниями, отрицательные ответы и прерванные попытки.
              Откройте текст или проверьте его заново. За неудачную попытку слот не списывается;
              выполненные вызовы модели учтены.
            </p>
            {jobs
              .filter((j) =>
                [
                  'needs_revision',
                  'needs_context',
                  'failed',
                  'interrupted',
                  'negative',
                  'cancelled',
                ].includes(j.stage),
              )
              .map((j) => (
                <JobCard key={j.id} j={j} send={send} busy={view.busy} />
              ))}
            {!jobs.some((j) =>
              [
                'needs_revision',
                'needs_context',
                'failed',
                'interrupted',
                'negative',
                'cancelled',
              ].includes(j.stage),
            ) && (
              <p className="empty-state">
                Остановленных черновиков пока нет. «Эврика» начнёт одну попытку для этого сада,
                когда исходные идеи будут подготовлены.
              </p>
            )}
          </section>
        )}
        {tab === 'growth' && (
          <section className="panel">
            <h2>Развитие и альтернативы</h2>
            <p>
              Рост отражает принятые человеком шаги. Два родителя смешивания остаются двумя
              родителями в графе.
            </p>
            <ol aria-label="Контур развития">
              {nodes.map((n) => (
                <li key={n.id}>
                  <button onClick={() => setNode(n.id)}>
                    {n.kind === 'growth' ? '↳ ' : '🌱 '}
                    {n.revisions.at(-1)!.content.title}
                  </button>{' '}
                  ·{' '}
                  {n.accepted
                    ? 'принято'
                    : n.creditHeld
                      ? 'предложение, слот удерживается'
                      : label(n.decisions.at(-1)?.state)}
                  <p>
                    Родители:{' '}
                    {n.parents
                      .map((p) => label(p.kind) + ' ' + p.id.slice(0, 8) + ' v' + p.revision)
                      .join(', ')}
                  </p>
                  {n.accepted && (
                    <button
                      onClick={() =>
                        setGrow([
                          {
                            garden: n.garden,
                            kind: n.kind,
                            id: n.id,
                            revision: n.revisions.at(-1)!.revision,
                          },
                        ])
                      }
                    >
                      Следующий шаг / альтернатива
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}
        {tab === 'journal' && (
          <section className="panel">
            <h2>От попытки до новой идеи</h2>
            <p>
              Сад «{g.name}», только наблюдавшиеся задания нового контракта за всё время. Проверки
              прежних черновиков входят в этап проверки; импортированные и старые карточки
              учитываются отдельно.
            </p>
            <ol className="funnel" aria-label="Этапы создания идей">
              <li>{flow.attempts} попыток с отправкой генерации</li>
              <li>{flow.drafts} сохранённых черновиков</li>
              <li>{flow.dispatched} заданий с отправленной проверкой</li>
              <li>{flow.assessed} результатов проверки</li>
              <li>{flow.cards} новых карточек без человеческого обхода проверки</li>
            </ol>
            <p>
              Сегодня: {count.attempts} попыток, {count.candidates} показанных кандидатов и
              предложений, {count.calls} вызовов. Всего: {w.jobs.length} заданий,{' '}
              {w.jobs.filter((j) => j.stage === 'failed').length} технических отказов,{' '}
              {
                w.jobs.filter((j) =>
                  ['needs_revision', 'needs_context', 'negative'].includes(j.stage),
                ).length
              }{' '}
              семантических остановок. Принято {w.nodes.filter((n) => n.accepted).length} из{' '}
              {w.nodes.length} узлов.
            </p>
            {jobs
              .slice()
              .reverse()
              .map((j) => (
                <details key={j.id}>
                  <summary>
                    {when(j.entry.at)} · {label(j.operation)} · {jobTitle(j)} · {j.calls.length}{' '}
                    вызовов
                  </summary>
                  <JobCard j={j} send={send} busy={view.busy} />
                </details>
              ))}
            <details>
              <summary>Локальный жизненный цикл</summary>
              <p>
                Подготовка выхода не доказывает последующее завершение ОС. Отсутствующие
                исторические времена неизвестны.
              </p>
              <pre>{JSON.stringify(w.lifecycle, null, 2)}</pre>
              <button onClick={() => void send({ op: 'cleanupLifecycle' })}>
                Предпросмотр очистки журнала с резервной копией
              </button>
            </details>
            <h3>Восстановление и экспорт</h3>
            <div className="actions">
              {[
                ['backup', 'Полная приватная копия'],
                ['restore', 'Предпросмотр восстановления'],
                ['pickExport', 'Папка для чтения в Codex'],
                ['export', 'Обновить читаемый экспорт'],
                ['openExport', 'Открыть экспорт'],
                ['cleanupExports', 'Предпросмотр очистки снимков'],
              ].map(([op, label]) => (
                <button key={op} onClick={() => void send({ op: op! })}>
                  {label}
                </button>
              ))}
            </div>
            <p>
              Читаемый экспорт скрывает сырые оригиналы, контекст, заметки и предков; он не
              предназначен для восстановления. Полная приватная копия содержит все доказательства и
              зависимости.
            </p>
            <details>
              <summary>Резервные копии · {view.backups.length}</summary>
              {view.backups.map((b) => (
                <p key={b.id}>
                  {when(b.at)} · Полная копия · {b.bytes} байт{' '}
                  <button onClick={() => void send({ op: 'purgeBackup', id: b.id, sha: b.sha })}>
                    Предпросмотр удаления копии
                  </button>
                </p>
              ))}
            </details>
            {w.legacy && (
              <details>
                <summary>Сохранённая исходная рабочая область v2</summary>
                <p>
                  Прежние записи ещё не проходили новую проверку. Эта копия остаётся в полной
                  приватной копии и может содержать ранее удалённые данные.
                </p>
                <button onClick={() => void send({ op: 'purgeLegacy' })}>
                  Предпросмотр удаления старой области
                </button>
              </details>
            )}
            <details>
              <summary>Сохранённые документы · {w.documents.length}</summary>
              {w.documents.map((d) => (
                <p key={d.id}>
                  {d.name}{' '}
                  <button onClick={() => void send({ op: 'purgeOriginal', id: d.id })}>
                    Предпросмотр удаления оригинала
                  </button>
                </p>
              ))}
            </details>
            <button onClick={() => void send({ op: 'deleteGarden', id: g.id })}>
              Предпросмотр каскада удаления сада
            </button>
          </section>
        )}
        {tab === 'settings' && (
          <section className="panel">
            <h2>Общие границы вычислений</h2>
            <Form
              submit={(f) =>
                void send({
                  op: 'settings',
                  attempts: Number(val(f, 'attempts')),
                  candidates: Number(val(f, 'candidates')),
                  calls: Number(val(f, 'calls')),
                  backlog: Number(val(f, 'backlog')),
                  language: val(f, 'language'),
                  exportScope: val(f, 'exportScope'),
                  model: val(f, 'model'),
                })
              }
            >
              <div className="form-grid">
                <Field
                  label="Попыток в день, 1–48"
                  name="attempts"
                  type="number"
                  v={w.settings.attempts}
                />
                <Field
                  label="Новых карточек в день, 1–48"
                  name="candidates"
                  type="number"
                  v={w.settings.candidates}
                />
                <Field
                  label="Вызовов в день, 1–96"
                  name="calls"
                  type="number"
                  v={w.settings.calls}
                />
                <Field
                  label="На просмотр, 1–20"
                  name="backlog"
                  type="number"
                  v={w.settings.backlog}
                />
                <label>
                  Язык результата
                  <select name="language" defaultValue={w.settings.language}>
                    <option value="ru">Русский</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label>
                  Установленная модель
                  <select name="model" defaultValue={w.runtime.model}>
                    <option>gemma3:4b</option>
                    <option>gemma3:1b</option>
                  </select>
                </label>
                <label>
                  Читаемый экспорт
                  <select name="exportScope" defaultValue={w.settings.exportScope}>
                    <option value="kept">Сохранённое</option>
                    <option value="all">Все кандидаты</option>
                    <option value="filtered">Отфильтрованные черновики</option>
                  </select>
                </label>
              </div>
              <p>
                Часовой пояс: {w.settings.timezone}. Два вызова на обычную попытку, третий возможен
                для исправления формата. Слоты сада расходуются только при сохранении результата;
                дневные вызовы и очередь просмотра ограничиваются отдельно. Изменение лимитов ставит
                автозапуск на паузу.
              </p>
              <button className="primary">Сохранить границы</button>
            </Form>
            <h3>Способ генерации</h3>
            <p>
              Хранение остаётся локальным. Внешняя обработка отправляет выбранный контекст
              провайдеру только после отдельного подтверждения каждого задания. Фоновая отправка
              выключена.
            </p>
            <label>
              Подключение
              <select
                aria-label="Способ генерации"
                value={w.provider?.kind ?? 'local'}
                disabled={view.busy}
                onChange={(e) => void send({ op: 'configureProvider', kind: e.target.value })}
              >
                <option value="local">Локально · установленная Ollama</option>
                <option value="claude">Claude Code · ваша подписка · Sonnet</option>
                <option value="groq">Groq API · необязательный отдельный сервис</option>
              </select>
            </label>
            <p>
              Выбрано:{' '}
              {view.provider?.kind === 'claude'
                ? 'Claude Code · подписка · Sonnet · только вручную'
                : view.provider?.kind === 'groq'
                  ? 'Groq · openai/gpt-oss-20b · только вручную'
                  : 'локальная модель'}
              . Квоты и условия внешнего сервиса зависят от вашего аккаунта; платный тариф не
              подключается.
            </p>
            <h3>Claude через вашу подписку</h3>
            <p>
              Если setup-token уже готов, вставьте его здесь. Он сохраняется отдельно от идей,
              шифруется средствами ОС и передаётся только официальному Claude Code. Обычный вход
              Claude также поддерживается; API billing автоматически не включается.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  token = val(new FormData(form), 'claudeToken');
                form.reset();
                void send({ op: 'setClaudeToken', token });
              }}
            >
              <label>
                Claude setup-token
                <input
                  aria-label="Claude setup-token"
                  name="claudeToken"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <button disabled={view.busy || !view.claudeToken?.available}>
                Сохранить setup-token защищённо
              </button>
            </form>
            <p>
              {view.claudeToken?.present
                ? 'Setup-token сохранён в защищённом хранилище.'
                : 'Setup-token не сохранён. Можно использовать обычный вход Claude.'}
            </p>
            <button
              disabled={view.busy || !view.claudeToken?.present}
              onClick={() => void send({ op: 'removeClaudeToken' })}
            >
              Удалить setup-token
            </button>
            <button disabled={view.busy} onClick={() => void send({ op: 'checkClaude' })}>
              Проверить вход Claude без генерации
            </button>
            <Form
              submit={(f) =>
                void send({ op: 'configureClaude', executable: val(f, 'claudeExecutable') })
              }
            >
              <Field
                label="Путь к официальному claude.exe (необязательно при npm-установке)"
                name="claudeExecutable"
                v={w.claudeExecutable ?? ''}
              />
              <button disabled={view.busy}>Выбрать этот Claude Code</button>
            </Form>
            {view.provider?.kind === 'groq' && (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = e.currentTarget,
                      key = val(new FormData(f), 'groqKey');
                    f.reset();
                    void send({ op: 'setGroqCredential', key });
                  }}
                >
                  <label>
                    Ключ Groq
                    <input
                      aria-label="Ключ Groq"
                      type="password"
                      name="groqKey"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                  <button disabled={view.busy || !view.provider?.credentialAvailable}>
                    Сохранить ключ в защищённом хранилище ОС
                  </button>
                </form>
                <p>
                  {view.provider?.credentialPresent
                    ? 'Ключ сохранён. Он не включается в резервные копии идей и экспорты.'
                    : 'Ключ не настроен.'}{' '}
                  {!view.provider?.credentialAvailable
                    ? 'Защищённое хранилище ОС недоступно. Открытый текст не используется.'
                    : ''}
                </p>
                <button
                  disabled={view.busy || !view.provider?.credentialPresent}
                  onClick={() => void send({ op: 'removeGroqCredential' })}
                >
                  Удалить ключ
                </button>
                <button onClick={() => void send({ op: 'saveSensitiveEmergency' })}>
                  Сохранить защищённый recovery удержанного ответа
                </button>
              </>
            )}
            <h3>Локальная модель</h3>
            <p>
              Выберите уже установленную программу Ollama и папку весов модели. Приложение ничего не
              скачивает.
            </p>
            <div className="actions">
              {[
                ['pickExecutable', 'Выбрать Ollama'],
                ['pickModels', 'Папка установленной модели'],
                ['connect', 'Проверить и освободить модель'],
              ].map(([op, label]) => (
                <button key={op} onClick={() => void send({ op: op! })}>
                  {label}
                </button>
              ))}
            </div>
            <details>
              <summary>Выбранные локальные пути</summary>
              <pre>{w.runtime.executable + '\n' + w.runtime.models}</pre>
            </details>
            <label className="check">
              <input
                type="checkbox"
                checked={view.autostart}
                onChange={(e) => void send({ op: 'autostart', enabled: e.target.checked })}
              />
              Запускать с Windows — всегда на паузе
            </label>
            <h3>Порядок садов</h3>
            {w.gardens.map((s, i) => (
              <p key={s.id}>
                {s.name}{' '}
                <button
                  disabled={!i}
                  onClick={() => {
                    const ids = w.gardens.map((g) => g.id);
                    [ids[i - 1], ids[i]] = [ids[i]!, ids[i - 1]!];
                    void send({ op: 'reorderGarden', ids });
                  }}
                >
                  Выше
                </button>
              </p>
            ))}
          </section>
        )}
        {tab === 'about' && (
          <section className="panel">
            <Author />
            <h2>Локальный кандидат v0.2</h2>
            <p>
              Профили экспериментальные до отдельной оценки владельцем: 12 новых игровых пар и 4
              контроля, сравнение старого контракта, реальные фоновые интервалы. Программные
              проверки не заменяют полезность. Без облачных вычислений, аккаунтов и внешних шрифтов.
            </p>
            {[
              ['Лицензии компонентов', licences],
              ['Golos Text · SIL OFL 1.1', golos],
              ['Literata · SIL OFL 1.1', literata],
            ].map(([name, text]) => (
              <details key={name}>
                <summary>{name}</summary>
                <pre>{text}</pre>
              </details>
            ))}
          </section>
        )}
        <footer>Успех генерации и принятие человеком — разные события.</footer>
      </main>
      {source && w.sources.find((s) => s.id === source) && (
        <SourceReader
          s={w.sources.find((s) => s.id === source)!}
          w={w}
          send={send}
          close={() => setSource(null)}
        />
      )}
      {node && w.nodes.find((n) => n.id === node) && (
        <NodeReader
          n={w.nodes.find((n) => n.id === node)!}
          w={w}
          send={send}
          close={() => setNode(null)}
          grow={(p) => {
            setNode(null);
            setGrow(p);
          }}
        />
      )}
      {grow && (
        <Modal title="Один шаг развития" onClose={() => setGrow(null)}>
          <Form
            submit={(f) => {
              void send({
                op: 'tend',
                garden: grow[0]!.garden,
                parents: grow,
                direction: val(f, 'direction'),
                question: val(f, 'question'),
              });
              setGrow(null);
            }}
          >
            <p>
              Один ручной запрос не включает автозапуск. Предложение проходит отдельную проверку и
              ждёт вашего решения. Язык: {w.settings.language === 'ru' ? 'русский' : 'английский'}.
            </p>
            <label>
              Направление
              <select name="direction">
                {DIRECTIONS.map((d) => (
                  <option key={d} value={d}>
                    {label(d)}
                  </option>
                ))}
              </select>
            </label>
            <Area label="Ваш вопрос или направление" name="question" />
            <button className="primary">Предложить один шаг</button>
          </Form>
        </Modal>
      )}
      {view.preview && (
        <Modal
          title="Предпросмотр импорта — без модели"
          onClose={() => void send({ op: 'cancelImport' })}
        >
          <Form
            submit={(f) =>
              void send({
                op: 'acceptImport',
                id: view.preview!.id,
                choices: view.preview!.items.map((_, i) => val(f, 'choice' + i)),
                participating: f.has('participating'),
              })
            }
          >
            {view.preview.items.map((item, i) => (
              <article key={i}>
                <h3>{item.title}</h3>
                <p>{label(item.duplicate)}. Совпадение названия не объединяет разные тексты.</p>
                <details>
                  <summary>Полный оригинал</summary>
                  <pre>{item.text}</pre>
                </details>
                <label>
                  Действие
                  <select
                    name={'choice' + i}
                    defaultValue={item.duplicate === 'exact' ? 'skip' : 'new-copy'}
                  >
                    <option value="new-copy">Отдельная новая копия</option>
                    <option value="skip">Пропустить</option>
                    {item.existing && <option value="link">Связать с точным существующим</option>}
                  </select>
                </label>
              </article>
            ))}
            <Check label="Разрешить участие импортированных источников" name="participating" />
            <button className="primary">Сохранить выбранное целиком</button>
          </Form>
        </Modal>
      )}
      {modal}
    </div>
  );
}

function SourceReader({
  s,
  w,
  send,
  close,
}: {
  s: Source;
  w: Workspace;
  send: Send;
  close: () => void;
}) {
  const r = current(s),
    p = r.preparation;
  return (
    <Modal title={r.title || 'Исходная идея'} onClose={close} className="wide-reader">
      <p>
        v{r.revision} · {label(s.origin)} · ввод {when(r.entry.at)}. Время замысла и исторический
        язык неизвестны.
      </p>
      <h3>Полный оригинал</h3>
      <pre>{r.text}</pre>
      {s.fileId && (
        <details>
          <summary>Сохранённый документ / декодирование</summary>
          <p>{w.documents.find((d) => d.id === s.fileId)?.decoding}</p>
          <pre>{w.documents.find((d) => d.id === s.fileId)?.text}</pre>
        </details>
      )}
      <details>
        <summary>Изменить, сохранив прежний оригинал</summary>
        <Form
          submit={(f) =>
            void send({ op: 'editSource', id: s.id, title: val(f, 'title'), text: val(f, 'text') })
          }
        >
          <Field label="Название" name="title" v={r.title} />
          <Area label="Новая полная ревизия" name="text" v={r.text} />
          <button>Сохранить новую ревизию</button>
        </Form>
      </details>
      <details>
        <summary>История оригинала · {s.revisions.length}</summary>
        {s.revisions.map((r) => (
          <article key={r.revision}>
            <h4>v{r.revision}</h4>
            <pre>{r.text}</pre>
          </article>
        ))}
      </details>
      <h3>Подготовка контекста · v{p.revision}</h3>
      <Form
        key={s.id + r.revision + p.revision}
        submit={(f) =>
          void send({
            op: 'preparation',
            id: s.id,
            selected: all(f, 'selected'),
            essential: all(f, 'essential'),
            missingMechanism: f.has('missingMechanism'),
          })
        }
      >
        {r.spans.map((span) => (
          <fieldset key={span.id}>
            <legend>
              {span.id} · [{span.start}, {span.end})
            </legend>
            <pre>{span.text}</pre>
            <Check
              label="Включить полный фрагмент"
              name="selected"
              v={span.id}
              on={p.selected.includes(span.id)}
            />
            <Check
              label="Существенный контекст"
              name="essential"
              v={span.id}
              on={p.essential.includes(span.id)}
            />
          </fieldset>
        ))}
        <Check
          label="Не хватает механизма — сначала уточнить"
          name="missingMechanism"
          on={p.missingMechanism}
        />
        <button>Сохранить подготовку</button>
      </Form>
      <details>
        <summary>Точный контекст, фрагменты и пропуски</summary>
        <Context w={w} g={s.garden} parents={[identity(s)]} />
      </details>
      <h3>Свойства исходной идеи (ДНК)</h3>
      {p.facets.map((f) => (
        <Form
          key={f.id + String(f.approved)}
          submit={(d) =>
            void send({
              op: 'facet',
              id: s.id,
              facetId: f.id,
              field: val(d, 'field'),
              value: val(d, 'value') || null,
              approved: d.has('approved'),
              spans: f.spans,
            })
          }
        >
          <Field label={'Свойство · ' + label(f.origin)} name="field" v={f.field} />
          <Field label="Значение; пусто = неизвестно" name="value" v={f.value ?? ''} />
          <Check label="Одобрено" name="approved" on={f.approved} />
          <p>Основание: {f.spans.join(', ') || 'ручное ограничение'}</p>
          <button>Принять / изменить поле</button>
        </Form>
      ))}
      <Form
        submit={(f) =>
          void send({
            op: 'facet',
            id: s.id,
            field: val(f, 'field'),
            value: val(f, 'value') || null,
            approved: f.has('approved'),
            spans: all(f, 'spans'),
          })
        }
      >
        <Field label="Новое поле" name="field" />
        <Field label="Значение; пусто = неизвестно" name="value" />
        {r.spans.map((span) => (
          <Check key={span.id} label={'Поддержка ' + span.id} name="spans" v={span.id} />
        ))}
        <Check label="Одобрить вручную" name="approved" />
        <button>Добавить поле</button>
      </Form>
      <button onClick={() => void send({ op: 'decode', garden: s.garden, parents: [identity(s)] })}>
        Предложить свойства по тексту · один вызов модели
      </button>
      <h3>Термины без переписывания оригинала</h3>
      {p.aliases.map((a) => (
        <Form
          key={a.id + p.revision}
          submit={(f) =>
            void send({
              op: 'alias',
              id: s.id,
              aliasId: a.id,
              original: a.original,
              span: a.span,
              meaning: val(f, 'meaning'),
              approved: f.has('approved'),
              essential: f.has('essential'),
            })
          }
        >
          <p>
            Оригинал: {a.original} · фрагмент {a.span} · область — только этот источник.
          </p>
          <Field label="Значение термина" name="meaning" v={a.meaning} />
          <Check label="Одобрено здесь" name="approved" on={a.approved} />
          <Check label="Существенно для механизма" name="essential" on={a.essential} />
          <button>Сохранить новую подготовку термина</button>
        </Form>
      ))}
      <Form
        submit={(f) =>
          void send({
            op: 'alias',
            id: s.id,
            original: val(f, 'original'),
            meaning: val(f, 'meaning'),
            span: val(f, 'span'),
            approved: f.has('approved'),
            essential: f.has('essential'),
          })
        }
      >
        <Field label="Исходное слово" name="original" />
        <Field label="Предлагаемое значение" name="meaning" />
        <label>
          Фрагмент
          <select name="span">
            {r.spans.map((s) => (
              <option key={s.id}>{s.id}</option>
            ))}
          </select>
        </label>
        <Check label="Одобрено для этого источника" name="approved" />
        <Check label="Без уточнения меняется ключевой механизм" name="essential" />
        <button>Добавить термин</button>
      </Form>
      <h3>Референсы</h3>
      {w.references
        .filter((ref) => p.references.includes(ref.id))
        .map((ref) => (
          <article key={ref.id}>
            <h4>
              {ref.name} · v{ref.revision} · {label(ref.status)}
            </h4>
            <p>Заимствовать: {ref.property}</p>
            <p>Отличаться: {ref.differ}</p>
            {ref.removed ? (
              <p>Исключён из будущих запросов</p>
            ) : (
              <>
                {ref.url && (
                  <a target="_blank" rel="noreferrer" href={ref.url}>
                    Открыть по явному нажатию
                  </a>
                )}
                <button onClick={() => void send({ op: 'removeReference', id: ref.id })}>
                  Исключить референс
                </button>
                <details>
                  <summary>Изменить свойства и статус</summary>
                  <Form
                    submit={(f) =>
                      void send({
                        op: 'reference',
                        source: s.id,
                        referenceId: ref.id,
                        name: val(f, 'name'),
                        url: val(f, 'url'),
                        property: val(f, 'property'),
                        differ: val(f, 'differ'),
                        status: val(f, 'status'),
                        essential: f.has('essential'),
                        spans: ref.spans,
                        ...(ref.fileId ? { fileId: ref.fileId } : {}),
                      })
                    }
                  >
                    <Field label="Название референса" name="name" v={ref.name} />
                    <Field label="Ссылка без загрузки" name="url" v={ref.url} />
                    <Area label="Что заимствовать" name="property" v={ref.property} />
                    <Area label="Что должно отличаться" name="differ" v={ref.differ} />
                    <label>
                      Статус
                      <select name="status" defaultValue={ref.status}>
                        {[
                          'uninspected link',
                          'imported assertion',
                          'user-confirmed property',
                          'source-supported property',
                        ].map((s) => (
                          <option key={s} value={s}>
                            {label(s)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Check label="Существенный референс" name="essential" on={ref.essential} />
                    <button>Сохранить ревизию референса</button>
                  </Form>
                </details>
              </>
            )}
          </article>
        ))}
      <Form
        submit={(f) =>
          void send({
            op: 'reference',
            source: s.id,
            name: val(f, 'name'),
            url: val(f, 'url'),
            property: val(f, 'property'),
            differ: val(f, 'differ'),
            essential: f.has('essential'),
            status: val(f, 'status'),
            spans: all(f, 'spans'),
            ...(val(f, 'fileId') ? { fileId: val(f, 'fileId') } : {}),
          })
        }
      >
        <Field label="Название референса" name="name" />
        <Field label="Предоставленная HTTP(S) ссылка — не загружается" name="url" />
        <Area label="Что заимствовать — свойство / выдержка" name="property" />
        <Area label="Что должно отличаться" name="differ" />
        <label>
          Статус
          <select name="status">
            {[
              'uninspected link',
              'imported assertion',
              'user-confirmed property',
              'source-supported property',
            ].map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Выбранный сохранённый документ
          <select name="fileId">
            <option value="">Без документа</option>
            {w.documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        {r.spans.map((span) => (
          <Check
            key={span.id}
            label={'Свойство поддерживается ' + span.id}
            name="spans"
            v={span.id}
          />
        ))}
        <Check label="Существенен для сравнения" name="essential" />
        <button>Сохранить референс без сетевого запроса</button>
      </Form>
      <button onClick={() => void send({ op: 'deleteSource', id: s.id })}>
        Предпросмотр каскадного удаления
      </button>
    </Modal>
  );
}
function NodeReader({
  n,
  w,
  send,
  close,
  grow,
}: {
  n: Node;
  w: Workspace;
  send: Send;
  close: () => void;
  grow: (p: Identity[]) => void;
}) {
  const [other, setOther] = useState(''),
    r = n.revisions.at(-1)!,
    c = r.content,
    d = n.decisions.at(-1),
    j = w.jobs.find((j) => j.id === (r.job ?? n.job)),
    siblings = w.nodes.filter(
      (s) =>
        s.id !== n.id &&
        s.parents.some((p) =>
          n.parents.some(
            (a) => a.garden === p.garden && a.id === p.id && a.revision === p.revision,
          ),
        ),
    );
  return (
    <Modal title={c.title} onClose={close} className="wide-reader">
      <p>
        {evidenceMode(w, n)} · v{r.revision} · {label(r.origin)}
      </p>
      <p>{c.summary}</p>
      {Object.entries({
        Опыт: c.experience,
        'Механизм / процесс / двигатель истории': c.core,
        'Пример действия, выбора и последствия': c.example,
        'Взаимодействие родителей': c.interaction,
        'Следующий вопрос': c.nextQuestion,
        'Сохраняемое ядро': c.preservedCore,
        Изменение: c.delta,
        'Изменившееся допущение': c.changedAssumption,
        'Предложенный тест (не проводился)': c.test,
      })
        .filter(([, v]) => v)
        .map(([title, body]) => (
          <section key={title}>
            <h3>{title}</h3>
            <p>{body}</p>
          </section>
        ))}
      <h3>Вклад источников</h3>
      {c.contributions.map((p) => (
        <p key={p.parent}>
          {p.text} · фрагменты {p.evidence.join(', ')}
        </p>
      ))}
      <h3>Неизвестное</h3>
      <ul>
        {c.unknowns.map((u, i) => (
          <li key={i}>{u}</li>
        ))}
      </ul>
      <h3>Проверка этой версии идеи</h3>
      <button onClick={() => void send({ op: 'checkNode', id: n.id })}>
        Проверить эту ревизию отдельно
      </button>
      <p>
        {r.assessment ? label(r.assessment.decision) : 'Эта версия ещё не проверена'}. Это
        ошибающийся локальный помощник, не доказательство полезности или истинности.
      </p>
      {r.assessment?.findings.map((f, i) => (
        <p key={i}>
          {f.field}: {f.issue} · {f.evidence.join(', ')} · не хватает: {f.missing}
        </p>
      ))}
      <p>{r.assessment?.limitations}</p>
      {d?.override && <p>Принято вопреки проверке — явное решение человека.</p>}
      <h3>Родители — точные ревизии</h3>
      {n.parents.map((p) => (
        <details key={p.id}>
          <summary>
            {w.gardens.find((g) => g.id === p.garden)?.name} · {label(p.kind)} · v{p.revision}
          </summary>
          <pre>
            {p.kind === 'source'
              ? w.sources
                  .find((s) => s.id === p.id)
                  ?.revisions.find((r) => r.revision === p.revision)?.text
              : JSON.stringify(
                  w.nodes
                    .find((n) => n.id === p.id)
                    ?.revisions.find((r) => r.revision === p.revision)?.content,
                  null,
                  2,
                )}
          </pre>
        </details>
      ))}
      <h3>Референсы и точные свойства</h3>
      {c.references.map((ref) => (
        <p key={ref.id}>
          {(r.references ?? n.references).find((r) => r.id === ref.id)?.name ?? ref.id} · предложено
          заимствовать: {ref.property} · отличие: {ref.difference} ·{' '}
          {(r.references ?? n.references).find((r) => r.id === ref.id)?.status ??
            'свидетельство недоступно'}
        </p>
      ))}
      {!c.references.length && <p>Использование референсов не заявлено в этой ревизии.</p>}
      <details>
        <summary>Выбранные исходные сведения о референсах</summary>
        {(r.references ?? n.references).map((ref) => (
          <p key={ref.id}>
            {ref.name} · {label(ref.status)} · {ref.property} · требуемое отличие: {ref.differ}
          </p>
        ))}
      </details>
      <label>
        Сравнить альтернативу
        <select value={other} onChange={(e) => setOther(e.target.value)}>
          <option value="">Другая ветвь того же родителя</option>
          {siblings.map((s) => (
            <option key={s.id} value={s.id}>
              {s.revisions.at(-1)!.content.title}
            </option>
          ))}
        </select>
      </label>
      {other && (
        <div className="compare">
          <pre>{JSON.stringify(c, null, 2)}</pre>
          <pre>
            {JSON.stringify(
              w.nodes.find((n) => n.id === other)?.revisions.at(-1)!.content,
              null,
              2,
            )}
          </pre>
        </div>
      )}
      <h3>Ваше решение</h3>
      <Form
        key={n.id + r.revision + n.decisions.length}
        submit={(f) =>
          void send({
            op: 'review',
            id: n.id,
            state: val(f, 'state'),
            note: val(f, 'note'),
            reasons: all(f, 'reasons'),
          })
        }
      >
        <label>
          Решение
          <select name="state" defaultValue={d?.state === 'new' ? 'later' : d?.state}>
            <option value="kept">Сохранить / принять</option>
            <option value="later">Позже</option>
            <option value="rejected">Отклонить</option>
          </select>
        </label>
        <Area label="Ваша исходная заметка" name="note" v={d?.note ?? ''} />
        <fieldset>
          <legend>Необязательные причины</legend>
          {[
            'unclear interaction',
            'unclear action/choice',
            'lost source',
            'contradiction',
            'wrong reference',
            'duplicate',
            'language',
            'not interesting to me',
          ].map((reason) => (
            <Check
              key={reason}
              label={reason}
              name="reasons"
              v={reason}
              on={d?.reasons.includes(reason) ?? false}
            />
          ))}
        </fieldset>
        <button className="primary">Сохранить решение</button>
      </Form>
      <details>
        <summary>Редактировать отдельной человеческой ревизией</summary>
        <Form
          submit={(f) =>
            void send({
              op: 'editIdea',
              id: n.id,
              content: {
                title: val(f, 'title'),
                summary: val(f, 'summary'),
                core: val(f, 'core'),
                example: val(f, 'example'),
              } satisfies Partial<Candidate>,
            })
          }
        >
          <Field label="Название" name="title" v={c.title} />
          <Area label="Короткое описание" name="summary" v={c.summary} />
          <Area label="Механизм" name="core" v={c.core} />
          <Area label="Пример" name="example" v={c.example} />
          <p>
            Слот не расходуется. Прежняя оценка останется у прежнего текста; у нового она
            отсутствует.
          </p>
          <button>Сохранить человеческую ревизию</button>
        </Form>
      </details>
      {n.accepted && (
        <div className="actions">
          <button
            onClick={() =>
              grow([{ garden: n.garden, kind: n.kind, id: n.id, revision: r.revision }])
            }
          >
            Следующий шаг / альтернатива
          </button>
          <button onClick={() => void send({ op: 'recompost', id: n.id })}>
            Вернуть отдельным источником в компост
          </button>
        </div>
      )}
      {!n.job.startsWith('legacy:') && n.kind === 'candidate' && (
        <Form
          submit={(f) =>
            void send({
              op: 'revise',
              garden: n.garden,
              parents: n.parents,
              previousJob: r.job ?? n.job,
              previousNode: n.id,
              previousRevision: r.revision,
              question: val(f, 'question'),
            })
          }
        >
          <Area label="Целевой вопрос для новой модельной ревизии" name="question" />
          <button>Новая ограниченная ревизия с теми же родителями</button>
        </Form>
      )}
      <details>
        <summary>История решений и ревизий</summary>
        <pre>{JSON.stringify({ decisions: n.decisions, revisions: n.revisions }, null, 2)}</pre>
      </details>
      {j && (
        <details>
          <summary>Полное локальное доказательство — приватно</summary>
          <pre>{JSON.stringify(j, null, 2)}</pre>
        </details>
      )}
    </Modal>
  );
}
function JobCard({ j, send, busy }: { j: Job; send: Send; busy: boolean }) {
  return (
    <article className="source-card">
      <h3>{jobTitle(j)}</h3>
      <p>
        {when(j.entry.at)} ·{' '}
        {j.observed
          ? isRemote(j.provider)
            ? 'Удалённая генерация · ' + j.provider!.kind
            : 'Создано на этом компьютере'
          : 'Импортировано'}{' '}
        · {j.calls.length} вызовов модели
      </p>
      {j.draft?.outcome === 'candidate' ? (
        <>
          <h4>{j.draft.title}</h4>
          <p>{j.draft.summary}</p>
          <details>
            <summary>Посмотреть черновик</summary>
            <p>{j.draft.experience}</p>
            <p>{j.draft.core}</p>
            <p>{j.draft.example}</p>
            <h4>Вклад исходных идей</h4>
            {j.draft.contributions.map((c, i) => (
              <p key={i}>{c.text}</p>
            ))}
            <p>{j.draft.interaction}</p>
            <h4>Ограничения и вопросы</h4>
            {j.draft.unknowns.map((u, i) => (
              <p key={i}>{u}</p>
            ))}
            <p>{j.draft.nextQuestion}</p>
            <p>{j.draft.preservedCore}</p>
            <p>{j.draft.delta}</p>
            <p>{j.draft.changedAssumption}</p>
            <p>{j.draft.test}</p>
            {j.draft.references.map((r, i) => (
              <p key={i}>
                {r.property} · {r.difference}
              </p>
            ))}
          </details>
        </>
      ) : (
        j.draft && <p>{modelReason(j.draft.reason)}</p>
      )}
      {j.draft &&
        j.draft.outcome !== 'candidate' &&
        j.draft.missing.map((m, i) => <p key={i}>Нужно уточнить: {m}</p>)}
      {j.primaryFailure && <p>{explain(j.primaryFailure)}</p>}
      {j.repairRefusal && (
        <p>Исправить формат в этой попытке не удалось. Исходный ответ сохранён.</p>
      )}
      {j.assessment && (
        <>
          <p>
            {label(j.assessment.decision)}. {j.assessment.limitations}
          </p>
          {j.assessment.findings.map((f, i) => (
            <p key={i}>
              {f.issue} {f.missing && `Нужно уточнить: ${f.missing}`}
            </p>
          ))}
        </>
      )}
      {j.draft?.outcome === 'candidate' && (
        <div className="actions">
          <button
            disabled={busy}
            title={
              busy
                ? 'Модель занята. Дождитесь завершения или нажмите «Пауза».'
                : 'Проверить сохранённый точный текст; новый вызов учитывается отдельно.'
            }
            onClick={() => void send({ op: 'check', id: j.id })}
          >
            Проверить этот черновик
          </button>
          <button disabled={busy} onClick={() => void send({ op: 'override', id: j.id })}>
            Принять вопреки проверке
          </button>
        </div>
      )}
      <Form
        submit={(f) =>
          void send({
            op: 'revise',
            garden: j.garden,
            parents: j.parents,
            previousJob: j.id,
            question: val(f, 'question'),
          })
        }
      >
        <Area label="Целевой вопрос для новой ревизии / явной повторной попытки" name="question" />
        <button disabled={busy}>Создать новую версию по этим исходникам</button>
      </Form>
      <details>
        <summary>Технические подробности и оригинальные ответы</summary>
        <pre>
          {JSON.stringify(
            {
              operation: j.operation,
              stage: j.stage,
              primaryFailure: j.primaryFailure,
              repairRefusal: j.repairRefusal,
              admission: j.admission ?? 'Исторический контракт',
              dispatches: j.dispatches,
              history: j.history,
              raw: j.raw,
              draft: j.draft,
              assessment: j.assessment,
              pack: j.pack,
            },
            null,
            2,
          )}
        </pre>
      </details>
      <button onClick={() => void send({ op: 'purgeJob', id: j.id })}>
        Предпросмотр удаления доказательств задания
      </button>
    </article>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
