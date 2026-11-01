// Frozen shop formats for converting saves. These identities are not current equipment.
const PRICES = {jellyVest:55, bubbleGuard:65, honeyCharm:55, emberPlate:70, thornArmor:65, sugarCore:60, clockGrip:55, clearLens:65, tideFang:70, stormCoil:65, chainLightning:150, bloodFang:60, redMoonBlade:170, solarEdge:180, stoneCleaver:175, breezeBoots:45, springBoots:50, pickupBoots:50} as const;
export interface PreviousEconomy {wallet:number;earned:number;spent:number;refunded:number;gear:Record<string,number>;order:string[];regen:number}
const idsFor=(version:10|11|12|13)=>version===13?['redMoonBlade','solarEdge','stoneCleaver']:Object.keys(PRICES).filter(id=>version===12 || !['redMoonBlade','solarEdge','stoneCleaver'].includes(id)&& (version===11||id!=='chainLightning'));
const investment=(id:string,rank:number)=>rank*PRICES[id as keyof typeof PRICES]+35*rank*(rank-1)/2;
export const previousGearSpent=(e:PreviousEconomy,version:10|11|12|13)=>idsFor(version).reduce((sum,id)=>sum+investment(id,e.gear[id]),0);
export function validPreviousEconomy(value:unknown,version:10|11|12|13):boolean {
 if(!value||typeof value!=='object')return false;
 const e=value as PreviousEconomy,ids=idsFor(version);
 return [e.wallet,e.earned,e.spent,e.refunded].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9)
  &&e.wallet+e.spent===e.earned+e.refunded&&!!e.gear&&Object.keys(e.gear).length===ids.length
  &&ids.every(id=>Number.isInteger(e.gear[id])&&e.gear[id]>=0&&e.gear[id]<=3)
  &&e.spent>=previousGearSpent(e,version)&&e.refunded<=Math.floor((e.spent-previousGearSpent(e,version))*.75)
  &&Array.isArray(e.order)&&e.order.length<=(version===13?3:6)&&new Set(e.order).size===e.order.length
  &&e.order.every(id=>ids.includes(id)&&e.gear[id]>0)&&e.order.length===ids.filter(id=>e.gear[id]>0).length
  &&e.order.filter(id=>['breezeBoots','springBoots','pickupBoots'].includes(id)).length<=1
  &&(version===13||Number.isFinite(e.regen)&&e.regen>=0&&e.regen<5.000001);
}
export function validPreviousGearCombat(value:unknown,version:10|11|12):boolean {
 if(!value||typeof value!=='object')return false;
 const b=value as Record<string,number>,bounded=(n:unknown,max:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;
 return Number.isInteger(b.heat)&&bounded(b.heat,4)&&bounded(b.heatTime,2.001)
  &&Number.isInteger(b.strikes)&&bounded(b.strikes,3)&&bounded(b.empowered,3.001)
  &&bounded(b.shield,640)&&bounded(b.shieldTime,3.001)&&bounded(b.shieldCooldown,16.001)&&bounded(b.reflectCooldown,.751)
  &&bounded(b.auraTick,.501)&&bounded(b.healClock,1.000001)&&bounded(b.healUsed,1000)
  &&(version===10?!Object.hasOwn(b,'chainCharge'):Number.isInteger(b.chainCharge)&&bounded(b.chainCharge,100)&&b.chainCharge%20===0)
  &&(version===12?bounded(b.bloodShield,640)&&bounded(b.bloodShieldTime,6.001):!Object.hasOwn(b,'bloodShield')&&!Object.hasOwn(b,'bloodShieldTime'));
}
