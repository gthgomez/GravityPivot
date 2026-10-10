import { describe, expect, test } from 'vitest';
import {
  clientToWorld,
  createViewportTransform,
  worldToScreen,
} from '../src/renderer/viewport';

describe('shared canvas viewport transform', () => {
  test.each([1, 2, 3])('round trips pointer points at DPR %i', (dpr) => {
    const rect = { left: 37, top: 91, width: 390, height: 300 };
    const cameraX = -735;
    const viewport = createViewportTransform(
      rect.width,
      rect.height,
      dpr,
      cameraX,
    );
    expect(viewport).not.toBeNull();
    if (!viewport) return;

    for (const [worldX, worldY] of [
      [150, 10],
      [1200, 200],
      [2400, 390],
    ]) {
      const screen = worldToScreen(worldX, worldY, viewport);
      const point = clientToWorld(
        rect.left + screen.x * viewport.cssScale,
        rect.top + screen.y * viewport.cssScale,
        rect,
        viewport,
      );
      expect(point?.worldX).toBeCloseTo(worldX);
      expect(point?.worldY).toBeCloseTo(worldY);
    }
  });

  test('defers transforms for a zero-size hidden canvas', () => {
    expect(createViewportTransform(0, 300, 2, 0)).toBeNull();
    const viewport = createViewportTransform(390, 300, 2, 0);
    expect(
      clientToWorld(
        20,
        30,
        { left: 0, top: 0, width: 0, height: 300 },
        viewport!,
      ),
    ).toBeNull();
  });
});
