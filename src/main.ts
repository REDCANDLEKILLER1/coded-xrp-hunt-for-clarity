import './style.css';
import { Game } from './game/core/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game');

if (!canvas) {
  throw new Error('Canvas #game was not found.');
}

const game = new Game(canvas);
game.start();
