import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { applyMove, createGame } from '../../src/core';
import type { GameState, PillarPos } from '../../src/core';
import { CAMERA_FOV, INITIAL_CAMERA_POSITION, INITIAL_TARGET } from '../../src/render/camera';
import { PILLAR_HEIGHT, pillarToWorld } from '../../src/render/layout';
import { DRAW_LAYOUT } from '../fixtures/drawLayout';

export const pillar = (x: number, z: number): PillarPos => ({ x, z });

/** メニューで「ローカル対戦」を選び、設定画面（名前・先手）を開く */
export async function openLocalSetup(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'ローカル対戦' }).click();
}

/** 開始画面から、既定の名前でゲームを始める */
export async function startGame(page: Page) {
  await openLocalSetup(page);
  await page.getByRole('button', { name: 'ゲーム開始' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await waitForCanvasSized(page);
}

/**
 * キャンバスが、盤面の領域いっぱいにリサイズされるまで待つ。
 * 描画の準備前は、初期サイズ（300x150）のままで、座標の計算がずれるため。
 */
export async function waitForCanvasSized(page: Page) {
  await expect
    .poll(async () => {
      const canvas = await page.locator('canvas').boundingBox();
      const board = await page.locator('.board').boundingBox();
      if (!canvas || !board) return false;
      return Math.abs(canvas.width - board.width) < 2 && Math.abs(canvas.height - board.height) < 2;
    })
    .toBe(true);
}

/**
 * 初期カメラでの、柱の画面上の位置（ページ座標）を計算する。
 * 手前の柱の当たり判定に邪魔されないよう、柱の上端に近い点を狙う。
 */
export async function pillarPoint(page: Page, p: PillarPos) {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('canvas が見つかりません');
  const camera = new PerspectiveCamera(CAMERA_FOV, box.width / box.height, 0.1, 1000);
  camera.position.set(...INITIAL_CAMERA_POSITION);
  camera.lookAt(...INITIAL_TARGET);
  camera.updateMatrixWorld();
  const [x, z] = pillarToWorld(p);
  const ndc = new Vector3(x, PILLAR_HEIGHT - 0.12, z).project(camera);
  return {
    x: box.x + ((ndc.x + 1) / 2) * box.width,
    y: box.y + ((1 - ndc.y) / 2) * box.height,
  };
}

/** マウス（PC）またはタッチ（スマートフォン）で、柱を選ぶ */
export async function selectPillar(page: Page, p: PillarPos, touch: boolean) {
  const { x, y } = await pillarPoint(page, p);
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** 柱を順に選び、そのたびに手数が増える（落下が終わる）のを待つ */
export async function playMoves(page: Page, pillars: PillarPos[], touch: boolean, startCount = 0) {
  for (const [i, p] of pillars.entries()) {
    await selectPillar(page, p, touch);
    await expect(page.locator('.hud-moves')).toHaveText(`手数: ${startCount + i + 1}`);
    // 手数は着手の直後に増える。落下アニメーションが終わるまで、次の入力は無視されるため待つ
    await expect(page.getByRole('button', { name: '1手戻す' })).toBeEnabled();
  }
}

/** 先手が縦に4つ積んで勝つ手順（柱 A は先手、柱 B は後手） */
export const WIN_SEQUENCE: PillarPos[] = [
  pillar(0, 0), pillar(1, 0), pillar(0, 0), pillar(1, 0), pillar(0, 0), pillar(1, 0), pillar(0, 0),
];

/** 勝者なしで64手を打ち切る手順を、探索して求める */
export function drawSequence(): PillarPos[] {
  const ownerAt = (x: number, y: number, z: number) => (DRAW_LAYOUT[x * 4 + z]![y] === '1' ? 1 : 0);
  const search = (state: GameState, path: PillarPos[]): PillarPos[] | null => {
    if (state.history.length === 64) return path;
    for (let x = 0; x < 4; x++) {
      for (let z = 0; z < 4; z++) {
        const y = state.cells[x]![z]!.indexOf(null);
        if (y === -1 || ownerAt(x, y, z) !== state.current) continue;
        const r = applyMove(state, pillar(x, z));
        if (!r.ok) continue;
        const found = search(r.state, [...path, pillar(x, z)]);
        if (found) return found;
      }
    }
    return null;
  };
  const found = search(createGame(0), []);
  if (!found) throw new Error('引き分けの手順が見つかりません');
  return found;
}
