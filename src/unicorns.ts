/**
 * Rainbow Claw — Unicorn Varieties, Rarity Ranks, and 1-Bit Pixel Graphics
 */

export interface UnicornVariety {
  rank: number; // 1 to 7 (used for poker straights: 1-2-3-4-5 etc.)
  name: string;
  tierName: string;
  baseChips: number;
  radius: number;
  weight: number;
  colorName: string;
}

export const UNICORN_VARIETIES: UnicornVariety[] = [
  { rank: 1, name: 'Cotton Spark', tierName: 'Common', baseChips: 10, radius: 10, weight: 1.0, colorName: 'White' },
  { rank: 2, name: 'Bubble Dream', tierName: 'Uncommon', baseChips: 25, radius: 11, weight: 1.1, colorName: 'Pastel' },
  { rank: 3, name: 'Sunset Velvet', tierName: 'Uncommon', baseChips: 45, radius: 11.5, weight: 1.2, colorName: 'Amber' },
  { rank: 4, name: 'Cyber Chrome', tierName: 'Rare', baseChips: 75, radius: 12, weight: 1.3, colorName: 'Cyan' },
  { rank: 5, name: 'Shadow Twilight', tierName: 'Epic', baseChips: 120, radius: 12.5, weight: 1.4, colorName: 'Violet' },
  { rank: 6, name: 'Solar Radiant', tierName: 'Legendary', baseChips: 200, radius: 13, weight: 1.5, colorName: 'Gold' },
  { rank: 7, name: 'Prism Alicorn', tierName: 'Mythic', baseChips: 350, radius: 14, weight: 1.6, colorName: 'Prism' },
];

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

  const r = u.radius;
  const isDark = u.variety.rank === 5; // Shadow Twilight has inverted dither body

  // --- Rainbow Aura / Golden Sparkle ---
  if (u.isGolden || rainbowMode || u.isGrabbed) {
    const rainbowHue = (time * 180 + u.hueOffset) % 360;
    ctx.strokeStyle = `hsl(${rainbowHue}, 100%, 65%)`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
    ctx.stroke();

    // Golden / Rainbow sparkles
    if (u.isGolden) {
      const sparkleAngle = time * 4 + u.id;
      const sx = Math.cos(sparkleAngle) * (r + 4);
      const sy = Math.sin(sparkleAngle) * (r + 4);
      ctx.fillStyle = '#ffec40';
      ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 3, 3);
    }
  }

  // --- 1-Bit Base Body ---
  ctx.fillStyle = isDark ? '#111318' : '#ffffff';
  ctx.strokeStyle = '#050508';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.ellipse(0, 2, r, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head bump / Snout
  ctx.beginPath();
  ctx.arc(-r * 0.45, -1, r * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Snout nose dot
  ctx.fillStyle = isDark ? '#ffffff' : '#050508';
  ctx.fillRect(-Math.round(r * 0.8), 0, 2, 2);

  // --- Ears ---
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, -r * 0.8);
  ctx.lineTo(-r * 0.45, -r * 1.3);
  ctx.lineTo(-r * 0.1, -r * 1.1);
  ctx.closePath();
  ctx.fillStyle = isDark ? '#222530' : '#f0f0f5';
  ctx.fill();
  ctx.stroke();

  // --- Mane (Varies per rank) ---
  ctx.fillStyle = isDark ? '#ffffff' : '#050508';
  if (u.variety.rank === 1) {
    // Cotton Spark: Cute little mane puffs
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(r * 0.1 + i * 4, -r * 0.6 + i * 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (u.variety.rank === 2) {
    // Bubble Dream: Cloud-like mane
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(r * 0.05 + i * 3.5, -r * 0.7 + i * 2.5, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (u.variety.rank === 3) {
    // Sunset Velvet: Striped swept mane (dithered lines)
    ctx.fillRect(Math.round(r * 0.05), Math.round(-r * 0.9), 10, 3);
    ctx.fillRect(Math.round(r * 0.15), Math.round(-r * 0.5), 11, 3);
    ctx.fillRect(Math.round(r * 0.25), Math.round(-r * 0.1), 10, 3);
  } else if (u.variety.rank === 4) {
    // Cyber Chrome: Geometric spiked cyber mane
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(Math.round(r * 0.1 + i * 4), Math.round(-r * 0.8 + i * 3), 3, 7);
    }
  } else if (u.variety.rank === 5) {
    // Shadow Twilight: Dark flowing shadow crest
    ctx.fillStyle = '#f0f0f5';
    ctx.beginPath();
    ctx.arc(r * 0.3, -r * 0.5, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (u.variety.rank === 6) {
    // Solar Radiant: Sunburst flame spikes
    ctx.fillStyle = u.isGolden ? '#ffec40' : (isDark ? '#fff' : '#050508');
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI * 0.6 + i * 0.3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * r * 0.8, Math.sin(angle) * r * 0.8);
      ctx.lineTo(Math.cos(angle) * (r * 1.4), Math.sin(angle) * (r * 1.4));
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else {
    // Prism Alicorn: Angelic Wings + Prism Crest!
    const wingFlap = Math.sin(time * 6 + u.id) * 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(r * 0.6, -r * 1.3 + wingFlap, r * 1.3, -r * 0.8 + wingFlap);
    ctx.quadraticCurveTo(r * 0.7, -r * 0.2, 0, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();
  }

  // --- Cute Eyes ---
  ctx.fillStyle = isDark ? '#ffffff' : '#050508';
  if (u.variety.rank === 2) {
    // Wink eye
    ctx.beginPath();
    ctx.arc(-r * 0.45, -3, 2.5, 0, Math.PI);
    ctx.stroke();
  } else if (u.variety.rank === 4) {
    // Cyber Visor
    ctx.fillStyle = '#050508';
    ctx.fillRect(-Math.round(r * 0.65), -5, 7, 3);
  } else {
    // Big round cute anime pupil
    ctx.beginPath();
    ctx.arc(-r * 0.45, -3, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Catchlight dot
    ctx.fillStyle = isDark ? '#000000' : '#ffffff';
    ctx.fillRect(-Math.round(r * 0.45) - 1, -4, 1.5, 1.5);
  }

  // --- HORN (The signature crowning glory!) ---
  const hornHue = (time * 240 + u.hueOffset) % 360;
  ctx.fillStyle = (u.isGolden || u.variety.rank >= 6 || rainbowMode)
    ? `hsl(${hornHue}, 100%, 65%)`
    : (isDark ? '#f5f6fa' : '#050508');

  ctx.beginPath();
  const hornBaseX = -r * 0.35;
  const hornBaseY = -r * 0.75;
  const hornLength = r * (0.8 + u.variety.rank * 0.12);
  const hornTipX = hornBaseX - 3;
  const hornTipY = hornBaseY - hornLength;

  ctx.moveTo(hornBaseX - 2.5, hornBaseY);
  ctx.lineTo(hornTipX, hornTipY);
  ctx.lineTo(hornBaseX + 2.5, hornBaseY + 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Spiral horn rings
  ctx.strokeStyle = (u.isGolden || rainbowMode) ? '#ffffff' : (isDark ? '#050508' : '#ffffff');
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    const rx = hornBaseX * (1 - t) + hornTipX * t;
    const ry = hornBaseY * (1 - t) + hornTipY * t;
    ctx.beginPath();
    ctx.moveTo(rx - 2, ry);
    ctx.lineTo(rx + 2, ry - 1);
    ctx.stroke();
  }

  // Cute plush little stubby legs
  ctx.fillStyle = isDark ? '#111318' : '#ffffff';
  ctx.strokeStyle = '#050508';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-r * 0.4, r * 0.8, 3, 0, Math.PI * 2);
  ctx.arc(r * 0.35, r * 0.8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}
