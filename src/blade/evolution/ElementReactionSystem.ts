import type {ElementId,EvolutionState,ElementRanks} from './types';
import {ULTIMATE_RULES} from './config';
export interface ReactionDefinition {id:string;name:string;elements:ElementId[];cooldown:number;damage:number;radius:number;slow?:number}
export const REACTIONS:ReactionDefinition[]=[
 {id:'calamity',name:'三灾冲击',elements:['fire','ice','poison'],cooldown:2.4,damage:.9,radius:78,slow:.4},
 {id:'steam',name:'冷热冲击',elements:['fire','ice'],cooldown:2,damage:.6,radius:65,slow:.3},
 {id:'toxicFlame',name:'毒火爆发',elements:['fire','poison'],cooldown:2.2,damage:.65,radius:60},
 {id:'brittle',name:'霜毒侵蚀',elements:['ice','poison'],cooldown:2.2,damage:.55,radius:65,slow:.4},
 {id:'overload',name:'雷火过载',elements:['fire','lightning'],cooldown:2,damage:.7,radius:60},
 {id:'conduction',name:'霜雷震荡',elements:['ice','lightning'],cooldown:2,damage:.55,radius:70,slow:.4},
 {id:'ion',name:'毒雷激荡',elements:['poison','lightning'],cooldown:2.2,damage:.65,radius:60},
];
export class ElementReactionSystem {
 static trigger(state:EvolutionState,ranks:ElementRanks,time:number){
  // Triple reaction replaces pair reactions. Cooldowns are shared across all hits,
  // enemies and swords, rather than reset on every fast hit or target change.
  const recipes=REACTIONS.filter(r=>r.elements.every(e=>ranks[e]>0));
  const pool=recipes[0]?.id==='calamity'?[recipes[0]]:recipes;
  const reaction=pool.find(r=>(state.reactionReady[r.id]??0)<=time);if(!reaction)return null;
  let result={...reaction};
  if(result.id==='calamity'&&state.ultimate==='calamity')result={...result,...ULTIMATE_RULES.calamity[state.ultimateRank===2?1:0]};
  state.reactionReady[result.id]=time+result.cooldown;return result;
 }
}
