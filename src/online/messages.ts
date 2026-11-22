import type { RoomErrorCode } from './types';

/** 画面に表示する、エラーの日本語メッセージ */
export const ROOM_ERROR_MESSAGES: Record<RoomErrorCode, string> = {
  NOT_CONFIGURED: 'オンライン対戦の設定がありません。',
  NOT_AUTHENTICATED: '接続に失敗しました。時間をおいて、もう一度お試しください。',
  INVALID_NAME: '名前を1〜12文字で入力してください。',
  ROOM_NOT_FOUND: 'ルームが見つかりません。招待リンクまたはコードを確認してください。',
  ROOM_FULL: 'このルームは、すでに2人が揃っています。',
  NOT_A_PLAYER: 'このルームの参加者ではありません。',
  GAME_NOT_PLAYING: '現在は、着手できません。',
  NOT_YOUR_TURN: '相手の手番です。',
  INVALID_PILLAR: '選べない柱です。',
  PILLAR_FULL: 'この柱は満杯です。',
  GAME_NOT_FINISHED: 'まだ対局が終わっていません。',
  NETWORK: '通信に失敗しました。もう一度お試しください。',
  UNKNOWN: '問題が発生しました。もう一度お試しください。',
};

export const roomErrorMessage = (code: RoomErrorCode): string => ROOM_ERROR_MESSAGES[code];
