import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDropHeight } from '../core';
import type { PillarPos } from '../core';
import { normalizeName } from '../app/names';
import { roomErrorMessage } from './messages';
import type { RoomStore } from './RoomStore';
import { isNewerRow, isValidCode, normalizeCode, pillarToIndex, rowToView } from './roomLogic';
import { RoomError } from './types';
import type { ConnectionState, OnlineView, RoomApi, RoomErrorCode, RoomRow } from './types';

export type OnlineStage = 'lobby' | 'busy' | 'room' | 'fatal';
export type BusyAction = 'creating' | 'joining' | 'restoring';

/** selectPillar の結果 */
export type SelectResult = 'SENT' | 'IGNORED' | 'NOT_YOUR_TURN' | 'PILLAR_FULL' | 'FAILED';

export interface UseOnlineGameOptions {
  /** 通信層。描画のたびに変わらない、同じ値を渡すこと（変わると、購読をやり直す） */
  api: RoomApi;
  store: RoomStore;
  /** 画面に出す短い通知（トースト）。「相手の手番です」など */
  onNotice?: (message: string) => void;
}

export interface UseOnlineGame {
  stage: OnlineStage;
  busy: BusyAction | null;
  /** 参加中のルームの表示用データ。ロビーの間は null */
  view: OnlineView | null;
  connection: ConnectionState;
  /** 駒の落下アニメーション中か（中は、入力を受け付けない） */
  isAnimating: boolean;
  /** ロビーに表示するエラー（作成・参加の失敗） */
  error: RoomErrorCode | null;
  createRoom: (name: string) => Promise<void>;
  joinRoom: (code: string, name: string) => Promise<void>;
  selectPillar: (pillar: PillarPos) => Promise<SelectResult>;
  rematch: () => Promise<void>;
  /** ルームを抜けて、ロビーへ戻る */
  leave: () => void;
  dropFinished: () => void;
  dismissError: () => void;
}

const errorCodeOf = (e: unknown): RoomErrorCode => (e instanceof RoomError ? e.code : 'UNKNOWN');

