import { describe, it, expect } from 'vitest';
import { BladeRun, restoreSnapshot, validSnapshot } from '../src/blade/simulation';
import { MIN_FORM_TIME, xpNext, PERKS, xpToLevel, type PerkId } from '../src/blade/config';
import { equipmentStats, swingMoveFactor, swingPhase } from '../src/blade/equipment';

const idle = { x: 0, y: 0, dash: false };
const run = () => { const r = new BladeRun(102); r.state.enemies = []; return r; };
const step = (r: BladeRun, seconds: number, x = 0, y = 0) => { for (let i = 0; i < Math.round(seconds * 60); i++) r.step(1 / 60, { x, y, dash: false }); };
const makeHeavy = (r: BladeRun) => { Object.assign(r.state.perks, { long: 3, broad: 3, giant: 2 }); };
const attachSwing = (r: BladeRun, phase: 'windup' | 'strike' | 'recovery') => {
  const s = r.stats;
  const age = phase === 'windup' ? s.windup * .5 : phase === 'strike' ? s.windup + s.strike * .2 : s.windup + s.strike + s.recovery * .2;
  r.state.swing = { id: 99, angle: 0, age, windup: s.windup, strike: s.strike, recovery: s.recovery, tier: r.tier, resolved: true };
};

describe('blade size, handling and paced growth', () => {
  it('length increases real reach and weight without widening the blade', () => {
    const r = run(), before = r.stats; r.state.perks.long = 1;
    expect(r.stats.range).toBeGreaterThan(before.range); expect(r.stats.lengthScale).toBeCloseTo(1.22);
    expect(r.stats.widthScale).toBe(before.widthScale); expect(r.stats.mass).toBeGreaterThan(before.mass);
    expect(r.stats.moveSpeed).toBeLessThan(before.moveSpeed);
  });
  it('width increases damage, sweep and weight without extending reach', () => {
    const r = run(), before = r.stats; r.state.perks.broad = 2;
    expect(r.stats.range).toBe(before.range); expect(r.stats.widthScale).toBeCloseTo(1.7);
    expect(r.stats.damage).toBeGreaterThan(before.damage); expect(r.stats.arc).toBeGreaterThan(before.arc);
    expect(r.stats.knockback).toBeGreaterThan(before.knockback);
  });
  it('giant reforging grows both dimensions and can hit a previously unreachable target', () => {
    const r = run(); r.state.attackTimer = 0; r.state.perks.giant = 2;
    const enemy = r.spawnEnemy('armor', 87, 0); enemy.speed = 0; enemy.hp = enemy.maxHp = 500;
    expect(r.stats.lengthScale).toBeGreaterThan(1); expect(r.stats.widthScale).toBeGreaterThan(1);
    step(r, .5); expect(enemy.hp).toBe(500 - r.stats.damage);
  });
  it('heavy blades take longer to start and turn, while releasing still stops immediately', () => {
    const light = run(), heavy = run(); makeHeavy(heavy);
    step(light, .4, 1); step(heavy, .4, 1);
    expect(heavy.state.player.x).toBeLessThan(light.state.player.x * .85);
    step(light, .12, -1); step(heavy, .12, -1);
    expect(light.state.velocity.x).toBeLessThan(0); expect(heavy.state.velocity.x).toBeGreaterThan(0);
    const before = { ...heavy.state.player }; step(heavy, .2);
    expect(heavy.state.player).toEqual(before); expect(heavy.state.velocity).toEqual({ x: 0, y: 0 });
  });
  it('a heavy strike limits movement more than carrying the same blade', () => {
    const walking = run(), striking = run(); makeHeavy(walking); makeHeavy(striking);
    walking.state.velocity.x = walking.stats.moveSpeed; striking.state.velocity.x = striking.stats.moveSpeed;
    attachSwing(striking, 'strike');
    expect(swingMoveFactor(striking.stats, striking.state.swing)).toBeLessThan(.6);
    step(walking, .1, 1); step(striking, .1, 1);
    expect(striking.state.player.x).toBeLessThan(walking.state.player.x * .85);
  });
  it('heavy windup delays actual damage and each swing still resolves once', () => {
    const r = run(); makeHeavy(r); r.state.attackTimer = 0;
    const e = r.spawnEnemy('armor', 90, 0); e.hp = e.maxHp = 1000; e.speed = 0;
    r.step(1 / 60, idle); expect(swingPhase(r.state.swing!).phase).toBe('windup');
    step(r, .14); expect(e.hp).toBe(1000);
    step(r, .20); expect(e.hp).toBe(1000 - r.stats.damage);
    step(r, .10); expect(e.hp).toBe(1000 - r.stats.damage);
    expect(r.stats.interval).toBeGreaterThan(r.stats.windup + r.stats.strike + r.stats.recovery);
  });
  it('hollow forging preserves size and damage while improving movement and recovery', () => {
    const r = run(); makeHeavy(r); const before = r.stats; r.state.perks.hollow = 3;
    expect(r.stats.range).toBe(before.range); expect(r.stats.widthScale).toBe(before.widthScale); expect(r.stats.damage).toBe(before.damage);
    expect(r.stats.mass).toBeCloseTo(before.mass * .86 ** 3); expect(r.stats.moveSpeed).toBeGreaterThan(before.moveSpeed);
    expect(r.stats.recovery).toBeLessThan(before.recovery);
  });
  it('grip improves attack handling and footwork improves carrying movement', () => {
    const r = run(); makeHeavy(r); const before = r.stats; r.state.perks.grip = 2;
    expect(r.stats.mass).toBe(before.mass); expect(r.stats.widthScale).toBe(before.widthScale);
    expect(r.stats.windup).toBeLessThan(before.windup); expect(r.stats.recovery).toBeLessThan(before.recovery);
    attachSwing(r, 'strike'); expect(swingMoveFactor(r.stats, r.state.swing)).toBeGreaterThan(swingMoveFactor(before, r.state.swing));
    r.state.perks.stride = 2; expect(r.stats.moveSpeed).toBeGreaterThan(before.moveSpeed); expect(r.stats.acceleration).toBeGreaterThan(before.acceleration);
  });
  it('levels deterministically without drawing offers or equipment',()=>{
    for(let seed=1;seed<=30;seed++){const a=new BladeRun(seed),b=new BladeRun(seed);const rng=a.state.rng;for(const r of [a,b]){r.state.enemies=[];r.grantXp(xpNext(1));r.step(1/60,idle);}expect(a.state.level).toBe(2);expect(a.state.choices).toEqual([]);expect(a.state.relics).toEqual(b.state.relics);expect(a.state.rng).toBe(rng);expect(a.state.rng).toBe(b.state.rng);}
  });

  it('banks practice-gated XP while the world keeps advancing',()=>{
    const r=run();r.state.spawnBudget=-100000;r.state.eliteIndex=4;r.state.level=5;r.grantXp(10000);r.state.time=MIN_FORM_TIME-.5;const xp=r.state.xp;step(r,.4);expect(r.state.level).toBe(5);expect(r.state.xp).toBe(xp);step(r,.2);expect(r.state.mode).toBe('playing');expect(r.state.level).toBe(11);const time=r.state.time,rng=r.state.rng;step(r,10);expect(r.state.time).toBeGreaterThan(time);expect(r.state.choices).toEqual([]);expect(r.state.rng).toBe(rng);expect(r.state.totalXp).toBe(10000);
  });

  it('saves and restores size, motion, practice time and partially completed heavy swings', () => {
    const r = run(); makeHeavy(r); r.state.time = 29; r.state.formStartedAt = 7; r.state.velocity = { x: 50, y: -20 }; attachSwing(r, 'windup');
    const snapshot = r.snapshot(); expect(validSnapshot(snapshot)).toBe(true);
    const copy = new BladeRun(0, restoreSnapshot(snapshot)!);
    expect(copy.stats).toEqual(r.stats); expect(copy.state.swing).toEqual(r.state.swing); expect(copy.formRemaining).toBe(MIN_FORM_TIME - 22);
    expect(validSnapshot({ ...snapshot, velocity: { x: Infinity, y: 0 } })).toBe(false);
    expect(validSnapshot({ ...snapshot, formStartedAt: 31 })).toBe(false);
    expect(validSnapshot({ ...snapshot, perks: { ...snapshot.perks, long: 99 } })).toBe(false);
  });
  it('migrates the previous twelve-form schema with empty new forge slots and proportional XP', () => {
    const current = run().snapshot();
    const perks = Object.fromEntries(['sharp', 'quick', 'range', 'magnet', 'force', 'vital', 'heal'].map(k => [k, 0]));
    const old = { ...current, version: 2, level: 9, xp: 15, totalXp: 500, time: 111, perks, velocity: undefined, formStartedAt: undefined };
    const restored = restoreSnapshot(old)!;
    expect(restored.version).toBe(8); expect(restored.xp).toBe(21); expect(restored.formStartedAt).toBe(111); expect(restored.totalXp).toBe(500);
    for (const key of ['long', 'broad', 'giant', 'hollow', 'grip', 'stride'] as PerkId[]) expect(restored.perks[key]).toBe(0);
    expect(restoreSnapshot({ ...old, bossStarted: true, time: 420 })!.time).toBe(600);
    const maxed = equipmentStats(30, Object.fromEntries(Object.entries(PERKS).map(([k, p]) => [k, k === 'heal' ? 0 : p.cap])) as Record<PerkId, number>, 0);
    expect(maxed.range).toBe(420); expect(10 + 62 * maxed.lengthScale).toBeCloseTo(maxed.range);
  });
});
