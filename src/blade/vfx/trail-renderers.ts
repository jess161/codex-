import type Phaser from 'phaser';
import { ELEMENT_VFX_CONFIG, WEAPON_VFX_CONFIG as C } from './config';
import type { VFXElement } from './profiles';
import { diamond, type Point } from './element-renderers';

export interface TrailSample { base: Point; tip: Point; age: number; attack: number; connect: boolean; elements: VFXElement[] }

export function drawElementTrail(g: Phaser.GameObjects.Graphics, a: TrailSample, b: TrailSample,
  element: VFXElement, index: number, reduced: boolean, pixels: (n: number) => number) {
  const cfg = ELEMENT_VFX_CONFIG[element], life = reduced ? C.trail.reducedLife : cfg.trail.life;
  const fade = Math.max(0, 1 - a.age / life);
  if (fade <= 0) return;
  const opacity = b.elements.length > 1 ? C.quality.multiAlpha : 1;
  const baseA = { x: a.tip.x + (a.base.x - a.tip.x) * cfg.trail.width, y: a.tip.y + (a.base.y - a.tip.y) * cfg.trail.width };
  const baseB = { x: b.tip.x + (b.base.x - b.tip.x) * cfg.trail.width, y: b.tip.y + (b.base.y - b.tip.y) * cfg.trail.width };
  const color = element === 'poison' ? cfg.colors.mist : cfg.colors.main;
  g.fillStyle(color, cfg.alpha.trail * fade * opacity)
    .fillTriangle(baseA.x, baseA.y, a.tip.x, a.tip.y, b.tip.x, b.tip.y)
    .fillTriangle(baseA.x, baseA.y, b.tip.x, b.tip.y, baseB.x, baseB.y);
  const line = pixels(cfg.trail.edgePx);
  if (element !== 'lightning') g.lineStyle(line, cfg.colors.light, cfg.alpha.edge * fade * opacity)
    .lineBetween(a.tip.x, a.tip.y, b.tip.x, b.tip.y);
  const dx = b.tip.x - a.tip.x, dy = b.tip.y - a.tip.y, length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length, ny = dx / length;
  const x = (a.tip.x + b.tip.x) / 2, y = (a.tip.y + b.tip.y) / 2;
  if (element === 'lightning') {
    const jitter = pixels(cfg.trail.jitterPx) * Math.sin(index * 2.7 + b.attack);
    g.lineStyle(line * C.trail.glowWidth, cfg.colors.main, cfg.alpha.trail * fade * opacity)
      .lineBetween(a.tip.x, a.tip.y, b.tip.x, b.tip.y);
    g.lineStyle(line, cfg.colors.light, cfg.alpha.edge * fade * opacity)
      .beginPath().moveTo(a.tip.x, a.tip.y).lineTo(x + nx * jitter, y + ny * jitter).lineTo(b.tip.x, b.tip.y).strokePath();
    if (!reduced && index % Math.max(1, cfg.trail.details) === 0) {
      const size = pixels(cfg.trail.branchPx) * fade, side = index % 2 ? 1 : -1;
      g.lineStyle(line, cfg.colors.main, C.trail.branchAlpha * fade * opacity).beginPath()
        .moveTo(x, y).lineTo(x + nx * size * side * .5 + dx, y + ny * size * side * .5 + dy)
        .lineTo(x + nx * size * side, y + ny * size * side).strokePath()
        .lineBetween(x + nx * size * side * .5 + dx, y + ny * size * side * .5 + dy,
          x + nx * size * side + dx * 2, y + ny * size * side + dy * 2);
    }
  } else if (!reduced && cfg.trail.details && index % cfg.trail.details === 0) {
    const size = pixels(C.trail.detailSize) * fade;
    if (element === 'fire') {
      g.fillStyle(cfg.colors.main, C.trail.fireAlpha * fade * opacity)
        .fillTriangle(a.tip.x, a.tip.y, x + nx * size * 2, y + ny * size * 2, b.tip.x, b.tip.y);
    } else if (element === 'ice') {
      g.fillStyle(cfg.colors.light, C.trail.iceAlpha * fade * opacity).lineStyle(0, cfg.colors.light);
      diamond(g, x + nx * size, y + ny * size, size, a.age / C.trail.phasePeriod * Math.PI * 2 + index);
    } else if (element === 'poison') {
      g.fillStyle(cfg.colors.main, C.trail.poisonAlpha * fade * opacity).fillCircle(x, y, pixels(C.trail.poisonBubblePx) * fade)
        .lineStyle(line, cfg.colors.main, cfg.alpha.edge * fade * opacity)
        .lineBetween(x, y, x + nx * size, y + ny * size);
    }
  }
}
