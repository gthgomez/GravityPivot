import { describe, test, expect, vi } from 'vitest';
import { ParticleEngine } from '../src/effects/particles';

describe('ParticleEngine', () => {
  test('should initialize with correct max limit', () => {
    const engine = new ParticleEngine(10);
    expect(engine.getActiveCount()).toBe(0);
    expect(engine.getPool().length).toBe(10);
  });

  test('should spawn particles up to pool limit', () => {
    const engine = new ParticleEngine(5);
    engine.spawn(10, 10, '#ffffff', 4, 3);
    expect(engine.getActiveCount()).toBe(3);

    // Try to spawn 5 more (total 8, capped at 5)
    engine.spawn(10, 10, '#ffffff', 4, 5);
    expect(engine.getActiveCount()).toBe(5);
  });

  test('should decay and remove dead particles via swap-and-pop', () => {
    const engine = new ParticleEngine(5);
    engine.spawn(10, 10, '#ffffff', 2, 2);

    const pool = engine.getPool();
    // Override decay constants to make behavior deterministic
    (pool[0] as any).decay = 0.5;
    (pool[1] as any).decay = 0.1;

    // First update: decay is applied, both active
    engine.update();
    expect(engine.getActiveCount()).toBe(2);
    expect(pool[0].alpha).toBe(0.5);
    expect(pool[1].alpha).toBe(0.9);

    // Second update: first particle dies (alpha <= 0), second gets swapped to index 0
    engine.update();
    expect(engine.getActiveCount()).toBe(1);
    expect(pool[0].alpha).toBe(0.8);
  });

  test('should early-return on spawn when capacity is fully reached', () => {
    const engine = new ParticleEngine(2);
    engine.spawn(10, 10, '#ffffff', 4, 2);
    expect(engine.getActiveCount()).toBe(2);

    // This should do nothing and return immediately
    engine.spawn(10, 10, '#ffffff', 4, 1);
    expect(engine.getActiveCount()).toBe(2);
  });

  test('uses elapsed visual time consistently at 30, 60, and 120 updates per second', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const snapshots: Array<{ x: number; y: number; alpha: number }> = [];
    for (const rate of [30, 60, 120]) {
      const engine = new ParticleEngine(1);
      engine.spawn(10, 20, '#fff', 4, 1);
      (engine.getPool()[0] as any).decay = 0.0001;
      for (let i = 0; i < rate; i++) engine.update(1 / rate);
      const particle = engine.getPool()[0];
      snapshots.push({ x: particle.x, y: particle.y, alpha: particle.alpha });
    }
    random.mockRestore();

    expect(snapshots[1].x).toBeCloseTo(snapshots[0].x);
    expect(snapshots[2].x).toBeCloseTo(snapshots[0].x);
    expect(snapshots[1].y).toBeCloseTo(snapshots[0].y);
    expect(snapshots[2].y).toBeCloseTo(snapshots[0].y);
    expect(snapshots[1].alpha).toBeCloseTo(snapshots[0].alpha);
    expect(snapshots[2].alpha).toBeCloseTo(snapshots[0].alpha);
  });

  test('expires particles and returns pool capacity for later spawns', () => {
    const engine = new ParticleEngine(1);
    engine.spawn(0, 0, '#fff', 1, 1);
    const first = engine.getPool()[0] as any;
    first.decay = 0.4;

    engine.update(1 / 30);
    expect(first.alpha).toBeCloseTo(0.2);
    engine.update(1 / 60);
    expect(engine.getActiveCount()).toBe(0);

    engine.spawn(10, 10, '#fff', 1, 1);
    expect(engine.getActiveCount()).toBe(1);
  });

  test('clear removes run effects and visual updates do not revive them', () => {
    const engine = new ParticleEngine(2);
    engine.spawn(0, 0, '#fff', 1, 2);
    engine.clear();
    engine.update(0.1);
    expect(engine.getActiveCount()).toBe(0);
  });
});
