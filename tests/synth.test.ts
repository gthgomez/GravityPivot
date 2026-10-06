import { describe, test, expect, beforeEach, vi } from 'vitest';
import { SynthManager } from '../src/audio/synth';

// --- Minimal Web Audio API mocks (deterministic, no real audio) ---

class MockAudioParam {
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  setTargetAtTime = vi.fn();
}

class MockAudioNode {
  frequency = new MockAudioParam();
  gain = new MockAudioParam();
  Q = new MockAudioParam();
  type = '';
  buffer: unknown = null;
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioContext {
  currentTime = 0;
  state: 'running' | 'suspended' = 'running';
  sampleRate = 44100;
  destination = new MockAudioNode();
  createdOscillators: MockAudioNode[] = [];
  createdGains: MockAudioNode[] = [];
  createdFilters: MockAudioNode[] = [];

  createOscillator(): MockAudioNode {
    const node = new MockAudioNode();
    this.createdOscillators.push(node);
    return node;
  }
  createGain(): MockAudioNode {
    const node = new MockAudioNode();
    this.createdGains.push(node);
    return node;
  }
  createBiquadFilter(): MockAudioNode {
    const node = new MockAudioNode();
    this.createdFilters.push(node);
    return node;
  }
  createBufferSource(): MockAudioNode {
    return new MockAudioNode();
  }
  createBuffer(_channels: number, size: number, _sampleRate: number) {
    return { getChannelData: () => new Float32Array(size) };
  }
  resume = vi.fn(function (this: MockAudioContext) {
    this.state = 'running';
    return Promise.resolve();
  });
  suspend = vi.fn(function (this: MockAudioContext) {
    this.state = 'suspended';
    return Promise.resolve();
  });
  close = vi.fn(() => Promise.resolve());
}

describe('SynthManager (audio activation)', () => {
  let synth: SynthManager;

  beforeEach(() => {
    const mockWindow = { devicePixelRatio: 1 } as any;
    Object.defineProperty(globalThis, 'window', {
      value: mockWindow,
      writable: true,
      configurable: true
    });
    Object.defineProperty(mockWindow, 'AudioContext', {
      value: MockAudioContext,
      writable: true,
      configurable: true
    });
    synth = new SynthManager();
  });

  test('should start muted by default', () => {
    expect(synth.getIsMuted()).toBe(true);
  });

  test('should create the drone audio graph on init', () => {
    synth.init();
    const ctx = (synth as any).ctx as MockAudioContext;
    expect(ctx).toBeInstanceOf(MockAudioContext);
    // drone oscillator + LFO oscillator
    expect(ctx.createdOscillators.length).toBe(2);
    // drone gain + LFO gain
    expect(ctx.createdGains.length).toBe(2);
    // lowpass filter
    expect(ctx.createdFilters.length).toBe(1);
  });

  test('should start drone and LFO oscillators on init', () => {
    synth.init();
    expect((synth as any).droneOsc.start).toHaveBeenCalled();
    expect((synth as any).lfo.start).toHaveBeenCalled();
  });

  test('should not reinitialize the context when init is called twice', () => {
    synth.init();
    synth.init();
    const ctx = (synth as any).ctx as MockAudioContext;
    expect(ctx.createdOscillators.length).toBe(2);
  });

  test('should no-op init when AudioContext is unavailable', () => {
    (window as any).AudioContext = undefined;
    (window as any).webkitAudioContext = undefined;
    synth.init();
    expect((synth as any).ctx).toBeNull();
  });

  test('should no-op all play methods while muted', () => {
    synth.init();
    const ctx = (synth as any).ctx as MockAudioContext;
    const oscCount = ctx.createdOscillators.length;

    synth.playPing();
    synth.playReleaseWhoosh();
    synth.playCoreCollected();
    synth.playShieldBounce();
    synth.playSectorUp();
    synth.playExplosion();

    expect(ctx.createdOscillators.length).toBe(oscCount);
  });

  test('should route master volume to drone gain when unmuted', () => {
    synth.init();
    synth.setMute(false);
    expect(synth.getIsMuted()).toBe(false);
    const droneGain = (synth as any).droneGain as MockAudioNode;
    expect(droneGain.gain.setTargetAtTime).toHaveBeenCalledWith(
      0.12,
      expect.any(Number),
      expect.any(Number)
    );
  });

  test('should zero the drone gain when muted', () => {
    synth.init();
    synth.setMute(false);
    synth.setMute(true);
    expect(synth.getIsMuted()).toBe(true);
    const droneGain = (synth as any).droneGain as MockAudioNode;
    expect(droneGain.gain.setTargetAtTime).toHaveBeenCalledWith(
      0,
      expect.any(Number),
      expect.any(Number)
    );
  });

  test('should create a one-shot oscillator per play method when unmuted', () => {
    synth.init();
    synth.setMute(false);
    const ctx = (synth as any).ctx as MockAudioContext;
    const before = ctx.createdOscillators.length;

    synth.playPing();

    expect(ctx.createdOscillators.length).toBe(before + 1);
    const pingOsc = ctx.createdOscillators[ctx.createdOscillators.length - 1];
    expect(pingOsc.start).toHaveBeenCalled();
    expect(pingOsc.stop).toHaveBeenCalled();
  });

  test('should resume a suspended context on setMute', () => {
    synth.init();
    const ctx = (synth as any).ctx as MockAudioContext;
    ctx.state = 'suspended';
    synth.setMute(false);
    expect(ctx.resume).toHaveBeenCalled();
  });

  test('should only resume when suspended and only suspend when running', () => {
    synth.init();
    const ctx = (synth as any).ctx as MockAudioContext;

    // Already running: resume is a no-op
    synth.resumeContext();
    expect(ctx.resume).not.toHaveBeenCalled();

    synth.suspendContext();
    expect(ctx.suspend).toHaveBeenCalledTimes(1);
    expect(ctx.state).toBe('suspended');

    // Already suspended: suspend is a no-op
    synth.suspendContext();
    expect(ctx.suspend).toHaveBeenCalledTimes(1);

    synth.resumeContext();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.state).toBe('running');
  });

  test('should no-op resume/suspend when context is missing', () => {
    // No init() call — ctx is null
    expect(() => {
      synth.resumeContext();
      synth.suspendContext();
    }).not.toThrow();
  });

  test('should no-op updateParams while muted', () => {
    synth.init();
    synth.onParamsChange = vi.fn();
    synth.updateParams(0.5, 3, 2);
    expect(synth.onParamsChange).not.toHaveBeenCalled();
  });

  test('should update frequencies and fire callback when unmuted', () => {
    synth.init();
    synth.setMute(false);
    const onParamsChange = vi.fn();
    synth.onParamsChange = onParamsChange;

    synth.updateParams(0.5, 3, 2);

    const droneOsc = (synth as any).droneOsc as MockAudioNode;
    const lowpass = (synth as any).lowpass as MockAudioNode;
    const lfo = (synth as any).lfo as MockAudioNode;

    // baseOctaveFreq = 82.41 + 2*12 + 0.5*35 = 123.91
    expect(droneOsc.frequency.setTargetAtTime).toHaveBeenCalledWith(
      123.91,
      expect.any(Number),
      expect.any(Number)
    );
    // filterCutoff = 250 + 3*150 + 0.5*400 = 900
    expect(lowpass.frequency.setTargetAtTime).toHaveBeenCalledWith(
      900,
      expect.any(Number),
      expect.any(Number)
    );
    // lfoFreq = 3 + 3*1.5 = 7.5
    expect(lfo.frequency.setTargetAtTime).toHaveBeenCalledWith(
      7.5,
      expect.any(Number),
      expect.any(Number)
    );

    expect(onParamsChange).toHaveBeenCalledWith('124 Hz', '900 Hz', '7.5 Hz');
  });

  test('should close and clear the context on releaseAll', () => {
    synth.init();
    const ctx = (synth as any).ctx as MockAudioContext;
    synth.releaseAll();
    expect(ctx.close).toHaveBeenCalled();
    expect((synth as any).ctx).toBeNull();
  });
});
