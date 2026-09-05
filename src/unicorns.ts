/**
 * Rainbow Claw — Unicorn Varieties, Rarity Ranks, and 1-Bit Pixel Graphics
 */

export interface UnicornVariety {
  rank: number; // 1 to 7 (used for poker straights: 1-2-3-4-5 etc.)
  name: string;
  baseChips: number;
  radius: number;
  weight: number;
}

export const UNICORN_VARIETIES: UnicornVariety[] = [
  [1, 'Cotton Spark', 10, 10, 1],
  [2, 'Bubble Dream', 25, 11, 1.1],
  [3, 'Sunset Velvet', 45, 11.5, 1.2],
  [4, 'Cyber Chrome', 75, 12, 1.3],
  [5, 'Shadow Twilight', 120, 12.5, 1.4],
  [6, 'Solar Radiant', 200, 13, 1.5],
  [7, 'Prism Alicorn', 350, 14, 1.6],
].map(([rank, name, baseChips, radius, weight]) => ({
  rank: rank as number,
  name: name as string,
  baseChips: baseChips as number,
  radius: radius as number,
  weight: weight as number,
}));

export interface UnicornPlush {
  id: number;
  variety: UnicornVariety;
  isGolden: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angVel: number;
  radius: number;
  mass: number;
  squishX: number;
  squishY: number;
  isGrabbed: boolean;
  gripLocked?: boolean;
  isScored: boolean;
  inChute: boolean;
  hueOffset: number;
}

let nextId = 1;

export function createUnicorn(
  variety: UnicornVariety,
  x: number,
  y: number,
  isGolden = false
): UnicornPlush {
  return {
    id: nextId++,
    variety,
    isGolden,
    x,
    y,
    vx: (Math.random() - 0.5) * 20,
    vy: (Math.random() - 0.5) * 10,
    angle: (Math.random() - 0.5) * 0.4,
    angVel: 0,
    radius: variety.radius,
    mass: variety.weight,
    squishX: 1.0,
    squishY: 1.0,
    isGrabbed: false,
    gripLocked: false,
    isScored: false,
    inChute: false,
    hueOffset: Math.random() * 360,
  };
}

/**
 * 1-bit Pixel Art Renderer for Plush Unicorns with Rainbow Highlights
 */
