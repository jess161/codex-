import type { EquipmentStats } from './equipment';
import type { passiveRules } from './passives';

export const PASSIVE_SIZE_LIMITS = { scale: 6, areaRadius: 600, travel: 1400 } as const;

// Length and width affect size, independently of weight, damage and attack speed.
export function passiveSize(stats: Pick<EquipmentStats, 'range' | 'lengthScale' | 'widthScale'>, rules: ReturnType<typeof passiveRules>) {
  const length = Math.max(1, stats.lengthScale), width = Math.max(1, stats.widthScale);
  const scale = Math.min(PASSIVE_SIZE_LIMITS.scale, Math.sqrt(length * width));
  const travelScale = Math.sqrt(length), areaWidthScale = Math.min(2, width ** .25);
  const area = (radius: number) => Math.min(PASSIVE_SIZE_LIMITS.areaRadius, radius * areaWidthScale);
  return {
    scale, travelScale, areaWidthScale,
    pulseRadius: 32 * scale, guardRadius: 28 * Math.sqrt(scale),
    meleeRadius: area(stats.range), ringRadius: area(stats.range * rules.ringRadius),
    roarRadius: area(stats.range + 45), guardCounterRadius: area(stats.range * 1.1),
    burnSpread: Math.min(PASSIVE_SIZE_LIMITS.areaRadius, rules.burnSpread * scale),
  };
}

interface WaveShape { kind: 'basic' | 'moon' | 'getsuga'; radius?: number; hitRadius?: number }
export function waveDimensions(wave: WaveShape, mastery: number, scale = 1) {
  const radius = wave.radius ?? ((wave.kind === 'getsuga' ? 30 : wave.kind === 'moon' ? 23 : 18) + mastery * 3) * scale;
  const hitRadius = wave.hitRadius ?? 10 * scale;
  return { radius, hitRadius, scale: hitRadius / 10 };
}
