import type { BasicWeaponKind } from './config';
import type { BladeId } from './passives';

export const ACTIVE_SKILLS: Record<Exclude<BladeId, BasicWeaponKind>, {name:string;cooldown:number;description:string}> = {
  scrap:{name:'百炼风暴',cooldown:12,description:'横扫身周敌人，随后 4 秒挥刀间隔缩短 25%。'},
  'dark-dagger':{name:'袖里惊雷',cooldown:10,description:'朝附近敌人连续刺出三击，对甲壳额外增伤 50%。'},
  'well-moon':{name:'金月引潮',cooldown:12,description:'在附近怪群落下金月阵，持续 2.4 秒聚拢并切割普通怪；首领不受拉拽。'},
  'deer-cutter':{name:'逐鹿飞袭',cooldown:12,description:'飞袭附近最多六个目标，已有逐鹿印的目标受到额外伤害。'},
  'full-moon':{name:'回旋血月',cooldown:12,description:'掷出一轮巨大弯月，再飞回身边；去程与回程各能命中一次。'},
  'dragon-slayer':{name:'旋风拖刀',cooldown:14,description:'持续 3 秒移动旋风斩，边走边切开身周怪群。'},
  'snow-drinker':{name:'冰镜双身',cooldown:14,description:'召出两具冰镜分身，环绕角色协同挥刀 3.2 秒。'},
  wado:{name:'居合一闪',cooldown:12,description:'向敌人方向突进 120 距离，沿途拔刀斩击并清除弹丸，短暂无敌。'},
  shusui:{name:'黑刀天落',cooldown:14,description:'优先锁定附近强敌，落下一柄巨型黑刀；对精英与首领额外增伤 50%。'},
  enma:{name:'夺魄斩',cooldown:14,description:'向前斩出夺魄刀弧，命中敌人恢复生命，最多恢复生命上限的 20%。'},
  ryujin:{name:'熔火地带',cooldown:14,description:'在怪群脚下留下 4 秒熔火地带，持续伤害进入其中的敌人。'},
  tensa:{name:'时隙·卍解',cooldown:14,description:'进入 3 秒时隙，普通怪与敌方弹丸变慢，强敌轻度变慢；自身移动与挥刀加快。'},
  'wind-bow':{name:'疾风骤雨',cooldown:12,description:'朝附近敌人连续射出三轮扇形箭阵，共九支穿透风箭，移动中也可释放。'},
  'frost-bow':{name:'寒星箭雨',cooldown:14,description:'在目标脚下落下持续 2.4 秒的冰箭雨，伤害并减速怪群；精英与首领不冻结。'},
  'ember-bow':{name:'陨火贯星',cooldown:16,description:'发射巨型焰星箭，穿透怪群后在目标处引爆；沿途与爆炸不会重复结算完整伤害。'},
};
export const ACTIVE_PULSE_KINDS = ['steel','thrust','hunt','moon','draw','execution','soul'] as const;
export type ActivePulseKind = typeof ACTIVE_PULSE_KINDS[number];
export interface ActivePulse {delay:number;angle:number;radius:number;arc:number;damage:number;kind:ActivePulseKind;x?:number;y?:number;targetId?:number}
export interface ActiveField {kind:'vortex'|'spin'|'mirror'|'fire';x:number;y:number;life:number;duration:number;tick:number;radius:number;damage:number}
export interface ActiveState {cooldown:number;buff:number;casts:number;pending:ActivePulse[];fields:ActiveField[]}
export const freshActive = ():ActiveState=>({cooldown:0,buff:0,casts:0,pending:[],fields:[]});
export interface ActiveWavePlan {angle:number;damage:number;range:number;pierce:number;kind:'basic'|'moon'|'getsuga';size:number;boomerang?:boolean}

// Capture damage and geometry at release; pending strikes keep them across upgrades/save/load.
export function activePlan(id:BladeId,mastery:number,damage:number,meleeRadius:number,angle:number) {
  const pulses:ActivePulse[]=[],waves:ActiveWavePlan[]=[],fields:ActiveField[]=[];
  const area=(scale:number)=>Math.min(600,Math.max(108,meleeRadius*scale));
  const hit=(factor:number)=>Math.max(1,Math.round(damage*factor*(1+.08*mastery)));
  const pulse=(kind:ActivePulseKind,factor:number,scale=1.45,delay=0,arc=360)=>pulses.push({kind,damage:hit(factor),radius:area(scale),angle,arc,delay});
  const wave=(spread:number,factor:number,range:number,pierce:number,kind:ActiveWavePlan['kind'],size=1)=>waves.push({angle:angle+spread,damage:hit(factor),range,pierce,kind,size});
  const field=(kind:ActiveField['kind'],duration:number,factor:number,scale:number)=>fields.push({kind,x:0,y:0,life:duration,duration,tick:0,radius:area(scale),damage:hit(factor)});
  let buff=0,clearBullets=false,move=0,chainDamage=0,targeted=false;
  switch(id) {
    case 'scrap':pulse('steel',2.2);buff=4;break;
    case 'dark-dagger':for(let i=0;i<3;i++)pulse('thrust',1.7,1.8,i*.12,70);break;
    case 'well-moon':field('vortex',2.4,.8,1.4);break;
    case 'deer-cutter':chainDamage=hit(2.1);break;
    case 'full-moon':wave(0,2.7,310,12,'moon',1.5);waves[0].boomerang=true;break;
    case 'dragon-slayer':field('spin',3,.72,1.45);break;
    case 'snow-drinker':field('mirror',3.2,.65,1.05);break;
    case 'wado':pulse('draw',4,2.8,0,48);clearBullets=true;move=120;break;
    case 'shusui':pulse('execution',4.2,1.1,.16);targeted=true;break;
    case 'enma':pulse('soul',3.2,1.8,0,160);break;
    case 'ryujin':field('fire',4,.65,1.65);break;
    case 'tensa':buff=3;break;
  }
  return {pulses,waves,fields,buff,clearBullets,move,chainDamage,targeted};
}

export function validActive(value:unknown):value is ActiveState {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const a=value as ActiveState, finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n);
  return finite(a.cooldown)&&a.cooldown>=0&&a.cooldown<=16.001&&finite(a.buff)&&a.buff>=0&&a.buff<=4.001
    &&Number.isInteger(a.casts)&&a.casts>=0&&a.casts<=1e6&&Array.isArray(a.pending)&&a.pending.length<=6
    &&a.pending.every(p=>p&&ACTIVE_PULSE_KINDS.includes(p.kind)&&finite(p.delay)&&p.delay>=0&&p.delay<=.401&&finite(p.angle)
      &&finite(p.radius)&&p.radius>0&&p.radius<=600&&finite(p.arc)&&p.arc>0&&p.arc<=360&&finite(p.damage)&&p.damage>0&&(p.x===undefined||finite(p.x))&&(p.y===undefined||finite(p.y))&&(p.targetId===undefined||Number.isInteger(p.targetId)&&p.targetId>0))
    &&Array.isArray(a.fields)&&a.fields.length<=1&&a.fields.every(f=>f&&['vortex','spin','mirror','fire'].includes(f.kind)&&finite(f.x)&&finite(f.y)&&finite(f.duration)&&f.duration>0&&f.duration<=4&&finite(f.life)&&f.life>0&&f.life<=f.duration&&finite(f.tick)&&f.tick>=0&&f.tick<=.501&&finite(f.radius)&&f.radius>0&&f.radius<=600&&finite(f.damage)&&f.damage>0);
}
