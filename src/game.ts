/**
 * Rainbow Claw — Main Game Controller, State Machine, UI & Input
 */

import { PhysicsEngine } from './physics';
import { UNICORN_VARIETIES, createUnicorn, drawUnicorn, UnicornPlush } from './unicorns';
import { evaluateHaul, ComboResult } from './combos';
import {
  PlayerStats,
  ShopItem,
  getDayQuota,
  generateShopOffer,
  applyShopPurchase,
} from './shop';
import { ParticleSystem } from './particles';
import { audio } from './audio';
import { wavedash, LeaderboardEntry } from './wavedash';

export type GameScreen = 'TITLE' | 'PLAY' | 'SCORING' | 'SHOP' | 'LEADERBOARD' | 'GAMEOVER';

export class Game {
  public ctx: CanvasRenderingContext2D;
  public physics: PhysicsEngine;
  public particles: ParticleSystem;

  public screen: GameScreen = 'TITLE';
  public stats!: PlayerStats;
  public shopOffer: ShopItem[] = [];
  public dayHaul: UnicornPlush[] = [];
  public currentCombo: ComboResult | null = null;

  // Scoring animation state
  public scoringStep = 0;
  public scoringTimer = 0;
  public displayedChips = 0;
  public displayedMult = 0;
  public displayedScore = 0;
  public targetScore = 0;
  public quotaBeaten = false;
  public cashEarned = 0;

  // Leaderboard cache
  public leaderboard: LeaderboardEntry[] = [];

  // Input states
  public inputDir = 0;
  public dropPressed = false;

  // UI Touch Hitboxes
  private btnLeft = { x: 18, y: 242, w: 46, h: 48 };
  private btnRight = { x: 70, y: 242, w: 46, h: 48 };
  private btnDrop = { x: 300, y: 242, w: 84, h: 48 };
  private btnAudio = { x: 366, y: 4, w: 28, h: 18 };

  // Shop button hitboxes
  private shopCards: Array<{ item: ShopItem; x: number; y: number; w: number; h: number }> = [];
  private btnReroll = { x: 30, y: 250, w: 100, h: 36 };
  private btnNextDay = { x: 260, y: 250, w: 110, h: 36 };

  // Time tracking
  public gameTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.physics = new PhysicsEngine();
    this.particles = new ParticleSystem();

