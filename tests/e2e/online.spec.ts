import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { pillar, selectPillar, waitForCanvasSized } from './helpers';

/**
 * 実際の Supabase に接続して、2つのブラウザで、ルーム作成から決着・再戦までを通す（要件19.5）。
 *
 * 実行の条件（満たさなければ、スキップされる）:
 *   1. .env.local に、VITE_SUPABASE_URL と VITE_SUPABASE_PUBLISHABLE_KEY がある（ビルドに含まれる）
 *   2. Supabase で、匿名サインインが有効で、supabase/migrations/ の SQL を実行済み
 *   3. 環境変数 ONLINE_E2E=1 を付けて実行する:  ONLINE_E2E=1 npx playwright test online
 * 実行のたびに、Supabase の rooms テーブルに、テスト用のルームが1行できる。
 */
// Node の型定義を入れていないため、環境変数は globalThis 経由で読む
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

test.beforeEach(({}, testInfo) => {
  test.skip(!env.ONLINE_E2E, 'ONLINE_E2E=1 のときだけ実行する（実際の Supabase に接続するため）');
  test.skip(testInfo.project.name !== 'desktop', 'デスクトップのみで実行する');
});

const hud = (page: Page) => page.locator('.hud-moves');

async function waitForMoves(page: Page, n: number) {
  await expect(hud(page)).toHaveText(`手数: ${n}`, { timeout: 15_000 });
  // 着地のアニメーションが終わるまで、次の入力は無視されるため、待つ
  await page.waitForTimeout(900);
}

test('ルームを作り、招待リンクで友人が参加し、交互に打って、決着・再戦まで遊べる', async ({ browser }) => {
  const viewport = { width: 1280, height: 720 };
  const hostCtx = await browser.newContext({ viewport });
  const guestCtx = await browser.newContext({ viewport });
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  // ホスト: ルームを作る
  await host.goto('/');
  await host.getByRole('button', { name: 'オンライン対戦' }).click();
  await host.getByLabel('あなたの名前').fill('ホスト');
  await host.getByRole('button', { name: 'ルームを作る' }).click();
  await expect(host.getByText('相手の参加を待っています')).toBeVisible({ timeout: 20_000 });
  const link = await host.getByLabel('招待リンク').inputValue();
  expect(link).toMatch(/\?room=[A-HJKMNP-Z2-9]{6}$/);

  // ゲスト: 招待リンクから、参加する
  await guest.goto(link);
  await expect(guest.getByLabel('ルームコード')).not.toHaveValue('');
  await guest.getByLabel('あなたの名前').fill('ゲスト');
  await guest.getByRole('button', { name: '参加する' }).click();
  await expect(guest.locator('canvas')).toBeVisible({ timeout: 20_000 });

  // ホストの画面は、自動で対局に切り替わる
  await expect(host.locator('canvas')).toBeVisible({ timeout: 20_000 });
  await waitForCanvasSized(host);
  await waitForCanvasSized(guest);
  await expect(host.getByText('あなたの番です')).toBeVisible();
  await expect(guest.getByText('相手の番です')).toBeVisible();

  // 相手の手番で打っても、着手されない
  await selectPillar(guest, pillar(1, 0), false);
  await expect(guest.getByRole('alert')).toContainText('相手の手番です');
  await expect(hud(guest)).toHaveText('手数: 0');

  // ホストが縦に4つ積んで勝つ（ゲストは、別の柱に積む）
  const sequence = [
    { who: host, p: pillar(0, 0) }, { who: guest, p: pillar(1, 0) },
    { who: host, p: pillar(0, 0) }, { who: guest, p: pillar(1, 0) },
    { who: host, p: pillar(0, 0) }, { who: guest, p: pillar(1, 0) },
    { who: host, p: pillar(0, 0) },
  ];
  for (const [i, step] of sequence.entries()) {
    await selectPillar(step.who, step.p, false);
    await waitForMoves(host, i + 1);
    await waitForMoves(guest, i + 1);
  }

  for (const page of [host, guest]) {
    await expect(page.locator('.hud-result')).toHaveText('ホストの勝ち！', { timeout: 15_000 });
    await expect(page.getByRole('dialog', { name: '対局結果' })).toBeVisible();
    await expect(page.getByLabel('通算成績')).toContainText('ホスト 1勝');
  }

  // ゲストが再戦を押すと、双方で新しい対局になり、ゲストが先手になる
  await guest.getByRole('button', { name: 'もう一度遊ぶ' }).click();
  await expect(hud(host)).toHaveText('手数: 0', { timeout: 15_000 });
  await expect(hud(guest)).toHaveText('手数: 0');
  await expect(guest.getByText('あなたの番です')).toBeVisible();
  await expect(host.getByText('相手の番です')).toBeVisible();
  await expect(host.getByLabel('通算成績')).toContainText('ホスト 1勝');

  // ホストが再読み込みしても、対局に復帰する
  await host.reload();
  await host.getByRole('button', { name: 'オンライン対戦' }).click();
  await expect(host.locator('canvas')).toBeVisible({ timeout: 20_000 });
  await expect(host.getByLabel('オンライン対戦の状態')).toContainText('あなた: ホスト');

  await hostCtx.close();
  await guestCtx.close();
});

test('参加者でない第三者は、満員のルームに入れない', async ({ browser }) => {
  const viewport = { width: 1280, height: 720 };
  const [a, b, c] = await Promise.all([1, 2, 3].map(() => browser.newContext({ viewport })));
  const host = await a!.newPage();
  const guest = await b!.newPage();
  const stranger = await c!.newPage();

  await host.goto('/');
  await host.getByRole('button', { name: 'オンライン対戦' }).click();
  await host.getByLabel('あなたの名前').fill('ホスト');
  await host.getByRole('button', { name: 'ルームを作る' }).click();
  const link = await host.getByLabel('招待リンク').inputValue({ timeout: 20_000 });

  await guest.goto(link);
  await guest.getByLabel('あなたの名前').fill('ゲスト');
  await guest.getByRole('button', { name: '参加する' }).click();
  await expect(guest.locator('canvas')).toBeVisible({ timeout: 20_000 });

  await stranger.goto(link);
  await stranger.getByLabel('あなたの名前').fill('第三者');
  await stranger.getByRole('button', { name: '参加する' }).click();
  await expect(stranger.getByRole('alert')).toContainText('すでに2人が揃っています', { timeout: 15_000 });

  await Promise.all([a!.close(), b!.close(), c!.close()]);
});
