// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ALICE, BOB, CAROL, actingAs, createDb } from './harness';
import type { Room } from './harness';

let db: PGlite;
beforeAll(async () => {
  db = await createDb();
}, 60_000);
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec('delete from public.rooms');
});

const alice = () => actingAs(db, ALICE);
const bob = () => actingAs(db, BOB);

/** ホスト(ALICE)とゲスト(BOB)が揃った、対局中のルーム */
async function startedRoom(): Promise<Room> {
  const room = await alice().createRoom('あや');
  return bob().joinRoom(room.code, 'ゆう');
}

/** 手番の席に合わせて、順に着手する（先手がホストの場合） */
async function playAll(roomId: string, pillars: number[], firstSeatIsHost = true) {
  let room!: Room;
  for (const [i, p] of pillars.entries()) {
    const hostTurn = (i % 2 === 0) === firstSeatIsHost;
    room = await (hostTurn ? alice() : bob()).playMove(roomId, p);
  }
  return room;
}

describe('create_room', () => {
  it('ホストとして、待機中のルームを作る。コードは、紛らわしい文字を含まない6文字', async () => {
    const room = await alice().createRoom('あや');
    expect(room.status).toBe('waiting');
    expect(room.host_id).toBe(ALICE);
    expect(room.guest_id).toBeNull();
    expect(room.host_name).toBe('あや');
    expect(room.first_player).toBe(0);
    expect(room.round).toBe(0);
    expect(room.moves).toEqual([]);
    expect(room.code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(room.code).not.toMatch(/[01OIL]/);
  });

  it('名前の前後の空白を取り除く', async () => {
    expect((await alice().createRoom('  あや  ')).host_name).toBe('あや');
  });

  it.each([['空', ''], ['空白のみ', '   '], ['13文字', 'あ'.repeat(13)], ['制御文字', 'a\u0007b'], ['null', null as unknown as string]])(
    '不正な名前（%s）は INVALID_NAME',
    async (_label, name) => {
      expect(await alice().error('select * from public.create_room($1)', [name])).toContain('INVALID_NAME');
    },
  );

  it('12文字ちょうどは受け付ける', async () => {
    expect((await alice().createRoom('あ'.repeat(12))).host_name).toBe('あ'.repeat(12));
  });

  it('コードは、ルームごとに異なる', async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 30; i++) codes.add((await alice().createRoom('a')).code);
    expect(codes.size).toBe(30);
  });

  it('未認証（auth.uid() が NULL）なら NOT_AUTHENTICATED', async () => {
    expect(await actingAs(db, null).error('select * from public.create_room($1)', ['a'])).toContain('NOT_AUTHENTICATED');
  });
});

describe('join_room', () => {
  it('ゲストとして参加すると、対局が始まる（ホストが先手）', async () => {
    const created = await alice().createRoom('あや');
    const room = await bob().joinRoom(created.code, 'ゆう');
    expect(room.status).toBe('playing');
    expect(room.guest_id).toBe(BOB);
    expect(room.guest_name).toBe('ゆう');
    expect(room.id).toBe(created.id);
    expect(room.first_player).toBe(0);
  });

  it('コードの大文字・小文字と、前後の空白は区別しない', async () => {
    const created = await alice().createRoom('あや');
    const room = await bob().joinRoom(`  ${created.code.toLowerCase()} `, 'ゆう');
    expect(room.id).toBe(created.id);
  });

  it('存在しないコード・形式の違うコードは ROOM_NOT_FOUND', async () => {
    for (const code of ['AAAAAA', 'abc', '', '000000', "'; drop table public.rooms; --"]) {
      expect(await bob().error('select * from public.join_room($1, $2)', [code, 'ゆう'])).toContain('ROOM_NOT_FOUND');
    }
    expect(await bob().error('select * from public.join_room($1, $2)', [null, 'ゆう'])).toContain('ROOM_NOT_FOUND');
  });

  it('すでに2人揃っていると ROOM_FULL', async () => {
    const room = await startedRoom();
    expect(await actingAs(db, CAROL).error('select * from public.join_room($1, $2)', [room.code, 'まい'])).toContain(
      'ROOM_FULL',
    );
  });

  it('同じユーザーの再参加は、復帰として、同じ内容を返す（ゲスト・ホストとも）', async () => {
    const room = await startedRoom();
    await alice().playMove(room.id, 3);
    const guestAgain = await bob().joinRoom(room.code, '別名');
    expect(guestAgain.guest_name).toBe('ゆう');
    expect(guestAgain.moves).toEqual([3]);
    const hostAgain = await alice().joinRoom(room.code, '別名');
    expect(hostAgain.host_name).toBe('あや');
    expect(hostAgain.guest_id).toBe(BOB);
  });

  it('不正な名前は INVALID_NAME。ルームは参加扱いにならない', async () => {
    const created = await alice().createRoom('あや');
    expect(await bob().error('select * from public.join_room($1, $2)', [created.code, ''])).toContain('INVALID_NAME');
    const [row] = await db.query<Room>('select * from public.rooms where id = $1', [created.id]).then((r) => r.rows);
    expect(row!.guest_id).toBeNull();
    expect(row!.status).toBe('waiting');
  });
});

