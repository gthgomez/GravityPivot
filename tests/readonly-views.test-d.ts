import { GravityPivotEngine } from '../src/engine/engine';

declare const engine: GravityPivotEngine;
const map = engine.getMapData();
const trail = engine.getTrail();

// @ts-expect-error Render callers cannot append to the engine-owned map.
map.nodes.push({ id: 'external', x: 0, y: 0, radius: 1 });
// @ts-expect-error Render callers cannot mutate nested map objects.
map.nodes[0].x = 0;
// @ts-expect-error Render callers cannot alter nested spline points.
map.upperWallSpline[0].y = 0;
// @ts-expect-error Render callers cannot mutate engine-owned trail storage.
trail.points[0].x = 0;
// @ts-expect-error Render callers cannot change the trail cursor.
trail.head = 0;
