import { describe, it, expect } from 'vitest';
import { BladeRun, restoreSnapshot, validSnapshot } from '../src/blade/simulation';
import { GAME_DURATION, MASTERIES, MIN_FORM_TIME, PERKS, TIERS, TIER_LEVELS, encounterDensity, freshPerks, xpNext, type PerkId } from '../src/blade/config';
import { equipmentStats } from '../src/blade/equipment';
import { passiveForTier, passiveRules } from '../src/blade/passives';

const idle = { x: 0, y: 0, dash: false };
const step = (r: BladeRun, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) r.step(1 / 60, idle); };
const isolated = (blade: number, level = 1) => {
  const r = new BladeRun(71, undefined, blade); r.state.enemies = []; r.state.level = level;
  r.state.attackTimer = 10000; r.state.spawnBudget = -10000; r.view = { width: 20000, height: 20000 }; return r;
};
const strike = (r: BladeRun) => {
  const stats = r.stats, s = r.state;
  s.swing = { id: s.nextId++, tier: r.tier, angle: 0, age: stats.windup + stats.strike * .45, windup: stats.windup, strike: stats.strike, recovery: stats.recovery, resolved: false };
  r.step(1 / 60, idle);
};
const target = (r: BladeRun, x = 45) => { const e = r.spawnEnemy('armor', x, 0); e.hp = e.maxHp = 10000; e.speed = 0; e.cooldown = 1000; return e; };

