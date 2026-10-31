import { describe,it,expect } from 'vitest';
import { BladeRun,restoreSnapshot,validSnapshot,type Enemy } from '../src/blade/simulation';
import { BASE_RELIC_IDS,RELIC_IDS,RELICS,RARITIES,RELIC_SLOTS,freshRelics,ownedRelics,weightedRelic,type RelicId } from '../src/blade/relics';
import { FOODS,foodForRoll } from '../src/blade/food';
import { TIERS } from '../src/blade/config';
import { stalkerCloaked } from '../src/blade/threats';
const idle={x:0,y:0,dash:false};
function run(blade=0,seed=815){const r=new BladeRun(seed,undefined,blade);r.state.enemies=[];r.state.spawnBudget=-100000;r.state.attackTimer=100000;return r;}
function step(r:BladeRun,n=1){for(let i=0;i<n;i++)r.step(1/60,idle);}
function award(r:BladeRun,id:RelicId){const s=r.state;s.level++;s.pending=[s.level];s.mode='relic';s.choices=[id,...r.availableRelics.filter(k=>k!==id).slice(0,2)];expect(r.chooseRelic(id)).toBe(true);}
function target(r:BladeRun,kind:Enemy['kind']='armor',x=42){const e=r.spawnEnemy(kind,x,0);e.hp=e.maxHp=10000;e.speed=0;e.cooldown=10000;return e;}
function strike(r:BladeRun){const s=r.state,t=r.stats;s.attackTimer=100000;s.swing={id:s.nextId++,tier:r.tier,angle:0,age:t.windup+t.strike*.45,windup:t.windup,strike:t.strike,recovery:t.recovery,resolved:false};step(r);}
function hit(r:BladeRun,e:Enemy,damage:number,source='melee'){return (r as unknown as {hitEnemy(e:Enemy,damage:number,angle:number,source:string):boolean}).hitEnemy(e,damage,0,source);}
function oldV6(r:BladeRun){const s=r.snapshot();return {...s,version:6,relics:Object.fromEntries(BASE_RELIC_IDS.map(id=>[id,s.relics[id]])),relicState:{lightning:s.relicState.lightning,shield:s.relicState.shield,shieldCooldown:s.relicState.shieldCooldown},enemies:s.enemies.map(({poisonTime,poisonTick,poisonDamage,...e})=>e)};}