export function drawUnicorn(
  ctx: CanvasRenderingContext2D,
  u: UnicornPlush,
  time: number,
  rainbowMode = false
): void {
  ctx.save();
  ctx.translate(Math.round(u.x), Math.round(u.y));
  ctx.rotate(u.angle);
  ctx.scale(u.squishX, u.squishY);

  const r = u.radius, rank = u.variety.rank, isDark = rank === 5;
  const bodyCol = isDark ? '#141622' : '#ffffff';
  const rainbowHue = (time * 180 + u.hueOffset) % 360;

  // 1. Rainbow / Golden Aura
  if (u.isGolden || rainbowMode || u.isGrabbed) {
    ctx.strokeStyle = u.isGolden ? '#ffea40' : `hsl(${rainbowHue}, 100%, 65%)`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, 6.28);
    ctx.stroke();

    if (u.isGolden) {
      const spA = time * 4 + u.id;
      ctx.fillStyle = '#fff275';
      ctx.fillRect(Math.cos(spA) * (r + 5) - 1.5, Math.sin(spA) * (r + 5) - 1.5, 3, 3);
    }
  }

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#050508';

  // 2. Fluffy Pony Tail (Wagging at rump)
  ctx.save();
  ctx.translate(r * 0.6, r * 0.05);
  ctx.rotate(Math.sin(time * 5 + u.id) * 0.12);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(r * 0.45, -r * 0.25, r * 0.7, r * 0.2, r * 0.45, r * 0.65);
  ctx.bezierCurveTo(r * 0.2, r * 0.45, r * 0.1, r * 0.2, 0, 0);
  ctx.fillStyle = (rank === 7 || rank === 1 || rainbowMode)
    ? `hsl(${(rainbowHue + 30) % 360}, 90%, 68%)`
    : (isDark ? '#524570' : '#ff70a5');
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(r * 0.1, 0);
  ctx.quadraticCurveTo(r * 0.4, r * 0.15, r * 0.32, r * 0.5);
  ctx.stroke();
  ctx.restore();

  // Helper for drawing legs with hooves
  const drawLegs = (x1: number, x2: number, y: number, col: string, hoofCol: string) => {
    ctx.fillStyle = col;
    ctx.strokeStyle = '#050508';
    ctx.lineWidth = 1.2;
    for (const lx of [x1, x2]) {
      ctx.beginPath();
      ctx.roundRect(r * lx, r * y, r * 0.26, r * 0.56, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = hoofCol;
      ctx.fillRect(r * lx, r * (y + 0.41), r * 0.26, r * 0.15);
      ctx.fillStyle = col;
    }
  };

  const drawTri = (p: number[], fill: string | CanvasGradient, stroke = '#050508', w = 1.2) => {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(p[2], p[3]);
    ctx.lineTo(p[4], p[5]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = w;
      ctx.stroke();
    }
  };

  // 3. Back Legs & Hooves (Recessed)
  drawLegs(-0.35, 0.25, 0.25, isDark ? '#0b0d14' : '#dbe0ee', isDark ? '#050508' : '#222634');

  // 4. Far Ear
  drawTri([-r * 0.22, -r * 0.55, -r * 0.28, -r * 0.98, -r * 0.1, -r * 0.7], isDark ? '#1c2030' : '#e2e7f2');

  // 5. Flowing Mane (Behind neck crest)
  ctx.save();
  const maneHue = (rainbowHue + 40) % 360;
  if (rank <= 2) {
    ctx.fillStyle = rank === 1 ? `hsl(${maneHue}, 85%, 72%)` : '#55c8ff';
    const offsets = rank === 1 ? [-0.15, 0.05, 0.25] : [-0.18, 0.02, 0.22, 0.38];
    for (let i = 0; i < offsets.length; i++) {
      ctx.beginPath();
      ctx.arc(r * offsets[i], -r * (0.6 - i * 0.21), r * 0.26, 0, 6.28);
      ctx.fill();
      ctx.strokeStyle = '#050508';
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
  } else if (rank === 4) {
    for (let i = 0; i < 3; i++) {
      drawTri([r * (-0.15 + i * 0.2), -r * (0.55 - i * 0.22), r * (0.1 + i * 0.2), -r * (0.82 - i * 0.22), r * (0.05 + i * 0.2), -r * (0.42 - i * 0.22)], '#00f5c4');
    }
  } else if (rank === 6) {
    for (let i = 0; i < 4; i++) {
      const a = -0.9 + i * 0.35;
      drawTri([Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35 - r * 0.25, Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95 - r * 0.25, Math.cos(a + 0.2) * r * 0.45, Math.sin(a + 0.2) * r * 0.45 - r * 0.25], '#ff9900');
    }
  } else {
    ctx.fillStyle = rank === 3 ? '#ff2b70' : (rank === 5 ? '#7a52c7' : `hsl(${rainbowHue}, 100%, 70%)`);
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 0.68);
    ctx.quadraticCurveTo(r * 0.26, -r * 0.88, r * 0.45, -r * 0.25);
    ctx.lineTo(r * 0.12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#050508';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();

  // 6. Seamless Equine Torso, Arched Neck, and Snout
  ctx.fillStyle = bodyCol;
  ctx.strokeStyle = '#050508';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.45, r * 0.15);
  ctx.quadraticCurveTo(-r * 0.25, r * 0.5, 0, r * 0.5);
  ctx.quadraticCurveTo(r * 0.5, r * 0.5, r * 0.6, r * 0.12);
  ctx.quadraticCurveTo(r * 0.62, -r * 0.15, r * 0.2, -r * 0.12);
  ctx.quadraticCurveTo(-r * 0.05, -r * 0.38, -r * 0.3, -r * 0.58);
  ctx.lineTo(-r * 0.52, -r * 0.54);
  ctx.lineTo(-r * 0.8, -r * 0.25);
  ctx.quadraticCurveTo(-r * 0.88, -r * 0.05, -r * 0.68, -r * 0.05);
  ctx.quadraticCurveTo(-r * 0.5, -r * 0.02, -r * 0.45, r * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 7. Alicorn Wing (Rank 7)
  if (rank === 7) {
    ctx.save();
    ctx.translate(r * 0.05, -r * 0.08);
    ctx.rotate(Math.sin(time * 6 + u.id) * 0.08);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#050508';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(r * 0.35, -r * 0.55, r * 0.75, -r * 0.4);
    ctx.quadraticCurveTo(r * 0.5, -r * 0.05, r * 0.15, r * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.2, -r * 0.2);
    ctx.lineTo(r * 0.55, -r * 0.3);
    ctx.stroke();
    ctx.restore();
  }

  // 8. Front Legs & Hooves (Foreground)
  drawLegs(-0.48, 0.12, 0.22, bodyCol, isDark ? '#ffffff' : '#222634');

  // 9. Near Equine Ear
  drawTri([-r * 0.28, -r * 0.54, -r * 0.36, -r * 0.95, -r * 0.16, -r * 0.68], bodyCol, '#050508', 1.3);
  drawTri([-r * 0.28, -r * 0.6, -r * 0.33, -r * 0.88, -r * 0.2, -r * 0.7], isDark ? '#262a3d' : '#ffb6c1', '');

  // 10. Nostril
  ctx.fillStyle = isDark ? '#ffffff' : '#050508';
  ctx.fillRect(-r * 0.76, -r * 0.16, 1.6, 1.6);

  // 11. Eye
  const eyeX = -r * 0.48, eyeY = -r * 0.28, eyeR = r * 0.22;
  if (rank === 4) {
    ctx.fillStyle = '#00f5c4';
    ctx.fillRect(eyeX - 3, eyeY - 2.5, 9, 4.5);
    ctx.strokeStyle = '#050508';
    ctx.lineWidth = 1;
    ctx.strokeRect(eyeX - 3, eyeY - 2.5, 9, 4.5);
  } else if (rank === 2) {
    ctx.strokeStyle = isDark ? '#ffffff' : '#050508';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeR, 3.45, 6.0);
    ctx.stroke();
  } else {
    ctx.fillStyle = isDark ? '#ffffff' : '#050508';
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, eyeR, eyeR * 1.1, -0.05, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX - 1, eyeY - 1.2, eyeR * 0.45, 0, 6.28);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX + 1.2, eyeY + 1.2, eyeR * 0.2, 0, 6.28);
    ctx.fill();
  }

  // Cheek blush
  if (!isDark && rank !== 4) {
    ctx.fillStyle = 'rgba(255, 120, 160, 0.4)';
    ctx.beginPath();
    ctx.ellipse(eyeX + 1, eyeY + r * 0.25, r * 0.16, r * 0.08, 0, 0, 6.28);
    ctx.fill();
  }

  // 12. PROUD SPIRAL UNICORN HORN
  const hBaseX = -r * 0.40, hBaseY = -r * 0.52;
  const hLen = r * (0.85 + rank * 0.08);
  const hTipX = hBaseX - 0.25 * hLen, hTipY = hBaseY - 0.97 * hLen;
  const pX = 2.4, pY = -0.6;

  const hHue = (time * 260 + u.hueOffset) % 360;
  const hGrad = ctx.createLinearGradient(hBaseX, hBaseY, hTipX, hTipY);
  hGrad.addColorStop(0, `hsl(${hHue}, 100%, 75%)`);
  hGrad.addColorStop(0.5, `hsl(${(hHue + 60) % 360}, 100%, 70%)`);
  hGrad.addColorStop(1, '#ffffff');

  drawTri([hBaseX + pX, hBaseY + pY, hTipX, hTipY, hBaseX - pX, hBaseY - pY], (u.isGolden || rank >= 3 || rainbowMode) ? hGrad : '#ffea00');

  // Spiral ridges
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.9;
  for (let s = 1; s <= 3; s++) {
    const t = s / 4;
    const sx = hBaseX * (1 - t) + hTipX * t;
    const sy = hBaseY * (1 - t) + hTipY * t;
    const spX = pX * (1 - t * 0.6);
    const spY = pY * (1 - t * 0.6);
    ctx.beginPath();
    ctx.moveTo(sx - spX, sy - spY);
    ctx.lineTo(sx + spX, sy + spY);
    ctx.stroke();
  }

  // Horn glint
  const gl = 2 + Math.sin(time * 8 + u.id) * 0.8;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(hTipX - gl * 0.5, hTipY - 0.5, gl, 1);
  ctx.fillRect(hTipX - 0.5, hTipY - gl * 0.5, 1, gl);

  ctx.restore();
}
