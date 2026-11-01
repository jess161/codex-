import { describe, it, expect, vi } from 'vitest';
import { BladeRun, restoreSnapshot, validSnapshot, type Enemy } from '../src/blade/simulation';
import { BASIC_WEAPON_INDICES, BLADE_CATALOGUE, DEFAULT_WEAPON, TIERS, toBasicWeapon, thrustHits } from '../src/blade/config';
import { equipmentStats } from '../src/blade/equipment';
import { basicMeleePose } from '../src/blade/basic-weapon-art';
import { migrateBasicWeapon } from '../src/blade/weapon-migration';
import { BladeStorage } from '../src/blade/storage';

const idle = {x: 0, y: 0, dash: false};
function arena(blade = DEFAULT_WEAPON as number) {
  const r = new BladeRun(815, undefined, blade);
  r.state.enemies = []; r.state.spawnBudget = -100000; r.state.eliteIndex = 4; r.state.attackTimer = 10000;
  return r;
}
function target(r: BladeRun, x: number, y = 0): Enemy {
  const e = r.spawnEnemy('armor', x, y); e.hp = e.maxHp = 10000; e.speed = 0; e.cooldown = 10000; return e;
}
function steps(r: BladeRun, count: number) { for (let i = 0; i < count; i++) r.step(1 / 60, idle); }
function strike(r: BladeRun, angle = 0) {
  const s = r.stats;
  r.state.swing = {id: r.state.nextId++, tier: r.tier, angle, age: s.windup + s.strike * .45 - 1 / 60, resolved: false, windup: s.windup, strike: s.strike, recovery: s.recovery};
  r.step(1 / 60, idle);
}

