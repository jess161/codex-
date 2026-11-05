import type { VFXElement } from './profiles';

export interface ElementVFXConfig {
  name: string;
  colors: { main: number; light: number; mist: number; accent: number };
  alpha: { inner: [number, number]; outer: number; foreground: number; particle: number; trail: number; edge: number; hit: number };
  timing: { breath: number; flow: number; rise: number; rotation: number; flutter: number };
  counts: { flames: number; mist: number; crystals: number; bubbles: number; sparks: number; electric: number };
  trail: { life: number; width: number; edgePx: number; details: number; branchPx: number; jitterPx: number };
  hit: { life: number; count: number; radius: number; speed: number; gravity: number; size: number; rotation: number; flashLife: number };
}

const style = (name: string, colors: ElementVFXConfig['colors'], timing: ElementVFXConfig['timing'],
  counts: ElementVFXConfig['counts'], trail: ElementVFXConfig['trail'], hit: ElementVFXConfig['hit'],
  alpha: Partial<ElementVFXConfig['alpha']> = {}): ElementVFXConfig => ({
  name, colors, timing, counts, trail, hit,
  alpha: { inner: [.15, .3], outer: .12, foreground: .36, particle: .48, trail: .13, edge: .65, hit: .72, ...alpha },
});

/** All VFX colors, opacity, counts and animation times live here. Seconds, local sword units, or named pixel/world units. */
export const ELEMENT_VFX_CONFIG: Record<VFXElement, ElementVFXConfig> = {
  none: style('无元素基础剑', { main: 0xffb75b, light: 0xffefd1, mist: 0xf7b868, accent: 0x8dbf73 },
    { breath: 2.4, flow: 3, rise: 1.5, rotation: 4, flutter: 1 },
    { flames: 0, mist: 1, crystals: 0, bubbles: 0, sparks: 2, electric: 0 },
    { life: .18, width: .7, edgePx: 1, details: 0, branchPx: 0, jitterPx: 0 },
    { life: .25, count: 5, radius: 3, speed: 32, gravity: 0, size: 1.3, rotation: 1, flashLife: .06 }),
  fire: style('火 FIRE · 刃上火焰', { main: 0xff622c, light: 0xffdc87, mist: 0xb72e28, accent: 0xffa33f },
    { breath: 1.2, flow: 1.6, rise: 1.1, rotation: 2.2, flutter: .42 },
    { flames: 8, mist: 1, crystals: 0, bubbles: 0, sparks: 3, electric: 0 },
    { life: .25, width: .75, edgePx: 1.2, details: 6, branchPx: 0, jitterPx: 0 },
    { life: .34, count: 9, radius: 4, speed: 58, gravity: 38, size: 1.8, rotation: .5, flashLife: .07 },
    { outer: .16, foreground: .56, particle: .6, trail: .16 }),
  ice: style('冰 ICE · 寒雾冰晶', { main: 0x86d9fa, light: 0xe8fbff, mist: 0x4c9dcc, accent: 0xb2edff },
    { breath: 1.8, flow: 4.6, rise: 2.8, rotation: 3.6, flutter: 2.4 },
    { flames: 0, mist: 3, crystals: 5, bubbles: 0, sparks: 2, electric: 0 },
    { life: .27, width: .6, edgePx: 1.4, details: 5, branchPx: 0, jitterPx: 0 },
    { life: .4, count: 8, radius: 3, speed: 47, gravity: 6, size: 3, rotation: .8, flashLife: .06 },
    { outer: .15, foreground: .42, particle: .55, trail: .12 }),
  poison: style('毒 POISON · 螺旋毒雾', { main: 0x89da4c, light: 0xdcffa1, mist: 0x914dc0, accent: 0x623c91 },
    { breath: 2, flow: 2.8, rise: 2, rotation: 3.8, flutter: 1.6 },
    { flames: 0, mist: 2, crystals: 0, bubbles: 4, sparks: 0, electric: 0 },
    { life: .38, width: .8, edgePx: 1, details: 5, branchPx: 0, jitterPx: 0 },
    { life: .46, count: 7, radius: 4, speed: 39, gravity: 42, size: 2.5, rotation: 1.4, flashLife: .08 },
    { outer: .19, foreground: .35, particle: .58, trail: .11 }),
  lightning: style('雷 LIGHTNING · 跳跃电弧', { main: 0xffd14e, light: 0xfff8d7, mist: 0xd68b25, accent: 0xffef95 },
    { breath: 1.6, flow: 1, rise: 1.2, rotation: 2, flutter: .1 },
    { flames: 0, mist: 0, crystals: 0, bubbles: 0, sparks: 2, electric: 3 },
    { life: .17, width: .45, edgePx: 1.1, details: 4, branchPx: 11, jitterPx: 2.5 },
    { life: .17, count: 6, radius: 5, speed: 60, gravity: 0, size: 1.2, rotation: .3, flashLife: .055 },
    { foreground: .48, particle: .45, trail: .06, edge: .8 }),
};

export const WEAPON_VFX_CONFIG = {
  seed: 0x16ac83,
  maxDelta: .05,
  limits: { full: { trail: 56, hits: 12, reactions: 4 }, low: { trail: 24, hits: 5, reactions: 2 } },
  quality: { simplifiedCount: .5, reducedCount: .34, rankCountGain: .25, multiAlpha: .65, breathFloor: .7, breathGain: .3 },
  attack: { windupGain: .3, strikeGain: 1, release: .16, alphaGain: .13 },
  silhouette: { widths: [.07, .026, .009], alpha: [.14, .3, .5] },
  geometry: { start: .27, end: 1, edge: .105, tipEdge: .008, samples: 24,
    flameHeight: .09, flameWidth: .038, flutter: .025, mistOffset: .05, mistWidth: .06,
    crystal: .028, crystalPx: 1.3, bubble: .011, bubblePx: .8, rise: .19, helixTurns: 1.6,
    spark: .009, sparkPx: .55, detailEdgePx: .5, trailBase: .25 },
  lightning: { duration: [.05, .15] as const, gap: [.025, .16] as const, segments: 6,
    length: [.12, .4] as const, jitter: .026, edgePx: .75, glowScale: 3, glowAlpha: .22, coreScale: .4,
    attackGain: .24, history: 24, staticAlpha: .2 },
  trail: { stepAngle: .045, maxSteps: 8, teleport: 24, teleportRatio: .6, maxAngle: Math.PI * .6,
    maxScaleDelta: .2, reducedLife: .08, glowWidth: 3, tipThickness: .18, detailSize: 2.3, phasePeriod: .7,
    poisonBubblePx: 1.2, fireAlpha: .28, iceAlpha: .5, poisonAlpha: .28, branchAlpha: .65 },
  hit: { minSize: .5, maxSize: 2, reducedCount: .5, spread: .4, speedSpread: .6, fadePower: 2,
    flashAlpha: .24, flashRadius: 1.2, mistAlpha: .09, mistRadius: 1.5, lineWidth: 1,
    shardRatio: .5, dropletRatio: 1.5, branchJitter: 4, rayStart: .3 },
  reaction: { life: .6, colors: [0xffd278, 0xb2e6ee], alpha: .35, radius: 12, travel: 40, reducedTravel: 12,
    count: 8, lineWidth: 1.5 },
  placeholder: { body: 0xf49a43, outline: 0x29475d, leaf: 0x79b65c, grip: 0x85603d },
  preview: { windup: .12, strike: .22, recovery: .24, metricInterval: .1, defaultAngle: -.35 },
};
