import {describe,it,expect,vi} from 'vitest';
import {BladeRun,restoreSnapshot,validSnapshot,type Enemy,type RunEvent} from '../src/blade/simulation';
import {BASIC_WEAPON_INDICES} from '../src/blade/config';
import {BUILDS,GEAR_IDS,GEAR_SLOTS,gearBlockReason,gearInvestment,gearSellPrice,freshEconomy,validEconomy,type GearId} from '../src/blade/gear';
import {migrateEconomy} from '../src/blade/economy-migration';
const idle={x:0,y:0,dash:false};
const arena=(blade:number=15)=>{const r=new BladeRun(819,undefined,blade);r.state.enemies=[];r.state.spawnBudget=-1e6;r.state.eliteIndex=4;r.state.attackTimer=1e6;return r;};
const fund=(r:BladeRun)=>{r.state.economy!.wallet=r.state.economy!.earned=10000;};
const buy=(r:BladeRun,id:GearId,rank=1)=>{for(let i=0;i<rank;i++)expect(r.buyGear(id)).toBe(true);};
const target=(r:BladeRun,x=60,y=0,kind:Enemy['kind']='boss')=>{const e=r.spawnEnemy(kind,x,y);e.hp=e.maxHp=10000;e.speed=0;e.cooldown=1e6;return e;};
function step(r:BladeRun,n:number) {const events:RunEvent[]=[];for(let i=0;i<n;i++){r.step(1/60,idle);events.push(...r.events);}return events;}
function strike(r:BladeRun) {const t=r.stats;r.state.swing={id:r.state.nextId++,tier:r.tier,angle:0,age:t.windup+t.strike*.45-1/60,windup:t.windup,strike:t.strike,recovery:t.recovery,resolved:false};const events=step(r,1);return r.isRanged?[...events,...step(r,30)]:events;}

describe('six real equipment decisions, rather than buying every stat',()=>{
 it('offers fourteen original items, three classes and five non-binding build recipes',()=>{
  expect(GEAR_IDS).toHaveLength(14);expect(Object.keys(BUILDS)).toHaveLength(5);
  for(const recipe of Object.values(BUILDS)){expect(recipe.items).toHaveLength(6);expect(new Set(recipe.items).size).toBe(6);}
 });
 it('enforces six owned identities and a single footwear piece, while allowing upgrades',()=>{
  const r=arena();fund(r);for(const id of BUILDS.onhit.items)buy(r,id);
  expect(r.gearOrder).toHaveLength(GEAR_SLOTS);const s=r.snapshot();expect(r.buyGear('jellyVest')).toBe(false);expect(r.snapshot()).toEqual(s);buy(r,'clockGrip');
  const b=arena();fund(b);buy(b,'breezeBoots');expect(gearBlockReason(b.state.economy!,'pickupBoots')).toBe('已有足具');expect(b.buyGear('pickupBoots')).toBe(false);
 });
 it('sells at 75% of actual investment, frees a slot and preserves money conservation',()=>{
  const r=arena();fund(r);buy(r,'breezeBoots',2);expect(gearInvestment('breezeBoots',2)).toBe(125);expect(gearSellPrice('breezeBoots',2)).toBe(93);
  expect(r.sellGear('breezeBoots')).toBe(true);expect(r.state.economy!.wallet).toBe(9968);expect(r.state.economy!.refunded).toBe(93);buy(r,'pickupBoots');
  expect(r.gearOrder).toEqual(['pickupBoots']);expect(validEconomy(r.state.economy)).toBe(true);expect(r.sellGear('not-an-item')).toBe(false);
 });
 it('selling life and shield equipment removes those benefits immediately without free healing',()=>{
  const r=arena();fund(r);buy(r,'jellyVest');buy(r,'bubbleGuard');r.state.hp=30;r.state.invincible=0;r.damagePlayer(20,'test');expect(r.state.build!.shield).toBeGreaterThan(0);
  r.sellGear('bubbleGuard');expect(r.state.build!.shield).toBe(0);const hp=r.state.hp;r.sellGear('jellyVest');expect(r.state.maxHp).toBe(100);expect(r.state.hp).toBe(Math.min(hp,100));
 });
});

