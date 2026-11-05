import type Phaser from 'phaser';
import { ELEMENT_VFX_CONFIG, WEAPON_VFX_CONFIG as C } from './config';
import type { VFXElement } from './profiles';
import { diamond } from './element-renderers';

export interface Impact {
  x: number; y: number; age: number; life: number; size: number; seed: number; elements: VFXElement[];
}
const TAU = Math.PI * 2;
export function drawElementImpact(g: Phaser.GameObjects.Graphics, b: Impact, element: VFXElement, reduced: boolean, simplified: boolean) {
  const cfg = ELEMENT_VFX_CONFIG[element], hit = cfg.hit, age = b.age;
  if (age >= hit.life) return;
  const t = age / hit.life, fade = (1 - t) ** C.hit.fadePower;
  const alpha = cfg.alpha.hit * (b.elements.length > 1 ? C.quality.multiAlpha : 1);
  const count = Math.max(1, Math.round(hit.count * (reduced ? C.hit.reducedCount : simplified ? C.quality.simplifiedCount : 1)));
  if (element === 'poison') g.fillStyle(cfg.colors.mist, C.hit.mistAlpha * fade)
    .fillCircle(b.x, b.y, (hit.radius + hit.speed * age * C.hit.mistRadius) * b.size);
  if (age < hit.flashLife) g.fillStyle(cfg.colors.light, C.hit.flashAlpha * (1 - age / hit.flashLife))
    .fillCircle(b.x, b.y, hit.radius * C.hit.flashRadius * b.size);
  for (let i = 0; i < count; i++) {
    const angle = i / count * TAU + b.seed * C.hit.spread;
    const speed = hit.speed * (C.hit.speedSpread + (1 - C.hit.speedSpread) * Math.abs(Math.sin(b.seed + i * 2.3)));
    const travel = hit.radius + speed * age * (reduced ? C.hit.reducedCount : 1);
    const x = b.x + Math.cos(angle) * travel * b.size;
    const y = b.y + (Math.sin(angle) * travel + hit.gravity * age * age / 2) * b.size;
    const size = hit.size * (1 - t * .5) * b.size;
    g.fillStyle(i % 2 ? cfg.colors.light : cfg.colors.main, alpha * fade)
      .lineStyle(C.hit.lineWidth * b.size, cfg.colors.light, alpha * fade);
    if (element === 'ice') diamond(g, x, y, size, angle + age / hit.rotation * TAU);
    else if (element === 'poison') {
      g.fillEllipse(x, y, size * 2, size * C.hit.dropletRatio)
        .fillTriangle(x - size * .6, y, x - Math.cos(angle) * size * 2, y - Math.sin(angle) * size * 2, x + size * .6, y);
    } else if (element === 'lightning') {
      const startX = b.x + Math.cos(angle) * travel * C.hit.rayStart * b.size;
      const startY = b.y + Math.sin(angle) * travel * C.hit.rayStart * b.size;
      const j = C.hit.branchJitter * Math.sin(b.seed + i * 2) * (1 - t);
      g.beginPath().moveTo(startX, startY).lineTo((startX + x) / 2 + j, (startY + y) / 2 - j).lineTo(x, y).strokePath();
    } else {
      g.fillCircle(x, y, size).lineBetween(x, y, x - Math.cos(angle) * size * 2, y - Math.sin(angle) * size * 2);
    }
  }
}
