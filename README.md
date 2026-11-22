# 3D コネクト フォー

定番の4目並べ「コネクト フォー」を3次元に拡張した、2人用の対戦ボードゲームです。ブラウザだけで遊べます（インストール不要）。1台の端末を2人で交互に操作します。

## 遊び方

- 4×4 本の柱に、最大4段まで駒を積みます（全64マス）。駒は重力で、柱の一番下の空きマスに落ちます。
- 2人が交互に、柱をクリック（タップ）して駒を落とします。盤面はドラッグで回転、ホイール（ピンチ）で拡大・縮小できます。
- 縦・横・奥行き・斜め（段をまたぐ立体の斜めを含む、全76通り）に、自分の駒を4つ並べたら勝ちです。64マスが埋まって並んでいなければ引き分けです。
- 「1手戻す」「新しいゲーム」「視点リセット」「効果音のオン・オフ」「遊び方」は、画面上のボタンから使えます。

## 動作環境

- 実行: WebGL が使えるモダンブラウザ（PC・スマートフォン）。画面幅360px以上に対応しています。
- 開発: Node.js と npm（Node.js 22 で動作確認）。
- E2E テスト: 手元の Google Chrome を使います（`playwright.config.ts` の `channel: 'chrome'`）。

## 環境構築

```bash
npm install
```

## コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバーを起動する（<http://localhost:5173>） |
| `npm run build` | 型チェックのあと、`dist/` に公開用ビルドを作る |
| `npm run preview` | ビルド結果を、ローカルで確認する（<http://localhost:4173>） |
| `npm test` | 単体・結合テスト（Vitest）を実行する |
| `npm run test:e2e` | E2E・パフォーマンステスト（Playwright）を実行する。ビルドと配信は自動で行う |
| `npm run test:all` | 型チェック → 単体・結合テスト → E2E を、順に実行する |
| `npm run typecheck` | 型チェックのみ |

失敗したテストは、テスト名と期待値・実際の値が表示されます。E2E が失敗した場合は、`test-results/` に、トレース（`npx playwright show-trace <trace.zip>`）が残ります。

## 公開（静的ホスティング）

`npm run build` で作られる `dist/` を、そのまま静的ホスティングに置けば動きます（サーバー処理は不要）。アセットは相対パスなので、サブパス（例: `https://example.com/game/`）でも動作します。`file://` で直接開くことはできません（ES モジュールのため）。

ビルドの `index.html` には、Content-Security-Policy が付与されます。自分のサイト以外への通信や、外部スクリプトの読み込みは、ブラウザ側で禁止されます。

## 技術スタック

| 用途 | 採用 |
|---|---|
| 言語 | TypeScript（strict） |
| UI | React 19 |
| 3D 描画 | three / @react-three/fiber / @react-three/drei |
| ビルド・開発サーバー | Vite 6 |
| テスト | Vitest + Testing Library（単体・結合）、Playwright（E2E） |
| 効果音 | Web Audio API（音源ファイルなし。その場で合成） |

実行時の依存は、`react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei` のみです。使用するライブラリとバージョンは、[design.md](design.md) の「Technology Stack」を基準にします（変更する場合は、事前に合意を取ります）。

## ディレクトリ構成

```
src/
├── core/      ゲームのルール（純粋ロジック）。React・three・ブラウザ API に依存しない
│   ├── types.ts   型定義（GameState, Move など。JSON にできる形）
│   ├── lines.ts   勝利となる全76ライン
│   └── game.ts    createGame / applyMove / checkResult / undo / getDropHeight
├── app/       状態管理とアプリ全体（useGame, App, 設定の保存, 通算成績, プレイヤー名）
├── render/    3D 描画（React Three Fiber）。盤面・柱・駒・カメラ・ホバーのプレビュー
├── ui/        画面部品（HUD, 開始画面, 操作バー, 各種ダイアログ, 勝利パターンの図, 紙吹雪）
├── audio/     効果音（Web Audio による合成）
├── styles/    CSS
└── main.tsx   エントリポイント
tests/
├── unit/          単体テスト（ルール、各部品、方針テスト、処理時間）
├── integration/   App 全体の結合テスト（3D 描画は代用品に差し替え）
├── e2e/           Playwright（対戦の流れ、操作、画面サイズ、セキュリティ、パフォーマンス）
└── fixtures/      テスト共通のデータ
```

## 設計の要点

- **ルールと描画の分離**: ゲームのルールは `src/core/` に閉じています。状態（`GameState`）は不変で、JSON にできる形です。`core` が React や three に依存しないことは、テスト（`tests/unit/policy.test.ts`）で保たれます。
- **データの流れ**: 入力 → `useGame` が `core` に着手を適用 → 新しい状態を、3D とUIに反映します。
- **将来のオンライン対戦**: 現在は同じ端末での対戦のみです。状態と着手が JSON にできるため、将来はそのまま通信に使えます。
- **3D 描画の遅延読み込み**: three を含む3D 描画は別ファイルで、開始画面の表示中に読み込まれます。初期読み込みの JS は約 76KB（gzip）です。

## 品質

- **ルール**: 76ラインすべての勝利判定、引き分け（64手を打ち切る実対局）、不正な操作の拒否、取り消しをテストしています。
- **処理時間**: 1手の処理は、最悪でも数ミリ秒です（要件は 100ms 未満）。
- **フレームレート**: ソフトウェア描画（GPU なし）の環境でも、静止時 約60fps、回転中 約52fps、落下中 約40fps です（要件は 30fps 以上）。`performance` プロジェクトで検証しています。
- **アクセシビリティ**: ボタンは 44px 以上、フォーカスの表示、ダイアログの Esc 操作、先手と後手を色と形の両方で区別、OS の「視覚効果を減らす」設定に対応しています。
- **プライバシー**: 個人情報を収集せず、外部へ通信しません。保存するのは効果音の設定（`localStorage` の `connect4-3d:settings`）だけです。

## 開発の進め方（仕様駆動）

このプロジェクトは、要件・設計・タスクを先に文書化し、それに沿って実装しています。

| ファイル | 内容 |
|---|---|
| [requirements.md](requirements.md) | 要件定義（ユーザーストーリーと受け入れ基準） |
| [design.md](design.md) | 技術設計 |
| [task.md](task.md) | 実装計画と、各タスクの進捗 |
| [CLAUDE.md](CLAUDE.md) | 自律開発エージェントの行動ルール |
| `requirements_gen.md` / `design_gen.md` / `task_gen.md` | 上の3文書を生成するためのプロンプト（[kiro-kit](https://github.com/Naoki-Takahashi0420/kiro-kit) 由来） |

## 今後の拡張

- オンライン対戦（スコープ外として、初期版では未実装）
- CPU（AI）との対戦
