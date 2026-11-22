import { expect, test } from '@playwright/test';
import { openLocalSetup, pillar, playMoves, startGame, WIN_SEQUENCE } from './helpers';

test.describe('セキュリティ・プライバシー（要件10）', () => {
  test('1局を通して遊んでも、通信は自分のサイトだけで、CSP違反も起きない', async ({ page, baseURL, hasTouch }) => {
    const origin = new URL(baseURL!).origin;
    const external: string[] = [];
    const violations: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) external.push(url);
    });
    page.on('console', (msg) => {
      if (/Content Security Policy/i.test(msg.text())) violations.push(msg.text());
    });

    await startGame(page);
    await playMoves(page, WIN_SEQUENCE, hasTouch);
    await expect(page.locator('.hud-result')).toHaveText('プレイヤー1の勝ち！');
    await page.getByRole('button', { name: '遊び方' }).click();
    await page.getByRole('button', { name: '閉じる' }).click();

    expect(external).toEqual([]);
    expect(violations).toEqual([]);
  });

  test('公開用ビルドには、Content-Security-Policy が付いている', async ({ page }) => {
    await page.goto('/');
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("object-src 'none'");
  });

  test('保存されるのは効果音の設定だけで、Cookie は使わない', async ({ page, hasTouch }) => {
    await startGame(page);
    await playMoves(page, [pillar(0, 0), pillar(1, 1)], hasTouch);
    await page.getByRole('button', { name: '効果音: オン' }).click();
    const storage = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
      cookie: document.cookie,
    }));
    expect(storage.local).toEqual(['connect4-3d:settings']);
    expect(storage.session).toEqual([]);
    expect(storage.cookie).toBe('');
    const dbs = await page.evaluate(async () => (await indexedDB.databases?.())?.length ?? 0);
    expect(dbs).toBe(0);
  });

  test('スクリプトを含む名前は、文字として表示され、実行されない。12文字に切り詰められる', async ({ page }) => {
    let dialogOpened = false;
    page.on('dialog', async (d) => {
      dialogOpened = true;
      await d.dismiss();
    });
    await openLocalSetup(page);
    const payload = '<img src=x onerror=alert(1)>';
    await page.getByLabel('プレイヤー1の名前').fill(payload);
    await page.getByRole('button', { name: 'ゲーム開始' }).click();
    // 12文字に切り詰められ、HTML としてではなく、文字としてそのまま表示される
    await expect(page.locator('.hud-turn strong')).toHaveText('<img src=x o');
    await expect(page.locator('.hud-turn')).not.toContainText('onerror');
    await expect(page.locator('.hud img')).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(dialogOpened).toBe(false);
  });
});
