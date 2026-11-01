import {describe,it,expect} from 'vitest';
import {BladeRun,restoreSnapshot} from '../src/blade/simulation';
import {BASIC_WEAPON_INDICES,TIERS} from '../src/blade/config';
import {coinDropChance,COIN_VALUES} from '../src/blade/gear';
const idle={x:0,y:0,dash:false};
function arena(blade=15,seed=71){const r=new BladeRun(seed,undefined,blade);r.state.enemies=[];r.state.spawnBudget=-1e6;r.state.eliteIndex=4;r.state.attackTimer=1e6;return r;}
function kill(r:BladeRun,kind:'armor'|'elite'|'boss'='armor'){
 const e=r.spawnEnemy(kind,60,0);e.hp=1;e.speed=0;e.cooldown=1e6;
 const t=r.stats;r.state.swing={id:r.state.nextId++,tier:r.tier,angle:0,age:t.windup+t.strike*.45-1/60,windup:t.windup,strike:t.strike,recovery:t.recovery,resolved:false};
 r.step(1/60,idle);const drops=r.state.orbs.filter(o=>o.kind==='coin').map(o=>o.value);r.state.orbs=[];r.state.enemies=[];return drops;
}
describe('lighter coin rewards and a weaker starting weapon',()=>{
 it.each(BASIC_WEAPON_INDICES)('weapon %i starts with lower real damage, attack speed and reach',blade=>{
  const r=arena(blade),t=TIERS[blade],stats=r.stats,e=r.spawnEnemy('armor',60,0);e.hp=e.maxHp=10000;e.speed=0;e.cooldown=1e6;
  expect(stats.damage).toBeLessThanOrEqual(Math.round(20*t.multiplier)*.71);
  expect(stats.interval).toBeGreaterThan(t.interval*1.09);expect(stats.range).toBeCloseTo(t.range*.9);
  r.state.swing={id:r.state.nextId++,tier:r.tier,angle:0,age:stats.windup+stats.strike*.45-1/60,windup:stats.windup,strike:stats.strike,recovery:stats.recovery,resolved:false};
  for(let i=0;i<15;i++)r.step(1/60,idle);
  expect(e.maxHp-e.hp).toBeGreaterThan(0);expect(e.maxHp-e.hp).toBe(stats.damage);
 });
 it('ordinary kills sometimes drop coins at the reduced rate, keeping their denominations',()=>{
  const r=arena();let drops=0;
  for(let i=0;i<500;i++){const values=kill(r);expect(values.every(n=>n===COIN_VALUES.armor)).toBe(true);expect(values.length).toBeLessThanOrEqual(1);drops+=values.length;}
  expect(coinDropChance('armor')).toBe(.6);expect(drops).toBeGreaterThan(260);expect(drops).toBeLessThan(340);
 });
 it.each(['elite','boss'] as const)('%s keeps its guaranteed reward even on seeds with high loot rolls',kind=>{
  for(let seed=1;seed<=20;seed++){expect(kill(arena(15,seed),kind)).toEqual([COIN_VALUES[kind]]);}
 });
 it('refresh preserves the exact future sequence of both coin drops and non-drops',()=>{
  const a=arena();for(let i=0;i<17;i++)kill(a);
  const b=new BladeRun(1,restoreSnapshot(a.snapshot())!);
  const first:number[][]=[],second:number[][]=[];
  for(let i=0;i<80;i++){first.push(kill(a));second.push(kill(b));}
  expect(first).toEqual(second);expect(first.some(x=>x.length===0)).toBe(true);expect(first.some(x=>x.length===1)).toBe(true);expect(a.snapshot()).toEqual(b.snapshot());
 });
});
