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

- ✅️ 14. 操作バー（新規・取り消し・再戦・視点リセット）
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

- ✅️ 16. 通知（トースト）と結果ダイアログ
  - `Toast`: 「この柱は満杯です」を表示して、自動で消える
  - `ResultDialog`: 勝者名または引き分け、「もう一度遊ぶ」ボタン
  - _Requirements: 2.3, 3.3, 3.5, 5.3_

## Phase 3: 付加機能
効果音、演出、チュートリアル。

- ✅️ 17. AudioService と SettingsStore
  - `src/audio/AudioService.ts`: Web Audio API で、着手音と勝利音を合成する（音源ファイルは使わない）
  - 最初のユーザー操作で `AudioContext` を開始する。非対応時は無音で継続する
  - `src/app/SettingsStore.ts`: `localStorage` のキー `connect4-3d:settings` に `soundEnabled` を保存する。アクセス不可でも例外にしない
  - 効果音のオン・オフボタンを `ControlBar` に追加する（初期値オン）
  - テスト: 保存・読込、アクセス不可時、無効時に再生されないこと（`AudioContext` はモック）
  - _Requirements: 7.1, 7.2, 10.4_

- ✅️ 18. 勝利演出と「視覚効果を減らす」対応
  - 勝利時のお祝い演出を実装する（例: パーティクル）
  - `prefers-reduced-motion` が有効な場合は、落下と演出を簡略化する
  - _Requirements: 7.3, 7.4_

- ✅️ 19. 遊び方ダイアログ
  - `HowToPlayDialog`: 盤面の構成、手番、勝利条件を説明する
  - 立体対角線を含む勝利パターンの例を、SVG の図で示す
  - ゲーム進行中に開いても、状態を壊さないこと（テストで確認）
  - _Requirements: 6.1, 6.2, 6.3_

## Phase 4: 品質保証と本番化

- ✅️ 20. レスポンシブ対応とアクセシビリティ
  - 幅360px〜デスクトップでレイアウトが崩れないこと、縦向き・横向きの両対応
  - タッチターゲット 44px 以上、十分なコントラスト、キーボードで操作できるボタン
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- ✅️ 21. E2E テスト（Playwright）
  - `@playwright/test` を導入する（バージョンは design.md に従う）
  - 柱のクリックで着手、ドラッグが着手にならないこと
  - 勝利・引き分けの表示、新しいゲームの確認ダイアログ、1手戻す
  - 幅360px とデスクトップの両方で、盤面とボタンが収まること
  - _Requirements: 2.1, 2.6, 3.3, 5.1, 5.2, 8.1_

- ✅️ 22. パフォーマンス検証
  - `applyMove` のベンチマークを作成し、1手あたり 100ms 未満であることを確認する
  - Playwright の計測で、回転と落下中の平均フレームレートが 30fps 以上であること
  - ビルド成果物のサイズを確認し、初回表示が数秒以内となる範囲に収める
  - _Requirements: 9.1, 9.2, 9.3_

- ✅️ 23. セキュリティ・プライバシーの確認
  - 外部へのネットワーク送信がないこと、`dangerouslySetInnerHTML` が使われていないことを確認する
  - 保存データが効果音設定のみであること、名前の上限が守られていることを確認する
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- ✅️ 24. ドキュメントとビルド
  - `README.md`: 概要、環境構築、起動・テスト・ビルドのコマンド、ディレクトリ構成を記載する
  - `npm run build` の成果物（`dist/`）が静的ホスティングで動作することを確認する
  - `core` が React / three に依存していないことを確認する（将来のオンライン対戦への備え）
  - 全テストをコマンド1つで実行でき、失敗時に原因が分かる出力となること
  - _Requirements: 11.4, 12.1, 12.2, 12.3_

## Phase 5: オンライン対戦（Supabase）
招待リンクで友人と対戦できるようにする。ルールの検証はサーバー（SQL の関数）で行う。詳細は design.md の「Online Play」を参照。
ライブラリは、`@supabase/supabase-js`（実行時）と `@electric-sql/pglite`（開発用のみ）を追加する（ユーザー合意済み）。

- 🔴 25. オンライン対戦の環境準備
  - `@supabase/supabase-js`（^2）と、開発用の `@electric-sql/pglite` を追加する（ロックファイルで固定）
  - `.env.example`（`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`）を作成し、`.env.local` などを `.gitignore` に追加する
  - `src/online/config.ts`: 環境変数を読み、`isOnlineConfigured()` を提供する（未設定なら false）
  - _Requirements: 13.2, 18.1, 19.2_

- 🔴 26. データベースのマイグレーション（SQL）
  - `supabase/migrations/20261122000000_online_rooms.sql` を作成する
  - `public.rooms`（制約つき）、RLS（参加者のみ SELECT）、権限（直接の書き込みを与えない）、Realtime の publication
  - `game_private` スキーマ: `cells_from_moves`, `is_win`（13方向の連続数）
  - RPC（`security definer`、`set search_path = ''`、`auth.uid()` の確認、`anon` の実行権限なし）: `create_room`, `join_room`, `play_move`, `rematch`
  - 注: SQL Editor での実行は、ユーザー作業（Phase 5 の最後に案内する）
  - _Requirements: 14.1, 14.4, 14.5, 14.6, 14.7, 15.1, 15.2, 16.1, 16.3, 18.2, 18.3, 18.4, 18.5, 19.1_

