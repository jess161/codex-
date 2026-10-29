import type { Point } from '../game/content';

export const UNIT = .025;
export const EYE_HEIGHT = 1.65;
export const DEFAULT_VIEW = { yaw: -1.8, pitch: .17 };
export function clampPitch(pitch: number) { return Math.max(-1.3, Math.min(1.3, pitch)); }
export function relativeMovement(right: number, forward: number, yaw: number): Point {
  return { x: Math.sin(yaw) * forward + Math.cos(yaw) * right, y: -Math.cos(yaw) * forward + Math.sin(yaw) * right };
}
export function viewDot(from: Point, to: Point, yaw: number) {
  const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy);
  return d<1?1:(dx*Math.sin(yaw)-dy*Math.cos(yaw))/d;
}
export function forwardPoint(from: Point, yaw: number, distance=105): Point {
  return {x:from.x+Math.sin(yaw)*distance,y:from.y-Math.cos(yaw)*distance};
}
