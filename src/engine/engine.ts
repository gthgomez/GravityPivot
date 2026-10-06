import { GameSaveState } from '../state/saveState';
import { WorldGenerator } from '../world/generator';
import { resolveRunRules, RunRules, UpgradeLevels } from './runRules';
import { SeededRandom } from '../utils/seededRandom';
import {
  SparkState,
  MapData,
  TrailPoint,
  EngineCallbacks,
  CalibrationState,
  TrailBuffer,
  PivotNode,
  GenerationCursor,
  RunContext,
} from '../types';
import { FlightState, GamePhase, DEFAULT_CONFIG, EPSILON } from '../constants';

export class GravityPivotEngine {
  private saveState: GameSaveState;
  private callbacks: EngineCallbacks;
  private calibration: CalibrationState;

  private spark!: SparkState;
  private mapData: MapData = {
    nodes: [],
    cores: [],
    upperWallSpline: [],
    lowerWallSpline: [],
  };
  private historyTrail: TrailPoint[] = new Array(DEFAULT_CONFIG.trailLength);
  private trailHead: number = 0;
  private trailLength: number = 0;
  private orbitalNode: PivotNode | null = null;

  private activeMagnetRange: number = 40;

  private config: {
    baseSpeed: number;
    maxTetherRadius: number;
    subSteps: number;
    hazardProximityBuffer: number;
  } = {
    baseSpeed: DEFAULT_CONFIG.baseSpeed,
    maxTetherRadius: DEFAULT_CONFIG.maxTetherRadius,
    subSteps: DEFAULT_CONFIG.subSteps,
    hazardProximityBuffer: DEFAULT_CONFIG.hazardProximityBuffer,
  };

  private sectorIndex: number = 1;
  private sectorCooldown: number = 0;
  private runDistance: number = 0;
  private gamePhase: GamePhase = GamePhase.SPLASH;
  private runContext: RunContext = { mode: 'STANDARD' };
  private randomFn: () => number = Math.random;
  private generationCursor: GenerationCursor = WorldGenerator.createCursor();
  private nearMissEpisodeActive = false;
  private dangerProximityActive = false;
  private runRules!: RunRules;
  private simulationTimeMs = 0;

  constructor(
    saveState: GameSaveState,
    callbacks: EngineCallbacks,
    calibration: CalibrationState,
  ) {
    this.saveState = saveState;
    this.callbacks = callbacks;
    this.calibration = calibration;

    this.spark = {
      x: 100,
      y: 200,
      vx: this.config.baseSpeed,
      vy: 0,
      flightState: FlightState.LINEAR,
      orbitalNodeId: '',
      orbitalRadius: 0,
      orbitalSigma: 1,
      orbitalTheta: 0,
      angularSpeed: 0,
      combo: 1,
      score: 0,
      collectedInRun: 0,
      shield: 1,
      maxShield: 1,
      shieldInvulnFrames: 0,
    };

    this.syncUpgrades();
    this.initializeLevel();
  }

  public getSparkState(): Readonly<SparkState> {
    return this.spark;
  }

  public getMapData(): Readonly<MapData> {
    return this.mapData;
  }

  public getTrail(): Readonly<TrailBuffer> {
    return {
      points: this.historyTrail,
      head: this.trailHead,
      length: this.trailLength,
    };
  }

  public getConfig() {
    return { ...this.config };
  }

  public getSectorIndex(): number {
    return this.sectorIndex;
  }

  public getRunDistance(): number {
    return this.runDistance;
  }

  public getGamePhase(): GamePhase {
    return this.gamePhase;
  }

  public setGamePhase(phase: GamePhase): void {
    this.gamePhase = phase;
  }

  public updateCalibration(calibration: CalibrationState): void {
    if (this.runContext.mode === 'DAILY') return;
    this.calibration = { ...calibration };
    this.runRules = resolveRunRules(
      { mode: 'STANDARD' },
      this.ownedUpgrades(),
      this.currentSettings(),
    );
  }

