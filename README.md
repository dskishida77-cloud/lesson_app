# 3D コネクト フォー

定番の4目並べ「コネクト フォー」を3次元に拡張した、2人用の対戦ボードゲームです。ブラウザだけで遊べます（インストール不要）。次の2つの遊び方があります。

- **ローカル対戦**: 1台の端末を、2人で交互に操作します。
- **オンライン対戦**: 離れた友人と、招待リンクで対戦します（Supabase を使用。設定方法は「オンライン対戦のセットアップ」）。

## 遊び方

- 4×4 本の柱に、最大4段まで駒を積みます（全64マス）。駒は重力で、柱の一番下の空きマスに落ちます。
- 2人が交互に、柱をクリック（タップ）して駒を落とします。盤面はドラッグで回転、ホイール（ピンチ）で拡大・縮小できます。
- 縦・横・奥行き・斜め（段をまたぐ立体の斜めを含む、全76通り）に、自分の駒を4つ並べたら勝ちです。64マスが埋まって並んでいなければ引き分けです。
- 「1手戻す」「新しいゲーム」「視点リセット」「効果音のオン・オフ」「遊び方」は、画面上のボタンから使えます。

### オンライン対戦の遊び方
1. 「オンライン対戦」を選び、名前を入れて「ルームを作る」を押します。
2. 表示された**招待リンク**（「招待リンクをコピー」ボタン）を、友人に送ります。
3. 友人がリンクを開き、名前を入れて「参加する」を押すと、自動で対局が始まります（ホストが先手）。
4. 自分の手番にだけ、柱を選べます。相手の手は、すぐに画面に反映されます。
5. 決着したら、どちらかが「もう一度遊ぶ」を押すと、同じルームで再戦します（先手と後手が入れ替わり、通算成績は保たれます）。

ページを再読み込みしても、同じ端末・同じブラウザなら、対局に復帰できます。ルームコード（6文字）を手入力して参加することもできます。オンライン対戦では「1手戻す」は使えません。

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
| `npm run test:e2e` | E2E・パフォーマンステスト（Playwright）を実行する。ビルドと配信は自動で行う。Supabase に接続するテストは、`ONLINE_E2E=1` のときだけ実行する |
| `npm run test:all` | 型チェック → 単体・結合テスト → E2E を、順に実行する |
| `npm run typecheck` | 型チェックのみ |

失敗したテストは、テスト名と期待値・実際の値が表示されます。E2E が失敗した場合は、`test-results/` に、トレース（`npx playwright show-trace <trace.zip>`）が残ります。

## オンライン対戦のセットアップ（Supabase）

オンライン対戦は、Supabase（匿名認証 + Postgres + Realtime）を使います。**接続設定がなければ、オンライン対戦は選べません**（ローカル対戦は、設定なしで動きます）。

### 1. 匿名サインインを有効にする
Supabase ダッシュボード → **Authentication** → **Sign In / Providers** で、**Allow anonymous sign-ins** を有効にします。アカウント登録は不要で、端末ごとにプレイヤーを識別するために使います。

### 2. データベースを作る（SQL の実行）
ダッシュボードの **SQL Editor** で、[supabase/migrations/20261122000000_online_rooms.sql](supabase/migrations/20261122000000_online_rooms.sql) の内容を、すべて貼り付けて実行します。何度実行しても安全です。次のものが作られます。

- `public.rooms`（ルーム）。RLS により、**そのルームの参加者だけ**が読めます。テーブルへの直接の書き込みはできません。
- 書き込みのための関数（`create_room` / `join_room` / `play_move` / `rematch`）。手番・重力・勝敗の判定は、すべてサーバーで行います。
- Realtime の設定（`rooms` を `supabase_realtime` に追加）。

### 3. 接続情報を設定する
ダッシュボードの **Project Settings → API**（または **Connect**）で、次の2つを確認します。

| 環境変数 | 値 |
|---|---|
| `VITE_SUPABASE_URL` | Project URL（`https://xxxx.supabase.co`） |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key（`sb_publishable_…`） |

- **手元**: `.env.example` を `.env.local` にコピーして、値を設定します（`.env.local` は Git に含まれません）。`npm run dev` を再起動すると、反映されます。
- **Vercel**: プロジェクトの **Settings → Environment Variables** に、同じ2つを追加して、**再デプロイ**します（`VITE_` の値は、ビルド時に埋め込まれるため、再デプロイが必要です）。
- **公開してよい値は、この2つだけです**。`secret key`（`sb_secret_…`）や `service_role` は、ブラウザに配信されるため、絶対に設定しないでください（設定しても、アプリは無効扱いにします）。

### 4. 動作を確認する
2つのブラウザ（または、通常ウィンドウとシークレットウィンドウ）で、ルームの作成 → 招待リンクで参加、を試します。自動テストで確認する場合は、次のコマンドを使います（実際の Supabase にテスト用のルームが作られます）。

```bash
ONLINE_E2E=1 npx playwright test online
```

