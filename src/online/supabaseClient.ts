import { createClient } from '@supabase/supabase-js';
import { readOnlineConfig } from './config';
import { SupabaseRoomApi } from './SupabaseRoomApi';
import type { SupabaseLike } from './SupabaseRoomApi';
import type { RoomApi } from './types';

/**
 * 環境変数が設定されていれば、Supabase を使う RoomApi を作る。なければ null（オンライン対戦は無効）。
 * クライアントには、Publishable key だけを渡す。
 */
export function createRoomApi(): RoomApi | null {
  const config = readOnlineConfig();
  if (!config) return null;
  const client = createClient(config.url, config.publishableKey, {
    auth: {
      // 匿名セッションを保存して、再読み込み後も同じプレイヤーとして復帰できるようにする
      persistSession: true,
      autoRefreshToken: true,
      // URL の ?room=… を、認証の情報と取り違えない
      detectSessionInUrl: false,
    },
  });
  return new SupabaseRoomApi(client as unknown as SupabaseLike);
}