  public syncUpgrades(): void {
    if (this.runContext.mode === 'DAILY') return;
    const rules = resolveRunRules(
      { mode: 'STANDARD' },
      this.ownedUpgrades(),
      this.currentSettings(),
    );
    this.applyRunRules(rules);
  }

  private ownedUpgrades(): UpgradeLevels {
    return {
      shield: this.saveState.shieldLvl,
      magnet: this.saveState.magnetLvl,
      tether: this.saveState.tetherLvl,
    };
  }

  private currentSettings() {
    return {
      baseSpeed: this.config.baseSpeed,
      subSteps: this.config.subSteps,
      hazardProximityBuffer: this.config.hazardProximityBuffer,
      calibration: { ...this.calibration },
    };
  }

  private refreshStandardRules(): void {
    if (this.runContext.mode === 'DAILY') return;
    const rules = resolveRunRules(
      { mode: 'STANDARD' },
      this.ownedUpgrades(),
      this.currentSettings(),
    );
    this.applyRunRules(rules);
  }

  private applyRunRules(rules: RunRules): void {
    this.runRules = rules;
    this.calibration = { ...rules.calibration };
    this.config.baseSpeed = rules.config.baseSpeed;
    this.config.maxTetherRadius = rules.config.maxTetherRadius;
    this.config.subSteps = rules.config.subSteps;
    this.config.hazardProximityBuffer = rules.config.hazardProximityBuffer;
    this.activeMagnetRange = rules.config.magnetRange;

    const newMax = rules.effectiveUpgrades.shield;
    const diff = newMax - this.spark.maxShield;
    if (diff > 0) {
      this.spark.shield += diff;
    }
    this.spark.maxShield = newMax;
    this.callbacks.onShieldChanged(this.spark.shield, this.spark.maxShield);
  }

  public setSubSteps(value: number): boolean {
    if (
      this.runContext.mode === 'DAILY' ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > 10
    ) {
      return false;
    }
    this.config.subSteps = value;
    this.refreshStandardRules();
    return true;
  }

  public setHazardProximityBuffer(value: number): boolean {
    if (
      this.runContext.mode === 'DAILY' ||
      !Number.isInteger(value) ||
      value < 15 ||
      value > 60
    ) {
      return false;
    }
    this.config.hazardProximityBuffer = value;
    this.refreshStandardRules();
    return true;
  }

  public initializeLevel(context: RunContext = this.runContext): void {
    this.runContext = { ...context };
    this.runRules = resolveRunRules(
      this.runContext,
      this.ownedUpgrades(),
      this.currentSettings(),
    );
    this.applyRunRules(this.runRules);
    if (this.runRules.seed !== null) {
      const random = new SeededRandom(this.runRules.seed);
      this.randomFn = () => random.next();
    } else {
      this.randomFn = Math.random;
    }
    this.spark.x = 100;
    this.spark.y = 200;
    this.spark.vx = this.config.baseSpeed;
    this.spark.vy = 0;
    this.spark.flightState = FlightState.LINEAR;
    this.spark.combo = 1;
    this.spark.score = 0;
    this.spark.collectedInRun = 0;
    this.spark.shield = this.spark.maxShield;
    this.spark.shieldInvulnFrames = 0;
    this.cancelNearMissEpisode();

    this.historyTrail = new Array(DEFAULT_CONFIG.trailLength);
    this.trailHead = 0;
    this.trailLength = 0;
    this.orbitalNode = null;
    this.sectorIndex = 1;
    this.simulationTimeMs = 0;
    this.sectorCooldown = -DEFAULT_CONFIG.sectorLeapCooldownMs;
    this.runDistance = 0;
    this.gamePhase = GamePhase.SPLASH;

    this.mapData.nodes = [];
    this.mapData.cores = [];
    this.mapData.upperWallSpline = [];
    this.mapData.lowerWallSpline = [];
    this.generationCursor = WorldGenerator.createCursor();

    const guaranteeGaps = this.calibration.safetyGapsEnabled;
    WorldGenerator.appendSegmentData(
      this.mapData,
      this.generationCursor,
      30,
      this.config,
      guaranteeGaps,
      this.randomFn,
    );

    this.callbacks.onShieldChanged(this.spark.shield, this.spark.maxShield);
    this.callbacks.onScoreChanged(this.spark.score, this.spark.combo);
    this.callbacks.onLog(
      'Fusion engines disengaged. Cockpit ready.',
      'success',
    );
  }

