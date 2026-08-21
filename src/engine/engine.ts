import { GameSaveState } from '../state/saveState';
import { WorldGenerator } from '../world/generator';
import { SparkState, MapData, TrailPoint, EngineCallbacks, CalibrationState, TrailBuffer, PivotNode } from '../types';
import { FlightState, GamePhase, DEFAULT_CONFIG, EPSILON } from '../constants';

export class GravityPivotEngine {
  private saveState: GameSaveState;
  private callbacks: EngineCallbacks;
  private calibration: CalibrationState;

  private spark!: SparkState;
  private mapData: MapData = { nodes: [], cores: [], upperWallSpline: [], lowerWallSpline: [] };
  private historyTrail: TrailPoint[] = new Array(DEFAULT_CONFIG.trailLength);
  private trailHead: number = 0;
  private trailLength: number = 0;
  private orbitalNode: PivotNode | null = null;

  private activeMaxTether: number = DEFAULT_CONFIG.maxTetherRadius;
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
    hazardProximityBuffer: DEFAULT_CONFIG.hazardProximityBuffer
  };

  private sectorIndex: number = 1;
  private sectorCooldown: number = 0;
  private runDistance: number = 0;
  private gamePhase: GamePhase = GamePhase.SPLASH;
  private randomFn: () => number = Math.random;

  public setRandomFn(fn: () => number): void {
    this.randomFn = fn;
  }

  constructor(
    saveState: GameSaveState,
    callbacks: EngineCallbacks,
    calibration: CalibrationState
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
      activeNearMisses: new Set<number>(),
      shield: 1,
      maxShield: 1,
      shieldInvulnFrames: 0
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
      length: this.trailLength
    };
  }

  public getConfig() {
    return this.config;
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
    this.calibration = calibration;
  }

  public syncUpgrades(): void {
    const maxLevel = DEFAULT_CONFIG.maxUpgradeLevel;

    // Note: shield level maps 1:1 to maxShield (no formula)
    const newMax = Math.min(this.saveState.shieldLvl, maxLevel);
    const diff = newMax - this.spark.maxShield;
    if (diff > 0) {
      this.spark.shield += diff;
    }
    this.spark.maxShield = newMax;

    this.activeMagnetRange = 40 + (Math.min(this.saveState.magnetLvl, maxLevel) - 1) * 35;
    this.activeMaxTether = 180 + (Math.min(this.saveState.tetherLvl, maxLevel) - 1) * 35;
    this.config.maxTetherRadius = this.activeMaxTether;

    this.callbacks.onShieldChanged(this.spark.shield, this.spark.maxShield);
  }

  public initializeLevel(): void {
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
    this.spark.activeNearMisses.clear();

    this.historyTrail = new Array(DEFAULT_CONFIG.trailLength);
    this.trailHead = 0;
    this.trailLength = 0;
    this.orbitalNode = null;
    this.sectorIndex = 1;
    this.sectorCooldown = -DEFAULT_CONFIG.sectorLeapCooldownMs;
    this.runDistance = 0;
    this.gamePhase = GamePhase.SPLASH;

    this.mapData.nodes = [];
    this.mapData.cores = [];
    this.mapData.upperWallSpline = [];
    this.mapData.lowerWallSpline = [];

    const guaranteeGaps = this.calibration.safetyGapsEnabled;
    WorldGenerator.appendSegmentData(this.mapData, 0, 30, this.config, guaranteeGaps, this.randomFn);
    
    this.callbacks.onShieldChanged(this.spark.shield, this.spark.maxShield);
    this.callbacks.onScoreChanged(this.spark.score, this.spark.combo);
    this.callbacks.onCoreCollected(this.spark.collectedInRun, this.saveState.totalCores, this.spark.x, this.spark.y);
    this.callbacks.onLog('Fusion engines disengaged. Cockpit ready.', 'success');
  }

  public acquireTether(worldX?: number, worldY?: number): void {
    if (this.gamePhase !== GamePhase.FLYING) return;

    let targetX = this.spark.x + 100;
    let targetY = this.spark.y;

    if (worldX !== undefined && worldY !== undefined) {
      targetX = worldX;
      targetY = worldY;
    }

    let targetNode: PivotNode | null = null;
    let minTetherDistance = Infinity;

    // Proximity lookup based on tap location first (if tapped close enough to a node)
    let closestNodeToTap: any = null;
    let tapMinDistanceSq = Infinity;

    for (let i = 0; i < this.mapData.nodes.length; i++) {
      const node = this.mapData.nodes[i];
      const dx = node.x - targetX;
      const dy = node.y - targetY;
      const distSq = dx * dx + dy * dy;
      if (distSq < tapMinDistanceSq && distSq < 6400) { // 80^2 = 6400
        tapMinDistanceSq = distSq;
        closestNodeToTap = node;
      }
    }

    if (closestNodeToTap) {
      const playerDist = Math.hypot(closestNodeToTap.x - this.spark.x, closestNodeToTap.y - this.spark.y);
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
        if (distSq < minDistanceSq) {
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
      this.spark.angularSpeed = sigma * Math.min(rawAngularSpeed, maxAngularSpeed);

      this.callbacks.onTetherAcquired(targetNode.id);
      this.callbacks.onLog(`Tether secure on orbit node ${targetNode.id.split('_')[1]}.`, 'info');
    } else {
      this.callbacks.onLog(`Node vector outside tether limits (R_max).`, 'warn');
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
    const now = performance.now();
    if (now - this.sectorCooldown < DEFAULT_CONFIG.sectorLeapCooldownMs) return;
    this.sectorCooldown = now;

    this.sectorIndex++;
    this.spark.x += 1000;

    // Reset trail buffer to prevent a giant leap line
    this.trailLength = 0;
    this.trailHead = 0;

    const guaranteeGaps = this.calibration.safetyGapsEnabled;
    WorldGenerator.appendSegmentData(this.mapData, this.spark.x + 100, 30, this.config, guaranteeGaps, this.randomFn);

    this.spark.shield = this.spark.maxShield;
    this.callbacks.onShieldChanged(this.spark.shield, this.spark.maxShield);

    this.spark.score += 1000 * this.sectorIndex;
    this.callbacks.onScoreChanged(this.spark.score, this.spark.combo);
    this.callbacks.onSectorLeap(this.sectorIndex);
    this.callbacks.onLog(`Hyper-jump complete! Sector ${this.sectorIndex} reached. Shields restored.`, 'success');
  }

  private updateCoresAndMagnetPull(): void {
    const activeViewLimit = 400;
    for (let i = 0; i < this.mapData.cores.length; i++) {
      const core = this.mapData.cores[i];
      if (core.collected) continue;
      if (Math.abs(core.x - this.spark.x) > activeViewLimit) continue;

      const dist = Math.hypot(core.x - this.spark.x, core.y - this.spark.y);

      if (dist <= this.activeMagnetRange) {
        const pullStrength = 0.15 * (1 - dist / this.activeMagnetRange);
        core.x += (this.spark.x - core.x) * pullStrength;
        core.y += (this.spark.y - core.y) * pullStrength;
      }

      if (dist < 14) {
        core.collected = true;
        this.spark.collectedInRun++;
        this.saveState.totalCores++;
        this.saveState.save();

        this.spark.score += 150 * this.spark.combo;
        this.callbacks.onScoreChanged(this.spark.score, this.spark.combo);
        this.callbacks.onCoreCollected(this.spark.collectedInRun, this.saveState.totalCores, core.x, core.y);
      }
    }
  }

  private handleNearMisses(x: number, y: number): void {
    if (this.mapData.upperWallSpline.length === 0) return;

    const startX = this.mapData.upperWallSpline[0].x;
    const stepResolution = 20;
    const index = Math.floor((x - startX) / stepResolution);

    if (index < 0 || index >= this.mapData.upperWallSpline.length) return;

    const { upperY, lowerY } = WorldGenerator.getWallBoundaries(this.mapData, x);

    const distToUpper = y - upperY;
    const distToLower = lowerY - y;
    const dangerLimit = this.calibration.subSteppingEnabled ? this.config.hazardProximityBuffer : DEFAULT_CONFIG.hazardProximityBuffer;

    const nearWall = distToUpper < dangerLimit || distToLower < dangerLimit;

    this.callbacks.onDangerProximity(nearWall);

    if (nearWall) {
      if (!this.spark.activeNearMisses.has(index)) {
        this.spark.activeNearMisses.add(index);
      }
    } else {
      if (this.spark.activeNearMisses.has(index)) {
        this.spark.activeNearMisses.delete(index);
        this.spark.combo = Math.min(this.spark.combo + 1, 5);
        this.spark.score += 200 * this.spark.combo;

        this.callbacks.onScoreChanged(this.spark.score, this.spark.combo);
        this.callbacks.onNearMiss(this.spark.combo, x, y);
        this.callbacks.onLog(`Dynamic hazard proximity bonus! Combo multiplied: x${this.spark.combo}`, 'info');
      }
    }
  }

  public physicsTick(dt: number): void {
    if (this.spark.shieldInvulnFrames > 0) {
      this.spark.shieldInvulnFrames--;
    }

    if (this.spark.flightState === FlightState.ORBITAL) {
      if (!this.orbitalNode || !this.mapData.nodes.includes(this.orbitalNode)) {
        this.releaseTether();
      }
    }

    const subSteps = this.calibration.subSteppingEnabled ? this.config.subSteps : 1;
    const subDt = dt / subSteps;

    for (let i = 0; i < subSteps; i++) {
      if (this.spark.flightState === FlightState.LINEAR) {
        this.spark.x += this.spark.vx * subDt * 60;
        this.spark.y += this.spark.vy * subDt * 60;
      } else {
        this.spark.orbitalTheta += this.spark.angularSpeed * subDt * 60;
        const targetNode = this.orbitalNode;
        if (targetNode) {
          this.spark.x = targetNode.x + this.spark.orbitalRadius * Math.cos(this.spark.orbitalTheta);
          this.spark.y = targetNode.y + this.spark.orbitalRadius * Math.sin(this.spark.orbitalTheta);

          const speed = Math.abs(this.spark.angularSpeed * this.spark.orbitalRadius);
          this.spark.vx = -speed * this.spark.orbitalSigma * Math.sin(this.spark.orbitalTheta);
          this.spark.vy = speed * this.spark.orbitalSigma * Math.cos(this.spark.orbitalTheta);
        }
      }

      if (WorldGenerator.checkWallCollision(this.mapData, this.spark.x, this.spark.y)) {
        if (this.spark.shieldInvulnFrames <= 0) {
          this.spark.shield--;
          this.spark.combo = 1;
          this.spark.shieldInvulnFrames = 60;
          this.callbacks.onShieldChanged(this.spark.shield, this.spark.maxShield);
          this.callbacks.onScoreChanged(this.spark.score, this.spark.combo);

          if (this.spark.shield <= 0) {
            this.gamePhase = GamePhase.CRASHED;
            const isNewHighScore = this.saveState.highScores.length === 0 || Math.floor(this.spark.score) > this.saveState.highScores[0].score;
            this.saveState.addHighScore(this.spark.score, this.sectorIndex);
            const isNewDailyBest = this.saveState.updateDailyBest(this.spark.score);
            this.callbacks.onCrash(
              this.spark.x,
              this.spark.y,
              Math.floor(this.spark.score),
              this.sectorIndex,
              isNewHighScore,
              isNewDailyBest,
              this.saveState.dailyBest
            );
            this.callbacks.onLog('Shield array collapsed! Space vessel destroyed.', 'alert');
            break;
          } else {
            this.callbacks.onShieldBounce(this.spark.shield, this.spark.x, this.spark.y);
            this.callbacks.onLog(`Hull impact! Shield buffers absorbed damage. Remaining: ${this.spark.shield}`, 'warn');

            const { upperY, lowerY } = WorldGenerator.getWallBoundaries(this.mapData, this.spark.x);
            this.spark.y = upperY + (lowerY - upperY) / 2;
            this.spark.flightState = FlightState.LINEAR;
            this.spark.vx = this.config.baseSpeed;
            this.spark.vy = 0;
          }
        }
      }

      this.updateCoresAndMagnetPull();
      this.handleNearMisses(this.spark.x, this.spark.y);
    }

    // Infinite segment generation check
    const totalSplineSize = this.mapData.upperWallSpline.length;
    if (totalSplineSize > 0) {
      const lastWallElement = this.mapData.upperWallSpline[totalSplineSize - 1];
      if (this.spark.x + 3000 > lastWallElement.x) {
        const guaranteeGaps = this.calibration.safetyGapsEnabled;
        WorldGenerator.appendSegmentData(this.mapData, lastWallElement.x, 15, this.config, guaranteeGaps, this.randomFn);
        WorldGenerator.cullBehindCamera(this.mapData, this.spark.x - 500);
      }
    }

    this.runDistance = Math.floor(this.spark.x / 10);
    const sectorDistanceProgress = (this.spark.x % DEFAULT_CONFIG.sectorDistance) / DEFAULT_CONFIG.sectorDistance;

    const velocityScalar = Math.hypot(this.spark.vx, this.spark.vy);
    this.callbacks.onTelemetryUpdate(
      this.spark.flightState === FlightState.ORBITAL ? `σ = ${this.spark.orbitalSigma}` : 'N/A',
      `${(velocityScalar * 60).toFixed(0)} px/s`,
      sectorDistanceProgress,
      this.sectorIndex
    );

    const currentSector = Math.floor(this.spark.x / DEFAULT_CONFIG.sectorDistance) + 1;
    if (currentSector > this.sectorIndex) {
      this.triggerSectorLeap();
    }

    if (this.trailLength < DEFAULT_CONFIG.trailLength) {
      this.historyTrail[this.trailLength] = { x: this.spark.x, y: this.spark.y };
      this.trailLength++;
    } else {
      this.historyTrail[this.trailHead] = { x: this.spark.x, y: this.spark.y };
      this.trailHead = (this.trailHead + 1) % DEFAULT_CONFIG.trailLength;
    }
  }

  public setBaseSpeed(speed: number): void {
    this.config.baseSpeed = speed;
    if (this.spark.flightState === FlightState.LINEAR) {
      const angle = Math.atan2(this.spark.vy, this.spark.vx);
      this.spark.vx = Math.cos(angle) * speed;
      this.spark.vy = Math.sin(angle) * speed;
    }
  }
}
