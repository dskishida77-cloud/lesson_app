import type { CellPos, PillarPos } from '../core';

/** 柱どうしの間隔 */
export const PILLAR_SPACING = 1.3;
/** 駒1段あたりの高さ */
export const DISC_PITCH = 0.62;
/** 駒の半径 */
export const DISC_RADIUS = 0.5;
/** 土台の厚み */
export const BASE_HEIGHT = 0.4;
/** 柱の高さ（4段の駒が収まる） */
export const PILLAR_HEIGHT = DISC_PITCH * 4 + 0.3;

const CENTER = 1.5;

/** 柱の水平位置 [x, z]（盤面の中心が原点） */
export function pillarToWorld(p: PillarPos): [number, number] {
  return [(p.x - CENTER) * PILLAR_SPACING, (p.z - CENTER) * PILLAR_SPACING];
}

/** 駒の中心位置 [x, y, z]。土台の上面を y=0 とする */
export function cellToWorld(c: CellPos): [number, number, number] {
  const [x, z] = pillarToWorld(c);
  return [x, DISC_PITCH * (c.y + 0.5), z];
}
