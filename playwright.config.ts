import { defineConfig } from '@playwright/test';

const SWIFTSHADER_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

/**
 * ブラウザは、手元の Google Chrome（channel: 'chrome'）を使う。
 * GPU のない環境でも3Dを描画できるよう、ソフトウェア描画（SwiftShader）を指定している。
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    launchOptions: { args: SWIFTSHADER_ARGS },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', testIgnore: /performance/, use: { viewport: { width: 1280, height: 720 } } },
    {
      name: 'mobile',
      testIgnore: /performance/,
      use: { viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
    },
    {
      // フレームレートの計測は、他のテストと CPU を奪い合うと値が下がるため、他がすべて終わってから単独で実行する
      name: 'performance',
      testMatch: /performance/,
      dependencies: ['desktop', 'mobile'],
      use: { viewport: { width: 1280, height: 720 } },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
