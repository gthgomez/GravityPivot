import { describe, expect, test } from 'vitest';
import { WorldGenerator } from '../../src/world/generator';
import { SeededRandom } from '../../src/utils/seededRandom';
import { MapData } from '../../src/types';
import { WORLD_VIEWPORT_CENTER } from '../../src/constants';

const config = { maxTetherRadius: 180, hazardProximityBuffer: 30 };

describe('procedural geometry invariants', () => {
  test.each([false, true])(
    'holds structural and clearance bounds for 1,000 seeds (safety=%s)',
    (safety) => {
      for (let seed = 1; seed <= 1000; seed++) {
        const random = new SeededRandom(seed);
        const map: MapData = {
          nodes: [],
          cores: [],
          upperWallSpline: [],
          lowerWallSpline: [],
        };
        const cursor = WorldGenerator.createCursor();
        WorldGenerator.appendSegmentData(map, cursor, 5, config, safety, () =>
          random.next(),
        );

        const failureContext = `seed=${seed}, safety=${safety}`;
        let valid = map.upperWallSpline.length === map.lowerWallSpline.length;
        valid &&= !WorldGenerator.checkWallCollision(
          map,
          100,
          WORLD_VIEWPORT_CENTER,
        );
        for (let i = 0; i < map.nodes.length; i++) {
          const node = map.nodes[i];
          valid &&= Number.isFinite(node.x) && Number.isFinite(node.y);
          if (i > 0) {
            const gap = node.x - map.nodes[i - 1].x;
            valid &&= gap >= 250 && gap <= 350;
          }
        }

        for (let i = 0; i < map.upperWallSpline.length; i++) {
          const upper = map.upperWallSpline[i];
          const lower = map.lowerWallSpline[i];
          valid &&=
            Number.isFinite(upper.x) &&
            Number.isFinite(upper.y) &&
            Number.isFinite(lower.y) &&
            lower.y - upper.y >= 180 &&
            upper.y >= 10 &&
            lower.y <= 390;
          if (i > 0) {
            valid &&= upper.x - map.upperWallSpline[i - 1].x === 20;
          }
        }

        for (const core of map.cores) {
          const bounds = WorldGenerator.getWallBoundaries(map, core.x);
          valid &&=
            core.y - core.radius + 1e-6 >= bounds.upperY &&
            core.y + core.radius - 1e-6 <= bounds.lowerY &&
            core.y - core.radius >= 0 &&
            core.y + core.radius <= 400;
        }
        expect(valid, failureContext).toBe(true);
      }
    },
    20_000,
  );
});
