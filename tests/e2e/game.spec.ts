import { expect, test } from '@playwright/test';
import { drawSequence, openLocalSetup, pillar, playMoves, selectPillar, startGame, WIN_SEQUENCE } from './helpers';

test.describe('対戦の流れ', () => {
  test('柱を選ぶと駒が置かれ、手番が切り替わる', async ({ page, hasTouch }) => {
    await startGame(page);
    await expect(page.locator('.hud-turn')).toContainText('プレイヤー1');
    await playMoves(page, [pillar(1, 1)], hasTouch);
    await expect(page.locator('.hud-turn')).toContainText('プレイヤー2');
  });

  test('落下中に別の柱を選んでも、受け付けない', async ({ page, hasTouch }) => {
    await startGame(page);
    await selectPillar(page, pillar(0, 0), hasTouch);
    await selectPillar(page, pillar(1, 1), hasTouch);
    await expect(page.locator('.hud-moves')).toHaveText('手数: 1');
    await expect(page.getByRole('button', { name: '1手戻す' })).toBeEnabled();
    await expect(page.locator('.hud-moves')).toHaveText('手数: 1');
  });

  test('ドラッグ（回転）は、着手として扱われない', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'タッチのドラッグは、Playwrightの標準操作では再現できないため、PCのみ');
    await startGame(page);
    const box = (await page.locator('canvas').boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 160, cy + 20, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('.hud-moves')).toHaveText('手数: 0');
  });

  test('先手が縦に4つ並べて勝つ。結果と通算成績が表示され、再戦できる', async ({ page, hasTouch }) => {
    await startGame(page);
    await playMoves(page, WIN_SEQUENCE.slice(0, 6), hasTouch);
    await expect(page.locator('.hud-result')).toBeEmpty();
    await playMoves(page, WIN_SEQUENCE.slice(6), hasTouch, 6);

    await expect(page.locator('.hud-result')).toHaveText('プレイヤー1の勝ち！');
    const dialog = page.getByRole('dialog', { name: '対局結果' });
    await expect(dialog).toContainText('プレイヤー1の勝ち');
    await expect(page.getByLabel('通算成績')).toContainText('プレイヤー1 1勝');
    await expect(page.locator('.confetti-piece').first()).toBeAttached();

    // 終了後に柱を選んでも、着手されない
    await selectPillar(page, pillar(2, 2), hasTouch);
    await expect(page.locator('.hud-moves')).toHaveText('手数: 7');

    // 先手と後手を入れ替えて再戦。通算成績は保たれる
    await dialog.getByLabel('先手と後手を入れ替える').check();
    await dialog.getByRole('button', { name: 'もう一度遊ぶ' }).click();
    await expect(page.locator('.hud-moves')).toHaveText('手数: 0');
    await expect(page.locator('.hud-turn')).toContainText('プレイヤー2');
    await expect(page.getByLabel('通算成績')).toContainText('プレイヤー1 1勝');
  });

  test('64手で勝者が出なければ、引き分けになる', async ({ browser }) => {
    // 64手を速く打てるよう、「視覚効果を減らす」設定（落下を省く）で実行する
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await startGame(page);
    await playMoves(page, drawSequence(), false);
    await expect(page.locator('.hud-result')).toHaveText('引き分け');
    await expect(page.getByLabel('通算成績')).toContainText('引き分け1');
    await context.close();
  });

  test('満杯の柱を選ぶと通知が出て、状態は変わらない', async ({ page, hasTouch }) => {
    await startGame(page);
    await playMoves(page, [pillar(2, 2), pillar(2, 2), pillar(2, 2), pillar(2, 2)], hasTouch);
    await selectPillar(page, pillar(2, 2), hasTouch);
    await expect(page.getByRole('alert')).toHaveText('この柱は満杯です');
    await expect(page.locator('.hud-moves')).toHaveText('手数: 4');
  });
});

