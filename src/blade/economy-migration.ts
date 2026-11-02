import {restoreSnapshot,type RunState} from './simulation';

// Historical entry point retained for old callers. Old formats are no longer converted.
export function migrateEconomy(snapshot:RunState):RunState {
  const current=restoreSnapshot(snapshot);
  if(!current)throw new Error('游戏已更新，旧存档已清除，请重新开局。');
  return current;
}