describe('four ordinary starting weapons', () => {
  it('offers only knife, sword, bow and spear, with a plain knife by default', () => {
    expect(BLADE_CATALOGUE.map(({blade}) => blade.id)).toEqual(['knife', 'sword', 'bow', 'spear']);
    expect(BLADE_CATALOGUE.map(({blade}) => blade.name)).toEqual(['刀', '剑', '弓', '矛']);
    expect(new BladeRun(8).bladeId).toBe('knife');
    expect(new BladeRun(8, undefined, NaN).tier).toBe(DEFAULT_WEAPON);
  });
  it('makes the sword noticeably faster and narrower than the sweeping knife', () => {
    const knife = equipmentStats(1, undefined, 15), sword = equipmentStats(1, undefined, 16), spear = equipmentStats(1, undefined, 18);
    expect(sword.interval).toBeLessThan(knife.interval * .55);
    expect(sword.windup + sword.strike + sword.recovery).toBeLessThan(knife.windup + knife.strike + knife.recovery);
    expect(sword.arc).toBeLessThan(knife.arc * .5); expect(spear.range).toBeGreaterThan(knife.range * 1.6);
  });
  it('knife sweep hits the front and both flanks, but misses the rear', () => {
    const r = arena(15), front = target(r, 70), upper = target(r, 26, -65), lower = target(r, 26, 65), rear = target(r, -65);
    strike(r); for (const e of [front, upper, lower]) expect(e.hp).toBe(e.maxHp - r.stats.damage);
    expect(rear.hp).toBe(rear.maxHp); steps(r, 10); expect(front.hp).toBe(front.maxHp - r.stats.damage);
  });
  it('sword fast slashes leave targets outside their narrow arc untouched', () => {
    const r = arena(16), front = target(r, 60), side = target(r, 20, 65);
    strike(r); expect(front.hp).toBe(front.maxHp - r.stats.damage); expect(side.hp).toBe(side.maxHp);
  });
  it('spear pierces multiple depths once each without hitting sideways or behind', () => {
    const r = arena(18), line = [45, 90, 145].map(x => target(r, x)), side = target(r, 110, 38), rear = target(r, -40), far = target(r, 190);
    strike(r); line.forEach(e => expect(e.hp).toBe(e.maxHp - r.stats.damage));
    for (const e of [side, rear, far]) expect(e.hp).toBe(e.maxHp);
    steps(r, 15); line.forEach(e => expect(e.hp).toBe(e.maxHp - r.stats.damage));
  });
  it('spear follows its original target before contact and locks direction afterward', () => {
    const r = arena(18), e = target(r, 90); r.state.attackTimer = 0; steps(r, 1);
    e.y = 40; steps(r, 10);
    expect(e.hp).toBe(e.maxHp - r.stats.damage); expect(r.state.swing!.resolved).toBe(true);
    const angle = r.state.swing!.angle; expect(angle).toBeGreaterThan(.3);
    e.y = -50; steps(r, 2); expect(r.state.swing!.angle).toBe(angle);
  });
  it('spear line rotates with aim and keeps a constant width along its whole length', () => {
    const r = arena(18), line = target(r, 0, -130), side = target(r, 40, -130); strike(r, -Math.PI / 2);
    expect(line.hp).toBe(line.maxHp - r.stats.damage); expect(side.hp).toBe(side.maxHp);
    expect(thrustHits(25, 21, 14, 0, 150, 6)).toBe(false);
    expect(thrustHits(145, 21, 14, 0, 150, 6)).toBe(false);
    expect(thrustHits(150, 19, 14, 0, 150, 6)).toBe(true);
    expect(thrustHits(-1, 0, 14, 0, 150, 6)).toBe(false);
  });
  it('spear deals one full hit to every enemy in a line, with normal kill and XP credit', () => {
    const r = arena(18); const enemies = Array.from({length: 8}, (_, i) => target(r, 40 + i * 14));
    enemies.forEach(e => e.hp = 1); strike(r);
    expect(r.state.kills).toBe(8); expect(r.state.bestCleave).toBe(8); expect(r.state.orbs.filter(o => o.kind === 'xp')).toHaveLength(8); expect(r.state.orbs.filter(o => o.kind === 'coin')).toHaveLength(8);
    expect(r.state.waves).toEqual([]); expect(r.state.passive.stacks).toBe(0);
  });
  it.each(BASIC_WEAPON_INDICES)('keeps weapon %i basic through mastery, dash and active input', blade => {
    const r = arena(blade); r.state.level = 28; const e = target(r, 50);
    expect(r.hasActiveSkill).toBe(false); expect(r.activateSkill()).toBe(false); expect(r.stats.waveEvery).toBe(0);
    r.dash(); steps(r, 12); strike(r); expect(r.active.casts).toBe(0); expect(r.state.waves).toEqual([]);
    expect(e.burnTime).toBe(0); expect(e.chillStacks).toBe(0); expect(e.hunt).toBe(0);
  });
});

describe('ordinary bow auto shooting', () => {
  it('acquires a visible ranged target automatically and damages it only after arrow travel', () => {
    const r = arena(17), e = target(r, 220); r.state.attackTimer = 0;
    steps(r, 1); expect(r.state.swing).not.toBeNull();
    steps(r, 8); expect(r.archery.shots).toBe(1); expect(e.hp).toBe(e.maxHp);
    steps(r, 18); expect(e.hp).toBe(e.maxHp - r.stats.damage);
    expect(r.archery.arrows).toHaveLength(0);
  });
  it('fires one ordinary arrow per shot even on the fourth shot and at maximum mastery', () => {
    const r = arena(17); r.state.level = 28; r.state.relics.scope = 5; r.state.aim = 0;
    for (let i = 0; i < 4; i++) { strike(r); expect(r.archery.arrows).toHaveLength(1); expect(r.archery.arrows[0]).toMatchObject({kind: 'arrow', pierce: 1, blast: 0}); r.archery.arrows = []; }
    expect(r.archery.shots).toBe(4); expect(r.archery.bursts).toEqual([]); expect(r.archery.rains).toEqual([]);
  });
  it('stops on the first enemy rather than piercing into the second', () => {
    const r = arena(17), first = target(r, 80), second = target(r, 135);
    strike(r); steps(r, 14); expect(first.hp).toBe(first.maxHp - r.stats.damage); expect(second.hp).toBe(second.maxHp);
    expect(r.archery.arrows).toEqual([]);
  });
  it('ignores targets outside the viewport or outside arrow range', () => {
    for (const [x, width] of [[260, 300], [420, 1000]]) {
      const r = arena(17); r.view.width = width; target(r, x); r.state.attackTimer = 0; steps(r, 60);
      expect(r.archery.shots).toBe(0); expect(r.state.swing).toBeNull();
    }
  });
});