describe('five-slot builds and six quality tiers',()=>{
 it('has 30 unique items, six nonempty rarities and five members in each family',()=>{
  expect(new Set(RELIC_IDS).size).toBe(30);expect(RELIC_SLOTS).toBe(5);
  for(const rarity of Object.keys(RARITIES))expect(RELIC_IDS.filter(id=>RELICS[id].rarity===rarity).length).toBeGreaterThan(0);
  for(const group of new Set(RELIC_IDS.map(id=>RELICS[id].group)))expect(RELIC_IDS.filter(id=>RELICS[id].group===group)).toHaveLength(5);
 });
 it('weights common items more often, keeps every rarity reachable and supports later chaos growth',()=>{
  const pool:RelicId[]=['stone','scope','venom','echo','phoenix','blackhole'];
  const count=(level:number)=>{const out=Object.fromEntries(pool.map(id=>[id,0]));for(let i=0;i<10000;i++)out[weightedRelic(pool,(i+.5)/10000,level)]++;return out;};
  const early=count(2),late=count(30);for(const id of pool)expect(early[id]).toBeGreaterThan(0);
  expect(early.stone).toBeGreaterThan(early.scope);expect(early.echo).toBeGreaterThan(early.phoenix);expect(late.blackhole).toBeGreaterThan(early.blackhole);
 });
 it('enforces five distinct slots even for a forged sixth offer while allowing upgrades',()=>{
  const r=run();for(const id of ['stone','ruler','anvil','feather','heart'] as RelicId[])award(r,id);
  expect(ownedRelics(r.state.relics)).toHaveLength(5);expect(r.availableRelics.every(id=>r.state.relics[id]>0)).toBe(true);
  r.state.level++;r.state.mode='relic';r.state.pending=[r.state.level];r.state.choices=['fang','stone','heart'];const before=r.snapshot();
  expect(r.chooseRelic('fang')).toBe(false);expect(r.snapshot()).toEqual(before);expect(r.chooseRelic('stone')).toBe(true);
 });
 it('never offers maxed items or fills exhausted choices with a sixth item',()=>{
  const r=run();for(const id of ['stone','wrap','fang','scope','heart'] as RelicId[])for(let i=0;i<5;i++)award(r,id);
  expect(r.availableRelics).toEqual([]);r.grantXp(10000);step(r,40);expect(r.state.mode).toBe('relic');expect(r.state.choices).toEqual([]);
  expect(r.skipRelic()).toBe(true);expect(r.state.skipped).toBe(1);expect(r.state.mode).toBe('playing');expect(r.skipRelic()).toBe(false);
 });
 it('skips once without granting or rerolling anything, and restores that spent choice',()=>{
  const r=run();r.grantXp(19);step(r,12);const before=r.snapshot();step(r,120);expect(r.snapshot()).toEqual(before);
  expect(r.skipRelic()).toBe(true);expect(r.state.relics).toEqual(freshRelics());expect(r.state.rng).toBe(before.rng);expect(r.state.lootRng).toBe(before.lootRng);
  expect(r.state.level).toBe(2);expect(r.state.pending).toEqual([]);expect(r.skipRelic()).toBe(false);expect(restoreSnapshot(r.snapshot())).toEqual(r.snapshot());
 });
 it('retains three-piece bonuses when equipping a fourth or fifth member',()=>{
  const r=run();for(const id of ['heart','magnet','star','food','phoenix'] as RelicId[])award(r,id);
  expect(r.state.relicState.shield).toBe(true);r.state.invincible=0;expect(r.damagePlayer(10,'test')).toBe(false);expect(r.state.relicState.shieldCooldown).toBe(20);
  const forge=run();for(const id of ['stone','ruler','anvil'] as RelicId[])award(forge,id);const knock=forge.stats.knockback;award(forge,'wrap');expect(forge.stats.knockback).toBe(knock);
 });
});
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
  expect(red.stats.damage).toBe(Math.round((20+1)*TIERS[0].multiplier*1.25));
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
describe('expanded save compatibility',()=>{
 it('upgrades v6 without changing item ranks, HP, statuses, entities or combat RNG',()=>{
  const r=run();for(const id of ['stone','heart','magnet','thunder'] as RelicId[])award(r,id);const e=target(r);e.burnTime=1;e.burnDamage=3;r.addOrb(500,700,10,'xp');
  const old=oldV6(r),text=JSON.stringify(old),copy=restoreSnapshot(old)!;expect(copy.version).toBe(7);expect(copy.rng).toBe(old.rng);expect(copy.hp).toBe(old.hp);expect(copy.maxHp).toBe(old.maxHp);expect(copy.relicState.heartPeak).toBe(1);expect(copy.orbs).toEqual(old.orbs);expect(copy.enemies[0].burnTime).toBe(1);expect(copy.enemies[0].poisonTime).toBe(0);expect(JSON.stringify(old)).toBe(text);expect(restoreSnapshot(copy)).toEqual(copy);
 });
 it('freezes overloaded old inventories until the player chooses exactly five, preserving XP and earned max HP',()=>{
  const r=run();r.state.level=14;r.state.time=200;r.state.maxHp=130;r.state.hp=70;r.state.totalXp=200;
  for(const id of BASE_RELIC_IDS)r.state.relics[id]=1;r.state.relics.heart=2;r.addOrb(800,900,8,'xp');const old=oldV6(r),copy=restoreSnapshot(old)!;
  expect(copy.mode).toBe('relic-trim');expect(ownedRelics(copy.relics)).toHaveLength(12);expect(restoreSnapshot(copy)).toEqual(copy);
  const resumed=new BladeRun(1,copy);const before=resumed.snapshot();step(resumed,120);expect(resumed.snapshot()).toEqual(before);
  expect(resumed.trimRelics(['stone'])).toBe(false);expect(resumed.trimRelics(['stone','stone','heart','magnet','star'])).toBe(false);
  expect(resumed.trimRelics(['stone','ruler','anvil','feather','bell'])).toBe(true);expect(resumed.state.mode).toBe('playing');expect(ownedRelics(resumed.state.relics)).toHaveLength(5);expect(resumed.state.relics.heart).toBe(0);expect(resumed.state.maxHp).toBe(130);expect(resumed.state.hp).toBe(70);expect(resumed.state.totalXp).toBe(200);expect(resumed.state.orbs).toEqual(old.orbs);expect(resumed.state.rng).toBe(old.rng);expect(resumed.state.relicState.heartPeak).toBe(2);expect(validSnapshot(resumed.snapshot())).toBe(true);
 });
 it('filters pending old offers after trimming without rerolling and permits a persisted skip-only screen',()=>{
  const r=run();r.state.level=15;r.state.maxHp=115;for(const id of BASE_RELIC_IDS)r.state.relics[id]=1;r.state.pending=[15];r.state.mode='relic';r.state.choices=['heart','magnet','star'];
  const restored=restoreSnapshot(oldV6(r))!;const copy=new BladeRun(0,restored),rng=restored.rng;expect(copy.trimRelics(['stone','ruler','anvil','feather','bell'])).toBe(true);expect(copy.state.choices).toEqual([]);expect(copy.state.rng).toBe(rng);expect(validSnapshot(copy.snapshot())).toBe(true);expect(copy.skipRelic()).toBe(true);
 });
 it('rejects a sixth active slot, out-of-range grades, broken food/status/counter or migration states',()=>{
  const r=run();r.state.level=20;const s=r.snapshot();
  for(const broken of [ {...s,relics:{...s.relics,stone:6}}, {...s,skipped:-1}, {...s,lootRng:NaN}, {...s,relicState:{...s.relicState,phoenixUsed:1}}, {...s,relicResume:'playing'}, {...s,mode:'relic-trim',relicResume:'dead'}, {...s,orbs:[{id:100,x:0,y:0,value:8,kind:'heal',food:'unknown'}]}, {...s,relics:{...s.relics,stone:1,ruler:1,anvil:1,feather:1,bell:1,heart:1}} ])expect(restoreSnapshot(broken)).toBeNull();
 });
});
