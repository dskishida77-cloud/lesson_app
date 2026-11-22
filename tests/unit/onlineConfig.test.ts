import { describe, expect, it } from 'vitest';
import { isOnlineConfigured, readOnlineConfig } from '../../src/online/config';

describe('readOnlineConfig', () => {
  it('URL と Publishable key が揃っていれば、設定を返す', () => {
    const env = { VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' };
    expect(readOnlineConfig(env)).toEqual({ url: 'https://abc.supabase.co', publishableKey: 'sb_publishable_x' });
    expect(isOnlineConfigured(env)).toBe(true);
  });

  it('前後の空白と、末尾のスラッシュを取り除く', () => {
    const env = { VITE_SUPABASE_URL: ' https://abc.supabase.co/ ', VITE_SUPABASE_PUBLISHABLE_KEY: ' key ' };
    expect(readOnlineConfig(env)).toEqual({ url: 'https://abc.supabase.co', publishableKey: 'key' });
  });

  it('どちらかがなければ null（オンライン対戦は無効）', () => {
    expect(readOnlineConfig({})).toBeNull();
    expect(readOnlineConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co' })).toBeNull();
    expect(readOnlineConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: 'key' })).toBeNull();
    expect(readOnlineConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' })).toBeNull();
    expect(isOnlineConfigured({})).toBe(false);
  });

  it('https 以外の URL や、URL として不正な値は無効にする（開発用の localhost の http は許可）', () => {
    const key = 'key';
    expect(readOnlineConfig({ VITE_SUPABASE_URL: 'http://evil.example.com', VITE_SUPABASE_PUBLISHABLE_KEY: key })).toBeNull();
    expect(readOnlineConfig({ VITE_SUPABASE_URL: 'not a url', VITE_SUPABASE_PUBLISHABLE_KEY: key })).toBeNull();
    expect(readOnlineConfig({ VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_PUBLISHABLE_KEY: key })).not.toBeNull();
  });

  it('秘密鍵（service_role / secret key）が設定された場合は、無効にして、クライアントに載せない', () => {
    const url = 'https://abc.supabase.co';
    expect(readOnlineConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc' })).toBeNull();
    // service_role の JWT（ペイロードの role が service_role）
    const payload = btoa(JSON.stringify({ role: 'service_role' })).replace(/=+$/, '');
    expect(readOnlineConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: `x.${payload}.y` })).toBeNull();
  });
});
