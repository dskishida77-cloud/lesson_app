import { describe, expect, it } from 'vitest';
import { MAX_NAME_LENGTH, normalizeName, normalizeNames } from '../../src/app/names';

describe('normalizeName', () => {
  it('前後の空白を取り除く', () => {
    expect(normalizeName('  あや  ', '既定')).toBe('あや');
  });

  it('空・空白のみなら、既定名にする', () => {
    expect(normalizeName('', '既定')).toBe('既定');
    expect(normalizeName('   　 ', '既定')).toBe('既定');
  });

  it('12文字を超える場合は切り詰める', () => {
    expect(MAX_NAME_LENGTH).toBe(12);
    expect(normalizeName('あ'.repeat(20), '既定')).toBe('あ'.repeat(12));
  });

  it('サロゲートペア（絵文字）を途中で割らない', () => {
    const result = normalizeName('😀'.repeat(15), '既定');
    expect(Array.from(result)).toHaveLength(12);
    expect(result).toBe('😀'.repeat(12));
  });

  it('HTMLはそのまま文字列として扱う（解釈は表示側のエスケープに任せる）', () => {
    expect(normalizeName('<b>x</b>', '既定')).toBe('<b>x</b>');
  });
});

describe('normalizeNames', () => {
  it('2人分を、それぞれの既定名で正規化する', () => {
    expect(normalizeNames(['', 'ゆう'])).toEqual(['プレイヤー1', 'ゆう']);
    expect(normalizeNames(['あや', ' '])).toEqual(['あや', 'プレイヤー2']);
  });
});
