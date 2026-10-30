import { describe, it, expect } from 'vitest';
import { BladeRun, restoreSnapshot, validSnapshot } from '../src/blade/simulation';
import { MIN_FORM_TIME, xpNext } from '../src/blade/config';
import { RELIC_IDS, RELICS, RELIC_GROUPS, relicGroups, freshRelics, type RelicId } from '../src/blade/relics';
const idle = { x: 0, y: 0, dash: false };
const run = (blade = 0) => { const r = new BladeRun(34, undefined, blade); r.state.enemies = []; r.state.spawnBudget = -100000; r.state.attackTimer = 10000; return r; };
const step = (r: BladeRun, n = 1) => { for (let i = 0; i < n; i++) r.step(1 / 60, idle); };
const award = (r: BladeRun, id: RelicId) => {
  r.state.level++; r.state.pending = [r.state.level]; r.state.mode = 'relic';
  r.state.choices = [id, ...r.availableRelics.filter(k => k !== id).slice(0, 2)];
  expect(r.chooseRelic(id)).toBe(true);
};
const target = (r: BladeRun, x = 42, y = 0, kind: 'armor' | 'boss' = 'armor') => {
  const e = r.spawnEnemy(kind, x, y); e.hp = e.maxHp = 10000; e.speed = 0; e.cooldown = 1000; return e;
};
const strike = (r: BladeRun) => {
  const stats = r.stats, s = r.state;
  s.swing = { id: s.nextId++, tier: r.tier, angle: 0, age: stats.windup + stats.strike * .45, windup: stats.windup, strike: stats.strike, recovery: stats.recovery, resolved: false };
  step(r);
};

describe('passive item choices and progression', () => {
  it('defines four coherent groups of three distinct four-rank items', () => {
    expect(RELIC_IDS).toHaveLength(12);
    for (const group of Object.keys(RELIC_GROUPS)) expect(RELIC_IDS.filter(id => RELICS[id].group === group)).toHaveLength(3);
    expect(relicGroups(freshRelics())).toEqual({ forge: 0, wind: 0, arcane: 0, spirit: 0 });
  });
  it('allows only one offered item and rejects legacy forge IDs, invalid indices and repeat selection', () => {
    const r = run(); r.state.level = 2; r.state.mode = 'relic'; r.state.pending = [2]; r.state.choices = ['stone', 'ruler', 'anvil'];
    const before = r.snapshot();
    for (const bad of ['star', 'sharp', 'toString', 3, -1, NaN, .5] as (RelicId | number)[]) expect(r.chooseRelic(bad)).toBe(false);
    expect(r.snapshot()).toEqual(before); expect(r.chooseRelic(0)).toBe(true); expect(r.state.relics.stone).toBe(1);
    expect(r.state.choices).toEqual([]); expect(r.state.pending).toEqual([]); expect(r.chooseRelic('stone')).toBe(false);
    expect(r.state.perks.sharp).toBe(0);
  });
  it('always offers three unique eligible items for all 29 real upgrade steps across varied seeds', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = new BladeRun(seed); r.state.enemies = []; r.state.attackTimer = 10000; r.state.spawnBudget = -100000; r.grantXp(1000000);
      let picks = 0;
      for (let ticks = 0; ticks < 2000 && (r.state.level < 30 || r.state.pending.length); ticks++) {
        if (r.holdingXp) r.state.time = r.state.formStartedAt + MIN_FORM_TIME;
        step(r);
        if (r.state.mode === 'relic') {
          expect(r.state.choices).toHaveLength(3); expect(new Set(r.state.choices).size).toBe(3);
          expect(r.state.choices.every(id => r.availableRelics.includes(id))).toBe(true);
          expect(validSnapshot(r.snapshot())).toBe(true);
          expect(r.chooseRelic(picks % 3)).toBe(true); picks++;
        }
      }
      expect(picks).toBe(29); expect(Object.values(r.state.relics).reduce((a, b) => a + b, 0)).toBe(29);
      expect(Object.values(r.state.relics).every(rank => rank <= 4)).toBe(true);
    }
  });
  it('removes max-rank items, the capped ruler and endgame XP candy from the pool', () => {
    const r = run(); for (let i = 0; i < 4; i++) award(r, 'stone'); expect(r.availableRelics).not.toContain('stone');
    r.state.perks.long = 12; r.state.perks.range = 6; r.state.level = 30;
    expect(r.stats.range).toBe(420); expect(r.availableRelics).not.toContain('ruler'); expect(r.availableRelics).not.toContain('star');
    expect(r.availableRelics.length).toBeGreaterThanOrEqual(3);
  });
  it('counts distinct items for combinations, never extra ranks of one item', () => {
    const r = run(); award(r, 'stone'); award(r, 'stone'); expect(relicGroups(r.state.relics).forge).toBe(1);
    award(r, 'anvil'); expect(relicGroups(r.state.relics).forge).toBe(2);
    award(r, 'ruler'); expect(relicGroups(r.state.relics).forge).toBe(3);
  });
  it('applies real growth, weight reduction, speed, swing cadence and pickup range', () => {
    const r = run(), base = r.stats; award(r, 'stone'); expect(r.stats.damage).toBeGreaterThan(base.damage);
    award(r, 'ruler'); const long = r.stats; expect(long.range).toBeGreaterThan(base.range * 1.25);
    award(r, 'anvil'); const wide = r.stats; expect(wide.widthScale).toBeGreaterThan(long.widthScale * 1.4);
    award(r, 'feather'); expect(r.stats.range).toBe(wide.range); expect(r.stats.widthScale).toBe(wide.widthScale); expect(r.stats.mass).toBeCloseTo(wide.mass * .86);
    const before = r.stats; award(r, 'bell'); expect(r.stats.moveSpeed).toBeGreaterThan(before.moveSpeed);
    award(r, 'hourglass'); expect(r.stats.interval).toBeLessThan(before.interval);
    const magnet = r.stats.magnet; award(r, 'magnet'); expect(r.stats.magnet).toBeCloseTo(magnet + 21);
    r.state.dashCooldown = 0; expect(r.dash()).toBe(true); expect(r.state.dashCooldown).toBe(4.25);
  });
  it('adds max HP once per heart rank and heals with the active two-piece bonus', () => {
    const r = run(); r.state.hp = 20; award(r, 'heart'); expect(r.state.maxHp).toBe(115); expect(r.state.hp).toBe(35);
    award(r, 'magnet'); const before = r.state.hp; award(r, 'heart'); expect(r.state.maxHp).toBe(130); expect(r.state.hp - before).toBe(18);
    r.state.hp = 50; r.addOrb(0, 0, 10, 'heal'); step(r); expect(r.state.hp).toBe(62);
  });
  it('applies the healing group to the native boss-entry recovery as well as pickups and upgrades', () => {
    const r = run(); award(r, 'heart'); award(r, 'magnet'); r.state.hp = 50; r.state.time = 599.99;
    step(r); expect(r.state.mode).toBe('boss-intro'); expect(r.state.hp).toBe(68);
  });
  it('credits XP candy exactly once on pickup and never reapplies it on restore', () => {
    const r = run(); award(r, 'star'); r.addOrb(0, 0, 10, 'xp'); step(r);
    expect(r.state.totalXp).toBeCloseTo(10.6); expect(r.state.xp).toBeCloseTo(10.6);
    const restored = new BladeRun(1, restoreSnapshot(r.snapshot())!); step(restored);
    expect(restored.state.totalXp).toBeCloseTo(10.6); expect(restored.state.orbs).toHaveLength(0);
  });
  it('freezes choice screens including HP, RNG, status counters, shield cooldown and world time', () => {
    const r = run(); award(r, 'heart'); award(r, 'magnet'); award(r, 'star');
    r.state.invincible = 0; r.damagePlayer(20, 'test'); r.grantXp(xpNext(r.state.level)); step(r, 12);
    expect(r.state.mode).toBe('relic'); const before = r.snapshot(); step(r, 200); expect(r.snapshot()).toEqual(before);
  });
});