  public acquireTether(worldX?: number, worldY?: number): void {
    if (this.gamePhase !== GamePhase.FLYING) return;

    let targetX = this.spark.x + 100;
    let targetY = this.spark.y;

    const usePointerAim =
      this.runContext.mode === 'STANDARD' &&
      worldX !== undefined &&
      worldY !== undefined;
    if (usePointerAim) {
      targetX = worldX ?? targetX;
      targetY = worldY ?? targetY;
    }

    let targetNode: PivotNode | null = null;
    let minTetherDistance = Infinity;

    // Proximity lookup based on tap location first (if tapped close enough to a node)
    let closestNodeToTap: PivotNode | null = null;
    let tapMinDistanceSq = Infinity;

    if (usePointerAim) {
      for (let i = 0; i < this.mapData.nodes.length; i++) {
        const node = this.mapData.nodes[i];
        const dx = node.x - targetX;
        const dy = node.y - targetY;
        const distSq = dx * dx + dy * dy;
        if (
          distSq < 6400 &&
          (distSq < tapMinDistanceSq ||
            (distSq === tapMinDistanceSq &&
              node.id < (closestNodeToTap?.id ?? '')))
        ) {
          // 80^2 = 6400
          tapMinDistanceSq = distSq;
          closestNodeToTap = node;
        }
      }
    }

    if (closestNodeToTap) {
      const playerDist = Math.hypot(
        closestNodeToTap.x - this.spark.x,
        closestNodeToTap.y - this.spark.y,
      );
      if (playerDist <= this.config.maxTetherRadius) {
        targetNode = closestNodeToTap;
        minTetherDistance = playerDist;
      }
    }

    // Default proximity fallback
    if (!targetNode) {
      let minDistanceSq = Infinity;
      for (let i = 0; i < this.mapData.nodes.length; i++) {
        const node = this.mapData.nodes[i];
        const dx = node.x - this.spark.x;
        const dy = node.y - this.spark.y;
        const distSq = dx * dx + dy * dy;
        if (
          distSq < minDistanceSq ||
          (distSq === minDistanceSq && node.id < (targetNode?.id ?? ''))
        ) {
          minDistanceSq = distSq;
          targetNode = node;
        }
      }
      if (targetNode) {
        minTetherDistance = Math.sqrt(minDistanceSq);
      }
    }

    if (targetNode && minTetherDistance <= this.config.maxTetherRadius) {
      const rx = this.spark.x - targetNode.x;
      const ry = this.spark.y - targetNode.y;
      let radius = Math.hypot(rx, ry);

      if (radius < targetNode.radius) {
        radius = targetNode.radius + EPSILON;
      }

      const cross = rx * this.spark.vy - ry * this.spark.vx;
      let sigma = 1;

      if (this.calibration.collinearFallbackEnabled) {
        sigma = Math.abs(cross) < EPSILON ? 1 : Math.sign(cross);
      } else {
        sigma = Math.sign(cross);
      }
      if (sigma === 0) sigma = 1;

      this.spark.flightState = FlightState.ORBITAL;
      this.spark.orbitalNodeId = targetNode.id;
      this.spark.orbitalRadius = radius;
      this.spark.orbitalSigma = sigma;
      this.spark.orbitalTheta = Math.atan2(ry, rx);
      this.orbitalNode = targetNode;

      const speed = Math.hypot(this.spark.vx, this.spark.vy);
      const rawAngularSpeed = speed / radius;
      const maxAngularSpeed = DEFAULT_CONFIG.maxAngularSpeed;
      this.spark.angularSpeed =
        sigma * Math.min(rawAngularSpeed, maxAngularSpeed);

      this.callbacks.onTetherAcquired(targetNode.id);
      this.callbacks.onLog(
        `Tether secure on orbit node ${targetNode.id.split('_')[1]}.`,
        'info',
      );
    } else {
      this.callbacks.onLog(
        `Node vector outside tether limits (R_max).`,
        'warn',
      );
    }
  }

