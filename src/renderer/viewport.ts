import { WORLD_VIEWPORT_HEIGHT } from '../constants';

export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ViewportTransform {
  logicalWidth: number;
  logicalHeight: number;
  cssScale: number;
  dpr: number;
  cameraX: number;
}

export const PLAYER_SCREEN_X = 150;

export function cameraOffsetForSpark(sparkX: number): number {
  return Math.round(-sparkX + PLAYER_SCREEN_X);
}

export function createViewportTransform(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  cameraX: number,
): ViewportTransform | null {
  if (cssWidth <= 0 || cssHeight <= 0 || dpr <= 0) return null;
  const cssScale = cssHeight / WORLD_VIEWPORT_HEIGHT;
  return {
    logicalWidth: cssWidth / cssScale,
    logicalHeight: WORLD_VIEWPORT_HEIGHT,
    cssScale,
    dpr,
    cameraX,
  };
}

/** Returns coordinates in logical screen units (before CSS scale and DPR). */
export function worldToScreen(
  worldX: number,
  worldY: number,
  viewport: ViewportTransform,
): { x: number; y: number } {
  return { x: worldX + viewport.cameraX, y: worldY };
}

/** Converts a browser client point through the same scale and camera used by rendering. */
export function clientToWorld(
  clientX: number,
  clientY: number,
  rect: ViewportRect,
  viewport: ViewportTransform,
): { worldX: number; worldY: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    worldX: (clientX - rect.left) / viewport.cssScale - viewport.cameraX,
    worldY: (clientY - rect.top) / viewport.cssScale,
  };
}
