import { describe, test, expect, beforeEach, vi } from 'vitest';
import { GravityPivotEngine } from '../src/engine/engine';
import { GameSaveState } from '../src/state/saveState';
import { EngineCallbacks, CalibrationState } from '../src/types';
import { FlightState, GamePhase } from '../src/constants';

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
        setItem: (key: string, value: string) => { store[key] = value; }
      },
      writable: true,
      configurable: true
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
      onCrash: vi.fn(),
      onTetherAcquired: vi.fn(),
      onTetherReleased: vi.fn(),
      onTelemetryUpdate: vi.fn(),
      onLog: vi.fn()
    };

    calibration = {
      subSteppingEnabled: true,
      safetyGapsEnabled: false,
      collinearFallbackEnabled: true
    };

    engine = new GravityPivotEngine(saveState, callbacks, calibration);
    engine.setGamePhase(GamePhase.FLYING);
  });

  test('should initialize correctly', () => {
    expect(engine.getSparkState().x).toBe(100);
    expect(engine.getSparkState().y).toBe(200);
    expect(engine.getSparkState().flightState).toBe(FlightState.LINEAR);
    expect(engine.getSectorIndex()).toBe(1);
    expect(engine.getRunDistance()).toBe(0);
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
    map.nodes = [
      { id: 'node_test', x: 200, y: 200, radius: 20 }
    ];

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
      { x: 200, y: 150 }
    ];
    map.lowerWallSpline = [
      { x: 0, y: 350 },
      { x: 100, y: 350 },
      { x: 200, y: 350 }
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
      { x: 100, y: 150 }
    ];
    map.lowerWallSpline = [
      { x: 0, y: 350 },
      { x: 100, y: 350 }
    ];

    spark.x = 100;
    spark.y = 120;

    engine.physicsTick(1 / 60);

    expect(engine.getSparkState().shield).toBe(0);
    expect(engine.getGamePhase()).toBe(GamePhase.CRASHED);
    expect(callbacks.onCrash).toHaveBeenCalled();
  });

  test('should trigger sector leap when crossing sectorDistance boundary', () => {
    const spark = engine.getSparkState() as any;
    spark.x = 9999;
    spark.vx = 10;
    spark.vy = 0;

    engine.physicsTick(1 / 60);

    expect(engine.getSectorIndex()).toBe(2);
    expect(callbacks.onSectorLeap).toHaveBeenCalledWith(2);
  });

  test('should trigger near-miss combo scoring & bonus application', () => {
    const spark = engine.getSparkState() as any;
    const map = engine.getMapData() as any;
    map.upperWallSpline = [
      { x: 0, y: 150 },
      { x: 100, y: 150 },
      { x: 200, y: 150 }
    ];
    map.lowerWallSpline = [
      { x: 0, y: 350 },
      { x: 100, y: 350 },
      { x: 200, y: 350 }
    ];

    spark.x = 20;
    spark.y = 170;

    engine.physicsTick(1 / 60);
    expect(callbacks.onDangerProximity).toHaveBeenCalledWith(true);

    spark.x = 30;
    spark.y = 250;

    engine.physicsTick(1 / 60);
    expect(callbacks.onDangerProximity).toHaveBeenCalledWith(false);
    expect(engine.getSparkState().combo).toBe(2);
    expect(callbacks.onNearMiss).toHaveBeenCalled();
  });

  test('should pull collectible cores when within magnet range', () => {
    const map = engine.getMapData() as any;
    map.cores = [
      { id: 'core_test', x: 120, y: 200, radius: 3.5, collected: false }
    ];

    const spark = engine.getSparkState() as any;
    spark.x = 100;
    spark.y = 200;

    engine.physicsTick(1 / 60);

    const core = map.cores[0];
    expect(core.x).toBeLessThan(120);
  });

  test('should not crash or tether when nodes map is empty', () => {
    const map = engine.getMapData() as any;
    map.nodes = [];

    engine.acquireTether();
    expect(engine.getSparkState().flightState).toBe(FlightState.LINEAR);
    expect(callbacks.onLog).toHaveBeenCalledWith(expect.stringContaining('tether limits'), 'warn');
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
      { x: 100, y: 150 }
    ];
    map.lowerWallSpline = [
      { x: 0, y: 350 },
      { x: 100, y: 350 }
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

    saveState.shieldLvl = 2;
    engine.syncUpgrades();

    expect(spark.maxShield).toBe(2);
    expect(spark.shield).toBe(2);
  });

  test('should trigger onCrash callback with finalScore and isNewHighScore details', () => {
    const spark = engine.getSparkState() as any;
    spark.shield = 1;
    spark.score = 150.5;

    const map = engine.getMapData() as any;
    map.upperWallSpline = [
      { x: 0, y: 150 },
      { x: 100, y: 150 }
    ];
    map.lowerWallSpline = [
      { x: 0, y: 350 },
      { x: 100, y: 350 }
    ];

    spark.x = 100;
    spark.y = 120;

    engine.physicsTick(1 / 60);

    expect(callbacks.onCrash).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      150,
      1,
      true,
      true,
      150
    );
  });
});