    this.bindPhysicsEvents();
    this.bindInput(canvas);
    this.resetGame();
  }

  private bindPhysicsEvents(): void {
    this.physics.onClawTouchFloor = () => {
      audio.playGrab();
      this.particles.addTrauma(0.18);
    };

    this.physics.onClawGrabbed = () => {
      const grabbed = this.physics.plushies.filter(p => p.isGrabbed);
      if (grabbed.length > 0) {
        audio.playSqueak(grabbed[0].variety.rank);
        this.particles.emitRainbowBurst(this.physics.hubX, this.physics.hubY + 12, 16, 70);
      }
    };

    this.physics.onClawLocked = () => {
      audio.playGrab();
      this.particles.addTrauma(0.24);
      this.particles.emitRainbowBurst(this.physics.hubX, this.physics.hubY + 12, 28, 110);
      this.particles.emitFloatText(this.physics.hubX, this.physics.hubY - 14, '★ LOCKED! ★', true);
    };

    this.physics.onPlushSlipped = (u) => {
      audio.playSqueak(1);
      this.particles.emitFloatText(u.x, u.y - 10, 'SLIP!', false);
      this.particles.addTrauma(0.12);
    };

    this.physics.onChuteScore = (u) => {
      audio.playChuteDrop();
      this.particles.emitRainbowBurst(u.x, u.y, 22, 100);
      let chipVal = u.variety.baseChips;
      if (u.isGolden) chipVal *= 5;
      this.particles.emitFloatText(u.x, u.y - 12, `+${chipVal}`, true);
      this.dayHaul.push(u);
    };
  }

  public resetGame(): void {
    this.stats = {
      day: 1,
      score: 0,
      cash: 5,
      quota: getDayQuota(1),
      grabAttemptsMax: 5,
      grabAttemptsLeft: 5,

      gripStrength: 1.0,
      clawSpan: 1.0,
      winchSpeed: 1.0,
      magnetism: 0,

      rarityLuck: 1.0,
      goldenChance: 0.08,

      pairBonusMult: 0,
      spectrumBonusMult: 0,
      straightBonusChips: 0,
      straightBonusMult: 1.0,
      flatChips: 0,
      flatMult: 0,
      xMult: 1.0,

      ownedJokerIds: [],
    };

    this.dayHaul = [];
    this.restockPit();
    this.physics.resetCarriage();
  }

  /**
   * Refill the prize pit with plushies based on player luck and upgrades
   */
  public restockPit(count = 24): void {
    this.physics.plushies = [];
    for (let i = 0; i < count; i++) {
      const variety = this.pickRandomVariety(this.stats.rarityLuck);
      const isGolden = Math.random() < this.stats.goldenChance;
      const x = 90 + Math.random() * (this.physics.pitRightX - 100);
      const y = 140 + Math.random() * (this.physics.pitFloorY - 150);
      this.physics.plushies.push(createUnicorn(variety, x, y, isGolden));
    }
  }

  private pickRandomVariety(luck: number): (typeof UNICORN_VARIETIES)[0] {
    // Weighted selection favoring common early, with high tiers boosted by luck
    const weights = [
      40,                    // Cotton Spark (Common)
      25,                    // Bubble Dream (Uncommon)
      18,                    // Sunset Velvet (Uncommon)
      12 * luck,             // Cyber Chrome (Rare)
      7 * luck,              // Shadow Twilight (Epic)
      3 * luck,              // Solar Radiant (Legendary)
      1 * luck,              // Prism Alicorn (Mythic)
    ];

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;

    for (let i = 0; i < UNICORN_VARIETIES.length; i++) {
      if (rand < weights[i]) return UNICORN_VARIETIES[i];
      rand -= weights[i];
    }
    return UNICORN_VARIETIES[0];
  }

  // --- INPUT HANDLING ---
  private bindInput(canvas: HTMLCanvasElement): void {
    // Keyboard Input
    window.addEventListener('keydown', (e) => {
      audio.ensureContext();
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.inputDir = -1;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.inputDir = 1;
      if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'KeyS') {
        this.handleDropAction();
      }
      if (e.code === 'Enter') {
        this.handleConfirmAction();
      }
      if (e.code === 'KeyM') {
        audio.toggleMute();
      }
    });

    window.addEventListener('keyup', (e) => {
      if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && this.inputDir === -1) {
        this.inputDir = 0;
      }
      if ((e.code === 'ArrowRight' || e.code === 'KeyD') && this.inputDir === 1) {
        this.inputDir = 0;
      }
    });

    // Pointer / Touch Input (Desktop Mouse + Mobile Responsive Touch)
    const handlePointerDown = (clientX: number, clientY: number) => {
      audio.ensureContext();
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const px = (clientX - rect.left) * scaleX;
      const py = (clientY - rect.top) * scaleY;

      // Audio toggle button
      if (
        px >= this.btnAudio.x && px <= this.btnAudio.x + this.btnAudio.w &&
        py >= this.btnAudio.y && py <= this.btnAudio.y + this.btnAudio.h
      ) {
        audio.toggleMute();
        return;
      }

      if (this.screen === 'TITLE') {
        // Check leaderboard button
        if (px >= 130 && px <= 270 && py >= 240 && py <= 275) {
          this.openLeaderboard();
        } else {
          audio.start();
          this.screen = 'PLAY';
          audio.playUI();
        }
        return;
      }

      if (this.screen === 'LEADERBOARD') {
        this.screen = 'TITLE';
        audio.playUI();
        return;
      }

      if (this.screen === 'GAMEOVER') {
        this.resetGame();
        this.screen = 'PLAY';
        audio.playUI();
        return;
      }

      if (this.screen === 'SHOP') {
        // Check card clicks
        for (const card of this.shopCards) {
          if (
            px >= card.x && px <= card.x + card.w &&
            py >= card.y && py <= card.y + card.h
          ) {
            if (!card.item.purchased && this.stats.cash >= card.item.cost) {
              applyShopPurchase(card.item, this.stats);
              card.item.purchased = true;
              audio.playCoin();
              this.particles.emitRainbowBurst(card.x + card.w / 2, card.y + card.h / 2, 20, 80);
            } else {
              audio.playUI();
            }
            return;
          }
        }

        // Reroll button
        if (
          px >= this.btnReroll.x && px <= this.btnReroll.x + this.btnReroll.w &&
          py >= this.btnReroll.y && py <= this.btnReroll.y + this.btnReroll.h
        ) {
          if (this.stats.cash >= 2) {
            this.stats.cash -= 2;
            this.shopOffer = generateShopOffer(this.stats);
            audio.playCoin();
          }
          return;
        }

        // Next Day button
        if (
          px >= this.btnNextDay.x && px <= this.btnNextDay.x + this.btnNextDay.w &&
          py >= this.btnNextDay.y && py <= this.btnNextDay.y + this.btnNextDay.h
        ) {
          this.startNextDay();
          return;
        }
      }

      if (this.screen === 'SCORING') {
        if (this.scoringStep >= 4) {
          if (this.quotaBeaten) {
            this.openShop();
          } else {
            this.screen = 'GAMEOVER';
          }
        }
        return;
      }

      if (this.screen === 'PLAY') {
        // Mobile On-Screen Buttons
        if (
          px >= this.btnLeft.x && px <= this.btnLeft.x + this.btnLeft.w &&
          py >= this.btnLeft.y && py <= this.btnLeft.y + this.btnLeft.h
        ) {
          this.inputDir = -1;
          audio.playClawMove();
          return;
        }
        if (
          px >= this.btnRight.x && px <= this.btnRight.x + this.btnRight.w &&
          py >= this.btnRight.y && py <= this.btnRight.y + this.btnRight.h
        ) {
          this.inputDir = 1;
          audio.playClawMove();
          return;
        }
        if (
          px >= this.btnDrop.x && px <= this.btnDrop.x + this.btnDrop.w &&
          py >= this.btnDrop.y && py <= this.btnDrop.y + this.btnDrop.h
        ) {
          this.handleDropAction();
          return;
        }

        // Direct Touch Drag on Upper Gantry Rail only when aiming
        if (py <= 160 && this.physics.state === 'IDLE_AIM') {
          this.physics.carriageX = Math.max(
            this.physics.minCarriageX,
            Math.min(this.physics.maxCarriageX, px)
          );
          return;
        }

        // Single-tap anywhere in the cabinet to lock/grab during sequence
        if (this.physics.state === 'RAISING' || this.physics.state === 'CLOSING' || this.physics.state === 'LOWERING') {
          this.handleDropAction();
        }
      }
    };

    const handlePointerUp = () => {
      this.inputDir = 0;
    };

    canvas.addEventListener('mousedown', (e) => handlePointerDown(e.clientX, e.clientY));
    window.addEventListener('mouseup', handlePointerUp);

    canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length > 0) {
          const t = e.touches[0];
          handlePointerDown(t.clientX, t.clientY);
        }
        e.preventDefault();
      },
      { passive: false }
    );

    window.addEventListener(
      'touchend',
      (e) => {
        handlePointerUp();
        e.preventDefault();
      },
      { passive: false }
    );
  }

  private handleDropAction(): void {
    if (this.screen === 'TITLE') {
      audio.start();
      this.screen = 'PLAY';
      audio.playUI();
      return;
    }

    if (this.screen === 'SCORING') {
      if (this.scoringStep >= 4) {
        if (this.quotaBeaten) this.openShop();
        else this.screen = 'GAMEOVER';
      }
      return;
    }

    if (this.screen === 'PLAY') {
      if (this.physics.state === 'IDLE_AIM') {
        if (this.stats.grabAttemptsLeft > 0) {
          this.stats.grabAttemptsLeft--;
          this.physics.dropClaw();
          audio.playDrop();
        }
      } else if (this.physics.state === 'LOWERING') {
        if (this.physics.triggerEarlyGrab()) {
          audio.playGrab();
        }
      } else if (this.physics.state === 'RAISING' || this.physics.state === 'CLOSING') {
        this.physics.lockGrip();
      }
    }
  }

  private handleConfirmAction(): void {
    if (this.screen === 'TITLE') {
      audio.start();
      this.screen = 'PLAY';
      audio.playUI();
    } else if (this.screen === 'SCORING') {
      if (this.scoringStep >= 4) {
        if (this.quotaBeaten) this.openShop();
        else this.screen = 'GAMEOVER';
      }
    } else if (this.screen === 'SHOP') {
      this.startNextDay();
    } else if (this.screen === 'GAMEOVER' || this.screen === 'LEADERBOARD') {
      this.resetGame();
      this.screen = 'PLAY';
    }
  }

  private openLeaderboard(): void {
    this.screen = 'LEADERBOARD';
    audio.playUI();
    wavedash.fetchLeaderboardTop().then((list) => {
      this.leaderboard = list;
    });
  }

  private startScoringPhase(): void {
    this.screen = 'SCORING';
    this.scoringStep = 0;
    this.scoringTimer = 0;
    this.displayedChips = 0;
    this.displayedMult = 0;
    this.displayedScore = 0;

    // Evaluate Balatro combo on the day's haul
    this.currentCombo = evaluateHaul(this.dayHaul, {
      pairBonusMult: this.stats.pairBonusMult,
      spectrumBonusMult: this.stats.spectrumBonusMult,
      straightBonusChips: this.stats.straightBonusChips,
      straightBonusMult: this.stats.straightBonusMult,
      flatChips: this.stats.flatChips,
      flatMult: this.stats.flatMult,
      xMult: this.stats.xMult,
    });

    this.targetScore = this.currentCombo.finalScore;
    const finalTotal = this.stats.score + this.targetScore;
    this.quotaBeaten = finalTotal >= this.stats.quota;

    // Calculate cash earned
    if (this.quotaBeaten) {
      this.cashEarned = 4 + this.stats.grabAttemptsLeft + Math.floor((finalTotal - this.stats.quota) / 150);
    } else {
      this.cashEarned = 0;
    }
  }

  private openShop(): void {
    this.stats.score += this.targetScore;
    this.stats.cash += this.cashEarned;
    this.screen = 'SHOP';
    audio.playUI();
    this.shopOffer = generateShopOffer(this.stats);
  }

  private startNextDay(): void {
    this.stats.day += 1;
    this.stats.quota = getDayQuota(this.stats.day);
    this.stats.grabAttemptsLeft = this.stats.grabAttemptsMax;
    this.dayHaul = [];
    this.restockPit(24);
    this.physics.resetCarriage();
    this.screen = 'PLAY';
    audio.playUI();
  }

  // --- UPDATE LOOP ---
  public update(dt: number): void {
    this.gameTime += dt;
    this.particles.update(dt);

    if (this.screen === 'PLAY') {
      this.physics.update(dt, this.inputDir, this.stats);

      // Check if grab finished
      if (this.physics.state === 'FINISHED') {
        this.physics.resetCarriage();

        // If no more grab attempts left, proceed to Balatro scoring!
        if (this.stats.grabAttemptsLeft <= 0) {
          this.startScoringPhase();
        }
      }
    } else if (this.screen === 'SCORING') {
      this.updateScoringAnimation(dt);
    }
  }

  private updateScoringAnimation(dt: number): void {
    this.scoringTimer += dt;

    // Step 0: Initial dramatic pause & card slide
    if (this.scoringStep === 0 && this.scoringTimer > 0.4) {
      this.scoringStep = 1;
      this.scoringTimer = 0;
      audio.playSqueak(2);
    }
    // Step 1: Count up Chips
    else if (this.scoringStep === 1) {
      const target = this.currentCombo ? this.currentCombo.totalChips : 0;
      const speed = Math.max(20, (target - this.displayedChips) * 12);
      this.displayedChips = Math.min(target, this.displayedChips + speed * dt);
      if (this.displayedChips >= target) {
        this.displayedChips = target;
        this.scoringStep = 2;
        this.scoringTimer = 0;
        audio.playUI();
      }
    }
    // Step 2: Slam Combo Multiplier!
    else if (this.scoringStep === 2) {
      if (this.scoringTimer > 0.3) {
        this.displayedMult = this.currentCombo ? this.currentCombo.totalMult : 1;
        this.scoringStep = 3;
        this.scoringTimer = 0;
        audio.playCombo(this.displayedMult);
        this.particles.emitRainbowBurst(200, 150, 32, 120);
      }
    }
    // Step 3: Chips x Mult = Final Round Score!
    else if (this.scoringStep === 3) {
      const speed = Math.max(50, (this.targetScore - this.displayedScore) * 10);
      this.displayedScore = Math.min(this.targetScore, this.displayedScore + speed * dt);
      if (this.displayedScore >= this.targetScore) {
        this.displayedScore = this.targetScore;
        this.scoringStep = 4;
        this.scoringTimer = 0;

        if (this.quotaBeaten) {
          audio.playQuotaSuccess();
          this.particles.emitConfetti(400);
        } else {
          audio.playGameOver();
          wavedash.submitScore(this.stats.score + this.displayedScore, this.stats.day);
        }
      }
    }
  }

  // --- RENDER LOOP ---
  public render(): void {
    const ctx = this.ctx;
    const time = this.gameTime;

    ctx.save();
    // Apply screenshake
    ctx.translate(Math.round(this.particles.shakeX), Math.round(this.particles.shakeY));
    ctx.rotate(this.particles.shakeRot);

    // Clear 1-bit background
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, 400, 300);

    if (this.screen === 'TITLE') {
      this.renderTitle(ctx, time);
    } else if (this.screen === 'PLAY') {
      this.renderPlay(ctx, time);
    } else if (this.screen === 'SCORING') {
      this.renderScoring(ctx, time);
    } else if (this.screen === 'SHOP') {
      this.renderShop(ctx, time);
    } else if (this.screen === 'LEADERBOARD') {
      this.renderLeaderboard(ctx, time);
    } else if (this.screen === 'GAMEOVER') {
      this.renderGameOver(ctx, time);
    }

    // Floating particles & rainbow splash juice
    this.particles.draw(ctx, time);

    ctx.restore();
  }

  // --- TITLE SCREEN ---
  private renderTitle(ctx: CanvasRenderingContext2D, time: number): void {
    // Retro grid / marquee background
    ctx.strokeStyle = '#12141c';
    ctx.lineWidth = 1;
    for (let x = 0; x < 400; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 300);
      ctx.stroke();
    }
    for (let y = 0; y < 300; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(400, y);
      ctx.stroke();
    }

    // Rainbow Marquee Title: "RAINBOW CLAW"
    const titleHue = (time * 160) % 360;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '900 28px monospace';
    ctx.fillStyle = `hsl(${titleHue}, 100%, 65%)`;
    ctx.fillText('RAINBOW CLAW', 200, 70);

    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#a0a5b8';
    ctx.fillText('BALATRO-STYLE UNICORN CLAW MACHINE', 200, 95);

    // Pixel Unicorn Showcase
    const previewU = createUnicorn(UNICORN_VARIETIES[6], 200, 140, true);
    previewU.angle = Math.sin(time * 3) * 0.15;
    drawUnicorn(ctx, previewU, time, true);

    // Start prompt
    const blink = Math.floor(time * 2.5) % 2 === 0;
    if (blink) {
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('PRESS SPACE OR TAP TO PLAY', 200, 205);
    }

    ctx.font = '10px monospace';
    ctx.fillStyle = '#7a8095';
    ctx.fillText('Desktop: Arrows/AD to Move • Space/S to Drop', 200, 226);

    // Leaderboard button
    ctx.fillStyle = '#1c1f2b';
    ctx.fillRect(130, 246, 140, 30);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(130, 246, 140, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('★ LEADERBOARD ★', 200, 261);

    // Sound toggle
    this.renderAudioButton(ctx);
  }

  // --- PLAY SCREEN ---
  private renderPlay(ctx: CanvasRenderingContext2D, time: number): void {
    // 1. Machine Background (Chute, Top Rail, Carriage, Cable)
    this.physics.drawMachineBackground(ctx, time);

    // 2. Free Plush Unicorn Pile in Pit
    for (const u of this.physics.plushies) {
      if (!u.isGrabbed) drawUnicorn(ctx, u, time);
    }

    // 3. Realistic 3-Prong Arc Claw Head
    this.physics.drawClawHead(ctx, time, this.stats);

    // 4. Gripped Plushies (drawn held inside claw grasp)
    for (const u of this.physics.plushies) {
      if (u.isGrabbed) drawUnicorn(ctx, u, time);
    }

    // 5. Cabinet Glass Frame & Reflection Streaks
    this.physics.drawMachineForeground(ctx);

    // 6. Tension QTE Floating Prompt
    if (this.physics.mechanicalState === 'TENSION') {
      const qteHue = (time * 360) % 360;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 11px monospace';
      ctx.fillStyle = '#050508';
      ctx.fillText('⚡ TAP TO LOCK! ⚡', this.physics.hubX, this.physics.hubY - 24);
      ctx.fillStyle = `hsl(${qteHue}, 100%, 75%)`;
      ctx.fillText('⚡ TAP TO LOCK! ⚡', this.physics.hubX, this.physics.hubY - 25);
    }

    // 7. Draw HUD (Day, Grabs, Score/Quota, Cash)
    this.renderHUD(ctx, time);

    // 8. Draw Mobile Controls
    this.renderMobileControls(ctx);

    // 9. Sound toggle
    this.renderAudioButton(ctx);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, time: number): void {
    // Top HUD bar
    ctx.fillStyle = '#090a10';
    ctx.fillRect(10, 2, 380, 20);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 2, 380, 20);

    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Day
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`DAY ${this.stats.day}`, 16, 12);

    // Grabs remaining dots [● ● ● ○ ○]
    ctx.fillText('GRABS:', 64, 12);
    for (let i = 0; i < this.stats.grabAttemptsMax; i++) {
      const active = i < this.stats.grabAttemptsLeft;
      const dotX = 112 + i * 9;
      if (active) {
        const dotHue = (time * 200 + i * 40) % 360;
        ctx.fillStyle = `hsl(${dotHue}, 100%, 65%)`;
        ctx.beginPath();
        ctx.arc(dotX, 12, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#4a5065';
        ctx.beginPath();
        ctx.arc(dotX, 12, 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Day Quota & Score
    ctx.fillStyle = '#ffffff';
    const quotaPct = Math.min(1.0, this.stats.score / this.stats.quota);
    ctx.fillText(`GOAL: ${this.stats.score}/${this.stats.quota}`, 170, 12);

    // Mini quota progress bar
    ctx.strokeStyle = '#333745';
    ctx.strokeRect(268, 8, 40, 8);
    ctx.fillStyle = quotaPct >= 1.0 ? '#40ff80' : '#ff4080';
    ctx.fillRect(269, 9, 38 * quotaPct, 6);

    // Cash
    ctx.fillStyle = '#ffec40';
    ctx.fillText(`$${this.stats.cash}`, 320, 12);

    // Haul preview count
    if (this.dayHaul.length > 0) {
      ctx.fillStyle = '#a0a5b8';
      ctx.font = '9px monospace';
      ctx.fillText(`HAUL: ${this.dayHaul.length} plush`, 16, 132);
    }
  }

  private renderMobileControls(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Left Button
    ctx.fillStyle = this.inputDir === -1 ? '#3a3f55' : '#141620';
    ctx.fillRect(this.btnLeft.x, this.btnLeft.y, this.btnLeft.w, this.btnLeft.h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.btnLeft.x, this.btnLeft.y, this.btnLeft.w, this.btnLeft.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('◄', this.btnLeft.x + this.btnLeft.w / 2, this.btnLeft.y + this.btnLeft.h / 2);

    // Right Button
    ctx.fillStyle = this.inputDir === 1 ? '#3a3f55' : '#141620';
    ctx.fillRect(this.btnRight.x, this.btnRight.y, this.btnRight.w, this.btnRight.h);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(this.btnRight.x, this.btnRight.y, this.btnRight.w, this.btnRight.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('►', this.btnRight.x + this.btnRight.w / 2, this.btnRight.y + this.btnRight.h / 2);

    // Drop / Grab / QTE Lock Button
    const isDropping = this.physics.state !== 'IDLE_AIM';
    const canLock = (this.physics.state === 'RAISING' || this.physics.state === 'CLOSING') &&
      this.physics.plushies.some((p) => p.isGrabbed && !p.gripLocked);
    const isLocked = this.physics.plushies.some((p) => p.isGrabbed && p.gripLocked);

    let btnText = isDropping ? 'GRAB!' : 'DROP CLAW';
    let btnColor = isDropping ? '#331a28' : '#e02060';

    if (canLock) {
      btnText = '⚡ LOCK! ⚡';
      btnColor = Math.floor(this.gameTime * 7) % 2 === 0 ? '#ffea00' : '#e02060';
    } else if (isLocked) {
      btnText = 'LOCKED ★';
      btnColor = '#109850';
    }

    ctx.fillStyle = btnColor;
    ctx.fillRect(this.btnDrop.x, this.btnDrop.y, this.btnDrop.w, this.btnDrop.h);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(this.btnDrop.x, this.btnDrop.y, this.btnDrop.w, this.btnDrop.h);
    ctx.fillStyle = canLock && Math.floor(this.gameTime * 7) % 2 === 0 ? '#050508' : '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(
      btnText,
      this.btnDrop.x + this.btnDrop.w / 2,
      this.btnDrop.y + this.btnDrop.h / 2
    );
  }

  private renderAudioButton(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = audio.isSoundMuted() ? '#441a1a' : '#1c1f2b';
    ctx.fillRect(this.btnAudio.x, this.btnAudio.y, this.btnAudio.w, this.btnAudio.h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.btnAudio.x, this.btnAudio.y, this.btnAudio.w, this.btnAudio.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      audio.isSoundMuted() ? 'MUTED' : '♪ ON',
      this.btnAudio.x + this.btnAudio.w / 2,
      this.btnAudio.y + this.btnAudio.h / 2
    );
  }

  // --- BALATRO SCORING SCREEN ---
  private renderScoring(ctx: CanvasRenderingContext2D, time: number): void {
    // Dimmed background
    ctx.fillStyle = 'rgba(5, 5, 8, 0.92)';
    ctx.fillRect(0, 0, 400, 300);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Day Evaluation Header
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`DAY ${this.stats.day} HAUL EVALUATION`, 200, 28);

    // Draw Captured Plushies on Haul Display Table
    const haul = this.dayHaul;
    const startX = 200 - ((haul.length - 1) * 36) / 2;
    for (let i = 0; i < haul.length; i++) {
      const u = haul[i];
      const ux = startX + i * 36;
      const uy = 70;
      u.x = ux;
      u.y = uy;
      drawUnicorn(ctx, u, time, true);

      // Value tag under plush
      let c = u.variety.baseChips;
      if (u.isGolden) c *= 5;
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = u.isGolden ? '#ffec40' : '#a0a5b8';
      ctx.fillText(`${c}c`, ux, uy + 20);
    }

    if (!this.currentCombo) return;

    // Combo Title Banner
    const comboHue = (time * 240) % 360;
    ctx.font = '900 20px monospace';
    ctx.fillStyle = `hsl(${comboHue}, 100%, 65%)`;
    ctx.fillText(this.currentCombo.name, 200, 115);

    ctx.font = '11px monospace';
    ctx.fillStyle = '#cbd0e2';
    ctx.fillText(this.currentCombo.subTitle, 200, 134);

    // Balatro Chips & Mult Slam Formula
    // [ CHIPS ] x [ MULT ] = [ ROUND SCORE ]
    ctx.font = 'bold 15px monospace';

    // Blue Chips Box
    ctx.fillStyle = '#0055aa';
    ctx.fillRect(60, 155, 95, 34);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(60, 155, 95, 34);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.round(this.displayedChips)} CHIPS`, 107, 172);

    // 'X' Operator
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('×', 175, 172);

    // Red Multiplier Box
    ctx.fillStyle = '#aa0033';
    ctx.fillRect(195, 155, 85, 34);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(195, 155, 85, 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`${this.displayedMult.toFixed(1)} MULT`, 237, 172);

    // Final Round Score
    ctx.font = '900 22px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`+${Math.round(this.displayedScore)} PTS!`, 200, 212);

    // Progress vs Day Quota
    const currentTotal = this.stats.score + Math.round(this.displayedScore);
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = currentTotal >= this.stats.quota ? '#40ff80' : '#ff4080';
    ctx.fillText(
      `TOTAL: ${currentTotal} / GOAL: ${this.stats.quota}`,
      200,
      236
    );

    // Outcome Banner
    if (this.scoringStep >= 4) {
      if (this.quotaBeaten) {
        ctx.font = '900 14px monospace';
        ctx.fillStyle = '#40ff80';
        ctx.fillText(`★ QUOTA CLEARED! +$${this.cashEarned} CASH ★`, 200, 258);

        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('CLICK OR PRESS SPACE TO VISIT SHOP', 200, 280);
      } else {
        ctx.font = '900 14px monospace';
        ctx.fillStyle = '#ff4080';
        ctx.fillText('✖ QUOTA FAILED! ARCADE BANKRUPT! ✖', 200, 258);

        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('CLICK OR PRESS SPACE TO CONTINUE', 200, 280);
      }
    }
  }

  // --- SHOP SCREEN ---
  private renderShop(ctx: CanvasRenderingContext2D, time: number): void {
    // Background
    ctx.fillStyle = '#080a12';
    ctx.fillRect(0, 0, 400, 300);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Header
    const shopHue = (time * 150) % 360;
    ctx.font = '900 18px monospace';
    ctx.fillStyle = `hsl(${shopHue}, 100%, 65%)`;
    ctx.fillText('PRIZE ARCADE SHOP', 200, 24);

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#ffec40';
    ctx.fillText(`CASH: $${this.stats.cash}   •   NEXT DAY QUOTA: ${getDayQuota(this.stats.day + 1)}`, 200, 44);

    // Render 3 Shop Cards
    this.shopCards = [];
    const cardW = 108;
    const cardH = 160;
    const spacing = 16;
    const totalW = 3 * cardW + 2 * spacing;
    const startX = (400 - totalW) / 2;

    for (let i = 0; i < this.shopOffer.length; i++) {
      const item = this.shopOffer[i];
      const cx = startX + i * (cardW + spacing);
      const cy = 66;
      this.shopCards.push({ item, x: cx, y: cy, w: cardW, h: cardH });

      // Card Background
      ctx.fillStyle = item.purchased ? '#141620' : '#181b26';
      ctx.fillRect(cx, cy, cardW, cardH);
      ctx.strokeStyle = item.purchased ? '#2e3344' : '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx, cy, cardW, cardH);

      // Card Title
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = item.purchased ? '#5a6075' : '#ffffff';
      ctx.fillText(item.name, cx + cardW / 2, cy + 18);

      // Category Tag
      ctx.font = '9px monospace';
      ctx.fillStyle = '#8a90a6';
      ctx.fillText(`[${item.category.toUpperCase()}]`, cx + cardW / 2, cy + 34);

      // Description (wrapped)
      ctx.font = '9px monospace';
      ctx.fillStyle = item.purchased ? '#444855' : '#cbd0e0';
      this.drawWrappedText(ctx, item.desc, cx + cardW / 2, cy + 60, cardW - 14, 13);

      // Price / Buy Button
      const canAfford = this.stats.cash >= item.cost;
      const btnY = cy + cardH - 28;
      ctx.fillStyle = item.purchased
        ? '#222530'
        : canAfford ? '#e02060' : '#3a202c';
      ctx.fillRect(cx + 12, btnY, cardW - 24, 20);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(cx + 12, btnY, cardW - 24, 20);

      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = item.purchased
        ? '#555a6a'
        : canAfford ? '#ffffff' : '#888';
      ctx.fillText(
        item.purchased ? 'OWNED' : `BUY $${item.cost}`,
        cx + cardW / 2,
        btnY + 10
      );
    }

    // Bottom Navigation Buttons: Reroll & Next Day
    // Reroll
    ctx.fillStyle = this.stats.cash >= 2 ? '#252a3b' : '#141620';
    ctx.fillRect(this.btnReroll.x, this.btnReroll.y, this.btnReroll.w, this.btnReroll.h);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(this.btnReroll.x, this.btnReroll.y, this.btnReroll.w, this.btnReroll.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('REROLL ($2)', this.btnReroll.x + this.btnReroll.w / 2, this.btnReroll.y + this.btnReroll.h / 2);

    // Next Day
    ctx.fillStyle = '#00aa55';
    ctx.fillRect(this.btnNextDay.x, this.btnNextDay.y, this.btnNextDay.w, this.btnNextDay.h);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(this.btnNextDay.x, this.btnNextDay.y, this.btnNextDay.w, this.btnNextDay.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('NEXT DAY ►', this.btnNextDay.x + this.btnNextDay.w / 2, this.btnNextDay.y + this.btnNextDay.h / 2);
  }

  // --- LEADERBOARD SCREEN ---
  private renderLeaderboard(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.fillStyle = '#06070b';
    ctx.fillRect(0, 0, 400, 300);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lbHue = (time * 180) % 360;
    ctx.font = '900 18px monospace';
    ctx.fillStyle = `hsl(${lbHue}, 100%, 65%)`;
    ctx.fillText('★ WAVEDASH LEADERBOARD ★', 200, 30);

    // Table Header
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#8a90a6';
    ctx.textAlign = 'left';
    ctx.fillText('RANK', 45, 60);
    ctx.fillText('PLAYER', 110, 60);
    ctx.fillText('DAY', 240, 60);
    ctx.fillText('SCORE', 310, 60);

    ctx.strokeStyle = '#222634';
    ctx.beginPath();
    ctx.moveTo(40, 68);
    ctx.lineTo(360, 68);
    ctx.stroke();

    // Table Rows
    const list = this.leaderboard.length > 0
      ? this.leaderboard
      : [
          { rank: 1, name: 'ArcadeAce', score: 8500, day: 5 },
          { rank: 2, name: 'PrismQueen', score: 5400, day: 4 },
          { rank: 3, name: 'ClawMaster', score: 2800, day: 3 },
          { rank: 4, name: 'NeonPony', score: 1200, day: 2 },
        ];

    for (let i = 0; i < Math.min(6, list.length); i++) {
      const entry = list[i];
      const ry = 88 + i * 26;

      ctx.fillStyle = i === 0 ? '#ffec40' : '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`#${entry.rank}`, 45, ry);
      ctx.fillText(entry.name, 110, ry);
      ctx.fillText(`Day ${entry.day}`, 240, ry);
      ctx.fillText(`${entry.score}`, 310, ry);
    }

    // Back prompt
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('TAP OR PRESS ANY KEY TO RETURN', 200, 265);
  }

  // --- GAMEOVER SCREEN ---
  private renderGameOver(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.fillStyle = '#06070b';
    ctx.fillRect(0, 0, 400, 300);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '900 24px monospace';
    ctx.fillStyle = '#ff4060';
    ctx.fillText('ARCADE BANKRUPT!', 200, 75);

    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`YOU SURVIVED ${this.stats.day} DAYS`, 200, 115);

    ctx.font = '900 18px monospace';
    ctx.fillStyle = '#ffec40';
    ctx.fillText(`FINAL SCORE: ${this.stats.score + Math.round(this.displayedScore)}`, 200, 150);

    const blink = Math.floor(time * 3) % 2 === 0;
    if (blink) {
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('PRESS SPACE OR TAP TO RETRY', 200, 220);
    }
  }

  private drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ): void {
    const words = text.split(' ');
    let line = '';
    let curY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, curY);
        line = words[n] + ' ';
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, curY);
  }
}
