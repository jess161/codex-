import type {EnemyKind} from './config';

export const RUN_DURATION=600;
export const SURVIVAL_DURATION=540;
export const FINALE_DURATION=60;
export const GEAR_CAP=1;
export const GEAR_SLOTS=3;
export const GEAR_CATEGORIES={attack:{name:'通用装备',color:'#7798b0',tint:'#eaf2f7'}} as const;
export type GearCategory=keyof typeof GEAR_CATEGORIES;
export type GearRarity='common'|'rare'|'epic';
export const GEAR_RARITIES={
 common:{name:'普通',color:'#7f94a2'},
 rare:{name:'稀有',color:'#4b93c6'},
 epic:{name:'史诗',color:'#9865d5'},
} as const;
export const COMMON_GEAR='seasoningTin';
export type GearId='seasoningTin'|'pepperPowder'|'chiliSauce'|'mushroomSauce'|'thunderSalt'|'volcanicSauce'|'jadeMushroom';
interface GearDefinition {name:string;category:GearCategory;rarity:GearRarity;price:number;upgradeCost:number;from:GearId|null;effect:string;note:string}
// price is the total investment; upgradeCost is the gold paid at this step.
export const GEAR:Record<GearId,GearDefinition>={
 seasoningTin:{name:'小调味罐',category:'attack',rarity:'common',price:35,upgradeCost:35,from:null,effect:'攻击力 +6',note:'三条调味路线共用的起点，胡萝卜剑全部形态生效。可购买多罐，分别升级为电、火、毒；升级原位替换，不额外占位置。'},
 pepperPowder:{name:'麻椒粉',category:'attack',rarity:'rare',price:90,upgradeCost:55,from:'seasoningTin',effect:'攻击力 +10；每 5 次普攻释放连锁闪电',note:'每轮普攻击发充能一次，连续斩击仍只充一次，挥空也计数，一刀命中多怪只计一次。每个目标受到 55% 攻击力的电伤；初始连接 4 个不同目标，Lv.6／11／16／21 各增加 1 个，最多 8 个。补 80 金币升级。'},
 chiliSauce:{name:'辣椒酱',category:'attack',rarity:'rare',price:95,upgradeCost:60,from:'seasoningTin',effect:'攻击力 +10；命中燃烧 3 秒；死亡爆燃',note:'斩击与远程剑气命中施加燃烧，每 0.5 秒造成 8% 攻击力火伤，重复命中刷新 3 秒。燃烧目标被普攻或燃烧击败时，在 55 范围爆燃，造成 45% 攻击力伤害。爆燃不传火、不连爆。补 85 金币升级。'},
 mushroomSauce:{name:'幽绿菇酱',category:'attack',rarity:'rare',price:90,upgradeCost:55,from:'seasoningTin',effect:'攻击力 +10；命中叠毒，最多 5 层',note:'每次普攻命中叠 1 层毒并刷新 4 秒。每层每 0.5 秒造成 3.5% 攻击力毒伤，对精英与首领提高 25%；最多 5 层。重复命中不重置跳伤计时，适合持续消耗。补 85 金币升级。'},
 thunderSalt:{name:'雷鸣椒盐罐',category:'attack',rarity:'epic',price:170,upgradeCost:80,from:'pepperPowder',effect:'攻击力 +20；每 4 次普攻释放强化闪电',note:'每个不同目标受到 85% 攻击力电伤，弹射距离从 125 提升至 155。目标数随角色等级从 4 提升至 8。按攻击次数充能，横扫、多箭、元素伤害不会重复充能；升级保留充能，若已充满则下次攻击释放。'},
 volcanicSauce:{name:'火山辣酱罐',category:'attack',rarity:'epic',price:180,upgradeCost:85,from:'chiliSauce',effect:'攻击力 +20；强化燃烧与死亡爆燃',note:'普攻命中燃烧 3 秒，每 0.5 秒造成 14% 攻击力火伤；重复命中刷新。被普攻或燃烧击败的燃烧目标，在 75 范围爆燃，造成 80% 攻击力伤害。爆燃不叠毒、不充能、不引发后续爆燃。'},
 jadeMushroom:{name:'翠毒蘑菇罐',category:'attack',rarity:'epic',price:175,upgradeCost:85,from:'mushroomSauce',effect:'攻击力 +20；强化五层毒，持续 5 秒',note:'普攻命中叠毒并刷新 5 秒，最多 5 层；每层每 0.5 秒造成 6% 攻击力毒伤，对精英与首领提高 25%。元素伤害不会再叠毒或触发其他元素。'},
};
export const GEAR_BRANCHES=[['pepperPowder','thunderSalt'],['chiliSauce','volcanicSauce'],['mushroomSauce','jadeMushroom']] as const satisfies readonly (readonly [GearId,GearId])[];
export type GearInventory=Record<GearId,number>;
export const GEAR_IDS=Object.keys(GEAR) as GearId[];
export const isGearId=(value:unknown):value is GearId=>typeof value==='string'&&Object.hasOwn(GEAR,value);
export const freshGear=():GearInventory=>Object.fromEntries(GEAR_IDS.map(id=>[id,0])) as GearInventory;
export const gearPrice=(id:GearId,_currentCount=0)=>GEAR[id].upgradeCost;
export const gearInvestment=(id:GearId,count:number)=>count*GEAR[id].price;
export const gearSpent=(gear:GearInventory)=>GEAR_IDS.reduce((sum,id)=>sum+gearInvestment(id,gear[id]),0);
// Selling always removes one equipped jar, including one of several common tins.
export const gearSellPrice=(id:GearId,_currentCount=1)=>Math.floor(GEAR[id].price*.75);
export const gearAttack=(g:GearInventory)=>6*g.seasoningTin+10*(g.pepperPowder+g.chiliSauce+g.mushroomSauce)+20*(g.thunderSalt+g.volcanicSauce+g.jadeMushroom);
export function lightningProfile(g:GearInventory,level:number){
 return {enabled:!!(g.pepperPowder||g.thunderSalt),attacks:g.thunderSalt?4:5,targets:Math.min(8,4+Math.floor((level-1)/7)),damage:g.thunderSalt ? .85:.55,hopRange:g.thunderSalt?155:125};
}
export const fireProfile=(g:GearInventory)=>({enabled:!!(g.chiliSauce||g.volcanicSauce),duration:3,tickDamage:g.volcanicSauce ? .14:.08,burstDamage:g.volcanicSauce ? .80:.45,radius:g.volcanicSauce?75:55});
export const poisonProfile=(g:GearInventory)=>({enabled:!!(g.mushroomSauce||g.jadeMushroom),duration:g.jadeMushroom?5:4,tickDamage:g.jadeMushroom ? .06:.035,maxStacks:5});
export function gearBlockReason(e:EconomyState,id:GearId):string {
 const item=GEAR[id],branch=GEAR_BRANCHES.find(([rare,epic])=>rare===id||epic===id);
 if(id!==COMMON_GEAR&&e.gear[id])return item.rarity==='epic'?'已达史诗':'已拥有';
 if(branch&&id===branch[0]&&e.gear[branch[1]])return '已升级为'+GEAR[branch[1]].name;
 if(item.from&&!e.gear[item.from])return '需要'+GEAR[item.from].name;
 if(!item.from&&e.order.length>=GEAR_SLOTS)return '装备已满';
 if(e.wallet<gearPrice(id))return '金币不足';
 return '';
}
export const gearPurchaseHint=(id:GearId)=>GEAR[id].from?'消耗 1 件'+GEAR[GEAR[id].from!].name+'，原位升级':'所有武器通用，可购买多件';
export const gearDetail=(id:GearId,_count=1)=>GEAR[id].effect;
export const COIN_VALUES:Record<EnemyKind,number>={blob:1,swift:2,armor:4,shooter:3,charger:4,wisp:4,splitter:3,brood:1,spiker:5,poison:4,bomber:4,stalker:5,elite:25,boss:100};
export const NORMAL_COIN_DROP_CHANCE=1;
export const coinDropChance=(kind:EnemyKind)=>kind==='elite'||kind==='boss'?1:NORMAL_COIN_DROP_CHANCE;
export interface EconomyState{wallet:number;earned:number;spent:number;refunded:number;gear:GearInventory;order:GearId[]}
export const freshEconomy=(coins=0):EconomyState=>({wallet:coins,earned:coins,spent:0,refunded:0,gear:freshGear(),order:[]});
export function validEconomy(value:unknown):value is EconomyState{
 if(!value||typeof value!=='object')return false;
 const e=value as EconomyState;
 return [e.wallet,e.earned,e.spent,e.refunded].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9)
  &&e.wallet+e.spent===e.earned+e.refunded&&!!e.gear&&Object.keys(e.gear).length===GEAR_IDS.length
  &&GEAR_IDS.every(id=>Number.isInteger(e.gear[id])&&e.gear[id]>=0&&e.gear[id]<=(id===COMMON_GEAR?GEAR_SLOTS:GEAR_CAP))
  &&GEAR_BRANCHES.every(([rare,epic])=>e.gear[rare]+e.gear[epic]<=1)
  &&e.spent>=gearSpent(e.gear)&&e.refunded<=Math.floor((e.spent-gearSpent(e.gear))*.75)
  &&Array.isArray(e.order)&&e.order.length<=GEAR_SLOTS&&e.order.every(isGearId)
  &&GEAR_IDS.every(id=>e.order.filter(held=>held===id).length===e.gear[id]);
}