describe('item combat and group combinations', () => {
  it('applies bounded, non-stacking burn and slow with direct melee damage', () => {
    const r = run(); award(r, 'ember'); award(r, 'crystal'); const e = target(r), damage = r.stats.damage;
    strike(r); expect(e.burnTime).toBe(2); expect(e.slow).toBe(.16); expect(e.slowTime).toBe(1.2);
    expect(e.burnDamage).toBe(Math.max(1, Math.round(damage * .04 * 1.2)));
    const hp = e.hp; r.state.swing = null; step(r, 30); expect(e.hp).toBeLessThan(hp);
    e.knockX = e.knockY = 0; e.x = 42; e.y = 0; strike(r); expect(e.burnTime).toBe(2);
  });
  it('caps special-enemy slows and preserves stronger innate blade fire', () => {
    const r = run(10); award(r, 'ember'); award(r, 'crystal'); const boss = target(r, 44, 0, 'boss'); strike(r);
    expect(boss.slow).toBe(.15); expect(boss.freeze).toBe(0); expect(boss.burnTime).toBe(r.rules.burnTime);
    expect(boss.burnDamage).toBe(Math.round(r.stats.damage * r.rules.burnTickDamage));
  });
  it('does not extend a stronger innate slow by repeatedly applying a weaker item slow', () => {
    const r = run(); award(r, 'crystal'); const boss = target(r, 44, 0, 'boss');
    boss.slow = .2; boss.slowTime = .5; strike(r);
    expect(boss.slow).toBe(.2); expect(boss.slowTime).toBeLessThan(.5);
  });
  it('charges lightning once per effective swing and chains to at most three distinct live targets', () => {
    const r = run(); for (let i = 0; i < 4; i++) award(r, 'thunder');
    const enemies = [target(r), target(r, 100, 65), target(r, 190, 80), target(r, 400, 0)];
    strike(r); expect(r.state.relicState.lightning).toBe(1); expect(r.events.filter(e => e.type === 'relic')).toHaveLength(0);
    for (const e of enemies) e.knockX = e.knockY = 0;
    strike(r); for (const e of enemies) e.knockX = e.knockY = 0;
    strike(r); const shocks = r.events.filter(e => e.type === 'hit' && e.source === 'relic');
    expect(shocks).toHaveLength(3); expect(r.events.filter(e => e.type === 'relic' && e.item === 'thunder')).toHaveLength(3);
    expect(enemies[3].hp).toBe(10000); expect(r.state.relicState.lightning).toBe(0);
    r.state.enemies = []; strike(r); expect(r.state.relicState.lightning).toBe(0);
  });
  it('adds vulnerability only to direct hits on enemies already carrying a status', () => {
    const r = run(); award(r, 'ember'); award(r, 'crystal'); award(r, 'thunder'); const e = target(r), damage = r.stats.damage;
    strike(r); expect(10000 - e.hp).toBe(damage);
    const hp = e.hp; e.knockX = e.knockY = 0; e.x = 42; strike(r); expect(hp - e.hp).toBe(Math.round(damage * 1.1));
  });
  it('blocks one hit with a real bubble shield and regenerates only after 20 playing seconds', () => {
    const r = run(); award(r, 'heart'); award(r, 'magnet'); award(r, 'star');
    expect(r.state.relicState.shield).toBe(true); r.state.invincible = 0; const hp = r.state.hp;
    expect(r.damagePlayer(20, 'test')).toBe(false); expect(r.state.hp).toBe(hp); expect(r.state.relicState.shieldCooldown).toBe(20);
    step(r, 60); r.state.invincible = 0; expect(r.damagePlayer(20, 'test')).toBe(true);
    step(r, 1139); expect(r.state.relicState.shield).toBe(false); step(r, 1); expect(r.state.relicState.shield).toBe(true);
  });
});

