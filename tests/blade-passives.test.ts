import { describe, it, expect } from 'vitest';
import { BladeRun, restoreSnapshot, validSnapshot, type Enemy, type Wave } from '../src/blade/simulation';
import { TIERS, TIER_LEVELS, tierForLevel } from '../src/blade/config';
import { freshEnemyEffects, freshPassive } from '../src/blade/passives';

const idle = { x: 0, y: 0, dash: false };
const run = (tier: number) => {
  const r = new BladeRun(802, undefined, tier);
  r.state.enemies = []; r.state.attackTimer = 10000; r.state.invincible = 10000;
  r.view = { width: 20000, height: 20000 }; // Keep incidental spawns outside these isolated combat fixtures.
  return r;
};
const step = (r: BladeRun, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) r.step(1 / 60, idle); };
const target = (r: BladeRun, kind: Enemy['kind'] = 'armor', x = 45, y = 0, hp = 10000) => {
  const e = r.spawnEnemy(kind, x, y); e.hp = e.maxHp = hp; e.speed = 0; e.cooldown = 1000; return e;
};
const strike = (r: BladeRun, angle = 0) => {
  const s = r.stats;
  // Resolve a real swing immediately, isolating passive logic from the already-tested attack cadence.
  r.state.attackTimer = 10000; r.state.attackCount = 0;
  r.state.swing = { id: r.state.nextId++, angle, age: s.windup + s.strike * .45, windup: s.windup, strike: s.strike, recovery: s.recovery, tier: r.tier, resolved: false };
  r.step(1 / 60, idle);
};
const waveAt = (r: BladeRun, e: Enemy, damage = 1) => {
  r.state.waves.push({ id: r.state.nextId++, x: e.x - 5, y: e.y, angle: 0, distance: 0, maxRange: 220, damage, pierce: 1, hit: [], tier: r.tier, kind: 'basic' });
  r.step(1 / 60, idle);
};