describe('play_move', () => {
  it('ホストが先に打ち、交互に打つ。柱の下から積み上がる', async () => {
    const room = await startedRoom();
    const r1 = await alice().playMove(room.id, 5);
    expect(r1.moves).toEqual([5]);
    const r2 = await bob().playMove(room.id, 5);
    expect(r2.moves).toEqual([5, 5]);
    expect(r2.status).toBe('playing');
  });

  it('相手の手番では NOT_YOUR_TURN。状態は変わらない', async () => {
    const room = await startedRoom();
    expect(await bob().error('select * from public.play_move($1, 0::smallint)', [room.id])).toContain('NOT_YOUR_TURN');
    await alice().playMove(room.id, 0);
    expect(await alice().error('select * from public.play_move($1, 0::smallint)', [room.id])).toContain('NOT_YOUR_TURN');
    const [row] = (await db.query<Room>('select * from public.rooms where id = $1', [room.id])).rows;
    expect(row!.moves).toEqual([0]);
  });

  it('参加者でないユーザーは NOT_A_PLAYER', async () => {
    const room = await startedRoom();
    expect(await actingAs(db, CAROL).error('select * from public.play_move($1, 0::smallint)', [room.id])).toContain(
      'NOT_A_PLAYER',
    );
  });

  it('存在しないルームは ROOM_NOT_FOUND', async () => {
    expect(
      await alice().error('select * from public.play_move($1, 0::smallint)', ['11111111-1111-4111-8111-111111111111']),
    ).toContain('ROOM_NOT_FOUND');
  });

  it('待機中（相手が未参加）は GAME_NOT_PLAYING', async () => {
    const room = await alice().createRoom('あや');
    expect(await alice().error('select * from public.play_move($1, 0::smallint)', [room.id])).toContain('GAME_NOT_PLAYING');
  });

  it.each([-1, 16, 100])('範囲外の柱（%i）は INVALID_PILLAR', async (pillar) => {
    const room = await startedRoom();
    expect(await alice().error('select * from public.play_move($1, $2::smallint)', [room.id, pillar])).toContain(
      'INVALID_PILLAR',
    );
  });

  it('柱の番号が NULL なら INVALID_PILLAR', async () => {
    const room = await startedRoom();
    expect(await alice().error('select * from public.play_move($1, null)', [room.id])).toContain('INVALID_PILLAR');
  });

  it('4段積んだ柱には PILLAR_FULL。状態は変わらない', async () => {
    const room = await startedRoom();
    await playAll(room.id, [2, 2, 2, 2]);
    expect(await alice().error('select * from public.play_move($1, 2::smallint)', [room.id])).toContain('PILLAR_FULL');
    const [row] = (await db.query<Room>('select * from public.rooms where id = $1', [room.id])).rows;
    expect(row!.moves).toEqual([2, 2, 2, 2]);
  });

  it('縦に4つ揃えると、その席が勝つ。成績が更新され、以降は GAME_NOT_PLAYING', async () => {
    const room = await startedRoom();
    // ホストが柱0に4つ、ゲストは柱1に積む
    const done = await playAll(room.id, [0, 1, 0, 1, 0, 1, 0]);
    expect(done.status).toBe('won');
    expect(done.winner).toBe(0);
    expect(done.host_wins).toBe(1);
    expect(done.guest_wins).toBe(0);
    expect(await bob().error('select * from public.play_move($1, 5::smallint)', [room.id])).toContain('GAME_NOT_PLAYING');
  });

  it('ゲストの勝ちでは、ゲストの勝ち数が増える', async () => {
    const room = await startedRoom();
    const done = await playAll(room.id, [4, 0, 4, 0, 4, 0, 8, 0]);
    expect(done.status).toBe('won');
    expect(done.winner).toBe(1);
    expect(done.guest_wins).toBe(1);
    expect(done.host_wins).toBe(0);
  });

  it('立体の対角線でも勝てる', async () => {
    const room = await startedRoom();
    // 立体対角線: (0,0,0) (1,1,1) (2,2,2) (3,3,3)  柱番号 = x*4+z → 0, 5, 10, 15 / 段 = 0,1,2,3
    // ホストの駒を、各柱の対応する段に置けるよう、ゲストが下を埋める
    const moves = [
      0, // H: 柱0 の1段目(y=0) ★
      5, // G: 柱5 の y=0
      5, // H: 柱5 の y=1 ★
      10, // G: 柱10 の y=0
      15, // H: 柱15 y=0 （捨て）
      10, // G: 柱10 y=1
      10, // H: 柱10 y=2 ★
      15, // G: 柱15 y=1
      1, // H: 捨て
      15, // G: 柱15 y=2
      2, // H: 捨て
      3, // G: 捨て
      15, // H: 柱15 y=3 ★ → 勝ち
    ];
    const done = await playAll(room.id, moves);
    expect(done.status).toBe('won');
    expect(done.winner).toBe(0);
  });
});

