import type { CellPos, PlayerId } from '../core';
import { DISC_RADIUS, cellToWorld } from './layout';

/** 先手(0)は赤、後手(1)は黄。色だけに頼らず、形（丸い駒 / 平らな円盤）でも区別する */
export const PLAYER_COLORS: Record<PlayerId, string> = { 0: '#d6342c', 1: '#f2c230' };

interface DiscProps {
  owner: PlayerId;
  cell: CellPos;
}

export function Disc({ owner, cell }: DiscProps) {
  const position = cellToWorld(cell);
  const color = PLAYER_COLORS[owner];
  if (owner === 0) {
    return (
      <mesh position={position} scale={[1, 0.55, 1]} castShadow>
        <sphereGeometry args={[DISC_RADIUS, 32, 16]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
    );
  }
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[DISC_RADIUS, DISC_RADIUS, 0.4, 32]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
      {/* 上面のくぼみ（濃い色の輪）で、先手の駒との形の違いを出す */}
      <mesh position={[0, 0.201, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[DISC_RADIUS * 0.45, DISC_RADIUS * 0.7, 32]} />
        <meshStandardMaterial color="#9c7a10" roughness={0.6} />
      </mesh>
    </group>
  );
}
