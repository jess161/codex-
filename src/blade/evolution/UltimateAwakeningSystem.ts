import {OPTION_BY_ID} from './config';
import type {EvolutionContext,Requirements} from './types';
import {effectiveElements} from './ElementSystem';
import {WeaponFormSystem} from './WeaponFormSystem';
export function meetsRequirements(context:EvolutionContext,requires?:Requirements){
 if(!requires)return true;const {state}=context,ranks=effectiveElements(context);
 return (!requires.form||state.form===requires.form)&&(!requires.wave||WeaponFormSystem.hasWave(state))
  &&(!requires.elements||requires.elements.every(e=>ranks[e]>0))&&(!requires.anyMutation||requires.anyMutation.some(m=>state.mutations.includes(m)));
}
export class UltimateAwakeningSystem {
 static eligible(context:EvolutionContext,id:string){const option=OPTION_BY_ID[id];return !!option&&option.kind==='ultimate'&&option.enabled!==false&&!context.state.ultimate&&meetsRequirements(context,option.requires);}
}
