import { FlightState } from './constants';

export interface PivotNode {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export interface EnergyCore {
  id: string;
  x: number;
  y: number;
  radius: number;
  collected: boolean;
}

export interface SplinePoint {
  x: number;
  y: number;
}

export interface MapData {
  nodes: PivotNode[];
  cores: EnergyCore[];
  upperWallSpline: SplinePoint[];
  lowerWallSpline: SplinePoint[];
}

export interface WallBounds {
  upperY: number;
  lowerY: number;
}

export interface TrailPoint {
  x: number;
  y: number;
}

export interface TrailBuffer {
  points: TrailPoint[];
  head: number;
  length: number;
}

export interface SparkState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  flightState: FlightState;
  orbitalNodeId: string;
  orbitalRadius: number;
  orbitalSigma: number;
  orbitalTheta: number;
  angularSpeed: number;
  combo: number;
  score: number;
  collectedInRun: number;
  activeNearMisses: Set<number>;
  shield: number;
  maxShield: number;
  shieldInvulnFrames: number;
}

export interface CalibrationState {
  subSteppingEnabled: boolean;
  safetyGapsEnabled: boolean;
  collinearFallbackEnabled: boolean;
}

export interface EngineCallbacks {
  onShieldChanged(current: number, max: number): void;
  onScoreChanged(score: number, combo: number): void;
  onCoreCollected(runCores: number, totalCores: number, coreX: number, coreY: number): void;
  onSectorLeap(sectorIndex: number): void;
  onNearMiss(combo: number, x: number, y: number): void;
  onDangerProximity(active: boolean): void;
  onShieldBounce(shield: number, x: number, y: number): void;
  onCrash(x: number, y: number, finalScore: number, sectorReached: number, isNewHighScore: boolean, isNewDailyBest: boolean, dailyBest: number): void;
  onTetherAcquired(nodeId: string): void;
  onTetherReleased(): void;
  onTelemetryUpdate(sigma: string, velocity: string, sectorProgress: number, sectorIndex: number): void;
  onLog(message: string, style: 'info' | 'warn' | 'alert' | 'success'): void;
}
