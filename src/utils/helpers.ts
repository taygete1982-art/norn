// Utility helpers
import { Application } from 'pixi.js';

/**
 * Get logical resolution from hardware scaling
 */
export function getLogicalResolution(): number {
  const screenScale =
    (window.screen as Screen & { devicePixelRatio?: number }).devicePixelRatio ?? 1;
  return window.devicePixelRatio * screenScale || 2;
}

/**
 * Round coordinates to nearest pixel
 */
export function roundPixel(x: number, y: number): [number, number] {
  return [Math.round(x), Math.round(y)];
}

/**
 * Create a pixel-art rectangle
 */
export function createPixelRect(
  x: number,
  y: number,
  width: number,
  height: number,
  color: number
): { x: number; y: number; width: number; height: number; color: number } {
  return { x, y, width, height, color };
}
