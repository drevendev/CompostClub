import type { CoherentCommand, CoherentView } from './coherent-types';
import { author } from '../src/content/author';
import { current, identity, prepare } from '../src/domain/coherent/prepare';
import { counts, credit, INTERVALS } from '../src/domain/coherent/workspace';
import { explain, label, jobTitle, funnel } from '../src/domain/coherent/presentation';
import { CLAUDE_MODELS, isRemote } from '../src/domain/coherent/provider';
import {
  DIRECTIONS,
  type Identity,
  type Candidate,
  type Source,
  type Node,
} from '../src/domain/coherent/types';
import { version } from '../package.json';

export interface NativeField {
  key: string;
  label: string;
  type: 'text' | 'area' | 'password' | 'number' | 'bool' | 'choice' | 'multi';
  value: unknown;
  options?: { value: string; label: string }[];
}
export interface NativeElement {
  kind: 'text' | 'heading' | 'detail' | 'form' | 'button';
  text: string;
  children?: NativeElement[];
  fields?: NativeField[];
  action?: string;
  disabled?: boolean;
  key?: string;
  priority?: 'pause' | 'cancelRemote';
}
type Values = Record<string, unknown>;
type Action = (values: Values) => Promise<void> | void;
export const NATIVE_PAGES = [
  ['cards', 'Карточки'],
  ['sources', 'Исходные идеи'],
  ['references', 'Референсы и предпочтения'],
  ['growth', 'Развитие'],
  ['jobs', 'Черновики и попытки'],
  ['journal', 'Журнал и данные'],
  ['garden', 'Настройки сада'],
  ['settings', 'Подключения и лимиты'],
  ['about', 'Об авторе'],
] as const;
const profiles = {
  unknown: 'Тип неизвестен',
  game: 'Игра',
  application: 'Приложение / инструмент',
  story: 'Книга / история',
  custom: 'Свой формат',
};
const states = { kept: 'Сохранить', later: 'Позже', rejected: 'Отклонить' };
const date = (at: number) => new Date(at).toLocaleString('ru-RU');
const options = (values: readonly string[] | Record<string, string>) =>
  Array.isArray(values)
    ? (values as readonly string[]).map((value) => ({ value, label: label(value) }))
    : Object.entries(values).map(([value, label]) => ({ value, label }));
const field = (
  key: string,
  title: string,
  value: unknown = '',
  type: NativeField['type'] = 'text',
  choices?: NativeField['options'],
): NativeField => ({ key, label: title, value, type, ...(choices ? { options: choices } : {}) });
const text = (value: unknown): NativeElement => ({
  kind: 'text',
  text: typeof value === 'string' ? value : JSON.stringify(value ?? ''),
});
const heading = (value: string): NativeElement => ({ kind: 'heading', text: value });
const detail = (title: string, value: unknown): NativeElement => ({
  kind: 'detail',
  text: title,
  children: [text(typeof value === 'string' ? value : JSON.stringify(value, null, 2))],
});

