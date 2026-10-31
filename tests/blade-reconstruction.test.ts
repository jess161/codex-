import { describe,it,expect } from 'vitest';
import { BladeRun,restoreSnapshot,validSnapshot } from '../src/blade/simulation';
import { BladeDrag,dragOpacity,frictionProfile } from '../src/blade/blade-drag';
import { bladeBackGeometry } from '../src/blade/blade-back';
import { BLADE_SHAPES } from '../src/blade/assets/candy/blade-shapes';
import { cameraImpulse,impactFeedback,bladePresentation } from '../src/blade/feedback';
import { combatPower } from '../src/blade/power';
import { displayProfile } from '../src/blade/display';
import { stalkerCloaked,THREATS } from '../src/blade/threats';
import { TIERS,ENEMIES,encounterKind } from '../src/blade/config';
const idle={x:0,y:0,dash:false};
const run=()=>{const r=new BladeRun(88);r.state.enemies=[];r.state.spawnBudget=-100000;r.state.attackTimer=100000;return r;};
const steps=(r:BladeRun,n:number)=>{for(let i=0;i<n;i++)r.step(1/60,idle);};
const strike=(r:BladeRun)=>{const t=r.stats;r.state.swing={id:r.state.nextId++,tier:r.tier,angle:0,age:t.windup+t.strike*.45,resolved:false,...{windup:t.windup,strike:t.strike,recovery:t.recovery}};steps(r,1);};
const contact=(x:number,extra={})=>({x,y:30,player:{x,y:0},range:72,widthScale:1,mass:1,color:0x74b7ee,...extra});

