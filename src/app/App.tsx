import { useState } from 'react';
import type { PillarPos } from '../core';
import { BoardScene } from '../render/BoardScene';
import { Hud } from '../ui/Hud';
import { StartScreen } from '../ui/StartScreen';
import { useGame } from './useGame';

export function App() {
  const { state, names, isAnimating, startGame, selectPillar, onDropFinished } = useGame();
  const [hovered, setHovered] = useState<PillarPos | null>(null);
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <StartScreen
        onStart={(settings) => {
          startGame(settings);
          setStarted(true);
        }}
      />
    );
  }

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
