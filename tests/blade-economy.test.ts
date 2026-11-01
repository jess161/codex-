import {describe, it, expect} from 'vitest';
import {BladeRun, restoreSnapshot, validSnapshot, type Enemy} from '../src/blade/simulation';
import {BASIC_WEAPON_INDICES, freshPerks, TIERS} from '../src/blade/config';
import {COIN_VALUES, GEAR, GEAR_IDS, GEAR_CAP, RUN_DURATION, SURVIVAL_DURATION, FINALE_DURATION, freshEconomy, gearPrice, gearSpent, validEconomy, type GearId} from '../src/blade/gear';
import {migrateEconomy} from '../src/blade/economy-migration';
import {freshRelics, freshRelicState} from '../src/blade/relics';
const idle = {x: 0, y: 0, dash: false};
function arena(blade: number = 15) {const r = new BladeRun(923, undefined, blade); r.state.enemies = []; r.state.spawnBudget = -1e6; r.state.eliteIndex = 4; r.state.attackTimer = 1e6; return r;}
function fund(r: BladeRun, value = 10000) {r.state.economy!.wallet = r.state.economy!.earned = value;}
function steps(r: BladeRun, n: number, move = idle) {for (let i = 0; i < n; i++) r.step(1 / 60, move);}
function enemy(r: BladeRun, x: number, y = 0, kind: Enemy['kind'] = 'armor') {const e = r.spawnEnemy(kind, x, y); e.hp = e.maxHp = 10000; e.speed = 0; e.cooldown = 1e6; return e;}
function strike(r: BladeRun) {const t = r.stats; r.state.swing = {id: r.state.nextId++, tier: r.tier, angle: 0, age: t.windup + t.strike * .45 - 1 / 60, windup: t.windup, strike: t.strike, recovery: t.recovery, resolved: false}; steps(r, 1);}

describe('coin drops, proximity and purchase conservation', () => {
  it('replaces old equipment with exactly three universal categories and no set requirements', () => {
    expect(GEAR_IDS).toHaveLength(9);
    for (const category of ['defense', 'attack', 'footwear']) expect(GEAR_IDS.filter(id => GEAR[id].category === category)).toHaveLength(3);
    const r = arena(); expect(r.state.version).toBe(9); expect(r.state.relics).toEqual(freshRelics()); expect(r.availableRelics).toEqual([]);
    expect(r.addRelicDrop('stone', 0, 0)).toBeUndefined(); expect(r.state.relicDrops).toEqual([]);
  });
  it.each(Object.keys(COIN_VALUES) as Enemy['kind'][])('drops the correct %s coin value once on a credited kill', kind => {
    const r = arena(), e = enemy(r, 45, 0, kind); e.hp = 1; strike(r);
    const coins = r.state.orbs.filter(o => o.kind === 'coin'); expect(coins).toHaveLength(1); expect(coins[0].value).toBe(COIN_VALUES[kind]);
    expect(r.state.economy!.wallet).toBe(0); if (kind !== 'boss') {steps(r, 3); expect(r.state.orbs.filter(o => o.kind === 'coin')).toHaveLength(1);}
    expect(r.state.relicDrops).toEqual([]);
  });
  it('leaves distant coins stationary and credits near coins exactly once after their drop delay', () => {
    const r = arena(); r.addOrb(300, 200, 25, 'coin'); r.addOrb(0, 0, 4, 'coin');
    steps(r, 12); expect(r.state.economy!.wallet).toBe(0); steps(r, 3); expect(r.state.economy!.wallet).toBe(4);
    steps(r, 120); expect(r.state.economy!.earned).toBe(4); expect(r.state.orbs[0]).toMatchObject({x: 300, y: 200, value: 25});
    r.state.player = {x: 300, y: 200}; steps(r, 1); expect(r.state.economy!.wallet).toBe(29); expect(r.state.orbs).toEqual([]);
  });
  it('preserves 5000 distant coin drops across lite mode, save/load and boss transition', () => {
    const r = arena(); for (let i = 0; i < 5000; i++) r.addOrb(2000 + i, 1000, 1 + i % 5, 'coin');
    steps(r, 30); const orbs = structuredClone(r.state.orbs); r.simplified = true; r.state.time = SURVIVAL_DURATION - .01; steps(r, 1);
    expect(r.state.orbs).toEqual(orbs); expect(r.state.mode).toBe('playing'); expect(r.state.bossStarted).toBe(true); expect(r.state.economy!.wallet).toBe(0);
    expect(validSnapshot(r.snapshot())).toBe(true); expect(restoreSnapshot(r.snapshot())!.orbs).toEqual(orbs);
  });
  it('rejects insufficient funds, malformed IDs, over-cap upgrades and purchases after death without changing state', () => {
    const r = arena(); const before = r.snapshot(); expect(r.buyGear('sugarCore')).toBe(false); expect(r.buyGear('toString')).toBe(false); expect(r.snapshot()).toEqual(before);
    fund(r); for (let i = 0; i < GEAR_CAP; i++) expect(r.buyGear('sugarCore')).toBe(true);
    const full = r.snapshot(); expect(r.buyGear('sugarCore')).toBe(false); expect(r.snapshot()).toEqual(full);
    r.state.mode = 'dead'; const dead = r.snapshot(); expect(r.buyGear('breezeBoots')).toBe(false); expect(r.snapshot()).toEqual(dead);
  });
  it('charges exact rank prices and records only acquired equipment in first-purchase order', () => {
    const r = arena(); fund(r); let spent = 0;
    for (const id of ['clockGrip', 'bubbleGuard', 'clockGrip', 'breezeBoots'] as GearId[]) {spent += gearPrice(id, r.state.economy!.gear[id]); expect(r.buyGear(id)).toBe(true);}
    expect(r.gearOrder).toEqual(['clockGrip', 'bubbleGuard', 'breezeBoots']); expect(r.state.economy!.spent).toBe(spent);
    expect(r.state.economy!.wallet).toBe(10000 - spent); expect(gearSpent(r.state.economy!.gear)).toBe(spent); expect(validEconomy(r.state.economy)).toBe(true);
  });
  it('does not reset movement, RNG, swing timing or game mode during a purchase', () => {
    const r = arena(); fund(r); enemy(r, 55); r.state.attackTimer = 0; steps(r, 1, {x: 1, y: 0, dash: false});
    const before = r.snapshot(); expect(r.buyGear('clockGrip')).toBe(true);
    expect(r.state.swing).toEqual(before.swing); expect(r.state.velocity).toEqual(before.velocity); expect(r.state.rng).toBe(before.rng);
    expect(r.state.mode).toBe('playing'); steps(r, 4, {x: 1, y: 0, dash: false}); expect(r.state.player.x).toBeGreaterThan(before.player.x);
  });
});

