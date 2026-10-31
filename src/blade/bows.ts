import type { Enemy, Point } from './simulation';
import type { EquipmentStats } from './equipment';

export const FIRST_BOW = 12;
export const isBow = (index: number) => index >= FIRST_BOW && index < FIRST_BOW + 3;
export const BOW_IDS = ['wind-bow', 'frost-bow', 'ember-bow'] as const;
export const BOW_PROFILES = [
  {kind:'wind',speed:700,pierce:2,mass:.7,windup:.075},
  {kind:'ice',speed:560,pierce:1,mass:.9,windup:.12},
  {kind:'fire',speed:500,pierce:1,mass:1.25,windup:.36},
] as const;
export type ArrowKind = 'wind' | 'ice' | 'fire';
export interface BowArrow extends Point {
  id:number;shot:number;kind:ArrowKind;angle:number;speed:number;remaining:number;width:number;
  damage:number;burn:number;pierce:number;hit:number[];dealt:number[];active:boolean;blast:number;blastDamage:number;
}
export interface BowBurst {delay:number;angle:number;damage:number;range:number;width:number;pierce:number;spread:number}
export interface BowRain extends Point {life:number;tick:number;ticks:number;radius:number;damage:number}
export interface ArcheryState {shots:number;arrows:BowArrow[];bursts:BowBurst[];rains:BowRain[];procs:number[];frostHits:{enemy:number;shot:number}[]}
export const freshArchery=():ArcheryState=>({shots:0,arrows:[],bursts:[],rains:[],procs:[],frostHits:[]});
export interface BowHost {
  archery:ArcheryState;player:Point;stats:EquipmentStats;mastery:number;index:number;scope:number;elemental:number;enemies:Enemy[];
  nextId:()=>number;live:()=>boolean;hit:(enemy:Enemy,damage:number,angle:number,source:'wave'|'active'|'passive')=>void;
  strike:(enemy:Enemy)=>void;emit:(kind:'shot'|'bow-blast',p:Point,radius:number)=>void;
}
export function bowGeometry(stats:EquipmentStats,mastery:number,scope=0) {
  return {range:Math.min(1400,stats.range*(1+.12*scope)),width:Math.min(16,3.5*Math.sqrt(stats.widthScale)),
    area:Math.min(2.1,Math.sqrt(stats.widthScale)*(1+.04*mastery)),spread:Math.min(.4,.16+.02*mastery+.015*(stats.widthScale-1))};
}
function arrow(h:BowHost,angle:number,damage:number,shot:number,active=false,options:Partial<BowArrow>={}) {
  const a=h.archery,p=BOW_PROFILES[h.index-FIRST_BOW],shape=bowGeometry(h.stats,h.mastery,h.scope);
  if(a.arrows.length>=128)return;
  a.arrows.push({id:h.nextId(),shot,x:h.player.x,y:h.player.y,kind:p.kind,angle,speed:p.speed,
    remaining:shape.range,width:shape.width,damage:Math.max(1,Math.round(damage)),burn:Math.max(1,Math.round(damage*.075*h.elemental)),pierce:Math.min(24,p.pierce+Math.floor(h.mastery/2)+h.scope),hit:[],dealt:[],active,
    blast:p.kind==='fire'?65*shape.area:0,blastDamage:damage*.65,...options});
}
export function shootBow(h:BowHost,angle:number) {
  const shot=h.nextId(),p=BOW_PROFILES[h.index-FIRST_BOW],s=h.archery,shape=bowGeometry(h.stats,h.mastery,h.scope);
  s.shots++;
  arrow(h,angle,h.stats.damage,shot);
  if(p.kind==='ice')for(const sign of [-1,1])arrow(h,angle+sign*shape.spread,h.stats.damage*.55,shot);
  if(p.kind==='wind'&&s.shots%4===0)for(const sign of [-1,1])arrow(h,angle+sign*.07,h.stats.damage*(.45+.05*h.mastery),shot);
  h.emit('shot',h.player,shape.width);
}
export function activateBow(h:BowHost,angle:number,target:Point) {
  const shape=bowGeometry(h.stats,h.mastery,h.scope),m=1+.08*h.mastery;
  if(h.index===12)for(let i=0;i<3;i++)h.archery.bursts.push({delay:i*.12,angle,damage:h.stats.damage*.65*m,range:shape.range*1.2,width:shape.width,pierce:3+h.mastery+h.scope,spread:.24+.025*h.mastery});
  if(h.index===13)h.archery.rains.push({x:target.x,y:target.y,life:2.4,tick:0,ticks:6,radius:100*shape.area,damage:Math.round(h.stats.damage*.4*m)});
  if(h.index===14)arrow(h,angle,h.stats.damage*1.6*m,h.nextId(),true,{remaining:Math.max(30,Math.min(shape.range*1.2,Math.hypot(target.x-h.player.x,target.y-h.player.y))),width:shape.width*1.7,pierce:6+h.mastery+h.scope,blast:115*shape.area,blastDamage:h.stats.damage*2.2*m,speed:620});
}
function chill(h:BowHost,e:Enemy,shot:number) {
  const a=h.archery;if(a.frostHits.some(p=>p.enemy===e.id&&p.shot===shot))return;
  a.frostHits.push({enemy:e.id,shot});if(a.frostHits.length>512)a.frostHits.shift();
  e.chill=1.5+.2*h.mastery;e.chillStacks=Math.min(3,e.chillStacks+1);
  const slow=e.kind==='boss'||e.kind==='elite'?.15:.2+.02*h.mastery;
  if(slow>=e.slow){e.slow=slow;e.slowTime=e.chill;}
  if(e.chillStacks>=3&&e.freezeCooldown<=0&&e.kind!=='boss'&&e.kind!=='elite'){e.freeze=.65+.1*h.mastery;e.freezeCooldown=4;}
}
function impact(h:BowHost,e:Enemy,a:BowArrow,damage:number,source:'wave'|'active'|'passive') {
  if(a.kind==='ice')chill(h,e,a.shot);
  if(a.kind==='fire'){
    if(e.burnTime<=0)e.burnTick=.5;
    e.burnTime=Math.max(e.burnTime,2+.15*h.mastery);
    e.burnDamage=Math.max(e.burnDamage,a.burn);
  }
  h.hit(e,Math.max(1,Math.round(damage)),a.angle,source);
  // Attack-count items advance once per normal volley, never once per pellet/bonus arrow.
  if(!a.active&&source!=='passive'&&!h.archery.procs.includes(a.shot)){
    h.archery.procs.push(a.shot);if(h.archery.procs.length>128)h.archery.procs.shift();h.strike(e);
  }
}
function explode(h:BowHost,a:BowArrow) {
  if(!a.blast)return;
  h.emit('bow-blast',a,a.blast);let kills=0;
  for(const e of h.enemies){
    if(!h.live())break;
    if(e.hp<=0||e.spawn>0||Math.hypot(e.x-a.x,e.y-a.y)>a.blast+e.radius)continue;
    const i=a.hit.indexOf(e.id);
    // A normal direct hit is not hit again. The active only tops up to its larger blast damage.
    if(i>=0){if(a.active){const extra=Math.round(a.blastDamage)-a.dealt[i];if(extra>0)h.hit(e,extra,a.angle,'passive');}continue;}
    impact(h,e,a,a.blastDamage,a.active?'active':'wave');if(e.hp<=0)kills++;
  }
  return kills;
}
export function stepArchery(h:BowHost,dt:number) {
  const s=h.archery,remaining:BowBurst[]=[];
  for(const b of s.bursts){b.delay=Math.max(0,b.delay-dt);if(b.delay>1e-6){remaining.push(b);continue;}
    const shot=h.nextId();for(const sign of [-1,0,1])arrow(h,b.angle+sign*b.spread,b.damage,shot,true,{kind:'wind',remaining:b.range,width:b.width,pierce:b.pierce,blast:0});
    h.emit('shot',h.player,b.width);
  }s.bursts=remaining;
  for(const r of s.rains){
    r.life=Math.max(0,r.life-dt);r.tick-=dt;
    while(r.ticks>0&&r.tick<=1e-6&&h.live()){
      r.tick+=.4;r.ticks--;const shot=h.nextId();
      for(const e of h.enemies){if(!h.live())break;if(e.hp>0&&e.spawn<=0&&Math.hypot(e.x-r.x,e.y-r.y)<=r.radius+e.radius){chill(h,e,shot);h.hit(e,r.damage,Math.atan2(e.y-r.y,e.x-r.x),'active');}}
    }
  }s.rains=s.rains.filter(r=>r.life>1e-6);
  const alive:BowArrow[]=[];
  for(const a of s.arrows){
    if(!h.live()){alive.push(a);continue;}
    const ox=a.x,oy=a.y,length=Math.min(a.remaining,a.speed*dt),vx=Math.cos(a.angle)*length,vy=Math.sin(a.angle)*length;
    const hits=h.enemies.filter(e=>e.hp>0&&e.spawn<=0&&!a.hit.includes(e.id)).map(e=>{
      const along=Math.max(0,Math.min(1,((e.x-ox)*vx+(e.y-oy)*vy)/Math.max(.001,length*length)));
      return {e,along,hit:Math.hypot(e.x-ox-vx*along,e.y-oy-vy*along)<=e.radius+a.width};
    }).filter(p=>p.hit).sort((a,b)=>a.along-b.along||a.e.id-b.e.id);
    let stopped=false;
    for(const {e,along}of hits){
      if(!h.live()||a.hit.length>=a.pierce)break;
      a.x=ox+vx*along;a.y=oy+vy*along;const hp=e.hp;
      impact(h,e,a,a.damage,a.active?'active':'wave');a.hit.push(e.id);a.dealt.push(hp-e.hp);
      if(a.kind==='fire'&&!a.active){stopped=true;break;}
    }
    if(!stopped){a.x=ox+vx;a.y=oy+vy;}a.remaining=Math.max(0,a.remaining-length);
    if(stopped||a.remaining<=1e-6||a.hit.length>=a.pierce)explode(h,a);else alive.push(a);
  }s.arrows=alive;
}
export function validArchery(value:unknown):value is ArcheryState {
  if(!value||typeof value!=='object')return false;const s=value as ArcheryState;
  const n=(v:unknown,max=1e9)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
  const id=(v:unknown)=>n(v)&&Number.isInteger(v)&&Number(v)>0;
  const xy=(v:Point)=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y);
  return n(s.shots,1e6)&&Number.isInteger(s.shots)&&Array.isArray(s.arrows)&&s.arrows.length<=128
    &&s.arrows.every(a=>xy(a)&&id(a.id)&&id(a.shot)&&['wind','ice','fire'].includes(a.kind)&&Number.isFinite(a.angle)&&n(a.speed,1500)&&a.speed>0&&n(a.remaining,1400)&&n(a.width,40)&&a.width>0&&n(a.damage)&&a.damage>0&&n(a.burn)&&id(a.pierce)&&a.pierce<=24&&typeof a.active==='boolean'&&n(a.blast,600)&&n(a.blastDamage)&&Array.isArray(a.hit)&&a.hit.length<=a.pierce&&a.hit.every(id)&&new Set(a.hit).size===a.hit.length&&Array.isArray(a.dealt)&&a.dealt.length===a.hit.length&&a.dealt.every(v=>n(v)))
    &&new Set(s.arrows.map(a=>a.id)).size===s.arrows.length
    &&Array.isArray(s.bursts)&&s.bursts.length<=3&&s.bursts.every(b=>n(b.delay,.241)&&Number.isFinite(b.angle)&&n(b.damage)&&b.damage>0&&n(b.range,1400)&&b.range>0&&n(b.width,40)&&b.width>0&&id(b.pierce)&&b.pierce<=24&&n(b.spread,1))
    &&Array.isArray(s.rains)&&s.rains.length<=1&&s.rains.every(r=>xy(r)&&n(r.life,2.401)&&n(r.tick,.401)&&n(r.ticks,6)&&Number.isInteger(r.ticks)&&n(r.radius,600)&&r.radius>0&&n(r.damage)&&r.damage>0)
    &&Array.isArray(s.procs)&&s.procs.length<=128&&s.procs.every(id)&&new Set(s.procs).size===s.procs.length
    &&Array.isArray(s.frostHits)&&s.frostHits.length<=512&&s.frostHits.every(p=>p&&id(p.enemy)&&id(p.shot));
}
