/**
 * Rainbow Claw — Audio Engine
 * Frantic Chip Pop Soundtrack in E Phrygian Dominant (ABABACBC over 32 bars)
 * Features PWM square leads, bouncy offbeat saw bass, synthesized 808/chiptune drums,
 * and tonally/atonally tuned sound effects.
 */

// Convert MIDI note number to frequency in Hz
const m2f = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

// E Phrygian Dominant Scale frequencies
// === 32-BAR PATTERNS IN E PHRYGIAN DOMINANT ===
const bA0 = [40, 0, 40, 41, 0, 40, 44, 0, 40, 0, 40, 41, 0, 44, 45, 44];
const bA1 = [40, 0, 40, 41, 0, 40, 44, 0, 40, 44, 47, 48, 47, 45, 44, 41];
const bA3 = [40, 41, 44, 45, 47, 45, 44, 41, 40, 44, 47, 52, 50, 48, 47, 44];
const bassA = [bA0, bA1, bA0, bA3];

const lA0 = [64, 0, 76, 68, 0, 76, 71, 74, 68, 65, 64, 68, 71, 76, 74, 71];
const lA1 = [76, 0, 80, 76, 77, 76, 74, 71, 72, 71, 68, 65, 68, 71, 76, 80];
const lA3 = [80, 83, 80, 76, 74, 76, 74, 71, 68, 71, 68, 65, 64, 68, 71, 76];
const leadA = [lA0, lA1, lA0, lA3];

const bB0 = [0, 40, 0, 44, 0, 47, 0, 52, 0, 41, 0, 45, 0, 48, 0, 53];
const bB1 = [0, 44, 0, 48, 0, 52, 0, 56, 40, 44, 47, 52, 48, 45, 41, 38];
const bB3 = [44, 0, 47, 0, 52, 0, 56, 0, 52, 48, 47, 45, 44, 41, 40, 38];
const bassB = [bB0, bB1, bB0, bB3];

const lB0 = [64, 68, 71, 76, 68, 71, 76, 80, 71, 76, 80, 83, 76, 80, 83, 88];
const lB1 = [80, 76, 72, 69, 77, 74, 71, 68, 76, 72, 68, 65, 71, 68, 65, 64];
const lB3 = [88, 86, 84, 83, 80, 76, 74, 71, 68, 65, 64, 68, 71, 76, 80, 83];
const leadB = [lB0, lB1, lB0, lB3];

const bC0 = [40, 52, 40, 52, 41, 53, 41, 53, 44, 56, 44, 56, 47, 59, 45, 57];
const bC1 = [40, 52, 40, 52, 48, 60, 47, 59, 45, 57, 44, 56, 41, 53, 38, 50];
const bC3 = [52, 50, 48, 47, 45, 44, 41, 40, 44, 47, 52, 56, 59, 56, 52, 44];
const bassC = [bC0, bC1, bC0, bC3];