describe.each(BASIC_WEAPON_INDICES)('all nine equipment effects work in real play on weapon %i', blade => {
  it('fruit heart increases real HP capacity and heals once', () => {
    const r = arena(blade); fund(r); r.state.hp = 60; r.buyGear('jellyVest'); expect(r.state.maxHp).toBe(120); expect(r.state.hp).toBe(80);
    r.buyGear('jellyVest'); expect(r.state.maxHp).toBe(140); expect(r.state.hp).toBe(100);
  });
  it('bubble armor reduces actual incoming damage', () => {
    const a = arena(blade), b = arena(blade); fund(b); b.buyGear('bubbleGuard'); a.state.invincible = b.state.invincible = 0;
    a.damagePlayer(40, 'test'); b.damagePlayer(40, 'test'); expect(a.state.hp).toBe(60); expect(b.state.hp).toBeCloseTo(62.4);
  });
  it('honey heals on the live simulation clock without requiring a hit', () => {
    const r = arena(blade); fund(r); r.state.hp = 60; r.buyGear('honeyCharm'); steps(r, 299); expect(r.state.hp).toBe(60);
    steps(r, 1); expect(r.state.hp).toBe(62); r.state.hp = r.state.maxHp; steps(r, 600); r.state.hp = 60; steps(r, 1); expect(r.state.hp).toBe(60);
  });
  it('sugar increases real melee or arrow damage', () => {
    const a = arena(blade), b = arena(blade); fund(b); b.buyGear('sugarCore');
    const ea = enemy(a, blade === 17 ? 180 : 55), eb = enemy(b, blade === 17 ? 180 : 55); strike(a); strike(b); steps(a, 30); steps(b, 30);
    expect(eb.maxHp - eb.hp).toBeGreaterThan(ea.maxHp - ea.hp); expect(ea.hp).toBeLessThan(ea.maxHp);
  });
  it('clock grip increases actual automatic attack count', () => {
    const a = arena(blade), b = arena(blade); fund(b); for (let i = 0; i < 3; i++) b.buyGear('clockGrip');
    for (const r of [a, b]) {enemy(r, blade === 17 ? 180 : 55, 0, 'boss'); r.state.attackTimer = 0;}
    steps(a, 180); steps(b, 180); expect(b.state.attackCount).toBeGreaterThan(a.state.attackCount); expect(b.stats.strike).toBeLessThan(a.stats.strike);
  });
  it('lens reaches a real enemy outside the unmodified attack range', () => {
    const a = arena(blade), b = arena(blade), x = a.stats.range * 1.06 + 17; fund(b); b.buyGear('clearLens');
    const ea = enemy(a, x), eb = enemy(b, x); a.state.attackTimer = b.state.attackTimer = 0; steps(a, 100); steps(b, 100);
    expect(ea.hp).toBe(ea.maxHp); expect(eb.hp).toBeLessThan(eb.maxHp);
  });
  it('breeze boots increase actual movement distance', () => {
    const a = arena(blade), b = arena(blade); fund(b); b.buyGear('breezeBoots'); steps(a, 60, {x: 1, y: 0, dash: false}); steps(b, 60, {x: 1, y: 0, dash: false});
    expect(b.state.player.x).toBeGreaterThan(a.state.player.x * 1.05);
  });
  it('spring boots shorten live dash cooldown without changing distance', () => {
    const a = arena(blade), b = arena(blade); fund(b); a.dash(); b.dash(); b.buyGear('springBoots');
    expect(b.state.dashCooldown).toBeCloseTo(a.state.dashCooldown - .4); steps(a, 12); steps(b, 12);
    expect(b.state.player).toEqual(a.state.player); expect(b.stats.dashCooldown).toBe(4.6);
  });
  it('pickup boots really collect coins and XP that stay out of the original radius', () => {
    const a = arena(blade), b = arena(blade); fund(b); b.buyGear('pickupBoots'); const wallet = b.state.economy!.wallet;
    for (const r of [a, b]) {r.addOrb(52, 0, 5, 'coin'); r.addOrb(92, 0, 3, 'xp');}
    steps(a, 60); steps(b, 60); expect(a.state.economy!.earned).toBe(0); expect(a.state.totalXp).toBe(0);
    expect(b.state.economy!.wallet).toBe(wallet + 5); expect(b.state.totalXp).toBe(3);
  });
});

