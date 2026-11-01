import { freshGearCombat } from './build-state';
import {freshEconomy,freshGear,GEAR_IDS,isGearId,gearSpent,gearMaxHp,bloodShieldCap,SURVIVAL_DURATION,FINALE_DURATION} from './gear';
import {previousGearSpent,type PreviousEconomy} from './retired-shop-state';
import { freshPerks } from './config';
import { freshRelics, freshRelicState } from './relics';
import { freshRelicLoot } from './relic-loot';
import { freshEnemyEffects, freshPassive } from './passives';
import { freshActive } from './active-skills';
import { freshArchery } from './bows';
import { migrateBasicWeapon } from './weapon-migration';
import type { RunState } from './simulation';

// Only called after historical validation. Old carried gear is refunded once;
// uncollected gear becomes coins at the same world positions, never remote credit.
export function migrateEconomy(snapshot: RunState): RunState {
  if (snapshot.version === 13) return snapshot;
  if (snapshot.version === 10 || snapshot.version === 11 || snapshot.version === 12) {
    const previous=snapshot.economy as unknown as PreviousEconomy,gear=freshGear();
    for(const id of GEAR_IDS)gear[id]=previous.gear[id]??0;
    const credit=previousGearSpent(previous,snapshot.version)-gearSpent(gear),ratio=snapshot.hp/snapshot.maxHp;
    const old=snapshot.build as unknown as {bloodShield?:number;bloodShieldTime?:number;healClock:number;healUsed:number};
    snapshot.economy={wallet:previous.wallet+credit,earned:previous.earned,spent:previous.spent-credit,refunded:previous.refunded,gear,order:previous.order.filter(isGearId)};
    snapshot.maxHp=100+2*(snapshot.level-1)+gearMaxHp(gear);snapshot.hp=Math.max(1,Math.min(snapshot.maxHp,snapshot.maxHp*ratio));
    snapshot.build={...freshGearCombat(),bloodShield:Math.min(old.bloodShield??0,bloodShieldCap(snapshot.maxHp,gear)),bloodShieldTime:old.bloodShieldTime??0,healClock:old.healClock,healUsed:Math.min(old.healUsed,snapshot.maxHp*.05)};
    snapshot.swing=null;snapshot.attackTimer=.2;snapshot.velocity={x:0,y:0};
    if(snapshot.blade===17)snapshot.archery=freshArchery();
    snapshot.version=13;return snapshot;
  }
  if (snapshot.version === 9) {
    const ratio=snapshot.hp/snapshot.maxHp;
    snapshot.economy=freshEconomy(snapshot.economy!.earned);
    snapshot.version=13;snapshot.build=freshGearCombat();snapshot.maxHp=100+2*(snapshot.level-1);
    snapshot.hp=Math.max(1,snapshot.maxHp*ratio);snapshot.swing=null;snapshot.attackTimer=.2;
    if (snapshot.blade===17) snapshot.archery=freshArchery();
    return snapshot;
  }
  const s = migrateBasicWeapon(snapshot);
  const oldWave = s.classicTiming ? 600 : 360, oldBoss = s.classicTiming ? 90 : 45;
  const scaleTime = (time: number) => time <= oldWave ? time / oldWave * SURVIVAL_DURATION : SURVIVAL_DURATION + (time - oldWave) / oldBoss * FINALE_DURATION;
  const refund = Object.values(s.relics).reduce((a, b) => a + b, 0) * 36
    + Object.entries(s.perks).reduce((sum, [id, rank]) => sum + (id === 'heal' ? 0 : rank * 18), 0);
  const groups = new Set<number>();
  for (const d of s.relicDrops) {
    if (d.group && groups.has(d.group)) continue;
    if (d.group) groups.add(d.group);
    s.orbs.push({id: s.nextId++, x: d.x, y: d.y, value: 20, kind: 'coin', dropTimer: 0});
  }
  const healthRatio = s.hp / s.maxHp;
  s.version = 13; s.build = freshGearCombat(); s.economy = freshEconomy(refund); s.classicTiming = false;
  s.time = s.time / oldWave * SURVIVAL_DURATION;
  s.bossTime = s.bossTime / oldBoss * FINALE_DURATION;
  s.formStartedAt = scaleTime(s.formStartedAt);
  s.recentKills = s.recentKills.map(scaleTime);
  s.maxHp = 100 + (s.level - 1) * 2; s.hp = Math.max(1, Math.min(s.maxHp, s.maxHp * healthRatio));
  s.relics = freshRelics(); s.relicState = freshRelicState(); s.relicLoot = freshRelicLoot(s.seed); s.relicDrops = [];
  s.perks = freshPerks(); s.passive = freshPassive(s.blade); s.active = freshActive(); s.swing = null; s.waves = []; s.attackTimer = .2;
  if (s.blade === 17) s.archery = freshArchery(); else delete s.archery;
  if (s.mode === 'boss-intro') { s.mode = 'playing'; s.transition = 0; }
  for (const e of s.enemies) Object.assign(e, freshEnemyEffects());
  return s;
}
