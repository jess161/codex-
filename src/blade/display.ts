export const MAX_CANVAS_PIXELS = 8_000_000;
export function displayProfile(width: number, height: number, deviceRatio = 1, simplified = false) {
  const cssWidth = Math.max(1, width), cssHeight = Math.max(1, height);
  const ratio = Math.min(Math.max(1, deviceRatio || 1), simplified ? 1.5 : 3, Math.sqrt(MAX_CANVAS_PIXELS / (cssWidth * cssHeight)));
  return { cssWidth, cssHeight, ratio, width: Math.max(1, Math.floor(cssWidth * ratio)), height: Math.max(1, Math.floor(cssHeight * ratio)) };
}
