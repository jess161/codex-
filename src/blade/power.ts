import { equipmentStats } from './equipment';
import { freshPerks, TIERS } from './config';
import { freshRelics, relicGroups } from './relics';
import type { BladeRun } from './simulation';

export const POWER_AXES = [
  { id:'output', name:'输出', weight:.45 }, { id:'crowd', name:'清群', weight:.25 },
  { id:'mobility', name:'机动', weight:.20 }, { id:'survival', name:'生存', weight:.10 },
] as const;
export function combatPower(run: BladeRun) {
  const s = run.state, stats = run.stats, base = equipmentStats(1,freshPerks(),run.tier,freshRelics()), groups = relicGroups(s.relics);
  // Relative growth within the chosen blade. Conditional powers use average uptime, not an invented DPS claim.
  const stackBonus = run.bladeId === 'scrap' ? 1+s.passive.stacks*run.rules.scrapBonus : 1;
  const itemDamage = 1+s.relics.ember*.08+(s.relics.thunder ? (.55+.15*s.relics.thunder)/(7-s.relics.thunder) : 0);
  const ratios = {
    output: stats.damage/base.damage * base.interval/stats.interval * stackBonus * itemDamage,
    crowd: Math.sqrt(stats.range/base.range)*(stats.arc/base.arc)**.65*(1+s.relics.crystal*.045),
    mobility: (stats.moveSpeed/base.moveSpeed)**.7 * (stats.acceleration/base.acceleration)**.15 * (groups.wind===3 ? 1.08:1),
    survival: s.maxHp/100 * (groups.spirit>=2 ? 1.06:1) * (groups.spirit===3 ? 1.18:1),
  };
  const axes = POWER_AXES.map(axis=>({...axis,ratio:Math.max(.05,Math.min(100,ratios[axis.id]))}));
  const value = Math.round(1000*Math.exp(axes.reduce((sum,a)=>sum+a.weight*Math.log(a.ratio),0)));
  return {value,axes,blade:TIERS[run.tier].name,stats};
}
