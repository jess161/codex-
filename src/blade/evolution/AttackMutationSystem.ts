import {FORMS,ULTIMATE_RULES,MUTATION_RULES} from './config';
import type {EvolutionState} from './types';
export class AttackMutationSystem {
 static slashCount(state:EvolutionState){return (state.form?FORMS[state.form].slashes:1)+(state.mutations.includes('extraSlash')?MUTATION_RULES.extraSlashes:0);}
 static wavePierce(state:EvolutionState){return (state.mutations.includes('piercing')?MUTATION_RULES.piercingTargets:1)+(state.ultimate==='myriad'?ULTIMATE_RULES.myriad[state.ultimateRank===2?1:0].pierce:0);}
 static waveSpreads(state:EvolutionState){return state.ultimate==='myriad'?ULTIMATE_RULES.myriad[state.ultimateRank===2?1:0].spreads:[0];}
}
