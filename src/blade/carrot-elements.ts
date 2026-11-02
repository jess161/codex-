import type {GearInventory} from './gear';

export type ElementRank=0|1|2;
export interface CarrotElements {poison:ElementRank;fire:ElementRank;frost:ElementRank;electric:ElementRank}
export type CarrotTrail='poison'|'fire'|'frost'|'electric';
export const CARROT_TRAILS:CarrotTrail[]=['poison','fire','frost','electric'];
export function carrotElements(gear?:GearInventory):CarrotElements {
 // Ice artwork is prepared only; the current three shop branches remain electric/fire/poison.
 return {poison:gear?.jadeMushroom?2:gear?.mushroomSauce?1:0,fire:gear?.volcanicSauce?2:gear?.chiliSauce?1:0,
  frost:0,electric:gear?.thunderSalt?2:gear?.pepperPowder?1:0};
}
export const hasCarrotElements=(elements:CarrotElements)=>CARROT_TRAILS.some(kind=>elements[kind]>0);
