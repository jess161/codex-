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
export type GearId='ironBlade'|'crimsonBlade'|'gleamBlade'|'ridgeBlade'|'redMoonBlade'|'solarEdge'|'stoneCleaver';
interface GearDefinition {name:string;category:GearCategory;rarity:GearRarity;price:number;upgradeCost:number;from:GearId|null;effect:string;note:string}
// price is the total investment; upgradeCost is the gold paid at this step.
export const GEAR:Record<GearId,GearDefinition>={
 ironBlade:{name:'铁芯短刃',category:'attack',rarity:'common',price:35,upgradeCost:35,from:null,effect:'攻击力 +6',note:'三条路线共用的起点，通用于刀、剑、弓、矛。可购买多件，分别升级为不同分支；升级后替换当前短刃，不额外占位置。'},
 crimsonBlade:{name:'赤纹利刃',category:'attack',rarity:'rare',price:90,upgradeCost:55,from:'ironBlade',effect:'攻击力 +15；生命偷取 +6%',note:'铁芯短刃补 55 金币升级而成。普攻回复实际伤害的 6%，每秒回复不超过最大生命的 5%。继续补 80 金币可升级为赤月誓刃，解锁溢出治疗护盾。'},
 gleamBlade:{name:'鎏光锋刃',category:'attack',rarity:'rare',price:95,upgradeCost:60,from:'ironBlade',effect:'攻击力 +18；暴击率 +10%',note:'铁芯短刃补 60 金币升级而成。刀、剑、箭与矛均可暴击。继续补 85 金币可升级为曜金裁决，提高暴击率并解锁额外暴击伤害。'},
 ridgeBlade:{name:'岩脊战刃',category:'attack',rarity:'rare',price:90,upgradeCost:55,from:'ironBlade',effect:'攻击力 +10；最大生命 +35',note:'铁芯短刃补 55 金币升级而成。继续补 85 金币可升级为玄岩巨斧，获得更多生命，并解锁生命附伤与裂岩溅射。'},
 redMoonBlade:{name:'赤月誓刃',category:'attack',rarity:'epic',price:170,upgradeCost:80,from:'crimsonBlade',effect:'攻击力 +25；生命偷取 +12%',note:'血契：普攻吸血溢出的治疗转为护盾，上限为最大生命的 15%，持续 6 秒，溢出吸血时刷新。治疗与蓄盾共享每秒最大生命 5% 的预算。此路线的最终装备。'},
 solarEdge:{name:'曜金裁决',category:'attack',rarity:'epic',price:180,upgradeCost:85,from:'gleamBlade',effect:'攻击力 +30；暴击率 +20%；暴击伤害 +30%',note:'破晓：普攻暴击倍率额外 +0.30。刀、剑、箭与矛均可触发。此路线的最终装备。'},
 stoneCleaver:{name:'玄岩巨斧',category:'attack',rarity:'epic',price:175,upgradeCost:85,from:'ridgeBlade',effect:'攻击力 +15；最大生命 +70；普攻附带裂岩溅射',note:'裂岩：普攻附加最大生命 1.5% 伤害；每轮命中再向目标周围溅射一次，伤害随攻击力与最大生命成长。溅射不暴击、不吸血、不触发其他普攻特效。此路线的最终装备。'},
};
export const GEAR_BRANCHES=[['crimsonBlade','redMoonBlade'],['gleamBlade','solarEdge'],['ridgeBlade','stoneCleaver']] as const satisfies readonly (readonly [GearId,GearId])[];
export type GearInventory=Record<GearId,number>;
export const GEAR_IDS=Object.keys(GEAR) as GearId[];
export const isGearId=(value:unknown):value is GearId=>typeof value==='string'&&Object.hasOwn(GEAR,value);
export const freshGear=():GearInventory=>Object.fromEntries(GEAR_IDS.map(id=>[id,0])) as GearInventory;
export const gearPrice=(id:GearId,_currentCount=0)=>GEAR[id].upgradeCost;
export const gearInvestment=(id:GearId,count:number)=>count*GEAR[id].price;
export const gearSpent=(gear:GearInventory)=>GEAR_IDS.reduce((sum,id)=>sum+gearInvestment(id,gear[id]),0);
// Selling always removes one equipped item, including one of several short blades.
export const gearSellPrice=(id:GearId,_currentCount=1)=>Math.floor(GEAR[id].price*.75);
export const gearMaxHp=(g:GearInventory)=>35*g.ridgeBlade+70*g.stoneCleaver;
export const gearLifesteal=(g:GearInventory)=>.06*g.crimsonBlade+.12*g.redMoonBlade;
export const bloodShieldCap=(maxHp:number,g:GearInventory)=>g.redMoonBlade?maxHp*.15:0;
export function gearBlockReason(e:EconomyState,id:GearId):string {
 const item=GEAR[id],branch=GEAR_BRANCHES.find(([rare,epic])=>rare===id||epic===id);
 if(id!=='ironBlade'&&e.gear[id])return item.rarity==='epic'?'已达史诗':'已拥有';
 if(branch&&id===branch[0]&&e.gear[branch[1]])return '已升级为'+GEAR[branch[1]].name;
 if(item.from&&!e.gear[item.from])return '需要'+GEAR[item.from].name;
 if(!item.from&&e.order.length>=GEAR_SLOTS)return '装备已满';
 if(e.wallet<gearPrice(id))return '金币不足';
 return '';
}
export const gearPurchaseHint=(id:GearId)=>GEAR[id].from?'消耗 1 件'+GEAR[GEAR[id].from!].name+'，原位升级':'所有武器通用，可购买多件';
export const gearDetail=(id:GearId,_count=1)=>GEAR[id].effect;
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
  &&GEAR_IDS.every(id=>Number.isInteger(e.gear[id])&&e.gear[id]>=0&&e.gear[id]<=(id==='ironBlade'?GEAR_SLOTS:GEAR_CAP))
  &&GEAR_BRANCHES.every(([rare,epic])=>e.gear[rare]+e.gear[epic]<=1)
  &&e.spent>=gearSpent(e.gear)&&e.refunded<=Math.floor((e.spent-gearSpent(e.gear))*.75)
  &&Array.isArray(e.order)&&e.order.length<=GEAR_SLOTS&&e.order.every(isGearId)
  &&GEAR_IDS.every(id=>e.order.filter(held=>held===id).length===e.gear[id]);
}
