import { isBasicWeapon, toBasicWeapon } from './config';
import { freshActive } from './active-skills';
import { freshArchery } from './bows';
import { freshEnemyEffects, freshPassive } from './passives';
import type { RunState } from './simulation';

// Applied at the storage boundary after validating a historical snapshot. Progress,
// world drops and RNG stay intact; retired weapon attacks cannot leak into the new kit.
export function migrateBasicWeapon(state: RunState): RunState {
  if (isBasicWeapon(state.blade)) return state;
  state.blade = toBasicWeapon(state.blade);
  state.passive = freshPassive(state.blade);
  state.active = freshActive();
  state.swing = null;
  state.waves = [];
  state.attackTimer = .2;
  if (state.blade === 17) state.archery = freshArchery();
  else delete state.archery;
  for (const enemy of state.enemies) Object.assign(enemy, freshEnemyEffects());
  return state;
}
