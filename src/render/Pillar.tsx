import type { PillarPos } from '../core';
import { PILLAR_HEIGHT, pillarToWorld } from './layout';

interface PillarProps {
  pos: PillarPos;
}

export function Pillar({ pos }: PillarProps) {
  const [x, z] = pillarToWorld(pos);
  return (
    <mesh position={[x, PILLAR_HEIGHT / 2, z]} castShadow>
      <cylinderGeometry args={[0.09, 0.09, PILLAR_HEIGHT, 16]} />
      <meshStandardMaterial color="#c9ced6" metalness={0.3} roughness={0.4} />
    </mesh>
  );
}
