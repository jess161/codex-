import {describe,it,expect} from 'vitest';
import {BladeRun,restoreSnapshot,validSnapshot,type Enemy} from '../src/blade/simulation';
import {GAME_DURATION,BOSS_DURATION,MIN_FORM_TIME,CLASSIC_TIMING,classicXpNext,xpNext,TIERS} from '../src/blade/config';
import {RELIC_IDS,RELICS,RELIC_CAP,BASE_RELIC_IDS,ownedRelics,type RelicId} from '../src/blade/relics';
import {freshRelicLoot,drawRelic,dropCandidates} from '../src/blade/relic-loot';
const idle={x:0,y:0,dash:false};
function run(seed=35,blade=0){const r=new BladeRun(seed,undefined,blade);r.state.enemies=[];r.state.spawnBudget=-100000;r.state.attackTimer=100000;r.state.eliteIndex=4;return r;}
function step(r:BladeRun,n=1){for(let i=0;i<n;i++)r.step(1/60,idle);}
function give(r:BladeRun,id:RelicId){const d=r.addRelicDrop(id,r.state.player.x,r.state.player.y)!;d.spawn=0;expect(r.pickupRelic(d.id)).toBe(true);return d;}
function kill(r:BladeRun,kind:Enemy['kind']='blob',x=150,y=0){const e=r.spawnEnemy(kind,x,y);e.hp=1;e.speed=0;return (r as unknown as {hitEnemy(e:Enemy,n:number,a:number):boolean}).hitEnemy(e,10000,0);}
function v7(r:BladeRun){const s=r.snapshot();const {classicTiming,relicDrops,relicLoot,...old}=s;return {...old,version:7};}
describe('continuous short rounds',()=>{
 it('uses six-minute survival and a 45-second boss deadline',()=>{const r=run();expect(r.duration).toBe(360);expect(r.bossDuration).toBe(45);expect(r.duration+r.bossDuration).toBeLessThanOrEqual(420);expect(r.practiceTime).toBe(45);});
 it('levels immediately without pending choices, stops or losing the held movement',()=>{
  const r=run(),base=r.stats;r.state.velocity={x:100,y:0};r.grantXp(xpNext(1));expect(r.state.level).toBe(2);expect(r.state.hp).toBe(102);expect(r.state.maxHp).toBe(102);expect(r.stats.damage).toBeGreaterThan(base.damage);expect(r.state.mode).toBe('playing');expect(r.state.pending).toEqual([]);expect(r.state.choices).toEqual([]);r.step(1/60,{x:1,y:0,dash:false});expect(r.state.player.x).toBeGreaterThan(0);expect(r.state.relics.stone).toBe(0);
 });
 it('banks excess XP at practice boundaries and reaches all stages without a choice screen',()=>{
  const r=run();r.grantXp(10000);expect(r.state.level).toBe(5);let stages=0;
  for(let i=0;i<MIN_FORM_TIME*4*60+2;i++){r.step(1/60,{x:1,y:0,dash:false});stages+=r.events.filter(e=>e.type==='evolve').length;expect(r.state.mode).toBe('playing');expect(r.state.pending).toEqual([]);}
  expect(r.state.level).toBe(30);expect(stages).toBe(4);expect(r.state.maxHp).toBe(158);expect(r.state.totalXp).toBe(10000);expect(r.state.player.x).toBeGreaterThan(10000);
 });
});
describe('physical collectible loot without an equipment cap',()=>{
 it('shows all thirty types as eligible and lets the player own more than five without replacement',()=>{
  const r=run();for(const id of RELIC_IDS)give(r,id);expect(ownedRelics(r.state.relics)).toHaveLength(30);expect(r.relicOrder).toEqual(RELIC_IDS);expect(validSnapshot(r.snapshot())).toBe(true);expect(restoreSnapshot(r.snapshot())).toEqual(r.snapshot());
 });
 it('adds new icons in pickup order and upgrades the same entry instead of duplicating it',()=>{
  const r=run();for(const id of ['prism','stone','food','stone'] as RelicId[])give(r,id);expect(r.relicOrder).toEqual(['prism','stone','food']);expect(r.state.relics.stone).toBe(2);expect(r.state.relicLoot.picked).toBe(4);
 });
 it('requires actual proximity and a settled drop and never magnetizes item positions',()=>{
  const r=run();r.state.relics.magnet=5;const a=r.addRelicDrop('stone',50,0)!,b=r.addRelicDrop('prism',1000,500)!;
  expect(r.pickupRelic(a.id)).toBe(false);step(r,180);expect(r.state.relics.stone).toBe(0);expect(a.x).toBe(50);expect(b).toMatchObject({x:1000,y:500});r.state.player.x=50;step(r);expect(r.state.relics.stone).toBe(1);expect(r.state.relicDrops).toHaveLength(1);expect(r.state.mode).toBe('playing');
 });
 it('picks up one drop once and never upgrades it again from repeated collisions',()=>{
  const r=run(),d=r.addRelicDrop('stone',0,0)!;expect(r.pickupRelic(d.id)).toBe(false);step(r,18);expect(r.state.relics.stone).toBe(1);expect(r.pickupRelic(d.id)).toBe(false);step(r,100);expect(r.state.relics.stone).toBe(1);
 });
 it('maxes a collected item at five and excludes it from every future candidate pool',()=>{
  const r=run();for(let i=0;i<5;i++)give(r,'stone');expect(r.state.relics.stone).toBe(RELIC_CAP);expect(r.availableRelics).not.toContain('stone');expect(dropCandidates(r.state.relics,1,r.stats.range)).not.toContain('stone');
 });
 it('turns already-dropped surplus into separate XP at its own location, never remotely crediting it',()=>{
  const r=run();for(let i=0;i<4;i++)give(r,'stone');const a=r.addRelicDrop('stone',1000,500)!,b=r.addRelicDrop('stone',1200,550)!;give(r,'stone');expect(r.state.relicDrops).toEqual([]);expect(r.state.totalXp).toBe(0);expect(r.state.orbs).toEqual([{id:a.id,x:1000,y:500,value:10,kind:'xp',dropTimer:.22},{id:b.id,x:1200,y:550,value:10,kind:'xp',dropTimer:.22}]);
 });
 it('turns max-level XP candy into ground XP and keeps the old legacy choice group as one entitlement',()=>{
  const r=run();const drop=r.addRelicDrop('star',500,500)!;r.state.level=29;r.state.formStartedAt=0;r.state.time=200;r.grantXp(xpNext(29));expect(r.state.level).toBe(30);expect(r.state.relicDrops).toEqual([]);expect(r.state.orbs.find(o=>o.id===drop.id)).toMatchObject({x:500,y:500,value:10});
 });
 it('keeps all dropped items and their unique IDs through save/load, lite mode and boss entry',()=>{
  const r=run();for(let i=0;i<2000;i++)r.addRelicDrop(RELIC_IDS[i%30],1500+i,2000+i%17);const drops=structuredClone(r.state.relicDrops);step(r,30);expect(r.state.relicDrops.map(d=>({...d,spawn:.28}))).toEqual(drops);const copy=new BladeRun(1,restoreSnapshot(r.snapshot())!);copy.simplified=true;copy.state.time=copy.duration-.01;step(copy);expect(copy.state.mode).toBe('boss-intro');expect(copy.state.relicDrops).toEqual(r.state.relicDrops);expect(new Set(copy.state.relicDrops.map(d=>d.id)).size).toBe(2000);
 });
 it('retains all 5000 scattered XP rewards and still drops new XP and items from native kills',()=>{
  const r=run();for(let i=0;i<5000;i++)r.addOrb(1500+i,1000,1,'xp');r.state.time=30;kill(r,'blob',180,20);expect(r.state.relicDrops).toHaveLength(1);expect(r.state.relicDrops[0]).toMatchObject({x:180,y:20});expect(r.state.orbs.filter(o=>o.kind==='xp')).toHaveLength(5001);expect(r.state.totalXp).toBe(0);
 });
});
describe('rare drops, guaranteed rewards and independent randomness',()=>{
 it('never drops a normal item before twenty seconds and guarantees the next kill at thirty',()=>{
  const r=run();r.state.time=19;for(let i=0;i<50;i++)kill(r);expect(r.state.relicDrops).toEqual([]);r.state.time=30;kill(r);expect(r.state.relicDrops).toHaveLength(1);expect(['stone','ruler','anvil','ember','echo','comet']).toContain(r.state.relicDrops[0].relic);
 });
 it('prevents rapid repeated normal rewards and has an elapsed-time pity guarantee',()=>{
  const r=run();r.state.time=30;kill(r);r.state.time=60;for(let i=0;i<100;i++)kill(r);expect(r.state.relicLoot.normalDrops).toBe(1);r.state.time=96;kill(r);expect(r.state.relicLoot.normalDrops).toBe(2);
 });
 it('guarantees an epic-or-better item from a credited elite kill plus its XP and healing bread',()=>{
  const r=run();kill(r,'elite',200,30);const drop=r.state.relicDrops[0];expect(drop).toMatchObject({x:200,y:30});expect(['epic','legendary','mythic','chaos']).toContain(RELICS[drop.relic].rarity);expect(r.state.orbs.some(o=>o.kind==='xp')).toBe(true);expect(r.state.orbs.some(o=>o.food==='bread')).toBe(true);
 });
 it('uses seeded relic randomness without rerolling combat or food',()=>{
  const a=run(13),b=run(13);a.state.time=b.state.time=30;b.state.relicLoot.rng=999;
  for(const r of [a,b])kill(r,'blob',150);expect(a.state.rng).toBe(b.state.rng);expect(a.state.lootRng).toBe(b.state.lootRng);expect(a.state.orbs).toEqual(b.state.orbs);const before=a.snapshot();for(let i=0;i<100;i++){a.availableRelics;a.relicOrder;}expect(a.snapshot()).toEqual(before);
 });
 it('keeps all six qualities reachable in weighted draws after the special first reward',()=>{
  const r=run(),l=freshRelicLoot(53),seen=new Set<string>();l.totalDropped=1;for(let i=0;i<10000;i++){const id=drawRelic(l,[...RELIC_IDS],r.state.relics,20,false)!;seen.add(RELICS[id].rarity);}expect(seen.size).toBe(6);
 });
 it('never awards an item, food or credited kill for a bomber that self-detonates',()=>{
  const r=run();r.state.time=30;r.state.invincible=100;const e=r.spawnEnemy('bomber',30,0);e.action='windup';e.timer=.001;step(r);expect(r.state.relicDrops).toEqual([]);expect(r.state.kills).toBe(0);expect(r.state.orbs.every(o=>o.kind==='xp')).toBe(true);
 });
 it('does not produce invalid fallback items when every useful item is already maxed',()=>{
  const r=run();for(const id of RELIC_IDS)r.state.relics[id]=5;r.state.level=30;r.state.time=300;kill(r,'elite');expect(r.state.relicDrops).toEqual([]);expect(r.state.orbs.some(o=>o.kind==='xp')).toBe(true);
 });
});
describe('v8 migration without discarding old progress',()=>{
 it('migrates a normal v7 run preserving exact XP, HP, RNG, active skills and old ten-minute timing',()=>{
  const r=run();give(r,'heart');r.state.level=10;r.state.time=500;r.state.totalXp=1000;r.state.xp=20;r.activateSkill();const old=v7(r),text=JSON.stringify(old),s=restoreSnapshot(old)!;expect(s.version).toBe(8);expect(s.mode).toBe('playing');expect(s.relics).toEqual(old.relics);expect(s.hp).toBe(old.hp);expect(s.maxHp).toBe(old.maxHp);expect(s.totalXp).toBe(old.totalXp);expect(s.xp).toBe(20);expect(s.rng).toBe(old.rng);expect(s.active).toEqual(old.active);const copy=new BladeRun(1,s);expect(copy.duration).toBe(600);expect(copy.bossDuration).toBe(90);expect(copy.practiceTime).toBe(75);expect(copy.xpNeeded).toBe(classicXpNext(10));expect(JSON.stringify(old)).toBe(text);expect(restoreSnapshot(s)).toEqual(s);
 });
 it('keeps every item from an overloaded v7 trim screen and resumes without requesting five selections',()=>{
  const r=run();r.state.level=14;for(const id of BASE_RELIC_IDS)r.state.relics[id]=1;const old={...v7(r),mode:'relic-trim',relicResume:'playing'};const s=restoreSnapshot(old)!;expect(s.mode).toBe('playing');expect(ownedRelics(s.relics)).toHaveLength(12);expect(s.relics).toEqual(old.relics);expect(s.relicResume).toBeUndefined();expect(new BladeRun(1,s).relicOrder).toHaveLength(12);
 });
 it('places an unclaimed v7 choice as three ground alternatives, letting only one be picked',()=>{
  const r=run();r.state.level=2;const old={...v7(r),mode:'relic',pending:[2],choices:['stone','ruler','heart']};const s=restoreSnapshot(old)!;expect(s.mode).toBe('playing');expect(s.pending).toEqual([]);expect(s.choices).toEqual([]);expect(s.relicDrops.map(d=>d.relic)).toEqual(old.choices);expect(new Set(s.relicDrops.map(d=>d.group)).size).toBe(1);const copy=new BladeRun(1,s);const d=copy.state.relicDrops[1];copy.state.player={x:d.x,y:d.y};expect(copy.pickupRelic(d.id)).toBe(true);expect(copy.state.relics.ruler).toBe(1);expect(copy.state.relicDrops).toEqual([]);expect(copy.state.rng).toBe(old.rng);expect(restoreSnapshot(copy.snapshot())).toEqual(copy.snapshot());
 });
 it('preserves skip-only legacy rewards as an individual ground XP object',()=>{
  const r=run();r.state.level=30;const old={...v7(r),mode:'relic',pending:[30],choices:[]};const s=restoreSnapshot(old)!;expect(s.mode).toBe('playing');expect(s.orbs.at(-1)).toMatchObject({kind:'xp',value:10});expect(s.totalXp).toBe(old.totalXp);
 });
 it('rejects corrupt loot state, duplicate IDs, bad ranks and fabricated pending menus',()=>{
  const r=run(),s=r.snapshot(),d={id:100,relic:'stone',x:100,y:100,spawn:0};
  for(const bad of [{...s,version:'8'},{...s,classicTiming:'yes'},{...s,relicLoot:{...s.relicLoot,rng:NaN}},{...s,relicLoot:{...s.relicLoot,order:['stone','stone']}},{...s,relicDrops:[d,d]},{...s,relicDrops:[{...d,relic:'missing'}]},{...s,relicDrops:[{...d,spawn:-1}]},{...s,pending:[1]},{...s,choices:['stone']},{...s,relics:{...s.relics,stone:6}}])expect(restoreSnapshot(bad)).toBeNull();
 });
});