describe('64手の引き分け', () => {
  it('勝者なしで64手が埋まると draw。引き分け数が増える', async () => {
    const { DRAW_LAYOUT } = await import('../../fixtures/drawLayout');
    const ownerAt = (x: number, y: number, z: number) => (DRAW_LAYOUT[x * 4 + z]![y] === '1' ? 1 : 0);
    const heights = Array<number>(16).fill(0);
    const order: number[] = [];
    // 各手で、「次の段の持ち主が、手番の側」である柱を選ぶ（深さ優先探索）
    const search = (n: number): boolean => {
      if (n === 64) return true;
      for (let p = 0; p < 16; p++) {
        const h = heights[p]!;
        if (h === 4 || ownerAt(Math.floor(p / 4), h, p % 4) !== n % 2) continue;
        heights[p]!++;
        order.push(p);
        if (search(n + 1)) return true;
        order.pop();
        heights[p]!--;
      }
      return false;
    };
    expect(search(0)).toBe(true);

    const room = await startedRoom();
    const done = await playAll(room.id, order);
    expect(done.status).toBe('draw');
    expect(done.winner).toBeNull();
    expect(done.draws).toBe(1);
    expect(done.moves).toHaveLength(64);
  }, 60_000);
});

describe('rematch', () => {
  async function finishedRoom() {
    const room = await startedRoom();
    return playAll(room.id, [0, 1, 0, 1, 0, 1, 0]);
  }

  it('決着後に、先手と後手が入れ替わり、手の履歴が空になる。成績は保持される', async () => {
    const done = await finishedRoom();
    const next = await bob().rematch(done.id);
    expect(next.status).toBe('playing');
    expect(next.first_player).toBe(1);
    expect(next.round).toBe(1);
    expect(next.moves).toEqual([]);
    expect(next.winner).toBeNull();
    expect(next.host_wins).toBe(1);
  });

  it('再戦では、ゲストが先に打てる。ホストは打てない', async () => {
    const done = await finishedRoom();
    await alice().rematch(done.id);
    expect(await alice().error('select * from public.play_move($1, 0::smallint)', [done.id])).toContain('NOT_YOUR_TURN');
    const r = await bob().playMove(done.id, 0);
    expect(r.moves).toEqual([0]);
  });

  it('2回目の再戦で、先手がホストに戻る', async () => {
    const done = await finishedRoom();
    await bob().rematch(done.id);
    // ゲストが先手: 柱0に4つ積んで勝つ
    const won = await playAll(done.id, [0, 1, 0, 1, 0, 1, 0], false);
    expect(won.winner).toBe(1);
    expect(won.guest_wins).toBe(1);
    const third = await alice().rematch(done.id);
    expect(third.first_player).toBe(0);
    expect(third.round).toBe(2);
  });

  it('進行中や待機中は GAME_NOT_FINISHED', async () => {
    const room = await startedRoom();
    expect(await alice().error('select * from public.rematch($1)', [room.id])).toContain('GAME_NOT_FINISHED');
    const waiting = await alice().createRoom('a');
    expect(await alice().error('select * from public.rematch($1)', [waiting.id])).toContain('GAME_NOT_FINISHED');
  });

  it('参加者でなければ NOT_A_PLAYER', async () => {
    const done = await finishedRoom();
    expect(await actingAs(db, CAROL).error('select * from public.rematch($1)', [done.id])).toContain('NOT_A_PLAYER');
  });

  it('二重に押された場合の2回目は、GAME_NOT_FINISHED（先手が二重に入れ替わらない）', async () => {
    const done = await finishedRoom();
    await alice().rematch(done.id);
    expect(await bob().error('select * from public.rematch($1)', [done.id])).toContain('GAME_NOT_FINISHED');
    const [row] = (await db.query<Room>('select * from public.rooms where id = $1', [done.id])).rows;
    expect(row!.first_player).toBe(1);
  });
});

