/**
 * Rainbow Claw — 2D Realistic Claw Machine Physics Engine
 * Implements rail carriage, pendulum cable swing, articulated 2-prong claw,
 * rigid-body plush pile collision response, grip friction & slip, and chute detection.
 */

import { UnicornPlush } from './unicorns';
import { PlayerStats } from './shop';

export type ClawState =
  | 'IDLE_AIM'    // Player moving carriage horizontally
  | 'LOWERING'    // Cable extending downwards
  | 'CLOSING'     // Prongs clamping with pinch torque
  | 'RAISING'     // Winch pulling cable back up
  | 'RETURNING'   // Carriage driving back towards drop chute
  | 'RELEASING'   // Prongs opening over chute to drop prizes
  | 'FINISHED';   // Grab sequence complete

export class PhysicsEngine {
  // Machine Boundaries (Canvas 400x300, 4:3)
  public readonly railY = 26;
  public readonly minCarriageX = 85;
  public readonly maxCarriageX = 370;
  public readonly chuteX = 48;       // Center of drop chute
  public readonly chuteLipX = 76;    // Chute divider wall
  public readonly pitFloorY = 260;
  public readonly pitRightX = 385;

  // Carriage State
  public carriageX = 220;
  public carriageVx = 0;
  public carriageTargetX = 220;

  // Cable & Pendulum State
  public cableLength = 25;
  public readonly minCableLen = 25;
  public readonly maxCableLen = 215;
  public swingAngle = 0;      // theta (radians)
  public swingAngVel = 0;     // omega (rad/s)

  // Articulated Claw Prongs
  // Prongs open angle: ~0.85 rad (open) to 0.10 rad (locked)
  public prongAngle = 0.85;
  public targetProngAngle = 0.85;
  public mechanicalState: 'OPEN' | 'CLOSING' | 'TENSION' | 'LOCKED' = 'OPEN';

  // Claw Hub Position
  public hubX = 220;
  public hubY = 51;

  // Machine State
  public state: ClawState = 'IDLE_AIM';
  public stateTimer = 0;

  // Plushies in the prize pit
  public plushies: UnicornPlush[] = [];

  // Scored haul of the current drop
  public capturedThisDrop: UnicornPlush[] = [];

  // Callbacks
  public onClawTouchFloor?: () => void;
  public onClawGrabbed?: () => void;
  public onClawLocked?: () => void;
  public onPlushSlipped?: (u: UnicornPlush) => void;
  public onChuteScore?: (u: UnicornPlush) => void;

  public resetCarriage(): void {
    this.state = 'IDLE_AIM';
    this.mechanicalState = 'OPEN';
    this.cableLength = this.minCableLen;
    this.prongAngle = 0.85;
    this.targetProngAngle = 0.85;
    this.carriageTargetX = 220;
    this.capturedThisDrop = [];
  }

  public dropClaw(): boolean {
    if (this.state !== 'IDLE_AIM') return false;
    this.state = 'LOWERING';
    this.mechanicalState = 'OPEN';
    this.stateTimer = 0;
    this.targetProngAngle = 0.85; // Open wide on the plunge!
    return true;
  }

  public triggerEarlyGrab(): boolean {
    if (this.state !== 'LOWERING') return false;
    this.state = 'CLOSING';
    this.mechanicalState = 'CLOSING';
    this.stateTimer = 0;
    this.targetProngAngle = 0.28;
    if (this.onClawTouchFloor) this.onClawTouchFloor();
    return true;
  }

  public lockGrip(): boolean {
    const caught = this.plushies.filter((p) => p.isGrabbed && !p.gripLocked);
    if (caught.length > 0 && (this.state === 'RAISING' || this.state === 'CLOSING')) {
      for (const p of caught) {
        p.gripLocked = true;
      }
      this.mechanicalState = 'LOCKED';
      this.targetProngAngle = 0.10;
      if (this.onClawLocked) this.onClawLocked();
      return true;
    }
    return false;
  }

