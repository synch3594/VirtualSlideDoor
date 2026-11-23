import type { SoundProfile } from '../simulation/types';

/**
 * Real-time procedural Web Audio synthesizer for an authentic minivan power sliding door.
 * Runs 100% client-side with zero external audio assets and smooth velocity-coupled modulation.
 */
class DoorAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Continuous motor & rail layers
  private motorOsc1: OscillatorNode | null = null;
  private motorOsc2: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;
  private motorFilter: BiquadFilterNode | null = null;

  private closerOsc1: OscillatorNode | null = null;
  private closerOsc2: OscillatorNode | null = null;
  private closerGain: GainNode | null = null;

  private railSource: AudioBufferSourceNode | null = null;
  private railFilter: BiquadFilterNode | null = null;
  private railGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;

  private volume = 0.8;
  private muted = false;
  private profile: SoundProfile = 'serena';
  private initialized = false;

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.setupGraph();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyMasterGain();
  }

  public setMuted(m: boolean): void {
    this.muted = m;
    this.applyMasterGain();
  }

  public setProfile(profile: SoundProfile): void {
    this.profile = profile;
  }

  private applyMasterGain(): void {
    if (!this.ctx || !this.masterGain) return;
    const target = this.muted ? 0 : this.volume;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Pink-ish noise for natural mechanical/rolling textures
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.05) * 1.8;
    }
    return buffer;
  }

  private setupGraph(): void {
    if (!this.ctx || this.initialized) return;
    const ctx = this.ctx;
    this.initialized = true;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : this.volume;
    master.connect(ctx.destination);
    this.masterGain = master;

    this.noiseBuffer = this.createNoiseBuffer(ctx);

    // 1. Power Slide DC Motor Layer (subtle electric whine + gear harmonic)
    const motorFilter = ctx.createBiquadFilter();
    motorFilter.type = 'bandpass';
    motorFilter.frequency.value = 620;
    motorFilter.Q.value = 1.6;

    const motorGain = ctx.createGain();
    motorGain.gain.value = 0;

    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.value = 240;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 510;
    const osc2SubGain = ctx.createGain();
    osc2SubGain.gain.value = 0.25;

    osc1.connect(motorFilter);
    osc2.connect(osc2SubGain);
    osc2SubGain.connect(motorFilter);
    motorFilter.connect(motorGain);
    motorGain.connect(master);

    osc1.start();
    osc2.start();
    this.motorOsc1 = osc1;
    this.motorOsc2 = osc2;
    this.motorFilter = motorFilter;
    this.motorGain = motorGain;

    // 2. Easy Closer High-Torque Worm Gear Motor Layer
    const closerFilter = ctx.createBiquadFilter();
    closerFilter.type = 'lowpass';
    closerFilter.frequency.value = 560;

    const closerGain = ctx.createGain();
    closerGain.gain.value = 0;

    const cOsc1 = ctx.createOscillator();
    cOsc1.type = 'sawtooth';
    cOsc1.frequency.value = 138;
    const cOsc2 = ctx.createOscillator();
    cOsc2.type = 'triangle';
    cOsc2.frequency.value = 276;

    cOsc1.connect(closerFilter);
    cOsc2.connect(closerFilter);
    closerFilter.connect(closerGain);
    closerGain.connect(master);

    cOsc1.start();
    cOsc2.start();
    this.closerOsc1 = cOsc1;
    this.closerOsc2 = cOsc2;
    this.closerGain = closerGain;

    // 3. Roller Rail Rolling Layer
    const railSource = ctx.createBufferSource();
    railSource.buffer = this.noiseBuffer;
    railSource.loop = true;

    const railFilter = ctx.createBiquadFilter();
    railFilter.type = 'bandpass';
    railFilter.frequency.value = 340;
    railFilter.Q.value = 0.9;

    const railGain = ctx.createGain();
    railGain.gain.value = 0;

    railSource.connect(railFilter);
    railFilter.connect(railGain);
    railGain.connect(master);
    railSource.start();

    this.railSource = railSource;
    this.railFilter = railFilter;
    this.railGain = railGain;
  }

  /**
   * Called every animation frame (~60fps) to modulate continuous motor & rail sounds.
   */
  public updateContinuous(
    speedNormalized: number,
    isPowerMotor: boolean,
    isEasyCloser: boolean,
    easyCloserProgress01: number
  ): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const spd = Math.max(0, Math.min(1.6, speedNormalized));

    // Power Slide Motor Whine
    if (this.motorGain && this.motorOsc1 && this.motorOsc2 && this.motorFilter) {
      if (isPowerMotor && spd > 0.02) {
        const pitchBase = this.profile === 'serena' ? 235 : 210;
        this.motorOsc1.frequency.setTargetAtTime(pitchBase + spd * 115, now, 0.04);
        this.motorOsc2.frequency.setTargetAtTime(pitchBase * 2.18 + spd * 245, now, 0.04);
        this.motorFilter.frequency.setTargetAtTime(480 + spd * 420, now, 0.04);
        this.motorGain.gain.setTargetAtTime(Math.min(0.11, 0.03 + spd * 0.075), now, 0.05);
      } else {
        this.motorGain.gain.setTargetAtTime(0, now, 0.04);
      }
    }

    // Roller Rail Noise (active in both power and manual sliding)
    if (this.railGain && this.railFilter) {
      if (spd > 0.025 && !isEasyCloser) {
        this.railFilter.frequency.setTargetAtTime(220 + spd * 340, now, 0.04);
        this.railGain.gain.setTargetAtTime(Math.min(0.15, spd * 0.11), now, 0.04);
      } else {
        this.railGain.gain.setTargetAtTime(0, now, 0.04);
      }
    }

    // Easy Closer High-Torque Pull-in Hum
    if (this.closerGain && this.closerOsc1 && this.closerOsc2) {
      if (isEasyCloser) {
        // Pitch droops slightly as rubber weatherstrip compression load increases!
        const loadDrop = easyCloserProgress01 * 22;
        this.closerOsc1.frequency.setTargetAtTime(148 - loadDrop, now, 0.04);
        this.closerOsc2.frequency.setTargetAtTime((148 - loadDrop) * 2.02, now, 0.04);
        this.closerGain.gain.setTargetAtTime(0.11, now, 0.03);
      } else {
        this.closerGain.gain.setTargetAtTime(0, now, 0.025);
      }
    }
  }

  private playTone(
    freq: number,
    durationSec: number,
    startOffsetSec = 0,
    gainLevel = 0.14,
    type: OscillatorType = 'square'
  ): void {
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime + startOffsetSec;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    // Shape harsh square into realistic automotive piezo buzzer tone
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.05, now);
    filter.Q.setValueAtTime(type === 'square' ? 3.2 : 1.5, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainLevel, now + 0.008);
    gain.gain.setValueAtTime(gainLevel * 0.92, now + Math.max(0.015, durationSec - 0.02));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  /** Power sliding door operation start chime ("ピピッ") */
  public playBuzzerStart(): void {
    this.unlock();
    if (this.profile === 'serena') {
      // Crisp Nissan-style dual electronic beep
      this.playTone(2380, 0.075, 0, 0.15, 'square');
      this.playTone(2380, 0.085, 0.105, 0.15, 'square');
    } else {
      // Softer melodic two-tone chime
      this.playTone(1760, 0.09, 0, 0.13, 'triangle');
      this.playTone(2217, 0.12, 0.095, 0.13, 'triangle');
    }
  }

  /** Periodic warning beep while closing ("ピッ") */
  public playBuzzerClosingStep(): void {
    if (this.profile === 'serena') {
      this.playTone(2280, 0.11, 0, 0.125, 'square');
    } else {
      this.playTone(1975, 0.14, 0, 0.11, 'triangle');
    }
  }

  /** Single pause/stop beep ("ピッ") */
  public playBuzzerPause(): void {
    this.unlock();
    const f = this.profile === 'serena' ? 2150 : 1860;
    this.playTone(f, 0.09, 0, 0.13, this.profile === 'serena' ? 'square' : 'triangle');
  }

  /** Urgent anti-pinch obstacle reversal alert ("ピーッピーッピーッ！") */
  public playBuzzerAntiPinch(): void {
    this.unlock();
    const f = this.profile === 'serena' ? 2560 : 2280;
    const type: OscillatorType = this.profile === 'serena' ? 'square' : 'sawtooth';
    this.playTone(f, 0.11, 0.0, 0.18, type);
    this.playTone(f, 0.11, 0.145, 0.18, type);
    this.playTone(f, 0.14, 0.29, 0.18, type);
  }

  /** Locked / invalid operation tone */
  public playBuzzerReject(): void {
    this.unlock();
    this.playTone(680, 0.13, 0, 0.12, 'sawtooth');
    this.playTone(520, 0.16, 0.15, 0.11, 'sawtooth');
  }

  /** Smart key lock/unlock answer-back ("ピッ" / "ピピッ") */
  public playAnswerBack(count: 1 | 2): void {
    this.unlock();
    this.playTone(2920, 0.06, 0, 0.14, 'square');
    if (count === 2) {
      this.playTone(2920, 0.06, 0.11, 0.14, 'square');
    }
  }

  /** Kick sensor detection chirp */
  public playKickSensor(): void {
    this.unlock();
    this.playTone(1850, 0.055, 0, 0.11, 'sine');
    this.playTone(2480, 0.07, 0.065, 0.12, 'sine');
  }

  /** Subtle mechanical blinker relay click ("カッチ" / "コッ") */
  public playHazardRelay(isOn: boolean): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = isOn ? 1850 : 1250;
    filter.Q.value = 3.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.028);
  }

  /** Electronic unlatch solenoid ("ガチャッ") */
  public playLatchRelease(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    // Metallic snap noise
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1400, now);
    bp.Q.value = 2.0;

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.26, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    src.connect(bp);
    bp.connect(nGain);
    nGain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.085);

    // Solenoid mechanical body thump
    const thump = this.ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(155, now);
    thump.frequency.exponentialRampToValueAtTime(58, now + 0.065);

    const tGain = this.ctx.createGain();
    tGain.gain.setValueAtTime(0.24, now);
    tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    thump.connect(tGain);
    tGain.connect(this.masterGain);
    thump.start(now);
    thump.stop(now + 0.085);
  }

  /** Half-latch click right before Easy Closer engages ("カチッ") */
  public playHalfLatch(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2100, now);
    bp.Q.value = 2.6;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.05);

    const body = this.ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(120, now);
    body.frequency.exponentialRampToValueAtTime(52, now + 0.055);
    const bGain = this.ctx.createGain();
    bGain.gain.setValueAtTime(0.16, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    body.connect(bGain);
    bGain.connect(this.masterGain);
    body.start(now);
    body.stop(now + 0.065);
  }

  /** Final full-close rubber weatherstrip compression thud ("ドスッ / バタン！") */
  public playDoorCloseThud(intensity = 0.65): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const level = Math.max(0.35, Math.min(1.25, intensity));

    // Deep cabin air-pressure thump
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(112 * (0.9 + level * 0.15), now);
    sub.frequency.exponentialRampToValueAtTime(34, now + 0.14);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.45 * level, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.2);

    // Rubber seal compression impact
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(420 + level * 480, now);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.34 * level, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    src.connect(lp);
    lp.connect(nGain);
    nGain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.15);

    // Crisp final latch lock click 18ms later
    const clickSrc = this.ctx.createBufferSource();
    clickSrc.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 3;
    const cGain = this.ctx.createGain();
    cGain.gain.setValueAtTime(0.14 * level, now + 0.015);
    cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    clickSrc.connect(bp);
    bp.connect(cGain);
    cGain.connect(this.masterGain);
    clickSrc.start(now + 0.015);
    clickSrc.stop(now + 0.065);
  }

  /** Soft rubber rear stopper settle at full open */
  public playStopperThud(intensity = 0.5): void {
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const level = Math.max(0.2, Math.min(1.0, intensity));

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(88, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22 * level, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  /** Mechanical door handle pull / one-touch button click */
  public playHandleClick(locked = false): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = locked ? 920 : 1950;
    bp.Q.value = 2.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(locked ? 0.24 : 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.05);
  }

  /** Door lock actuator ("ガシャッ") */
  public playDoorLockActuator(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1150;
    bp.Q.value = 1.8;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.06);
  }

  public dispose(): void {
    try {
      this.motorOsc1?.stop();
      this.motorOsc2?.stop();
      this.closerOsc1?.stop();
      this.closerOsc2?.stop();
      this.railSource?.stop();
      void this.ctx?.close();
    } catch {
      // ignore cleanup errors
    }
    this.ctx = null;
    this.initialized = false;
  }
}

export const doorAudio = new DoorAudioEngine();
