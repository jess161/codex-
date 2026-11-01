import { isBow, bowProfile } from './bows';
import { TIERS, DEFAULT_WEAPON, basicWeaponKind, isBasicWeapon, freshPerks, tierForLevel, type PerkId } from './config';
import { freshRelics, ownedRelics, relicGroups, type RelicInventory } from './relics';

export interface SwingTiming { age: number; windup: number; strike: number; recovery: number }
export type SwingPhase = 'windup' | 'strike' | 'recovery';
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function equipmentStats(level: number, perks: Record<PerkId, number> = freshPerks(), blade: number = DEFAULT_WEAPON, items: RelicInventory = freshRelics()) {
  const groups = relicGroups(items), t = TIERS[blade], mastery = tierForLevel(level);
  const p = { ...perks, sharp: perks.sharp + items.stone * 1.5, long: perks.long + items.ruler * 1.5,
    broad: perks.broad + items.anvil * 1.5, hollow: perks.hollow + items.feather, stride: perks.stride + items.bell,
    quick: perks.quick + items.hourglass, grip: perks.grip + items.wrap + (groups.wind >= 2 ? 2 : 0) };
  const range = Math.min(420, (10 + (t.range - 10) * (1 + .14 * mastery) * (1 + .22 * p.long + .18 * p.giant)) * (1 + .08 * p.range) * (groups.forge >= 3 ? 1.1 : 1));
  const lengthScale = (range - 10) / (t.range - 10);
  const widthScale = (1 + .09 * mastery) * (1 + .35 * p.broad + .28 * p.giant);
  const bow=isBow(blade)?bowProfile(blade):undefined;
  const kind = basicWeaponKind(blade);
  const baseMass = kind === 'knife' ? 1 : kind === 'sword' ? .65 : kind === 'spear' ? 1.05 : bow?bow.mass:(t.range / 72) ** .7 * (t.effect === 'heavy' ? 1.24 : t.effect === 'ink' ? 1.12 : 1);
  const mass = baseMass * (lengthScale * widthScale) ** .78 * .86 ** p.hollow;
  const load = Math.max(0, mass - 1), handling = .82 ** p.grip;
  const burden = clamp(load / 2.8, 0, 1) * handling;
  const windup = (kind === 'sword' ? .025 : kind === 'spear' ? .085 : kind === 'knife' ? .065 : bow?.windup??.04) + Math.min(.16, load * .045) * handling;
  const strike = (kind === 'sword' ? .065 : kind === 'knife' ? .16 : kind === 'spear' ? .12 : .10) + Math.min(.08, load * .022);
  const recovery = (kind === 'sword' ? .065 : kind === 'spear' ? .16 : kind === 'knife' ? .14 : .10) + Math.min(.18, load * .05) * handling;
  return {
    damage: Math.round((20 + (level - 1)) * t.multiplier * (1 + .10 * mastery) * (1 + .12 * p.sharp + .10 * p.broad + .16 * p.giant) * (groups.forge >= 2 ? 1.08 : 1) * (1 + .025 * items.crown * ownedRelics(items).length) * (1 + .25 * items.redmoon)),
    interval: Math.max(windup + strike + recovery + .015, Math.max(.26, t.interval * .92 ** p.quick) * (1 + Math.min(.5, load * .13) * handling)),
    range,
    arc: Math.min(kind === 'sword' ? 110 : 250, t.arc + 9 * mastery + 8 * p.broad + 5 * p.giant),
    thrustWidth: Math.min(22, 6 * Math.sqrt(widthScale)),
    magnet: 84 * (1 + .35 * p.magnet + .25 * items.magnet), knockback: 18 * (1 + .35 * p.force + .15 * p.broad + .22 * p.giant) * (groups.forge >= 3 ? 1.15 : 1),
    lengthScale, widthScale, mass, burden, windup, strike, recovery,
    moveSpeed: 210 * (1 + .07 * p.stride) * (1 - Math.min(.28, load * .065)),
    acceleration: 2800 * (1 + .2 * p.stride) / (1 + .6 * Math.min(12, load)),
    waveEvery: isBasicWeapon(blade) || bow || mastery === 0 ? 0 : Math.max(3, 7 - mastery), waveRange: 150 + mastery * 45, pierce: 1 + mastery * 2,
    critChance: .05 * items.fang + (groups.hunt >= 2 ? .08 : 0), critMultiplier: groups.hunt >= 2 ? 2 : 1.75,
    damageReduction: .03 * items.mirror,
    dashCooldown: Math.max(2.5, (groups.wind >= 3 ? 4.25 : 5) - .25 * items.boots),
  };
}
export type EquipmentStats = ReturnType<typeof equipmentStats>;

export function swingPhase(swing: SwingTiming): { phase: SwingPhase; progress: number } {
  if (swing.age < swing.windup) return { phase: 'windup', progress: clamp(swing.age / swing.windup, 0, 1) };
  if (swing.age < swing.windup + swing.strike) return { phase: 'strike', progress: clamp((swing.age - swing.windup) / swing.strike, 0, 1) };
  return { phase: 'recovery', progress: clamp((swing.age - swing.windup - swing.strike) / swing.recovery, 0, 1) };
}
export function swingMoveFactor(stats: EquipmentStats, swing: SwingTiming | null) {
  if (!swing) return 1;
  const { phase } = swingPhase(swing);
  return 1 - stats.burden * (phase === 'strike' ? .55 : phase === 'windup' ? .34 : .25);
}
export const loadName = (mass: number) => mass < 1.3 ? '轻巧' : mass < 2 ? '稳重' : mass < 3.2 ? '沉重' : '巨刃';

// The new catalogue is weapon-neutral. No historical relic or set is consulted.
export function shopEquipmentStats(level: number, blade: number, gear: import('./gear').GearInventory, heat = 0) {
  const t = TIERS[blade], mastery = tierForLevel(level), base = equipmentStats(1, freshPerks(), blade, freshRelics());
  const pace = 1.10 / (1 + .12 * gear.clockGrip + .03 * gear.clockGrip * heat + .10 * gear.stormCoil + .08 * gear.pickupBoots + .15 * gear.chainLightning);
  const range = Math.min(isBow(blade) ? 900 : 420, t.range * .90 * (1 + .10 * mastery) * (1 + .10 * gear.clearLens));
  const windup = base.windup * pace, strike = base.strike * pace, recovery = base.recovery * pace;
  return {...base,
    damage: Math.round(((13 + level - 1) * t.multiplier * (1 + .10 * mastery) * (1 + .02 * (level - 1)) + 20 * gear.chainLightning) * (1 + .12 * gear.sugarCore + .08 * gear.bloodFang + .06 * gear.tideFang)),
    interval: Math.max(windup + strike + recovery + .015, base.interval * pace),
    windup, strike, recovery, range, lengthScale: (range - 10) / (t.range - 10),
    widthScale: 1 + .09 * mastery, arc: Math.min(t.id === 'sword' ? 110 : 250, t.arc + 9 * mastery),
    thrustWidth: 6 * Math.sqrt(1 + .09 * mastery), mass: base.mass, burden: 0,
    moveSpeed: 210 * (1 + .09 * gear.breezeBoots), acceleration: 2800 * (1 + .14 * gear.breezeBoots),
    magnet: 84 * (1 + .15 * gear.pickupBoots), damageReduction: .04 * gear.bubbleGuard + .05 * gear.thornArmor,
    critChance: .15 * gear.sugarCore, critMultiplier: 1.75 + .20 * gear.clearLens,
    dashCooldown: Math.max(3, 5 - .55 * gear.springBoots), waveEvery: 0,
  };
}
