import { describe, test, expect, beforeEach } from 'vitest';
import { WorldGenerator } from '../src/world/generator';
import { MapData } from '../src/types';

describe('WorldGenerator', () => {
  let map: MapData;
  let cursor: ReturnType<typeof WorldGenerator.createCursor>;
  const config = { maxTetherRadius: 180, hazardProximityBuffer: 30 };

  beforeEach(() => {
    map = {
      nodes: [],
      cores: [],
      upperWallSpline: [],
      lowerWallSpline: [],
    };
    cursor = WorldGenerator.createCursor();
  });

  test('should procedurally append data correctly', () => {
    WorldGenerator.appendSegmentData(map, cursor, 5, config, false);

    expect(map.nodes.length).toBe(5);
    expect(map.cores.length).toBeGreaterThanOrEqual(10);
    expect(map.upperWallSpline.length).toBeGreaterThan(0);
    expect(map.lowerWallSpline.length).toBeGreaterThan(0);
    expect(map.upperWallSpline.length).toBe(map.lowerWallSpline.length);
  });

  test('keeps anchor gaps and wall samples continuous across appends', () => {
    const constantRandom = () => 0.5;
    WorldGenerator.appendSegmentData(
      map,
      cursor,
      5,
      config,
      false,
      constantRandom,
    );
    WorldGenerator.appendSegmentData(
      map,
      cursor,
      5,
      config,
      false,
      constantRandom,
    );

    for (let i = 1; i < map.nodes.length; i++) {
      const gap = map.nodes[i].x - map.nodes[i - 1].x;
      expect(gap).toBeGreaterThanOrEqual(250);
      expect(gap).toBeLessThanOrEqual(350);
    }
    expect(map.upperWallSpline).toHaveLength(map.lowerWallSpline.length);
    for (let i = 1; i < map.upperWallSpline.length; i++) {
      expect(map.upperWallSpline[i].x - map.upperWallSpline[i - 1].x).toBe(20);
    }
  });

  test('keeps identifiers monotonic across culling and further generation', () => {
    WorldGenerator.appendSegmentData(map, cursor, 5, config, false, () => 0.5);
    WorldGenerator.cullBehindCamera(map, 1000);
    WorldGenerator.appendSegmentData(map, cursor, 5, config, false, () => 0.5);
    const nodeIds = map.nodes.map((node) => node.id);
    const coreIds = map.cores.map((core) => core.id);
    expect(new Set(nodeIds).size).toBe(nodeIds.length);
    expect(new Set(coreIds).size).toBe(coreIds.length);
    expect(new Set(map.upperWallSpline.map((point) => point.x)).size).toBe(
      map.upperWallSpline.length,
    );
  });

  test('should interpolate wall boundaries correctly', () => {
    map.upperWallSpline = [
      { x: 0, y: 50 },
      { x: 20, y: 70 },
      { x: 40, y: 60 },
    ];
    map.lowerWallSpline = [
      { x: 0, y: 350 },
      { x: 20, y: 330 },
      { x: 40, y: 340 },
    ];

    const bounds0 = WorldGenerator.getWallBoundaries(map, 0);
    expect(bounds0.upperY).toBe(50);
    expect(bounds0.lowerY).toBe(350);

    const bounds20 = WorldGenerator.getWallBoundaries(map, 20);
    expect(bounds20.upperY).toBe(70);
    expect(bounds20.lowerY).toBe(330);

    const bounds10 = WorldGenerator.getWallBoundaries(map, 10);
    expect(bounds10.upperY).toBe(60);
    expect(bounds10.lowerY).toBe(340);

    const boundsNeg = WorldGenerator.getWallBoundaries(map, -10);
    expect(boundsNeg.upperY).toBe(50);

    const boundsOver = WorldGenerator.getWallBoundaries(map, 50);
    expect(boundsOver.upperY).toBe(60);
  });

  test('should support interpolation after culling offsets shift starting coordinate', () => {
    map.upperWallSpline = [
      { x: 100, y: 50 },
      { x: 120, y: 70 },
    ];
    map.lowerWallSpline = [
      { x: 100, y: 350 },
      { x: 120, y: 330 },
    ];

    const bounds110 = WorldGenerator.getWallBoundaries(map, 110);
    expect(bounds110.upperY).toBe(60);
    expect(bounds110.lowerY).toBe(340);
  });

  test('should cull elements behind camera threshold', () => {
    map.nodes = [
      { id: 'node_1', x: 50, y: 200, radius: 20 },
      { id: 'node_2', x: 150, y: 200, radius: 20 },
    ];
    map.cores = [
      { id: 'core_1', x: 30, y: 200, radius: 3.5, collected: false },
      { id: 'core_2', x: 120, y: 200, radius: 3.5, collected: false },
    ];
    map.upperWallSpline = [
      { x: 40, y: 50 },
      { x: 140, y: 50 },
    ];
    map.lowerWallSpline = [
      { x: 40, y: 350 },
      { x: 140, y: 350 },
    ];

    WorldGenerator.cullBehindCamera(map, 100);

    expect(map.nodes.length).toBe(1);
    expect(map.nodes[0].id).toBe('node_2');

    expect(map.cores.length).toBe(1);
    expect(map.cores[0].id).toBe('core_2');

    expect(map.upperWallSpline.length).toBe(1);
    expect(map.upperWallSpline[0].x).toBe(140);
  });

  test('should clear all elements when all are behind threshold', () => {
    map.nodes = [{ id: 'node_1', x: 50, y: 200, radius: 20 }];
    map.cores = [
      { id: 'core_1', x: 30, y: 200, radius: 3.5, collected: false },
    ];
    map.upperWallSpline = [{ x: 40, y: 50 }];
    map.lowerWallSpline = [{ x: 40, y: 350 }];

    WorldGenerator.cullBehindCamera(map, 100);

    expect(map.nodes.length).toBe(0);
    expect(map.cores.length).toBe(0);
    expect(map.upperWallSpline.length).toBe(0);
    expect(map.lowerWallSpline.length).toBe(0);
  });
});
