import { lazy } from 'react';

/** 3D 描画（three など）は大きいため、開始画面の表示を妨げないよう、別ファイルに分けて読み込む */
const load = () => import('./BoardScene');

export const BoardScene = lazy(() => load().then((m) => ({ default: m.BoardScene })));

/** 開始画面を見ている間に、読み込みを済ませておく */
export function preloadBoardScene(): void {
  void load();
}
