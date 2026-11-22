# Implementation Plan

状態の凡例: 🔴 未実装 / 🟢 最小実装済（テスト成功） / ✅️ リファクタリング済 / ⚠️ ブロック済

進め方: 各タスクは TDD（テストを先に書く）で進め、タスク単位でコミットする。使用ライブラリとバージョンは design.md の「Technology Stack」に従い、変更する場合は事前にユーザーの合意を得る。

## Phase 1: MVP (Minimum Viable Product)
ゲームが 3D 盤面でエンドツーエンドに遊べる状態（着手・勝敗・手番表示）まで。

- ✅️ 1. プロジェクトの環境構築
  - Vite + React + TypeScript（strict）のプロジェクトを、`lesson_app` 直下に作成する
  - 依存追加: `react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei`（バージョンは design.md の表に従う）
  - 開発依存: `vitest`, `jsdom`, `@testing-library/react`, `@types/*`
  - `package.json` に `dev` / `build` / `test` / `typecheck` スクリプトを定義する
  - `.gitignore` を作成し、`git init` して初回コミットを行う
  - 空のテストが1つ通ることを確認する
  - _Requirements: 11.4, 12.2, 12.3, 12.4_

- ✅️ 2. core: 型定義とライン生成
  - `src/core/types.ts` に design.md の Core Interfaces を定義する（`PlayerId`, `PillarPos`, `CellPos`, `Cells`, `Move`, `GameStatus`, `GameState`, `MoveError`, `MoveResult`）
  - `src/core/lines.ts` に `WIN_LINES`（76ライン）を生成する
  - テスト: 総数76、軸方向48・平面斜め24・立体対角線4、各ラインが4マスで、重複がないこと
  - _Requirements: 3.1, 11.1, 11.2_

- ✅️ 3. core: 着手と状態管理
  - `src/core/game.ts` に `createGame`, `applyMove`, `getDropHeight` を実装する（状態は不変）
  - 駒は最下段の空きマスに積まれ、着手後に手番が交代する
  - 満杯の柱は `PILLAR_FULL`、範囲外は `OUT_OF_RANGE` を返し、状態は不変にする（例外は投げない）
  - テスト: 積み上がり、手番交代、不正操作、入力状態が書き換わらないこと
  - _Requirements: 2.1, 2.3, 2.5, 11.1, 11.3_

- ✅️ 4. core: 勝敗・引き分け判定
  - `checkResult` を実装し、直近の着手を含むラインのみ確認する
  - 4連続で `won`（同時成立は全ラインを返す）、64マス埋まって勝者なしで `draw`
  - 終了後の着手は `GAME_OVER` を返す
  - テスト: 76ラインそれぞれで勝ちになること（全網羅）、3連続や相手の駒の混在、同時成立、引き分け
  - _Requirements: 3.1, 3.2, 3.5, 3.6, 11.2, 11.3_

- ✅️ 5. core: 1手戻す
  - `undo` を実装する（履歴が空なら同じ状態を返す。終了状態からも戻せる）
  - テスト: 着手→取り消しで元に戻ること、連続して最初まで戻れること
  - `src/core/index.ts` で公開APIをまとめる
  - _Requirements: 5.2, 11.1_

- ✅️ 6. useGame フック（最小版）
  - `src/app/useGame.ts` を `useReducer` で実装する
  - 公開: `state`, `startGame`, `selectPillar`, `names`（既定名「プレイヤー1」「プレイヤー2」）
  - テスト（`renderHook`）: 着手から勝利までの流れ、終了後の入力が無視されること
  - _Requirements: 2.1, 2.5, 3.2, 4.2_

- ✅️ 7. 3D 盤面の描画（静的）
  - `src/render/BoardScene.tsx` に `<Canvas>`、土台、16本の柱、照明を実装する
  - `Disc` コンポーネントで、`GameState` の駒を描画する
  - 先手と後手を色と形（球 / くぼみ付き円盤）の両方で区別する
  - drei の `OrbitControls` で、回転・拡大縮小を実装する（距離と角度に制限をかけ、盤面全体が見える状態を維持）
  - WebGL 非対応時は、日本語の案内を表示する
  - 注: jsdom では動かないため、描画の確認はブラウザで行う
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 8.5_

- ✅️ 8. 柱の選択（着手の入力）
  - `Pillar` コンポーネントに、太めの透明な当たり判定メッシュを持たせる
  - R3F の `onClick` の移動量（`delta`）が閾値（6px）未満のものだけを選択とする
  - 満杯の柱を選択した場合は、着手せず通知用のコールバックを呼ぶ
  - _Requirements: 2.1, 2.3, 2.6_

- ✅️ 9. 最小 UI と App の結合
  - `src/app/App.tsx` / `src/main.tsx` で、盤面と HUD を結合する
  - HUD: 現在の手番プレイヤー、手数、勝敗結果（勝者名または引き分け）
  - 開始画面は後続タスクで作るため、ここでは既定名で直ちに開始する
  - ブラウザで通しで遊べることを確認する
  - _Requirements: 3.3, 4.1, 4.3_

## Phase 2: ゲーム体験の完成
操作性と情報表示を、要件どおりに仕上げる。

- ✅️ 10. 駒の落下アニメーションと入力ロック
  - `Disc` に落下アニメーション（`useFrame`）を実装する
  - `useGame` に `isAnimating` と `onDropFinished` を追加し、アニメーション中の入力を無視する
  - 勝敗の表示は、落下の完了後に行う
  - テスト: アニメーション中の入力が無視されること（`BoardScene` をモック）
  - _Requirements: 2.4_

