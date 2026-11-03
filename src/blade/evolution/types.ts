import type {GearInventory} from '../gear';

export type FormId='greatsword'|'dual'|'wave';
export type MutationId='extraSlash'|'orbit'|'explosive'|'piercing';
export type ElementId='fire'|'ice'|'poison'|'lightning';
export type UltimateId='calamity'|'inferno'|'thunderShadow'|'myriad'|'permafrost'|'plague';
export type ElementRanks=Record<ElementId,0|1|2>;
export interface Requirements {form?:FormId;elements?:ElementId[];anyMutation?:MutationId[];wave?:boolean}
export interface EvolutionState {
 form:FormId|null;mutations:MutationId[];elements:ElementRanks;ultimate:UltimateId|null;ultimateRank:number;
 stage:number;offers:string[];boosts:{power:number;haste:number;reach:number};
 reactionReady:Record<string,number>;orbitReady:number;queuedSlashes:number;
}
export interface EvolutionContext {state:EvolutionState;gear?:GearInventory}
export interface UpgradeOption {
 id:string;name:string;description:string;kind:'form'|'mutation'|'element'|'ultimate'|'boost'|'ultimateBoost';
 color:string;form?:FormId;mutation?:MutationId;elements?:ElementId[];ultimate?:UltimateId;
 boost?:'power'|'haste'|'reach';requires?:Requirements;enabled?:boolean;
}
export const EVOLUTION_LIMITS={forms:1,mutations:2,elements:3,ultimates:1} as const;
export const IMPORTANT_UPGRADE_TIMES=[60,150,240,330,420,510] as const;
export const AUTO_GROWTH={levels:21,interval:27} as const;
export const ELEMENT_IDS:ElementId[]=['fire','ice','poison','lightning'];
export const emptyElements=():ElementRanks=>({fire:0,ice:0,poison:0,lightning:0});
export const freshEvolution=():EvolutionState=>({form:null,mutations:[],elements:emptyElements(),ultimate:null,ultimateRank:0,
 stage:0,offers:[],boosts:{power:0,haste:0,reach:0},reactionReady:{},orbitReady:0,queuedSlashes:0});