describe('parallel blade routes and exaggerated forging', () => {
  it('starts all twelve loadouts at the same level with their own passive immediately', () => {
    const intervals: number[] = [], damage: number[] = [];
    TIERS.forEach((t, i) => {
      const r = new BladeRun(71, undefined, i);
      expect(r.bladeId).toBe(t.id); expect(r.mastery).toBe(0); expect(r.state.level).toBe(1);
      expect(r.passiveInfo.name).toBe(passiveForTier(i).name); expect(r.state.perks.long).toBe(0);
      intervals.push(r.stats.interval); damage.push(r.stats.damage);
    });
    // Different archetypes trade speed, reach and damage; neither stat follows catalogue order.
    expect(intervals[5]).toBeGreaterThan(intervals[1]); expect(damage[5]).toBeGreaterThan(damage[11]);
    expect(new BladeRun(71, undefined, 99).tier).toBe(15);
  });
  it('banks XP at mastery boundaries without interrupting movement or changing blades',()=>{
    const r=isolated(9,5);r.grantXp(500);expect(r.state.level).toBe(5);r.state.time=MIN_FORM_TIME-.1;step(r,.05);expect(r.state.level).toBe(5);step(r,.1);
    expect(r.state.level).toBe(11);expect(r.state.mode).toBe('playing');expect(r.state.pending).toEqual([]);expect(r.state.choices).toEqual([]);expect(r.tier).toBe(9);expect(r.state.totalXp).toBe(500);
    expect(r.state.xp).toBe(500-Array.from({length:6},(_,i)=>xpNext(i+5)).reduce((a,b)=>a+b,0));
  });

  it('upgrades collected equipment without allocating any old forge stacks',()=>{
    const r=isolated(6);for(let i=0;i<5;i++){const d=r.addRelicDrop('ruler',0,0)!;d.spawn=0;expect(r.pickupRelic(d.id)).toBe(true);}
    expect(r.state.relics.ruler).toBe(5);expect(r.availableRelics).not.toContain('ruler');expect(r.state.perks.long).toBe(0);expect(r.state.pending).toEqual([]);
    const d=r.addRelicDrop('anvil',0,0)!;d.spawn=0;r.pickupRelic(d.id);expect(r.state.relics.anvil).toBe(1);
  });

  it('retains positive, usable handling at all new caps with accurate physical dimensions', () => {
    const perks = Object.fromEntries(Object.entries(PERKS).map(([k, p]) => [k, k === 'heal' ? 0 : p.cap])) as Record<PerkId, number>;
    for (let blade = 0; blade < TIERS.length; blade++) {
      const stats = equipmentStats(30, perks, blade), base = TIERS[blade];
      expect(Object.values(stats).every(Number.isFinite)).toBe(true); expect(stats.mass).toBeGreaterThan(0);
      expect(stats.moveSpeed).toBeGreaterThan(120); expect(stats.acceleration).toBeGreaterThan(300);
      expect(stats.range).toBe(420); expect(stats.widthScale).toBeGreaterThan(8);
      expect(10 + (base.range - 10) * stats.lengthScale).toBeCloseTo(stats.range);
      expect(stats.interval).toBeGreaterThan(stats.windup + stats.strike + stats.recovery);
    }
    const large = equipmentStats(28, { ...freshPerks(), long: 8, giant: 6, broad: 7 }, 5);
    const reduced = equipmentStats(28, { ...freshPerks(), long: 8, giant: 6, broad: 7, hollow: 10, grip: 8 }, 5);
    expect(large.range).toBeGreaterThan(350); expect(large.widthScale).toBeGreaterThan(6);
    expect(reduced.range).toBe(large.range); expect(reduced.widthScale).toBe(large.widthScale); expect(reduced.damage).toBe(large.damage);
    expect(reduced.mass).toBeCloseTo(large.mass * .86 ** 10); expect(reduced.windup).toBeLessThan(large.windup);
  });
  it('awakening strengthens all twelve own passives and communicates every mastery step', () => {
    TIERS.slice(0,15).forEach((_, blade) => {
      const descriptions = MASTERIES.map((__, mastery) => passiveForTier(blade, mastery).description);
      expect(new Set(descriptions).size).toBe(5); expect(passiveForTier(blade, 0).name).toBe(passiveForTier(blade, 4).name);
    });
  });
  it('awakened Well Moon releases five real piercing waves every four effective swings', () => {
    const r = isolated(2, 28), e = target(r);
    for (let i = 0; i < 4; i++) { e.knockX = e.knockY = 0; strike(r); }
    const waves = r.state.waves.filter(w => w.kind === 'moon'); expect(waves).toHaveLength(5);
    expect(waves.every(w => w.pierce === 10 && Math.abs(w.maxRange - 380 * Math.sqrt(r.stats.lengthScale)) < .001 && w.hitRadius! > 10)).toBe(true); expect(r.state.passive.hits).toBe(0);
  });
  it('awakened Snow freezes normal enemies in two hits while special enemies remain unfrozen', () => {
    const r = isolated(6, 28), ordinary = target(r), boss = r.spawnEnemy('boss', 60, 10);
    boss.hp = boss.maxHp = 10000; boss.speed = 0; boss.cooldown = 1000;
    strike(r); ordinary.knockX = ordinary.knockY = 0; strike(r);
    expect(ordinary.freeze).toBeCloseTo(1.4); expect(boss.freeze).toBe(0); expect(boss.chillStacks).toBe(2);
  });
  it('mastered Promise counterattacks on a blocked projectile without losing health or flawless status', () => {
    const r = isolated(7, 28), rear = target(r, -55); r.state.passive.shield = true; r.state.invincible = 0;
    expect(r.damagePlayer(30, 'test')).toBe(false); expect(r.state.hp).toBe(100); expect(r.state.bossHits).toBe(0);
    expect(rear.hp).toBe(10000 - Math.round(r.stats.damage * passiveRules(4).guardCounter)); expect(r.state.passive.cooldown).toBe(6);
  });
  it('awakened Shusui triggers on the second hit, and Enma pays less for its third-hit burst', () => {
    const shusui = isolated(8, 28), e = target(shusui), damage = shusui.stats.damage;
    strike(shusui); e.knockX = e.knockY = 0; strike(shusui);
    expect(e.hp).toBe(10000 - damage - Math.round(damage * 3.4));
    const enma = isolated(9, 28), f = target(enma);
    for (let i = 0; i < 3; i++) { f.knockX = f.knockY = 0; strike(enma); }
    expect(enma.state.hp).toBe(98); expect(enma.state.passive.hits).toBe(0);
  });
  it('endgame density rises to 10.8 spawns per second and respects each rendering budget', () => {
    expect(encounterDensity(0)).toEqual({ rate: .9, cap: 100 }); expect(encounterDensity(GAME_DURATION)).toEqual({ rate: 10.8, cap: 280 });
    expect(encounterDensity(GAME_DURATION-10).rate).toBeGreaterThan(encounterDensity(GAME_DURATION*.5).rate * 3);
    for (const lite of [false, true]) {
      const r = isolated(0); r.simplified = lite; r.state.time = GAME_DURATION-1; r.state.spawnBudget = 1000;
      const cap = encounterDensity(599, lite).cap;
      for (let i = 0; i < cap; i++) r.spawnEnemy('blob', 1000 + i * 35, 1000);
      r.step(1 / 60, idle); expect(r.state.enemies.length).toBeLessThanOrEqual(cap);
      expect(validSnapshot(r.snapshot())).toBe(true);
    }
  });
  it('round-trips high legacy forge stacks, blade identity, statuses and ground loot without rerolling',()=>{
    const r=isolated(4,20);r.state.perks.long=12;r.state.perks.broad=10;r.state.time=180;const e=target(r);e.burnTime=1;e.burnDamage=4;r.addRelicDrop('phoenix',800,400);
    const snapshot=r.snapshot();expect(validSnapshot(snapshot)).toBe(true);expect(restoreSnapshot(snapshot)).toEqual(snapshot);expect(new BladeRun(1,restoreSnapshot(snapshot)!).stats).toEqual(r.stats);
  });

  it('migrates a v4 story-passive save into the same blade and retains its saved charges', () => {
    const r = isolated(2, 5); r.state.time = 60; r.state.passive.hits = 7; r.state.perks.long = 3;
    const legacy = { ...r.snapshot(), version: 4 } as Record<string, unknown>; delete legacy.blade; delete legacy.forgeAwakening;
    const before = JSON.stringify(legacy), saved = restoreSnapshot(legacy)!;
    expect(saved.blade).toBe(2); expect(saved.passive.hits).toBe(7); expect(saved.rng).toBe(r.state.rng); expect(saved.perks.long).toBe(3);
    expect(saved.xp).toBe(r.state.xp); expect(JSON.stringify(legacy)).toBe(before);
    expect(new BladeRun(1, saved).tier).toBe(2); expect(new BladeRun(1, saved).mastery).toBe(0);
  });
});
