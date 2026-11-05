import type Phaser from 'phaser';
import { ELEMENT_VFX_CONFIG, WEAPON_VFX_CONFIG as C } from './config';
import type { VFXElement } from './profiles';

export interface Point { x: number; y: number }
export interface IdleContext {
  back: Phaser.GameObjects.Graphics; front: Phaser.GameObjects.Graphics;
  time: number; boost: number; rank: number; alpha: number; reduced: boolean;
  count: (n: number) => number; pixels: (n: number) => number; up: Point;
}
const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const bladeEdge = (u: number) => C.geometry.edge * (1 - u) + C.geometry.tipEdge;
export function diamond(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, rotation: number) {
  const c = Math.cos(rotation), s = Math.sin(rotation);
  const points = [[-size * .5, 0], [0, -size], [size * .5, 0], [0, size]].map(([px, py]) => ({ x: x + px * c - py * s, y: y + px * s + py * c }));
  g.fillPoints(points, true).strokePoints(points, true);
}

/** Wide mist is drawn behind the opaque WeaponSprite; foreground shapes remain sparse. */
export function drawElementIdle(element: VFXElement, ctx: IdleContext): number {
  const cfg = ELEMENT_VFX_CONFIG[element], { colors, alpha, timing, counts } = cfg;
  const { back, front, boost, rank, up, pixels } = ctx;
  const t = ctx.reduced ? 0 : ctx.time, opacity = ctx.alpha;
  const flow = t / timing.flow * TAU, flutter = t / timing.flutter * TAU;
  const geometry = C.geometry;
  let live = 0;
  if (element === 'fire') {
    const count = ctx.count(counts.flames);
    for (let i = 0; i < count; i++) {
      const u = (Math.floor(i / 2) + .5) / Math.ceil(count / 2), side = i % 2 ? 1 : -1;
      const x = lerp(geometry.start, geometry.end, u), y = side * bladeEdge(u);
      const height = Math.max(geometry.flameHeight, pixels(3)) * (1 + Math.sin(flutter + i * 2.3) * .25 + boost * .5);
      const width = geometry.flameWidth, drift = Math.sin(flutter * .7 + i) * geometry.flutter;
      const points = [{ x: x - width, y }, { x: x - width * .3, y: y + side * height * .6 },
        { x: x + drift, y: y + side * height }, { x: x + width * .5, y: y + side * height * .45 }, { x: x + width, y }];
      back.fillStyle(colors.main, alpha.foreground * opacity).fillPoints(points, true);
      front.fillStyle(colors.light, alpha.foreground * opacity)
        .fillTriangle(x - width * .3, y, x + drift * .6, y + side * height * .6, x + width * .3, y);
      live++;
    }
  }
  if (element === 'ice' || element === 'none') {
    const count = ctx.count(counts.mist);
    for (let i = 0; i < count; i++) {
      const points: Point[] = [], side = i % 2 ? 1 : -1;
      for (let j = 0; j <= geometry.samples; j++) {
        const u = j / geometry.samples;
        points.push({ x: lerp(geometry.start, geometry.end, u),
          y: side * (bladeEdge(u) + geometry.mistOffset) + Math.sin(u * TAU + flow + i) * geometry.flutter });
      }
      back.lineStyle(geometry.mistWidth, colors.mist, alpha.outer * opacity).strokePoints(points, false)
        .lineStyle(geometry.mistWidth * .3, colors.light, alpha.outer * opacity).strokePoints(points, false);
      live++;
    }
    for (let i = 0, count = ctx.count(counts.crystals); i < count; i++) {
      const u = (i + .5) / count, side = i % 2 ? 1 : -1;
      const x = lerp(geometry.start, geometry.end, u) + Math.sin(flow + i) * geometry.flutter;
      const y = side * (bladeEdge(u) + geometry.mistOffset * 1.5) + Math.sin(flow * .7 + i) * geometry.flutter;
      const r = Math.max(geometry.crystal, pixels(geometry.crystalPx)) * (1 + rank * .1);
      front.fillStyle(colors.main, alpha.foreground * opacity).lineStyle(pixels(geometry.detailEdgePx), colors.light, alpha.particle * opacity);
      diamond(front, x, y, r, t / timing.rotation * TAU + i);
      live++;
    }
  }
  if (element === 'poison') {
    for (let strand = 0, count = ctx.count(counts.mist); strand < count; strand++) {
      let old: (Point & { front: boolean }) | undefined;
      for (let i = 0; i <= geometry.samples; i++) {
        const u = i / geometry.samples, phase = u * TAU * geometry.helixTurns - flow + strand * Math.PI;
        const p = { x: lerp(geometry.start, geometry.end, u), y: Math.sin(phase) * (bladeEdge(u) + geometry.mistOffset), front: Math.cos(phase) > 0 };
        if (old) {
          back.lineStyle(geometry.mistWidth, strand % 2 ? colors.main : colors.mist, alpha.outer * opacity).lineBetween(old.x, old.y, p.x, p.y);
          if (p.front) front.lineStyle(Math.max(geometry.mistWidth * .15, pixels(geometry.detailEdgePx)), colors.main, alpha.foreground * opacity).lineBetween(old.x, old.y, p.x, p.y);
        }
        old = p;
      }
      live++;
    }
    for (let i = 0, count = ctx.count(counts.bubbles); i < count; i++) {
      const phase = (t / timing.rise + i / count) % 1, u = (i + .5) / count;
      const x = lerp(geometry.start, geometry.end, u) + up.x * phase * geometry.rise;
      const y = bladeEdge(u) + up.y * phase * geometry.rise;
      const r = Math.max(geometry.bubble, pixels(geometry.bubblePx)) * (1 + phase * .5);
      front.lineStyle(pixels(geometry.detailEdgePx), colors.main, Math.sin(phase * Math.PI) * alpha.particle * opacity).strokeCircle(x, y, r);
      live++;
    }
  }
  if (!ctx.reduced) for (let i = 0, count = ctx.count(counts.sparks); i < count; i++) {
    const phase = (t / timing.rise + i / count) % 1, u = (i + .4) / count;
    const x = lerp(geometry.start, geometry.end, u) + up.x * phase * geometry.rise;
    const y = -bladeEdge(u) + up.y * phase * geometry.rise;
    const r = Math.max(geometry.spark, pixels(geometry.sparkPx)) * (1 - phase * .5);
    front.fillStyle(colors.light, Math.sin(phase * Math.PI) * alpha.particle * opacity);
    if (element === 'ice') diamond(front, x, y, r, t / timing.rotation * TAU + i);
    else front.fillCircle(x, y, r);
    live++;
  }
  return live;
}
