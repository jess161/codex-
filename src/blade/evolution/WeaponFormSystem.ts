import type {EquipmentStats} from '../equipment';
import {FORMS} from './config';
import type {EvolutionState} from './types';
import {AttackMutationSystem} from './AttackMutationSystem';
export class WeaponFormSystem {
 static stats(base:EquipmentStats,state:EvolutionState):EquipmentStats {
  const form=state.form?FORMS[state.form]:null,interval=(form?.interval??1)*.9**state.boosts.haste;
  const range=16+(base.range-16)*(form?.range??1)*(1+.12*state.boosts.reach);
  // Keep every extra slash inside the attack cycle; animation locking must not
  // silently cancel the extra slash's increase in attack frequency.
  const timing=interval/AttackMutationSystem.slashCount(state);
  return {...base,damage:Math.round(base.damage*(form?.damage??1)*(1+.18*state.boosts.power)),range,
   lengthScale:(range-10)/62,widthScale:base.widthScale*(form?.width??1),
   interval:base.interval*interval,windup:base.windup*timing,strike:base.strike*timing,recovery:base.recovery*timing};
 }
 static hasWave(state:EvolutionState){return !!state.form&&FORMS[state.form].wave;}
}
