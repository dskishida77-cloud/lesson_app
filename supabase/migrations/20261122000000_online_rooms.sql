-- 3D コネクト フォー: オンライン対戦（ルーム）
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に、このファイルの内容を貼り付けて実行する。
-- 何度実行しても安全になるよう、作り直し可能な書き方にしている。
--
-- 前提: Authentication → Sign In / Providers で「Allow anonymous sign-ins」を有効にしておくこと。
--       （匿名ユーザーも `authenticated` ロールを持つため、権限は、行の所有者の確認で絞っている）
--
-- 設計の要点:
--   * 書き込みは、下の RPC（security definer の関数）だけ。テーブルへの直接の書き込み権限は与えない。
--   * 読み取りは、そのルームの参加者（ホスト・ゲスト）だけ（RLS）。
--   * 手番・重力・勝敗の判定は、すべてサーバー（この SQL）で行う。
--   * 柱の番号 p = x * 4 + z（0〜15）。moves は、打たれた柱の番号の配列（打った順）。
--   * 席（seat）: 0 = ホスト, 1 = ゲスト。first_player は先手の席。i 手目(0始まり)の席は (first_player + i) % 2。

----------------------------------------------------------------------
-- テーブル
----------------------------------------------------------------------
create table if not exists public.rooms (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  host_id      uuid not null,
  guest_id     uuid,
  host_name    text not null check (char_length(host_name) between 1 and 12),
  guest_name   text check (char_length(guest_name) between 1 and 12),
  first_player smallint not null default 0 check (first_player in (0, 1)),
  -- round は、再戦のたびに +1 する。(round, 手の数, status) の大小で、クライアントが、行の新旧を決められる
  round        integer not null default 0,
  moves        smallint[] not null default '{}' check (cardinality(moves) <= 64),
  status       text not null default 'waiting' check (status in ('waiting', 'playing', 'won', 'draw')),
  winner       smallint check (winner in (0, 1)),
  host_wins    integer not null default 0,
  guest_wins   integer not null default 0,
  draws        integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.rooms add column if not exists round integer not null default 0;

create index if not exists rooms_host_id_idx on public.rooms (host_id);
create index if not exists rooms_guest_id_idx on public.rooms (guest_id);

----------------------------------------------------------------------
-- 権限と RLS
----------------------------------------------------------------------
alter table public.rooms enable row level security;

drop policy if exists "participants can read their rooms" on public.rooms;
create policy "participants can read their rooms" on public.rooms
  for select to authenticated
  using ((select auth.uid()) = host_id or (select auth.uid()) = guest_id);

-- INSERT / UPDATE / DELETE の権限は与えない（書き込みは、RPC のみ）。
-- Supabase は、新しいテーブルに anon / authenticated への権限を、既定で付けるため、いったん外してから、SELECT だけを与える。
revoke all on public.rooms from anon, authenticated;
grant select on public.rooms to authenticated;

----------------------------------------------------------------------
-- 勝敗判定などの内部関数（API には公開しない別スキーマ）
----------------------------------------------------------------------
create schema if not exists game_private;
revoke all on schema game_private from public;

-- 手の履歴から、64マスの盤面を作る。添字は p * 4 + y + 1（1始まり）。値は、打った手の偶奇（0 = 先手側, 1 = 後手側）
create or replace function game_private.cells_from_moves(p_moves smallint[])
returns smallint[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_cells smallint[] := array_fill(null::smallint, array[64]);
  v_height integer[] := array_fill(0, array[16]);
  i integer;
  p integer;
begin
  for i in 1 .. coalesce(cardinality(p_moves), 0) loop
    p := p_moves[i];
    v_cells[p * 4 + v_height[p + 1] + 1] := (i - 1) % 2;
    v_height[p + 1] := v_height[p + 1] + 1;
  end loop;
  return v_cells;
end;
$$;

-- 指定したマス（0始まりの p * 4 + y）を含む4連続が、同じ持ち主で揃っているか
create or replace function game_private.is_win(p_cells smallint[], p_last integer)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_owner smallint;
  v_x integer; v_y integer; v_z integer;
  dx integer; dy integer; dz integer;
  k integer;
  nx integer; ny integer; nz integer;
  v_count integer;
begin
  if p_last is null or p_last < 0 or p_last > 63 then
    return false;
  end if;
  v_owner := p_cells[p_last + 1];
  if v_owner is null then
    return false;
  end if;
  v_y := p_last % 4;
  v_x := (p_last / 4) / 4;
  v_z := (p_last / 4) % 4;

  for dx in -1 .. 1 loop
    for dy in -1 .. 1 loop
      for dz in -1 .. 1 loop
        -- 逆向きと重複しない13方向だけを見る（最初に 0 でない成分が正のもの）
        if dx = 0 and dy = 0 and dz = 0 then continue; end if;
        if (case when dx <> 0 then dx when dy <> 0 then dy else dz end) < 0 then continue; end if;

        v_count := 1;
        -- 正の向き
        k := 1;
        loop
          nx := v_x + dx * k; ny := v_y + dy * k; nz := v_z + dz * k;
          exit when nx < 0 or nx > 3 or ny < 0 or ny > 3 or nz < 0 or nz > 3;
          exit when p_cells[(nx * 4 + nz) * 4 + ny + 1] is distinct from v_owner;
          v_count := v_count + 1;
          k := k + 1;
        end loop;
        -- 負の向き
        k := 1;
        loop
          nx := v_x - dx * k; ny := v_y - dy * k; nz := v_z - dz * k;
          exit when nx < 0 or nx > 3 or ny < 0 or ny > 3 or nz < 0 or nz > 3;
          exit when p_cells[(nx * 4 + nz) * 4 + ny + 1] is distinct from v_owner;
          v_count := v_count + 1;
          k := k + 1;
        end loop;

        if v_count >= 4 then
          return true;
        end if;
      end loop;
    end loop;
  end loop;
  return false;
end;
$$;

-- 表示名の検証（前後の空白を除いて、1〜12文字。制御文字は不可）。不正なら NULL を返す
create or replace function game_private.clean_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name is null then null
    when btrim(p_name) = '' then null
    when char_length(btrim(p_name)) > 12 then null
    when btrim(p_name) ~ '[[:cntrl:]]' then null
    else btrim(p_name)
  end;
$$;

----------------------------------------------------------------------
-- RPC（書き込みは、すべてここを通す）
--
-- security definer のため、RLS を迂回する。そこで次を必ず守る:
--   * set search_path = ''（スキーマ名つきで参照する）
--   * 先頭で auth.uid() を確認する
--   * anon / PUBLIC の実行権限を外し、authenticated にだけ与える
----------------------------------------------------------------------

-- ルームを作る（作成者が、ホスト = 席0）
create or replace function public.create_room(p_name text)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := game_private.clean_name(p_name);
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text;
  v_room public.rooms;
  attempt integer;
  i integer;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if v_name is null then raise exception 'INVALID_NAME'; end if;

  for attempt in 1 .. 10 loop
    v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    v_code := '';
    for i in 0 .. 5 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
    end loop;
    begin
      insert into public.rooms (code, host_id, host_name)
      values (v_code, v_uid, v_name)
      returning * into v_room;
      return v_room;
    exception when unique_violation then
      -- コードが衝突したら、作り直す
      null;
    end;
  end loop;
  raise exception 'UNKNOWN';
end;
$$;

-- ルームに参加する（コードは、大文字・小文字と前後の空白を区別しない）
create or replace function public.join_room(p_code text, p_name text)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_name text;
  v_room public.rooms;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if v_code !~ '^[A-HJKMNP-Z2-9]{6}$' then raise exception 'ROOM_NOT_FOUND'; end if;

  select * into v_room from public.rooms where code = v_code for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  -- すでに参加者なら、復帰として、そのまま返す
  if v_room.host_id = v_uid or v_room.guest_id = v_uid then
    return v_room;
  end if;
  if v_room.guest_id is not null then raise exception 'ROOM_FULL'; end if;

  v_name := game_private.clean_name(p_name);
  if v_name is null then raise exception 'INVALID_NAME'; end if;

  update public.rooms
     set guest_id = v_uid, guest_name = v_name, status = 'playing', updated_at = now()
   where id = v_room.id
   returning * into v_room;
  return v_room;
end;
$$;

-- 柱に駒を落とす
create or replace function public.play_move(p_room_id uuid, p_pillar smallint)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_seat smallint;
  v_n integer;
  v_height integer;
  v_moves smallint[];
  v_last integer;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_uid = v_room.host_id then
    v_seat := 0;
  elsif v_uid = v_room.guest_id then
    v_seat := 1;
  else
    raise exception 'NOT_A_PLAYER';
  end if;

  if v_room.status <> 'playing' then raise exception 'GAME_NOT_PLAYING'; end if;

  v_n := cardinality(v_room.moves);
  if v_seat <> (v_room.first_player + v_n) % 2 then raise exception 'NOT_YOUR_TURN'; end if;

  if p_pillar is null or p_pillar < 0 or p_pillar > 15 then raise exception 'INVALID_PILLAR'; end if;

  select count(*) into v_height from unnest(v_room.moves) as m where m = p_pillar;
  if v_height >= 4 then raise exception 'PILLAR_FULL'; end if;

  v_moves := v_room.moves || p_pillar;
  v_last := p_pillar * 4 + v_height;

  if game_private.is_win(game_private.cells_from_moves(v_moves), v_last) then
    update public.rooms
       set moves = v_moves, status = 'won', winner = v_seat, updated_at = now(),
           host_wins = host_wins + (case when v_seat = 0 then 1 else 0 end),
           guest_wins = guest_wins + (case when v_seat = 1 then 1 else 0 end)
     where id = v_room.id
     returning * into v_room;
  elsif cardinality(v_moves) = 64 then
    update public.rooms
       set moves = v_moves, status = 'draw', draws = draws + 1, updated_at = now()
     where id = v_room.id
     returning * into v_room;
  else
    update public.rooms
       set moves = v_moves, updated_at = now()
     where id = v_room.id
     returning * into v_room;
  end if;
  return v_room;
end;
$$;

-- 決着後に、同じルームで再戦する（先手と後手が入れ替わる。成績は保持）
create or replace function public.rematch(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_uid is distinct from v_room.host_id and v_uid is distinct from v_room.guest_id then
    raise exception 'NOT_A_PLAYER';
  end if;
  if v_room.status not in ('won', 'draw') then raise exception 'GAME_NOT_FINISHED'; end if;

  update public.rooms
     set first_player = 1 - first_player, round = round + 1, moves = '{}', status = 'playing', winner = null, updated_at = now()
   where id = v_room.id
   returning * into v_room;
  return v_room;
end;
$$;

-- RPC の実行権限: 既定では PUBLIC（= anon を含む全員）に付くため、外して、authenticated にだけ与える
revoke all on function public.create_room(text) from public, anon;
revoke all on function public.join_room(text, text) from public, anon;
revoke all on function public.play_move(uuid, smallint) from public, anon;
revoke all on function public.rematch(uuid) from public, anon;
grant execute on function public.create_room(text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.play_move(uuid, smallint) to authenticated;
grant execute on function public.rematch(uuid) to authenticated;

----------------------------------------------------------------------
-- Realtime（相手の手を、すぐに受け取る）。RLS が適用され、参加者にだけ届く
----------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
     ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end;
$$;
