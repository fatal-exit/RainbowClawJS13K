/**
 * Rainbow Claw — Main Bootstrap
 * JS13kGames 2026 / Wavedash Category
 * 2D 1-Bit Pixel Claw Machine with Rainbow Color Splash & Balatro Combos
 */

import { Game } from './game';
import { wavedash } from './wavedash';

function init(): void {
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  if (!canvas) return;

  wavedash.reportProgress(0.4);

  // Set internal resolution strictly to 4:3 aspect ratio (400x300)
  canvas.width = 400;
  canvas.height = 300;

  const game = new Game(canvas);
  (window as any).__rainbowGame = game;

  wavedash.reportProgress(0.8);
  wavedash.init(false);
  wavedash.reportProgress(1.0);

  // Main Loop
  let lastTime = performance.now();
  function loop(now: number): void {
    const dt = Math.min(0.06, (now - lastTime) / 1000);
    lastTime = now;

    game.update(dt);
    game.render();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

init();
