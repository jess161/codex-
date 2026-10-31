import { describe, it, expect } from 'vitest';
import { BladeRun, restoreSnapshot, validSnapshot, type Enemy } from '../src/blade/simulation';
import { TIERS, PERKS, type PerkId } from '../src/blade/config';
import { waveDimensions, PASSIVE_SIZE_LIMITS } from '../src/blade/passive-size';
import type { RelicId } from '../src/blade/relics';

const idle = { x: 0, y: 0, dash: false };
function run(blade: number) {
  const r = new BladeRun(901, undefined, blade);
  r.state.enemies = []; r.state.spawnBudget = -100000; r.state.attackTimer = 100000; r.state.invincible = 1000;
  return r;
}
function award(r: BladeRun, item: RelicId) {
  const s = r.state; s.level++; s.pending = [s.level]; s.mode = 'relic';
  s.choices = [item, ...r.availableRelics.filter(id => id !== item).slice(0, 2)];
  expect(r.chooseRelic(item)).toBe(true);
}
function target(r: BladeRun, x: number, y = 0, kind: Enemy['kind'] = 'brood', hp = 10000) {
  const e = r.spawnEnemy(kind, x, y); e.hp = e.maxHp = hp; e.speed = 0; e.cooldown = 10000; return e;
}
function step(r: BladeRun, count = 1) { for (let i = 0; i < count; i++) r.step(1 / 60, idle); }
function strike(r: BladeRun) {
  const s = r.state, t = r.stats; s.attackTimer = 100000;
  s.swing = { id: s.nextId++, tier: r.tier, angle: 0, age: t.windup + t.strike * .45,
    windup: t.windup, strike: t.strike, recovery: t.recovery, resolved: false };
  step(r);
}
function getsuga(r: BladeRun) { r.state.direction = { x: 1, y: 0 }; r.dash(); step(r, 12); return r.state.waves.find(w => w.kind === 'getsuga')!; }