describe('stationary independent XP drops',()=>{
  it('preserves 5000 separate rewards, positions and values through save/load and boss entry',()=>{
    const r=run();for(let i=0;i<5000;i++)r.addOrb(1000+i*3,500+i%17,1+i%3,'xp');
    const orbs=structuredClone(r.state.orbs);steps(r,30);
    expect(r.state.orbs.map(({dropTimer,...o})=>o)).toEqual(orbs.map(({dropTimer,...o})=>o));expect(r.state.totalXp).toBe(0);
    expect(new Set(r.state.orbs.map(o=>o.id)).size).toBe(5000);expect(validSnapshot(r.snapshot())).toBe(true);
    const restored=new BladeRun(1,restoreSnapshot(r.snapshot())!);expect(restored.state.orbs).toEqual(r.state.orbs);
    restored.simplified=true;restored.state.time=599.99;steps(restored,1);expect(restored.state.orbs).toEqual(r.state.orbs);expect(restored.state.totalXp).toBe(0);
  });
  it('native kills continue dropping new rewards when thousands remain elsewhere',()=>{
    const r=run();for(let i=0;i<5000;i++)r.addOrb(1000+i,1000,1,'xp');
    const e=r.spawnEnemy('blob',45,0);e.hp=1;e.speed=0;strike(r);
    expect(r.state.orbs).toHaveLength(5001);expect(r.state.orbs.at(-1)).toMatchObject({value:ENEMIES.blob.xp});expect(r.state.kills).toBe(1);
  });
  it('delays pickup by .22 seconds, then credits once only inside the magnet',()=>{
    const r=run();r.addOrb(0,0,3,'xp');r.addOrb(500,500,4,'xp');steps(r,12);expect(r.state.totalXp).toBe(0);steps(r,2);expect(r.state.totalXp).toBe(3);steps(r,60);
    expect(r.state.totalXp).toBe(3);expect(r.state.orbs).toHaveLength(1);expect(r.state.orbs[0]).toMatchObject({x:500,y:500,value:4});
  });
  it('accepts older v6 saves without new optional fields and rejects invalid hazards',()=>{
    const s=run().snapshot();delete s.hazards;expect(restoreSnapshot(s)).toEqual(s);
    expect(validSnapshot({...s,hazards:[{id:9,kind:'poison',x:0,y:0,radius:56,age:0,duration:3.2,damage:3}]})).toBe(true);
    expect(validSnapshot({...s,hazards:[{id:9,kind:'poison',x:0,y:0,radius:NaN,age:0,duration:3.2,damage:3}]})).toBe(false);
  });
});
describe('projected dragging blade and independent visual budget',()=>{
  it('rests at 45 degrees with a quarter-width face and opens fully during the strike',()=>{
    const d=new BladeDrag();expect(d.inclination).toBe(Math.PI/4);expect(d.presentation(null).faceScale).toBeCloseTo(.25);
    expect(d.presentation({age:.15,windup:.1,strike:.2,recovery:.2}).faceScale).toBe(1);
    expect(d.presentation({age:.5,windup:.1,strike:.2,recovery:.2}).faceScale).toBeCloseTo(.25,6);
  });
  it('uses each sprite contour for the bevel and shares its actual projected nose',()=>{
    for(let i=0;i<12;i++) {const p={length:200,fullHeight:100,range:250,widthScale:3,mass:4,inclination:Math.PI/4,opening:0,faceScale:.25},g=bladeBackGeometry(i,p),tip=BLADE_SHAPES[i].samples.at(-1)!;
      expect(g.tip.x).toBe(200);expect(g.tip.y).toBeCloseTo(tip.edge*25);expect(g.thickness).toBeGreaterThan(0);expect(g.outline.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);
    }
  });
  it('changes inclination with motion and turns a heavy blade more slowly',()=>{
    const light=new BladeDrag(),heavy=new BladeDrag();for(let i=0;i<8;i++){light.pose(1/60,{x:1,y:0},1,false,{speed:210,range:72});heavy.pose(1/60,{x:1,y:0},8,false,{speed:210,range:400});}
    expect(light.inclination).not.toBe(Math.PI/4);expect(Math.abs(light.angle-Math.PI*.3)).toBeGreaterThan(Math.abs(heavy.angle-Math.PI*.3));
    for(const d of [light,heavy])expect(d.inclination).toBeGreaterThanOrEqual(Math.PI*35/180);
  });
  it('leaves colored marks, grows sparks with dimensions, and never emits at rest or on growth',()=>{
    const d=new BladeDrag();d.update(1/60,contact(0),false);d.update(1/60,contact(10),false);expect(d.marks.length).toBeGreaterThan(0);expect(d.sparks.length).toBeGreaterThan(0);
    const m=d.marks[0],alpha=dragOpacity(m);d.update(.1,contact(10),false);expect(dragOpacity(m)).toBeLessThan(alpha);const count=d.sparks.length;
    d.update(1/60,contact(10,{range:400,widthScale:5}),false);expect(d.sparks.length).toBeLessThanOrEqual(count);expect(d.marks[0].color).toBe(0x74b7ee);
    expect(frictionProfile(420,8).sparkScale).toBeCloseTo(3.4);
    const light=new BladeDrag(),heavy=new BladeDrag(),wide=new BladeDrag();
    for(const x of [0,10]) { light.update(1/60,contact(x),false);heavy.update(1/60,contact(x,{mass:10}),false);wide.update(1/60,contact(x,{widthScale:5,range:400}),false); }
    expect(light.sparks.map(p=>p.size)).toEqual(heavy.sparks.map(p=>p.size));
    expect(wide.sparks[0].size).toBeGreaterThan(light.sparks[0].size);
  });
  it('freezes marks and sparks during pause and respects reduced motion and lite limits',()=>{
    const d=new BladeDrag();for(let i=0;i<500;i++)d.update(1/60,contact(i*7),false);expect(d.marks.length).toBeLessThanOrEqual(320);expect(d.sparks.length).toBeLessThanOrEqual(40);
    const marks=structuredClone(d.marks),sparks=structuredClone(d.sparks);d.update(0,contact(3493),false);expect(d.marks).toEqual(marks);expect(d.sparks).toEqual(sparks);
    d.update(1/60,contact(3500),true,true);expect(d.marks.length).toBeLessThanOrEqual(112);expect(d.sparks).toHaveLength(0);
    d.update(.05,undefined,true);expect(d.sparkFlash).toBe(0);
  });
});
describe('poison, bomber and stalker counterplay',()=>{
  it('introduces all three at their own times and enforces their population caps',()=>{
    for(const kind of ['poison','bomber','stalker'] as const){const time=THREATS[kind].from;const pool=(t:number,counts={})=>Array.from({length:1000},(_,i)=>encounterKind(t,i/1000,counts));expect(pool(time-.1)).not.toContain(kind);expect(pool(time)).toContain(kind);expect(pool(590,{[kind]:THREATS[kind].cap})).not.toContain(kind);}
  });
  it('locks a poison target before casting, applies global invulnerability and stops damage after leaving',()=>{
    const r=run(),e=r.spawnEnemy('poison',160,0);e.cooldown=0;e.speed=0;steps(r,1);expect(e.timer).toBe(.85);r.state.player.y=100;steps(r,52);
    const h=r.state.hazards![0];expect(h).toMatchObject({kind:'poison',x:0,y:0,radius:56});expect(r.state.hp).toBe(100);
    r.state.invincible=0;r.state.player={x:0,y:0};steps(r,1);expect(r.state.hp).toBe(97);steps(r,20);expect(r.state.hp).toBe(97);r.state.player.y=200;steps(r,70);expect(r.state.hp).toBe(97);
  });
  it('bounds poison areas and freezes the cast countdown while frozen',()=>{
    const r=run();r.simplified=true;for(let i=0;i<5;i++){const e=r.spawnEnemy('poison',160,i);e.cooldown=0;e.speed=0;}steps(r,1);const e=r.state.enemies[0];e.freeze=1;const timer=e.timer;steps(r,30);expect(e.timer).toBe(timer);steps(r,90);expect(r.state.hazards!.length).toBeLessThanOrEqual(4);
  });
  it('self-detonates once after its warning, drops XP, and earns no kill or story stack',()=>{
    const r=run(),e=r.spawnEnemy('bomber',60,0);e.cooldown=0;e.speed=0;r.state.invincible=0;steps(r,1);expect(e.timer).toBe(1.1);steps(r,65);expect(r.state.hp).toBe(100);steps(r,2);
    expect(r.state.hp).toBe(82);expect(r.state.kills).toBe(0);expect(r.state.passive.kills).toBe(0);expect(r.state.orbs).toHaveLength(1);steps(r,20);expect(r.state.hp).toBe(82);
  });
  it('can kill or freeze a bomber before its blast without remote area damage',()=>{
    const r=run(),e=r.spawnEnemy('bomber',45,0);e.cooldown=0;e.speed=0;steps(r,1);e.freeze=1;const timer=e.timer;steps(r,30);expect(e.timer).toBe(timer);e.hp=1;strike(r);steps(r,90);expect(r.state.hp).toBe(100);expect(r.state.kills).toBe(1);expect(r.state.hazards?.some(h=>h.kind==='blast')).toBe(false);
  });
  it('reveals during a locked-angle lunge and cannot damage during idle or recovery',()=>{
    const r=run(),e=r.spawnEnemy('stalker',110,0);e.cooldown=100;e.speed=0;r.state.invincible=0;expect(stalkerCloaked(e)).toBe(true);e.x=0;steps(r,1);expect(r.state.hp).toBe(100);
    e.x=110;e.cooldown=0;steps(r,1);expect(e.timer).toBe(.8);expect(stalkerCloaked(e)).toBe(false);const angle=e.angle;r.state.player.y=100;steps(r,49);expect(e.angle).toBe(angle);expect(e.action).toBe('charge');steps(r,26);expect(e.action).toBe('recover');e.x=r.state.player.x;e.y=r.state.player.y;steps(r,30);expect(r.state.hp).toBe(100);
    e.action='idle';e.reveal=.85;expect(stalkerCloaked(e)).toBe(false);e.reveal=0;e.burnTime=1;expect(stalkerCloaked(e)).toBe(false);
  });
});
describe('feedback, display and readable power',()=>{
  it('bounds impact pauses and camera impulses, with a single cleave quality',()=>{
    expect(impactFeedback(20,1,1).hitStop).toBe(0);expect(impactFeedback(30,1,1).hitStop).toBe(.018);expect(impactFeedback(20,3,1).hitStop).toBe(.032);expect(impactFeedback(20,1,4).hitStop).toBe(.045);
    for(let i=0;i<100;i++){const kick=cameraImpulse(i/500,2.7);expect(Math.abs(kick.x)).toBeLessThanOrEqual(2.7);expect(Math.abs(kick.y)).toBeLessThanOrEqual(2.7);}
  });
  it('aligns the visible strike with its physical 45-percent contact threshold',()=>{
    const swing={age:.1+.2*.45,windup:.1,strike:.2,recovery:.2,angle:-.8};expect(bladePresentation(swing,0,2,3,1).angle).toBeCloseTo(-.8);
  });
  it('uses native DPR with a bounded pixel budget and a distinct lite budget',()=>{
    expect(displayProfile(390,844,3,false)).toMatchObject({width:1170,height:2532,ratio:3});expect(displayProfile(390,844,3,true).ratio).toBe(1.5);const p=displayProfile(4000,3000,3,false);expect(p.width*p.height).toBeLessThanOrEqual(8000000);
  });
  it.each(TIERS.map((_,i)=>i))('normalizes blade %i to 1000 and computes growth without mutating RNG',i=>{
    const r=new BladeRun(91,undefined,i),before=r.snapshot();expect(combatPower(r).value).toBe(1000);expect(r.snapshot()).toEqual(before);r.state.level=20;r.state.relics.stone=4;r.state.relics.feather=4;expect(combatPower(r).value).toBeGreaterThan(1000);expect(combatPower(r).axes.every(a=>Number.isFinite(a.ratio)&&a.ratio>0)).toBe(true);
  });
});