  public releaseTether(): void {
    if (this.spark.flightState === FlightState.ORBITAL) {
      this.spark.flightState = FlightState.LINEAR;
      this.spark.orbitalNodeId = '';
      this.orbitalNode = null;
      this.callbacks.onTetherReleased();
      this.callbacks.onLog('Tether decoupled.', 'info');
    }
  }

  private triggerSectorLeap(): void {
    if (
      this.simulationTimeMs - this.sectorCooldown <
      DEFAULT_CONFIG.sectorLeapCooldownMs
    ) {
      return;
    }
    this.sectorCooldown = this.simulationTimeMs;
    this.cancelNearMissEpisode();

    const destinationX = this.spark.x + 1000;
    this.ensureWorldThrough(destinationX + 3000);
    this.sectorIndex++;
    this.spark.x = destinationX;

    // Reset trail buffer to prevent a giant leap line
    this.trailLength = 0;
    this.trailHead = 0;

    this.spark.shield = this.spark.maxShield;
    this.callbacks.onShieldChanged(this.spark.shield, this.spark.maxShield);

    this.spark.score += 1000 * this.sectorIndex;
    this.callbacks.onScoreChanged(this.spark.score, this.spark.combo);
    this.callbacks.onSectorLeap(this.sectorIndex);
    this.callbacks.onLog(
      `Hyper-jump complete! Sector ${this.sectorIndex} reached. Shields restored.`,
      'success',
    );
  }

  private ensureWorldThrough(targetX: number): void {
    while (this.generationCursor.nextWallX <= targetX) {
      WorldGenerator.appendSegmentData(
        this.mapData,
        this.generationCursor,
        15,
        this.config,
        this.calibration.safetyGapsEnabled,
        this.randomFn,
      );
    }
  }

  private updateCoresAndMagnetPull(dt: number): void {
    if (
      !Number.isFinite(this.spark.x) ||
      !Number.isFinite(this.spark.y) ||
      this.activeMagnetRange <= 0
    ) {
      return;
    }
    const activeViewLimit = 400;
    for (let i = 0; i < this.mapData.cores.length; i++) {
      const core = this.mapData.cores[i];
      if (core.collected) continue;
      if (!Number.isFinite(core.x) || !Number.isFinite(core.y)) continue;
      if (Math.abs(core.x - this.spark.x) > activeViewLimit) continue;

      const dist = Math.hypot(core.x - this.spark.x, core.y - this.spark.y);
      if (!Number.isFinite(dist)) continue;

      if (dist <= this.activeMagnetRange) {
        const perSubstepPull = 0.15 * (1 - dist / this.activeMagnetRange);
        const alpha =
          1 - (1 - perSubstepPull) ** (DEFAULT_CONFIG.subSteps * dt * 60);
        core.x += (this.spark.x - core.x) * alpha;
        core.y += (this.spark.y - core.y) * alpha;
      }

      const finalDistance = Math.hypot(
        core.x - this.spark.x,
        core.y - this.spark.y,
      );
      if (finalDistance < 14) {
        core.collected = true;
        this.spark.collectedInRun++;
        this.saveState.totalCores++;
        this.saveState.save();

        this.spark.score += 150 * this.spark.combo;
        this.callbacks.onScoreChanged(this.spark.score, this.spark.combo);
        this.callbacks.onCoreCollected(
          this.spark.collectedInRun,
          this.saveState.totalCores,
          core.x,
          core.y,
        );
      }
    }
  }

