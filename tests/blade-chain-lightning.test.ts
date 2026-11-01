import {describe,it,expect,vi} from 'vitest';
import {BladeRun,restoreSnapshot,validSnapshot,type RunEvent,type Enemy} from '../src/blade/simulation';
import {BASIC_WEAPON_INDICES} from '../src/blade/config';
import {validEconomy,type GearInventory} from '../src/blade/gear';
import type {GearCombatState} from '../src/blade/build-state';
import {migrateEconomy} from '../src/blade/economy-migration';
import {BladeStorage} from '../src/blade/storage';
const idle={x:0,y:0,dash:false};
function arena(blade=15){const r=new BladeRun(819,undefined,blade);r.state.enemies=[];r.state.spawnBudget=-1e6;r.state.eliteIndex=4;r.state.attackTimer=1e6;return r;}
function buy(r:BladeRun){r.state.economy!.wallet=r.state.economy!.earned=10000;expect(r.buyGear('chainLightning')).toBe(true);}
function target(r:BladeRun,x=60,y=0,kind:Enemy['kind']='boss'){const e=r.spawnEnemy(kind,x,y);e.hp=e.maxHp=10000;e.speed=0;e.cooldown=1e6;return e;}
function step(r:BladeRun,n:number){const events:RunEvent[]=[];for(let i=0;i<n;i++){r.step(1/60,idle);events.push(...r.events);}return events;}
function strike(r:BladeRun){const t=r.stats;r.state.swing={id:r.state.nextId++,tier:r.tier,angle:0,age:t.windup+t.strike*.45-1/60,windup:t.windup,strike:t.strike,recovery:t.recovery,resolved:false};return step(r,r.isRanged?15:1);}
const lightning=(events:RunEvent[])=>events.filter(e=>e.type==='gear-proc'&&e.gearId==='chainLightning');
function crowd(r:BladeRun){return [target(r),...Array.from({length:9},(_,i)=>target(r,200+i*40,0,'armor'))];}
function previousSnapshot(r:BladeRun){const s=r.snapshot();s.version=10;for(const id of ['chainLightning','redMoonBlade','solarEdge','stoneCleaver'] as const)delete(s.economy!.gear as Partial<GearInventory>)[id];for(const key of ['chainCharge','bloodShield','bloodShieldTime'] as const)delete(s.build as Partial<GearCombatState>)[key];return s;}

describe.each(BASIC_WEAPON_INDICES)('energized chain lightning on weapon %i',blade=>{
 it('adds twenty real attack damage and fifteen percent native attack speed',()=>{
  const a=arena(blade),b=arena(blade);buy(b);
  expect(b.stats.damage-a.stats.damage).toBe(20);expect(a.stats.interval/b.stats.interval).toBeCloseTo(1.15);
  const ea=target(a),eb=target(b);strike(a);strike(b);expect((10000-eb.hp)-(10000-ea.hp)).toBe(20);
  for(const r of[a,b]){r.state.swing=null;r.state.attackTimer=0;}step(a,600);step(b,600);expect(b.state.attackCount).toBeGreaterThan(a.state.attackCount);
 });
 it('charges five attacks without firing, then fires only on the next effective attack',()=>{
  const r=arena(blade);buy(r);const enemies=crowd(r);
  for(let i=1;i<=5;i++){expect(lightning(strike(r))).toEqual([]);expect(r.state.build!.chainCharge).toBe(i*20);}
  const before=enemies.map(e=>e.hp),events=lightning(strike(r));
  expect(events).toHaveLength(4);expect(new Set(events.map(e=>e.enemyId)).size).toBe(4);expect(r.state.build!.chainCharge).toBe(0);
  for(let i=0;i<4;i++)expect(enemies[i].hp).toBeLessThan(before[i]);expect(enemies[4].hp).toBe(before[4]);
  expect(events[0].amount).toBeGreaterThan(events[1].amount!);expect(events[1].amount).toBeGreaterThan(events[2].amount!);
 });
 it('counts a sweep, slash, arrow or piercing line once instead of once per target',()=>{
  const r=arena(blade);buy(r);for(const y of[-8,0,8])target(r,55,y);strike(r);
  expect(r.state.build!.chainCharge).toBe(20);expect(lightning(r.events)).toEqual([]);
 });
 it('keeps full charge through a miss and through independent aura damage',()=>{
  const r=arena(blade);buy(r);r.buyGear('emberPlate');r.state.build!.chainCharge=100;
  expect(lightning(strike(r))).toEqual([]);expect(r.state.build!.chainCharge).toBe(100);
  target(r);const events=step(r,60);expect(events.some(e=>e.procKind==='aura')).toBe(true);expect(lightning(events)).toEqual([]);expect(r.state.build!.chainCharge).toBe(100);
 });
 it('coexists with the old three-target coil without either lightning recursively charging it',()=>{
  const r=arena(blade);buy(r);r.buyGear('stormCoil');crowd(r);let all:RunEvent[]=[];
  for(let i=0;i<12;i++)all.push(...strike(r));
  expect(lightning(all)).toHaveLength(8);expect(all.filter(e=>e.gearId==='stormCoil'&&e.type==='gear-proc')).toHaveLength(9);expect(r.state.build!.chainCharge).toBe(0);
 });
 it('continues a partially charged attack sequence exactly after refresh',()=>{
  const a=arena(blade);buy(a);crowd(a);strike(a);strike(a);strike(a);
  const s=a.snapshot();expect(validSnapshot(s)).toBe(true);const b=new BladeRun(1,restoreSnapshot(s)!);
  for(let i=0;i<4;i++){expect(strike(b)).toEqual(strike(a));}expect(a.snapshot()).toEqual(b.snapshot());
 });
 it('removes stats and energy when sold, and a repurchase starts empty',()=>{
  const r=arena(blade),base=r.stats;buy(r);r.state.build!.chainCharge=100;r.buyGear('chainLightning');
  expect(r.state.build!.chainCharge).toBe(100);expect(r.stats.damage-base.damage).toBe(40);
  r.sellGear('chainLightning');expect(r.stats).toEqual(base);expect(r.state.build!.chainCharge).toBe(0);expect(r.state.economy!.refunded).toBe(251);
  r.buyGear('chainLightning');expect(r.state.build!.chainCharge).toBe(0);expect(validEconomy(r.state.economy)).toBe(true);
 });
});

