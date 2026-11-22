import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { BOARD_SIZE } from '../core';
import type { CellPos, GameState } from '../core';
import { Disc } from './Disc';
import { Pillar } from './Pillar';
import { BASE_HEIGHT, PILLAR_SPACING } from './layout';
import { isWebGLAvailable } from './webgl';

const BASE_SIZE = PILLAR_SPACING * (BOARD_SIZE - 1) + 1.4;

function Board({ state }: { state: GameState }) {
  const pillars = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => ({
    x: Math.floor(i / BOARD_SIZE),
    z: i % BOARD_SIZE,
  }));
  const discs: { owner: 0 | 1; cell: CellPos }[] = [];
  state.cells.forEach((row, x) =>
    row.forEach((column, z) =>
      column.forEach((owner, y) => {
        if (owner !== null) discs.push({ owner, cell: { x, y, z } });
      }),
    ),
  );

  return (
    <group>
      <mesh position={[0, -BASE_HEIGHT / 2, 0]} receiveShadow>
        <boxGeometry args={[BASE_SIZE, BASE_HEIGHT, BASE_SIZE]} />
        <meshStandardMaterial color="#2f5fb3" roughness={0.5} />
      </mesh>
      {pillars.map((pos) => (
        <Pillar key={`${pos.x}-${pos.z}`} pos={pos} />
      ))}
      {discs.map(({ owner, cell }) => (
        <Disc key={`${cell.x}-${cell.y}-${cell.z}`} owner={owner} cell={cell} />
      ))}
    </group>
  );
}

interface BoardSceneProps {
  state: GameState;
}

export function BoardScene({ state }: BoardSceneProps) {
  if (!isWebGLAvailable()) {
    return (
      <div role="alert" className="webgl-unsupported">
        お使いのブラウザでは3D表示（WebGL）が利用できません。別のブラウザでお試しください。
      </div>
    );
  }
  return (
    <Canvas shadows camera={{ position: [6.5, 6, 8], fov: 45 }}>
      <color attach="background" args={['#eef2f8']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 9, 6]} intensity={1.6} castShadow />
      <Board state={state} />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={7}
        maxDistance={18}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={[0, 1.2, 0]}
      />
    </Canvas>
  );
}
