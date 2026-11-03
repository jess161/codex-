import {OPTION_BY_ID} from './config';
import {effectiveElements} from './ElementSystem';
import {optionAllowed,UpgradeOptionPool} from './UpgradeOptionPool';
import {IMPORTANT_UPGRADE_TIMES,ELEMENT_IDS,type EvolutionContext,type EvolutionState} from './types';
export class WeaponEvolutionSystem {
 static due(context:EvolutionContext,time:number){return !context.state.offers.length&&context.state.stage<IMPORTANT_UPGRADE_TIMES.length&&time>=IMPORTANT_UPGRADE_TIMES[context.state.stage];}
 static open(context:EvolutionContext){context.state.offers=UpgradeOptionPool.offers(context);}
 static choose(context:EvolutionContext,id:string){
  const s=context.state,o=OPTION_BY_ID[id];
  if(!s.offers.includes(id)||!o||!optionAllowed(context,o))return false;
  const ranks=effectiveElements(context);
  if(o.form)s.form=o.form;if(o.mutation)s.mutations.push(o.mutation);
  if(o.elements)for(const e of o.elements)s.elements[e]=Math.min(2,ranks[e]+1) as 1|2;
  if(o.ultimate){
   s.ultimate=o.ultimate;s.ultimateRank=1;
   // Awakening seals its required enchantments even if the supporting tin is sold.
   for(const e of o.requires?.elements??[])s.elements[e]=Math.max(s.elements[e],ranks[e]) as 1|2;
  }
  if(o.kind==='ultimateBoost')s.ultimateRank=2;
  if(o.boost)s.boosts[o.boost]++;
  s.stage++;s.offers=[];return true;
 }
}
export function validEvolution(value:unknown):value is EvolutionState {
 if(!value||typeof value!=='object')return false;const s=value as EvolutionState;
 const integer=(n:unknown,max:number)=>Number.isInteger(n)&&Number(n)>=0&&Number(n)<=max;
 if(!integer(s.stage,6)||!Array.isArray(s.offers)||s.offers.length!==0&&s.offers.length!==3||new Set(s.offers).size!==s.offers.length||s.offers.some(id=>!UpgradeOptionPool.isId(id)))return false;
 if(s.form!==null&&!['greatsword','dual','wave'].includes(s.form)||s.stage>0&&!s.form||s.stage===0&&s.form!==null)return false;
 if(!Array.isArray(s.mutations)||s.mutations.length>2||new Set(s.mutations).size!==s.mutations.length||s.mutations.some(m=>!['extraSlash','piercing'].includes(m))||s.mutations.includes('piercing')&&s.form!=='wave')return false;
 if(!s.elements||ELEMENT_IDS.some(e=>!integer(s.elements[e],2))||ELEMENT_IDS.filter(e=>s.elements[e]>0).length>3)return false;
 if(s.ultimate!==null&&!['calamity','myriad'].includes(s.ultimate)||!integer(s.ultimateRank,2)||Boolean(s.ultimate)!==Boolean(s.ultimateRank))return false;
 if(!s.boosts||Object.keys(s.boosts).length!==3||(['power','haste','reach'] as const).some(k=>!integer(s.boosts[k],6)))return false;
 if(!integer(s.queuedSlashes,2)||!Number.isFinite(s.orbitReady)||s.orbitReady<0||s.orbitReady>610)return false;
 return !!s.reactionReady&&typeof s.reactionReady==='object'&&!Array.isArray(s.reactionReady)&&Object.keys(s.reactionReady).length<=7&&Object.values(s.reactionReady).every(n=>Number.isFinite(n)&&n>=0&&n<=610);
}
