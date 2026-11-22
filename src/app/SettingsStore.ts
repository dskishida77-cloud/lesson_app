import type { PersistedSettings } from '../core';

export const SETTINGS_KEY = 'connect4-3d:settings';

const DEFAULTS: PersistedSettings = { soundEnabled: true };

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** ブラウザから localStorage を取得する。プライベートモード等で例外になる場合は null */
function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 設定の保存と読込。保存先が使えなくても、例外にせず既定値で動作を続ける */
export class SettingsStore {
  private readonly storage: StorageLike | null;

  constructor(storage: StorageLike | null = browserStorage()) {
    this.storage = storage;
  }

  load(): PersistedSettings {
    try {
      const raw = this.storage?.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && 'soundEnabled' in parsed) {
        const value = (parsed as { soundEnabled: unknown }).soundEnabled;
        if (typeof value === 'boolean') return { soundEnabled: value };
      }
    } catch {
      // 読み込めない場合は既定値を使う
    }
    return { ...DEFAULTS };
  }

  save(settings: PersistedSettings): void {
    try {
      this.storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // 保存できなくても、ゲームの進行には影響させない
    }
  }
}