describe('ten-minute pacing, persistent economy and historical conversion', () => {
  it('runs nine minutes of waves then a continuous one-minute finale, never exceeding ten minutes', () => {
    const r = arena(); expect(r.duration).toBe(540); expect(r.bossDuration).toBe(60); expect(r.duration + r.bossDuration).toBe(RUN_DURATION);
    r.state.time = SURVIVAL_DURATION - .01; steps(r, 1, {x: 1, y: 0, dash: false}); expect(r.state.mode).toBe('playing'); expect(r.state.bossStarted).toBe(true);
    r.state.bossTime = FINALE_DURATION - .01; steps(r, 1); expect(r.state.mode).toBe('dead'); expect(r.state.time + r.state.bossTime).toBe(600);
  });
  it.each(BASIC_WEAPON_INDICES)('precisely restores weapon %i coins, gear, regen, ground loot and continuation', blade => {
    const r = arena(blade); fund(r); for (const id of GEAR_IDS) r.buyGear(id); r.state.hp = 60; r.addOrb(500, 500, 25, 'coin'); enemy(r, blade === 17 ? 200 : 50); r.state.attackTimer = 0; steps(r, 5);
    const snapshot = r.snapshot(); expect(validSnapshot(snapshot)).toBe(true); const copy = new BladeRun(1, restoreSnapshot(snapshot)!); steps(r, 120); steps(copy, 120); expect(copy.snapshot()).toEqual(r.snapshot());
  });
  it('refunds retired carried equipment once, converts ground items to coins and removes all old sets', () => {
    const r = arena(0); r.state.time = 180; r.state.level = 10; r.state.maxHp = 133; r.state.hp = 66.5; r.state.relics.heart = 1; r.state.relics.stone = 2; r.state.relicState.heartPeak = 1; r.state.perks.long = 2;
    r.addRelicDrop('crystal', 200, 300); const before = r.snapshot(); expect(validSnapshot(before)).toBe(true); const s = migrateEconomy(restoreSnapshot(before)!);
    expect(s.version).toBe(9); expect(s.time).toBe(270); expect(s.level).toBe(10); expect(s.economy!.wallet).toBe(144); expect(s.relics).toEqual(freshRelics()); expect(s.perks).toEqual(freshPerks()); expect(s.relicState).toEqual(freshRelicState());
    expect(s.orbs.find(o => o.kind === 'coin')).toMatchObject({x: 200, y: 300, value: 20}); expect(s.relicDrops).toEqual([]); expect(s.hp / s.maxHp).toBe(.5); expect(validSnapshot(s)).toBe(true);
    expect(migrateEconomy(structuredClone(s))).toEqual(s); expect(r.snapshot()).toEqual(before);
  });
  it('rejects malformed balances, inventories, orders and coin denominations', () => {
    const s = arena().snapshot();
    for (const economy of [{...freshEconomy(), wallet: NaN}, {...freshEconomy(), wallet: -1}, {...freshEconomy(), wallet: 1}, {...freshEconomy(), order: ['sugarCore']}, {...freshEconomy(), gear: {...freshEconomy().gear, sugarCore: 6}}, {...freshEconomy(), regen: 8}]) expect(restoreSnapshot({...s, economy})).toBeNull();
    expect(restoreSnapshot({...s, economy: undefined})).toBeNull();
    expect(restoreSnapshot({...s, relics: {...freshRelics(), stone: 1}})).toBeNull();
    for (const value of [0, -1, 1.5, 101, NaN]) expect(restoreSnapshot({...s, orbs: [{id: 100, x: 0, y: 0, kind: 'coin', value}]})).toBeNull();
  });
});
