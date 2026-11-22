import type { PlayerId } from '../core';

/** 先手(0)は赤、後手(1)は黄。色だけに頼らず、形（丸い駒 / 平らな円盤）でも区別する */
export const PLAYER_COLORS: Record<PlayerId, string> = { 0: '#d6342c', 1: '#f2c230' };
