import {describe,it,expect} from 'vitest';
import {BladeRun,restoreSnapshot,validSnapshot} from '../src/blade/simulation';
import {TIERS,BLADE_CATALOGUE} from '../src/blade/config';
import {freshArchery,validArchery} from '../src/blade/bows';
const idle={x:0,y:0,dash:false};
function run(index=12){const r=new BladeRun(104,undefined,index);r.state.enemies=[];r.state.spawnBudget=-100000;r.state.eliteIndex=4;return r;}
function advance(r:BladeRun,n=1,input=idle){for(let i=0;i<n;i++)r.step(1/60,input);}
function target(r:BladeRun,x=120,y=0,kind:'armor'|'blob'|'boss'|'elite'='armor'){const e=r.spawnEnemy(kind,x,y);e.speed=0;e.cooldown=10000;e.hp=e.maxHp=10000;return e;}
describe('three real ranged loadouts',()=>{
 it('appends bows without renumbering the original twelve and exposes their complete catalogue',()=>{
  expect(TIERS.slice(0,12).map(t=>t.id)).toEqual(['scrap','dark-dagger','well-moon','deer-cutter','full-moon','dragon-slayer','snow-drinker','wado','shusui','enma','ryujin','tensa']);
  expect(TIERS.slice(12,15).map(t=>t.id)).toEqual(['wind-bow','frost-bow','ember-bow']);expect(BLADE_CATALOGUE).toHaveLength(4);
  for(const i of [12,13,14]){const r=run(i);expect(r.isRanged).toBe(true);expect(r.passiveInfo.name).toBeTruthy();expect(r.activeInfo!.name).toBeTruthy();expect(r.stats.waveEvery).toBe(0);expect(r.stats.moveSpeed).toBeGreaterThan(190);expect(validSnapshot(r.snapshot())).toBe(true);}
 });
 it.each([12,13,14])('automatically fires weapon %i at a distant live target while moving',index=>{
  const r=run(index),e=target(r,180);advance(r,90,{x:0,y:1,dash:false});expect(e.hp).toBeLessThan(e.maxHp);expect(r.archery.shots).toBeGreaterThan(0);expect(r.state.player.y).toBeGreaterThan(150);expect(r.state.mode).toBe('playing');
 });
 it('never fires at an enemy which is dead, still spawning or outside range',()=>{
  const r=run();target(r,700);const dead=target(r,30);dead.hp=0;const cue=target(r,60);cue.spawn=10;advance(r,60);expect(r.archery.shots).toBe(0);
 });
 it('only auto-targets enemies visible in the current viewport',()=>{
  const r=run();r.view={width:200,height:200};const e=target(r,150);advance(r,45);expect(r.archery.shots).toBe(0);e.x=80;advance(r,20);expect(r.archery.shots).toBe(1);
 });
 it('sweeps fast arrows through targets in order and never hits one enemy twice',()=>{
  const r=run(),a=target(r,40),b=target(r,58);r.state.attackTimer=0;advance(r,10);r.state.attackTimer=10000;
  for(const e of [a,b]){e.knockX=e.knockY=0;e.x=e===a?40:58;}
  advance(r,25);expect(a.maxHp-a.hp).toBe(18);expect(b.maxHp-b.hp).toBe(18);
 });
 it('adds two bonus wind arrows on the fourth normal release without recursively adding more',()=>{
  const r=run();target(r);r.archery.shots=3;advance(r,24);r.state.attackTimer=10000;expect(r.archery.shots).toBe(4);expect(r.events.filter(e=>e.type==='slash')).toEqual([]);expect(r.archery.arrows.length).toBeLessThanOrEqual(3);advance(r,30);expect(r.archery.shots).toBe(4);
 });
 it('wind Q releases three timed volleys, costs no inventory and obeys its cooldown',()=>{
  const r=run();target(r,200);r.state.attackTimer=10000;expect(r.activateSkill()).toBe(true);expect(r.archery.arrows).toHaveLength(3);expect(r.archery.bursts).toHaveLength(2);expect(r.activateSkill()).toBe(false);advance(r,16);expect(r.archery.bursts).toEqual([]);expect(r.active.casts).toBe(1);expect(r.state.relicLoot.picked).toBe(0);
 });
 it('one frost volley adds at most one chill layer per target and cannot freeze a strong enemy',()=>{
  const r=run(13),e=target(r,45,0,'boss');r.state.attackTimer=0;advance(r,35);expect(e.chillStacks).toBe(1);expect(e.freeze).toBe(0);expect(e.slow).toBeLessThanOrEqual(.15);expect(r.archery.shots).toBe(1);
 });
 it('three distinct frost volleys freeze an ordinary target, with a four-second immunity window',()=>{
  const r=run(13),e=target(r,80);advance(r,150);expect(e.freezeCooldown).toBeGreaterThan(0);expect(e.chillStacks).toBe(3);expect(e.freeze).toBeLessThanOrEqual(.65);expect(r.archery.shots).toBe(3);
 });
 it('ice rain persists at the target and applies six pulses with the same bounded area',()=>{
  const r=run(13),e=target(r,150);r.state.attackTimer=10000;r.activateSkill();expect(r.archery.rains[0]).toMatchObject({x:150,y:0,radius:100,ticks:5});advance(r,145);expect(r.archery.rains).toEqual([]);expect(e.maxHp-e.hp).toBe(6*Math.round(r.stats.damage*.4));
 });
 it('normal fire arrows damage the direct target once and splash a separate neighbor',()=>{
  const r=run(14),a=target(r,90),b=target(r,95,40);advance(r,60);r.state.attackTimer=10000;
  expect(a.maxHp-a.hp).toBe(42);expect(b.maxHp-b.hp).toBe(Math.round(42*.65));expect(a.burnTime).toBeGreaterThan(0);expect(b.burnTime).toBeGreaterThan(0);
 });
 it('active fire impacts top up the larger blast instead of adding two full direct hits',()=>{
  const r=run(14),e=target(r,150);r.state.attackTimer=10000;r.activateSkill();advance(r,16);
  expect(e.maxHp-e.hp).toBe(Math.round(42*2.2));expect(r.archery.arrows).toEqual([]);expect(e.burnTime).toBeGreaterThan(0);
 });
 it('elemental equipment strengthens the fire bow native burn instead of being lost beneath it',()=>{
  const plain=run(14),enhanced=run(14),a=target(plain,90),b=target(enhanced,90);enhanced.state.relics.prism=1;
  advance(plain,60);advance(enhanced,60);expect(b.burnDamage).toBeGreaterThan(a.burnDamage);expect(b.maxHp-b.hp).toBe(a.maxHp-a.hp);
 });
 it('range, width and haste items change future shots while arrows already released keep their dimensions',()=>{
  const r=run();target(r,260);advance(r,22);r.state.attackTimer=10000;const old=structuredClone(r.archery.arrows[0]),before=r.stats;
  for(const id of ['ruler','anvil','hourglass'] as const){const d=r.addRelicDrop(id,0,0)!;d.spawn=0;r.pickupRelic(d.id);}
  expect(r.stats.range).toBeGreaterThan(before.range);expect(r.stats.widthScale).toBeGreaterThan(before.widthScale);expect(r.stats.interval).toBeLessThan(before.interval*1.1);
  expect(r.archery.arrows[0].remaining).toBe(old.remaining);expect(r.archery.arrows[0].width).toBe(old.width);expect(r.archery.arrows[0].damage).toBe(old.damage);
 });
 it('attack-count relics trigger once per volley rather than once per scatter pellet',()=>{
  const r=run(13);target(r,40);r.state.relics.echo=1;advance(r,32);r.state.attackTimer=10000;expect(r.state.relicState.echo).toBe(1);
 });
 it.each([12,13,14])('save/load preserves weapon %i flight, active geometry, RNG and scattered rewards',index=>{
  const r=run(index);target(r,230);r.state.attackTimer=0;advance(r,10);r.activateSkill();r.addOrb(3000,4000,3,'xp');r.addOrb(1500,2500,8,'heal');r.addRelicDrop('heart',1700,2800);
  const s=r.snapshot(),restored=restoreSnapshot(s);expect(restored).not.toBeNull();expect(new BladeRun(1,restored!).snapshot()).toEqual(s);expect(r.state.rng).toBe(s.rng);expect(validArchery(s.archery)).toBe(true);
 });
 it('accepts old v8 runs without archery and rejects corrupt projectile components',()=>{
  const old=new BladeRun(31).snapshot();delete old.archery;expect(restoreSnapshot(old)).toEqual(old);
  const r=run();target(r,250);advance(r,22);const s=r.snapshot();expect(s.archery!.arrows.length).toBeGreaterThan(0);
  for(const patch of [{shots:-1},{arrows:[{...s.archery!.arrows[0],speed:NaN}]},{arrows:[{...s.archery!.arrows[0],hit:[4,4],dealt:[1,1]}]},{bursts:[{delay:100}]},{rains:[{life:Infinity}]},{procs:[1,1]}])expect(restoreSnapshot({...s,archery:{...freshArchery(),...patch}})).toBeNull();
 });
});
