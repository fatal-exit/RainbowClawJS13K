/**
 * Rainbow Claw — Audio Engine
 * Frantic Chip Pop Soundtrack in E Phrygian Dominant (ABABACBC over 32 bars)
 * Features PWM square leads, bouncy offbeat saw bass, synthesized 808/chiptune drums,
 * and tonally/atonally tuned sound effects.
 */

// Convert MIDI note number to frequency in Hz
const m2f = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

// E Phrygian Dominant 32-bar patterns (compact 288 chars mapping subBars [0,1,0,2])
const SONG_NOTES = '( () (, ( () ,-,( () (, (,/0/-,)(),-/-,)(,/420/,@ LD LGJDA@DGLJGL PLMLJGHGDADGLPPSPLJLJGDGDA@DGL ( , / 4 ) - 0 5 , 0 4 8(,/40-)&, / 4 8 40/-,)(&@DGLDGLPGLPSLPSXPLHEMJGDLHDAGDA@XVTSPLJGDA@DGLPS(4(4)5)5,8,8/;-9(4(40</;-9,8)5&2420/-,)(,/48;84,XSPLSPLGPLGDLGD@@LPXAMQYDPT\\GSW__\\XTPLHDADGLPSX\\';
const getNote = (s: number, t: number, b: number, i: number): number => {
  const c = SONG_NOTES.charCodeAt(s * 96 + t * 48 + [0, 16, 0, 32][b] + i);
  return c === 32 ? 0 : c;
};

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
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.7;
      this.musicGain.gain.value = 0.65;
      this.sfxGain.gain.value = 0.85;
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
    const secIdx = type === 'A' ? 0 : type === 'B' ? 1 : 2;
    const bNote = getNote(secIdx, 0, subBar, step);
    const lNote = getNote(secIdx, 1, subBar, step);

    // --- DRUM PATTERNS & NOTES ---
    if (type === 'A') {
      if (step % 4 === 0) this.synthKick(time);
      if (step % 8 === 4) this.synthSnare(time);
      if (step % 2 === 0) this.synthHat(time, step % 4 === 2 ? 0.06 : 0.025, step % 4 === 2);
      if (step === 0 && subBar === 0 && bar === 0) this.synthCrash(time);
      if (bNote) this.synthDonkBass(m2f(bNote), time, step % 4 === 0);
      if (lNote) this.synthPWMLead(m2f(lNote), time, step % 2 === 0);
    } else if (type === 'B') {
      if (step === 0 || step === 6 || step === 10) this.synthKick(time);
      if (step === 8 || step === 14) this.synthSnare(time);
      if (step % 2 === 0 || step === 7 || step === 15) {
        this.synthHat(time, (step === 4 || step === 12) ? 0.05 : 0.02, step === 4 || step === 12);
      }
      if (bNote) this.synthDonkBass(m2f(bNote), time, step === 0 || step === 8);
      if (lNote) this.synthPWMLead(m2f(lNote), time, step % 4 === 0);
    } else {
      if (step === 0 || step === 3 || step === 6 || step === 10 || step === 12) this.synthKick(time);
      if (step === 4 || step === 12) this.synthSnare(time, true);
      this.synthHat(time, (step % 4 === 2) ? 0.07 : 0.03, step % 4 === 2);
      if (step === 0 && subBar === 0) this.synthCrash(time);
      if (bNote) this.synthDonkBass(m2f(bNote), time, true);
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
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const envGain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq * (accent ? 1.025 : 1.0), time);
    if (accent) osc.frequency.exponentialRampToValueAtTime(freq, time + 0.02);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(accent ? 8000 : 5000, time);
    filter.frequency.exponentialRampToValueAtTime(1600, time + this.sixteenth * 0.9);
    envGain.gain.setValueAtTime(accent ? 0.22 : 0.16, time);
    envGain.gain.exponentialRampToValueAtTime(0.001, time + this.sixteenth * 0.88);
    osc.connect(filter);
    filter.connect(envGain);
    envGain.connect(this.musicGain);
    this.registerVoice(osc, time, this.sixteenth);
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

  private synthSweep(type: OscillatorType, f1: number, f2: number, vol: number, dur: number): void {
    if (!this.sfxReady()) return;
    const t = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, t);
    osc.frequency.exponentialRampToValueAtTime(f2, t + dur * 0.9);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    this.registerVoice(osc, t, dur + 0.01);
  }

  /**
   * Claw Carriage Move Click
   */
  public playClawMove(): void {
    this.synthSweep('triangle', 320, 120, 0.08, 0.03);
  }

  /**
   * Claw Drop Winch Reel Whirr
   */
  public playDrop(): void {
    this.synthSweep('sawtooth', 659.25, 164.81, 0.2, 0.24);
  }

  /**
   * Claw Prong Clamp / Grab Impact
   */
  public playGrab(): void {
    this.synthSweep('square', 1200, 300, 0.35, 0.07);
    this.synthSweep('sine', 140, 40, 0.5, 0.14);
  }

  /**
   * Cute Unicorn Squeak (FM Synthesis in E Phrygian Dominant)
   */
  public playSqueak(rank = 1): void {
    if (!this.sfxReady()) return;
    const t = this.ctx!.currentTime;
    const pitches = [659.25, 698.46, 830.61, 880.0, 987.77, 1046.5, 1318.5];
    const baseFreq = pitches[(rank - 1) % pitches.length];
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.06);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, t + 0.13);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    this.registerVoice(osc, t, 0.16);
  }

  private playNotes(notes: number[], type: OscillatorType, stepTime: number, dur: number, vol = 0.25): void {
    if (!this.sfxReady()) return;
    const t = this.ctx!.currentTime;
    notes.forEach((freq, i) => {
      const start = t + i * stepTime;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(vol, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur * 0.9);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      this.registerVoice(osc, start, dur);
    });
  }

  /**
   * Unicorn Dropped into Chute (Triumphant Rainbow Chime)
   */
  public playChuteDrop(): void {
    this.playNotes([659.25, 830.61, 987.77, 1318.51], 'triangle', 0.05, 0.25, 0.28);
  }

  /**
   * Balatro Combo Fanfare (Rising chord + bass punch)
   */
  public playCombo(mult: number): void {
    if (!this.sfxReady()) return;
    this.synthSweep('sine', 180, 45, 0.7, 0.26);
    const chord = [523.25, 659.25, 830.61, 987.77, 1318.51, 1661.22];
    const steps = Math.min(chord.length, Math.max(3, Math.floor(mult) + 1));
  }

  /**
   * Cash / Coin Register Chime for Shop Purchases
   */
  public playCoin(): void {
    this.playNotes([987.77, 1318.51], 'sine', 0.06, 0.2, 0.32);
  }

  /**
   * UI Click / Selection Tick
   */
  public playUI(): void {
    this.playNotes([1174.66], 'sine', 0, 0.04, 0.18);
  }

  /**
   * Quota Cleared Fanfare
   */
  public playQuotaSuccess(): void {
    this.playNotes([329.63, 415.3, 493.88, 659.25, 830.61, 987.77, 1318.51], 'sawtooth', 0.06, 0.25, 0.25);
  }

  /**
   * Quota Failed Lament
   */
  public playGameOver(): void {
    this.playNotes([659.25, 622.25, 587.33, 554.37, 493.88], 'sawtooth', 0.1, 0.2, 0.3);
  }
}

export const audio = new AudioEngine();
