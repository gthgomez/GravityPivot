export class SynthManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = true;
  private masterVolume: number = 0.12;

  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private lowpass: BiquadFilterNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  public onParamsChange?: (freq: string, filter: string, tempo: string) => void;

  constructor() {}

  public init(): void {
    if (this.ctx) return;
    
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    
    this.ctx = new AudioCtx();

    this.droneOsc = this.ctx.createOscillator();
    this.droneGain = this.ctx.createGain();
    this.lowpass = this.ctx.createBiquadFilter();
    this.lfo = this.ctx.createOscillator();
    this.lfoGain = this.ctx.createGain();

    this.droneOsc.type = 'sawtooth';
    this.droneOsc.frequency.setValueAtTime(110, this.ctx.currentTime);

    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.setValueAtTime(350, this.ctx.currentTime);
    this.lowpass.Q.setValueAtTime(5, this.ctx.currentTime);

    this.lfo.frequency.setValueAtTime(4, this.ctx.currentTime);
    this.lfoGain.gain.setValueAtTime(20, this.ctx.currentTime);

    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.droneOsc.frequency);
    this.droneOsc.connect(this.lowpass);
    this.lowpass.connect(this.droneGain);
    this.droneGain.connect(this.ctx.destination);

    this.droneGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.droneOsc.start();
    this.lfo.start();
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setMute(state: boolean): void {
    this.isMuted = state;
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    const targetVol = this.isMuted ? 0 : this.masterVolume;
    if (this.droneGain) {
      this.droneGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.15);
    }
  }

  public updateParams(speedRatio: number, combo: number, sector: number): void {
    if (this.isMuted || !this.ctx) return;

    const baseOctaveFreq = 82.41 + sector * 12.0 + speedRatio * 35.0;
    if (this.droneOsc) {
      this.droneOsc.frequency.setTargetAtTime(baseOctaveFreq, this.ctx.currentTime, 0.3);
    }

    const filterCutoff = 250 + combo * 150 + speedRatio * 400;
    if (this.lowpass) {
      this.lowpass.frequency.setTargetAtTime(filterCutoff, this.ctx.currentTime, 0.1);
    }
    
    const lfoFreq = 3 + combo * 1.5;
    if (this.lfo) {
      this.lfo.frequency.setTargetAtTime(lfoFreq, this.ctx.currentTime, 0.25);
    }

    if (this.onParamsChange) {
      this.onParamsChange(
        `${Math.round(baseOctaveFreq)} Hz`,
        `${filterCutoff.toFixed(0)} Hz`,
        `${lfoFreq.toFixed(1)} Hz`
      );
    }
  }

  public playPing(): void {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(now + 0.35);
  }

  public playReleaseWhoosh(): void {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(now + 0.25);
  }

  public playCoreCollected(): void {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1320, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(now + 0.25);
  }

  public playShieldBounce(): void {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(50, now + 0.15);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(now + 0.4);
  }

  public playSectorUp(): void {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(261.63, now);
    osc2.frequency.setValueAtTime(329.63, now + 0.1);
    
    osc1.frequency.exponentialRampToValueAtTime(523.25, now + 0.3);
    osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.4);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc1.start();
    osc2.start();
    osc1.stop(now + 0.55);
    osc2.stop(now + 0.55);
  }

  public playExplosion(): void {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const size = Math.floor(this.ctx.sampleRate * 0.5);
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, now);
    filter.frequency.linearRampToValueAtTime(30, now + 0.4);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    source.start();
    source.stop(now + 0.5);
  }

  public releaseAll(): void {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }

  public resumeContext(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public suspendContext(): void {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
    }
  }
}
