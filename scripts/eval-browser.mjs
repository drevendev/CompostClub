import { chromium } from '@playwright/test';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';

// Development-only experiment runner. The page executes the same real worker as the app.
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await mkdir('evidence/model', { recursive: true });
const stamp = new Date().toISOString().replaceAll(':', '-'),
  file = `evidence/model/browser-${stamp}.jsonl`;
await page.goto('http://127.0.0.1:4188/experiments/index.html');
const hardware = await page.evaluate(async () => {
  const a = await navigator.gpu?.requestAdapter();
  return {
    browser: navigator.userAgent,
    gpu: a
      ? {
          vendor: a.info.vendor,
          architecture: a.info.architecture,
          device: a.info.device,
          description: a.info.description,
        }
      : null,
    shaderF16: a?.features.has('shader-f16'),
  };
});
await writeFile(file, JSON.stringify({ type: 'session', stamp, hardware }) + '\n');
for (const [key, label] of [
  ['270m', 'Gemma 3 270M'],
  ['1b', 'Gemma 3 1B'],
]) {
  await page.getByLabel('Model', { exact: true }).selectOption(key);
  await page.getByRole('button', { name: 'Consent & load model' }).click();
  await page.waitForFunction(
    () => document.querySelector('pre')?.textContent?.includes('"type":"loaded"'),
    {},
    { timeout: 600000 },
  );
  const load = (await page.locator('pre').innerText())
    .split('\n')
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .find((l) => l?.type === 'loaded');
  await appendFile(file, JSON.stringify({ type: 'load', model: label, ...load }) + '\n');
  for (const language of ['en', 'ru']) {
    await page.getByLabel('Output language', { exact: true }).selectOption(language);
    if (language === 'ru') {
      await page
        .getByLabel('Input A', { exact: true })
        .fill(
          'Тихий робот собирает потерянные слова с кухонного стола. Из двух случайных слов он предлагает смешное название нового блюда.',
        );
      await page
        .getByLabel('Input B', { exact: true })
        .fill(
          'Сад, где ненужные обещания превращаются в растения. Можно отпустить одно обещание и сохранить маленькую полезную мысль, которая в нём была.',
        );
    }
    await page.getByRole('button', { name: 'Generate real blend' }).click();
    await page.waitForFunction(
      () => document.querySelector('pre')?.textContent?.includes('"type":"result"'),
      {},
      { timeout: 180000 },
    );
    const text = await page.locator('pre').innerText();
    await appendFile(
      file,
      JSON.stringify({ type: 'experiment', model: label, language, logs: text }) + '\n',
    );
    console.log(label, language, text.slice(-1800));
  }
  await page.reload();
}
await browser.close();
console.log(file);
