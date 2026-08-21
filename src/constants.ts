export const EPSILON = 1e-5;

export enum FlightState {
  LINEAR = 'LINEAR',
  ORBITAL = 'ORBITAL',
}

export enum GamePhase {
  SPLASH = 'SPLASH',
  FLYING = 'FLYING',
  PAUSED = 'PAUSED',
  CRASHED = 'CRASHED',
}

export enum ViewTab {
  COCKPIT = 'COCKPIT',
  TERMINAL = 'TERMINAL',
  TELEMETRY = 'TELEMETRY',
  CALIBRATION = 'CALIBRATION',
}

export const DEFAULT_CONFIG = {
  baseSpeed: 6.0,
  maxTetherRadius: 180,
  subSteps: 4,
  hazardProximityBuffer: 30,
  physicsTimeStep: 1 / 60,
  maxAngularSpeed: 0.35,
  sectorDistance: 10000,
  sectorLeapCooldownMs: 2000,
  maxUpgradeLevel: 10,
  trailLength: 25,
  maxParticles: 150,
} as const;

export function upgradeCost(baseCost: number, currentLevel: number): number {
  return Math.floor(baseCost * Math.pow(1.5, currentLevel - 1));
}

export const SHIP_SKINS = [
  { id: 0, name: 'Default', shipColor: '#ffffff', trailColor: '#22d3ee', cost: 0 },
  { id: 1, name: 'Cyber Pink', shipColor: '#f472b6', trailColor: '#ec4899', cost: 30 },
  { id: 2, name: 'Matrix Green', shipColor: '#34d399', trailColor: '#10b981', cost: 50 },
  { id: 3, name: 'Aurum Gold', shipColor: '#fbbf24', trailColor: '#f59e0b', cost: 75 },
] as const;
