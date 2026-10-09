import { DEFAULT_CONFIG } from '../constants';
import { CalibrationState, RunContext } from '../types';

export interface UpgradeLevels {
  shield: number;
  magnet: number;
  tether: number;
}

export interface RunSettings {
  baseSpeed: number;
  subSteps: number;
  hazardProximityBuffer: number;
  calibration: CalibrationState;
}

export interface RunRules {
  effectiveUpgrades: Readonly<UpgradeLevels>;
  calibration: Readonly<CalibrationState>;
  config: Readonly<{
    baseSpeed: number;
    maxTetherRadius: number;
    subSteps: number;
    hazardProximityBuffer: number;
    magnetRange: number;
  }>;
  seed: number | null;
}

export function createDailyContext(
  now: Date,
): Extract<RunContext, { mode: 'DAILY' }> {
  return {
    mode: 'DAILY',
    challengeId: now.toISOString().slice(0, 10),
    rulesVersion: 1,
  };
}

/** Stable FNV-1a 32-bit hash over the versioned challenge identity. */
export function dailyChallengeSeed(context: RunContext): number | null {
  if (context.mode !== 'DAILY') return null;
  const input = `gravitypivot|${context.rulesVersion}|${context.challengeId}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function clampUpgrade(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.max(
    1,
    Math.min(DEFAULT_CONFIG.maxUpgradeLevel, Math.floor(level)),
  );
}

export function resolveRunRules(
  context: RunContext,
  ownedUpgrades: UpgradeLevels,
  standardSettings: RunSettings,
): RunRules {
  const daily = context.mode === 'DAILY';
  const effectiveUpgrades = Object.freeze(
    daily
      ? { shield: 1, magnet: 1, tether: 1 }
      : {
          shield: clampUpgrade(ownedUpgrades.shield),
          magnet: clampUpgrade(ownedUpgrades.magnet),
          tether: clampUpgrade(ownedUpgrades.tether),
        },
  );
  const calibration = Object.freeze(
    daily
      ? {
          subSteppingEnabled: true,
          safetyGapsEnabled: true,
          collinearFallbackEnabled: true,
        }
      : { ...standardSettings.calibration },
  );
  const config = Object.freeze({
    baseSpeed: daily ? DEFAULT_CONFIG.baseSpeed : standardSettings.baseSpeed,
    maxTetherRadius: 180 + (effectiveUpgrades.tether - 1) * 35,
    subSteps: daily ? DEFAULT_CONFIG.subSteps : standardSettings.subSteps,
    hazardProximityBuffer: daily
      ? DEFAULT_CONFIG.hazardProximityBuffer
      : standardSettings.hazardProximityBuffer,
    magnetRange: 40 + (effectiveUpgrades.magnet - 1) * 35,
  });
  return Object.freeze({
    effectiveUpgrades,
    calibration,
    config,
    seed: daily ? dailyChallengeSeed(context) : null,
  });
}
