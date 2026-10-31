import { describe, it, expect } from 'vitest';
import { BladeRun, restoreSnapshot, validSnapshot } from '../src/blade/simulation';
import { GAME_DURATION, MIN_FORM_TIME, MASTERIES, TIER_LEVELS, sectorHits, xpNext, xpToLevel } from '../src/blade/config';
const input = { x: 0, y: 0, dash: false };
const step = (r: BladeRun, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) r.step(1 / 60, input); };
const empty = (seed = 1234) => { const r = new BladeRun(seed); r.state.enemies = []; return r; };
const resolveUpgrades = (r: BladeRun) => { while (r.state.pending.length) { r.step(1 / 60, input); step(r, .5); expect(r.state.mode).toBe('relic'); if(r.state.choices.length)r.chooseRelic(0);else r.skipRelic(); } };

describe('Blade Evolution combat and progression', () => {
  it('stores surplus XP, grants 29 forges and preserves the chosen blade across five mastery stages', () => {
    expect(xpToLevel(30)).toBe(2770);
    const r = new BladeRun(12, undefined, 6); r.state.enemies = []; r.grantXp(2787);
    let forges = 0, awakenings = 0;
    for (let i = 0; i < 5000 && (r.state.level < 30 || r.state.pending.length); i++) {
      if (r.holdingXp) r.state.time = r.state.formStartedAt + MIN_FORM_TIME;
      r.step(1 / 60, input);
      if (r.state.mode === 'relic') { if (r.state.forgeAwakening) awakenings++; if(r.state.choices.length)r.chooseRelic(0);else r.skipRelic(); forges++; }
    }
    expect(r.state.level).toBe(30); expect(r.state.totalXp).toBe(2787); expect(r.state.xp).toBe(0);
    expect(r.tier).toBe(6); expect(r.mastery).toBe(MASTERIES.length - 1); expect(forges).toBe(29); expect(awakenings).toBe(4);
    expect(Object.values(r.state.relics).reduce((a, b) => a + b) + r.state.skipped).toBe(29); expect(r.chooseRelic(0)).toBe(false);
  });
  it('ordinary levels grant a brief frozen forge and one recovery point', () => {
    const r = empty(); r.state.hp = 42; r.grantXp(xpNext(1)); step(r, .2);
    expect(r.state.level).toBe(2); expect(r.state.hp).toBe(43); expect(r.state.mode).toBe('relic');
  });
  it('pauses combat, world clocks and boss clock during forge; persists the exact choices', () => {
    const r = empty(); r.state.time = MIN_FORM_TIME; r.grantXp(xpNext(1)); r.state.hp = 50; step(r, .6);
    expect(r.state.mode).toBe('relic'); expect(r.state.hp).toBe(51);
    const before = r.snapshot(); step(r, 3); expect(r.snapshot()).toEqual(before);
    expect(validSnapshot(before)).toBe(true);
    const continued = new BladeRun(0, before); expect(continued.state.choices).toEqual(before.choices); expect(continued.random()).toBe(r.random());
  });
  it('hits multiple targets in the forward sector once per swing, with no rear hit', () => {
    const r = empty(); r.state.attackTimer = 0;
    const a = r.spawnEnemy('armor', 45, 0), b = r.spawnEnemy('armor', 50, 15), back = r.spawnEnemy('armor', -52, 0);
    for (const e of [a, b, back]) { e.hp = e.maxHp = 500; e.speed = 0; }
    step(r, .3);
    expect(a.hp).toBe(500 - r.stats.damage); expect(b.hp).toBe(500 - r.stats.damage); expect(back.hp).toBe(500);
  });
  it('uses actual sector boundaries including enemy circle edges', () => {
    expect(sectorHits(64, 0, 14, 0, 64, 100)).toBe(true);
    expect(sectorHits(95, 0, 14, 0, 64, 100)).toBe(false);
    expect(sectorHits(-45, 0, 10, 0, 64, 100)).toBe(false);
  });
  it('all twelve parallel blades grow in damage without changing identity', () => {
    for (let blade = 0; blade < 12; blade++) {
      const r = new BladeRun(12, undefined, blade); let previous = 0;
      for (let level = 1; level <= 30; level++) { r.state.level = level; expect(r.stats.damage).toBeGreaterThanOrEqual(previous); previous = r.stats.damage; expect(r.tier).toBe(blade); }
    }
  });
  it('separates blade-wave damage, deduplicates wave hits and enforces pierce', () => {
    const r = empty(); r.state.level = 13; r.state.attackCount = 4; r.state.attackTimer = 0;
    const a = r.spawnEnemy('armor', 55, 0); a.hp = a.maxHp = 500; a.speed = 0;
    step(r, .35);
    expect(a.hp).toBe(500 - r.stats.damage - Math.round(r.stats.damage * .6));
  });
  it('dashes 140 units in the last movement direction, with cooldown and global invulnerability', () => {
    const r = empty(); r.state.invincible = 0;
    expect(r.dash()).toBe(true); expect(r.damagePlayer(20, 'hit')).toBe(false); expect(r.dash()).toBe(false);
    step(r, .2); expect(r.state.player.y).toBeCloseTo(-140, 4); expect(r.state.dashCooldown).toBeGreaterThan(4.7);
    expect(r.damagePlayer(10, 'hit')).toBe(true); expect(r.damagePlayer(10, 'hit')).toBe(false); expect(r.state.hp).toBe(90);
  });
  it('keeps every XP object at its original drop position without merging', () => {
    const r = empty(); for (let i = 0; i < 200; i++) r.addOrb(i * 10, 0, 3, 'xp');
    expect(r.state.orbs).toHaveLength(200); expect(r.state.orbs.map(o=>o.x)).toEqual(Array.from({length:200},(_,i)=>i*10)); expect(r.state.orbs.reduce((v, o) => v + o.value, 0)).toBe(600);
  });
  it('starts boss without clearing dropped XP or awarding removed monster XP', () => {
    const r = empty(); r.state.time = GAME_DURATION - .01; r.state.hp = 50; r.spawnEnemy('blob', 100, 100); r.addOrb(300, 300, 3, 'xp');
    r.step(1 / 60, input); expect(r.state.mode).toBe('boss-intro'); expect(r.state.totalXp).toBe(0); expect(r.state.orbs).toHaveLength(1); expect(r.state.orbs[0]).toMatchObject({x:300,y:300,value:3}); expect(r.state.kills).toBe(0);
    expect(r.state.hp).toBe(65); expect(r.state.enemies).toHaveLength(1); expect(r.state.enemies[0].hp).toBe(8000);
    const time = r.state.time; step(r, .5); expect(r.state.time).toBe(time); expect(r.state.bossTime).toBe(0);
  });
  it('ends the run at the boss deadline and freezes the terminal result', () => {
    const r = empty(); r.state.bossStarted = true; r.state.time = GAME_DURATION; r.state.bossTime = 89.99;
    r.step(1 / 60, input); expect(r.state.mode).toBe('dead'); expect(r.state.failure).toContain('时间耗尽');
    const ended = r.snapshot(); step(r, 1); expect(r.snapshot()).toEqual(ended); expect(validSnapshot(ended)).toBe(false);
  });
  it('can defeat the boss through regular melee and computes the exact victory score', () => {
    const r = empty(); r.state.level = 28; r.state.bossStarted = true; r.state.time = GAME_DURATION; r.state.bossTime = 10; r.state.attackTimer = 0;
    const boss = r.spawnEnemy('boss', 80, 0); boss.hp = 100; boss.speed = 0;
    step(r, 2); expect(r.state.mode).toBe('won'); expect(r.score()).toBe(1000 + Math.floor(90 - r.state.bossTime) * 10);
  });
  it('restarts all combat stats and keeps seeded simulation repeatable', () => {
    const a = empty(42), b = empty(42); step(a, 5); step(b, 5);
    expect(a.state.enemies).toEqual(b.state.enemies); expect(a.state.rng).toBe(b.state.rng);
    expect(a.state.level).toBe(1); expect(a.state.maxHp).toBe(100); expect(a.state.perks.sharp).toBe(0);
  });
  it('never spawns ordinary monsters inside either viewport orientation', () => {
    for (const view of [{ width: 960, height: 540 }, { width: 540, height: 1160 }]) {
      const r = empty(); r.view = view; r.state.time = 60; r.state.spawnBudget = 2; r.step(.001, input);
      expect(r.state.enemies.length).toBe(2);
      for (const e of r.state.enemies) expect(Math.abs(e.x) > view.width / 2 || Math.abs(e.y) > view.height / 2).toBe(true);
    }
  });
  it('rejects malformed and terminal snapshots without modifying the current save', () => {
    const s = empty().snapshot(); expect(validSnapshot(s)).toBe(true);
    expect(validSnapshot({ ...s, hp: NaN })).toBe(false); expect(validSnapshot({ ...s, level: 100 })).toBe(false);
    expect(validSnapshot({ ...s, player: { x: Infinity, y: 0 } })).toBe(false);
    expect(validSnapshot({ ...s, mode: 'relic' })).toBe(false);
    expect(validSnapshot({ ...s, waves: [{ id: 1, x: 0, y: 0 }] })).toBe(false);
    expect(validSnapshot({ ...s, mode: 'relic', pending: [1], choices: ['toString', 'sharp', 'quick'] })).toBe(false);
  });
  it('migrates a six-form forge save without losing choices, RNG, damage or XP', () => {
    const r = empty(); r.state.level = 15; r.state.totalXp = 530; r.state.xp = 7;
    const legacy = { ...r.snapshot(), version: 1, mode: 'forge', pending: [1, 2, 3], choices: ['sharp', 'quick', 'range'],
      waves: [{ id: 50, x: 10, y: 20, angle: 0, distance: 20, maxRange: 300, damage: 99, pierce: 8, hit: [2], tier: 5 }],
      swing: { id: 51, age: .02, angle: 0, tier: 3, resolved: false } };
    const before = JSON.stringify(legacy), restored = restoreSnapshot(legacy)!;
    expect(validSnapshot(restored)).toBe(true); expect(restored.version).toBe(7);
    expect(restored.pending).toEqual([15]); expect(restored.choices).toEqual(['stone', 'hourglass', 'ruler']);
    expect(restored.rng).toBe(legacy.rng); expect(restored.totalXp).toBe(530); expect(restored.xp).toBe(10);
    expect(restored.waves[0]).toMatchObject({ tier: 10, damage: 99, hit: [2] }); expect(restored.swing!.tier).toBe(6);
    expect(JSON.stringify(legacy)).toBe(before);
    expect(restoreSnapshot({ ...legacy, pending: [9] })).toBeNull();
    expect(restoreSnapshot({ ...legacy, waves: [{ ...legacy.waves[0], tier: 99 }] })).toBeNull();
  });
  it('round-trips stored XP and rejects out-of-range form references', () => {
    const r = empty(); r.state.time = MIN_FORM_TIME; r.grantXp(2770); step(r, .6);
    const snapshot = r.snapshot(), restored = restoreSnapshot(snapshot)!;
    expect(restored.pending).toHaveLength(1); expect(restored.choices).toEqual(snapshot.choices); expect(restored.xp).toBe(snapshot.xp);
    expect(validSnapshot({ ...snapshot, pending: [12] })).toBe(false);
    expect(validSnapshot({ ...snapshot, swing: { id: 9, age: 0, angle: 0, tier: 12, resolved: false } })).toBe(false);
    const continued = new BladeRun(0, restored); resolveUpgrades(continued);
    expect(continued.tier).toBe(0); expect(continued.state.mode).toBe('playing');
    expect(Object.values(continued.state.relics).reduce((a, b) => a + b, 0)).toBe(1);
  });
  it('executes the telegraphed boss shock and leaves a real safe gap', () => {
    const r = empty(); r.state.bossStarted = true; r.state.time = GAME_DURATION; r.state.invincible = 100;
    const boss = r.spawnEnemy('boss', 0, -180); boss.move = 1; boss.cooldown = 0;
    step(r, .05); expect(boss.action).toBe('windup');
    step(r, .95); expect(r.state.shocks).toHaveLength(1); expect(r.state.shocks[0].radius).toBeGreaterThan(0);
  });
  it('never exceeds the boss summon cap, even when five summons are already alive', () => {
    const r = empty(); r.state.bossStarted = true; r.state.time = GAME_DURATION; r.state.invincible = 100;
    const boss = r.spawnEnemy('boss', 0, -180); boss.move = 3; boss.cooldown = 0;
    for (let i = 0; i < 5; i++) r.spawnEnemy('swift', 500 + i * 30, 500);
    step(r, .9); expect(r.state.enemies.filter(e => e.kind === 'swift')).toHaveLength(6);
  });
});
