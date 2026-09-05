/**
 * Rainbow Claw — Particle System, Rainbow Splashes & Screen Shake Juice
 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  type: 'star' | 'dot' | 'ring' | 'confetti' | 'text';
  color: string;
  isRainbow: boolean;
  hueOffset: number;
  text?: string;
  rot?: number;
  rotSpeed?: number;
}

export class ParticleSystem {
  public particles: Particle[] = [];
  public trauma = 0;
  public shakeX = 0;
  public shakeY = 0;
  public shakeRot = 0;

  public update(dt: number): void {
    // 1. Update Screen Shake with polynomial decay (trauma^2)
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 2.2);
      const intensity = this.trauma * this.trauma;
      const t = performance.now() * 0.05;
      this.shakeX = (Math.sin(t * 1.3) + Math.cos(t * 2.1)) * 6.0 * intensity;
      this.shakeY = (Math.cos(t * 1.7) + Math.sin(t * 2.7)) * 5.0 * intensity;
      this.shakeRot = Math.sin(t * 1.9) * 0.04 * intensity;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
      this.shakeRot = 0;
    }

    // 2. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.type === 'confetti' || p.type === 'star') {
        p.vy += 80 * dt; // Gravity
        p.vx *= 0.98;
      }
      if (p.rot !== undefined && p.rotSpeed !== undefined) {
        p.rot += p.rotSpeed * dt;
      }
    }
  }

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  /**
   * Explosive Rainbow Color Splash (Triggered on Grab, Chute Drop, or Combo)
   */
  public emitRainbowBurst(x: number, y: number, count = 28, speed = 120): void {
    this.addTrauma(0.25);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * s,
        vy: Math.sin(angle) * s - 20,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.4,
        size: 3 + Math.random() * 3,
        type: i % 3 === 0 ? 'star' : 'dot',
        color: '#fff',
        isRainbow: true,
        hueOffset: (i * (360 / count)) % 360,
        rot: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 10,
      });
    }

    // Expanding rainbow shockwave ring
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0.45,
      size: 6,
      type: 'ring',
      color: '#fff',
      isRainbow: true,
      hueOffset: Math.random() * 360,
    });
  }

  /**
   * Rainbow Confetti Celebration (Day Quota Beaten)
   */
  public emitConfetti(width = 400): void {
    this.addTrauma(0.4);
    for (let i = 0; i < 45; i++) {
      this.particles.push({
        x: Math.random() * width,
        y: -10 - Math.random() * 30,
        vx: (Math.random() - 0.5) * 60,
        vy: 40 + Math.random() * 110,
        life: 0,
        maxLife: 2.0 + Math.random() * 1.5,
        size: 4 + Math.random() * 3,
        type: 'confetti',
        color: '#fff',
        isRainbow: true,
        hueOffset: Math.random() * 360,
        rot: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 8,
      });
    }
  }

  /**
   * Floating Score or Combo Banner
   */
  public emitFloatText(x: number, y: number, text: string, rainbow = true): void {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: -35,
      life: 0,
      maxLife: 1.1,
      size: 11,
      type: 'text',
      color: rainbow ? '#fff' : '#ffec40',
      isRainbow: rainbow,
      hueOffset: Math.random() * 360,
      text,
    });
  }

  /**
   * Draw all particles
   */
  public draw(ctx: CanvasRenderingContext2D, time: number): void {
    for (const p of this.particles) {
      const progress = p.life / p.maxLife;
      const alpha = Math.max(0, 1.0 - progress);

      let color = p.color;
      if (p.isRainbow) {
        const h = (time * 360 + p.hueOffset) % 360;
        color = `hsla(${h}, 100%, 65%, ${alpha})`;
      }

      ctx.save();
      ctx.translate(Math.round(p.x), Math.round(p.y));

      if (p.type === 'star') {
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = color;
        const s = p.size * (1 - progress * 0.4);
        // 4-point retro star
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.3, -s * 0.3);
        ctx.lineTo(s, 0);
        ctx.lineTo(s * 0.3, s * 0.3);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.3, s * 0.3);
        ctx.lineTo(-s, 0);
        ctx.lineTo(-s * 0.3, -s * 0.3);
        ctx.closePath();
        ctx.fill();
      } else if (p.type === 'dot') {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(1, p.size * (1 - progress)), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'ring') {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, 3 * (1 - progress));
        ctx.beginPath();
        ctx.arc(0, 0, progress * 40, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'confetti') {
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = color;
        ctx.fillRect(-p.size * 0.6, -p.size * 0.3, p.size * 1.2, p.size * 0.6);
      } else if (p.type === 'text' && p.text) {
        const scale = 1.0 + Math.sin(progress * Math.PI) * 0.25;
        ctx.scale(scale, scale);
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // High-contrast 1-bit drop shadow
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.9})`;
        ctx.fillText(p.text, 1, 1);

        ctx.fillStyle = color;
        ctx.fillText(p.text, 0, 0);
      }

      ctx.restore();
    }
  }
}
