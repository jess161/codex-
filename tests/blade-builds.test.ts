import { describe,it,expect } from 'vitest';
import { BladeRun,restoreSnapshot,validSnapshot,type Enemy } from '../src/blade/simulation';
import { BASE_RELIC_IDS,RELIC_IDS,RELICS,RARITIES,freshRelics,ownedRelics,weightedRelic,type RelicId } from '../src/blade/relics';
import { FOODS,foodForRoll } from '../src/blade/food';
import { TIERS } from '../src/blade/config';
import { stalkerCloaked } from '../src/blade/threats';
const idle={x:0,y:0,dash:false};
function run(blade=0,seed=815){const r=new BladeRun(seed,undefined,blade);r.state.enemies=[];r.state.spawnBudget=-100000;r.state.attackTimer=100000;return r;}
function step(r:BladeRun,n=1){for(let i=0;i<n;i++)r.step(1/60,idle);}
function award(r:BladeRun,id:RelicId){r.state.level++;const d=r.addRelicDrop(id,r.state.player.x,r.state.player.y)!;d.spawn=0;expect(r.pickupRelic(d.id)).toBe(true);}
function target(r:BladeRun,kind:Enemy['kind']='armor',x=42){const e=r.spawnEnemy(kind,x,0);e.hp=e.maxHp=10000;e.speed=0;e.cooldown=10000;return e;}
function strike(r:BladeRun){const s=r.state,t=r.stats;s.attackTimer=100000;s.swing={id:s.nextId++,tier:r.tier,angle:0,age:t.windup+t.strike*.45,windup:t.windup,strike:t.strike,recovery:t.recovery,resolved:false};step(r);}
function hit(r:BladeRun,e:Enemy,damage:number,source='melee'){return (r as unknown as {hitEnemy(e:Enemy,damage:number,angle:number,source:string):boolean}).hitEnemy(e,damage,0,source);}
function oldV6(r:BladeRun){const s=r.snapshot();return {...s,version:6,relics:Object.fromEntries(BASE_RELIC_IDS.map(id=>[id,s.relics[id]])),relicState:{lightning:s.relicState.lightning,shield:s.relicState.shield,shieldCooldown:s.relicState.shieldCooldown},enemies:s.enemies.map(({poisonTime,poisonTick,poisonDamage,...e})=>e)};}