const lC0 = [88, 83, 80, 76, 83, 80, 76, 71, 80, 76, 71, 68, 76, 71, 68, 64];
const lC1 = [64, 76, 80, 88, 65, 77, 81, 89, 68, 80, 84, 92, 71, 83, 87, 95];
const lC3 = [95, 92, 88, 84, 80, 76, 72, 68, 65, 68, 71, 76, 80, 83, 88, 92];
const leadC = [lC0, lC1, lC0, lC3];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private isMuted = false;
  private isPlaying = false;
  private step = 0;
  private currentBar = 0;
  private nextNoteTime = 0;
  private timerId: number | null = null;

  // 128 BPM -> 16th note duration
  private readonly sixteenth = 60 / 128 / 4; // ~0.117s
  private readonly lookahead = 0.18;

  // Polyphony voice tracking to avoid audio glitches
  private activeVoices: OscillatorNode[] = [];

  public init(): void {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      try {
        this.ctx = new AudioContextClass({ latencyHint: 'playback' });
      } catch {
        this.ctx = new AudioContextClass();
      }

      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
      compressor.knee.setValueAtTime(6, this.ctx.currentTime);
      compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      compressor.release.setValueAtTime(0.1, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.65, this.ctx.currentTime);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(compressor);
      compressor.connect(this.ctx.destination);
    } catch {
      /* AudioContext not available */
    }
  }

  public ensureContext(): void {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public start(): void {
    this.ensureContext();
    if (this.isPlaying || !this.ctx) return;
    this.isPlaying = true;
    this.step = 0;
    this.currentBar = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.scheduler();
    this.timerId = window.setInterval(() => this.scheduler(), 25);
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public isSoundMuted(): boolean {
    return this.isMuted;
  }

  private registerVoice(osc: OscillatorNode, t: number, d: number): void {
    while (this.activeVoices.length >= 36) {
      const old = this.activeVoices.shift();
      if (old) {
        try { old.stop(); } catch { /* ignore */ }
      }
    }
    this.activeVoices.push(osc);
    osc.onended = () => {
      const idx = this.activeVoices.indexOf(osc);
      if (idx >= 0) this.activeVoices.splice(idx, 1);
    };
    osc.start(t);
    osc.stop(t + d);
  }

  // --- SEQUENCER ---
  private scheduler(): void {
    if (!this.ctx || !this.isPlaying) return;
    if (this.nextNoteTime < this.ctx.currentTime) {
      this.nextNoteTime = this.ctx.currentTime + 0.05;
    }
    while (this.nextNoteTime < this.ctx.currentTime + this.lookahead) {
      this.scheduleStep(this.step, this.currentBar, this.nextNoteTime);
      this.nextNoteTime += this.sixteenth;
      this.step++;
      if (this.step >= 16) {
        this.step = 0;
        this.currentBar = (this.currentBar + 1) % 32;
      }
    }
  }

  /**
   * Structure: ABABACBC over 32 bars (4 bars per letter)
   * 0..3: A, 4..7: B, 8..11: A, 12..15: B, 16..19: A, 20..23: C, 24..27: B, 28..31: C
   */
  private getSection(bar: number): { type: 'A' | 'B' | 'C'; subBar: number } {
    const block = Math.floor(bar / 4); // 0 to 7
    const subBar = bar % 4; // 0 to 3
    const type = ('ABABACBC'[block] || 'A') as 'A' | 'B' | 'C';
    return { type, subBar };
  }

  private scheduleStep(step: number, bar: number, time: number): void {
    if (!this.ctx || !this.musicGain) return;
    const { type, subBar } = this.getSection(bar);

    // --- DRUM PATTERNS ---
    if (type === 'A') {
      // 4-on-the-floor + bouncy snare + crisp hats
      if (step % 4 === 0) this.synthKick(time);
      if (step % 8 === 4) this.synthSnare(time);
      if (step % 2 === 0) this.synthHat(time, step % 4 === 2 ? 0.06 : 0.025, step % 4 === 2);
      if (step === 0 && subBar === 0 && bar === 0) this.synthCrash(time);

      const bNote = bassA[subBar][step];
      if (bNote) this.synthDonkBass(m2f(bNote), time, step % 4 === 0);

      const lNote = leadA[subBar][step];
      if (lNote) this.synthPWMLead(m2f(lNote), time, step % 2 === 0);
    } else if (type === 'B') {
      // Syncopated half-time breakbeat
      if (step === 0 || step === 6 || step === 10) this.synthKick(time);
      if (step === 8 || step === 14) this.synthSnare(time);
      if (step % 2 === 0 || step === 7 || step === 15) {
        this.synthHat(time, (step === 4 || step === 12) ? 0.05 : 0.02, step === 4 || step === 12);
      }

      const bNote = bassB[subBar][step];
      if (bNote) this.synthDonkBass(m2f(bNote), time, step === 0 || step === 8);

      const lNote = leadB[subBar][step];
      if (lNote) this.synthPWMLead(m2f(lNote), time, step % 4 === 0);
    } else {
      // Section C: Frantic double-time rave climax!
      if (step === 0 || step === 3 || step === 6 || step === 10 || step === 12) this.synthKick(time);
      if (step === 4 || step === 12) this.synthSnare(time, true);
      this.synthHat(time, (step % 4 === 2) ? 0.07 : 0.03, step % 4 === 2);
      if (step === 0 && subBar === 0) this.synthCrash(time);

      const bNote = bassC[subBar][step];
      if (bNote) this.synthDonkBass(m2f(bNote), time, true);

      const lNote = leadC[subBar][step];
      if (lNote) this.synthPWMLead(m2f(lNote), time, true);
    }
  }

  // --- SYNTHESIZED INSTRUMENTS ---

  /**
   * Cutting PWM Square Lead:
   * Pulse Width Modulation generated via delayed-saw subtraction with sweep LFO,
   * coupled with pitch chirp and crisp filter envelope for a present, energetic chip lead.
   */
  private synthPWMLead(freq: number, time: number, accent: boolean): void {
    if (!this.ctx || !this.musicGain) return;

    const saw = this.ctx.createOscillator();
    const delay = this.ctx.createDelay(0.02);
    const invGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const envGain = this.ctx.createGain();

    saw.type = 'sawtooth';

    const pitchChirp = accent ? 1.025 : 1.0;
    saw.frequency.setValueAtTime(freq * pitchChirp, time);
    if (accent) {
      saw.frequency.exponentialRampToValueAtTime(freq, time + 0.02);
    }

    // Dynamic pulse width duty cycle (~15% to 50%) via delay modulation
    const duty = 0.32 + 0.18 * Math.sin(time * 7.0);
    const delayTime = Math.max(0.0001, Math.min(0.015, duty / freq));
    delay.delayTime.setValueAtTime(delayTime, time);

    invGain.gain.setValueAtTime(-1.0, time);

    filter.type = 'lowpass';
    const cutoff = accent ? Math.min(14000, freq * 6.5) : Math.min(10000, freq * 4.8);
    filter.frequency.setValueAtTime(cutoff, time);
    filter.frequency.exponentialRampToValueAtTime(Math.min(6000, freq * 2.8), time + this.sixteenth * 0.9);
    filter.Q.setValueAtTime(accent ? 4.5 : 2.5, time);

    const vol = accent ? 0.26 : 0.19;
    envGain.gain.setValueAtTime(vol, time);
    envGain.gain.exponentialRampToValueAtTime(0.001, time + this.sixteenth * 0.88);

    saw.connect(filter);
    saw.connect(delay);
    delay.connect(invGain);
    invGain.connect(filter);
    filter.connect(envGain);
    envGain.connect(this.musicGain);

    this.registerVoice(saw, time, this.sixteenth);
  }

  /**
   * FM-Modulated Donk Bass:
   * 2-operator FM synthesis (Carrier sine + Modulator sine at 2:1 harmonic ratio).
   * Snappy exponential modulation envelope creates the iconic metallic, percussive,
   * rubbery bouncy "donk" transient and deep hollow body.
   */
  private synthDonkBass(freq: number, time: number, accent: boolean): void {
    if (!this.ctx || !this.musicGain) return;

    const carrier = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const carrierGain = this.ctx.createGain();

    carrier.type = 'sine';
    mod.type = 'sine';

    const dur = this.sixteenth * (accent ? 0.95 : 0.85);
    const pEnv = accent ? 1.38 : 1.22;

    // Subtle pitch drop on carrier & modulator transient for punchy strike
    carrier.frequency.setValueAtTime(freq * pEnv, time);
    carrier.frequency.exponentialRampToValueAtTime(freq, time + 0.022);

    const mFreq = freq * 2;
    mod.frequency.setValueAtTime(mFreq * pEnv, time);
    mod.frequency.exponentialRampToValueAtTime(mFreq, time + 0.022);

    // 2-op FM modulation index: snappy metallic donk transient decaying into hollow body
    const maxMod = mFreq * (accent ? 4.6 : 3.2);
    const bodyMod = mFreq * (accent ? 0.42 : 0.30);
    modGain.gain.setValueAtTime(maxMod, time);
    modGain.gain.exponentialRampToValueAtTime(bodyMod, time + 0.045);
    modGain.gain.exponentialRampToValueAtTime(0.01, time + dur);

    // Carrier amplitude envelope with firm bouncy sustain
    const vol = accent ? 0.36 : 0.26;
    carrierGain.gain.setValueAtTime(vol, time);
    carrierGain.gain.setValueAtTime(vol * 0.85, time + 0.035);
    carrierGain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(carrierGain);
    carrierGain.connect(this.musicGain);

    this.registerVoice(carrier, time, dur);
    this.registerVoice(mod, time, dur);
  }

  /**
   * Synthesized Kick Drum
   */
  private synthKick(time: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, time);
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.08);

    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    osc.connect(gain);
    gain.connect(this.musicGain);
    this.registerVoice(osc, time, 0.16);
  }

  /**
   * Synthesized Snare Drum (Bandpassed noise tone + snap)
   */
  private synthSnare(time: number, heavy = false): void {
    if (!this.ctx || !this.musicGain) return;

    // Body pop
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(heavy ? 240 : 190, time);
    osc.frequency.exponentialRampToValueAtTime(70, time + 0.07);
    oscGain.gain.setValueAtTime(0.4, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.connect(oscGain);
    oscGain.connect(this.musicGain);
    this.registerVoice(osc, time, 0.09);

    // Noise snap (procedural high-freq cluster)
    const noiseOsc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const noiseGain = this.ctx.createGain();

    noiseOsc.type = 'square';
    noiseOsc.frequency.setValueAtTime(1240, time);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, time);
    filter.Q.setValueAtTime(2.0, time);

    noiseGain.gain.setValueAtTime(heavy ? 0.38 : 0.28, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + (heavy ? 0.14 : 0.10));

    noiseOsc.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.musicGain);
    this.registerVoice(noiseOsc, time, heavy ? 0.15 : 0.11);
  }

  /**
   * Synthesized Hi-Hat
   */
  private synthHat(time: number, vol = 0.035, open = false): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(open ? 8200 : 9600, time);
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, time);

    const dur = open ? 0.12 : 0.035;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    this.registerVoice(osc, time, dur + 0.01);
  }

  /**
   * Synthesized Crash Cymbal
   */
  private synthCrash(time: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(5400, time);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(4500, time);
    filter.Q.setValueAtTime(1.2, time);

    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.38);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    this.registerVoice(osc, time, 0.4);
  }

  // === TONALLY AND ATONALLY COMPLEMENTARY SFX ===

  private sfxReady(): boolean {
    this.ensureContext();
    return !!(this.ctx && this.sfxGain) && !this.isMuted;
  }

  /**
   * Claw Carriage Move Click
   */
  public playClawMove(): void {
    if (!this.sfxReady()) return;
    const t = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.025);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    this.registerVoice(osc, t, 0.035);
  }

  /**
   * Claw Drop Winch Reel Whirr
   */
  public playDrop(): void {
    if (!this.sfxReady()) return;
    const t = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(659.25, t); // E5
    osc.frequency.exponentialRampToValueAtTime(164.81, t + 0.22); // E3

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    this.registerVoice(osc, t, 0.25);
  }

  /**
   * Claw Prong Clamp / Grab Impact
   */
  public playGrab(): void {
    if (!this.sfxReady()) return;
    const t = this.ctx!.currentTime;

    // Metallic clamp snap
    const snap = this.ctx!.createOscillator();
    const snapGain = this.ctx!.createGain();
    snap.type = 'square';
    snap.frequency.setValueAtTime(1200, t);
    snap.frequency.exponentialRampToValueAtTime(300, t + 0.06);
    snapGain.gain.setValueAtTime(0.35, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    snap.connect(snapGain);
    snapGain.connect(this.sfxGain!);
    this.registerVoice(snap, t, 0.08);

    // Deep pit thud
    const sub = this.ctx!.createOscillator();
    const subGain = this.ctx!.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, t);
    sub.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    subGain.gain.setValueAtTime(0.5, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    sub.connect(subGain);
    subGain.connect(this.sfxGain!);
    this.registerVoice(sub, t, 0.15);
  }

  /**
   * Cute Unicorn Squeak (FM Synthesis in E Phrygian Dominant)
   */
  public playSqueak(rank = 1): void {
    if (!this.sfxReady()) return;
    const t = this.ctx!.currentTime;

    // Scale pitches for varieties 1..7 (E5, F5, G#5, A5, B5, C6, E6)
    const pitches = [659.25, 698.46, 830.61, 880.0, 987.77, 1046.5, 1318.5];
    const baseFreq = pitches[(rank - 1) % pitches.length];

    const carrier = this.ctx!.createOscillator();
    const mod = this.ctx!.createOscillator();
    const modGain = this.ctx!.createGain();
    const carrierGain = this.ctx!.createGain();

    carrier.type = 'sine';
    mod.type = 'triangle';

    carrier.frequency.setValueAtTime(baseFreq, t);
    carrier.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.06);
    carrier.frequency.exponentialRampToValueAtTime(baseFreq, t + 0.13);

    mod.frequency.setValueAtTime(baseFreq * 2, t);
    modGain.gain.setValueAtTime(baseFreq * 0.8, t);
    modGain.gain.exponentialRampToValueAtTime(10, t + 0.12);

    carrierGain.gain.setValueAtTime(0.35, t);
    carrierGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    mod.connect(carrier.frequency);
    carrier.connect(carrierGain);
    carrierGain.connect(this.sfxGain!);

    this.registerVoice(carrier, t, 0.16);
    this.registerVoice(mod, t, 0.16);
  }

  /**
   * Unicorn Dropped into Chute (Triumphant Rainbow Chime)
   */
  public playChuteDrop(): void {
    if (!this.sfxReady()) return;
    const t = this.ctx!.currentTime;
    const notes = [659.25, 830.61, 987.77, 1318.51]; // E5, G#5, B5, E6
    notes.forEach((freq, i) => {
      const start = t + i * 0.05;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.28, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      this.registerVoice(osc, start, 0.25);
    });
  }

  /**
   * Balatro Combo Fanfare (Rising chord + bass punch)
   */
  public playCombo(mult: number): void {
    if (!this.sfxReady()) return;
    const t = this.ctx!.currentTime;

    // Sub thump
    const sub = this.ctx!.createOscillator();
    const subGain = this.ctx!.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(180, t);
    sub.frequency.exponentialRampToValueAtTime(45, t + 0.24);
    subGain.gain.setValueAtTime(0.7, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    sub.connect(subGain);
    subGain.connect(this.sfxGain!);
    this.registerVoice(sub, t, 0.28);

    // Ascending arpeggio
    const chord = [523.25, 659.25, 830.61, 987.77, 1318.51, 1661.22];
    const steps = Math.min(chord.length, Math.max(3, Math.floor(mult) + 1));
    for (let i = 0; i < steps; i++) {
      const start = t + i * 0.04;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(chord[i % chord.length], start);
      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      this.registerVoice(osc, start, 0.2);
    }
  }

  /**
   * Cash / Coin Register Chime for Shop Purchases
   */
  public playCoin(): void {
    if (!this.sfxReady()) return;
    const t = this.ctx!.currentTime;
    const freq1 = 987.77; // B5
    const freq2 = 1318.51; // E6

    const osc1 = this.ctx!.createOscillator();
    const gain1 = this.ctx!.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq1, t);
    gain1.gain.setValueAtTime(0.3, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc1.connect(gain1);
    gain1.connect(this.sfxGain!);
    this.registerVoice(osc1, t, 0.13);

    const osc2 = this.ctx!.createOscillator();
    const gain2 = this.ctx!.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq2, t + 0.06);
    gain2.gain.setValueAtTime(0.35, t + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc2.connect(gain2);
    gain2.connect(this.sfxGain!);
    this.registerVoice(osc2, t + 0.06, 0.24);
  }

  /**
   * UI Click / Selection Tick
   */
  public playUI(): void {
    if (!this.sfxReady()) return;
    const t = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1174.66, t); // D6
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    this.registerVoice(osc, t, 0.05);
  }

  /**
   * Quota Cleared Fanfare
   */
  public playQuotaSuccess(): void {
    if (!this.sfxReady()) return;
    const t = this.ctx!.currentTime;
    const notes = [329.63, 415.30, 493.88, 659.25, 830.61, 987.77, 1318.51];
    notes.forEach((freq, idx) => {
      const start = t + idx * 0.06;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      this.registerVoice(osc, start, 0.28);
    });
  }

  /**
   * Quota Failed Lament
   */
  public playGameOver(): void {
    if (!this.sfxReady()) return;
    const t = this.ctx!.currentTime;
    const notes = [659.25, 622.25, 587.33, 554.37, 493.88];
    notes.forEach((freq, idx) => {
      const start = t + idx * 0.10;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.3, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      this.registerVoice(osc, start, 0.2);
    });
  }
}

export const audio = new AudioEngine();
