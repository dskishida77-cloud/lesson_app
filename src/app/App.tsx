import { useState } from 'react';
import type { PillarPos } from '../core';
import { BoardScene } from '../render/BoardScene';
import { Hud } from '../ui/Hud';
import { useGame } from './useGame';

export function App() {
  const { state, names, isAnimating, selectPillar, onDropFinished } = useGame();
  const [hovered, setHovered] = useState<PillarPos | null>(null);
  return (
    <div className="app">
      <Hud state={state} names={names} showResult={!isAnimating} />
      <main className="board">
        <BoardScene
          state={state}
          onSelect={(pillar) => selectPillar(pillar)}
          onHover={setHovered}
          hovered={hovered}
          animating={isAnimating}
          onDropFinished={onDropFinished}
        />
      </main>
    </div>
  );
}
