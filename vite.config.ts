import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 公開用ビルドに、Content-Security-Policy を付ける（要件10.1）。
 * 自分のサイト以外への通信と、外部スクリプトの読み込みを、ブラウザ側でも禁止する。
 * 開発サーバーは、HMR が インラインスクリプトと WebSocket を使うため、対象外。
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // React の style 属性（紙吹雪の位置など）に必要
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const cspPlugin = (): Plugin => ({
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
  ],
});

export default defineConfig({
  plugins: [react(), cspPlugin()],
  base: './',
  build: {
    // three.js は単体で大きい（約0.9MB）。開始画面の表示を妨げないよう、3D描画は別ファイルに分けて遅延読み込みしている
    chunkSizeWarningLimit: 1000,
  },
});
