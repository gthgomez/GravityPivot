import { expect, test } from 'vitest';
import { SeededRandom } from '../../src/utils/seededRandom';
import { MapData } from '../../src/types';
import { WorldGenerator } from '../../src/world/generator';

test('10,000 seeds remain structurally valid over append and cull cycles', () => {
  const config = { maxTetherRadius: 180, hazardProximityBuffer: 30 };
  for (let seed = 1; seed <= 10_000; seed++) {
    const random = new SeededRandom(seed);
    const map: MapData = {
      nodes: [],
      cores: [],
      upperWallSpline: [],
      lowerWallSpline: [],
    };
    const cursor = WorldGenerator.createCursor();
    const ids = new Set<string>();

    for (let appendIndex = 0; appendIndex < 4; appendIndex++) {
      WorldGenerator.appendSegmentData(
        map,
        cursor,
        5,
        config,
        appendIndex % 2 === 0,
        () => random.next(),
      );
      WorldGenerator.cullBehindCamera(map, cursor.lastAnchorX - 500);

      const context = `seed=${seed}, appendIndex=${appendIndex}`;
      let valid = map.upperWallSpline.length === map.lowerWallSpline.length;
      for (let i = 1; i < map.nodes.length; i++) {
        const gap = map.nodes[i].x - map.nodes[i - 1].x;
        valid &&= gap >= 250 && gap <= 350;
      }
      for (let i = 0; i < map.upperWallSpline.length; i++) {
        const upper = map.upperWallSpline[i];
        const lower = map.lowerWallSpline[i];
        valid &&= Number.isFinite(upper.x) && Number.isFinite(upper.y);
        valid &&= Number.isFinite(lower.x) && Number.isFinite(lower.y);
        valid &&= lower.y - upper.y >= 180;
        if (i > 0) valid &&= upper.x - map.upperWallSpline[i - 1].x === 20;
      }
      for (const node of map.nodes) {
        valid &&= !ids.has(node.id);
        ids.add(node.id);
      }
      for (const core of map.cores) {
        valid &&= !ids.has(core.id);
        ids.add(core.id);
      }
      expect(valid, context).toBe(true);
    }
  }
}, 120_000);
