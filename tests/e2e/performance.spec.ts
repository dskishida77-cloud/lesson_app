import { expect, test } from '@playwright/test';
import { pillar, playMoves, startGame } from './helpers';

/** 要件9.1: 回転と落下は、おおむね 30fps 以上 / 要件9.3: 初回表示は数秒以内 */
const MIN_FPS = 30;
const MAX_FIRST_PAINT_MS = 3000;

/** 指定した時間の、requestAnimationFrame の平均フレームレートを測る */
const averageFps = (page: import('@playwright/test').Page, ms: number) =>
  page.evaluate(
    (duration) =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = () => {
          frames++;
          const elapsed = performance.now() - start;
          if (elapsed < duration) requestAnimationFrame(tick);
          else resolve(frames / (elapsed / 1000));
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );

test('初回表示: 開始画面が、数秒以内に操作できる', async ({ page }) => {
  const t0 = Date.now();
  await page.goto('/');
  await page.getByRole('button', { name: 'ローカル対戦' }).waitFor();
  const elapsed = Date.now() - t0;
  console.info(`開始画面の表示まで: ${elapsed} ms`);
  expect(elapsed).toBeLessThan(MAX_FIRST_PAINT_MS);
});

test('静止時と、盤面の回転中のフレームレートが、30fps 以上', async ({ page }) => {
  await startGame(page);
  await page.waitForTimeout(1000);

  const idle = await averageFps(page, 1500);

  const box = (await page.locator('canvas').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const measuring = averageFps(page, 2500);
  for (let i = 0; i < 40; i++) {
    await page.mouse.move(cx + Math.sin(i / 4) * 200, cy + Math.cos(i / 4) * 40);
    await page.waitForTimeout(50);
  }
  const orbit = await measuring;
  await page.mouse.up();

  console.info(`フレームレート: 静止時 ${idle.toFixed(1)} fps / 回転中 ${orbit.toFixed(1)} fps`);
  expect(idle).toBeGreaterThanOrEqual(MIN_FPS);
  expect(orbit).toBeGreaterThanOrEqual(MIN_FPS);
});

test('駒の落下中のフレームレートが、30fps 以上', async ({ page }) => {
  await startGame(page);
  await page.waitForTimeout(500);
  const measuring = averageFps(page, 900);
  await playMoves(page, [pillar(1, 1)], false);
  const fps = await measuring;
  console.info(`落下中: ${fps.toFixed(1)} fps`);
  expect(fps).toBeGreaterThanOrEqual(MIN_FPS);
});
