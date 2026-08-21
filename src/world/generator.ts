import { MapData, WallBounds } from '../types';

export class WorldGenerator {
  private static readonly STEP_RESOLUTION = 20;

  /**
   * Procedurally appends nodes, cores, and wall splines to the map data.
   */
  public static appendSegmentData(
    map: MapData,
    startX: number,
    count: number,
    config: { maxTetherRadius: number; hazardProximityBuffer: number },
    guaranteeGaps: boolean,
    randomFn: () => number = Math.random
  ): void {
    let currentX = startX;
    const midY = 200;

    for (let i = 0; i < count; i++) {
      currentX += 250 + randomFn() * 100;
      const nodeY = midY + (randomFn() * 120 - 60);
      
      map.nodes.push({
        id: `node_${map.nodes.length}_${randomFn().toString(36).substring(2, 7)}`,
        x: currentX,
        y: nodeY,
        radius: 18 + randomFn() * 6
      });

      const coreCount = 2 + Math.floor(randomFn() * 3);
      for (let c = 0; c < coreCount; c++) {
        const angle = randomFn() * Math.PI * 2;
        const dist = 60 + randomFn() * 60;
        map.cores.push({
          id: `core_${map.cores.length}_${c}`,
          x: currentX + Math.cos(angle) * dist,
          y: nodeY + Math.sin(angle) * dist,
          radius: 3.5,
          collected: false
        });
      }
    }

    let sampleX = startX;
    while (sampleX < currentX + 800) {
      // Find nearest nodes using all active nodes
      const activeNodes = map.nodes;
      if (activeNodes.length === 0) {
        sampleX += this.STEP_RESOLUTION;
        continue;
      }
      
      const closestNode = activeNodes.reduce((prev, curr) =>
        Math.abs(curr.x - sampleX) < Math.abs(prev.x - sampleX) ? curr : prev
      );

      let safetyEnvelope = config.maxTetherRadius;
      if (guaranteeGaps) {
        safetyEnvelope = config.maxTetherRadius + config.hazardProximityBuffer + 30;
      } else {
        safetyEnvelope = 110;
      }

      const waveUpper = Math.sin(sampleX * 0.015) * 20;
      const waveLower = Math.cos(sampleX * 0.015) * 20;

      map.upperWallSpline.push({
        x: sampleX,
        y: Math.max(10, closestNode.y - safetyEnvelope + waveUpper)
      });
      map.lowerWallSpline.push({
        x: sampleX,
        y: Math.min(390, closestNode.y + safetyEnvelope + waveLower)
      });

      sampleX += this.STEP_RESOLUTION;
    }
  }

  /**
   * Interpolates the upper and lower wall boundaries for a given x coordinate.
   * Handles offset adjustment due to culled/sliced starting elements.
   */
  public static getWallBoundaries(map: MapData, x: number): WallBounds {
    if (map.upperWallSpline.length === 0) {
      return { upperY: 50, lowerY: 350 };
    }

    const startX = map.upperWallSpline[0].x;
    const exactIndex = (x - startX) / this.STEP_RESOLUTION;
    const indexA = Math.floor(exactIndex);
    const indexB = indexA + 1;
    const maxLen = map.upperWallSpline.length;

    if (indexA < 0) {
      return {
        upperY: map.upperWallSpline[0].y,
        lowerY: map.lowerWallSpline[0].y
      };
    }
    if (indexB >= maxLen) {
      const lastIdx = maxLen - 1;
      return {
        upperY: map.upperWallSpline[lastIdx].y,
        lowerY: map.lowerWallSpline[lastIdx].y
      };
    }

    const t = exactIndex - indexA;
    const ptA_u = map.upperWallSpline[indexA];
    const ptB_u = map.upperWallSpline[indexB];
    const ptA_l = map.lowerWallSpline[indexA];
    const ptB_l = map.lowerWallSpline[indexB];

    const upperY = ptA_u.y * (1 - t) + ptB_u.y * t;
    const lowerY = ptA_l.y * (1 - t) + ptB_l.y * t;

    return { upperY, lowerY };
  }

  /**
   * Checks if the given coordinates represent a wall collision.
   */
  public static checkWallCollision(map: MapData, x: number, y: number): boolean {
    const { upperY, lowerY } = this.getWallBoundaries(map, x);
    return y <= upperY || y >= lowerY;
  }

  /**
   * Culls old map elements behind the threshold to maintain a small memory footprint.
   */
  public static cullBehindCamera(map: MapData, thresholdX: number): void {
    // Cull old nodes
    map.nodes = map.nodes.filter(node => node.x >= thresholdX);

    // Cull old cores
    map.cores = map.cores.filter(core => core.x >= thresholdX);

    // Cull spline boundaries
    const firstKeepIndex = map.upperWallSpline.findIndex(pt => pt.x >= thresholdX);
    if (firstKeepIndex > 0) {
      map.upperWallSpline.splice(0, firstKeepIndex);
      map.lowerWallSpline.splice(0, firstKeepIndex);
    } else if (firstKeepIndex === -1 && map.upperWallSpline.length > 0) {
      map.upperWallSpline.length = 0;
      map.lowerWallSpline.length = 0;
    }
  }
}