// A declarative view, not executable UI code. WPF creates only built-in controls.
export class NativeUI {
  garden = '';
  page = 'cards';
  selected = '';
  query = '';
  filter = 'all';
  offset = 0;
  private actions = new Map<string, Action>();
  private sequence = 0;
  private renderId = '';
  private pair: Identity[] | null = null;
  private renderView: CoherentView | undefined;
  lastError = '';
  constructor(
    private view: () => CoherentView,
    private execute: (c: CoherentCommand) => Promise<unknown>,
    private open: (url: string) => Promise<void>,
  ) {}
  private register(fn: Action) {
    const id = 'action-' + this.actions.size;
    this.actions.set(id, fn);
    return id;
  }
  private button(title: string, fn: Action, disabled = false): NativeElement {
    return { kind: 'button', text: title, action: this.register(fn), disabled };
  }
  private command(title: string, c: CoherentCommand, disabled = false) {
    const button = this.button(
      title,
      async () => {
        await this.execute(c);
      },
      disabled,
    );
    if (c.op === 'pause' || c.op === 'cancelRemote') button.priority = c.op;
    return button;
  }
  private form(title: string, fields: NativeField[], fn: Action): NativeElement {
    return {
      kind: 'form',
      text: title,
      fields,
      action: this.register(async (values) => {
        const clean: Values = {};
        for (const f of fields) {
          const v = values[f.key] ?? f.value;
          if (f.type === 'bool') clean[f.key] = v === true;
          else if (f.type === 'number') {
            if (!Number.isFinite(Number(v))) throw Error('Введите число: ' + f.label);
            clean[f.key] = Number(v);
          } else if (f.type === 'multi') {
            if (
              !Array.isArray(v) ||
              v.some((x) => typeof x !== 'string' || !f.options?.some((o) => o.value === x))
            )
              throw Error('Проверьте выбор: ' + f.label);
            clean[f.key] = v;
          } else {
            if (typeof v !== 'string' || v.length > 2 * 1024 * 1024)
              throw Error('Проверьте поле: ' + f.label);
            if (f.type === 'choice' && !f.options?.some((o) => o.value === v))
              throw Error('Выберите значение: ' + f.label);
            clean[f.key] = v;
          }
        }
        await fn(clean);
      }),
    };
  }
  private cmdForm(
    title: string,
    c: CoherentCommand,
    fields: NativeField[],
    transform?: (v: Values) => Values,
  ) {
    const form = this.form(title, fields, async (v) => {
      await this.execute({ ...c, ...(transform ? transform(v) : v) });
    });
    form.key = JSON.stringify(c);
    return form;
  }
  async act(renderId: string, action: string, values: Values) {
    if (renderId !== this.renderId) throw Error('Экран изменился. Обновите его перед действием.');
    const fn = this.actions.get(action);
    if (!fn) throw Error('Неизвестное действие.');
    this.renderView = this.view();
    await fn(values);
  }
  navigate(page: string, id = '', garden?: string) {
    if (!NATIVE_PAGES.some(([p]) => p === page)) throw Error('Неизвестный раздел.');
    if (garden && !this.view().workspace.gardens.some((g) => g.id === garden))
      throw Error('Сад не найден.');
    if (garden) this.garden = garden;
    this.page = page;
    this.selected = id;
    this.offset = 0;
    this.lastError = '';
  }
  private select(page: string, id = '') {
    this.page = page;
    this.selected = id;
    this.offset = 0;
  }
  private get w() {
    return (this.renderView ?? this.view()).workspace;
  }
  private get g() {
    return this.w.gardens.find((g) => g.id === this.garden) ?? this.w.gardens[0]!;
  }
  private parentOptions() {
    return [
      ...this.w.sources
        .filter((s) => s.garden === this.g.id)
        .map((s) => ({
          value: JSON.stringify(identity(s)),
          label: 'Источник · ' + current(s).title,
        })),
      ...this.w.nodes
        .filter((n) => n.garden === this.g.id && n.accepted)
        .map((n) => ({
          value: JSON.stringify({
            garden: n.garden,
            kind: n.kind,
            id: n.id,
            revision: n.revisions.at(-1)!.revision,
          }),
          label: 'Карточка · ' + n.revisions.at(-1)!.content.title,
        })),
    ];
  }
  render() {
    this.renderView = this.view();
    const v = this.renderView,
      w = this.w,
      g = this.g;
    this.garden = g.id;
    this.actions.clear();
    this.renderId = String(++this.sequence);
    const body: NativeElement[] = [];
    const toolbar = [
      this.button(
        v.busy || !w.paused ? 'Пауза' : 'Продолжить',
        async () => {
          const v = this.view();
          await this.execute({ op: v.busy || !v.workspace.paused ? 'pause' : 'resume' });
        },
        v.status === 'pausing' ||
          (!v.busy && w.paused && (isRemote(w.provider) || !w.gardens.some((g) => g.background))),
      ),
      this.button(
        'Эврика',
        async () => {
          await this.execute({ op: 'eureka', garden: this.g.id, requestId: crypto.randomUUID() });
        },
        v.busy || !!v.eureka.find((x) => x.garden === g.id)?.reason,
      ),
      this.command('Полная резервная копия', { op: 'backup' }),
      this.command('Восстановить с просмотром', { op: 'restore' }),
    ];
    toolbar[0]!.priority = 'pause';
    if (v.remotePreview) {
      const p = v.remotePreview;
      body.push(
        heading('Передача контекста ' + p.provider.kind),
        text(
          'Модель: ' +
            p.provider.requestedModel +
            ' · максимум ' +
            p.calls +
            ' вызова. Отправка только после вашего подтверждения.',
        ),
        text(
          'Донорские сады: ' +
            p.donorGardens.map((id) => w.gardens.find((g) => g.id === id)?.name ?? id).join(', '),
        ),
        text(p.objective),
        ...p.sections.flatMap((s) => [heading(s.title), text(s.text)]),
        detail('Точный контекст', p.context),
        detail('Черновик', p.draft),
        detail('Инструкция', p.prompt),
        text(
          'Внешний сервис получит эти данные. Отмена не гарантирует возврат квоты или удаление уже переданного.',
        ),
        this.command('Разрешить эту отправку', {
          op: 'confirmRemote',
          previewId: p.id,
          consent: true,
        }),
        this.command('Отменить отправку', { op: 'cancelRemote' }),
      );
    }
    if (v.preview) {
      const p = v.preview;
      body.push(
        heading('Предпросмотр импорта'),
        ...p.items.map((i) => text(i.title + ' · ' + label(i.duplicate))),
        this.cmdForm(
          'Подтвердить импорт',
          { op: 'acceptImport', id: p.id },
          [
            ...p.items.map((i, index) =>
              field(
                'item' + index,
                i.title,
                i.duplicate === 'exact' ? 'skip' : 'new-copy',
                'choice',
                options(
                  i.existing
                    ? {
                        skip: 'Пропустить',
                        link: 'Связать с существующим',
                        'new-copy': 'Новая копия',
                      }
                    : { skip: 'Пропустить', 'new-copy': 'Новая копия' },
                ),
              ),
            ),
            field('participating', 'Включить в будущие пары', false, 'bool'),
          ],
          (values) => ({
            choices: p.items.map((_, i) => values['item' + i]),
            participating: values.participating,
          }),
        ),
        this.command('Отменить импорт', { op: 'cancelImport' }),
      );
    }
    if (this.page === 'sources') this.sources(body);
    else if (this.page === 'cards' || this.page === 'growth') this.cards(body);
    else if (this.page === 'jobs') this.jobs(body);
    else if (this.page === 'references') this.references(body);
    else if (this.page === 'garden') this.gardenSettings(body);
    else if (this.page === 'settings') this.settings(body);
    else if (this.page === 'journal') this.journal(body);
    else this.about(body);
    return {
      format: 'compost-native-screen-1',
      renderId: this.renderId,
      version,
      title: g.name,
      page: this.page,
      selected: this.selected,
      garden: g.id,
      gardens: w.gardens.map((g) => ({ value: g.id, label: g.name })),
      pages: NATIVE_PAGES.map(([value, label]) => ({ value, label })),
      status: this.status(),
      error: this.lastError || v.error || '',
      toolbar,
      body,
    };
  }
  status() {
    const v = this.view(),
      w = v.workspace,
      g = w.gardens.find((g) => g.id === this.garden) ?? w.gardens[0]!,
      c = counts(w, Date.now()),
      last = w.jobs.filter((j) => j.garden === g.id).at(-1);
    return (
      `${label(v.status)} · ${explain(v.reason)}\n${g.name} · ${v.provider?.requestedModel ?? w.runtime.model} · слотов ${credit(w, g.id, Date.now())}/${g.credits.cap ?? 3} · сегодня ${c.calls}/${w.settings.calls} вызовов · ${c.pending} на просмотр` +
      (last
        ? `\nПоследняя попытка: ${label(last.stage)} · ${last.calls.length} вызова${last.primaryFailure && ['failed', 'interrupted', 'needs_revision', 'needs_context', 'negative'].includes(last.stage) ? ' · ' + explain(last.primaryFailure) : last.repairUsed ? ' · формат первого ответа исправлен' : ''}`
        : '')
    );
  }
  toolbarState() {
    const v = this.view(),
      w = v.workspace;
    return {
      pauseText: v.busy || !w.paused ? 'Пауза' : 'Продолжить',
      pauseEnabled:
        v.status !== 'pausing' &&
        (v.busy || !w.paused || (!isRemote(w.provider) && w.gardens.some((g) => g.background))),
      eurekaEnabled: !v.busy && !v.eureka.find((e) => e.garden === this.g.id)?.reason,
    };
  }
  private search(body: NativeElement[]) {
    body.push(
      this.form(
        'Найти',
        [
          field('query', 'Поиск', this.query),
          field(
            'filter',
            'Показать',
            this.filter,
            'choice',
            options({
              all: 'Все',
              pending: 'Не оценены',
              kept: 'Сохранены',
              later: 'На потом',
              rejected: 'Отклонены',
            }),
          ),
        ],
        (v) => {
          this.query = String(v.query);
          this.filter = String(v.filter);
          this.offset = 0;
        },
      ),
    );
  }
  private paginate<T>(items: T[], body: NativeElement[], render: (item: T) => NativeElement[]) {
    body.push(
      text(
        `Всего: ${items.length}. Показаны ${this.offset + 1}–${Math.min(items.length, this.offset + 30)}.`,
      ),
    );
    for (const item of items.slice(this.offset, this.offset + 30)) body.push(...render(item));
    if (this.offset > 0)
      body.push(
        this.button('Предыдущие 30', () => {
          this.offset = Math.max(0, this.offset - 30);
        }),
      );
    if (this.offset + 30 < items.length)
      body.push(
        this.button('Следующие 30', () => {
          this.offset += 30;
        }),
      );
  }
  private context(body: NativeElement[], parents: Identity[]) {
    try {
      const p = prepare(this.w, this.g.id, parents);
      body.push(
        detail('Точный подготовленный контекст и пропуски', {
          payload: p.payload,
          hash: p.hash,
          omissions: p.omissions,
        }),
      );
    } catch (e) {
      body.push(text(String(e)));
    }
  }
  private sources(body: NativeElement[]) {
    const w = this.w,
      g = this.g,
      s = w.sources.find((s) => s.id === this.selected && s.garden === g.id);
    if (s) {
      this.source(body, s);
      return;
    }
    if (this.pair) {
      body.push(heading('Контекст выбранной пары'));
      this.context(body, this.pair);
      body.push(
        this.button('Начать одну попытку', async () => {
          await this.execute({ op: 'run', garden: g.id, parents: this.pair });
          this.pair = null;
        }),
        this.button('Отменить выбор пары', () => {
          this.pair = null;
        }),
      );
      return;
    }
    body.push(
      heading('Исходные идеи'),
      this.cmdForm('Добавить исходную идею', { op: 'add', garden: g.id }, [
        field('title', 'Название'),
        field('text', 'Полный текст', '', 'area'),
        field('tags', 'Теги через запятую'),
        field('participating', 'Участвует в парах', false, 'bool'),
      ]),
      this.command('Импортировать файлы', { op: 'chooseImport', garden: g.id }),
      this.cmdForm('Разобрать вставленный текст', { op: 'pasteImport', garden: g.id }, [
        field('text', 'Текст для предпросмотра', '', 'area'),
      ]),
    );
    this.search(body);
    body.push(
      this.form(
        'Просмотреть выбранную пару',
        [
          field(
            'parents',
            'Два источника',
            [],
            'multi',
            w.sources
              .filter((s) => s.garden === g.id)
              .map((s) => ({ value: JSON.stringify(identity(s)), label: current(s).title })),
          ),
        ],
        (v) => {
          if ((v.parents as string[]).length !== 2) throw Error('Выберите два источника.');
          this.pair = (v.parents as string[]).map((p) => JSON.parse(p) as Identity);
        },
      ),
    );
    this.paginate(
      w.sources.filter(
        (s) =>
          s.garden === g.id &&
          (!this.query ||
            (current(s).title + ' ' + current(s).text)
              .toLowerCase()
              .includes(this.query.toLowerCase())),
      ),
      body,
      (s) => [
        this.button(current(s).title || 'Без названия', () => this.select('sources', s.id)),
        text(s.participating ? 'Участвует в парах' : 'Не участвует в парах'),
      ],
    );
  }
  private source(body: NativeElement[], s: Source) {
    const w = this.w,
      r = current(s),
      p = r.preparation;
    body.push(
      this.button('К списку источников', () => this.select('sources')),
      heading(r.title),
      text(r.text),
      text(`Версия ${r.revision} · ${label(s.origin)} · ${date(r.entry.at)}`),
      this.command(s.participating ? 'Исключить из пар' : 'Включить в пары', {
        op: 'participate',
        id: s.id,
        value: !s.participating,
      }),
      this.cmdForm('Сохранить новую версию источника', { op: 'editSource', id: s.id }, [
        field('title', 'Название', r.title),
        field('text', 'Полный текст', r.text, 'area'),
      ]),
      detail('Все версии оригинала', s.revisions),
    );
    if (s.fileId) {
      const d = w.documents.find((d) => d.id === s.fileId);
      body.push(
        detail(
          'Сохранённый документ',
          d ? { name: d.name, decoding: d.decoding, hash: d.hash, text: d.text } : 'Недоступен',
        ),
      );
    }
    const spans = r.spans.map((s) => ({ value: s.id, label: s.id + ' · ' + s.text }));
    body.push(
      this.cmdForm('Сохранить подготовку контекста', { op: 'preparation', id: s.id }, [
        field('selected', 'Полные фрагменты', p.selected, 'multi', spans),
        field('essential', 'Существенные фрагменты', p.essential, 'multi', spans),
        field('missingMechanism', 'Сначала уточнить механизм', p.missingMechanism, 'bool'),
      ]),
    );
    this.context(body, [identity(s)]);
    body.push(heading('Свойства (ДНК)'));
    for (const f of [
      ...p.facets,
      { id: undefined, field: '', value: null, approved: false, spans: [] },
    ])
      body.push(
        this.cmdForm(
          f.id ? 'Сохранить свойство' : 'Добавить свойство',
          { op: 'facet', id: s.id, ...(f.id ? { facetId: f.id } : {}) },
          [
            field('field', 'Свойство', f.field),
            field('value', 'Значение; пустое = неизвестно', f.value ?? ''),
            field('approved', 'Одобрено', f.approved, 'bool'),
            field('spans', 'Основание', f.spans, 'multi', spans),
          ],
          (v) => ({ ...v, value: v.value || null }),
        ),
      );
    body.push(
      this.command('Предложить ДНК моделью', {
        op: 'decode',
        garden: s.garden,
        parents: [identity(s)],
      }),
      heading('Термины'),
    );
    for (const a of [
      ...p.aliases,
      {
        id: undefined,
        original: '',
        meaning: '',
        span: r.spans[0]?.id ?? '',
        approved: false,
        essential: false,
      },
    ])
      body.push(
        this.cmdForm(
          a.id ? 'Сохранить термин' : 'Добавить термин',
          { op: 'alias', id: s.id, ...(a.id ? { aliasId: a.id } : {}) },
          [
            field('original', 'Исходное слово', a.original),
            field('meaning', 'Значение', a.meaning),
            field('span', 'Фрагмент', a.span, 'choice', spans),
            field('approved', 'Одобрено', a.approved, 'bool'),
            field('essential', 'Существенно', a.essential, 'bool'),
          ],
        ),
      );
    body.push(heading('Референсы'));
    for (const ref of w.references.filter((ref) => p.references.includes(ref.id))) {
      body.push(text(ref.name + ' · ' + label(ref.status)));
      if (ref.url) body.push(this.button('Открыть ссылку ' + ref.name, () => this.open(ref.url)));
      if (!ref.removed) {
        body.push(
          this.referenceForm(s, ref),
          this.command('Исключить референс ' + ref.name, { op: 'removeReference', id: ref.id }),
        );
      }
    }
    body.push(
      this.referenceForm(s),
      this.command('Предпросмотр удаления источника', { op: 'deleteSource', id: s.id }),
    );
  }
  private referenceForm(s: Source, ref?: ReturnType<NativeUI['referenceValue']>) {
    const r = ref ?? this.referenceValue(),
      spans = current(s).spans.map((p) => ({ value: p.id, label: p.id + ' · ' + p.text }));
    return this.cmdForm(
      ref ? 'Сохранить референс' : 'Добавить референс',
      { op: 'reference', source: s.id, ...(ref ? { referenceId: ref.id } : {}) },
      [
        field('name', 'Название', r.name),
        field('url', 'HTTP(S) ссылка без загрузки', r.url),
        field('property', 'Что заимствовать', r.property, 'area'),
        field('differ', 'Чем отличаться', r.differ, 'area'),
        field(
          'status',
          'Основание',
          r.status,
          'choice',
          options([
            'uninspected link',
            'imported assertion',
            'user-confirmed property',
            'source-supported property',
          ]),
        ),
        field('essential', 'Существенен', r.essential, 'bool'),
        field('spans', 'Фрагменты-основания', r.spans, 'multi', spans),
        field('fileId', 'Сохранённый документ', r.fileId ?? '', 'choice', [
          { value: '', label: 'Без документа' },
          ...this.w.documents.map((d) => ({ value: d.id, label: d.name })),
        ]),
      ],
      (v) => ({ ...v, fileId: v.fileId || null }),
    );
  }
  private referenceValue() {
    return {
      id: '',
      name: '',
      url: '',
      property: '',
      differ: '',
      status: 'uninspected link',
      essential: false,
      spans: [] as string[],
      fileId: null as string | null,
    };
  }
  private cards(body: NativeElement[]) {
    const w = this.w,
      n = w.nodes.find((n) => n.id === this.selected && n.garden === this.g.id);
    if (n) {
      this.node(body, n);
      return;
    }
    body.push(heading(this.page === 'growth' ? 'Развитие и родословная' : 'Карточки'));
    this.search(body);
    if (this.page === 'growth') body.push(this.growthForm());
    const list = w.nodes
      .filter((n) => n.garden === this.g.id)
      .filter(
        (n) =>
          this.filter === 'all' ||
          (this.filter === 'pending'
            ? !n.decisions.length || n.decisions.at(-1)?.state === 'new'
            : n.decisions.at(-1)?.state === this.filter),
      )
      .filter(
        (n) =>
          !this.query ||
          JSON.stringify(n.revisions.at(-1)!.content)
            .toLowerCase()
            .includes(this.query.toLowerCase()),
      );
    this.paginate([...list].reverse(), body, (n) => [
      this.button(n.revisions.at(-1)!.content.title, () => this.select(this.page, n.id)),
      text(n.revisions.at(-1)!.content.summary),
      text(label(n.decisions.at(-1)?.state ?? 'new') + ' · ' + label(n.kind)),
      text(
        'Родители: ' +
          n.parents.map((p) => p.kind + ' ' + p.id.slice(0, 8) + ' v' + p.revision).join(', '),
      ),
    ]);
  }
  private candidate(body: NativeElement[], c: Candidate) {
    const fields: Record<string, string> = {
      title: 'Название',
      summary: 'Коротко',
      experience: 'Опыт',
      core: 'Механизм',
      example: 'Пример',
      interaction: 'Связь исходных идей',
      nextQuestion: 'Следующий вопрос',
      preservedCore: 'Сохранённое ядро',
      delta: 'Изменение',
      changedAssumption: 'Изменённое предположение',
      test: 'Предложенный тест (ещё не проводился)',
    };
    for (const [key, title] of Object.entries(fields)) {
      const value = c[key as keyof Candidate];
      if (typeof value === 'string' && value) body.push(heading(title), text(value));
    }
    body.push(
      heading('Вклад родителей'),
      ...c.contributions.map((c) => text(c.text + ' · ' + c.evidence.join(', '))),
      heading('Неизвестное'),
      ...c.unknowns.map(text),
      detail('Использованные референсы', c.references),
    );
  }
  private node(body: NativeElement[], n: Node) {
    const w = this.w,
      r = n.revisions.at(-1)!,
      c = r.content,
      d = n.decisions.at(-1),
      j = w.jobs.find((j) => j.id === (r.job ?? n.job));
    body.push(
      this.button('К списку карточек', () => this.select(this.page)),
      text(
        `Версия ${r.revision} · ${label(r.origin)} · ${n.recorded ? 'Публичная запись, не новая генерация' : n.imported ? 'Импортировано' : j?.observed ? 'Наблюдавшийся ответ модели' : 'Историческая карточка'}`,
      ),
    );
    this.candidate(body, c);
    body.push(
      detail('Проверка этой версии', r.assessment ?? 'Эта версия ещё не проверена'),
      text('Проверка модели — вспомогательная и может ошибаться.'),
      this.command('Проверить текущую версию моделью', { op: 'checkNode', id: n.id }),
      heading('Ваше решение'),
      this.cmdForm('Сохранить решение', { op: 'review', id: n.id }, [
        field(
          'state',
          'Решение',
          d?.state && d.state !== 'new' ? d.state : 'later',
          'choice',
          options(states),
        ),
        field('note', 'Ваша заметка', d?.note ?? '', 'area'),
        field(
          'reasons',
          'Причины',
          d?.reasons ?? [],
          'multi',
          options([
            'unclear interaction',
            'unclear action/choice',
            'lost source',
            'contradiction',
            'wrong reference',
            'duplicate',
            'language',
            'not interesting to me',
          ]),
        ),
      ]),
    );
    body.push(
      this.cmdForm(
        'Сохранить человеческую ревизию',
        { op: 'editIdea', id: n.id },
        [
          field('title', 'Название', c.title),
          field('summary', 'Кратко', c.summary, 'area'),
          field('core', 'Механизм', c.core, 'area'),
          field('example', 'Пример', c.example, 'area'),
        ],
        (content) => ({ content }),
      ),
      detail('История решений и полные ревизии', {
        decisions: n.decisions,
        revisions: n.revisions,
      }),
    );
    for (const p of n.parents) {
      const source = w.sources.find((s) => s.id === p.id),
        node = w.nodes.find((n) => n.id === p.id),
        original =
          source?.revisions.find((r) => r.revision === p.revision) ??
          node?.revisions.find((r) => r.revision === p.revision);
      body.push(
        detail(
          'Родитель · ' + p.kind + ' · версия ' + p.revision,
          original ?? j?.snapshots[n.parents.indexOf(p)] ?? 'Недоступен',
        ),
      );
    }
    const siblings = w.nodes.filter(
      (s) =>
        s.id !== n.id &&
        s.parents.some((p) =>
          n.parents.some(
            (a) => a.id === p.id && a.revision === p.revision && a.garden === p.garden,
          ),
        ),
    );
    body.push(
      detail(
        'Альтернативы тех же родителей',
        siblings.map((s) => ({
          title: s.revisions.at(-1)!.content.title,
          content: s.revisions.at(-1)!.content,
        })),
      ),
    );
    if (n.accepted)
      body.push(
        this.growthForm([{ garden: n.garden, kind: n.kind, id: n.id, revision: r.revision }]),
        this.command('Вернуть отдельным источником в компост', { op: 'recompost', id: n.id }),
      );
    if (!n.job.startsWith('legacy:'))
      body.push(
        this.cmdForm(
          'Новая модельная ревизия',
          {
            op: 'revise',
            garden: n.garden,
            parents: n.parents,
            previousJob: r.job ?? n.job,
            previousNode: n.id,
            previousRevision: r.revision,
          },
          [field('question', 'Целевой вопрос', '', 'area')],
        ),
      );
    if (j) body.push(detail('Полное доказательство задания', j));
  }
  private growthForm(parents?: Identity[]) {
    return this.cmdForm(
      'Развить выбранное',
      { op: 'tend', garden: this.g.id },
      [
        field(
          'parents',
          'Один или два точных родителя',
          parents?.map((p) => JSON.stringify(p)) ?? [],
          'multi',
          this.parentOptions(),
        ),
        field('direction', 'Направление', DIRECTIONS[0], 'choice', options(DIRECTIONS)),
        field('question', 'Вопрос / уточнение', '', 'area'),
      ],
      (v) => ({ ...v, parents: (v.parents as string[]).map((p) => JSON.parse(p) as Identity) }),
    );
  }
  private jobs(body: NativeElement[]) {
    const list = this.w.jobs.filter((j) => j.garden === this.g.id),
      j = list.find((j) => j.id === this.selected);
    if (!j) {
      body.push(heading('Черновики и попытки'));
      this.paginate([...list].reverse(), body, (j) => [
        this.button(jobTitle(j), () => this.select('jobs', j.id)),
        text(date(j.entry.at) + ' · ' + label(j.stage) + ' · вызовов ' + j.calls.length),
      ]);
      return;
    }
    body.push(
      this.button('К списку попыток', () => this.select('jobs')),
      heading(jobTitle(j)),
      text(label(j.stage) + ' · вызовов ' + j.calls.length),
      text(explain(j.primaryFailure)),
      text(explain(j.repairRefusal)),
    );
    if (j.draft?.outcome === 'candidate') this.candidate(body, j.draft);
    else if (j.draft) body.push(text(j.draft.reason), ...j.draft.missing.map(text));
    body.push(
      detail('Проверка', j.assessment),
      this.command('Повторно проверить сохранённый черновик', { op: 'check', id: j.id }),
      this.command('Сохранить вопреки проверке (с подтверждением)', { op: 'override', id: j.id }),
      this.cmdForm(
        'Новая ограниченная ревизия',
        { op: 'revise', garden: j.garden, parents: j.parents, previousJob: j.id },
        [field('question', 'Целевой вопрос', '', 'area')],
      ),
      detail('Полное задание и оригинальные ответы', j),
    );
    if (j.operation === 'dna' || j.operation === 'preferences')
      body.push(
        text(
          'Предложенные свойства не становятся одобренными автоматически. Перенесите и подтвердите их в подготовке источника или предпочтениях.',
        ),
        detail('Предложения', j.raw),
      );
    body.push(
      this.command('Предпросмотр удаления доказательств задания', { op: 'purgeJob', id: j.id }),
    );
  }
  private references(body: NativeElement[]) {
    const w = this.w;
    body.push(
      heading('Референсы и предпочтения'),
      text(
        'Референсы и ДНК редактируются в полном просмотре исходной идеи. Ссылки сами не загружаются.',
      ),
    );
    for (const r of w.references.filter((r) => r.garden === this.g.id)) {
      body.push(detail(r.name + ' · ' + label(r.status) + (r.removed ? ' · исключён' : ''), r));
      if (!r.removed)
        body.push(this.command('Исключить ' + r.name, { op: 'removeReference', id: r.id }));
    }
    const preferences = w.preferences.filter((p) => p.garden === null || p.garden === this.g.id);
    for (const p of [
      ...preferences,
      { id: undefined, text: '', approved: false, enabled: true, garden: this.g.id, reviews: [] },
    ])
      body.push(
        this.cmdForm(
          p.id ? 'Сохранить предпочтение' : 'Добавить предпочтение',
          { op: 'preference', ...(p.id ? { id: p.id } : {}), reviews: p.reviews },
          [
            field('text', 'Предпочтение', p.text, 'area'),
            field('approved', 'Одобрено вами', p.approved, 'bool'),
            field('enabled', 'Использовать', p.enabled, 'bool'),
            field('garden', 'Область', p.garden ?? 'global', 'choice', [
              { value: 'global', label: 'Все сады' },
              ...w.gardens.map((g) => ({ value: g.id, label: g.name })),
            ]),
          ],
          (v) => ({ ...v, garden: v.garden === 'global' ? null : v.garden }),
        ),
      );
    body.push(
      this.cmdForm(
        'Предложить предпочтения по вашим решениям',
        { op: 'proposePreferences', garden: this.g.id },
        [
          field(
            'reviews',
            'Явно выбранные решения',
            [],
            'multi',
            w.nodes
              .filter((n) => n.garden === this.g.id)
              .flatMap((n) =>
                n.decisions.map((d) => ({
                  value: d.id,
                  label:
                    n.revisions.at(-1)!.content.title + ' · ' + label(d.state) + ' · ' + d.note,
                })),
              ),
          ),
        ],
      ),
    );
  }
  private gardenSettings(body: NativeElement[]) {
    const w = this.w,
      g = this.g;
    body.push(
      heading('Настройки сада'),
      this.cmdForm('Переименовать сад', { op: 'renameGarden', id: g.id }, [
        field('name', 'Название', g.name),
      ]),
      this.cmdForm(
        'Сохранить настройки сада',
        { op: 'gardenSettings', id: g.id },
        [
          field('profile', 'Тип', g.profile, 'choice', options(profiles)),
          field('objective', 'Цель и ограничения', g.objective, 'area'),
          field(
            'interval',
            'Интервал, минут',
            String(g.interval),
            'choice',
            INTERVALS.map((n) => ({ value: String(n), label: String(n) })),
          ),
        ],
        (v) => ({ ...v, interval: Number(v.interval) }),
      ),
      this.command(g.background ? 'Исключить сад из расписания' : 'Включить сад в расписание', {
        op: 'background',
        id: g.id,
        enabled: !g.background,
      }),
      text('Следующий срок: ' + date(g.nextAt)),
      this.cmdForm('Сохранить обмен между садами', { op: 'exchange', id: g.id }, [
        field('probability', 'Вероятность донорской пары, 0–100%', g.policy.probability, 'number'),
        field('donate', 'Разрешить этому саду быть донором', g.policy.donate, 'bool'),
        field(
          'donors',
          'Разрешённые доноры',
          g.policy.donors,
          'multi',
          w.gardens.filter((d) => d.id !== g.id).map((d) => ({ value: d.id, label: d.name })),
        ),
      ]),
      this.command('Отменить текущий план', { op: 'cancelPlan', id: g.id }),
      this.command('Выбрать локальную пару вместо маршрута', { op: 'localOverride', id: g.id }),
      detail('План', g.plan),
      this.cmdForm('Создать новый сад', { op: 'createGarden' }, [
        field('name', 'Название'),
        field('profile', 'Тип', 'unknown', 'choice', options(profiles)),
      ]),
    );
    w.gardens.forEach((garden, index) => {
      if (index)
        body.push(
          this.button('Переместить выше: ' + garden.name, async () => {
            const ids = w.gardens.map((g) => g.id);
            [ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!];
            await this.execute({ op: 'reorderGarden', ids });
          }),
        );
    });
    body.push(
      this.command('Предпросмотр каскадного удаления сада', { op: 'deleteGarden', id: g.id }),
    );
  }
  private settings(body: NativeElement[]) {
    const v = this.view(),
      w = this.w;
    body.push(
      heading('Подключения'),
      text('Локальное хранение. Внешняя обработка — только после предпросмотра и подтверждения.'),
      this.cmdForm('Выбрать провайдера', { op: 'configureProvider' }, [
        field(
          'kind',
          'Обработка',
          w.provider?.kind ?? 'local',
          'choice',
          options({ local: 'Локальная Ollama', claude: 'Подписка Claude Code', groq: 'Groq API' }),
        ),
      ]),
      this.cmdForm('Выбрать модель Claude', { op: 'configureClaudeModel' }, [
        field(
          'model',
          'Модель',
          w.provider?.kind === 'claude' ? (w.provider.model ?? 'sonnet') : 'sonnet',
          'choice',
          CLAUDE_MODELS.map((m) => ({ value: m.id, label: m.label })),
        ),
      ]),
      this.cmdForm('Сохранить путь Claude Code', { op: 'configureClaude' }, [
        field('executable', 'Установленный официальный claude.exe', w.claudeExecutable ?? ''),
      ]),
      text(
        'Вход Claude: ' +
          (v.claudeConnection?.state ?? 'unchecked') +
          ' · ' +
          (v.claudeConnection?.version ?? ''),
      ),
      this.command('Проверить вход Claude без генерации', { op: 'checkClaude' }),
      text(
        v.claudeToken?.present
          ? 'Setup-token сохранён в защите Windows.'
          : 'Введите setup-token, если защищённый перенос был недоступен.',
      ),
      this.cmdForm('Сохранить setup-token Claude', { op: 'setClaudeToken' }, [
        field('token', 'Setup-token', '', 'password'),
      ]),
      this.command('Удалить setup-token Claude', { op: 'removeClaudeToken' }),
      this.cmdForm('Сохранить API key Groq', { op: 'setGroqCredential' }, [
        field('key', 'Groq API key', '', 'password'),
      ]),
      this.command('Удалить ключ Groq', { op: 'removeGroqCredential' }),
      this.command('Сохранить защищённый ответ восстановления', { op: 'saveSensitiveEmergency' }),
      heading('Локальная модель'),
      this.command('Выбрать ollama.exe', { op: 'pickExecutable' }),
      this.command('Выбрать папку установленных моделей', { op: 'pickModels' }),
      this.cmdForm('Сохранить пути Ollama', { op: 'configureRuntime' }, [
        field('executable', 'ollama.exe', w.runtime.executable),
        field('models', 'Папка моделей', w.runtime.models),
      ]),
      this.command('Проверить Ollama без генерации', { op: 'connect' }),
      heading('Лимиты'),
      this.cmdForm('Сохранить лимиты', { op: 'settings' }, [
        field('attempts', 'Попыток в день (1–48)', w.settings.attempts, 'number'),
        field('candidates', 'Новых карточек (1–48)', w.settings.candidates, 'number'),
        field('calls', 'Вызовов (1–96)', w.settings.calls, 'number'),
        field('backlog', 'На просмотр (1–20)', w.settings.backlog, 'number'),
        field(
          'language',
          'Язык новых результатов',
          w.settings.language,
          'choice',
          options({ ru: 'Русский', en: 'English' }),
        ),
        field(
          'exportScope',
          'Читаемый экспорт',
          w.settings.exportScope,
          'choice',
          options({
            all: 'Все карточки',
            kept: 'Сохранённые',
            filtered: 'Отфильтрованные черновики',
          }),
        ),
        field(
          'model',
          'Локальная модель',
          w.runtime.model,
          'choice',
          options(['gemma3:1b', 'gemma3:4b']),
        ),
      ]),
      this.command(
        v.autostart ? 'Выключить вход при старте Windows' : 'Запускать при входе в Windows',
        { op: 'autostart', enabled: !v.autostart },
      ),
      this.command('Я проверил причины остановки', { op: 'clearAttention' }),
      text(
        'Операторская телеметрия: ' +
          (v.telemetry?.enabled ? 'включена, только технические метаданные' : 'выключена'),
      ),
      text(
        'Закрытие окна скрывает его в трей. «Завершить» безопасно останавливает все процессы. После сна работа остаётся на паузе.',
      ),
    );
  }
  private journal(body: NativeElement[]) {
    const document = this.w.documents.find((d) => d.id === this.selected);
    if (document) {
      body.push(
        this.button('К журналу', () => this.select('journal')),
        heading(document.name),
        text(document.text),
        detail('Оригинальные байты и декодирование', document),
      );
      return;
    }
    const w = this.w,
      v = this.view();
    body.push(
      heading('Журнал и данные'),
      detail('Воронка сада', funnel(w, this.g.id)),
      detail('История запуска и остановки', w.lifecycle),
      detail('Расход вызовов', w.calls),
      detail('Точные ручные запросы и их состояние', w.requests),
      this.command('Очистить историю запуска с резервной копией', { op: 'cleanupLifecycle' }),
      this.command('Открыть папку данных', { op: 'openData' }),
      this.command('Выбрать пустую папку читаемого экспорта', { op: 'pickExport' }),
      this.cmdForm('Настроить папку экспорта', { op: 'configureExport' }, [
        field('directory', 'Полный путь к пустой папке', w.exportDirectory),
      ]),
      this.command('Обновить читаемый экспорт', { op: 'export' }),
      this.command('Открыть экспорт', { op: 'openExport' }),
      this.command('Предпросмотр очистки экспортов', { op: 'cleanupExports' }),
      text(
        'Полная приватная копия содержит оригиналы и ответы. Читаемый экспорт не предназначен для восстановления.',
      ),
    );
    for (const b of v.backups)
      body.push(
        text(date(b.at) + ' · ' + b.reason + ' · ' + b.bytes + ' байт'),
        this.command('Предпросмотр удаления копии ' + b.id, {
          op: 'purgeBackup',
          id: b.id,
          sha: b.sha,
        }),
      );
    for (const d of w.documents)
      body.push(
        this.button('Открыть документ ' + d.name, () => this.select('journal', d.id)),
        this.command('Предпросмотр удаления документа ' + d.name, {
          op: 'purgeOriginal',
          id: d.id,
        }),
      );
    if (w.legacy)
      body.push(
        text('Исходная область до миграции сохранена в полной приватной копии.'),
        this.command('Предпросмотр удаления прежней области', { op: 'purgeLegacy' }),
      );
  }
  private about(body: NativeElement[]) {
    body.push(
      heading('Compost Club · ' + version),
      text('Тихий сад новых идей. Windows WPF · без браузера и локального веб-сервера.'),
      text('Автор: Dreven'),
      ...author.links.map((link) => this.button(link.label + ' автора', () => this.open(link.url))),
      this.button('Открыть лицензии', async () => {
        await this.execute({ op: 'nativeLicenses' });
      }),
      text(
        'Лицензии и исходный код находятся в папке приложения. Человеческая оценка полезности отделена от проверки модели.',
      ),
    );
  }
}
