import {OPTION_BY_ID,UPGRADE_OPTIONS} from './config';
import {ELEMENT_IDS,EVOLUTION_LIMITS,type EvolutionContext,type UpgradeOption} from './types';
import {effectiveElements,elementCount} from './ElementSystem';
import {meetsRequirements,UltimateAwakeningSystem} from './UltimateAwakeningSystem';
export function optionAllowed(context:EvolutionContext,option:UpgradeOption){
 const s=context.state,ranks=effectiveElements(context);
 if(option.enabled===false||!meetsRequirements(context,option.requires))return false;
 switch(option.kind){
  case 'form':return !s.form;
  case 'mutation':return s.mutations.length<EVOLUTION_LIMITS.mutations&&!s.mutations.includes(option.mutation!);
  case 'element':{
   const next={...ranks};for(const e of option.elements!)next[e]=Math.min(2,next[e]+1) as 1|2;
   return elementCount(next)<=EVOLUTION_LIMITS.elements&&option.elements!.some(e=>ranks[e]<2);
  }
  case 'ultimate':return UltimateAwakeningSystem.eligible(context,option.id);
  case 'ultimateBoost':return !!s.ultimate&&s.ultimateRank<2;
  case 'boost':return true;
 }
}
export class UpgradeOptionPool {
 static offers(context:EvolutionContext):string[]{
  const {state:s}=context,ranks=effectiveElements(context),valid=UPGRADE_OPTIONS.filter(o=>optionAllowed(context,o));
  if(s.stage===0)return valid.filter(o=>o.kind==='form').map(o=>o.id);
  const result:string[]=[];
  const add=(id:string)=>{if(result.length<3&&valid.some(o=>o.id===id)&&!result.includes(id))result.push(id);};
  if(s.stage>=4){
   if(s.ultimate)add('ultimate:boost');else for(const o of valid.filter(o=>o.kind==='ultimate'))add(o.id);
  }
  if(s.stage===1)for(const o of valid.filter(o=>o.kind==='mutation'))add(o.id);
  // A deterministic pair at 4:00 and the missing calamity element at 5:30.
  // Existing tins count, so the route never relies on a random rare roll.
  if(s.stage===2){
   const missing=(['fire','ice','poison'] as const).filter(e=>!ranks[e]);
   if(missing.length>=2)add('pair:'+missing.slice(0,2).join('+'));
   else if(missing.length)add('element:'+missing[0]);
  }
  if(s.stage>=3)for(const e of ['fire','ice','poison'] as const)if(!ranks[e])add('element:'+e);
  // Keep one alternative available while a required build piece occupies a guaranteed slot.
  if(s.stage===2)add('element:lightning');
  if(s.stage>=2&&result.length<2)for(const o of valid.filter(o=>o.kind==='mutation'))add(o.id);
  if(s.stage>=2&&result.length<2)for(const e of ELEMENT_IDS)if(ranks[e]&&ranks[e]<2)add('element:'+e);
  for(const id of ['boost:power','boost:haste','boost:reach'])add(id);
  return result;
 }
 static isId(value:unknown):value is string{return typeof value==='string'&&Object.hasOwn(OPTION_BY_ID,value);}
}
