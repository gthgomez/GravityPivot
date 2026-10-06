import { describe, expect, test } from 'vitest';
import {
  createDailyContext,
  dailyChallengeSeed,
  resolveRunRules,
} from '../src/engine/runRules';

describe('versioned Daily rules', () => {
  test('captures the UTC calendar date and rules version', () => {
    expect(createDailyContext(new Date('2026-10-06T23:30:00-07:00'))).toEqual({
      mode: 'DAILY',
      challengeId: '2026-10-07',
      rulesVersion: 1,
    });
  });

  test('uses a stable documented 32-bit seed for a challenge identity', () => {
    const context = {
      mode: 'DAILY' as const,
      challengeId: '2026-10-06',
      rulesVersion: 1,
    };
    expect(dailyChallengeSeed(context)).toBe(231891857);
    expect(dailyChallengeSeed({ mode: 'STANDARD' })).toBeNull();
  });

  test('standardizes upgrades, physics, and calibration in Daily', () => {
    const context = {
      mode: 'DAILY' as const,
      challengeId: '2026-10-06',
      rulesVersion: 1,
    };
    const settings = {
      baseSpeed: 14,
      subSteps: 9,
      hazardProximityBuffer: 60,
      calibration: {
        subSteppingEnabled: false,
        safetyGapsEnabled: false,
        collinearFallbackEnabled: false,
      },
    };
    const owned = { shield: 10, magnet: 8, tether: 7 };
    const rules = resolveRunRules(context, owned, settings);

    expect(rules.effectiveUpgrades).toEqual({
      shield: 1,
      magnet: 1,
      tether: 1,
    });
    expect(rules.config).toMatchObject({
      baseSpeed: 6,
      maxTetherRadius: 180,
      subSteps: 4,
      hazardProximityBuffer: 30,
      magnetRange: 40,
    });
    expect(rules.calibration).toEqual({
      subSteppingEnabled: true,
      safetyGapsEnabled: true,
      collinearFallbackEnabled: true,
    });
    expect(Object.isFrozen(rules)).toBe(true);
    expect(Object.isFrozen(rules.config)).toBe(true);
  });

  test('preserves owned upgrades and copied settings in Standard', () => {
    const rules = resolveRunRules(
      { mode: 'STANDARD' },
      { shield: 3, magnet: 2, tether: 4 },
      {
        baseSpeed: 12,
        subSteps: 8,
        hazardProximityBuffer: 45,
        calibration: {
          subSteppingEnabled: false,
          safetyGapsEnabled: false,
          collinearFallbackEnabled: true,
        },
      },
    );
    expect(rules.effectiveUpgrades).toEqual({
      shield: 3,
      magnet: 2,
      tether: 4,
    });
    expect(rules.config).toMatchObject({
      baseSpeed: 12,
      maxTetherRadius: 285,
      subSteps: 8,
      hazardProximityBuffer: 45,
      magnetRange: 75,
    });
    expect(rules.calibration.subSteppingEnabled).toBe(false);
  });
});