  public update(
    dt: number,
    inputDir: number,
    stats: PlayerStats
  ): void {
    // 1. Carriage Motion on Top Rail
    if (this.state === 'IDLE_AIM') {
      const moveSpeed = 160;
      if (inputDir !== 0) {
        this.carriageVx = inputDir * moveSpeed;
        this.carriageX += this.carriageVx * dt;
      } else {
        this.carriageVx *= 0.82;
        this.carriageX += this.carriageVx * dt;
      }
      this.carriageX = Math.max(this.minCarriageX, Math.min(this.maxCarriageX, this.carriageX));
    } else if (this.state === 'RETURNING') {
      // Return automatically towards the drop chute
      const dx = this.chuteX - this.carriageX;
      const speed = 140 * stats.winchSpeed;
      if (Math.abs(dx) > 2) {
        this.carriageVx = Math.sign(dx) * speed;
        this.carriageX += this.carriageVx * dt;
      } else {
        this.carriageX = this.chuteX;
        this.carriageVx = 0;
        this.state = 'RELEASING';
        this.stateTimer = 0;
        this.targetProngAngle = 0.85; // Open prongs!
      }
    } else {
      this.carriageVx *= 0.85;
    }

    // 2. Pendulum Cable Physics
    // Gravity + Carriage Inertia + Damping
    const gravity = 550;
    const accelX = this.carriageVx * 2.5;
    const angAccel =
      (-gravity / Math.max(10, this.cableLength)) * Math.sin(this.swingAngle) -
      (accelX / Math.max(10, this.cableLength)) * Math.cos(this.swingAngle) -
      2.8 * this.swingAngVel;

    this.swingAngVel += angAccel * dt;
    this.swingAngle += this.swingAngVel * dt;
    this.swingAngle = Math.max(-0.6, Math.min(0.6, this.swingAngle));

    // 3. Winch & Claw State Machine
    this.stateTimer += dt;
    const winchLowerSpeed = 150 * stats.winchSpeed;
    const winchRaiseSpeed = 130 * stats.winchSpeed;

    if (this.state === 'LOWERING') {
      this.cableLength += winchLowerSpeed * dt;

      // Magnetism attraction towards claw hub if upgrade active
      if (stats.magnetism > 0) {
        const pullRadius = 45 * stats.magnetism;
        for (const u of this.plushies) {
          const dx = this.hubX - u.x;
          const dy = this.hubY - u.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0 && dist < pullRadius) {
            u.vx += (dx / dist) * 75 * dt;
            u.vy += (dy / dist) * 75 * dt;
          }
        }
      }

      // Check collision with pit floor or plushies
      let hitBed = this.hubY >= this.pitFloorY - 18 || this.cableLength >= this.maxCableLen;
      if (!hitBed) {
        // Check if claw tip reaches deep into the plush pile
        for (const u of this.plushies) {
          const dy = Math.abs(this.hubY + 14 - u.y);
          const dx = Math.abs(this.hubX - u.x);
          if (dy < 12 && dx < 22) {
            hitBed = true;
            break;
          }
        }
      }

      if (hitBed) {
        this.state = 'CLOSING';
        this.mechanicalState = 'CLOSING';
        this.stateTimer = 0;
        this.targetProngAngle = 0.28; // Clamp inward!
        if (this.onClawTouchFloor) this.onClawTouchFloor();
      }
    } else if (this.state === 'CLOSING') {
      // Prongs clamp shut
      this.prongAngle += (this.targetProngAngle - this.prongAngle) * (14 * dt);

      if (this.stateTimer >= 0.45) {
        // Evaluate which plushies are caught inside claw grasp!
        this.evaluateGrasp(stats);
        this.state = 'RAISING';
        this.stateTimer = 0;
        const caught = this.plushies.filter((p) => p.isGrabbed);
        if (caught.length > 0) {
          this.mechanicalState = caught.some((p) => p.gripLocked) ? 'LOCKED' : 'TENSION';
          this.targetProngAngle = this.mechanicalState === 'LOCKED' ? 0.10 : 0.26;
        } else {
          this.mechanicalState = 'CLOSING';
          this.targetProngAngle = 0.20;
        }
        if (this.onClawGrabbed) this.onClawGrabbed();
      }
    } else if (this.state === 'RAISING') {
      this.cableLength -= winchRaiseSpeed * dt;
      this.prongAngle += (this.targetProngAngle - this.prongAngle) * (14 * dt);

      // Check slip risk during ascent
      this.checkPlushSlipping(dt, stats);

      if (this.cableLength <= this.minCableLen) {
        this.cableLength = this.minCableLen;
        this.state = 'RETURNING';
        this.stateTimer = 0;
      }
    } else if (this.state === 'RELEASING') {
      this.prongAngle += (this.targetProngAngle - this.prongAngle) * (14 * dt);

      // Release any gripped plushies
      for (const u of this.plushies) {
        if (u.isGrabbed) {
          u.isGrabbed = false;
          u.gripLocked = false;
          u.vx = (Math.random() - 0.5) * 15;
          u.vy = 20;
        }
      }

      if (this.stateTimer >= 1.0) {
        this.state = 'FINISHED';
        this.mechanicalState = 'OPEN';
      }
    }

