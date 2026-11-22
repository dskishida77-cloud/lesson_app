import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import { buildCsp } from './build/csp';
import { readOnlineConfig } from './src/online/config';
import react from '@vitejs/plugin-react';

/**
 * 公開用ビルドに、Content-Security-Policy を付ける（要件10.1 / 18.6）。
 * 通信先は、自分のサイトと、環境変数（VITE_SUPABASE_URL）で指定した Supabase のプロジェクトだけ。
 * 開発サーバーは、HMR が インラインスクリプトと WebSocket を使うため、対象外。
 */
const cspPlugin = (supabaseUrl: string | null): Plugin => ({
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: buildCsp(supabaseUrl) },
      injectTo: 'head-prepend',
    },
  ],
});

export default defineConfig(({ mode }) => {
  // 設定として使える値のときだけ、通信先に加える（秘密鍵の取り違えなども、ここで弾かれる）
  const online = readOnlineConfig(loadEnv(mode, '.', 'VITE_'));
  return {
    plugins: [react(), cspPlugin(online?.url ?? null)],
    base: './',
    build: {
      // three.js は単体で大きい（約0.9MB）。開始画面の表示を妨げないよう、3D描画は別ファイルに分けて遅延読み込みしている
      chunkSizeWarningLimit: 1000,
    },
  };
});
