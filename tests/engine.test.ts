import { describe, test, expect, beforeEach, vi } from 'vitest';
import { GravityPivotEngine } from '../src/engine/engine';
import { GameSaveState } from '../src/state/saveState';
import { EngineCallbacks, CalibrationState } from '../src/types';
import { FlightState, GamePhase } from '../src/constants';
import { WorldGenerator } from '../src/world/generator';

describe('GravityPivotEngine', () => {
  let saveState: GameSaveState;
  let callbacks: EngineCallbacks;
  let calibration: CalibrationState;
  let engine: GravityPivotEngine;

  beforeEach(() => {
    // Setup mock localStorage
    const store: Record<string, string> = {};
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
      },
      writable: true,
      configurable: true,
    });

    saveState = new GameSaveState();

    callbacks = {
      onShieldChanged: vi.fn(),
      onScoreChanged: vi.fn(),
      onCoreCollected: vi.fn(),
      onSectorLeap: vi.fn(),
      onNearMiss: vi.fn(),
      onDangerProximity: vi.fn(),
      onShieldBounce: vi.fn(),
      onRunEnded: vi.fn(),
      onTetherAcquired: vi.fn(),
      onTetherReleased: vi.fn(),
      onTelemetryUpdate: vi.fn(),
      onLog: vi.fn(),
    };

    calibration = {
      subSteppingEnabled: true,
      safetyGapsEnabled: false,
      collinearFallbackEnabled: true,
    };

    engine = new GravityPivotEngine(saveState.upgrades, callbacks, calibration);
    engine.setGamePhase(GamePhase.FLYING);
  });

  test('should initialize correctly', () => {
    expect(engine.getSparkState().x).toBe(100);
    expect(engine.getSparkState().y).toBe(200);
    expect(engine.getSparkState().flightState).toBe(FlightState.LINEAR);
    expect(engine.getSectorIndex()).toBe(1);
    expect(engine.getRunDistance()).toBe(0);
  });

  test('initializing a run does not report a core collection', () => {
    engine.initializeLevel();

    expect(callbacks.onCoreCollected).not.toHaveBeenCalled();
  });

  test('should move spark in linear flight during tick', () => {
    const initialX = engine.getSparkState().x;
    const initialY = engine.getSparkState().y;
    const baseSpeed = engine.getConfig().baseSpeed;

    engine.physicsTick(1 / 60);

    expect(engine.getSparkState().x).toBeCloseTo(initialX + baseSpeed);
    expect(engine.getSparkState().y).toBeCloseTo(initialY);
  });

  test('should establish orbital tether on nearby node', () => {
    const map = engine.getMapData() as any;
    map.nodes = [{ id: 'node_test', x: 200, y: 200, radius: 20 }];

    const spark = engine.getSparkState() as any;
    spark.x = 150;
    spark.y = 200;
    spark.vx = 6;
    spark.vy = 0;

    engine.acquireTether();

    expect(engine.getSparkState().flightState).toBe(FlightState.ORBITAL);
    expect(engine.getSparkState().orbitalNodeId).toBe('node_test');
    expect(callbacks.onTetherAcquired).toHaveBeenCalled();
  });

  test('should transition back to linear flight on tether release', () => {
    const spark = engine.getSparkState() as any;
    spark.flightState = FlightState.ORBITAL;
    spark.orbitalNodeId = 'node_test';

    engine.releaseTether();

    expect(engine.getSparkState().flightState).toBe(FlightState.LINEAR);
    expect(callbacks.onTetherReleased).toHaveBeenCalled();
  });

  test('should trigger damage and bounce on wall collision', () => {
    const spark = engine.getSparkState() as any;
    spark.shield = 3;
    spark.maxShield = 3;

    const map = engine.getMapData() as any;
    map.upperWallSpline = [
      { x: 0, y: 150 },
      { x: 100, y: 150 },
      { x: 200, y: 150 },
    ];
    map.lowerWallSpline = [
      { x: 0, y: 350 },
      { x: 100, y: 350 },
      { x: 200, y: 350 },
    ];

    spark.x = 100;
    spark.y = 120;
    spark.vx = 6;
    spark.vy = 0;

    engine.physicsTick(1 / 60);

    expect(engine.getSparkState().shield).toBe(2);
    expect(engine.getSparkState().shieldInvulnFrames).toBe(60);
    expect(engine.getSparkState().y).toBe(250); // midpoint (150 + 350) / 2
    expect(callbacks.onShieldBounce).toHaveBeenCalled();
  });

  test('should transition to crashed when shield reaches 0', () => {
    const spark = engine.getSparkState() as any;
    spark.shield = 1;

    const map = engine.getMapData() as any;
    map.upperWallSpline = [
      { x: 0, y: 150 },
      { x: 100, y: 150 },
    ];
    map.lowerWallSpline = [
      { x: 0, y: 350 },
      { x: 100, y: 350 },
    ];

    spark.x = 100;
    spark.y = 120;

    engine.physicsTick(1 / 60);

    expect(engine.getSparkState().shield).toBe(0);
    expect(engine.getGamePhase()).toBe(GamePhase.CRASHED);
    expect(callbacks.onRunEnded).toHaveBeenCalledTimes(1);
  });

  test('should trigger sector leap when crossing sectorDistance boundary', () => {
    const spark = engine.getSparkState() as any;
    spark.x = 9999;
    spark.vx = 10;
    spark.vy = 0;

    engine.physicsTick(1 / 60);

    expect(engine.getSectorIndex()).toBe(2);
    expect(callbacks.onSectorLeap).toHaveBeenCalledWith(2);
    const map = engine.getMapData();
    expect(map.upperWallSpline.length).toBe(map.lowerWallSpline.length);
    for (let i = 1; i < map.upperWallSpline.length; i++) {
      expect(map.upperWallSpline[i].x - map.upperWallSpline[i - 1].x).toBe(20);
    }
    expect(new Set(map.nodes.map((node) => node.id)).size).toBe(
      map.nodes.length,
    );
  });

  test('sector leap places the spark safely in the destination corridor', () => {
    const map = engine.getMapData() as any;
    (engine as any).ensureWorldThrough(15000);
    map.upperWallSpline = Array.from({ length: 751 }, (_, i) => ({
      x: i * 20,
      y: i * 20 < 11000 ? 10 : 40,
    }));
    map.lowerWallSpline = Array.from({ length: 751 }, (_, i) => ({
      x: i * 20,
      y: 390,
    }));

    const spark = engine.getSparkState() as any;
    spark.x = 9999;
    spark.y = 24;
    spark.vx = 6;
    spark.vy = 0;

    engine.physicsTick(1 / 60);

    expect(engine.getSectorIndex()).toBe(2);
    expect(spark.x).toBeGreaterThan(11000);
    expect(spark.y).toBe(215);
    expect(spark.vx).toBe(engine.getConfig().baseSpeed);
    expect(spark.vy).toBe(0);
    expect(WorldGenerator.checkWallCollision(map, spark.x, spark.y)).toBe(
      false,
    );

    engine.physicsTick(1 / 60);
    expect(engine.getGamePhase()).toBe(GamePhase.FLYING);
  });

  test('releases the tether at a sector leap without snapping back next tick', () => {
    const map = engine.getMapData() as any;
    map.nodes = [{ id: 'preserved-orbit', x: 10000, y: 200, radius: 20 }];
    const spark = engine.getSparkState() as any;
    spark.x = 10020;
    spark.y = 200;

    engine.acquireTether();
    expect(spark.orbitalNodeId).toBe('preserved-orbit');
    engine.physicsTick(1 / 60);

    expect(engine.getSectorIndex()).toBe(2);
    expect(spark.flightState).toBe(FlightState.LINEAR);
    expect(spark.orbitalNodeId).toBe('');
    expect(callbacks.onTetherReleased).toHaveBeenCalledTimes(1);
    expect(map.nodes.some((node: any) => node.id === 'preserved-orbit')).toBe(
      true,
    );

    engine.physicsTick(1 / 60);
    expect(spark.x).toBeGreaterThan(10500);
  });

  test('rewards one continuous near-miss across a spline-cell boundary', () => {
    const spark = engine.getSparkState() as any;
    const map = engine.getMapData() as any;
    map.upperWallSpline = Array.from({ length: 51 }, (_, i) => ({
      x: i * 20,
      y: 150,
    }));
    map.lowerWallSpline = Array.from({ length: 51 }, (_, i) => ({
      x: i * 20,
      y: 350,
    }));

    spark.vx = 0;
    spark.x = 18;
    spark.y = 170;

    engine.physicsTick(1 / 60);
    expect(callbacks.onDangerProximity).toHaveBeenCalledWith(true);

    spark.x = 42;
    spark.y = 330;
    engine.physicsTick(1 / 60);
    expect(callbacks.onNearMiss).not.toHaveBeenCalled();
    expect(callbacks.onDangerProximity).toHaveBeenCalledTimes(1);

    WorldGenerator.cullBehindCamera(map, 60);
    spark.x = 82;
    spark.y = 250;

    engine.physicsTick(1 / 60);
    expect(callbacks.onDangerProximity).toHaveBeenCalledWith(false);
    expect(engine.getSparkState().combo).toBe(2);
    expect(callbacks.onNearMiss).toHaveBeenCalledTimes(1);
    expect(callbacks.onDangerProximity).toHaveBeenCalledTimes(2);

    spark.x = 40;
    engine.physicsTick(1 / 60);
    expect(callbacks.onNearMiss).toHaveBeenCalledTimes(1);
  });

  test('caps the combo at five across repeated completed near-miss episodes', () => {
    const spark = engine.getSparkState() as any;
    const map = engine.getMapData() as any;
    map.upperWallSpline = Array.from({ length: 51 }, (_, i) => ({
      x: i * 20,
      y: 150,
    }));
    map.lowerWallSpline = Array.from({ length: 51 }, (_, i) => ({
      x: i * 20,
      y: 350,
    }));
    map.cores = [];
    spark.vx = 0;
    spark.x = 20;

    for (let episode = 0; episode < 8; episode++) {
      spark.y = 170;
      engine.physicsTick(1 / 60);
      spark.y = 190;
      engine.physicsTick(1 / 60);
    }

    expect(spark.combo).toBe(5);
    expect(spark.score).toBe(6800);
    expect(callbacks.onNearMiss).toHaveBeenCalledTimes(8);
  });

  test('near-miss boundary jitter rewards only after clearing the safe margin', () => {
    const spark = engine.getSparkState() as any;
    const map = engine.getMapData() as any;
    map.upperWallSpline = Array.from({ length: 51 }, (_, i) => ({
      x: i * 20,
      y: 150,
    }));
    map.lowerWallSpline = Array.from({ length: 51 }, (_, i) => ({
      x: i * 20,
      y: 350,
    }));
    spark.vx = 0;
    spark.x = 20;
    spark.y = 170;
    engine.physicsTick(1 / 60);

    spark.y = 184;
    engine.physicsTick(1 / 60);
    expect(callbacks.onNearMiss).not.toHaveBeenCalled();
    spark.y = 170;
    engine.physicsTick(1 / 60);
    spark.y = 186;
    engine.physicsTick(1 / 60);
    spark.y = 190;
    engine.physicsTick(1 / 60);

    expect(callbacks.onNearMiss).toHaveBeenCalledTimes(1);
    expect(engine.getSparkState().combo).toBe(2);
    expect(callbacks.onDangerProximity).toHaveBeenCalledTimes(4);
  });

  test('collision cancels an active near-miss episode without impact reward', () => {
    const spark = engine.getSparkState() as any;
    const map = engine.getMapData() as any;
    map.upperWallSpline = Array.from({ length: 51 }, (_, i) => ({
      x: i * 20,
      y: 150,
    }));
    map.lowerWallSpline = Array.from({ length: 51 }, (_, i) => ({
      x: i * 20,
      y: 350,
    }));
    spark.vx = 0;
    spark.x = 20;
    spark.y = 170;
    spark.shield = 2;
    engine.physicsTick(1 / 60);
    spark.y = 150;
    engine.physicsTick(1 / 60);

    expect(engine.getSparkState().shield).toBe(1);
    expect(engine.getSparkState().combo).toBe(1);
    expect(callbacks.onNearMiss).not.toHaveBeenCalled();
    expect(callbacks.onDangerProximity).toHaveBeenLastCalledWith(false);
  });

  test('should pull collectible cores when within magnet range', () => {
    const map = engine.getMapData() as any;
    map.cores = [
      { id: 'core_test', x: 120, y: 200, radius: 3.5, collected: false },
    ];

    const spark = engine.getSparkState() as any;
    spark.x = 100;
    spark.y = 200;

    engine.physicsTick(1 / 60);

    const core = map.cores[0];
    expect(core.x).toBeLessThan(120);
  });

  test('magnet pull is independent of collision substep count and collects once', () => {
    const outcomes: Array<{ x: number; collected: number; score: number }> = [];
    const map = engine.getMapData() as any;
    const spark = engine.getSparkState() as any;

    for (const subSteps of [1, 2, 4, 8]) {
      engine.initializeLevel();
      engine.setGamePhase(GamePhase.FLYING);
      expect(engine.setSubSteps(subSteps)).toBe(true);
      map.upperWallSpline = [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
      ];
      map.lowerWallSpline = [
        { x: 0, y: 400 },
        { x: 200, y: 400 },
      ];
      map.cores = [
        { id: 'crossing-core', x: 130, y: 200, radius: 3.5, collected: false },
      ];
      spark.x = 100;
      spark.y = 200;
      spark.vx = 12;
      spark.vy = 0;

      engine.physicsTick(1 / 60);
      outcomes.push({
        x: map.cores[0].x,
        collected: spark.collectedInRun,
        score: spark.score,
      });
    }

    for (const outcome of outcomes.slice(1)) {
      expect(outcome.x).toBeCloseTo(outcomes[0].x);
      expect(outcome.collected).toBe(1);
      expect(outcome.score).toBe(150);
    }
  });

  test('stationary attraction preserves the four-sample pull and zero-distance pickup', () => {
    const map = engine.getMapData() as any;
    const spark = engine.getSparkState() as any;
    map.upperWallSpline = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ];
    map.lowerWallSpline = [
      { x: 0, y: 400 },
      { x: 200, y: 400 },
    ];
    map.cores = [
      { id: 'stationary', x: 120, y: 200, radius: 3.5, collected: false },
      { id: 'zero-distance', x: 100, y: 200, radius: 3.5, collected: false },
    ];
    spark.x = 100;
    spark.y = 200;
    spark.vx = 0;
    spark.vy = 0;

    engine.physicsTick(1 / 60);

    const p = 0.15 * (1 - 20 / 40);
    const alpha = 1 - (1 - p) ** 4;
    expect(map.cores[0].x).toBeCloseTo(120 + (100 - 120) * alpha);
    expect(map.cores[1].collected).toBe(true);
    expect(spark.collectedInRun).toBe(1);
    expect(spark.score).toBe(150);
  });

  test('nonfinite core coordinates are ignored safely', () => {
    const map = engine.getMapData() as any;
    map.cores = [
      { id: 'invalid', x: Number.NaN, y: 200, radius: 3.5, collected: false },
    ];

    expect(() => engine.physicsTick(1 / 60)).not.toThrow();
    expect(map.cores.some((core: any) => core.collected)).toBe(false);
    expect(engine.getSparkState().collectedInRun).toBe(0);
  });

  test('should not crash or tether when nodes map is empty', () => {
    const map = engine.getMapData() as any;
    map.nodes = [];

    engine.acquireTether();
    expect(engine.getSparkState().flightState).toBe(FlightState.LINEAR);
    expect(callbacks.onLog).toHaveBeenCalledWith(
      expect.stringContaining('tether limits'),
      'warn',
    );
  });

  test('should do nothing on releaseTether when already in LINEAR mode', () => {
    const spark = engine.getSparkState() as any;
    spark.flightState = FlightState.LINEAR;

    engine.releaseTether();
    expect(callbacks.onTetherReleased).not.toHaveBeenCalled();
  });

  test('should reset velocity to forward baseSpeed on wall bounce', () => {
    const spark = engine.getSparkState() as any;
    spark.shield = 3;
    spark.maxShield = 3;

    const map = engine.getMapData() as any;
    map.upperWallSpline = [
      { x: 0, y: 150 },
      { x: 100, y: 150 },
    ];
    map.lowerWallSpline = [
      { x: 0, y: 350 },
      { x: 100, y: 350 },
    ];

    spark.x = 100;
    spark.y = 120;
    spark.vx = -10;
    spark.vy = -5;

    engine.physicsTick(1 / 60);

    expect(spark.vx).toBe(engine.getConfig().baseSpeed);
    expect(spark.vy).toBe(0);
  });

  test('should reset trail buffer on sector leap', () => {
    const spark = engine.getSparkState() as any;
    engine.physicsTick(1 / 60);
    expect(engine.getTrail().length).toBeGreaterThan(0);

    spark.x = 9999;
    spark.vx = 10;
    spark.vy = 0;

    engine.physicsTick(1 / 60);

    expect(engine.getSectorIndex()).toBe(2);
    expect(engine.getTrail().length).toBe(1);
    expect(engine.getTrail().points[0]).toEqual({ x: spark.x, y: spark.y });
  });

  test('should increase current shield when maxShield increases during syncUpgrades', () => {
    const spark = engine.getSparkState() as any;
    spark.shield = 1;
    spark.maxShield = 1;

    engine.syncUpgrades({ shield: 2, magnet: 1, tether: 1 });

    expect(spark.maxShield).toBe(2);
    expect(spark.shield).toBe(2);
  });

  test('should emit a Standard run result when the run crashes', () => {
    const spark = engine.getSparkState() as any;
    spark.shield = 1;
    spark.score = 150.5;

    const map = engine.getMapData() as any;
    map.upperWallSpline = [
      { x: 0, y: 150 },
      { x: 100, y: 150 },
    ];
    map.lowerWallSpline = [
      { x: 0, y: 350 },
      { x: 100, y: 350 },
    ];
    map.cores = [
      { id: 'crash-core', x: 100, y: 200, radius: 3.5, collected: false },
    ];

    spark.x = 100;
    spark.y = 120;

    engine.physicsTick(1 / 60);

    expect(callbacks.onRunEnded).toHaveBeenCalledWith({
      context: { mode: 'STANDARD' },
      score: 150,
      sectorReached: 1,
      collectedCores: 0,
      x: expect.any(Number),
      y: expect.any(Number),
    });

    const scoreAfterCrash = spark.score;
    const scoreEventsAfterCrash = vi.mocked(callbacks.onScoreChanged).mock.calls
      .length;
    for (let i = 0; i < 5; i++) engine.physicsTick(1 / 60);

    expect(engine.getGamePhase()).toBe(GamePhase.CRASHED);
    expect(callbacks.onRunEnded).toHaveBeenCalledTimes(1);
    expect(callbacks.onCoreCollected).not.toHaveBeenCalled();
    expect(callbacks.onSectorLeap).not.toHaveBeenCalled();
    expect(vi.mocked(callbacks.onScoreChanged)).toHaveBeenCalledTimes(
      scoreEventsAfterCrash,
    );
    expect(spark.score).toBe(scoreAfterCrash);
    expect(map.cores[0].collected).toBe(false);
  });

  test('standard run crashes do not update the daily best', () => {
    const spark = engine.getSparkState() as any;
    spark.shield = 1;
    spark.score = 150;

    const map = engine.getMapData() as any;
    map.upperWallSpline = [
      { x: 0, y: 150 },
      { x: 100, y: 150 },
    ];
    map.lowerWallSpline = [
      { x: 0, y: 350 },
      { x: 100, y: 350 },
    ];
    spark.x = 100;
    spark.y = 120;

    engine.physicsTick(1 / 60);

    expect(saveState.getDailyChallengeBest('2026-10-06', 1)).toBe(0);
    expect(callbacks.onRunEnded).toHaveBeenCalledTimes(1);
  });

  test('Daily run results retain their challenge identity', () => {
    const context = {
      mode: 'DAILY' as const,
      challengeId: '2026-10-06',
      rulesVersion: 1,
    };
    engine.initializeLevel(context);
    engine.setGamePhase(GamePhase.FLYING);
    const spark = engine.getSparkState() as any;
    spark.shield = 1;
    spark.score = 210;
    spark.x = 100;
    spark.y = 120;
    const map = engine.getMapData() as any;
    map.upperWallSpline = [
      { x: 0, y: 150 },
      { x: 100, y: 150 },
    ];
    map.lowerWallSpline = [
      { x: 0, y: 350 },
      { x: 100, y: 350 },
    ];

    engine.physicsTick(1 / 60);

    expect(callbacks.onRunEnded).toHaveBeenCalledWith(
      expect.objectContaining({ context, score: 210 }),
    );
    expect(
      saveState.getDailyChallengeBest(
        context.challengeId,
        context.rulesVersion,
      ),
    ).toBe(0);
  });

  test('Daily initial and extension geometry ignore upgrades and calibration', () => {
    const context = {
      mode: 'DAILY' as const,
      challengeId: '2026-10-06',
      rulesVersion: 1,
    };
    const upgradedLevels = { shield: 10, magnet: 9, tether: 8 };
    engine.initializeLevel(context, upgradedLevels);
    const initial = JSON.stringify(engine.getMapData());
    const config = engine.getConfig();
    const extendMap = () => {
      engine.initializeLevel(context);
      engine.setGamePhase(GamePhase.FLYING);
      const spark = engine.getSparkState() as any;
      spark.x = 9999;
      spark.vx = 10;
      spark.vy = 0;
      engine.physicsTick(1 / 60);
      return JSON.stringify(engine.getMapData());
    };
    const replay = () => {
      engine.initializeLevel(context);
      engine.setGamePhase(GamePhase.FLYING);
      const map = engine.getMapData() as any;
      map.nodes = [{ id: 'daily-test-anchor', x: 180, y: 200, radius: 20 }];
      const spark = engine.getSparkState() as any;
      spark.x = 100;
      spark.y = 200;
      spark.vx = 6;
      spark.vy = 0;
      engine.acquireTether();
      for (let i = 0; i < 12; i++) engine.physicsTick(1 / 60);
      engine.releaseTether();
      for (let i = 0; i < 10; i++) engine.physicsTick(1 / 60);
      const state = engine.getSparkState();
      return JSON.stringify({
        x: state.x,
        y: state.y,
        vx: state.vx,
        vy: state.vy,
        score: state.score,
        combo: state.combo,
        collected: state.collectedInRun,
      });
    };
    const extension = extendMap();
    const firstReplay = replay();

    engine.syncUpgrades(upgradedLevels);
    engine.updateCalibration({
      subSteppingEnabled: false,
      safetyGapsEnabled: false,
      collinearFallbackEnabled: false,
    });
    expect(engine.setBaseSpeed(15)).toBe(false);
    expect(engine.setSubSteps(1)).toBe(false);
    expect(engine.setHazardProximityBuffer(60)).toBe(false);

    engine.initializeLevel(context, upgradedLevels);
    expect(JSON.stringify(engine.getMapData())).toBe(initial);
    expect(extendMap()).toBe(extension);
    expect(replay()).toBe(firstReplay);
    expect(engine.getConfig()).toMatchObject(config);
    expect(engine.getConfig().maxTetherRadius).toBe(180);
    expect(engine.getSparkState().maxShield).toBe(1);
  });

  test('Daily anchor acquisition ignores pointer aim and breaks ties by stable id', () => {
    engine.initializeLevel({
      mode: 'DAILY',
      challengeId: '2026-10-06',
      rulesVersion: 1,
    });
    engine.setGamePhase(GamePhase.FLYING);
    const map = engine.getMapData() as any;
    map.nodes = [
      { id: 'node_b', x: 200, y: 200, radius: 20 },
      { id: 'node_a', x: 200, y: 200, radius: 20 },
    ];
    const spark = engine.getSparkState() as any;
    spark.x = 100;
    spark.y = 200;
    spark.vx = 6;
    spark.vy = 0;

    engine.acquireTether(500, 350);

    expect(engine.getSparkState().orbitalNodeId).toBe('node_a');
    expect(callbacks.onTetherAcquired).toHaveBeenCalledWith('node_a');
  });

  test('getConfig returns a copy and validated setting setters reject invalid values', () => {
    const configCopy = engine.getConfig();
    configCopy.subSteps = 9;
    configCopy.hazardProximityBuffer = 60;
    expect(engine.getConfig().subSteps).toBe(4);
    expect(engine.getConfig().hazardProximityBuffer).toBe(30);
    expect(engine.setSubSteps(0)).toBe(false);
    expect(engine.setSubSteps(11)).toBe(false);
    expect(engine.setHazardProximityBuffer(Number.NaN)).toBe(false);
    expect(engine.getConfig().subSteps).toBe(4);
  });

  test('sector cooldown advances on simulation time and freezes while paused', () => {
    const spark = engine.getSparkState() as any;
    // This test covers cooldown bookkeeping only. Wall layouts are generated
    // from an unseeded RNG, so a stray hull impact (or a full shield drain that
    // crashes the run and stops physicsTick) used to make the outcome random.
    // An indestructible spark removes that unrelated variable.
    spark.maxShield = Number.MAX_SAFE_INTEGER;
    spark.shield = Number.MAX_SAFE_INTEGER;

    spark.x = 9999;
    spark.vx = 10;
    spark.vy = 0;
    engine.physicsTick(1 / 60);
    expect(engine.getSectorIndex()).toBe(2);

    spark.x = 19999;
    engine.physicsTick(1 / 60);
    expect(engine.getSectorIndex()).toBe(2);

    engine.setGamePhase(GamePhase.PAUSED);
    for (let i = 0; i < 180; i++) engine.physicsTick(1 / 60);
    expect(engine.getSectorIndex()).toBe(2);
    engine.setGamePhase(GamePhase.FLYING);
    engine.physicsTick(1 / 60);
    expect(engine.getSectorIndex()).toBe(2);

    for (let i = 0; i < 120; i++) engine.physicsTick(1 / 60);
    expect(engine.getSectorIndex()).toBe(3);
  });

  // --- Touch / pointer control path (tap-coordinate tether acquisition) ---

  test('should acquire tether on node tapped within proximity radius (touch path)', () => {
    const map = engine.getMapData() as any;
    map.nodes = [{ id: 'node_tap', x: 250, y: 200, radius: 20 }];

    const spark = engine.getSparkState() as any;
    spark.x = 100;
    spark.y = 200;
    spark.vx = 6;
    spark.vy = 0;

    // Tap at (240, 200): within 80px of node, node within 180px of player
    engine.acquireTether(240, 200);

    expect(engine.getSparkState().flightState).toBe(FlightState.ORBITAL);
    expect(engine.getSparkState().orbitalNodeId).toBe('node_tap');
    expect(callbacks.onTetherAcquired).toHaveBeenCalledWith('node_tap');
  });

  test('should not tether when tapped node is beyond maxTetherRadius from player', () => {
    const map = engine.getMapData() as any;
    map.nodes = [{ id: 'node_far', x: 400, y: 200, radius: 20 }];

    const spark = engine.getSparkState() as any;
    spark.x = 100;
    spark.y = 200;

    engine.acquireTether(390, 200);

    expect(engine.getSparkState().flightState).toBe(FlightState.LINEAR);
    expect(callbacks.onTetherAcquired).not.toHaveBeenCalled();
    expect(callbacks.onLog).toHaveBeenCalledWith(
      expect.stringContaining('outside tether limits'),
      'warn',
    );
  });

  test('should fall back to player-proximity node when tap is far from all nodes', () => {
    const map = engine.getMapData() as any;
    map.nodes = [{ id: 'node_near_player', x: 250, y: 200, radius: 20 }];

    const spark = engine.getSparkState() as any;
    spark.x = 100;
    spark.y = 200;

    // Tap at (600, 50) is >80px from the only node
    engine.acquireTether(600, 50);

    expect(engine.getSparkState().flightState).toBe(FlightState.ORBITAL);
    expect(engine.getSparkState().orbitalNodeId).toBe('node_near_player');
  });

  test('should prefer tapped node over closer player-proximity node', () => {
    const map = engine.getMapData() as any;
    map.nodes = [
      { id: 'node_close', x: 200, y: 200, radius: 20 },
      { id: 'node_tapped', x: 260, y: 210, radius: 20 },
    ];

    const spark = engine.getSparkState() as any;
    spark.x = 100;
    spark.y = 200;

    engine.acquireTether(255, 205);

    expect(engine.getSparkState().orbitalNodeId).toBe('node_tapped');
  });

  // --- Pause gating ---

  test('should ignore tether acquisition while paused', () => {
    engine.setGamePhase(GamePhase.PAUSED);
    const map = engine.getMapData() as any;
    map.nodes = [{ id: 'node_test', x: 200, y: 200, radius: 20 }];

    engine.acquireTether();

    expect(engine.getSparkState().flightState).toBe(FlightState.LINEAR);
    expect(callbacks.onTetherAcquired).not.toHaveBeenCalled();
  });

  test('should ignore tether acquisition while crashed', () => {
    engine.setGamePhase(GamePhase.CRASHED);
    engine.acquireTether();
    expect(callbacks.onTetherAcquired).not.toHaveBeenCalled();
  });

  test('should ignore tether acquisition on splash screen', () => {
    engine.setGamePhase(GamePhase.SPLASH);
    engine.acquireTether();
    expect(callbacks.onTetherAcquired).not.toHaveBeenCalled();
  });

  test('should track game phase transitions', () => {
    engine.setGamePhase(GamePhase.PAUSED);
    expect(engine.getGamePhase()).toBe(GamePhase.PAUSED);
    engine.setGamePhase(GamePhase.FLYING);
    expect(engine.getGamePhase()).toBe(GamePhase.FLYING);
  });

  // --- Calibration control surface ---

  test('should update base speed and rescale linear velocity', () => {
    engine.setBaseSpeed(12);
    expect(engine.getConfig().baseSpeed).toBe(12);
    expect(engine.getSparkState().vx).toBe(12);
    expect(engine.getSparkState().vy).toBe(0);
  });

  // --- Persistence integration ---

  test('should persist totalCores to save state when a core is collected', () => {
    const map = engine.getMapData() as any;
    map.cores = [
      { id: 'core_1', x: 105, y: 200, radius: 3.5, collected: false },
    ];

    const spark = engine.getSparkState() as any;
    spark.x = 100;
    spark.y = 200;

    engine.physicsTick(1 / 60);

    expect(map.cores[0].collected).toBe(true);
    expect(engine.getSparkState().collectedInRun).toBe(1);
    expect(callbacks.onCoreCollected).toHaveBeenCalledTimes(1);
    expect(saveState.totalCores).toBe(0);
  });

  // --- Repeat play (crash -> retry -> fresh run) ---

  test('should fully reset run state on initializeLevel for repeat play', () => {
    const spark = engine.getSparkState() as any;
    spark.score = 5000;
    spark.combo = 4;
    spark.collectedInRun = 7;
    spark.shield = 0;
    spark.x = 5000;
    spark.y = 300;
    engine.setGamePhase(GamePhase.CRASHED);

    engine.initializeLevel();

    expect(engine.getGamePhase()).toBe(GamePhase.SPLASH);
    expect(engine.getSparkState().score).toBe(0);
    expect(engine.getSparkState().combo).toBe(1);
    expect(engine.getSparkState().collectedInRun).toBe(0);
    expect(engine.getSparkState().x).toBe(100);
    expect(engine.getSparkState().y).toBe(200);
    expect(engine.getSparkState().flightState).toBe(FlightState.LINEAR);
    expect(engine.getSectorIndex()).toBe(1);
    expect(engine.getRunDistance()).toBe(0);
    expect(engine.getTrail().length).toBe(0);
    expect(engine.getSparkState().shield).toBe(
      engine.getSparkState().maxShield,
    );
  });

  test('should re-enable controls after restart following a crash', () => {
    const spark = engine.getSparkState() as any;
    spark.shield = 1;

    const map = engine.getMapData() as any;
    map.upperWallSpline = [
      { x: 0, y: 150 },
      { x: 100, y: 150 },
    ];
    map.lowerWallSpline = [
      { x: 0, y: 350 },
      { x: 100, y: 350 },
    ];
    spark.x = 100;
    spark.y = 120;

    engine.physicsTick(1 / 60);
    expect(engine.getGamePhase()).toBe(GamePhase.CRASHED);

    // Retry flow: re-initialize and resume
    engine.initializeLevel();
    engine.setGamePhase(GamePhase.FLYING);

    const freshMap = engine.getMapData() as any;
    freshMap.nodes = [{ id: 'node_test', x: 200, y: 200, radius: 20 }];
    engine.acquireTether();

    expect(engine.getSparkState().flightState).toBe(FlightState.ORBITAL);
    expect(callbacks.onTetherAcquired).toHaveBeenCalled();
  });
});