describe('権限（RLS・実行権限）', () => {
  it('参加者は、自分のルームを読める。他人は読めない', async () => {
    const room = await startedRoom();
    expect(await alice().query('select id from public.rooms')).toHaveLength(1);
    expect(await bob().query('select id from public.rooms')).toHaveLength(1);
    expect(await actingAs(db, CAROL).query('select id from public.rooms')).toHaveLength(0);
    expect(await actingAs(db, CAROL).query('select id from public.rooms where id = $1', [room.id])).toHaveLength(0);
    expect(await actingAs(db, CAROL).query('select id from public.rooms where code = $1', [room.code])).toHaveLength(0);
  });

  it('待機中のルームも、ホスト以外は読めない（コードの総当たりで中身を見られない）', async () => {
    const room = await alice().createRoom('あや');
    expect(await bob().query('select id from public.rooms where code = $1', [room.code])).toHaveLength(0);
  });

  it('テーブルへの直接の INSERT / UPDATE / DELETE は、すべて拒否される', async () => {
    const room = await startedRoom();
    const insert = `insert into public.rooms (code, host_id, host_name) values ('ABCDEF', '${ALICE}', 'x')`;
    const update = `update public.rooms set status = 'won', winner = 0 where id = '${room.id}'`;
    const del = `delete from public.rooms where id = '${room.id}'`;
    for (const who of [alice(), bob(), actingAs(db, CAROL)]) {
      for (const sql of [insert, update, del]) {
        expect(await who.error(sql)).toContain('permission denied');
      }
    }
    const [row] = (await db.query<Room>('select * from public.rooms where id = $1', [room.id])).rows;
    expect(row!.status).toBe('playing');
  });

  it('anon ロールは、テーブルを読めず、関数も実行できない', async () => {
    const room = await startedRoom();
    const anon = actingAs(db, null, 'anon');
    expect(await anon.error('select * from public.rooms')).toContain('permission denied');
    expect(await anon.error('select * from public.create_room($1)', ['a'])).toContain('permission denied');
    expect(await anon.error('select * from public.join_room($1, $2)', [room.code, 'a'])).toContain('permission denied');
    expect(await anon.error('select * from public.play_move($1, 0::smallint)', [room.id])).toContain('permission denied');
    expect(await anon.error('select * from public.rematch($1)', [room.id])).toContain('permission denied');
  });

  it('内部スキーマ（game_private）は、authenticated から使えない', async () => {
    expect(await alice().error(`select game_private.is_win(array_fill(0::smallint, array[64]), 0)`)).toContain(
      'permission denied',
    );
  });

  it('RPC は、security definer・search_path 固定で、実行権限が authenticated のみ', async () => {
    const rows = (
      await db.query<{ proname: string; prosecdef: boolean; proconfig: string[] | null; anon: boolean; authed: boolean; pub: boolean }>(`
        select p.proname, p.prosecdef, p.proconfig,
               has_function_privilege('anon', p.oid, 'execute') as anon,
               has_function_privilege('authenticated', p.oid, 'execute') as authed,
               has_function_privilege('public', p.oid, 'execute') as pub
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('create_room', 'join_room', 'play_move', 'rematch')
      `)
    ).rows;
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r.prosecdef).toBe(true);
      expect(r.proconfig).toContain('search_path=""');
      expect(r.anon).toBe(false);
      expect(r.pub).toBe(false);
      expect(r.authed).toBe(true);
    }
  });

  it('RLS が有効で、Realtime の publication に含まれる', async () => {
    const [t] = (await db.query<{ relrowsecurity: boolean }>(`select relrowsecurity from pg_class where oid = 'public.rooms'::regclass`)).rows;
    expect(t!.relrowsecurity).toBe(true);
    const pub = (await db.query(`select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'rooms'`)).rows;
    expect(pub).toHaveLength(1);
  });

  it('マイグレーションは、再実行しても失敗しない（何度でも実行できる）', async () => {
    const migration = (await import('../../../supabase/migrations/20261122000000_online_rooms.sql?raw')).default;
    await db.exec(migration);
    const room = await startedRoom();
    expect(room.status).toBe('playing');
  });
});
