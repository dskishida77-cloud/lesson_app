import { describe, expect, it } from 'vitest';

/** セキュリティ・プライバシーの方針（要件10）を、ソースコードの走査で保つ */
const sources = import.meta.glob('../../src/**/*.{ts,tsx,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const files = Object.entries(sources).map(([path, text]) => ({
  path: path.replace('../../src/', ''),
  text,
}));

it('走査対象のソースを読み込めている', () => {
  expect(files.length).toBeGreaterThan(20);
  expect(files.some((f) => f.path === 'app/SettingsStore.ts')).toBe(true);
});

/** コメントは対象外にして、コードだけを見る */
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const find = (pattern: RegExp, allowed: string[] = []) =>
  files
    .filter((f) => !allowed.includes(f.path))
    .filter((f) => pattern.test(stripComments(f.text)))
    .map((f) => f.path);

describe('要件10.1: 外部へゲームデータを送信しない', () => {
  it('ネットワーク通信の API を使っていない', () => {
    expect(find(/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\b/)).toEqual([]);
  });

  it('外部の URL（http/https）を参照していない', () => {
    expect(find(/https?:\/\//)).toEqual([]);
  });

  it('解析・広告などの外部スクリプトを読み込んでいない', () => {
    expect(find(/(gtag|googletagmanager|analytics|sentry|datadog|mixpanel)/i)).toEqual([]);
  });
});

describe('要件10.2: 入力が、スクリプトとして実行されない', () => {
  it('HTML を直接差し込む API を使っていない', () => {
    expect(find(/\b(dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b/)).toEqual([]);
  });

  it('文字列からコードを実行する仕組みを使っていない', () => {
    expect(find(/\b(eval|new Function)\s*\(/)).toEqual([]);
    expect(find(/\bsetTimeout\(\s*['"`]/)).toEqual([]);
  });
});

describe('要件10.4: 保存するデータは、効果音設定のみ', () => {
  it('ブラウザの保存先を使うのは、SettingsStore だけ', () => {
    expect(find(/\b(localStorage|sessionStorage|indexedDB|document\.cookie|caches)\b/, ['app/SettingsStore.ts'])).toEqual([]);
  });

  it('SettingsStore が保存するキーは、1つだけ', () => {
    const store = files.find((f) => f.path === 'app/SettingsStore.ts')!.text;
    expect(store.match(/setItem\(/g)).toHaveLength(1);
    expect(store).toContain("'connect4-3d:settings'");
  });
});
