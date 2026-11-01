import {describe,it,expect} from 'vitest';
import {BladeRun,restoreSnapshot,validSnapshot,type Enemy,type RunMode} from '../src/blade/simulation';
import {ACTIVE_SKILLS,freshActive,activePlan} from '../src/blade/active-skills';
import {TIERS,xpNext} from '../src/blade/config';
const idle={x:0,y:0,dash:false};
const run=(blade=0)=>{const r=new BladeRun(418,undefined,blade);r.state.enemies=[];r.state.spawnBudget=-100000;r.state.attackTimer=100000;return r;};
function target(r:BladeRun,x=45,y=0,kind:Enemy['kind']='armor'){const e=r.spawnEnemy(kind,x,y);e.hp=e.maxHp=100000;e.speed=0;e.cooldown=100000;return e;}
function step(r:BladeRun,n=1){for(let i=0;i<n;i++)r.step(1/60,idle);}
describe('historical manual weapon skill compatibility',()=>{
 it('defines a different named, one-button skill for each of the twelve blades',()=>{
  expect(new Set(Object.values(ACTIVE_SKILLS).map(s=>s.name)).size).toBe(15);
  for(const t of TIERS.slice(0,15)){expect(ACTIVE_SKILLS[t.id as keyof typeof ACTIVE_SKILLS].description.length).toBeGreaterThan(10);expect(ACTIVE_SKILLS[t.id as keyof typeof ACTIVE_SKILLS].cooldown).toBeGreaterThanOrEqual(10);}
 });
 it.each(TIERS.slice(0,15).map((_,i)=>i))('weapon %i never casts by itself and consumes one activation only on demand',blade=>{
  const r=run(blade);step(r,120);expect(r.active).toEqual(freshActive());
  expect(r.activateSkill()).toBe(true);expect(r.active.casts).toBe(1);expect(r.active.cooldown).toBe(r.activeInfo!.cooldown);
  const before=r.snapshot();expect(r.activateSkill()).toBe(false);expect(r.snapshot()).toEqual(before);
 });
 it.each(['relic','evolving','boss-intro','relic-trim','dead','won'] as RunMode[])('rejects activation in %s',mode=>{
  const r=run();r.state.mode=mode;const before=r.snapshot();expect(r.activateSkill()).toBe(false);expect(r.snapshot()).toEqual(before);
 });
 it('does not spend a relic slot, dash cooldown, health, XP or passive charge',()=>{
  const r=run();r.state.passive.hits=2;const s=r.snapshot();r.activateSkill();expect(r.state.relics).toEqual(s.relics);expect(r.state.dashCooldown).toBe(0);expect(r.state.hp).toBe(s.hp);expect(r.state.totalXp).toBe(s.totalXp);expect(r.state.passive.hits).toBe(2);
 });
 it('reads the activation edge from movement input and aims at a nearby living target',()=>{
  const r=run(1);target(r,0,80);r.step(1/60,{x:1,y:0,dash:false,active:true});expect(r.active.casts).toBe(1);expect(r.state.aim).toBeCloseTo(Math.PI/2);step(r,60);expect(r.active.casts).toBe(1);
 });
 it('lets cooldown expire in play and freezes cooldown, burst queues and fields during selection',()=>{
  const r=run(1);target(r);r.activateSkill();r.grantXp(xpNext(1));step(r,20);expect(r.state.mode).toBe('playing');expect(r.active.pending).toEqual([]);step(r,601);expect(r.active.cooldown).toBe(0);expect(r.activateSkill()).toBe(true);
 });
 it('strengthens newly released geometry with length and width and captures already released strikes',()=>{
  const r=run(1);r.activateSkill();const old=structuredClone(r.active.pending),small=old[0].radius;r.state.relics.ruler=5;r.state.relics.anvil=5;expect(r.active.pending).toEqual(old);
  r.active.cooldown=0;r.activateSkill();expect(r.active.pending[0].radius).toBeGreaterThan(small);expect(r.active.pending[0].radius).toBeLessThanOrEqual(600);
 });
});
describe('twelve distinct active mechanics',()=>{
 it('Scrap creates a burst and temporary haste rather than granting passive kill stacks',()=>{
  const r=run(),e=target(r),interval=r.stats.interval;r.activateSkill();expect(e.hp).toBeLessThan(e.maxHp);expect(r.stats.interval).toBeLessThan(interval);expect(r.state.passive.stacks).toBe(0);step(r,241);expect(r.stats.interval).toBe(interval);
 });
 it('Dagger lands exactly three directed thrusts, with armor bonus and no rear hits',()=>{
  const r=run(1),front=target(r),rear=target(r,-45),damage=r.stats.damage;r.activateSkill();step(r,16);
  expect(front.maxHp-front.hp).toBe(3*Math.round(Math.round(damage*1.7)*1.5));expect(rear.hp).toBe(rear.maxHp);expect(r.active.pending).toEqual([]);expect(r.state.passive.empowered).toBe(0);
 });
 it('Well Moon creates a stationary gathering field without pulling bosses or emitting passive fan waves',()=>{
  const r=run(2),e=target(r,160),near=target(r,205),boss=target(r,195,0,'boss');r.activateSkill();expect(r.active.fields[0].kind).toBe('vortex');expect(near.x).toBeLessThan(205);expect(boss.x).toBe(195);expect(e.hp).toBeLessThan(e.maxHp);expect(r.state.waves).toEqual([]);
 });
 it('Deer chains to at most six distinct nearby targets and rewards an existing hunt mark',()=>{
  const r=run(3),enemies=Array.from({length:8},(_,i)=>target(r,45+i*80));enemies[1].hunt=4;r.activateSkill();step(r,21);
  expect(enemies.filter(e=>e.hp<e.maxHp)).toHaveLength(6);expect(enemies[1].maxHp-enemies[1].hp).toBeGreaterThan(enemies[0].maxHp-enemies[0].hp);expect(r.state.passive.hits).toBe(0);
 });
 it('Full Moon returns its thrown blade, hitting once on each leg and preserving that phase on reload',()=>{
  const r=run(4),e=target(r,120);r.activateSkill();step(r,47);expect(r.state.waves[0].returning).toBe(true);const copy=new BladeRun(1,restoreSnapshot(r.snapshot())!);copy.state.attackTimer=100000;step(copy,60);
  const restored=copy.state.enemies.find(x=>x.id===e.id)!;expect(restored.maxHp-restored.hp).toBe(2*Math.round(r.stats.damage*2.7));expect(copy.state.waves).toEqual([]);
 });
 it('Dragon Slayer follows the player with a damaging whirlwind without passive roar stuns',()=>{
  const r=run(5),e=target(r);r.activateSkill();const hp=e.hp;expect(e.stun).toBe(0);r.state.player.x=500;const next=target(r,500);step(r,31);expect(next.hp).toBeLessThan(next.maxHp);expect(e.hp).toBe(hp);expect(r.active.fields[0].kind).toBe('spin');
 });
 it('Snow Drinker summons two moving mirror attackers and keeps boss freeze resistance',()=>{
  const r=run(6),boss=target(r,45,0,'boss');r.activateSkill();expect(r.active.fields[0].kind).toBe('mirror');expect(r.mirrorPositions(r.active.fields[0])).toHaveLength(2);const hp=boss.hp;step(r,61);expect(boss.hp).toBeLessThan(hp);expect(boss.freeze).toBe(0);expect(r.state.passive.hits).toBe(0);
 });
 it('Wado performs a 120-unit draw dash and clears nearby bullets without creating its passive shield',()=>{
  const r=run(7),e=target(r,160);r.state.invincible=0;r.state.bullets=[{id:r.state.nextId++,x:100,y:0,vx:0,vy:0,life:3}];r.activateSkill();expect(r.state.player.x).toBeCloseTo(120);expect(r.state.invincible).toBeCloseTo(.45);expect(e.hp).toBeLessThan(e.maxHp);expect(r.state.bullets).toEqual([]);expect(r.state.passive.shield).toBe(false);expect(r.state.dashCooldown).toBe(0);
 });
 it('Shusui prioritizes an elite or boss and deals a separate targeted falling-blade hit',()=>{
  const r=run(8),near=target(r,40),boss=target(r,250,0,'boss');r.activateSkill();expect(boss.hp).toBe(boss.maxHp);step(r,10);expect(near.hp).toBe(near.maxHp);expect(boss.hp).toBeLessThan(boss.maxHp);expect(boss.dragonHits).toBe(0);expect(r.state.waves).toEqual([]);
 });
 it('Enma drains life on actual hits, is bounded and respects redmoon healing reduction',()=>{
  const r=run(9);r.state.hp=30;for(let i=0;i<20;i++)target(r,50+i);r.activateSkill();expect(r.state.hp).toBe(50);expect(r.state.passive.hits).toBe(0);
  const empty=run(9);empty.state.hp=30;empty.activateSkill();expect(empty.state.hp).toBe(30);
  const red=run(9);red.state.relics.redmoon=5;red.state.hp=30;for(let i=0;i<20;i++)target(red,50+i);red.activateSkill();expect(red.state.hp).toBeCloseTo(38);
 });
 it('Ryujin leaves a fixed fire area that damages new arrivals and survives player movement',()=>{
  const r=run(10);target(r,160);r.activateSkill();r.state.player.x=600;const arrival=target(r,160);step(r,31);expect(arrival.hp).toBeLessThan(arrival.maxHp);expect(arrival.burnTime).toBeGreaterThan(0);expect(r.active.fields[0].x).toBe(160);
 });
 it('Tensa slows hostile movement and projectiles while keeping real-time clocks and player DOT ticks',()=>{
  const a=run(11),b=run(11);for(const r of [a,b]){const e=target(r,300);e.speed=100;e.poisonTime=2.5;e.poisonDamage=7;r.state.bullets=[{id:r.state.nextId++,x:600,y:200,vx:100,vy:0,life:3}];}
  a.activateSkill();step(a,60);step(b,60);expect(a.state.enemies[0].x).toBeGreaterThan(b.state.enemies[0].x);expect(a.state.bullets[0].x).toBeCloseTo(640);expect(b.state.bullets[0].x).toBeCloseTo(700);expect(a.state.time).toBeCloseTo(b.state.time);expect(a.state.enemies[0].hp).toBe(b.state.enemies[0].hp);expect(a.state.waves).toEqual([]);
 });
});
describe('active rewards, safety and saves',()=>{
 it('drops each killed reward once even with 5000 scattered XP objects and repeated active ticks',()=>{
  const r=run(5);for(let i=0;i<5000;i++)r.addOrb(1000+i,2000,1,'xp');const e=target(r,140);e.hp=1;r.activateSkill();step(r,200);expect(r.state.kills).toBe(1);expect(r.state.orbs.filter(o=>o.kind==='xp')).toHaveLength(5001);expect(r.state.totalXp).toBe(0);
 });
 it('restores pending burst timing, fields, cooldown and cast count without replaying the first hit',()=>{
  for(const blade of [1,2,3,5,6,8,10,11]){
   const r=run(blade);target(r);r.activateSkill();const before=r.snapshot();expect(validSnapshot(before)).toBe(true);const copy=new BladeRun(1,restoreSnapshot(before)!);step(r,50);step(copy,50);expect(copy.snapshot()).toEqual(r.snapshot());
  }
 });
 it('accepts old v7 saves without this optional component and initializes a ready skill on continue',()=>{
  const r=run();const old=r.snapshot();delete old.active;const restore=restoreSnapshot(old)!;expect(restore).toEqual(old);const copy=new BladeRun(1,restore);expect(copy.active).toEqual(freshActive());expect(copy.state.rng).toBe(old.rng);
 });
 it('rejects corrupted active timing, geometry, fields, counter and returning-wave state',()=>{
  const r=run(),s=r.snapshot();
  for(const active of [{...freshActive(),cooldown:NaN},{...freshActive(),buff:99},{...freshActive(),casts:-1},{...freshActive(),pending:[{kind:'steel',delay:0,angle:0,arc:360,radius:601,damage:1}]},{...freshActive(),fields:[{kind:'spin',x:0,y:0,life:20,duration:20,tick:0,radius:100,damage:3}]}])expect(restoreSnapshot({...s,active})).toBeNull();
  expect(restoreSnapshot({...s,waves:[{id:100,x:0,y:0,angle:0,distance:0,maxRange:300,damage:5,pierce:3,hit:[],tier:4,kind:'moon',returning:true}]})).toBeNull();
 });
});
