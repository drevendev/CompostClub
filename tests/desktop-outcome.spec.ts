// Real React/Chromium with authored IPC state, not an Electron or model receipt.
import { test, expect } from '@playwright/test';
import { fixture } from './coherent-fixtures';
import { prepareJob, dispatch, fail } from '../src/domain/coherent/workspace';
import { providerSnapshot } from '../src/domain/coherent/provider';
import type { CoherentView } from '../desktop/coherent-types';
type DiagnosticWindow = Window & { emitDiagnostic: (view: CoherentView) => void };
const now = Date.now(),
  base = fixture(now);
base.provider = { kind: 'claude', revision: 1, model: 'sonnet' };
function view(w = structuredClone(base)): CoherentView {
  return {
    workspace: w,
    busy: false,
    status: 'paused',
    reason: 'DIAGNOSTIC: paused',
    activeJob: null,
    preview: null,
    backups: [],
    receiptCount: 0,
    dataDirectory: 'DIAGNOSTIC ONLY',
    model: { connected: false, digest: '' },
    exportStatus: null,
    autostart: false,
    eureka: w.gardens.map((g) => ({ garden: g.id, reason: '' })),
    provider: {
      ...providerSnapshot(w.provider, w.runtime.model),
      credentialAvailable: true,
      credentialPresent: true,
    },
    claudeToken: { available: true, present: true },
    telemetry: { enabled: false },
  };
}
function failedView() {
  const w = structuredClone(base),
    j = prepareJob(w, w.gardens[0]!.id, 'blend', now);
  j.manualPermit = true;
  dispatch(w, j.id, 'generating', now);
  dispatch(w, j.id, 'generating', now + 1, true);
  j.primaryFailure = 'Response contract limits: $.summary maxLength 385/360';
  j.repairRefusal = 'Response contract limits: $.interaction maxLength 266/240';
  fail(w, j, j.primaryFailure, now + 2);
  return view(w);
}
test('diagnostic IPC: asynchronous Eureka failure is visible, inspectable and dismissible without another call', async ({
  page,
}) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:4197/'))
      external.push(r.url());
  });
  await page.addInitScript((initial) => {
    let current = initial;
    const listeners = new Set<(v: CoherentView) => void>();
    window.compost = {
      invoke: async () => structuredClone(current),
      subscribe: (fn) => {
        listeners.add(fn);
        return () => {
          listeners.delete(fn);
        };
      },
    };
    (window as unknown as DiagnosticWindow).emitDiagnostic = (next) => {
      current = next;
      for (const listener of listeners) listener(structuredClone(next));
    };
  }, view());
  await page.goto('/desktop.html');
  await expect(page.getByRole('button', { name: 'Эврика', exact: true })).toBeVisible();
  const first = failedView();
  await page.evaluate(
    (next) => (window as unknown as DiagnosticWindow).emitDiagnostic(next),
    first,
  );
  const notice = page.getByRole('status', { name: 'Результат последней попытки' });
  await expect(notice).toContainText('Последняя попытка не создала карточку');
  await expect(notice).toContainText('Учтено вызовов: 2. Слот сохранён.');
  await notice.getByRole('button', { name: 'Открыть сохранённую попытку' }).click();
  await expect(
    page.getByRole('heading', { name: 'Черновики и остановки', exact: true }),
  ).toBeVisible();
  await expect(page.locator('#attempt-' + first.workspace.jobs.at(-1)!.id)).toBeFocused();
  await notice.getByRole('button', { name: 'Скрыть результат попытки' }).click();
  await expect(notice).toHaveCount(0);
  await page.evaluate(
    (next) => (window as unknown as DiagnosticWindow).emitDiagnostic(next),
    first,
  );
  await expect(notice).toHaveCount(0);
  await page.evaluate(
    (next) => (window as unknown as DiagnosticWindow).emitDiagnostic(next),
    failedView(),
  );
  await expect(notice).toBeVisible();
  await page.setViewportSize({ width: 430, height: 932 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.addStyleTag({ content: 'html {font-size:200%}' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Эврика', exact: true })).toBeEnabled();
  expect(external).toEqual([]);
});