describe.each(BASIC_WEAPON_INDICES)('mechanical build effects on weapon %i',blade=>{
 it('crit chance and crit damage multiply together on a real basic attack',()=>{
  const a=arena(blade),b=arena(blade);for(const r of[a,b]){fund(r);buy(r,'sugarCore');vi.spyOn(r,'random').mockReturnValue(0);}
  buy(b,'clearLens');const ea=target(a),eb=target(b);const va=strike(a),vb=strike(b);
  expect(va.some(e=>e.type==='hit'&&e.critical)).toBe(true);expect(vb.some(e=>e.type==='hit'&&e.critical)).toBe(true);expect(10000-eb.hp).toBeGreaterThan(10000-ea.hp);
  const noChance=arena(blade);fund(noChance);buy(noChance,'clearLens');target(noChance);expect(strike(noChance).some(e=>e.critical)).toBe(false);
 });
 it('four effective attacks charge one three-target lightning and heat is not per enemy',()=>{
  const r=arena(blade);fund(r);buy(r,'clockGrip');buy(r,'stormCoil');for(const y of[-10,0,10])target(r,60,y);
  const all:RunEvent[]=[];for(let i=0;i<4;i++){all.push(...strike(r));expect(r.state.build!.heat).toBe(i+1);}
  expect(all.filter(e=>e.type==='gear-proc'&&e.procKind==='lightning')).toHaveLength(3);expect(r.state.build!.strikes).toBe(0);
  expect(r.stats.interval).toBeLessThan(new BladeRun(1,undefined,blade).stats.interval);step(r,121);expect(r.state.build!.heat).toBe(0);
 });
 it('current-health on-hit actually damages every basic target and is capped against bosses',()=>{
  const a=arena(blade),b=arena(blade);fund(b);buy(b,'tideFang');const ea=target(a),eb=target(b);
  strike(a);strike(b);const delta=10000-eb.hp;expect(delta).toBeGreaterThan(10000-ea.hp);expect(delta).toBeLessThanOrEqual(Math.round(b.stats.damage*1.5));
 });
 it('lifesteal uses actual damage, respects a per-second cap and benefits from healing power',()=>{
  const a=arena(blade),b=arena(blade);for(const r of[a,b]){fund(r);buy(r,'bloodFang',3);r.state.hp=40;}
  buy(b,'honeyCharm');b.state.hp=40;for(const r of[a,b])for(let i=0;i<8;i++)target(r,60,i-4);
  strike(a);strike(b);expect(a.state.hp).toBeGreaterThan(40);expect(b.state.hp-40).toBeGreaterThan(a.state.hp-40);
  expect(a.state.build!.healUsed).toBeLessThanOrEqual(a.state.maxHp*.05+1e-9);
  const r=arena(blade);fund(r);buy(r,'bloodFang');r.state.hp=40;const e=target(r,60,0,'armor');e.hp=1;strike(r);expect(r.state.hp-40).toBeCloseTo(.06);
 });
 it('more max HP increases actual aura damage while leaving distant targets untouched',()=>{
  const a=arena(blade),b=arena(blade);for(const r of[a,b]){fund(r);buy(r,'emberPlate',3);}buy(b,'jellyVest',3);
  const ea=target(a),eb=target(b),far=target(b,400);step(a,30);step(b,30);
  expect(10000-eb.hp).toBeGreaterThan(10000-ea.hp);expect(far.hp).toBe(10000);expect(b.state.build!.strikes).toBe(0);expect(b.state.build!.heat).toBe(0);
 });
 it('low-health shield really absorbs damage, healing power enlarges it and cooldown prevents retrigger',()=>{
  const a=arena(blade),b=arena(blade);for(const r of[a,b]){fund(r);buy(r,'bubbleGuard');r.state.hp=20;r.state.invincible=0;}buy(b,'honeyCharm');b.state.hp=20;
  a.damagePlayer(5,'test');b.damagePlayer(5,'test');expect(a.state.hp).toBe(20);expect(b.state.build!.shield).toBeGreaterThan(a.state.build!.shield);
  expect(a.state.build!.shieldCooldown).toBe(16);step(a,181);expect(a.state.build!.shield).toBe(0);expect(a.state.build!.shieldCooldown).toBeGreaterThan(12);
 });
 it('taking damage creates bounded real reflection, including coin and XP credit on a kill',()=>{
  const r=arena(blade);fund(r);buy(r,'thornArmor');const e=target(r,60,0,'armor');e.hp=1;r.state.invincible=0;r.damagePlayer(20,'test');
  expect(r.state.kills).toBe(1);expect(r.state.orbs.filter(o=>o.kind==='coin')).toHaveLength(1);expect(r.state.orbs.filter(o=>o.kind==='xp')).toHaveLength(1);
  expect(r.state.build!.reflectCooldown).toBe(.75);expect(r.state.build!.heat).toBe(0);expect(e.hp).toBeLessThanOrEqual(0);
 });
 it('attack-speed footwear increases native attack count as well as pickup range',()=>{
  const a=arena(blade),b=arena(blade);fund(b);buy(b,'pickupBoots',3);
  for(const r of[a,b]){target(r);r.state.attackTimer=0;}step(a,600);step(b,600);
  expect(b.state.attackCount).toBeGreaterThan(a.state.attackCount);expect(b.coinRange).toBeGreaterThan(a.coinRange);expect(b.stats.magnet).toBeGreaterThan(a.stats.magnet);
 });
 it('dash footwear empowers only the next first contact and is usable by ranged attacks',()=>{
  const a=arena(blade),b=arena(blade);fund(b);buy(b,'springBoots');b.dash();b.state.dashTime=0;
  const ea=target(a),eb=target(b);strike(a);strike(b);expect(10000-eb.hp).toBeGreaterThan(10000-ea.hp);expect(b.state.build!.empowered).toBe(0);expect(b.stats.dashCooldown).toBe(4.45);
 });
 it('gear damage cannot recursively proc crit, lightning, heat or lifesteal',()=>{
  const r=arena(blade);fund(r);for(const id of['emberPlate','thornArmor','clockGrip','stormCoil','bloodFang','sugarCore'] as GearId[])buy(r,id);
  r.state.hp=70;target(r);const hp=r.state.hp;const events=step(r,60);expect(r.state.hp).toBe(hp);expect(r.state.build!.heat).toBe(0);expect(r.state.build!.strikes).toBe(0);
  expect(events.filter(e=>e.source==='gear').every(e=>!e.critical)).toBe(true);expect(events.filter(e=>e.procKind==='lightning')).toEqual([]);
 });
});

