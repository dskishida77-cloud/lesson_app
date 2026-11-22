import { DEFAULT_NAMES } from './defaults';

export const MAX_NAME_LENGTH = 12;

/** 前後の空白を除き、12文字（コードポイント単位）に切り詰める。空なら既定名にする */
export function normalizeName(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return fallback;
  return Array.from(trimmed).slice(0, MAX_NAME_LENGTH).join('');
}

export function normalizeNames(raw: [string, string]): [string, string] {
  return [normalizeName(raw[0], DEFAULT_NAMES[0]), normalizeName(raw[1], DEFAULT_NAMES[1])];
}
