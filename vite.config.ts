import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // three.js は単体で大きい（約0.9MB）。開始画面の表示を妨げないよう、3D描画は別ファイルに分けて遅延読み込みしている
    chunkSizeWarningLimit: 1000,
  },
});