describe('story-inspired blade passives', () => {
  it('the starting knife earns capped melee-only mastery from kills', () => {
    const r = run(0);
    for (let i = 0; i < 15; i++) { target(r, 'blob', 45, 0, 1); strike(r); r.state.enemies = []; r.state.orbs = []; }
    expect(r.state.passive.stacks).toBe(3); expect(r.state.passive.kills).toBe(15);
    const e = target(r); const damage = r.stats.damage; strike(r);
    expect(e.hp).toBe(10000 - Math.round(damage * 1.18));
  });
  it('the hidden dagger empowers one complete hit after a dash and cuts armor harder', () => {
    const r = run(1), a = target(r), b = target(r, 'armor', 45, 12), back = target(r, 'armor', -45);
    const base = r.stats.damage; r.dash(); r.state.dashTime = 0; strike(r);
    expect(a.hp).toBe(10000 - Math.round(base * 1.8 * 1.3)); expect(b.hp).toBe(a.hp); expect(back.hp).toBe(10000);
    expect(r.state.passive.empowered).toBe(0);
    const hp = a.hp; strike(r); expect(hp - a.hp).toBe(Math.round(base * 1.3));
  });
  it('a missed dagger swing preserves its charge until it expires', () => {
    const r = run(1); r.dash(); r.state.dashTime = 0; strike(r);
    expect(r.state.passive.empowered).toBeGreaterThan(2.9); step(r, 3.1); expect(r.state.passive.empowered).toBe(0);
  });
  it('the eighth landed Well Moon swing emits three independent golden waves', () => {
    const r = run(2), e = target(r);
    for (let i = 0; i < 7; i++) { e.knockX = e.knockY = 0; strike(r); }
    expect(r.state.passive.hits).toBe(7); expect(r.state.waves).toHaveLength(0);
    e.knockX = e.knockY = 0; strike(r); const waves = r.state.waves.filter(w => w.kind === 'moon');
    expect(waves).toHaveLength(3); expect(new Set(waves.map(w => w.angle)).size).toBe(3);
    expect(waves.every(w => w.damage === Math.round(r.stats.damage * .8) && w.pierce === 2 && w.maxRange === 220)).toBe(true);
    expect(r.state.passive.hits).toBe(0);
  });
  it('the Deer Cutter marks first, then rewards pursuit and limits dash refunds per cleave', () => {
    const r = run(3), e = target(r); const base = r.stats.damage;
    strike(r); expect(e.hp).toBe(10000 - base); expect(e.hunt).toBe(4);
    const hp = e.hp; strike(r); expect(hp - e.hp).toBe(Math.round(base * 1.3));
    r.state.enemies = []; r.state.dashCooldown = 5;
    target(r, 'blob', 45, 0, 1); target(r, 'blob', 45, 10, 1); strike(r);
    expect(r.state.dashCooldown).toBeCloseTo(5 - 1 / 60 - .8); expect(r.state.passive.cooldown).toBe(.6);
  });
  it('the fifth Moon Blade swing hits behind the player without changing ordinary forward swings', () => {
    const r = run(4), front = target(r), back = target(r, 'armor', -55);
    for (let i = 0; i < 4; i++) strike(r);
    expect(back.hp).toBe(10000); expect(front.hp).toBeLessThan(10000);
    strike(r); expect(back.hp).toBe(10000 - Math.round(r.stats.damage * .8)); expect(r.state.passive.hits).toBe(0);
  });
  it('Dragon Slayer roars stun ordinary enemies but only slow special enemies', () => {
    const r = run(5), front = target(r), rear = target(r, 'shooter', -90), elite = target(r, 'elite', 110), boss = target(r, 'boss', -115);
    strike(r); expect(front.stun).toBe(.8); expect(rear.stun).toBe(.8);
    expect(elite.stun).toBe(0); expect(boss.stun).toBe(0); expect(elite.slow).toBe(.2); expect(boss.slowTime).toBe(1.2);
    expect(r.state.passive.cooldown).toBe(6);
    front.stun = 0; strike(r); expect(front.stun).toBe(0);
  });
  it('Snow Drinker stacks chill and freezes ordinary targets once per four-second window', () => {
    const r = run(6), e = target(r);
    strike(r); strike(r); expect(e.chillStacks).toBe(2); expect(e.freeze).toBe(0);
    strike(r); expect(e.chillStacks).toBe(3); expect(e.freeze).toBe(.8); expect(e.freezeCooldown).toBe(4);
    e.knockX = e.knockY = 0; e.speed = 80; const x = e.x; step(r, .3); expect(e.x).toBe(x);
    e.freeze = 0; strike(r); expect(e.freeze).toBe(0); expect(e.freezeCooldown).toBeGreaterThan(3);
  });
  it('chill from waves affects boss movement but cannot freeze bosses or elites', () => {
    const r = run(6), boss = target(r, 'boss', 300), elite = target(r, 'elite', 320, 100);
    for (let i = 0; i < 3; i++) { waveAt(r, boss); waveAt(r, elite); }
    expect(boss.chillStacks).toBe(3); expect(elite.chillStacks).toBe(3); expect(boss.freeze).toBe(0); expect(elite.freeze).toBe(0);
    boss.speed = 100; const x = boss.x; step(r, .1); expect(x - boss.x).toBeCloseTo(8.5, 4);
  });
  it('the Promise guard requires six safe seconds, blocks once and respects its cooldown', () => {
    const r = run(7); step(r, 5.9); expect(r.state.passive.shield).toBe(false);
    step(r, .2); expect(r.state.passive.shield).toBe(true);
    r.state.invincible = 0; expect(r.damagePlayer(30, 'test')).toBe(false); expect(r.state.hp).toBe(100); expect(r.state.passive.shield).toBe(false);
    expect(r.state.passive.cooldown).toBe(12); expect(r.state.passive.safeTime).toBe(0);
    step(r, 6.1); expect(r.state.passive.shield).toBe(false); step(r, 6); expect(r.state.passive.shield).toBe(true);
  });
  it('real damage resets the safe period while an absorbed hit preserves boss flawless status', () => {
    const r = run(7); step(r, 5); r.state.invincible = 0; r.damagePlayer(10, 'test');
    expect(r.state.passive.safeTime).toBe(0); step(r, 5.5); expect(r.state.passive.shield).toBe(false);
    step(r, .6); r.state.bossStarted = true; r.state.time = 600; r.state.invincible = 0;
    r.damagePlayer(20, 'test'); expect(r.state.bossHits).toBe(0); expect(r.state.hp).toBe(90);
  });
  it('Shusui tracks three melee hits independently per target and doubles its bonus against specials', () => {
    const r = run(8), a = target(r), b = target(r, 'elite', 55, 10), damage = r.stats.damage;
    strike(r); strike(r); expect(a.dragonHits).toBe(2); expect(b.dragonHits).toBe(2);
    strike(r); expect(a.hp).toBe(10000 - damage * 2 - Math.round(damage * 2.2));
    expect(b.hp).toBe(10000 - damage * 2 - Math.round(damage * 3.4)); expect(a.dragonHits).toBe(0);
    const c = target(r, 'armor', 50, -10); waveAt(r, c); expect(c.dragonHits).toBe(0);
  });
  it('Enma takes a nonlethal fourth-hit payment and refunds it only when that melee kills', () => {
    const r = run(9), e = target(r); const damage = r.stats.damage;
    strike(r); strike(r); strike(r); const hp = e.hp; strike(r);
    expect(hp - e.hp).toBe(Math.round(damage * 2.5)); expect(r.state.hp).toBe(96);
    r.state.enemies = []; r.state.passive.hits = 3; target(r, 'blob', 45, 0, 1); strike(r); expect(r.state.hp).toBe(96);
  });
  it('low-health Enma keeps its weaker fourth-hit burst without draining more life', () => {
    const r = run(9), e = target(r); r.state.hp = 20; r.state.passive.hits = 3; strike(r);
    expect(r.state.hp).toBe(20); expect(e.hp).toBe(10000 - r.stats.damage * 2);
  });
  it('Ryujin burns exactly six times over three seconds without adding repeated knockback', () => {
    const r = run(10), e = target(r); const damage = r.stats.damage; strike(r);
    const afterHit = e.hp; e.knockX = e.knockY = 0; const x = e.x; r.state.swing = null;
    step(r, 3.1); expect(afterHit - e.hp).toBe(Math.max(1, Math.round(damage * .15)) * 6);
    expect(e.x).toBe(x); expect(e.burnTime).toBe(0); expect(e.burnDamage).toBe(0);
  });
  it('a fiery first-hit kill ignites nearby enemies and burn deaths pay XP only once', () => {
    const r = run(10), first = target(r, 'blob', 45, 0, 1), nearby = target(r, 'blob', -30, 0, 2), far = target(r, 'blob', 260, 0, 10000);
    strike(r); expect(first.hp).toBeLessThanOrEqual(0); expect(nearby.burnTime).toBe(3); expect(far.burnTime).toBe(0);
    step(r, .6); expect(nearby.hp).toBeLessThanOrEqual(0); expect(r.state.kills).toBe(2);
    const reward = r.state.totalXp + r.state.orbs.filter(o => o.kind === 'xp').reduce((n, o) => n + o.value, 0);
    // totalXp already includes collected orbs, so every ordinary target contributes exactly once.
    expect(reward).toBe(6); step(r, 1); expect(r.state.kills).toBe(2);
  });
  it('burn refresh does not reset the next tick or multiply its damage', () => {
    const r = run(10), e = target(r); strike(r); step(r, .3); const next = e.burnTick;
    waveAt(r, e); expect(e.burnTick).toBeLessThan(next); expect(e.burnTime).toBe(3);
    expect(e.burnDamage).toBe(Math.round(r.stats.damage * .15));
  });
  it('a Tensa dash emits one twelve-pierce getsuga at its endpoint and grants a temporary speed burst', () => {
    const r = run(11), baseline = r.stats; r.dash(); step(r, .2);
    const waves = r.state.waves.filter(w => w.kind === 'getsuga'); expect(waves).toHaveLength(1);
    expect(waves[0]).toMatchObject({ damage: Math.round(baseline.damage * 1.8), maxRange: 380, pierce: 12 });
    expect(r.state.player.y).toBeCloseTo(-140); expect(r.state.passive.tensaPending).toBe(false);
    expect(r.stats.moveSpeed).toBeCloseTo(baseline.moveSpeed * 1.15); expect(r.stats.interval).toBeLessThan(baseline.interval);
    expect(r.dash()).toBe(false); step(r, 2.1); expect(r.stats.moveSpeed).toBe(baseline.moveSpeed);
  });
  it('the ultimate wave hits each target once and stops after twelve targets', () => {
    const r = run(11);
    for (let i = 0; i < 14; i++) target(r, 'armor', 20 + i * 22, 0, 10000);
    const wave: Wave = { id: 900, x: 0, y: 0, angle: 0, distance: 0, maxRange: 380, damage: 11, pierce: 12, hit: [], tier: 11, kind: 'getsuga' };
    r.state.waves.push(wave); step(r, 1);
    expect(r.state.enemies.filter(e => e.maxHp - e.hp === 11)).toHaveLength(12);
    expect(r.state.enemies.every(e => e.hp === 10000 || e.hp === 9989)).toBe(true); expect(r.state.waves).toHaveLength(0);
  });
  it('mastery preserves the chosen blade, its charges, enemy statuses and forging', () => {
    const r = run(6), e = target(r); e.freeze = .5; e.chill = 2; e.chillStacks = 3; r.state.perks.long = 2;
    r.state.level = TIER_LEVELS[3]; r.step(1 / 60, idle);
    expect(r.tier).toBe(6); expect(r.state.passive.tier).toBe(6); expect(e.freeze).toBeGreaterThan(0); expect(e.chillStacks).toBe(3);
    expect(r.state.perks.long).toBe(2); expect(r.passiveInfo.name).toBe('寒魄凝霜');
    expect(r.passiveInfo.description).toContain('2 层冻结');
  });
  it('forge and boss-intro pauses freeze passive timers and enemy statuses', () => {
    const r = run(6), e = target(r); e.freeze = .7; e.burnTime = 2; e.burnDamage = 3;
    r.state.mode = 'relic'; r.state.pending = [2]; r.state.choices = ['ruler', 'feather', 'stone']; const saved = r.snapshot(); step(r, 10);
    expect(r.snapshot()).toEqual(saved);
    r.state.mode = 'boss-intro'; r.state.transition = 1; step(r, .4); expect(e.freeze).toBe(.7); expect(e.burnTime).toBe(2);
  });
  it('restores partial counters, marks, freezes and burn timers without rerolling', () => {
    const r = run(6), e = target(r); e.chill = 1.5; e.chillStacks = 3; e.freeze = .6; e.freezeCooldown = 3.8;
    r.state.passive.cooldown = .4; const saved = r.snapshot(); expect(validSnapshot(saved)).toBe(true);
    const restored = restoreSnapshot(saved)!; expect(restored).toEqual(saved); expect(restored).not.toBe(saved);
    expect(validSnapshot({ ...saved, passive: { ...saved.passive, hits: 8 } })).toBe(false);
    expect(validSnapshot({ ...saved, enemies: [{ ...saved.enemies[0], burnTime: NaN }] })).toBe(false);
    expect(validSnapshot({ ...saved, enemies: [{ ...saved.enemies[0], freeze: 99 }] })).toBe(false);
  });
  it('a saved in-flight Tensa dash produces only one wave after resuming', () => {
    const r = run(11); r.dash(); step(r, .1);
    const copy = new BladeRun(0, restoreSnapshot(r.snapshot())!); step(copy, .2);
    expect(copy.state.waves.filter(w => w.kind === 'getsuga')).toHaveLength(1); expect(copy.state.passive.tensaPending).toBe(false);
  });
  it('migrates the weight edition without changing XP, practice, dimensions, RNG or pending choices', () => {
    const r = run(2); r.state.level = 5; r.state.time = 35; r.state.formStartedAt = 8; r.state.xp = 23; r.state.perks.long = 2;
    const legacy = { ...r.snapshot(), version: 3 } as Record<string, unknown>; delete legacy.passive;
    const oldEnemy = target(r); const bare = { ...oldEnemy } as Record<string, unknown>;
    for (const key of Object.keys(freshEnemyEffects())) delete bare[key];
    legacy.enemies = [bare]; const before = JSON.stringify(legacy), restored = restoreSnapshot(legacy)!;
    expect(restored.version).toBe(7); expect(restored.xp).toBe(23); expect(restored.formStartedAt).toBe(8); expect(restored.rng).toBe(legacy.rng);
    expect(restored.passive).toEqual(freshPassive(2)); expect(restored.enemies[0].burnTime).toBe(0);
    expect(new BladeRun(0, restored).stats).toEqual(r.stats); expect(JSON.stringify(legacy)).toBe(before);
  });
});
