import { BLADE_SHAPES } from './assets/candy/blade-shapes';
export interface BladeBackPose { length: number; fullHeight: number; range: number; widthScale: number; mass: number; inclination: number; opening: number; faceScale: number }
export const BLADE_BACKS = BLADE_SHAPES.map(design => ({ samples: design.samples, outline: 0x263a50, plane: 0xa6c6d9, highlight: 0xe7f7ff }));
export function bladeBackGeometry(index: number, pose: BladeBackPose) {
  const design = BLADE_BACKS[index], thickness = (2.8 + Math.min(2.6, Math.max(0, pose.widthScale - 1) * .5) + Math.min(1.2, Math.max(0, pose.mass - 1) * .12)) * Math.sin(Math.max(0, pose.inclination)) * (1 - pose.opening * .25);
  const center = design.samples.map(p => ({ x: p.x * pose.length, y: p.edge * pose.fullHeight * pose.faceScale }));
  const band = (fraction: number) => {
    const side = (sign: number) => center.map((p, i) => ({ x: p.x, y: p.y + sign * thickness * fraction * Math.min(1, (1 - design.samples[i].x) / .08, .65 + design.samples[i].x * 7) / 2 }));
    return [...side(-1), ...side(1).reverse()];
  };
  return { outline: band(1), plane: band(.55), highlight: center.map((p, i) => ({ x: p.x, y: p.y - thickness * .16 * Math.min(1, (1 - design.samples[i].x) / .08) })), tip: center.at(-1)!, thickness, colors: design };
}
