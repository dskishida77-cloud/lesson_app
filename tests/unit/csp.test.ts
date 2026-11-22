import { describe, expect, it } from 'vitest';
import { buildCsp } from '../../build/csp';

const directive = (csp: string, name: string) =>
  csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? '';

describe('buildCsp', () => {
  it('Supabase の設定がなければ、通信先は、自分のサイトだけ', () => {
    expect(directive(buildCsp(null), 'connect-src')).toBe("connect-src 'self'");
  });

  it('Supabase の設定があれば、そのプロジェクトのホストだけを、通信先に加える（https と wss）', () => {
    const csp = buildCsp('https://abcdefgh.supabase.co');
    expect(directive(csp, 'connect-src')).toBe("connect-src 'self' https://abcdefgh.supabase.co wss://abcdefgh.supabase.co");
  });

  it('ワイルドカードや、他のホストは許可しない', () => {
    const csp = buildCsp('https://abcdefgh.supabase.co');
    expect(csp).not.toContain('*');
    expect(csp).not.toContain('https://*.supabase.co');
  });

  it('開発用の localhost（http）は、http と ws で許可する', () => {
    expect(directive(buildCsp('http://localhost:54321'), 'connect-src')).toBe(
      "connect-src 'self' http://localhost:54321 ws://localhost:54321",
    );
  });

  it('スクリプトは、自分のサイトからのみ。インラインのスクリプトや eval は許可しない', () => {
    for (const url of [null, 'https://abcdefgh.supabase.co']) {
      const csp = buildCsp(url);
      expect(directive(csp, 'script-src')).toBe("script-src 'self'");
      expect(csp).not.toContain("'unsafe-eval'");
      expect(directive(csp, 'default-src')).toBe("default-src 'self'");
      expect(directive(csp, 'object-src')).toBe("object-src 'none'");
    }
  });

  it('不正な URL は、無視する（通信先を増やさない）', () => {
    expect(directive(buildCsp('not a url'), 'connect-src')).toBe("connect-src 'self'");
    expect(directive(buildCsp('javascript:alert(1)'), 'connect-src')).toBe("connect-src 'self'");
  });
});
