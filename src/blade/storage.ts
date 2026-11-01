import { DEFAULT_WEAPON, SAVE_KEY, TIERS, TIER_LEVELS, isBasicWeapon, toBasicWeapon } from './config';
import { migrateBasicWeapon } from './weapon-migration';
import { restoreSnapshot, type RunState } from './simulation';
import { isGroundId, type GroundId } from './grounds';
export interface Settings { sound: boolean; monsterSound: boolean; simplified: boolean; motion: boolean; shake: boolean; hitPause: boolean; haptics: boolean; color: number; ground: GroundId; blade: number }
export interface Meta { maxTier: number; seenBlades: number[]; achievements: string[]; runs: number; wins: number; bestScore: number; bestKills: number; bestTime: number; lastFinishedId: string }
export interface SaveData { version: 8; meta: Meta; settings: Settings; run: RunState | null }
export const freshMeta = (): Meta => ({ maxTier: 0, seenBlades: [], achievements: [], runs: 0, wins: 0, bestScore: 0, bestKills: 0, bestTime: 0, lastFinishedId: '' });
export class BladeStorage {
  data: SaveData;
  warning = '';
  constructor() {
    this.data = { version: 8, meta: freshMeta(), settings: { sound: true, monsterSound: true, simplified: false, motion: !matchMedia('(prefers-reduced-motion: reduce)').matches, shake: true, hitPause: true, haptics: false, color: 0, ground: 'grid', blade: DEFAULT_WEAPON }, run: null };
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.meta && typeof saved.meta === 'object') {
        for (const key of ['maxTier', 'runs', 'wins', 'bestScore', 'bestKills', 'bestTime'] as const)
          if (Number.isFinite(saved.meta[key]) && saved.meta[key] >= 0) this.data.meta[key] = saved.meta[key];
        const highest = Math.floor(this.data.meta.maxTier);
        if ([5, 6, 7, 8].includes(saved.version)) {
          this.data.meta.maxTier = Math.min(TIER_LEVELS.length - 1, highest);
          if (Array.isArray(saved.meta.seenBlades)) this.data.meta.seenBlades = [...new Set<number>(saved.meta.seenBlades.filter((i: unknown) => Number.isInteger(i) && Number(i) >= 0 && Number(i) < TIERS.length))];
        } else {
          const oldLevels = saved.version === 1 ? [1, 5, 10, 15, 20, 30] : [1, 3, 5, 7, 9, 11, 13, 16, 19, 22, 25, 30];
          const level = oldLevels[Math.min(oldLevels.length - 1, highest)];
          this.data.meta.maxTier = TIER_LEVELS.reduce((stage, threshold, i) => level >= threshold ? i : stage, 0);
          const seen = saved.version === 1 ? [0, 2, 4, 6, 9, 11][Math.min(5, highest)] : Math.min(TIERS.length - 1, highest);
          this.data.meta.seenBlades = Array.from({ length: seen + 1 }, (_, i) => i);
        }
        if (Array.isArray(saved.meta.achievements)) this.data.meta.achievements = saved.meta.achievements.filter((a: unknown) => typeof a === 'string');
        if (typeof saved.meta.lastFinishedId === 'string') this.data.meta.lastFinishedId = saved.meta.lastFinishedId;
      }
      if (saved.settings) {
        for (const key of ['sound', 'monsterSound', 'simplified', 'motion', 'shake', 'hitPause', 'haptics'] as const) if (typeof saved.settings[key] === 'boolean') this.data.settings[key] = saved.settings[key];
        if (Number.isInteger(saved.settings.color) && saved.settings.color >= 0 && saved.settings.color < 3) this.data.settings.color = saved.settings.color;
        if (isGroundId(saved.settings.ground)) this.data.settings.ground = saved.settings.ground;
        if (Number.isInteger(saved.settings.blade) && saved.settings.blade >= 0 && saved.settings.blade < TIERS.length) this.data.settings.blade = toBasicWeapon(saved.settings.blade);
      }
      if (saved.run) {
        if ([1, 2, 3, 4, 5, 6, 7, 8].includes(saved.version)) this.data.run = restoreSnapshot(saved.run);
        if (this.data.run && !isBasicWeapon(this.data.run.blade)) {
          this.data.run = migrateBasicWeapon(this.data.run);
          this.warning = '旧武器已换为普通武器，对局进度与道具已保留。';
        }
        if (!this.data.run) this.warning = '上次对局无法恢复，已保留图鉴与战绩。';
      }
      this.data.meta.seenBlades = [...new Set(this.data.meta.seenBlades.map(toBasicWeapon))];
    } catch { this.warning = '存档无法读取，将开始新的试炼。'; }
  }
  write(run?: RunState | null) {
    if (run !== undefined) this.data.run = run ? structuredClone(run) : null;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); return true; }
    catch { this.warning = '当前浏览器无法保存进度，请保持游戏窗口。'; return false; }
  }
}
