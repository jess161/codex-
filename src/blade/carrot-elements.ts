import type {GearInventory} from './gear';
import type {EvolutionState} from './evolution/types';
import {effectiveElements,gearElements} from './evolution/ElementSystem';

export type ElementRank=0|1|2;
export interface CarrotElements {poison:ElementRank;fire:ElementRank;frost:ElementRank;electric:ElementRank}
export type CarrotTrail='poison'|'fire'|'frost'|'electric';
export const CARROT_TRAILS:CarrotTrail[]=['poison','fire','frost','electric'];
export function carrotElements(gear?:GearInventory,state?:EvolutionState):CarrotElements {
 const ranks=state?effectiveElements({state,gear}):gearElements(gear);
 return {poison:ranks.poison,fire:ranks.fire,frost:ranks.ice,electric:ranks.lightning};
}
export const hasCarrotElements=(elements:CarrotElements)=>CARROT_TRAILS.some(kind=>elements[kind]>0);
