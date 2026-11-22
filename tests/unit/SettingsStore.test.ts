import { describe, expect, it } from 'vitest';
import { SETTINGS_KEY, SettingsStore } from '../../src/app/SettingsStore';

/** 最小限の Storage の代用 */
const memoryStorage = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
};

describe('SettingsStore', () => {
  it('キーは connect4-3d:settings', () => {
    expect(SETTINGS_KEY).toBe('connect4-3d:settings');
  });

  it('保存がなければ、効果音オンが初期値', () => {
    expect(new SettingsStore(memoryStorage()).load()).toEqual({ soundEnabled: true });
  });

  it('保存した設定を、読み込める', () => {
    const storage = memoryStorage();
    const store = new SettingsStore(storage);
    store.save({ soundEnabled: false });
    expect(JSON.parse(storage.data[SETTINGS_KEY]!)).toEqual({ soundEnabled: false });
    expect(new SettingsStore(storage).load()).toEqual({ soundEnabled: false });
  });

  it('壊れた値や不正な型は、初期値にする', () => {
    expect(new SettingsStore(memoryStorage({ [SETTINGS_KEY]: '{broken' })).load()).toEqual({ soundEnabled: true });
    expect(new SettingsStore(memoryStorage({ [SETTINGS_KEY]: '{"soundEnabled":"no"}' })).load()).toEqual({
      soundEnabled: true,
    });
    expect(new SettingsStore(memoryStorage({ [SETTINGS_KEY]: 'null' })).load()).toEqual({ soundEnabled: true });
  });

  it('ストレージにアクセスできなくても、例外にしない', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    const store = new SettingsStore(broken);
    expect(store.load()).toEqual({ soundEnabled: true });
    expect(() => store.save({ soundEnabled: false })).not.toThrow();
  });

  it('ストレージ自体が使えない（null）場合も、例外にしない', () => {
    const store = new SettingsStore(null);
    expect(store.load()).toEqual({ soundEnabled: true });
    expect(() => store.save({ soundEnabled: false })).not.toThrow();
  });
});
