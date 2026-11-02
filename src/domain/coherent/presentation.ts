import type { Job, Workspace } from './types';

export const labels: Record<string, string> = {
  prepared: 'Готовим запрос',
  generating: 'Создаём идею',
  'draft retained': 'Черновик сохранён',
  screening: 'Проверяем сочетание исходных идей',
  screened: 'Проверка завершена',
  needs_revision: 'В черновике есть замечания',
  needs_context: 'Для этой пары не хватило деталей',
  negative: 'Эти идеи не удалось объединить',
  failed: 'Попытка остановилась из-за ошибки',
  cancelled: 'Работа отменена',
  interrupted: 'Работа прервалась',
  proposal: 'Шаг развития ждёт вашего решения',
  accepted: 'Шаг принят',
  rejected: 'Отклонено',
  blend: 'Новая идея',
  growth: 'Развитие идеи',
  check: 'Проверка черновика',
  revise: 'Новая версия',
  dna: 'Свойства исходной идеи',
  preferences: 'Предложения по вашим отзывам',
  pass: 'Проверка пройдена',
  kept: 'Сохранено',
  later: 'Отложено',
  new: 'Ждёт просмотра',
  'user-authored': 'Написано человеком',
  'imported assertion': 'Импортировано',
  'deterministic extraction': 'Выделено из оригинала',
  'local-model proposal': 'Предложено местной моделью',
  'remote-model proposal': 'Предложено внешней моделью',
  'uninspected link': 'Ссылка ещё не изучена',
  'user-confirmed property': 'Свойство подтверждено вами',
  'source-supported property': 'Свойство опирается на выбранный текст',
  'clarify core action': 'Уточнить главное действие',
  'add one constraint': 'Добавить одно ограничение',
  'resolve a contradiction': 'Разрешить противоречие',
  'answer a question': 'Ответить на вопрос',
  'explore an alternative': 'Предложить альтернативу',
  'propose a small test': 'Предложить небольшую проверку',
  source: 'Исходная идея',
  candidate: 'Новая идея',
  local: 'Внутри сада',
  cross: 'С донором',
  exact: 'Точный повтор',
  'similar title': 'Совпадает название',
};
export const label = (s: string | undefined) => (s ? (labels[s] ?? s) : 'Пока нет решения');
export function explain(reason: string): string {
  if (!reason) return '';
  if (/Response contract limits|Invalid text field|Invalid bounded list/.test(reason))
    return 'Модель нарушила ограничения формата ответа. Карточка не создана; исходный ответ сохранён, слот остался доступен. Подробная причина — в сохранённой попытке.';
  if (/Provider configuration changed|Remote consent invalid/.test(reason))
    return 'Подключение или разрешение изменилось. Просмотрите контекст и подтвердите новую попытку.';
  if (
    /Claude process failed|Claude returned|Remote response|Remote transport|Groq HTTP/.test(reason)
  )
    return 'Внешний сервис не завершил корректный ответ. Полученные данные сохранены; повтор возможен только вручную.';
  if (reason.startsWith('Waiting for interval; next attempt '))
    return (
      'Следующая попытка — ' +
      new Date(reason.slice('Waiting for interval; next attempt '.length)).toLocaleString('ru-RU')
    );
  if (/One persisted probability draw/.test(reason))
    return 'Маршрут выбран один раз и сохранён. Обновление окна не меняет выбор.';
  if (/Explicit manual route/.test(reason)) return 'Родители выбраны явно для этой попытки.';
  if (reason.startsWith('admission:')) return reason.slice(11);
  if (/choose the target profile/.test(reason))
    return 'Выберите тип сада в его настройках, чтобы модель знала, какую идею создавать.';
  if (/^needs_context:/.test(reason))
    return 'Недостаточно обязательных сведений. В подготовке исходной идеи уточните механизм, термины или свойства референса.';
  if (/Waiting for .*model calls|call.*budget|call allowance/i.test(reason))
    return 'На обычную попытку нужны два вызова модели; третий может понадобиться для исправления формата. Дождитесь нового дня или проверьте дневной лимит.';
  if (/attempt limit/i.test(reason))
    return 'Дневной лимит попыток исчерпан. Следующая попытка будет доступна в новом учётном дне.';
  if (/candidate limit/i.test(reason))
    return 'Дневной лимит новых карточек исчерпан. Просмотрите имеющиеся идеи или дождитесь нового дня.';
  if (/Review pending|backlog/i.test(reason))
    return 'Очередь просмотра заполнена. Оцените новые идеи и предложения развития.';
  if (/garden credit|Credit is unavailable/i.test(reason))
    return 'В этом саду пока нет свободного слота. Новый слот появляется каждые 15 минут.';
  if (/no eligible unused|frozen selection|Selection consent|Selection policy/i.test(reason))
    return 'Для сохранённого маршрута пока нет доступной пары. Проверьте участие исходников и разрешения доноров либо явно отмените маршрут.';
  if (/profile|target profile/i.test(reason))
    return 'Выберите тип сада в его настройках, чтобы модель знала, какую идею создавать.';
  if (
    /Receipt storage|Original response|emergency|Persistence|checksum|backup|Lifecycle|evidence gap/i.test(
      reason,
    )
  )
    return 'Не удалось надёжно сохранить все данные. Сохраните полную приватную копию и проверьте хранилище перед продолжением.';
  if (/Export|export/i.test(reason))
    return 'Не удалось обновить папку для чтения. Проверьте доступ к папке в настройках и повторите экспорт.';
  if (/Clock|clock|Accounting date/i.test(reason))
    return 'Изменились часы или учётный день. Проверьте дату и часовой пояс перед новым запуском.';
  if (/Install |installed|Ollama|model directory|Local model/i.test(reason))
    return 'Проверьте выбранную установленную модель и программу Ollama в настройках. Автоматической загрузки нет.';
  if (/timeout|truncated|format|JSON|contract|Citation|Draft exceeds/i.test(reason))
    return 'Модель не завершила корректный ответ. Полученный текст сохранён в черновиках; слот остался доступен.';
  if (/^[ -~]+$/.test(reason))
    return 'Действие не выполнено. Проверьте исходные идеи и настройки; точная причина сохранена в технических подробностях.';
  return reason;
}
export function jobTitle(j: Job): string {
  if (j.draft?.outcome === 'candidate' && !j.assessment) return 'Черновик создан, но не проверен';
  if (j.draft?.outcome === 'needs_context') return 'Для этой пары не хватило деталей';
  return label(j.stage);
}
export function modelReason(reason: string) {
  return /^[a-z_\d.-]+$/i.test(reason.trim()) ? 'Модель не объяснила причину' : reason;
}
export function funnel(w: Workspace, garden: string) {
  const jobs = w.jobs.filter(
    (j) =>
      j.garden === garden &&
      j.admission &&
      j.observed &&
      ['blend', 'growth', 'revise', 'check'].includes(j.operation),
  );
  return {
    attempts: jobs.filter((j) => j.attemptCharged && j.operation !== 'check').length,
    drafts: jobs.filter((j) => j.draft?.outcome === 'candidate' && j.operation !== 'check').length,
    dispatched: jobs.filter((j) => j.dispatches?.some((d) => d.stage.startsWith('screening')))
      .length,
    assessed: jobs.filter((j) => j.assessment).length,
    cards: w.nodes.filter(
      (n) =>
        n.garden === garden &&
        jobs.some((j) => j.id === n.job) &&
        !n.recorded &&
        !n.decisions.some((d) => d.override),
    ).length,
  };
}