describe('passives follow blade dimensions', () => {
  it.each(TIERS.map((_, i) => i))('preserves blade %i initial skill dimensions', blade => {
    const r = run(blade), size = r.passiveSize;
    expect(size.scale).toBe(1); expect(size.travelScale).toBe(1); expect(size.guardRadius).toBe(28);
    expect(size.ringRadius).toBeCloseTo(r.stats.range * r.rules.ringRadius);
    expect(size.roarRadius).toBe(r.stats.range + 45); expect(size.burnSpread).toBe(80);
  });
  it('native ruler and anvil choices increase both projectile size and the area footprint', () => {
    const r = run(2), initial = r.passiveSize;
    award(r, 'ruler'); const long = r.passiveSize; award(r, 'anvil'); const wide = r.passiveSize;
    expect(long.scale).toBeGreaterThan(initial.scale); expect(long.travelScale).toBeGreaterThan(initial.travelScale);
    expect(wide.scale).toBeGreaterThan(long.scale); expect(wide.ringRadius).toBeGreaterThan(long.ringRadius);
    expect(wide.roarRadius).toBeGreaterThan(long.roarRadius); expect(wide.burnSpread).toBeGreaterThan(long.burnSpread);
    expect(wide.travelScale).toBe(long.travelScale);
  });
  it.each(['stone','feather','bell','hourglass','heart','magnet','star'] as RelicId[])('%s does not enlarge a skill without enlarging the blade', id => {
    const r = run(11), before = r.passiveSize; award(r, id); expect(r.passiveSize).toEqual(before);
  });
  it('releases larger, wider and farther native getsuga waves after size upgrades', () => {
    const small = run(11), big = run(11); award(big, 'ruler'); award(big, 'anvil');
    const a = getsuga(small), b = getsuga(big);
    expect(a).toMatchObject({ radius: 30, hitRadius: 10, maxRange: 380 });
    expect(b.radius!).toBeGreaterThan(a.radius!); expect(b.hitRadius!).toBeGreaterThan(a.hitRadius!); expect(b.maxRange).toBeGreaterThan(a.maxRange);
    expect(b.pierce).toBe(a.pierce); expect(big.rules.getsugaDamage).toBe(small.rules.getsugaDamage);
  });
  it('expands wave broad-phase queries so a giant projectile can hit across a grid-cell boundary', () => {
    const r = run(11); r.state.level = 30;
    Object.assign(r.state.perks, { long: 8, broad: 8, giant: 6, range: 6 }); r.state.player.y = 95;
    const wave = getsuga(r); expect(wave.hitRadius).toBe(60);
    const graze = target(r, wave.x + 4, 160), miss = target(r, wave.x + 4, 95 + wave.hitRadius! + 9 + .5);
    step(r); expect(graze.hp).toBeLessThan(10000); expect(miss.hp).toBe(10000);
    const after = graze.hp; step(r, 3); expect(graze.hp).toBe(after); // Piercing cannot hit the same target twice.
  });
  it('preserves released wave geometry through later upgrades, pauses and save/load', () => {
    const r = run(11), wave = getsuga(r); const shape = waveDimensions(wave, r.mastery), range = wave.maxRange;
    award(r, 'ruler'); award(r, 'anvil');
    expect(waveDimensions(wave, r.mastery)).toEqual(shape); expect(wave.maxRange).toBe(range);
    r.state.mode = 'relic'; r.state.level++; r.state.pending = [r.state.level]; r.state.choices = ['stone','ruler','anvil'];
    const saved = r.snapshot(); step(r, 30); expect(r.snapshot()).toEqual(saved);
    expect(validSnapshot(saved)).toBe(true); const restored = new BladeRun(1, restoreSnapshot(saved)!);
    expect(restored.state.waves).toEqual(saved.waves); expect(waveDimensions(restored.state.waves[0], restored.mastery)).toEqual(shape);
  });
  it('keeps old v6 waves readable and rejects invalid saved dimensions', () => {
    const r = run(11); getsuga(r); const saved = r.snapshot();
    delete saved.waves[0].radius; delete saved.waves[0].hitRadius;
    expect(restoreSnapshot(saved)).toEqual(saved); expect(waveDimensions(saved.waves[0], 0)).toMatchObject({ radius: 30, hitRadius: 10 });
    for (const patch of [{radius:NaN},{radius:253},{hitRadius:0},{hitRadius:61}]) {
      const bad = structuredClone(saved); Object.assign(bad.waves[0], patch); expect(validSnapshot(bad)).toBe(false);
    }
  });
  it('a wider Moon Blade hits only targets inside its enlarged ring and draws that same radius', () => {
    const r = run(4), small = r.passiveSize.ringRadius; award(r, 'anvil');
    const radius = r.passiveSize.ringRadius; expect(radius).toBeGreaterThan(small);
    target(r, 45, 0, 'armor'); const hit = target(r, -radius - 9 + .2), miss = target(r, -radius - 9 - .2);
    r.state.passive.hits = r.rules.ringCycle - 1; strike(r);
    expect(hit.hp).toBeLessThan(10000); expect(miss.hp).toBe(10000);
    expect(r.events.find(e => e.type === 'passive' && e.skill === 'full-moon')?.radius).toBe(radius);
  });
  it('a wider roar respects the new boundary and retains special-enemy control resistance', () => {
    const r = run(5); award(r, 'anvil'); const radius = r.passiveSize.roarRadius;
    target(r, 45, 0, 'armor'); const ordinary = target(r, -radius - 9 + .2), outside = target(r, -radius - 9 - .2), boss = target(r, 0, radius + 42 - .2, 'boss');
    strike(r); expect(ordinary.stun).toBe(r.rules.roarStun); expect(outside.stun).toBe(0);
    expect(boss.stun).toBe(0); expect(boss.slow).toBe(r.rules.roarSlow);
    expect(r.events.find(e => e.type === 'passive' && e.skill === 'dragon-slayer')?.radius).toBe(radius);
  });
  it('fire spread and its visual footprint enlarge together without igniting outside the boundary', () => {
    const r = run(10); award(r, 'ruler'); award(r, 'anvil'); const radius = r.passiveSize.burnSpread;
    expect(radius).toBeGreaterThan(r.rules.burnSpread);
    target(r, 45, 0, 'blob', 1); const hit = target(r, 45 - radius - 9 + .2), miss = target(r, 45 - radius - 9 - .2);
    strike(r); expect(hit.burnTime).toBe(r.rules.burnTime); expect(miss.burnTime).toBe(0);
    expect(r.events.find(e => e.type === 'passive' && e.skill === 'ryujin')?.radius).toBe(radius);
  });
  it('enlarges the Promise guard and counter while preserving its one-hit absorption', () => {
    const r = run(7); award(r, 'anvil'); r.state.level = 12;
    const radius = r.passiveSize.guardCounterRadius; target(r, -radius - 9 + .2); const outside = target(r, -radius - 9 - .2);
    r.state.passive.shield = true; r.state.invincible = 0; expect(r.damagePlayer(30, 'test')).toBe(false);
    expect(r.state.hp).toBe(100); expect(r.state.passive.shield).toBe(false); expect(r.state.enemies[0].hp).toBeLessThan(10000); expect(outside.hp).toBe(10000);
    expect(r.events.find(e => e.type === 'passive' && e.detail === 'break')?.radius).toBe(radius);
  });
  it('scales frost and empowered-hit feedback without turning single-target marks into area damage', () => {
    const r = run(6); award(r, 'anvil'); const e = target(r, 45, 0, 'armor'), nearby = target(r, -35);
    for (let i = 0; i < 3; i++) { e.knockX = e.knockY = 0; strike(r); }
    const fx = r.events.find(e => e.type === 'passive' && e.skill === 'snow-drinker')!;
    expect(fx.radius).toBeGreaterThan(e.radius + 12); expect(e.freeze).toBe(r.rules.freezeTime); expect(nearby.freeze).toBe(0);
    const dagger = run(1); award(dagger, 'anvil'); dagger.dash();
    expect(dagger.events.find(e => e.type === 'passive')!.radius).toBeGreaterThan(32);
  });
  it('bounds the largest valid legacy builds and does not consume combat randomness', () => {
    for (let blade = 0; blade < 12; blade++) {
      const r = run(blade); r.state.level = 30;
      for (const [id, perk] of Object.entries(PERKS)) if (id !== 'heal') r.state.perks[id as PerkId] = perk.cap;
      const before = r.snapshot(), size = r.passiveSize;
      expect(size.scale).toBeLessThanOrEqual(PASSIVE_SIZE_LIMITS.scale);
      for (const radius of [size.ringRadius,size.roarRadius,size.guardCounterRadius,size.burnSpread]) expect(radius).toBeLessThanOrEqual(600);
      expect(Object.values(size).every(Number.isFinite)).toBe(true); expect(r.snapshot()).toEqual(before);
    }
  });
});