describe('persistent build state and compatibility',()=>{
 it('precisely continues heat, chain counter, shield, dash charge, lifesteal budget and money after reload',()=>{
  const r=arena();fund(r);for(const id of['clockGrip','stormCoil','bloodFang','bubbleGuard','honeyCharm','springBoots'] as GearId[])buy(r,id);
  target(r);strike(r);strike(r);r.state.hp=20;r.state.invincible=0;r.damagePlayer(5,'test');r.dash();
  const snapshot=r.snapshot();expect(validSnapshot(snapshot)).toBe(true);const copy=new BladeRun(1,restoreSnapshot(snapshot)!);step(r,40);step(copy,40);expect(copy.snapshot()).toEqual(r.snapshot());
 });
 it('accepts v9 through its old nine-item prices and refunds purchases once into a fresh six-slot build',()=>{
  const s=arena().snapshot();s.version=9;delete s.build;
  s.economy={wallet:200,earned:284,spent:84,gear:{jellyVest:2,bubbleGuard:0,honeyCharm:0,sugarCore:0,clockGrip:0,clearLens:0,breezeBoots:0,springBoots:0,pickupBoots:0},order:['jellyVest'],regen:0} as typeof s.economy;
  s.maxHp=140;s.hp=70;s.time=180;expect(validSnapshot(s)).toBe(true);
  expect(new BladeRun(1,restoreSnapshot(s)!).state.version).toBe(10);
  const upgraded=migrateEconomy(restoreSnapshot(s)!);expect(upgraded.version).toBe(10);expect(upgraded.economy!.wallet).toBe(284);
  expect(upgraded.economy!.order).toEqual([]);expect(upgraded.time).toBe(180);expect(upgraded.hp).toBe(50);expect(validSnapshot(upgraded)).toBe(true);expect(migrateEconomy(structuredClone(upgraded))).toEqual(upgraded);
 });
 it('rejects invalid slots, duplicate boots, refund accounting and transient combat state',()=>{
  const r=arena();fund(r);for(const id of BUILDS.onhit.items)buy(r,id);const s=r.snapshot();
  expect(restoreSnapshot({...s,build:{...s.build,heat:5}})).toBeNull();expect(restoreSnapshot({...s,build:{...s.build,shieldCooldown:17}})).toBeNull();
  expect(validEconomy({...freshEconomy(),refunded:1})).toBe(false);
  const e=structuredClone(s.economy!);e.gear.breezeBoots=1;e.order.push('breezeBoots');expect(validEconomy(e)).toBe(false);
 });
});