export function useOnlineGame({ api, store, onNotice }: UseOnlineGameOptions): UseOnlineGame {
  const [row, setRow] = useState<RoomRow | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction | null>(() => (store.get() ? 'restoring' : null));
  const [error, setError] = useState<RoomErrorCode | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [animating, setAnimatingState] = useState(false);

  // 非同期の処理の中から、最新の値を同期的に読むための写し
  const rowRef = useRef<RoomRow | null>(null);
  const animatingRef = useRef(false);
  const sendingRef = useRef(false);
  const noticeRef = useRef(onNotice);
  noticeRef.current = onNotice;
  const notice = useCallback((message: string) => noticeRef.current?.(message), []);

  const setAnimating = useCallback((value: boolean) => {
    animatingRef.current = value;
    setAnimatingState(value);
  }, []);

  /** 行を受け取る。手元より新しい行だけを採用し、ちょうど1手増えたときだけ、落下アニメーションにする */
  const acceptRow = useCallback(
    (next: RoomRow) => {
      const current = rowRef.current;
      const sameRoom = current !== null && current.id === next.id;
      if (sameRoom && !isNewerRow(next, current)) return;
      const animate = sameRoom && next.round === current.round && next.moves.length - current.moves.length === 1;
      rowRef.current = next;
      setRow(next);
      setAnimating(animate);
    },
    [setAnimating],
  );

  const enterRoom = useCallback(
    (next: RoomRow, uid: string) => {
      store.set(next.id);
      setUserId(uid);
      rowRef.current = null; // 別のルームの履歴との比較を、避ける
      acceptRow(next);
      setAnimating(false);
    },
    [store, acceptRow, setAnimating],
  );

  const leave = useCallback(() => {
    store.clear();
    rowRef.current = null;
    sendingRef.current = false;
    setRow(null);
    setAnimating(false);
    setBusy(null);
    setConnection('connecting');
  }, [store, setAnimating]);

  // 再読み込みからの復帰
  useEffect(() => {
    const savedId = store.get();
    if (!savedId) return;
    let cancelled = false;
    (async () => {
      try {
        const uid = await api.ensureUser();
        const restored = await api.getRoom(savedId);
        if (cancelled) return;
        if (restored && (restored.host_id === uid || restored.guest_id === uid)) {
          enterRoom(restored, uid);
        } else {
          store.clear(); // 参加者でない、または、ルームが見つからない
        }
      } catch {
        // 通信に失敗した場合は、保存を残して、ロビーに戻す（次の再読み込みで、再び試せる）
        if (!cancelled) notice(roomErrorMessage('NETWORK'));
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // 起動時に、1回だけ実行する
  }, []);

  const roomId = row?.id ?? null;

  // ルームの更新の購読。接続できるたびに、最新の行を取り直す（購読前・切断中に起きた更新を取りこぼさない）
  useEffect(() => {
    if (!roomId) return;
    let active = true;
    const resync = () => {
      api
        .getRoom(roomId)
        .then((latest) => {
          if (!active) return;
          if (latest) acceptRow(latest);
          else {
            notice(roomErrorMessage('ROOM_NOT_FOUND'));
            leave();
          }
        })
        .catch(() => {
          // 通信エラーは、次の接続のときに、やり直される
        });
    };
    const off = api.subscribe(roomId, {
      onRow: (next) => {
        if (active) acceptRow(next);
      },
      onConnection: (state) => {
        if (!active) return;
        setConnection(state);
        if (state === 'connected') resync();
      },
    });
    return () => {
      active = false;
      off();
    };
  }, [roomId, api, acceptRow, leave, notice]);

  const viewResult = useMemo(() => (row && userId ? rowToView(row, userId) : null), [row, userId]);
  const view = viewResult?.ok ? viewResult.view : null;
  const viewRef = useRef<OnlineView | null>(null);
  viewRef.current = view;

  const stage: OnlineStage = viewResult
    ? viewResult.ok
      ? 'room'
      : 'fatal'
    : busy
      ? 'busy'
      : 'lobby';

  const createRoom = useCallback(
    async (rawName: string) => {
      const name = normalizeName(rawName, '');
      if (!name) {
        setError('INVALID_NAME');
        return;
      }
      setError(null);
      setBusy('creating');
      try {
        const uid = await api.ensureUser();
        enterRoom(await api.createRoom(name), uid);
      } catch (e) {
        setError(errorCodeOf(e));
      } finally {
        setBusy(null);
      }
    },
    [api, enterRoom],
  );

  const joinRoom = useCallback(
    async (rawCode: string, rawName: string) => {
      const code = normalizeCode(rawCode);
      const name = normalizeName(rawName, '');
      if (!isValidCode(code)) {
        setError('ROOM_NOT_FOUND');
        return;
      }
      if (!name) {
        setError('INVALID_NAME');
        return;
      }
      setError(null);
      setBusy('joining');
      try {
        const uid = await api.ensureUser();
        enterRoom(await api.joinRoom(code, name), uid);
      } catch (e) {
        setError(errorCodeOf(e));
      } finally {
        setBusy(null);
      }
    },
    [api, enterRoom],
  );

  /** 失敗後に、サーバーの最新の状態へ合わせ直す */
  const refetch = useCallback(async () => {
    const current = rowRef.current;
    if (!current) return;
    try {
      const latest = await api.getRoom(current.id);
      if (latest) acceptRow(latest);
    } catch {
      // 通信エラーは、無視する（接続の復帰時に、再同期される）
    }
  }, [api, acceptRow]);

  const selectPillar = useCallback(
    async (pillar: PillarPos): Promise<SelectResult> => {
      const current = viewRef.current;
      if (!current || current.phase !== 'playing') return 'IGNORED';
      if (animatingRef.current || sendingRef.current) return 'IGNORED';
      if (!current.isMyTurn) {
        notice(roomErrorMessage('NOT_YOUR_TURN'));
        return 'NOT_YOUR_TURN';
      }
      if (getDropHeight(current.state, pillar) === null) {
        notice(roomErrorMessage('PILLAR_FULL'));
        return 'PILLAR_FULL';
      }

      sendingRef.current = true; // 送信中の二重送信を防ぐ
      try {
        acceptRow(await api.playMove(current.roomId, pillarToIndex(pillar)));
        return 'SENT';
      } catch (e) {
        const code = errorCodeOf(e);
        if (code === 'NETWORK') {
          notice('送信に失敗しました。もう一度、柱を選んでください。');
        } else {
          notice(roomErrorMessage(code));
          // 手番の食い違いなどは、最新の状態に合わせ直す
          if (code === 'NOT_YOUR_TURN' || code === 'GAME_NOT_PLAYING' || code === 'PILLAR_FULL') await refetch();
        }
        return 'FAILED';
      } finally {
        sendingRef.current = false;
      }
    },
    [api, acceptRow, notice, refetch],
  );

  const rematch = useCallback(async () => {
    const current = viewRef.current;
    if (!current || current.phase !== 'ended' || sendingRef.current) return;
    sendingRef.current = true;
    try {
      acceptRow(await api.rematch(current.roomId));
    } catch (e) {
      const code = errorCodeOf(e);
      if (code === 'GAME_NOT_FINISHED') {
        // 相手が先に再戦を始めていた。最新の状態に合わせる
        await refetch();
      } else {
        notice(roomErrorMessage(code));
      }
    } finally {
      sendingRef.current = false;
    }
  }, [api, acceptRow, notice, refetch]);

  return {
    stage,
    busy,
    view,
    connection,
    isAnimating: animating,
    error,
    createRoom,
    joinRoom,
    selectPillar,
    rematch,
    leave,
    dropFinished: useCallback(() => setAnimating(false), [setAnimating]),
    dismissError: useCallback(() => setError(null), []),
  };
}
