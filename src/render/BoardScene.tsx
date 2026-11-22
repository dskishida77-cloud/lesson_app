import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect } from 'react';
import { BOARD_SIZE } from '../core';
import type { CellPos, GameState, PillarPos } from '../core';
import { CameraRig, INITIAL_CAMERA_POSITION, INITIAL_TARGET } from './CameraRig';
import { Disc } from './Disc';
import type { DiscHighlight } from './Disc';
import { Pillar } from './Pillar';
import { BASE_HEIGHT, PILLAR_SPACING } from './layout';
import { getPreviewCell, isCellInLines } from './preview';
import { isWebGLAvailable } from './webgl';

const BASE_SIZE = PILLAR_SPACING * (BOARD_SIZE - 1) + 1.4;

interface BoardProps {
  state: GameState;
  onSelect?: (pos: PillarPos) => void;
  onHover?: (pos: PillarPos | null) => void;
  /** 落下アニメーション中か。中は、直前に置かれた駒を落下させる */
  animating?: boolean;
  onDropFinished?: () => void;
  /** ポインタを重ねている柱（駒のプレビュー用） */
  hovered?: PillarPos | null;
  /** 「視覚効果を減らす」設定。落下アニメーションを省き、すぐに着地させる */
  reducedMotion?: boolean;
}

function Board({
  state,
  onSelect,
  onHover,
  animating = false,
  onDropFinished,
  hovered = null,
  reducedMotion = false,
}: BoardProps) {
  useEffect(() => {
    if (animating && reducedMotion) onDropFinished?.();
  }, [animating, reducedMotion, onDropFinished]);

  const lastCell = state.history[state.history.length - 1]?.landed;
  const isLast = (c: CellPos) => lastCell?.x === c.x && lastCell.y === c.y && lastCell.z === c.z;
  // 勝利ラインは、落下アニメーションが終わってから強調する
  const winLines = state.status.kind === 'won' && !animating ? state.status.lines : [];
  const previewCell = animating ? null : getPreviewCell(state, hovered);
  const highlightOf = (c: CellPos): DiscHighlight | undefined =>
    isCellInLines(c, winLines) ? 'win' : isLast(c) && !animating ? 'last' : undefined;
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
        <Pillar key={`${pos.x}-${pos.z}`} pos={pos} onSelect={onSelect} onHover={onHover} />
      ))}
      {discs.map(({ owner, cell }) => (
        <Disc
          key={`${cell.x}-${cell.y}-${cell.z}`}
          owner={owner}
          cell={cell}
          highlight={highlightOf(cell)}
          animate={animating && !reducedMotion && isLast(cell)}
          onDropFinished={onDropFinished}
        />
      ))}
      {previewCell && <Disc key="preview" ghost owner={state.current} cell={previewCell} />}
    </group>
  );
}

interface BoardSceneProps {
  state: GameState;
  /** 柱が選択された（移動量の小さいクリック・タップ） */
  onSelect?: (pos: PillarPos) => void;
  onHover?: (pos: PillarPos | null) => void;
  animating?: boolean;
  onDropFinished?: () => void;
  hovered?: PillarPos | null;
  /** この値が増えるたびに、視点を初期状態へ戻す */
  resetSignal?: number;
  reducedMotion?: boolean;
}

export function BoardScene({
  state,
  onSelect,
  onHover,
  animating,
  onDropFinished,
  hovered,
  resetSignal = 0,
  reducedMotion = false,
}: BoardSceneProps) {
  if (!isWebGLAvailable()) {
    return (
      <div role="alert" className="webgl-unsupported">
        お使いのブラウザでは3D表示（WebGL）が利用できません。別のブラウザでお試しください。
      </div>
    );
  }
  return (
    <Canvas shadows camera={{ position: INITIAL_CAMERA_POSITION, fov: 45 }}>
      <color attach="background" args={['#eef2f8']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 9, 6]} intensity={1.6} castShadow />
      <Board
        state={state}
        onSelect={onSelect}
        onHover={onHover}
        animating={animating}
        onDropFinished={onDropFinished}
        hovered={hovered}
        reducedMotion={reducedMotion}
      />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={7}
        maxDistance={18}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={INITIAL_TARGET}
      />
      <CameraRig resetSignal={resetSignal} />
    </Canvas>
  );
}
