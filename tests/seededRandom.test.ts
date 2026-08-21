import { describe, test, expect } from 'vitest';
import { SeededRandom } from '../src/utils/seededRandom';

describe('SeededRandom utility generator', () => {
  test('should generate identical sequences for identical seeds', () => {
    const seed = 12345;
    const prngA = new SeededRandom(seed);
    const prngB = new SeededRandom(seed);

    for (let i = 0; i < 20; i++) {
      expect(prngA.next()).toBe(prngB.next());
    }
  });

  test('should generate different sequences for different seeds', () => {
    const prngA = new SeededRandom(11111);
    const prngB = new SeededRandom(22222);

    let differs = false;
    for (let i = 0; i < 10; i++) {
      if (prngA.next() !== prngB.next()) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });

  test('should output values within [0, 1) bounds', () => {
    const prng = new SeededRandom(999);
    for (let i = 0; i < 100; i++) {
      const val = prng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});