### 運用上の注意
- **古いルームは、自動では削除されません**。必要になれば、SQL Editor で、例えば `delete from public.rooms where updated_at < now() - interval '30 days';` を実行します（定期実行には `pg_cron` が使えます）。
- 匿名サインインには、IP ごとの回数制限があります（既定は、1時間に30回。ダッシュボードの Rate Limits で変更できます）。不特定多数に公開する場合は、Supabase が推奨する CAPTCHA（Turnstile など）を、有効にすることを検討してください。
- 匿名ユーザーは、自動では削除されません。必要なら、`delete from auth.users where is_anonymous is true and created_at < now() - interval '30 days';` で、古いものを削除できます。
- 公開ビルドの Content-Security-Policy は、通信先を、自分のサイトと、`VITE_SUPABASE_URL` のプロジェクトだけに限定します。

## 公開（静的ホスティング）

`npm run build` で作られる `dist/` を、そのまま静的ホスティングに置けば動きます（サーバー処理は不要）。アセットは相対パスなので、サブパス（例: `https://example.com/game/`）でも動作します。`file://` で直接開くことはできません（ES モジュールのため）。

ビルドの `index.html` には、Content-Security-Policy が付与されます。自分のサイト以外への通信や、外部スクリプトの読み込みは、ブラウザ側で禁止されます。

## 技術スタック

| 用途 | 採用 |
|---|---|
| 言語 | TypeScript（strict） |
| UI | React 19 |
| 3D 描画 | three / @react-three/fiber / @react-three/drei |
| オンライン対戦 | Supabase（@supabase/supabase-js）。SQL の自動テストには、PGlite（開発用） |
| ビルド・開発サーバー | Vite 6 |
| テスト | Vitest + Testing Library（単体・結合）、Playwright（E2E） |
| 効果音 | Web Audio API（音源ファイルなし。その場で合成） |

実行時の依存は、`react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei`, `@supabase/supabase-js` のみです。使用するライブラリとバージョンは、[design.md](design.md) の「Technology Stack」を基準にします（変更する場合は、事前に合意を取ります）。

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
├── online/    オンライン対戦（通信層 RoomApi / SupabaseRoomApi、行から画面用データへの変換、招待リンク、状態機械 useOnlineGame）
├── audio/     効果音（Web Audio による合成）
├── styles/    CSS
└── main.tsx   エントリポイント
supabase/
└── migrations/   オンライン対戦の SQL（テーブル・RLS・関数・Realtime）
build/            公開ビルドの Content-Security-Policy の生成
.env.example      環境変数の見本（実際の値は .env.local。Git 管理外）
tests/
├── unit/          単体テスト（ルール、各部品、方針テスト、処理時間）。unit/sql/ は、PGlite で SQL を検証する
├── integration/   App 全体の結合テスト（3D 描画は代用品、通信は偽のサーバーに差し替え。2人分の対戦を再現する）
├── e2e/           Playwright（対戦の流れ、操作、画面サイズ、セキュリティ、パフォーマンス）
└── fixtures/      テスト共通のデータ
```

## 設計の要点

- **ルールと描画の分離**: ゲームのルールは `src/core/` に閉じています。状態（`GameState`）は不変で、JSON にできる形です。`core` が React や three に依存しないことは、テスト（`tests/unit/policy.test.ts`）で保たれます。
- **データの流れ**: 入力 → `useGame` が `core` に着手を適用 → 新しい状態を、3D とUIに反映します。
- **オンライン対戦**: 手の履歴だけをサーバーに保存し、盤面は、各端末が `core` で再生して導きます。サーバー（SQL）が、同じルールで、手番・重力・勝敗を検証します。サーバーと `core` の勝敗判定が一致することは、全76ラインのテストで保証しています。
- **行の新旧**: Realtime の通知と、関数の返り値が、重複・逆転して届いても、`(round, 手の数, 状態)` の大小で、古い行で上書きしません。
- **3D 描画の遅延読み込み**: three を含む3D 描画は別ファイルで、開始画面の表示中に読み込まれます。初期読み込みの JS は約 76KB（gzip）です。

## 品質

- **ルール**: 76ラインすべての勝利判定、引き分け（64手を打ち切る実対局）、不正な操作の拒否、取り消しをテストしています。
- **サーバー（SQL）**: PGlite（WASM の Postgres）で、マイグレーションを実際に実行し、勝敗判定（全76ライン）、手番・重力・満員などの検証、再戦、RLS と実行権限（他人のルームは読めない、直接の書き込みは拒否される）をテストしています。
- **処理時間**: 1手の処理は、最悪でも数ミリ秒です（要件は 100ms 未満）。
- **フレームレート**: ソフトウェア描画（GPU なし）の環境でも、静止時 約60fps、回転中 約52fps、落下中 約40fps です（要件は 30fps 以上）。`performance` プロジェクトで検証しています。
- **アクセシビリティ**: ボタンは 44px 以上、フォーカスの表示、ダイアログの Esc 操作、先手と後手を色と形の両方で区別、OS の「視覚効果を減らす」設定に対応しています。
- **プライバシー**: 個人情報を収集しません。ローカル対戦では、外部へ通信しません。オンライン対戦で送るのは、ルームの情報（表示名、手の履歴、勝敗、成績）だけです。ブラウザに保存するのは、効果音の設定（`connect4-3d:settings`）と、オンライン対戦の復帰用の情報（匿名セッション、参加中のルーム `connect4-3d:online-room`）だけです。

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

- CPU（AI）との対戦
- ランダムマッチング、観戦、チャット（オンライン対戦の拡張）
