import { BoardScene } from '../render/BoardScene';
import { Hud } from '../ui/Hud';
import { useGame } from './useGame';

export function App() {
  const { state, names, selectPillar } = useGame();
  return (
    <div className="app">
      <Hud state={state} names={names} />
      <main className="board">
        <BoardScene state={state} onSelect={(pillar) => selectPillar(pillar)} />
      </main>
    </div>
  );
}