test.describe('操作', () => {
  test('1手戻すと、手数と手番が戻る', async ({ page, hasTouch }) => {
    await startGame(page);
    await expect(page.getByRole('button', { name: '1手戻す' })).toBeDisabled();
    await playMoves(page, [pillar(0, 0), pillar(1, 1)], hasTouch);
    await page.getByRole('button', { name: '1手戻す' }).click();
    await expect(page.locator('.hud-moves')).toHaveText('手数: 1');
    await expect(page.locator('.hud-turn')).toContainText('プレイヤー2');
  });

  test('新しいゲーム: 進行中は確認が出て、キャンセルなら継続、承諾なら初期化される', async ({ page, hasTouch }) => {
    await startGame(page);
    await playMoves(page, [pillar(0, 0)], hasTouch);

    await page.getByRole('button', { name: '新しいゲーム' }).click();
    const dialog = page.getByRole('dialog', { name: '確認' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'キャンセル' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.hud-moves')).toHaveText('手数: 1');

    await page.getByRole('button', { name: '新しいゲーム' }).click();
    await dialog.getByRole('button', { name: '最初から始める' }).click();
    await expect(page.locator('.hud-moves')).toHaveText('手数: 0');
  });

  test('プレイヤー名と先手を、開始前に設定できる', async ({ page }) => {
    await openLocalSetup(page);
    await page.getByLabel('プレイヤー1の名前').fill('あや');
    await page.getByLabel('プレイヤー2の名前').fill('ゆう');
    await page.getByLabel('プレイヤー2が先手').check();
    await page.getByRole('button', { name: 'ゲーム開始' }).click();
    await expect(page.locator('.hud-turn')).toContainText('ゆう');
  });

  test('遊び方を開閉でき、進行中の盤面は変わらない', async ({ page, hasTouch }) => {
    await startGame(page);
    await playMoves(page, [pillar(0, 0)], hasTouch);
    await page.getByRole('button', { name: '遊び方' }).click();
    await expect(page.getByRole('dialog', { name: '遊び方' })).toContainText('立体');
    await page.getByRole('button', { name: '閉じる' }).click();
    await expect(page.getByRole('dialog', { name: '遊び方' })).toBeHidden();
    await expect(page.locator('.hud-moves')).toHaveText('手数: 1');
  });

  test('効果音の設定は、再読み込み後も保たれる', async ({ page }) => {
    await startGame(page);
    await page.getByRole('button', { name: '効果音: オン' }).click();
    await expect(page.getByRole('button', { name: '効果音: オフ' })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'ローカル対戦' }).click();
    await page.getByRole('button', { name: 'ゲーム開始' }).click();
    await expect(page.getByRole('button', { name: '効果音: オフ' })).toBeVisible();
  });
});

test.describe('モード選択', () => {
  test('最初にモードを選ぶ。接続設定がなければ、オンライン対戦は選べず、ローカル対戦は遊べる', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'ローカル対戦' })).toBeEnabled();
    // Supabase の接続設定（.env.local）を入れてビルドしている場合は、オンライン対戦が有効になるため、この確認は行わない
    test.skip(await page.getByRole('button', { name: 'オンライン対戦' }).isEnabled(), 'Supabase の接続設定あり');
    await expect(page.getByRole('button', { name: 'オンライン対戦' })).toBeDisabled();
    await expect(page.getByText(/設定されていないため/)).toBeVisible();
  });

  test('対局中のメニューへの戻りは、確認が出て、承諾するとモード選択に戻る', async ({ page, hasTouch }) => {
    await startGame(page);
    await playMoves(page, [pillar(0, 0)], hasTouch);
    await page.getByRole('button', { name: 'メニューへ' }).click();
    const dialog = page.getByRole('dialog', { name: '確認' });
    await expect(dialog).toContainText('メニューへ戻りますか');
    await dialog.getByRole('button', { name: 'メニューへ戻る' }).click();
    await expect(page.getByRole('button', { name: 'ローカル対戦' })).toBeVisible();
  });
});

test.describe('画面サイズ', () => {
  test('横スクロールが出ず、盤面と主要ボタンが画面内に収まる', async ({ page }) => {
    await startGame(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const viewport = page.viewportSize()!;
    const canvas = (await page.locator('canvas').boundingBox())!;
    expect(canvas.x).toBeGreaterThanOrEqual(0);
    expect(canvas.x + canvas.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(canvas.height).toBeGreaterThan(200);

    for (const name of ['1手戻す', '新しいゲーム', '視点リセット', /効果音/, '遊び方']) {
      const box = (await page.getByRole('button', { name }).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('3D表示に対応していない環境', () => {
  test('WebGL が使えない場合は、案内を表示する', async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      // WebGL のコンテキストだけ取得に失敗させる（2D など、他の種類はそのまま）
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: never[]) {
        if (type === 'webgl' || type === 'webgl2') return null;
        return original.call(this, type as '2d', ...rest);
      } as typeof original;
    });
    await openLocalSetup(page);
    await page.getByRole('button', { name: 'ゲーム開始' }).click();
    await expect(page.getByRole('alert')).toContainText('3D表示（WebGL）が利用できません');
  });
});
