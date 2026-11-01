import { freshGear } from './gear';
import { equipmentStats, shopEquipmentStats } from './equipment';
import { freshPerks, TIERS } from './config';
import { freshRelics, relicGroups } from './relics';
import type { BladeRun } from './simulation';

export const POWER_AXES = [
  { id:'output', name:'输出', weight:.45 }, { id:'crowd', name:'清群', weight:.25 },
  { id:'mobility', name:'机动', weight:.20 }, { id:'survival', name:'生存', weight:.10 },
] as const;
export function combatPower(run: BladeRun) {
  if (run.state.economy) {
    const s = run.state, stats = run.stats, e = s.economy!, base = shopEquipmentStats(1, run.tier, freshGear());
    const ratios = {output: stats.damage / base.damage * base.interval / stats.interval * (1+stats.critChance*(stats.critMultiplier-1)), crowd: Math.sqrt(stats.range / base.range) * (stats.arc / base.arc) ** .65 * (1+.25*e.gear.stoneCleaver),
      mobility: (stats.moveSpeed / base.moveSpeed) ** .7 * (base.dashCooldown / stats.dashCooldown) ** .2 * (stats.magnet / base.magnet) ** .15,
      survival: s.maxHp / 100 / (1 - stats.damageReduction) * (1 + .10*e.gear.redMoonBlade)};
    const axes = POWER_AXES.map(axis => ({...axis, ratio: ratios[axis.id]}));
    return {value: Math.round(1000 * Math.exp(axes.reduce((sum, a) => sum + a.weight * Math.log(a.ratio), 0))), axes, blade: TIERS[run.tier].name, stats};
  }
  const s = run.state, stats = run.stats, base = equipmentStats(1,freshPerks(),run.tier,freshRelics()), groups = relicGroups(s.relics);
  // Relative growth within the chosen blade. Conditional powers use average uptime, not an invented DPS claim.
  const stackBonus = run.bladeId === 'scrap' ? 1+s.passive.stacks*run.rules.scrapBonus : 1;
  const elemental=(1+.15*s.relics.prism)*(groups.arcane>=2?1.2:1)*(groups.chaos>=2?1.2:1);
  const itemDamage = 1+elemental*(s.relics.ember*.08+s.relics.venom*.075+(s.relics.thunder ? (.55+.15*s.relics.thunder)/(7-s.relics.thunder) : 0))
    +(s.relics.echo?(.30+.15*s.relics.echo)/5:0)+(s.relics.comet?3*(.20+.15*s.relics.comet)/4:0)
    +(s.relics.fan?(.25+.15*s.relics.fan)*stats.interval/stats.dashCooldown:0)+s.relics.blackhole*.15/8;
  const ratios = {
    output: stats.damage/base.damage * base.interval/stats.interval * stackBonus * itemDamage * (1+stats.critChance*(stats.critMultiplier-1))*(1+.024*s.relics.execution),
    crowd: Math.sqrt(stats.range/base.range)*(stats.arc/base.arc)**.65*(1+s.relics.crystal*.045+s.relics.scope*.025+s.relics.blackhole*.035),
    mobility: (stats.moveSpeed/base.moveSpeed)**.7 * (stats.acceleration/base.acceleration)**.15 * (base.dashCooldown/stats.dashCooldown)**.2,
    survival: s.maxHp/100 * (groups.spirit>=2 ? 1.06:1) * (groups.spirit>=3 ? 1.18:1) / (1-stats.damageReduction)
      * (s.relics.phoenix&&!s.relicState.phoenixUsed?1+(.2+.1*s.relics.phoenix)*.25:1)
      * (1+(s.relics.food*.025+s.relics.leech*.025)*(1-.12*s.relics.redmoon)),
  };
  const axes = POWER_AXES.map(axis=>({...axis,ratio:Math.max(.05,Math.min(100,ratios[axis.id]))}));
  const value = Math.round(1000*Math.exp(axes.reduce((sum,a)=>sum+a.weight*Math.log(a.ratio),0)));
  return {value,axes,blade:TIERS[run.tier].name,stats};
}