describe('save compatibility and validation', () => {
  it('persists the exact three choices, all levels, shield and charge without consuming RNG', () => {
    const r = run(); for (const id of ['heart', 'magnet', 'star', 'thunder'] as RelicId[]) award(r, id);
    r.state.relicState.lightning = 2; r.state.invincible = 0; r.damagePlayer(10, 'test');
    r.grantXp(xpNext(r.state.level)); step(r, 12); const before = r.snapshot();
    expect(validSnapshot(before)).toBe(true); expect(restoreSnapshot(before)).toEqual(before);
    const copy = new BladeRun(0, restoreSnapshot(before)!); expect(copy.random()).toBe(r.random());
  });
  it('migrates an old forge screen once, preserving stats, XP, HP, entities and RNG', () => {
    const r = run(2); r.state.level = 20; r.state.time = 300; r.state.perks.long = 8; r.state.perks.hollow = 5; target(r);
    const { relics: _items, relicState: _state, ...rest } = r.snapshot();
    const legacy = { ...rest, version: 5, mode: 'forge', pending: [20], choices: ['long', 'range', 'sharp'] };
    const before = JSON.stringify(legacy), copy = restoreSnapshot(legacy)!;
    expect(copy.version).toBe(6); expect(copy.mode).toBe('relic'); expect(new Set(copy.choices).size).toBe(3);
    expect(copy.perks).toEqual(legacy.perks); expect(copy.relics).toEqual(freshRelics()); expect(copy.enemies).toEqual(legacy.enemies);
    expect(copy.rng).toBe(legacy.rng); expect(copy.hp).toBe(legacy.hp); expect(copy.totalXp).toBe(legacy.totalXp);
    expect(new BladeRun(0, copy).stats).toEqual(r.stats); expect(JSON.stringify(legacy)).toBe(before);
    expect(restoreSnapshot(copy)).toEqual(copy); expect(validSnapshot(copy)).toBe(true);
  });
  it('rejects duplicate, capped, unknown or corrupted choices and malformed inventory state', () => {
    const r = run(); r.grantXp(xpNext(1)); step(r, 12); const save = r.snapshot();
    for (const broken of [
      { ...save, choices: ['stone', 'stone', 'anvil'] }, { ...save, choices: ['sharp', 'ruler', 'anvil'] },
      { ...save, relics: { ...save.relics, stone: 5 } }, { ...save, relics: { ...save.relics, stone: 1.5 } },
      { ...save, relics: { ...save.relics, unknown: 1 } }, { ...save, relicState: { ...save.relicState, lightning: NaN } },
      { ...save, relicState: { ...save.relicState, shield: true } }, { ...save, relicState: { ...save.relicState, shieldCooldown: 21 } },
    ]) expect(restoreSnapshot(broken)).toBeNull();
  });
  it('keeps native blade passives and resets every item for a fresh run', () => {
    const r = run(6); award(r, 'crystal'); expect(r.bladeId).toBe('snow-drinker'); expect(r.passiveInfo.name).toBe('寒魄凝霜');
    const fresh = new BladeRun(3, undefined, 6); expect(fresh.state.relics).toEqual(freshRelics()); expect(fresh.state.relicState.shield).toBe(false);
  });
});