  private handleNearMisses(x: number, y: number): void {
    if (this.mapData.upperWallSpline.length === 0) {
      this.cancelNearMissEpisode();
      return;
    }

    const { upperY, lowerY } = WorldGenerator.getWallBoundaries(
      this.mapData,
      x,
    );

    const minWallDistance = Math.min(y - upperY, lowerY - y);
    const dangerLimit = this.calibration.subSteppingEnabled
      ? this.config.hazardProximityBuffer
      : DEFAULT_CONFIG.hazardProximityBuffer;
    const nearWall = minWallDistance < dangerLimit;
    this.setDangerProximity(nearWall);
    if (nearWall) {
      this.nearMissEpisodeActive = true;
    } else if (
      this.nearMissEpisodeActive &&
      minWallDistance >= dangerLimit + 5
    ) {
      this.nearMissEpisodeActive = false;
      this.spark.combo = Math.min(this.spark.combo + 1, 5);
      this.spark.score += 200 * this.spark.combo;

      this.callbacks.onScoreChanged(this.spark.score, this.spark.combo);
      this.callbacks.onNearMiss(this.spark.combo, x, y);
      this.callbacks.onLog(
        `Dynamic hazard proximity bonus! Combo multiplied: x${this.spark.combo}`,
        'info',
      );
    }
  }

  private setDangerProximity(active: boolean): void {
    if (active === this.dangerProximityActive) return;
    this.dangerProximityActive = active;
    this.callbacks.onDangerProximity(active);
  }

  private cancelNearMissEpisode(): void {
    this.nearMissEpisodeActive = false;
    this.setDangerProximity(false);
  }