    // Update Hub Position
    this.hubX = this.carriageX + this.cableLength * Math.sin(this.swingAngle);
    this.hubY = this.railY + this.cableLength * Math.cos(this.swingAngle);

    // 4. Update Plushies (2D Physics & Collisions)
    this.updatePlushies(dt, stats);
  }

  /**
   * Determine which plushies are gripped inside the claw cavity
   */
  private evaluateGrasp(stats: PlayerStats): void {
    const clawReach = 24 * stats.clawSpan;
    const gripYMin = this.hubY - 2;
    const gripYMax = this.hubY + 28;

    for (const u of this.plushies) {
      if (u.inChute) continue;
      const dx = Math.abs(u.x - this.hubX);
      const dy = u.y - this.hubY;

      // Check if plush center is within the claw scoop boundary
      if (dx <= clawReach && u.y >= gripYMin && u.y <= gripYMax) {
        u.isGrabbed = true;
        u.gripLocked = false;
        u.vx = 0;
        u.vy = 0;
      }
    }
  }

  /**
   * Realistic claw slip mechanics: weight, bumps, and grip strength
   */
  private checkPlushSlipping(dt: number, stats: PlayerStats): void {
    const slipBaseChance = 0.08 / Math.max(1.0, stats.gripStrength * 1.5);

    for (const u of this.plushies) {
      if (!u.isGrabbed) continue;
      if (u.gripLocked) continue;

      // Heavy plushies have higher slip probability if grip strength is low
      const weightSlip = (u.mass - 1.0) * 0.12;
      const swingSlip = Math.abs(this.swingAngVel) * 0.06;
      const totalSlipProb = (slipBaseChance + weightSlip + swingSlip) * dt;

      if (Math.random() < totalSlipProb && stats.gripStrength < 2.0) {
        // Plush slipped!
        u.isGrabbed = false;
        u.gripLocked = false;
        u.vy = 25;
        u.vx = (Math.random() - 0.5) * 35;
        if (this.onPlushSlipped) this.onPlushSlipped(u);

        if (!this.plushies.some((p) => p.isGrabbed)) {
          this.mechanicalState = 'OPEN';
          this.targetProngAngle = 0.85;
        }
      }
    }
  }

  /**
   * 2D Physics for the pile of plush unicorns
   */
  private updatePlushies(dt: number, stats: PlayerStats): void {
    const clawSpan = 20 * stats.clawSpan;
    const leftTipX = this.hubX - Math.sin(this.prongAngle) * clawSpan;
    const rightTipX = this.hubX + Math.sin(this.prongAngle) * clawSpan;
    const tipY = this.hubY + Math.cos(this.prongAngle) * 22;

    for (const u of this.plushies) {
      if (u.isGrabbed) {
        // Move locked to claw hub
        const targetX = this.hubX;
        const targetY = this.hubY + 12;
        u.x += (targetX - u.x) * 0.7;
        u.y += (targetY - u.y) * 0.7;
        u.vx = 0;
        u.vy = 0;
        u.angle += (this.swingAngle - u.angle) * 0.3;
        continue;
      }

      // Gravity
      u.vy += 480 * dt;
      u.vx *= 0.96; // Air drag
      u.x += u.vx * dt;
      u.y += u.vy * dt;
      u.angle += u.angVel * dt;
      u.angVel *= 0.94;

      // --- Pit Boundary Collisions ---
      // Floor
      if (u.y + u.radius > this.pitFloorY) {
        u.y = this.pitFloorY - u.radius;
        u.vy = -u.vy * 0.22; // Low restitution plush bounce
        u.vx *= 0.75; // Ground friction
      }

      // Right Pit Wall
      if (u.x + u.radius > this.pitRightX) {
        u.x = this.pitRightX - u.radius;
        u.vx = -u.vx * 0.3;
      }

      // Chute Divider Wall (Lip at X = 76, from Y = 155 to 260)
      if (u.y > 155) {
        if (u.x - u.radius < this.chuteLipX && u.x > this.chuteLipX - 6) {
          u.x = this.chuteLipX + u.radius;
          u.vx = Math.abs(u.vx) * 0.3;
        } else if (u.x + u.radius > this.chuteLipX && u.x < this.chuteLipX) {
          u.x = this.chuteLipX - u.radius;
          u.vx = -Math.abs(u.vx) * 0.3;
        }
      }

      // Chute Left Wall (X = 18)
      if (u.x - u.radius < 18) {
        u.x = 18 + u.radius;
        u.vx = Math.abs(u.vx) * 0.3;
      }

      // Drop Chute Score Detection:
      // If a unicorn falls into the chute zone (X in [18, 74], Y > 175)
      if (u.x < this.chuteLipX && u.y > 175 && !u.isScored) {
        u.isScored = true;
        u.inChute = true;
        this.capturedThisDrop.push(u);
        if (this.onChuteScore) this.onChuteScore(u);
      }

      // --- Prong Collisions with free plushies ---
      // Left and Right prong tips push against plushies
      if (this.state === 'LOWERING' || this.state === 'CLOSING') {
        const dL = Math.hypot(u.x - leftTipX, u.y - tipY);
        if (dL < u.radius + 6) {
          const pushX = (u.x - leftTipX) / (dL || 1);
          u.vx += pushX * 60;
          u.vy += 30;
        }
        const dR = Math.hypot(u.x - rightTipX, u.y - tipY);
        if (dR < u.radius + 6) {
          const pushX = (u.x - rightTipX) / (dR || 1);
          u.vx += pushX * 60;
          u.vy += 30;
        }
      }
    }

    // Pairwise Circle-Circle Plush Pile Collisions
    const n = this.plushies.length;
    for (let i = 0; i < n; i++) {
      const p1 = this.plushies[i];
      if (p1.isGrabbed) continue;

      for (let j = i + 1; j < n; j++) {
        const p2 = this.plushies[j];
        if (p2.isGrabbed) continue;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distSq = dx * dx + dy * dy;
        const minDist = p1.radius + p2.radius;

        if (distSq < minDist * minDist && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          // Separation based on mass
          const totalMass = p1.mass + p2.mass;
          const m1Ratio = p2.mass / totalMass;
          const m2Ratio = p1.mass / totalMass;

          p1.x -= nx * overlap * m1Ratio;
          p1.y -= ny * overlap * m1Ratio;
          p2.x += nx * overlap * m2Ratio;
          p2.y += ny * overlap * m2Ratio;

          // Relative velocity impact
          const rvx = p2.vx - p1.vx;
          const rvy = p2.vy - p1.vy;
          const velAlongNormal = rvx * nx + rvy * ny;

          if (velAlongNormal < 0) {
            const restitution = 0.2; // Plush squishiness
            const impulse = -(1 + restitution) * velAlongNormal;
            p1.vx -= impulse * nx * m1Ratio;
            p1.vy -= impulse * ny * m1Ratio;
            p2.vx += impulse * nx * m2Ratio;
            p2.vy += impulse * ny * m2Ratio;

            // Surface friction
            p1.vx *= 0.95;
            p2.vx *= 0.95;
          }
        }
      }
    }
  }

  /**
   * Render the Claw Machine Cabinet Background, Rails, Carriage, and Cable
   */
  public drawMachineBackground(
    ctx: CanvasRenderingContext2D,
    time: number
  ): void {
    // 1. Drop Chute (Left side)
    ctx.fillStyle = '#090a10';
    ctx.fillRect(16, 150, 60, 115);

    // Chute mesh / dither pattern
    ctx.fillStyle = '#1c1f2b';
    for (let py = 155; py < 260; py += 6) {
      ctx.fillRect(18, py, 56, 1);
    }
    for (let px = 20; px < 74; px += 8) {
      ctx.fillRect(px, 155, 1, 105);
    }

    // Chute Divider Wall
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(this.chuteLipX - 2, 150, 4, 112);
    ctx.fillStyle = '#050508';
    ctx.fillRect(this.chuteLipX - 1, 152, 2, 110);

    // Chute Neon Rainbow Sign: "PRIZE"
    const prizeHue = (time * 120) % 360;
    ctx.fillStyle = `hsl(${prizeHue}, 100%, 65%)`;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PRIZE', 46, 142);

    // 2. Top Gantry / Rail
    ctx.fillStyle = '#1a1d26';
    ctx.fillRect(10, this.railY - 14, 380, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(10, this.railY - 2, 380, 2);

    // Rail notch markings
    ctx.fillStyle = '#4a5065';
    for (let rx = 20; rx < 380; rx += 15) {
      ctx.fillRect(rx, this.railY - 10, 2, 6);
    }

    // 3. Carriage
    const carX = Math.round(this.carriageX);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(carX - 14, this.railY - 12, 28, 12);
    ctx.fillStyle = '#0b0c12';
    ctx.fillRect(carX - 11, this.railY - 9, 22, 6);

    // Carriage rainbow status LED
    const ledHue = (time * 240) % 360;
    ctx.fillStyle = `hsl(${ledHue}, 100%, 60%)`;
    ctx.fillRect(carX - 3, this.railY - 8, 6, 4);

    // 4. Rainbow Cable
    const hubX = Math.round(this.hubX);
    const hubY = Math.round(this.hubY);

    const cableSegments = 12;
    for (let i = 0; i < cableSegments; i++) {
      const t0 = i / cableSegments;
      const t1 = (i + 1) / cableSegments;
      const x0 = carX * (1 - t0) + hubX * t0;
      const y0 = this.railY * (1 - t0) + hubY * t0;
      const x1 = carX * (1 - t1) + hubX * t1;
      const y1 = this.railY * (1 - t1) + hubY * t1;

      const segHue = (time * 300 + i * 25) % 360;
      ctx.strokeStyle = `hsl(${segHue}, 100%, 65%)`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }

  /**
   * Render the Realistic 3-Prong Arc Claw Head
   * Features:
   * - Top central housing / cylindrical collar with 3 joint hinges
   * - Center vertical tine (middle prong)
   * - Left and Right curved arc prongs (curving outward then curling inward with hooked tips)
   * - Rainbow gradient stroke, chrome highlight sheen, 1-bit dithering
   * - Smooth mechanical state animations: OPEN, CLOSING, TENSION (twitching), LOCKED (clamped + sparks)
   */
  public drawClawHead(
    ctx: CanvasRenderingContext2D,
    time: number,
    stats: PlayerStats
  ): void {
    const hubX = Math.round(this.hubX);
    const hubY = Math.round(this.hubY);
    const hubHue = (time * 200) % 360;
    const span = stats.clawSpan;

    ctx.save();
    ctx.translate(hubX, hubY);
    ctx.rotate(this.swingAngle);

    let angle = this.prongAngle;
    let tineY = 0;
    if (this.mechanicalState === 'TENSION') {
      angle += Math.sin(time * 42) * 0.055 + Math.sin(time * 95) * 0.025;
      tineY = Math.sin(time * 38) * 1.5;
    } else if (this.mechanicalState === 'LOCKED') {
      angle = Math.min(angle, 0.12);
    }

    const armLen = 20 * span;
    const tipLen = 14 * span;
    const tineLen = (24 + tineY) * span;

    // --- A. Center Vertical Tine (Middle Prong) ---
    ctx.save();
    ctx.translate(0, 4);
    const drawTine = () => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, tineLen);
      ctx.lineTo(-3.5 * span, tineLen - 3.5 * span);
      ctx.moveTo(0, tineLen);
      ctx.lineTo(3.5 * span, tineLen - 3.5 * span);
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#05050a';
    ctx.lineWidth = 4.5;
    drawTine();
    ctx.stroke();
    ctx.strokeStyle = `hsl(${(hubHue + 120) % 360}, 100%, 65%)`;
    ctx.lineWidth = 2.8;
    drawTine();
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, tineLen - 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1, Math.round(tineLen) - 1, 2, 2);
    ctx.restore();

    // --- B & C. Left and Right Curved Arc Prongs ---
    const drawProng = (side: -1 | 1) => {
      ctx.save();
      ctx.translate(side * 8, 3);
      ctx.rotate(side * angle);
      const drawArc = () => {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(side * -11 * span, armLen * 0.45, side * -8 * span, armLen * 0.8);
        ctx.quadraticCurveTo(side * -3 * span, armLen + tipLen * 0.5, side * 2.5 * span, armLen + tipLen * 0.6);
        ctx.lineTo(side * 4.5 * span, armLen + tipLen * 0.42);
      };
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#05050a';
      ctx.lineWidth = 4.8;
      drawArc();
      ctx.stroke();
      const h = side === -1 ? hubHue + 40 : hubHue + 160;
      ctx.strokeStyle = `hsl(${h % 360}, 100%, 68%)`;
      ctx.lineWidth = 2.8;
      drawArc();
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * -11 * span, armLen * 0.45, side * -8 * span, armLen * 0.8);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(side * -8 * span) - 1, Math.round(armLen * 0.8) - 1, 2, 2);
      ctx.fillStyle = `hsl(${(h + 180) % 360}, 100%, 75%)`;
      ctx.beginPath();
      ctx.arc(side * 4.5 * span, armLen + tipLen * 0.42, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    drawProng(-1);
    drawProng(1);

    // --- D. Top Central Housing / Cylindrical Collar ---
    ctx.fillStyle = '#1c1f2b';
    ctx.fillRect(-4, -12, 8, 4);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(-4, -12, 8, 4);

    ctx.fillStyle = '#050508';
    ctx.fillRect(-12, -9, 24, 13);
    ctx.fillStyle = '#8e96ab';
    ctx.fillRect(-11, -8, 22, 11);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-9, -7, 18, 2);
    ctx.fillStyle = '#3a4052';
    ctx.fillRect(-11, 0, 22, 3);

    const stCol = this.mechanicalState === 'LOCKED' ? '#30ff80' : (this.mechanicalState === 'TENSION' ? '#ffea00' : `hsl(${hubHue}, 100%, 65%)`);
    ctx.fillStyle = stCol;
    ctx.beginPath();
    ctx.arc(0, -2.5, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1, -3.5, 2, 2);

    ctx.fillStyle = '#d0d6e6';
    ctx.fillRect(-1.5, 3, 3, this.mechanicalState === 'LOCKED' ? 6 : (this.mechanicalState === 'OPEN' ? 2 : 4));

    [-8, 0, 8].forEach(hx => {
      ctx.fillStyle = '#151822';
      ctx.beginPath();
      ctx.arc(hx, 3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(hx, 3, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#050508';
      ctx.fillRect(hx - 0.5, 2.5, 1, 1);
    });

    // --- E. State Juice (Sparks & Laser) ---
    if (this.mechanicalState === 'LOCKED') {
      ctx.fillStyle = `hsl(${(time * 500) % 360}, 100%, 75%)`;
      const s = Math.sin(time * 30) * 4;
      ctx.fillRect(Math.round(-5 + s), 22, 2, 2);
      ctx.fillRect(Math.round(5 - s), 22, 2, 2);
      ctx.fillRect(0, 26, 2, 2);
    } else if (this.mechanicalState === 'TENSION' && Math.random() < 0.35) {
      ctx.strokeStyle = '#fff060';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const jx = (Math.random() - 0.5) * 10;
      ctx.moveTo(-6 + jx, 18);
      ctx.lineTo(6 - jx, 20);
      ctx.stroke();
    }

    if (this.state === 'IDLE_AIM') {
      ctx.strokeStyle = 'rgba(255, 50, 150, 0.4)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(0, this.pitFloorY - hubY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  /**
   * Render the Cabinet Glass Frame and Reflection Streaks
   */
  public drawMachineForeground(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 380, 260);

    // Glass Reflection Dither Streak
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(30, 20);
    ctx.lineTo(160, 260);
    ctx.moveTo(45, 20);
    ctx.lineTo(175, 260);
    ctx.stroke();
  }

  /**
   * Standalone drawMachine for complete render
   */
  public drawMachine(
    ctx: CanvasRenderingContext2D,
    time: number,
    stats: PlayerStats
  ): void {
    this.drawMachineBackground(ctx, time);
    this.drawClawHead(ctx, time, stats);
    this.drawMachineForeground(ctx);
  }
}
