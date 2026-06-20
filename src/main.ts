import './style.css';
import { Game2A } from './game/core/Game2A';

const canvas = document.querySelector<HTMLCanvasElement>('#game');

if (!canvas) {
  throw new Error('Canvas #game was not found.');
}

const game = new Game2A(canvas);
game.start();
