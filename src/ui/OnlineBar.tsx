import type { PlayerId } from '../core';
import type { ConnectionState, OnlineView } from '../online/types';
import { PlayerMark } from './PlayerMark';

const CONNECTION_TEXT: Record<Exclude<ConnectionState, 'connected'>, string> = {
  connecting: '接続中…',
  reconnecting: '再接続中…',
  disconnected: '接続が切れました（自動で再接続します）',
};

interface OnlineBarProps {
  view: OnlineView;
  connection: ConnectionState;
}

export function OnlineBar({ view, connection }: OnlineBarProps) {
  const me = view.myPlayerId;
  const opponent: PlayerId = me === 0 ? 1 : 0;
  return (
    <section className="online-bar" aria-label="オンライン対戦の状態">
      <p className="online-players">
        <PlayerMark player={me} />
        <span>あなた: <strong>{view.names[me]}</strong></span>
        <PlayerMark player={opponent} />
        <span>相手: <strong>{view.names[opponent]}</strong></span>
      </p>
      {view.phase === 'playing' && (
        <p className={view.isMyTurn ? 'online-turn online-turn-mine' : 'online-turn'}>
          {view.isMyTurn ? 'あなたの番です' : '相手の番です'}
        </p>
      )}
      {connection !== 'connected' && (
        <p role="status" className="online-connection">{CONNECTION_TEXT[connection]}</p>
      )}
    </section>
  );
}
