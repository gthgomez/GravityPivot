import { describe, test, expect } from 'vitest';
import { upgradeCost } from '../src/constants';

describe('upgradeCost logic', () => {
  test('should return correct values for levels 1, 5, 10', () => {
    // Level 1: Math.floor(10 * 1.5^0) = 10
    expect(upgradeCost(10, 1)).toBe(10);
    // Level 2: Math.floor(10 * 1.5^1) = 15
    expect(upgradeCost(10, 2)).toBe(15);
    // Level 5: Math.floor(10 * 1.5^4) = Math.floor(10 * 5.0625) = 50
    expect(upgradeCost(10, 5)).toBe(50);
    // Level 10: Math.floor(10 * 1.5^9) = Math.floor(10 * 38.443) = 384
    expect(upgradeCost(10, 10)).toBe(384);
  });
});
