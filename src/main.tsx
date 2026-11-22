import { createRoot } from 'react-dom/client';
import { createGame } from './core';
import { BoardScene } from './render/BoardScene';

createRoot(document.getElementById('root')!).render(
  <div style={{ width: '100vw', height: '100vh' }}>
    <BoardScene state={createGame(0)} />
  </div>,
);