describe('level growth and safe chain targeting',()=>{
 it.each([[1,4],[8,5],[15,6],[22,7],[29,8],[30,8]])('hero level %i really chains to %i different targets',(level,count)=>{
  const r=arena();buy(r);r.state.level=level;r.state.build!.chainCharge=100;crowd(r);
  const events=lightning(strike(r));expect(events).toHaveLength(count);expect(new Set(events.map(e=>e.enemyId)).size).toBe(count);
  expect(events.every((e,i)=>i===0||e.amount!<=events[i-1].amount!)).toBe(true);
 });
 it('cannot jump a gap, hit an enemy twice or keep bouncing between a single boss',()=>{
  const r=arena();buy(r);r.state.level=30;r.state.build!.chainCharge=100;target(r);const far=target(r,500,0,'armor');
  expect(lightning(strike(r))).toHaveLength(1);expect(far.hp).toBe(10000);
 });
 it('starts from the primary hit position even if the ordinary hit kills that enemy',()=>{
  const r=arena();buy(r);r.state.build!.chainCharge=100;const dead=target(r,45,0,'armor');dead.hp=1;
  for(let i=0;i<5;i++)target(r,150+i*40,0,'armor');const events=lightning(strike(r));
  expect(events).toHaveLength(4);expect(events.every(e=>e.enemyId!==dead.id)).toBe(true);expect(r.state.kills).toBe(1);
 });
 it('lightning kills award XP and eligible ground coins exactly once without lifesteal recursion',()=>{
  const r=arena();buy(r);r.buyGear('bloodFang');r.state.hp=50;target(r);
  for(let i=0;i<3;i++){const e=target(r,180+i*40,0,'armor');e.hp=1;}r.state.build!.chainCharge=100;
  const events=strike(r);expect(r.state.kills).toBe(3);expect(r.state.orbs.filter(o=>o.kind==='xp')).toHaveLength(3);
  const ids=r.state.orbs.filter(o=>o.kind==='coin').map(o=>o.id);expect(new Set(ids).size).toBe(ids.length);expect(ids.length).toBeLessThanOrEqual(3);
  expect(events.filter(e=>e.procKind==='leech')).toHaveLength(1);expect(r.state.build!.chainCharge).toBe(0);
 });
});

describe('old saves keep their paid equipment',()=>{
 it('adds an empty item and energy field to v10 while preserving the complete old run',()=>{
  const r=arena();r.state.economy!.wallet=r.state.economy!.earned=1000;r.buyGear('sugarCore');r.buyGear('clockGrip');r.buyGear('bubbleGuard');r.state.build!.heat=2;r.state.build!.heatTime=1.5;
  r.state.time=173;r.addOrb(500,300,4,'coin');const old=previousSnapshot(r),text=JSON.stringify(old);
  expect(validSnapshot(old)).toBe(true);const upgraded=migrateEconomy(restoreSnapshot(old)!);expect(upgraded.version).toBe(12);
  expect(upgraded.economy!.gear.chainLightning).toBe(0);expect(upgraded.build!.chainCharge).toBe(0);
  expect(previousSnapshot(new BladeRun(1,upgraded))).toEqual(old);expect(JSON.stringify(old)).toBe(text);
  expect(migrateEconomy(structuredClone(upgraded))).toEqual(upgraded);expect(new BladeRun(1,old).state).toEqual(upgraded);
 });
 it('migrates at browser storage without clearing gear, refunding purchases or replaying compensation',()=>{
  const r=arena();r.state.economy!.wallet=r.state.economy!.earned=500;r.buyGear('bloodFang');const old=previousSnapshot(r);
  let raw=JSON.stringify({version:10,run:old,meta:{bestScore:9001},settings:{blade:15}});
  vi.stubGlobal('matchMedia',()=>({matches:false}));vi.stubGlobal('localStorage',{getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value;}});
  try{const s=new BladeStorage();expect(s.data.run!.economy!.gear.bloodFang).toBe(1);expect(s.data.run!.economy!.wallet).toBe(440);expect(s.data.run!.economy!.refunded).toBe(0);expect(s.warning).toContain('已保留本局装备与金币');s.write();const again=new BladeStorage();expect(again.data.run).toEqual(s.data.run);expect(again.warning).toBe('');expect(again.data.meta.bestScore).toBe(9001);}finally{vi.unstubAllGlobals();}
 });
 it('rejects corrupt old balances and impossible current charge or item state',()=>{
  const r=arena(),old=previousSnapshot(r);old.economy!.wallet=1;expect(restoreSnapshot(old)).toBeNull();
  const s=r.snapshot();for(const charge of[-20,25,101,NaN])expect(restoreSnapshot({...s,build:{...s.build!,chainCharge:charge}})).toBeNull();
  const missing=r.snapshot();delete(missing.economy!.gear as Partial<GearInventory>).chainLightning;expect(restoreSnapshot(missing)).toBeNull();
 });
});
