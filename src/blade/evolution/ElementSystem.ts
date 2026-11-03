import type {GearId,GearInventory} from '../gear';
import {ELEMENT_IDS,emptyElements,type EvolutionContext,type ElementRanks} from './types';
import type {Enemy} from '../simulation';
import {ELEMENT_RULES,LIGHTNING_TARGET_LEVELS} from './config';

export const GEAR_ELEMENT:Partial<Record<GearId,keyof ElementRanks>>={chiliSauce:'fire',volcanicSauce:'fire',mushroomSauce:'poison',jadeMushroom:'poison',pepperPowder:'lightning',thunderSalt:'lightning'};
export function effectiveElements({state,gear}:EvolutionContext):ElementRanks {
 const ranks={...state.elements},tins=gearElements(gear);
 for(const element of ELEMENT_IDS)ranks[element]=Math.max(ranks[element],tins[element]) as 0|1|2;
 return ranks;
}
export function gearElements(gear?:GearInventory){
 const ranks=emptyElements();
 if(gear)for(const id of Object.keys(GEAR_ELEMENT) as GearId[]){
  const element=GEAR_ELEMENT[id];
  if(element&&gear[id])ranks[element]=Math.max(ranks[element],['volcanicSauce','jadeMushroom','thunderSalt'].includes(id)?2:1) as 1|2;
 }
 return ranks;
}
export const elementCount=(ranks:ElementRanks)=>ELEMENT_IDS.filter(e=>ranks[e]>0).length;
export function lightningStats(ranks:ElementRanks,level:number){return {enabled:ranks.lightning>0,targets:Math.min(8,4+LIGHTNING_TARGET_LEVELS.filter(l=>level>=l).length),...ELEMENT_RULES.lightning.ranks[ranks.lightning===2?1:0]};}
export class ElementSystem {
 static apply(e:Enemy,ranks:ElementRanks,damage:number){
  if(ranks.fire){
   const rule=ELEMENT_RULES.fire,rank=rule.ranks[ranks.fire-1];
   if(e.burnTime<=0)e.burnTick=rule.tick;e.burnTime=rule.duration;e.burnDamage=Math.max(1,Math.round(damage*rank.damage));
   e.fireBurstDamage=Math.round(damage*rank.burst);e.fireBurstRadius=rank.radius;
  }
  if(ranks.poison){
   const rule=ELEMENT_RULES.poison,rank=rule.ranks[ranks.poison-1];
   if(e.poisonTime<=0){e.poisonTick=rule.tick;e.poisonStacks=0;}
   e.poisonTime=rank.duration;e.poisonStacks=Math.min(rule.maxStacks,(e.poisonStacks??0)+1);
   e.poisonDamage=Math.max(1,Math.round(damage*rank.damage*e.poisonStacks*(e.kind==='elite'||e.kind==='boss'?rule.eliteMultiplier:1)));
  }
  if(ranks.ice){
   const rule=ELEMENT_RULES.ice,rank=rule.ranks[ranks.ice-1];
   const resistant=e.kind==='boss'||e.kind==='elite';e.chill=rule.duration;e.chillStacks=Math.min(rule.freezeStacks,e.chillStacks+1);
   e.slow=resistant?rank.resistantSlow:rank.slow;e.slowTime=rule.duration;
   if(e.chillStacks===rule.freezeStacks&&e.freezeCooldown<=0&&!resistant){e.freeze=rank.freeze;e.freezeCooldown=rule.freezeCooldown;e.chillStacks=0;}
  }
 }
 static tickDots(e:Enemy,dt:number,hit:(damage:number,source:'burn'|'poison')=>void,live:()=>boolean){
  for(const type of ['burn','poison'] as const){
   const time=type==='burn'?'burnTime':'poisonTime',tick=type==='burn'?'burnTick':'poisonTick',damage=type==='burn'?'burnDamage':'poisonDamage';
   if(e[time]<=0)continue;
   e[tick]-=Math.min(e[time],dt);e[time]=Math.max(0,e[time]-dt);
   while(e[tick]<=.000001&&e.hp>0&&live()){e[tick]+=.5;hit(e[damage],type);}
   if(e[time]===0){e[tick]=.5;e[damage]=0;if(type==='poison')e.poisonStacks=0;else{e.fireBurstDamage=0;e.fireBurstRadius=0;}}
  }
 }
}
