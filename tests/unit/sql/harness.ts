import { PGlite } from '@electric-sql/pglite';
import migration from '../../../supabase/migrations/20261122000000_online_rooms.sql?raw';

/** Supabase が用意しているものの代用品（auth.uid()、anon / authenticated ロール、Realtime の publication、既定の権限） */
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create publication supabase_realtime;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- Supabase は、public に作られた新しいテーブル・関数に、anon / authenticated への権限を、既定で付ける
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`;

export const ALICE = '00000000-0000-4000-8000-00000000000a';
export const BOB = '00000000-0000-4000-8000-00000000000b';
export const CAROL = '00000000-0000-4000-8000-00000000000c';

export interface Room {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  host_name: string;
  guest_name: string | null;
  first_player: number;
  moves: number[];
  status: 'waiting' | 'playing' | 'won' | 'draw';
  winner: number | null;
  host_wins: number;
  guest_wins: number;
  draws: number;
}

export async function createDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(migration);
  return db;
}

type Role = 'authenticated' | 'anon';

/** 指定したユーザー（auth.uid()）・ロールとして、SQL を実行する。実行後は、スーパーユーザーに戻す */
export function actingAs(db: PGlite, uid: string | null, role: Role = 'authenticated') {
  const run = async <T>(sql: string, params: unknown[] = []): Promise<T[]> => {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
    await db.exec(`set role ${role}`);
    try {
      return (await db.query<T>(sql, params)).rows;
    } finally {
      await db.exec('reset role');
    }
  };
  return {
    query: run,
    /** 例外のメッセージ（RPC の raise exception の文言）を返す。成功したら null */
    error: async (sql: string, params: unknown[] = []): Promise<string | null> => {
      try {
        await run(sql, params);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
    createRoom: async (name: string) =>
      (await run<Room>('select * from public.create_room($1)', [name]))[0]!,
    joinRoom: async (code: string, name: string) =>
      (await run<Room>('select * from public.join_room($1, $2)', [code, name]))[0]!,
    playMove: async (roomId: string, pillar: number) =>
      (await run<Room>('select * from public.play_move($1, $2::smallint)', [roomId, pillar]))[0]!,
    rematch: async (roomId: string) =>
      (await run<Room>('select * from public.rematch($1)', [roomId]))[0]!,
  };
}
