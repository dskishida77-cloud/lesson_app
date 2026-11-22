export const ROOM_KEY = 'connect4-3d:online-room';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 参加中のルーム ID を保存する（ページを再読み込みしても、復帰できるように）。保存先が使えなくても、例外にしない */
export class RoomStore {
  private readonly storage: StorageLike | null;

  constructor(storage: StorageLike | null = browserStorage()) {
    this.storage = storage;
  }

  get(): string | null {
    try {
      const value = this.storage?.getItem(ROOM_KEY);
      return value && UUID.test(value) ? value : null;
    } catch {
      return null;
    }
  }

  set(roomId: string): void {
    try {
      this.storage?.setItem(ROOM_KEY, roomId);
    } catch {
      // 保存できなくても、対局には影響させない
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(ROOM_KEY);
    } catch {
      // 同上
    }
  }
}