describe('shared attack visuals and resumable basics', () => {
  it('aligns the spear tip and both cutting edges with the 45-percent contact frame', () => {
    for (const blade of [15, 16, 18]) {
      const stats = equipmentStats(1, undefined, blade), swing = {age: stats.windup + stats.strike * .45, angle: -.8, windup: stats.windup, strike: stats.strike, recovery: stats.recovery};
      const pose = basicMeleePose(blade, swing, -.8, stats);
      expect(pose.angle).toBeCloseTo(-.8); expect(pose.reach).toBeCloseTo(stats.range);
      if (blade === 18) { expect(basicMeleePose(blade, null, -.8, stats).reach).toBeLessThan(stats.range * .7); expect(pose.hand).toBeCloseTo(12); }
    }
  });
  it.each(BASIC_WEAPON_INDICES)('round-trips weapon %i mid-attack and continues deterministically', blade => {
    const r = arena(blade); target(r, blade === 17 ? 180 : 60); r.state.attackTimer = 0; steps(r, 6);
    const state = r.snapshot(); expect(validSnapshot(state)).toBe(true); expect(restoreSnapshot(state)).toEqual(state);
    const copy = new BladeRun(1, restoreSnapshot(state)!); steps(r, 20); steps(copy, 20); expect(copy.state).toEqual(r.state);
  });
  it.each(Array.from({length: 15}, (_, i) => i))('maps retired weapon %i while preserving world, items, progress and RNG', blade => {
    const r = arena(blade); r.state.time = 100; r.state.level = 10; r.state.hp = 83; r.state.relics.ember = 2; r.state.relicLoot.order = ['ember']; r.addRelicDrop('ruler', 80, 90); r.addOrb(300, 400, 7, 'xp');
    target(r, 200); r.activateSkill(); const saved = r.snapshot(), migrated = migrateBasicWeapon(structuredClone(saved));
    expect(migrated.blade).toBe(toBasicWeapon(blade)); expect(migrated.passive.tier).toBe(migrated.blade); expect(migrated.active!.casts).toBe(0); expect(migrated.waves).toEqual([]);
    for (const key of ['rng', 'lootRng', 'relicLoot', 'relics', 'relicDrops', 'orbs', 'hp', 'level', 'time', 'player', 'totalXp'] as const) expect(migrated[key]).toEqual(saved[key]);
    expect(validSnapshot(migrated)).toBe(true); expect(r.state.blade).toBe(blade);
  });
  it('maps old preferences and continuation at the real browser-storage boundary', () => {
    const r = arena(13), saved = {version: 8, settings: {blade: 13}, meta: {seenBlades: [0, 1, 12, 13, 14], bestScore: 1234}, run: r.snapshot()};
    vi.stubGlobal('matchMedia', () => ({matches: false}));
    vi.stubGlobal('localStorage', {getItem: () => JSON.stringify(saved), setItem: vi.fn()});
    try {
      const storage = new BladeStorage(); expect(storage.data.settings.blade).toBe(17); expect(storage.data.run!.blade).toBe(17);
      expect(storage.data.meta.seenBlades).toEqual([15, 16, 17]); expect(storage.data.meta.bestScore).toBe(1234);
      expect(storage.warning).toContain('旧装备折算为金币'); expect(storage.write()).toBe(true);
    } finally {vi.unstubAllGlobals();}
  });
});
