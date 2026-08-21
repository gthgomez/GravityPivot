/**
 * A simple LCG (Linear Congruential Generator) for seedable pseudo-random numbers.
 * Allows reproducible level generation for seeded or daily runs.
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /**
   * Returns a random number between 0 (inclusive) and 1 (exclusive).
   */
  public next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280.0;
  }
}
