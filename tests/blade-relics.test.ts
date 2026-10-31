import { describe, it, expect } from 'vitest';
import { BladeRun, restoreSnapshot, validSnapshot } from '../src/blade/simulation';
import { MIN_FORM_TIME, xpNext } from '../src/blade/config';
import { RELIC_IDS, RELICS, RELIC_GROUPS, relicGroups, freshRelics, type RelicId } from '../src/blade/relics';
const idle = { x: 0, y: 0, dash: false };
const run = (blade = 0) => { const r = new BladeRun(34, undefined, blade); r.state.enemies = []; r.state.spawnBudget = -100000; r.state.attackTimer = 10000; return r; };
const step = (r: BladeRun, n = 1) => { for (let i = 0; i < n; i++) r.step(1 / 60, idle); };
const award=(r:BladeRun,id:RelicId)=>{r.state.level++;const d=r.addRelicDrop(id,r.state.player.x,r.state.player.y)!;d.spawn=0;expect(r.pickupRelic(d.id)).toBe(true);};
const target = (r: BladeRun, x = 42, y = 0, kind: 'armor' | 'boss' = 'armor') => {
  const e = r.spawnEnemy(kind, x, y); e.hp = e.maxHp = 10000; e.speed = 0; e.cooldown = 1000; return e;
};
const strike = (r: BladeRun) => {
  const stats = r.stats, s = r.state;
  s.swing = { id: s.nextId++, tier: r.tier, angle: 0, age: stats.windup + stats.strike * .45, windup: stats.windup, strike: stats.strike, recovery: stats.recovery, resolved: false };
  step(r);
};

describe('passive item choices and progression', () => {
  it('defines six coherent groups of five distinct five-rank items', () => {
    expect(RELIC_IDS).toHaveLength(30);
    for (const group of Object.keys(RELIC_GROUPS)) expect(RELIC_IDS.filter(id => RELICS[id].group === group)).toHaveLength(5);
    expect(relicGroups(freshRelics())).toEqual({ forge: 0, wind: 0, arcane: 0, spirit: 0, hunt:0, chaos:0 });
  });
  it('removes max-rank items, the capped ruler and endgame XP candy from the pool', () => {
    const r = run(); for (let i = 0; i < 5; i++) award(r, 'stone'); expect(r.availableRelics).not.toContain('stone');
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
    const other=run(), interval=other.stats.interval;award(other,'hourglass');expect(other.stats.interval).toBeLessThan(interval);
    const magnet=other.stats.magnet;award(other,'magnet');expect(other.stats.magnet).toBeCloseTo(magnet+21);
    award(other,'feather');award(other,'bell');other.dash();expect(other.state.dashCooldown).toBe(4.25);
  });
  it('adds max HP once per heart rank and heals with the active two-piece bonus', () => {
    const r = run(); r.state.hp = 20; award(r, 'heart'); expect(r.state.maxHp).toBe(115); expect(r.state.hp).toBe(35);
    award(r, 'magnet'); const before = r.state.hp; award(r, 'heart'); expect(r.state.maxHp).toBe(130); expect(r.state.hp - before).toBe(18);
    r.state.hp = 50; r.addOrb(0, 0, 10, 'heal'); step(r,14); expect(r.state.hp).toBe(62);
  });
  it('applies the healing group to the native boss-entry recovery as well as pickups and upgrades', () => {
    const r = run(); award(r, 'heart'); award(r, 'magnet'); r.state.hp = 50; r.state.time = r.duration-.01;
    step(r); expect(r.state.mode).toBe('boss-intro'); expect(r.state.hp).toBe(68);
  });
  it('credits XP candy exactly once on pickup and never reapplies it on restore', () => {
    const r = run(); award(r, 'star'); r.addOrb(0, 0, 10, 'xp'); step(r,14);
    expect(r.state.totalXp).toBeCloseTo(10.6); expect(r.state.xp).toBeCloseTo(10.6);
    const restored = new BladeRun(1, restoreSnapshot(r.snapshot())!); step(restored);
    expect(restored.state.totalXp).toBeCloseTo(10.6); expect(restored.state.orbs).toHaveLength(0);
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
  it('keeps native blade passives and resets every item for a fresh run', () => {
    const r = run(6); award(r, 'crystal'); expect(r.bladeId).toBe('snow-drinker'); expect(r.passiveInfo.name).toBe('寒魄凝霜');
    const fresh = new BladeRun(3, undefined, 6); expect(fresh.state.relics).toEqual(freshRelics()); expect(fresh.state.relicState.shield).toBe(false);
  });
});
