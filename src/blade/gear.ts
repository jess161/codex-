import type {EnemyKind} from './config';
export const RUN_DURATION=600;
export const SURVIVAL_DURATION=540;
export const FINALE_DURATION=60;
export const GEAR_CAP=3;
export const GEAR_SLOTS=3;
export const GEAR_CATEGORIES={attack:{name:'史诗装备',color:'#9865d5',tint:'#eee4ff'}} as const;
export type GearCategory=keyof typeof GEAR_CATEGORIES;
export const GEAR={
  redMoonBlade: {name:'赤月誓刃',category:'attack',rarity:'epic',price:170,effect:'攻击力 +25；生命偷取 +12%',note:'血契：普攻吸血溢出的治疗转为护盾，上限为最大生命的 15%/20%/25%，持续 6 秒，溢出吸血时刷新。每级攻击力 +25、生命偷取 +12%。治疗与蓄盾共享每秒最大生命 5% 的预算。'},
  solarEdge: {name:'曜金裁决',category:'attack',rarity:'epic',price:180,effect:'攻击力 +30；暴击率 +20%；暴击伤害 +30%',note:'破晓：每级攻击力 +30、暴击率 +20%，暴击倍率额外 +0.30。刀、剑、箭与矛均可触发。'},
  stoneCleaver: {name:'玄岩巨斧',category:'attack',rarity:'epic',price:175,effect:'攻击力 +15；最大生命 +70；普攻附带裂岩溅射',note:'裂岩：每级攻击力 +15、生命 +70。普攻附加最大生命 1.5%/3%/4.5% 伤害；每轮命中再向目标周围溅射一次，伤害随攻击力与最大生命成长。溅射不暴击、不吸血、不触发其他普攻特效。'},
} as const;
export type GearId=keyof typeof GEAR;
export type GearInventory=Record<GearId,number>;
export const GEAR_IDS=Object.keys(GEAR) as GearId[];
export const isGearId=(value:unknown):value is GearId=>typeof value==='string'&&Object.hasOwn(GEAR,value);
export const freshGear=():GearInventory=>Object.fromEntries(GEAR_IDS.map(id=>[id,0])) as GearInventory;
export const gearPrice=(id:GearId,currentRank:number)=>GEAR[id].price+currentRank*35;
export const gearInvestment=(id:GearId,rank:number)=>rank*GEAR[id].price+rank*(rank-1)*35/2;
export const gearSpent=(gear:GearInventory)=>GEAR_IDS.reduce((sum,id)=>sum+gearInvestment(id,gear[id]),0);
export const gearSellPrice=(id:GearId,rank:number)=>Math.floor(gearInvestment(id,rank)*.75);
export const gearMaxHp=(g:GearInventory)=>70*g.stoneCleaver;
export const bloodShieldCap=(maxHp:number,g:GearInventory)=>g.redMoonBlade?maxHp*(.10+.05*g.redMoonBlade):0;
export function gearBlockReason(e:EconomyState,id:GearId):string {
 if(e.gear[id]>=GEAR_CAP)return '已满级';
 if(!e.gear[id]&&e.order.length>=GEAR_SLOTS)return '装备已满';
 if(e.wallet<gearPrice(id,e.gear[id]))return '金币不足';
 return '';
}
export function gearDetail(id:GearId,rank:number){
 switch(id){
  case 'redMoonBlade':return `攻击力 +${25*rank}；生命偷取 +${12*rank}%；溢出治疗转为最多 ${10+5*rank}% 最大生命护盾`;
  case 'solarEdge':return `攻击力 +${30*rank}；暴击率 +${20*rank}%；暴击倍率额外 +${(.30*rank).toFixed(2)}`;
  case 'stoneCleaver':return `攻击力 +${15*rank}；生命 +${70*rank}；普攻附加最大生命 ${(1.5*rank).toFixed(1)}% 伤害并向目标周围溅射`;
 }
}
export const COIN_VALUES:Record<EnemyKind,number>={blob:1,swift:2,armor:4,shooter:3,charger:4,wisp:4,splitter:3,brood:1,spiker:5,poison:4,bomber:4,stalker:5,elite:25,boss:100};
export const NORMAL_COIN_DROP_CHANCE=.25;
export const coinDropChance=(kind:EnemyKind)=>kind==='elite'||kind==='boss'?1:NORMAL_COIN_DROP_CHANCE;
export interface EconomyState{wallet:number;earned:number;spent:number;refunded:number;gear:GearInventory;order:GearId[]}
export const freshEconomy=(coins=0):EconomyState=>({wallet:coins,earned:coins,spent:0,refunded:0,gear:freshGear(),order:[]});
export function validEconomy(value:unknown):value is EconomyState{
 if(!value||typeof value!=='object')return false;
 const e=value as EconomyState;
 return [e.wallet,e.earned,e.spent,e.refunded].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9)
  &&e.wallet+e.spent===e.earned+e.refunded&&!!e.gear&&Object.keys(e.gear).length===GEAR_IDS.length
  &&GEAR_IDS.every(id=>Number.isInteger(e.gear[id])&&e.gear[id]>=0&&e.gear[id]<=GEAR_CAP)
  &&e.spent>=gearSpent(e.gear)&&e.refunded<=Math.floor((e.spent-gearSpent(e.gear))*.75)
  &&Array.isArray(e.order)&&e.order.length<=GEAR_SLOTS&&e.order.every(isGearId)&&new Set(e.order).size===e.order.length
  &&e.order.length===GEAR_IDS.filter(id=>e.gear[id]>0).length&&e.order.every(id=>e.gear[id]>0);
}