- 🔴 27. SQL の自動テスト（PGlite）
  - テスト用の代用品（`auth.uid()`、`anon` / `authenticated` ロール、`request.jwt.claim.sub` によるユーザー切替）を用意する
  - 勝敗判定: `core` の `WIN_LINES`（全76ライン）がすべて勝ちになること。3連続・混在は勝ちにならないこと
  - `play_move` / `join_room` / `rematch` の正常系と、各エラー（手番、満杯、範囲外、終了後、満員、不存在、コードの正規化、再参加）
  - 引き分け（`tests/fixtures/drawLayout.ts` の配置）、成績の更新
  - 権限: 他人のルームは読めない、直接の INSERT/UPDATE/DELETE は拒否、他人は RPC を呼べない、`anon` は実行できない
  - _Requirements: 15.2, 16.1, 16.3, 16.4, 18.2, 18.3, 18.4, 18.5, 19.3_

- 🔴 28. オンライン対戦の型と純粋ロジック
  - `src/online/types.ts`: `RoomRow`, `RoomErrorCode`, `ConnectionState`, `RoomApi`, `OnlineView`（design.md のとおり）
  - `roomLogic.ts`: `rowToView`（`core` で再生。不正な履歴はエラーとして扱う）、席と `PlayerId` の対応、`isMyTurn`、`normalizeCode`、柱の番号の変換
  - `inviteLink.ts`: `buildInviteUrl` / `parseInviteCode`
  - `RoomStore.ts`: 参加中のルーム ID の保存・読込（保存先が使えなくても例外にしない）
  - _Requirements: 14.3, 14.4, 15.1, 15.4, 16.4, 17.3, 19.4_

- 🔴 29. Supabase の通信層（SupabaseRoomApi）
  - `supabaseClient.ts`: `createClient(url, publishableKey)`（匿名セッションを保存・自動更新）
  - `SupabaseRoomApi`: `RoomApi` を実装する。RPC のエラーメッセージを `RoomErrorCode` に変換し、通信失敗は `NETWORK` とする
  - Realtime: `postgres_changes`（`id=eq.<roomId>`）の購読と、チャンネル状態 → `ConnectionState` の変換
  - テスト: Supabase クライアントを偽物に差し替えて、エラー変換と状態変換を検証する
  - 注: 実装前に、supabase-js の現行ドキュメント（匿名認証・Realtime）を確認する
  - _Requirements: 14.5, 15.3, 17.1, 17.2, 17.4, 18.1, 19.4_

- 🔴 30. useOnlineGame（状態機械）
  - `idle → creating/joining → waiting → playing → ended → playing（再戦）`、`error`、`leave`
  - 同期の規則: 古い・重複した行の無視、ちょうど1手増えたときだけアニメーション、再接続時の `getRoom` による同期
  - 着手: 相手の手番は送信せず通知、送信中の二重送信の防止、送信失敗の通知
  - 再読み込みからの復帰（`RoomStore` + `getRoom`）
  - テスト: 偽の `RoomApi` で、一連の流れと各異常系を検証する
  - _Requirements: 14.6, 14.7, 15.1, 15.3, 16.2, 16.3, 17.2, 17.3, 17.4, 17.5_

- 🔴 31. オンライン対戦の画面
  - `StartScreen`: 「ローカル対戦」「オンライン対戦」の選択（接続設定がなければ、オンラインは無効で理由を表示）
  - `OnlineLobby`（表示名、ルームを作る、コード入力での参加、`?room=` による入力済み）、`WaitingRoom`（招待リンクのコピー、コード表示、やめる）
  - `OnlineBar`（自分・相手の名前と駒の見た目、「あなたの番 / 相手の番」、接続状態、ルームを抜ける）
  - `ControlBar` を `mode="online"` に対応させる（「1手戻す」「新しいゲーム」を隠す）
  - 表示名は、React の自動エスケープで表示する
  - _Requirements: 13.1, 13.2, 14.1, 14.2, 14.3, 15.4, 15.5, 15.6, 17.1, 17.5, 18.5_

- 🔴 32. App への統合
  - 盤面・HUD・ダイアログを、ローカル・オンラインで共有できるよう、対局画面（`GameView`）を切り出す
  - モードの切替、招待リンク（`?room=`）で開いたときのオンライン参加画面、モード選択への復帰（対局中は確認）
  - 決着時の結果ダイアログ（オンラインは、「もう一度遊ぶ」で `rematch`）、勝利の強調、効果音
  - 結合テスト（偽の `RoomApi`）: ロビー → 待機 → 対局 → 決着 → 再戦
  - _Requirements: 13.1, 13.3, 14.3, 15.3, 15.6, 16.2, 16.3, 16.4_

- 🔴 33. CSP と方針テストの更新
  - `vite.config.ts`: `VITE_SUPABASE_URL` から、ホスト名を取り出して、`connect-src` に追加する（未設定なら `'self'` のみ）
  - `tests/unit/policy.test.ts`: 通信・保存先の API を使ってよい場所を、`src/online/` と `SettingsStore` に限定する。`service_role` / `secret` の文字列を禁止する。`.env.local` が `.gitignore` に含まれることを確認する
  - 既存の E2E（セキュリティ）が、引き続き通ること
  - _Requirements: 10.1, 10.4, 18.1, 18.6_

- 🔴 34. 実環境での確認とドキュメント
  - README に、Supabase の設定手順（匿名サインイン、SQL の実行、環境変数、Vercel への設定）と、オンライン対戦の遊び方を追記する
  - 2つのブラウザで通す E2E（環境変数が設定されている場合のみ実行）を作成する
  - ユーザー作業（匿名サインインの有効化、SQL の実行、`.env.local`）の後に、実環境で動作を確認する
  - _Requirements: 14, 15, 16, 17, 19.2, 19.5_