- ✅️ 11. プレビューと直前の駒の強調
  - ポインタを重ねた柱で、駒が置かれる位置のゴースト駒を表示する（`getDropHeight` を使用）
  - 直前に置かれた駒を強調表示する
  - 満杯の柱では、プレビューを出さない
  - _Requirements: 2.2, 4.4_

- ✅️ 12. 勝利ラインのハイライト
  - `GameStatus.won.lines` の駒を、他と区別できるように強調する（複数ライン対応）
  - _Requirements: 3.4, 3.6_

- ✅️ 13. 開始画面とプレイヤー名
  - `StartScreen` を実装する（名前入力、先手の選択）
  - 最大12文字に切り詰め、空は既定名にする（名前の正規化関数と単体テスト）
  - React の自動エスケープに任せ、`dangerouslySetInnerHTML` は使わない
  - _Requirements: 4.2, 10.2, 10.3_

- 🔴 14. 操作バー（新規・取り消し・再戦・視点リセット）
  - `ControlBar` と `ConfirmDialog` を実装する
  - 「新しいゲーム」: 進行中は確認ダイアログを出す
  - 「1手戻す」: `core` の `undo` を呼ぶ。最初の状態では無効化する
  - 「視点リセット」: `OrbitControls` の `ref` 経由で初期視点に戻す
  - 「もう一度遊ぶ」: 先手と後手を入れ替えられる
  - テスト: `useGame` の `restart(swapFirst)` と `undo`
  - _Requirements: 1.4, 5.1, 5.2, 5.3, 5.4_

- ✅️ 15. 通算成績
  - `src/app/ScoreBoard.ts`: `record` / `reset`（メモリ保持）
  - HUD に、各プレイヤーの勝ち数と引き分け数を表示する
  - 終了時に、1回だけ更新されること（二重加算の防止）をテストする
  - _Requirements: 5.5_

- 🔴 16. 通知（トースト）と結果ダイアログ
  - `Toast`: 「この柱は満杯です」を表示して、自動で消える
  - `ResultDialog`: 勝者名または引き分け、「もう一度遊ぶ」ボタン
  - _Requirements: 2.3, 3.3, 3.5, 5.3_

## Phase 3: 付加機能
効果音、演出、チュートリアル。

- 🔴 17. AudioService と SettingsStore
  - `src/audio/AudioService.ts`: Web Audio API で、着手音と勝利音を合成する（音源ファイルは使わない）
  - 最初のユーザー操作で `AudioContext` を開始する。非対応時は無音で継続する
  - `src/app/SettingsStore.ts`: `localStorage` のキー `connect4-3d:settings` に `soundEnabled` を保存する。アクセス不可でも例外にしない
  - 効果音のオン・オフボタンを `ControlBar` に追加する（初期値オン）
  - テスト: 保存・読込、アクセス不可時、無効時に再生されないこと（`AudioContext` はモック）
  - _Requirements: 7.1, 7.2, 10.4_

- 🔴 18. 勝利演出と「視覚効果を減らす」対応
  - 勝利時のお祝い演出を実装する（例: パーティクル）
  - `prefers-reduced-motion` が有効な場合は、落下と演出を簡略化する
  - _Requirements: 7.3, 7.4_

- 🔴 19. 遊び方ダイアログ
  - `HowToPlayDialog`: 盤面の構成、手番、勝利条件を説明する
  - 立体対角線を含む勝利パターンの例を、SVG の図で示す
  - ゲーム進行中に開いても、状態を壊さないこと（テストで確認）
  - _Requirements: 6.1, 6.2, 6.3_

## Phase 4: 品質保証と本番化

- 🔴 20. レスポンシブ対応とアクセシビリティ
  - 幅360px〜デスクトップでレイアウトが崩れないこと、縦向き・横向きの両対応
  - タッチターゲット 44px 以上、十分なコントラスト、キーボードで操作できるボタン
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- 🔴 21. E2E テスト（Playwright）
  - `@playwright/test` を導入する（バージョンは design.md に従う）
  - 柱のクリックで着手、ドラッグが着手にならないこと
  - 勝利・引き分けの表示、新しいゲームの確認ダイアログ、1手戻す
  - 幅360px とデスクトップの両方で、盤面とボタンが収まること
  - _Requirements: 2.1, 2.6, 3.3, 5.1, 5.2, 8.1_

- 🔴 22. パフォーマンス検証
  - `applyMove` のベンチマークを作成し、1手あたり 100ms 未満であることを確認する
  - Playwright の計測で、回転と落下中の平均フレームレートが 30fps 以上であること
  - ビルド成果物のサイズを確認し、初回表示が数秒以内となる範囲に収める
  - _Requirements: 9.1, 9.2, 9.3_

- 🔴 23. セキュリティ・プライバシーの確認
  - 外部へのネットワーク送信がないこと、`dangerouslySetInnerHTML` が使われていないことを確認する
  - 保存データが効果音設定のみであること、名前の上限が守られていることを確認する
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- 🔴 24. ドキュメントとビルド
  - `README.md`: 概要、環境構築、起動・テスト・ビルドのコマンド、ディレクトリ構成を記載する
  - `npm run build` の成果物（`dist/`）が静的ホスティングで動作することを確認する
  - `core` が React / three に依存していないことを確認する（将来のオンライン対戦への備え）
  - 全テストをコマンド1つで実行でき、失敗時に原因が分かる出力となること
  - _Requirements: 11.4, 12.1, 12.2, 12.3_
