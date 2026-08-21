import { describe, test, expect } from 'vitest';
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
});