describe('new build effects in combat',()=>{
 it('improves heavy handling without changing dimensions and shortens dash with longer invulnerability',()=>{
  const r=run(9);award(r,'anvil');const a=r.stats;award(r,'wrap');expect(r.stats.burden).toBeLessThan(a.burden);expect(r.stats.widthScale).toBe(a.widthScale);
  for(let i=0;i<5;i++)award(r,'boots');r.state.invincible=0;r.dash();expect(r.state.dashCooldown).toBe(3.75);expect(r.state.invincible).toBeCloseTo(.195);step(r,12);expect(Math.hypot(r.state.player.x,r.state.player.y)).toBeCloseTo(140);
 });
 it('emits echo, comet, and dash waves from their distinct trigger cycles, with scope growth',()=>{
  const r=run();for(const id of ['echo','comet','fan','scope'] as RelicId[])award(r,id);const e=target(r);
  for(let i=0;i<4;i++){e.x=42;e.y=0;e.knockX=e.knockY=0;strike(r);}
  expect(r.state.waves.filter(w=>w.kind==='moon')).toHaveLength(3);expect(r.state.relicState.comet).toBe(0);expect(r.state.relicState.echo).toBe(4);
  e.x=42;e.y=0;e.knockX=e.knockY=0;strike(r);expect(r.state.relicState.echo).toBe(0);expect(r.state.waves.some(w=>w.kind==='basic'&&w.pierce===4)).toBe(true);
  r.state.enemies=[];r.state.waves=[];r.dash();const before=r.snapshot();const copy=new BladeRun(1,restoreSnapshot(before)!);step(copy,12);
  expect(copy.state.waves).toHaveLength(1);expect(copy.state.waves[0].pierce).toBe(5);expect(copy.state.waves[0].maxRange).toBeCloseTo(195*copy.passiveSize.travelScale*1.12);expect(copy.state.relicState.dashWave).toBe(false);step(copy);expect(copy.state.waves).toHaveLength(1);
 });
 it('applies five non-stacking poison ticks, reveals stealth and gives strong-enemy poison bonus',()=>{
  const r=run();award(r,'venom');const e=target(r,'stalker');strike(r);expect(e.poisonTime).toBe(2.5);expect(stalkerCloaked(e)).toBe(false);
  const poison=e.poisonDamage,hp=e.hp;e.knockX=e.knockY=0;step(r,150);expect(hp-e.hp).toBe(5*poison);expect(e.poisonTime).toBe(0);expect(e.knockX).toBe(0);
  const boss=target(r,'boss');strike(r);expect(boss.poisonDamage).toBe(Math.max(1,Math.round(r.stats.damage*.03*1.25)));
 });
 it('amplifies item and native elements with prism and chaos while keeping DOT out of crits',()=>{
  const r=run(10);for(const id of ['venom','prism','redmoon','mirror'] as RelicId[])award(r,id);const e=target(r);strike(r);
  expect(e.burnDamage).toBe(Math.max(1,Math.round(r.stats.damage*r.rules.burnTickDamage*1.15*1.2)));
  expect(e.poisonDamage).toBe(Math.max(1,Math.round(r.stats.damage*.03*1.15*1.2*1.2)));
  r.state.relics.fang=5;const hp=e.hp;hit(r,e,7,'poison');expect(hp-e.hp).toBe(7);expect(r.events.at(-1)?.critical).toBe(false);
 });
 it('supports crit builds and stronger direct finishing hits without amplifying DOT damage',()=>{
  const r=run();for(const id of ['fang','scope','execution'] as RelicId[])award(r,id);const e=target(r);expect(r.stats.critChance).toBeCloseTo(.13);expect(r.stats.critMultiplier).toBe(2);
  let crits=0;for(let i=0;i<200;i++){e.hp=e.maxHp;hit(r,e,10);if(r.events.at(-1)?.critical)crits++;}expect(crits).toBeGreaterThan(0);expect(crits).toBeLessThan(100);
  const f=run();award(f,'execution');const b=target(f);b.hp=1000;hit(f,b,100);expect(b.hp).toBe(888);
  const boss=target(f,'boss');boss.hp=500;hit(f,boss,100);expect(boss.hp).toBe(394);hit(f,boss,10,'burn');expect(boss.hp).toBe(384);
 });
 it('heals credited kills once per cooldown and refunds swing wait for a hunt trio',()=>{
  const r=run();for(const id of ['leech','scope','fang'] as RelicId[])award(r,id);r.state.hp=50;const timer=r.state.attackTimer;
  hit(r,target(r),100000);expect(r.state.hp).toBeCloseTo(50.4);expect(r.state.attackTimer).toBeCloseTo(timer-.04);
  hit(r,target(r),100000);expect(r.state.hp).toBeCloseTo(50.4);step(r,31);hit(r,target(r),100000);expect(r.state.hp).toBeCloseTo(50.8);
 });
 it('scales crown with occupied slots and adds redmoon damage with the advertised healing cost',()=>{
  const r=run();award(r,'crown');const damage=r.stats.damage;award(r,'scope');expect(r.stats.damage).toBeGreaterThan(damage);
  const red=run();award(red,'redmoon');red.state.hp=20;red.addOrb(0,0,10,'heal');step(red,14);expect(red.state.hp).toBeCloseTo(28.8);
  expect(red.stats.damage).toBe(Math.round(Math.round((20+1)*TIERS[0].multiplier*1.25)*1.02));
 });
 it('revives only once per run, preserving the used state through upgrades and reloads',()=>{
  const r=run();award(r,'phoenix');r.state.hp=1;r.state.invincible=0;r.damagePlayer(100,'test');expect(r.state.mode).toBe('playing');expect(r.state.hp).toBeCloseTo(30);expect(r.state.invincible).toBe(2);
  award(r,'phoenix');const copy=new BladeRun(1,restoreSnapshot(r.snapshot())!);expect(copy.state.relicState.phoenixUsed).toBe(true);copy.state.invincible=0;copy.damagePlayer(1000,'test');expect(copy.state.mode).toBe('dead');
 });
 it('reflects after harm and shield absorption and respects incoming-damage reduction',()=>{
  const r=run();award(r,'mirror');r.state.invincible=0;r.damagePlayer(20,'test');expect(r.state.hp).toBeCloseTo(80.6);expect(r.state.waves).toHaveLength(1);
  step(r);expect(r.state.waves).toHaveLength(1);expect(r.damagePlayer(20,'test')).toBe(false);
  const w=run(TIERS.findIndex(t=>t.id==='wado'));award(w,'mirror');w.state.passive.shield=true;w.state.invincible=0;w.damagePlayer(20,'test');expect(w.state.hp).toBe(100);expect(w.state.waves).toHaveLength(1);
 });
 it('trades low-health incoming damage for overdrive speed and applies the chaos trio',()=>{
  const r=run();for(const id of ['overdrive','crown','mirror'] as RelicId[])award(r,id);const high=r.stats;r.state.hp=40;const low=r.stats;
  expect(low.moveSpeed/high.moveSpeed).toBeCloseTo(1.04);expect(low.interval).toBeLessThan(high.interval);expect(low.damage).toBe(Math.round(high.damage*1.25));expect(low.damageReduction).toBeCloseTo(.11);
  r.state.invincible=0;r.damagePlayer(10,'test');expect(r.state.hp).toBeCloseTo(40-10*.89*1.08);
 });
 it('pulls and damages enemies with an eight-hit vortex but does not pull the boss',()=>{
  const r=run();award(r,'blackhole');const normal=target(r,'armor',90),boss=target(r,'boss',90);normal.hp=boss.hp=1e6;
  for(let i=0;i<8;i++){for(const e of [normal,boss]){e.x=90;e.y=0;e.knockX=e.knockY=0;}strike(r);}
  expect(r.events.some(e=>e.type==='relic'&&e.item==='vortex')).toBe(true);expect(normal.x).toBe(60);expect(boss.x).toBe(90);expect(r.state.relicState.vortex).toBe(0);
 });
});
describe('healing food loot and persistence',()=>{
 it('maps the three foods to distinct healing values and weighted roll boundaries',()=>{expect(Object.values(FOODS).map(f=>f.heal)).toEqual([8,16,28]);expect([0,.5999,.6,.8999,.9,.9999].map(foodForRoll)).toEqual(['berry','berry','bread','bread','drumstick','drumstick']);});
 it('rolls seeded food independently of combat RNG and retains every XP reward and exact drop position',()=>{
  const r=run();const before=r.state.rng;const xp=0;
  for(let i=0;i<1200;i++){const e=target(r,'blob',1500+i);hit(r,e,100000);r.state.enemies=[];}
  const food=r.state.orbs.filter(o=>o.kind==='heal'),orbs=r.state.orbs.filter(o=>o.kind==='xp');
  expect(orbs).toHaveLength(1200);expect(food.length).toBeGreaterThan(30);expect(food.length).toBeLessThan(100);expect(new Set(food.map(o=>o.food)).size).toBe(3);
  for(const f of food)expect(orbs.some(o=>o.x===f.x&&o.y===f.y)).toBe(true);expect(r.state.totalXp).toBe(xp);
  const copy=new BladeRun(1,restoreSnapshot(r.snapshot())!);expect(copy.state.orbs).toEqual(r.state.orbs);expect(copy.state.lootRng).toBe(r.state.lootRng);
  const a=run(0,77),b=run(0,77);const e=target(a),f=target(b);const rng=a.state.rng;hit(a,e,100000);expect(a.state.rng).toBe(rng);expect(b.state.rng).toBe(rng);expect(before).toBeTypeOf('number');
 });
 it('leaves food at full HP, picks it up once when injured, and applies food, spirit and redmoon factors once',()=>{
  const r=run();for(const id of ['food','magnet','redmoon'] as RelicId[])award(r,id);r.state.hp=r.state.maxHp;r.addOrb(10,0,16,'heal','bread');const before=structuredClone(r.state.orbs);
  step(r,120);expect(r.state.orbs).toEqual(before);r.state.hp=20;step(r,14);expect(r.state.hp).toBeCloseTo(20+16*1.1*1.2*.88);expect(r.state.orbs).toEqual([]);const hp=r.state.hp;step(r,60);expect(r.state.hp).toBe(hp);
 });
 it('increases actual food drops with lunchbox and keeps elite bread as a guaranteed additional reward',()=>{
  const a=run(0,99),b=run(0,99);for(let i=0;i<5;i++)award(b,'food');
  for(let i=0;i<600;i++)for(const r of [a,b]){hit(r,target(r,'blob',2000),100000);r.state.enemies=[];}
  expect(b.state.orbs.filter(o=>o.kind==='heal').length).toBeGreaterThan(a.state.orbs.filter(o=>o.kind==='heal').length*1.5);
  const elite=target(a,'elite',2200);hit(a,elite,100000);expect(a.state.orbs.some(o=>o.food==='bread'&&o.value===16&&o.x===2212)).toBe(true);
 });
 it('never drops food or grants kill healing for a bomber that detonates by itself',()=>{
  const r=run();award(r,'food');award(r,'leech');r.state.hp=50;r.state.invincible=10;const e=target(r,'bomber',0);e.action='windup';e.timer=.001;
  step(r);expect(r.state.orbs.every(o=>o.kind==='xp')).toBe(true);expect(r.state.hp).toBe(50);expect(r.state.kills).toBe(0);
 });
});
