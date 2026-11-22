import { isValidCode, normalizeCode } from './roomLogic';

const PARAM = 'room';

/** 招待リンクを作る。base は、サイトのアドレス（サブパスや、既存のクエリ・ハッシュは、取り除く） */
export function buildInviteUrl(base: string, code: string): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set(PARAM, normalizeCode(code));
  return url.toString();
}

/** location.search から、ルームコードを取り出す。ない・不正な値は null */
export function parseInviteCode(search: string): string | null {
  const raw = new URLSearchParams(search).get(PARAM);
  if (raw === null) return null;
  const code = normalizeCode(raw);
  return isValidCode(code) ? code : null;
}
