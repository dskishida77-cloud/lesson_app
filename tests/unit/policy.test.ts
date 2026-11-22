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

const ignoreFile = Object.values(
  import.meta.glob('../../.gitignore', { query: '?raw', import: 'default', eager: true }),
)[0];

it('走査対象のソースと .gitignore を読み込めている', () => {
  expect(typeof ignoreFile).toBe('string');
  expect(files.length).toBeGreaterThan(20);
  expect(files.some((f) => f.path === 'app/SettingsStore.ts')).toBe(true);
});

/** コメントは対象外にして、コードだけを見る */
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** pattern を含むファイルを返す。allowed は、使ってよいファイル（末尾が / のものは、そのフォルダ以下すべて） */
const find = (pattern: RegExp, allowed: string[] = []) =>
  files
    .filter((f) => !allowed.some((a) => (a.endsWith('/') ? f.path.startsWith(a) : f.path === a)))
    .filter((f) => pattern.test(stripComments(f.text)))
    .map((f) => f.path);

describe('要件10.1 / 18.1: 通信は、オンライン対戦（src/online/）だけ', () => {
  it('ネットワーク通信の API を使ってよいのは、src/online/ だけ', () => {
    expect(find(/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\b/, ['online/'])).toEqual([]);
  });

  it('Supabase のクライアントを作るのは、online/supabaseClient.ts だけ', () => {
    expect(find(/@supabase\//, ['online/supabaseClient.ts'])).toEqual([]);
  });

  it('秘密鍵（service_role / secret key）の文字列は、設定の誤りを弾く online/config.ts 以外に、含まれない', () => {
    expect(find(/service_role|sb_secret_/i, ['online/config.ts'])).toEqual([]);
  });

  it('.env.local などの、実際の接続情報は、Git の管理外になっている', () => {
    const gitignore = ignoreFile as string;
    for (const entry of ['.env', '.env.local', '.env.*.local']) {
      expect(gitignore.split('\n').map((l) => l.trim())).toContain(entry);
    }
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

describe('要件10.4: ブラウザに保存するデータは、効果音設定と、オンライン対戦の復帰用のみ', () => {
  it('ブラウザの保存先を使ってよいのは、SettingsStore と src/online/ だけ', () => {
    expect(
      find(/\b(localStorage|sessionStorage|indexedDB|document\.cookie|caches)\b/, ['app/SettingsStore.ts', 'online/']),
    ).toEqual([]);
  });

  it('オンライン対戦が保存するのは、参加中のルーム ID だけ（キーは1つ）', () => {
    const store = files.find((f) => f.path === 'online/RoomStore.ts')!.text;
    expect(store.match(/setItem\(/g)).toHaveLength(1);
    expect(store).toContain("'connect4-3d:online-room'");
  });

  it('SettingsStore が保存するキーは、1つだけ', () => {
    const store = files.find((f) => f.path === 'app/SettingsStore.ts')!.text;
    expect(store.match(/setItem\(/g)).toHaveLength(1);
    expect(store).toContain("'connect4-3d:settings'");
  });
});

describe('要件12.1: ゲームのルール（core）は、描画やUIに依存しない', () => {
  const core = files.filter((f) => f.path.startsWith('core/'));

  it('core のファイルが存在する', () => {
    expect(core.length).toBeGreaterThanOrEqual(4);
  });

  it('core は、core 内のファイル以外を import しない（react / three / DOM に依存しない）', () => {
    const imports = core.flatMap((f) =>
      [...stripComments(f.text).matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => ({ file: f.path, from: m[1]! })),
    );
    const outside = imports.filter((i) => !i.from.startsWith('./'));
    expect(outside).toEqual([]);
  });

  it('core は、ブラウザ固有の API（window / document / navigator）を使わない', () => {
    expect(core.filter((f) => /\b(window|document|navigator)\b/.test(stripComments(f.text)))).toEqual([]);
  });
});
