import { describe, it, expect } from 'vitest';
import { BladeRun, restoreSnapshot, validSnapshot } from '../src/blade/simulation';
import { ENEMIES, ENEMY_INFO, encounterDensity, encounterKind, type EnemyKind } from '../src/blade/config';
import { monsterVoice } from '../src/blade/monster-voices';

const idle = { x: 0, y: 0, dash: false };
const isolated = () => { const r = new BladeRun(19); r.state.enemies = []; r.state.spawnBudget = -10000; r.state.attackTimer = 10000; return r; };
const step = (r: BladeRun, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) r.step(1 / 60, idle); };
const strike = (r: BladeRun) => {
  const s = r.stats; r.state.attackTimer = 10000;
  r.state.swing = { id: r.state.nextId++, tier: r.tier, angle: 0, age: s.windup + s.strike * .45, windup: s.windup, strike: s.strike, recovery: s.recovery, resolved: false };
  r.step(1 / 60, idle);
};
describe('new creature behaviors, sound events and persistence', () => {
  it('introduces eleven naturally spawning archetypes gradually and keeps infants out of the spawn pool', () => {
    const pool = (time: number) => new Set(Array.from({ length: 1000 }, (_, i) => encounterKind(time, i / 1000)));
    expect([...pool(0)]).toEqual(['blob']); expect(pool(89).has('splitter')).toBe(false); expect(pool(90).has('splitter')).toBe(true);
    expect(pool(164).has('charger')).toBe(false); expect(pool(165).has('charger')).toBe(true);
    expect(pool(239).has('wisp')).toBe(false); expect(pool(240).has('wisp')).toBe(true);
    expect(pool(329).has('spiker')).toBe(false); expect(pool(330).has('spiker')).toBe(true);
    expect(pool(590).size).toBe(11); expect(pool(590).has('brood')).toBe(false); expect(Object.keys(ENEMY_INFO)).toHaveLength(14);
  });
  it('limits ranged and charging threats even when late spawn density is high', () => {
    const counts = { poison:3,bomber:5,stalker:5,spiker: 3, shooter: 6, charger: 8, wisp: 10, splitter: 12 };
    const kinds = new Set(Array.from({ length: 1000 }, (_, i) => encounterKind(590, i / 1000, counts)));
    expect([...kinds].sort()).toEqual(['armor', 'blob', 'swift']);
  });
  it('a killed mother creates two safe newborns and awards its own reward only once', () => {
    const r = isolated(), mother = r.spawnEnemy('splitter', 45, 0); mother.hp = 1; mother.speed = 0;
    strike(r); const children = r.state.enemies.filter(e => e.kind === 'brood');
    expect(children).toHaveLength(2); expect(children.every(e => e.spawn === .45)).toBe(true); expect(r.state.kills).toBe(1);
    expect(r.events.find(e => e.type === 'hit')).toMatchObject({ enemyKind: 'splitter', lethal: true, source: 'melee' });
    const reward = r.state.orbs.filter(o => o.kind === 'xp').reduce((n, o) => n + o.value, 0) + r.state.totalXp;
    expect(reward).toBe(ENEMIES.splitter.xp); strike(r); expect(r.state.kills).toBe(1);
    for (const child of children) { child.x = r.state.player.x; child.y = r.state.player.y; }
    r.state.invincible = 0; step(r, .3); expect(r.state.hp).toBe(100);
  });
  it('split descendants cannot recursively split and birth respects the total enemy budget', () => {
    const r = isolated(), cap = encounterDensity(0).cap; r.view = { width: 20000, height: 20000 };
    const mother = r.spawnEnemy('splitter', 45, 0); mother.hp = 1; mother.speed = 0;
    for (let i = 1; i < cap; i++) r.spawnEnemy('blob', 1000 + i * 40, 0);
    strike(r); expect(r.state.enemies).toHaveLength(cap); expect(r.state.enemies.filter(e => e.kind === 'brood')).toHaveLength(1);
    r.state.enemies = []; const child = r.spawnEnemy('brood', 45, 0); child.hp = 1; child.speed = 0;
    strike(r); expect(r.state.enemies.filter(e => e.kind === 'brood')).toHaveLength(0);
  });
  it('a charger telegraphs a locked line before charging, then exposes a recovery window', () => {
    const r = isolated(), e = r.spawnEnemy('charger', 180, 0); e.cooldown = 0; r.state.invincible = 100;
    r.step(1 / 60, idle); expect(e.action).toBe('windup'); expect(e.timer).toBe(.8); expect(e.x).toBe(180);
    const angle = e.angle; r.state.player.y = 100; step(r, .7); expect(e.x).toBe(180); expect(e.angle).toBe(angle);
    step(r, .2); expect(e.action).toBe('charge'); expect(e.x).toBeLessThan(180); expect(e.y).toBeCloseTo(0);
    step(r, .6); expect(e.action).toBe('recover'); const x = e.x; step(r, .3); expect(e.x).toBe(x);
  });
  it('a wisp flanks rather than following a straight line and uses a shorter aimed lunge', () => {
    const r = isolated(), e = r.spawnEnemy('wisp', 180, 0); e.cooldown = 100;
    step(r, .2); expect(Math.abs(e.y)).toBeGreaterThan(1); expect(e.x).toBeLessThan(180);
    e.cooldown = 0; r.step(1 / 60, idle); expect(e.action).toBe('windup'); expect(e.timer).toBe(.6);
    step(r, .7); expect(e.action).toBe('charge'); step(r, .4); expect(e.action).toBe('recover');
  });
  it('a spiker fires six separated projectiles with real gaps, their own damage and a recovery period', () => {
    const r = isolated(), e = r.spawnEnemy('spiker', 180, 0); e.cooldown = 0;
    r.step(1 / 60, idle); expect(e.action).toBe('windup'); expect(r.state.bullets).toHaveLength(0);
    step(r, .9); expect(r.state.bullets).toHaveLength(6); expect(e.action).toBe('recover');
    expect(r.state.bullets.every(b => b.kind === 'spine' && b.damage === 8)).toBe(true);
    const angles = r.state.bullets.map(b => Math.atan2(b.vy, b.vx)).sort((a, b) => a - b);
    for (let i = 1; i < 6; i++) expect(angles[i] - angles[i - 1]).toBeCloseTo(Math.PI / 3);
    r.state.enemies = []; r.state.bullets = [{ id: 1000, x: 20, y: 0, vx: -50, vy: 0, life: 1, damage: 8, kind: 'spine' }]; r.state.invincible = 0;
    r.step(1 / 60, idle); expect(r.state.hp).toBe(92);
  });
  it('suppresses a whole spike volley when insufficient bullet capacity remains', () => {
    for (const lite of [false, true]) {
      const r = isolated(); r.simplified = lite; const limit = lite ? 24 : 32;
      const e = r.spawnEnemy('spiker', 180, 0); e.cooldown = 0;
      for (let i = 0; i < limit - 4; i++) r.state.bullets.push({ id: 1000 + i, x: 10000, y: i * 10, vx: 1, vy: 0, life: 10 });
      step(r, 1); expect(r.state.bullets).toHaveLength(limit - 4); expect(e.action).toBe('recover');
    }
  });
  it('freezing a new enemy freezes its attack preparation and avoids invisible attacks', () => {
    const r = isolated(), e = r.spawnEnemy('spiker', 180, 0); e.cooldown = 0; r.step(1 / 60, idle);
    e.freeze = 1.2; const timer = e.timer; step(r, .8); expect(e.timer).toBe(timer); expect(r.state.bullets).toHaveLength(0);
  });
  it('serializes all new species, their telegraphs and spine damage while accepting old bullets', () => {
    const r = isolated(); for (const kind of ['charger', 'wisp', 'splitter', 'brood', 'spiker'] as EnemyKind[]) r.spawnEnemy(kind, 250, 40);
    r.state.enemies[0].action = 'windup'; r.state.enemies[0].timer = .4;
    r.state.bullets.push({ id: 1000, x: 400, y: 10, vx: 20, vy: 10, life: 2, kind: 'spine', damage: 8 }, { id: 1001, x: 400, y: 10, vx: 20, vy: 10, life: 2 });
    const saved = r.snapshot(); expect(validSnapshot(saved)).toBe(true); expect(restoreSnapshot(saved)).toEqual(saved);
    expect(validSnapshot({ ...saved, bullets: [{ ...saved.bullets[0], damage: -5 }] })).toBe(false);
    expect(validSnapshot({ ...saved, bullets: [{ ...saved.bullets[0], kind: 'unknown' }] })).toBe(false);
  });
  it('each species chooses an intentional voice family and fatal calls have a falling, longer envelope', () => {
    const families = new Set<string>();
    for (const kind of Object.keys(ENEMIES) as EnemyKind[]) {
      const normal = monsterVoice(kind), fatal = monsterVoice(kind, true); families.add(normal.family);
      expect(fatal.start).toBeLessThan(normal.start); expect(fatal.end).toBeLessThan(normal.end); expect(fatal.duration).toBeGreaterThan(normal.duration);
      expect(normal.start).toBeGreaterThan(100); expect(normal.end).toBeGreaterThan(40);
    }
    expect(families.size).toBe(8); expect(monsterVoice('wisp').family).toBe('spirit'); expect(monsterVoice('armor').family).toBe('shell');
  });
});