  public physicsTick(dt: number): void {
    if (this.gamePhase !== GamePhase.FLYING) return;
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.simulationTimeMs += dt * 1000;

    if (this.spark.shieldInvulnFrames > 0) {
      this.spark.shieldInvulnFrames--;
    }

    if (this.spark.flightState === FlightState.ORBITAL) {
      if (!this.orbitalNode || !this.mapData.nodes.includes(this.orbitalNode)) {
        this.releaseTether();
      }
    }

    const subSteps = this.calibration.subSteppingEnabled
      ? this.config.subSteps
      : 1;
    const subDt = dt / subSteps;

    for (let i = 0; i < subSteps; i++) {
      if (this.spark.flightState === FlightState.LINEAR) {
        this.spark.x += this.spark.vx * subDt * 60;
        this.spark.y += this.spark.vy * subDt * 60;
      } else {
        this.spark.orbitalTheta += this.spark.angularSpeed * subDt * 60;
        const targetNode = this.orbitalNode;
        if (targetNode) {
          this.spark.x =
            targetNode.x +
            this.spark.orbitalRadius * Math.cos(this.spark.orbitalTheta);
          this.spark.y =
            targetNode.y +
            this.spark.orbitalRadius * Math.sin(this.spark.orbitalTheta);

          const speed = Math.abs(
            this.spark.angularSpeed * this.spark.orbitalRadius,
          );
          this.spark.vx =
            -speed *
            this.spark.orbitalSigma *
            Math.sin(this.spark.orbitalTheta);
          this.spark.vy =
            speed * this.spark.orbitalSigma * Math.cos(this.spark.orbitalTheta);
        }
      }

      const hitWall = WorldGenerator.checkWallCollision(
        this.mapData,
        this.spark.x,
        this.spark.y,
      );
      if (hitWall) {
        this.cancelNearMissEpisode();
        if (this.spark.shieldInvulnFrames <= 0) {
          this.spark.shield--;
          this.spark.combo = 1;
          this.spark.shieldInvulnFrames = 60;
          this.callbacks.onShieldChanged(
            this.spark.shield,
            this.spark.maxShield,
          );
          this.callbacks.onScoreChanged(this.spark.score, this.spark.combo);

          if (this.spark.shield <= 0) {
            this.gamePhase = GamePhase.CRASHED;
            this.callbacks.onRunEnded({
              context: { ...this.runContext },
              score: Math.floor(this.spark.score),
              sectorReached: this.sectorIndex,
              collectedCores: this.spark.collectedInRun,
              x: this.spark.x,
              y: this.spark.y,
            });
            this.callbacks.onLog(
              'Shield array collapsed! Space vessel destroyed.',
              'alert',
            );
            break;
          } else {
            this.callbacks.onShieldBounce(
              this.spark.shield,
              this.spark.x,
              this.spark.y,
            );
            this.callbacks.onLog(
              `Hull impact! Shield buffers absorbed damage. Remaining: ${this.spark.shield}`,
              'warn',
            );

            const { upperY, lowerY } = WorldGenerator.getWallBoundaries(
              this.mapData,
              this.spark.x,
            );
            this.spark.y = upperY + (lowerY - upperY) / 2;
            this.spark.flightState = FlightState.LINEAR;
            this.spark.vx = this.config.baseSpeed;
            this.spark.vy = 0;
          }
        }
      }

      if (!hitWall) this.handleNearMisses(this.spark.x, this.spark.y);
    }

    if (this.gamePhase === GamePhase.CRASHED) return;

    // Attraction/collection is one fixed-tick game system, independent of collision samples.
    // Moving paths are endpoint-sampled; collision substeps do not multiply pickup strength.
    this.updateCoresAndMagnetPull(dt);

    // Infinite segment generation check
    if (this.mapData.upperWallSpline.length > 0) {
      this.ensureWorldThrough(this.spark.x + 3000);
      WorldGenerator.cullBehindCamera(
        this.mapData,
        this.spark.x - 500,
        this.spark.flightState === FlightState.ORBITAL
          ? this.spark.orbitalNodeId
          : undefined,
      );
    }

    this.runDistance = Math.floor(this.spark.x / 10);
    const sectorDistanceProgress =
      (this.spark.x % DEFAULT_CONFIG.sectorDistance) /
      DEFAULT_CONFIG.sectorDistance;

    const velocityScalar = Math.hypot(this.spark.vx, this.spark.vy);
    this.callbacks.onTelemetryUpdate(
      this.spark.flightState === FlightState.ORBITAL
        ? `σ = ${this.spark.orbitalSigma}`
        : 'N/A',
      `${(velocityScalar * 60).toFixed(0)} px/s`,
      sectorDistanceProgress,
      this.sectorIndex,
    );

    const currentSector =
      Math.floor(this.spark.x / DEFAULT_CONFIG.sectorDistance) + 1;
    if (currentSector > this.sectorIndex) {
      this.triggerSectorLeap();
    }

    if (this.trailLength < DEFAULT_CONFIG.trailLength) {
      this.historyTrail[this.trailLength] = {
        x: this.spark.x,
        y: this.spark.y,
      };
      this.trailLength++;
    } else {
      this.historyTrail[this.trailHead] = { x: this.spark.x, y: this.spark.y };
      this.trailHead = (this.trailHead + 1) % DEFAULT_CONFIG.trailLength;
    }
  }

  public setBaseSpeed(speed: number): boolean {
    if (
      this.runContext.mode === 'DAILY' ||
      !Number.isFinite(speed) ||
      speed < 3 ||
      speed > 15
    ) {
      return false;
    }
    this.config.baseSpeed = speed;
    if (this.spark.flightState === FlightState.LINEAR) {
      const angle = Math.atan2(this.spark.vy, this.spark.vx);
      this.spark.vx = Math.cos(angle) * speed;
      this.spark.vy = Math.sin(angle) * speed;
    }
    this.refreshStandardRules();
    return true;
  }
}
