import { BOSS_DURATION, ELITE_INTERVAL, ENEMIES, EVOLUTION_HEAL, GAME_DURATION, MAX_LEVEL, MIN_FORM_TIME, PERKS, TIERS, TIER_LEVELS, angleDelta, encounterDensity, encounterKind, freshPerks, legacyXpNext, sectorHits, tierForLevel, xpNext, type EnemyKind, type PerkId } from './config';
import { equipmentStats, swingMoveFactor, type SwingTiming } from './equipment';
import { freshEnemyEffects, freshPassive, passiveForTier, passiveRules, type BladeId, type EnemyEffects, type PassiveState } from './passives';

export interface Point { x: number; y: number }
export interface Enemy extends Point, EnemyEffects {
  id: number; kind: EnemyKind; hp: number; maxHp: number; radius: number; damage: number; speed: number; xp: number;
  hit: number; spawn: number; age: number; cooldown: number; action: 'idle' | 'windup' | 'charge' | 'recover';
  timer: number; angle: number; move: number; targetX: number; targetY: number; knockX: number; knockY: number;
}
export interface Orb extends Point { id: number; value: number; kind: 'xp' | 'heal' }
export interface Bullet extends Point { id: number; vx: number; vy: number; life: number; kind?: 'orb' | 'spine'; damage?: number }
export interface Wave extends Point { id: number; angle: number; distance: number; maxRange: number; damage: number; pierce: number; hit: number[]; tier: number; kind: 'basic' | 'moon' | 'getsuga' }
export interface Shock extends Point { id: number; radius: number; gap: number }
export interface Swing extends SwingTiming { id: number; angle: number; resolved: boolean; tier: number }
export type RunMode = 'playing' | 'evolving' | 'forge' | 'boss-intro' | 'won' | 'dead';
export interface RunState {
  version: 5; blade: number; forgeAwakening: boolean; id: string; seed: number; rng: number; nextId: number; mode: RunMode;
  time: number; bossTime: number; bossStarted: boolean; transition: number; eliteIndex: number; spawnBudget: number;
  player: Point; direction: Point; velocity: Point; hp: number; maxHp: number; invincible: number; dashTime: number; dashCooldown: number;
  level: number; xp: number; totalXp: number; formStartedAt: number; perks: Record<PerkId, number>; pending: number[]; choices: PerkId[]; evolutionTime: number;
  passive: PassiveState;
  aim: number; targetId: number; attackTimer: number; attackCount: number; swing: Swing | null;
  enemies: Enemy[]; orbs: Orb[]; bullets: Bullet[]; waves: Wave[]; shocks: Shock[];
  kills: number; eliteKills: number; bestCleave: number; bossHits: number; recentKills: number[]; maxCombo: number; failure: string;
}
export type RunEvent = { type: 'slash' | 'hit' | 'kill' | 'pickup' | 'hurt' | 'dash' | 'level' | 'evolve' | 'boss' | 'win' | 'passive'; x?: number; y?: number; amount?: number; tier?: number; elite?: boolean; skill?: BladeId; radius?: number; detail?: 'ready' | 'break'; enemyKind?: EnemyKind; lethal?: boolean; source?: 'melee' | 'wave' | 'passive' | 'burn' };
export interface MoveInput { x: number; y: number; dash: boolean }
export class SpatialGrid {
  private cells = new Map<string, Enemy[]>();
  rebuild(enemies: Enemy[]) {
    this.cells.clear();
    for (const e of enemies) {
      const key = `${Math.floor(e.x / 80)},${Math.floor(e.y / 80)}`;
      const list = this.cells.get(key); if (list) list.push(e); else this.cells.set(key, [e]);
    }
  }
  query(x: number, y: number, r: number) {
    const result: Enemy[] = [];
    for (let i = Math.floor((x - r) / 80); i <= Math.floor((x + r) / 80); i++)
      for (let j = Math.floor((y - r) / 80); j <= Math.floor((y + r) / 80); j++) {
        const items = this.cells.get(`${i},${j}`); if (items) result.push(...items);
      }
    return result;
  }
}

export class BladeRun {
  state: RunState;
  events: RunEvent[] = [];
  view = { width: 960, height: 540 };
  simplified = false;
  private grid = new SpatialGrid();
  private passiveFxCount = 0;
  private rulesMastery = -1;
  private cachedRules = passiveRules();
  constructor(seed = Date.now() >>> 0, snapshot?: RunState, blade = 0) {
    if (!Number.isInteger(blade) || blade < 0 || blade >= TIERS.length) blade = 0;
    this.state = snapshot ? structuredClone(snapshot) : {
      version: 5, blade, forgeAwakening: false, id: `${Date.now()}-${seed}`, seed, rng: seed || 1, nextId: 1, mode: 'playing',
      time: 0, bossTime: 0, bossStarted: false, transition: 0, eliteIndex: 0, spawnBudget: 0,
      player: { x: 0, y: 0 }, direction: { x: 0, y: -1 }, velocity: { x: 0, y: 0 }, hp: 100, maxHp: 100, invincible: .7, dashTime: 0, dashCooldown: 0,
      level: 1, xp: 0, totalXp: 0, formStartedAt: 0, perks: freshPerks(), pending: [], choices: [], evolutionTime: 0,
      passive: freshPassive(blade),
      aim: -Math.PI / 4, targetId: -1, attackTimer: .2, attackCount: 0, swing: null,
      enemies: [], orbs: [], bullets: [], waves: [], shocks: [],
      kills: 0, eliteKills: 0, bestCleave: 0, bossHits: 0, recentKills: [], maxCombo: 0, failure: '',
    };
    if (!snapshot) for (let i = 0; i < 3; i++) {
      const angle = -Math.PI / 2 + (i - 1) * 1.05;
      this.spawnEnemy('blob', Math.cos(angle) * (175 + i * 12), Math.sin(angle) * (175 + i * 12), .65);
    }
  }
  // `tier` is the existing art/passive key. Its value is the chosen blade, never its power rank.
  get tier() { return this.state.blade; }
  get mastery() { return tierForLevel(this.state.level); }
  get rules() {
    const mastery = this.mastery;
    if (mastery !== this.rulesMastery) { this.rulesMastery = mastery; this.cachedRules = passiveRules(mastery); }
    return this.cachedRules;
  }
  get bladeId() { return TIERS[this.tier].id; }
  get passiveInfo() { return passiveForTier(this.tier, this.mastery); }
  get stats() {
    const stats = equipmentStats(this.state.level, this.state.perks, this.tier);
    if (this.bladeId === 'tensa' && this.state.passive.haste > 0) {
      stats.moveSpeed *= 1 + this.rules.hasteBonus;
      stats.interval = Math.max(stats.windup + stats.strike + stats.recovery + .015, stats.interval * (1 - this.rules.hasteBonus));
    }
    return stats;
  }
  private syncPassive() {
    if (this.state.passive.tier === this.tier) return;
    this.state.passive = freshPassive(this.tier);
    for (const enemy of this.state.enemies) Object.assign(enemy, freshEnemyEffects());
    this.state.waves = [];
  }
  get formRemaining() { return Math.max(0, MIN_FORM_TIME - (this.state.time + this.state.bossTime - this.state.formStartedAt)); }
  get holdingXp() { return TIER_LEVELS.includes(this.state.level + 1) && this.state.xp >= xpNext(this.state.level) && this.formRemaining > .001; }
  random() {
    let t = this.state.rng += 0x6d2b79f5;
    this.state.rng >>>= 0;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  spawnEnemy(kind: EnemyKind, x: number, y: number, cue = 0) {
    const s = this.state, c = ENEMIES[kind], minute = Math.floor(s.time / GAME_DURATION * 7);
    let hp = c.hp * (kind === 'boss' || kind === 'elite' ? 1 : 1 + (kind === 'armor' ? .12 : .08) * minute);
    if (kind === 'elite') hp = [450, 1000, 1800, 2800][Math.max(0, Math.min(3, s.eliteIndex - 1))];
    const e: Enemy = { id: s.nextId++, kind, x, y, hp, maxHp: hp, radius: c.radius, speed: c.speed, damage: c.damage, xp: c.xp, hit: 0, spawn: cue, age: 0, cooldown: 1.6 + this.random(), action: 'idle', timer: 0, angle: 0, move: 0, targetX: 0, targetY: 0, knockX: 0, knockY: 0, ...freshEnemyEffects() };
    s.enemies.push(e); return e;
  }
  grantXp(value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    const s = this.state; s.totalXp += value; s.xp += value;
    this.processXp();
  }
  private processXp() {
    const s = this.state;
    while (s.level < MAX_LEVEL && s.xp >= xpNext(s.level)) {
      if (s.pending.length) break;
      const evolves = TIER_LEVELS.includes(s.level + 1);
      if (evolves && this.formRemaining > .0001) break;
      s.xp -= xpNext(s.level); s.level++;
      this.events.push({ type: 'level', amount: s.level });
      s.forgeAwakening = evolves;
      if (evolves) {
        s.formStartedAt = s.time + s.bossTime;
        // Keep earned charges and statuses across mastery; counters remain within their new cycles.
        const r = this.rules, id = this.bladeId;
        const cycle = id === 'well-moon' ? r.moonCycle : id === 'full-moon' ? r.ringCycle : id === 'enma' ? r.enmaCycle : 8;
        s.passive.hits = Math.min(s.passive.hits, cycle - 1);
        for (const e of s.enemies) e.dragonHits = Math.min(e.dragonHits, r.dragonCycle - 1);
      }
      s.pending.push(s.level); break;
    }
    if (s.level === MAX_LEVEL) s.xp = 0;
  }
  private startEvolution() {
    const s = this.state;
    if (!s.pending.length) return;
    s.mode = 'evolving'; s.evolutionTime = s.forgeAwakening ? .6 : .12; s.swing = null; s.velocity = { x: 0, y: 0 };
    s.hp = Math.min(s.maxHp, s.hp + (s.forgeAwakening ? EVOLUTION_HEAL : 1));
    const available = this.availablePerks;
    s.choices = [];
    // Offer blade shaping, handling and a general upgrade when each pool is available.
    for (const group of [['long', 'broad', 'giant'], ['hollow', 'grip', 'stride'], ['sharp', 'quick', 'range', 'magnet', 'force', 'vital']] as PerkId[][]) {
      const pool = available.filter(k => group.includes(k));
      if (pool.length) { const key = pool[Math.floor(this.random() * pool.length)]; s.choices.push(key); available.splice(available.indexOf(key), 1); }
    }
    while (s.choices.length < 3) {
      if (!available.length) { s.choices.push('heal'); continue; }
      s.choices.push(available.splice(Math.floor(this.random() * available.length), 1)[0]);
    }
    for (let i = s.choices.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [s.choices[i], s.choices[j]] = [s.choices[j], s.choices[i]]; }
    this.events.push({ type: 'evolve', tier: this.tier, amount: this.mastery });
  }
  get availablePerks() {
    const s = this.state, before = this.stats;
    return (Object.keys(PERKS) as PerkId[]).filter(k => k !== 'heal' && s.perks[k] < PERKS[k].cap && (!['range', 'long'].includes(k) || equipmentStats(s.level, { ...s.perks, [k]: s.perks[k] + 1 }, this.tier).range > before.range + .001));
  }
  choosePerk(index: number) {
    const s = this.state;
    if (s.mode !== 'forge' || !Number.isInteger(index) || index < 0 || index >= s.choices.length) return false;
    return this.forgePerk(s.choices[index]);
  }
  forgePerk(perk: PerkId) {
    const s = this.state;
    if (s.mode !== 'forge' || !Object.hasOwn(PERKS, perk) || (perk === 'heal' ? !s.choices.includes('heal') : !this.availablePerks.includes(perk))) return false;
    s.perks[perk]++;
    if (perk === 'vital') { s.maxHp += 15; s.hp = Math.min(s.maxHp, s.hp + 15); }
    if (perk === 'heal') s.hp = Math.min(s.maxHp, s.hp + 20);
    s.pending.shift(); s.choices = []; s.invincible = Math.max(s.invincible, .35);
    if (s.pending.length) this.startEvolution(); else s.mode = 'playing';
    return true;
  }
  damagePlayer(amount: number, reason: string) {
    const s = this.state;
    if (s.invincible > 0 || s.mode !== 'playing') return false;
    if (this.bladeId === 'wado' && s.passive.shield) {
      s.passive.shield = false; s.passive.cooldown = this.rules.guardCooldown; s.passive.safeTime = 0; s.invincible = .35;
      if (this.rules.guardCounter) {
        const radius = this.stats.range * 1.1;
        for (const e of s.enemies) if (Math.hypot(e.x - s.player.x, e.y - s.player.y) <= radius + e.radius) this.hitEnemy(e, Math.round(this.stats.damage * this.rules.guardCounter), Math.atan2(e.y - s.player.y, e.x - s.player.x), 'passive');
      }
      this.emitPassive('wado', s.player.x, s.player.y, 32, 'break'); return false;
    }
    s.hp = Math.max(0, s.hp - amount); s.invincible = .65;
    s.passive.safeTime = 0;
    if (s.bossStarted) s.bossHits++;
    this.events.push({ type: 'hurt', x: s.player.x, y: s.player.y, amount });
    if (s.hp <= 0) { s.mode = 'dead'; s.failure = reason; }
    return true;
  }
  dash() {
    const s = this.state;
    if (s.mode !== 'playing' || s.dashCooldown > 0) return false;
    this.syncPassive();
    s.dashTime = .18; s.dashCooldown = 5; s.invincible = Math.max(s.invincible, .12);
    if (this.bladeId === 'dark-dagger') { s.passive.empowered = this.rules.daggerTime; this.emitPassive('dark-dagger'); }
    if (this.bladeId === 'tensa') s.passive.tensaPending = true;
    this.events.push({ type: 'dash', x: s.player.x, y: s.player.y }); return true;
  }
  private emitPassive(skill: BladeId, x = this.state.player.x, y = this.state.player.y, radius = 32, detail?: 'ready' | 'break') {
    if (this.passiveFxCount++ >= 8) return;
    this.events.push({ type: 'passive', skill, x, y, radius, detail, tier: this.tier });
  }
  private createWave(angle: number, damage: number, maxRange: number, pierce: number, kind: Wave['kind'] = 'basic') {
    const s = this.state;
    if (s.waves.length >= 32) return;
    s.waves.push({ id: s.nextId++, x: s.player.x, y: s.player.y, angle, distance: 0, maxRange, damage, pierce, hit: [], tier: this.tier, kind });
  }
  private updatePassive(dt: number) {
    const p = this.state.passive;
    p.empowered = Math.max(0, p.empowered - dt); p.cooldown = Math.max(0, p.cooldown - dt); p.haste = Math.max(0, p.haste - dt);
    if (this.bladeId === 'wado') {
      p.safeTime = Math.min(this.rules.guardSafe, p.safeTime + dt);
      if (!p.shield && p.cooldown <= .0001 && p.safeTime >= this.rules.guardSafe - .0001) {
        p.shield = true; this.emitPassive('wado', this.state.player.x, this.state.player.y, 28, 'ready');
      }
    }
  }
  private ignite(e: Enemy, damage: number) {
    if (e.hp <= 0 || e.spawn > 0) return;
    if (e.burnTime <= 0) e.burnTick = .5;
    e.burnTime = this.rules.burnTime; e.burnDamage = Math.max(e.burnDamage, damage);
  }
  private passiveHit(e: Enemy, source: 'melee' | 'wave' | 'passive' | 'burn') {
    if (source !== 'melee' && source !== 'wave') return;
    const id = this.bladeId;
    if (id === 'deer-cutter' && source === 'melee') e.hunt = this.rules.huntTime;
    if (id === 'snow-drinker') {
      e.chill = this.rules.chillTime; e.chillStacks = Math.min(3, e.chillStacks + 1);
      if (e.chillStacks >= this.rules.freezeStacks && e.kind !== 'boss' && e.kind !== 'elite' && e.freezeCooldown <= 0) {
        e.freeze = this.rules.freezeTime; e.freezeCooldown = 4; this.emitPassive(id, e.x, e.y, e.radius + 12);
      }
    }
    if (id === 'ryujin') this.ignite(e, Math.max(1, Math.round(this.stats.damage * this.rules.burnTickDamage)));
  }
  private hitEnemy(e: Enemy, amount: number, angle: number, source: 'melee' | 'wave' | 'passive' | 'burn' = 'melee') {
    if (e.hp <= 0 || e.spawn > 0) return false;
    this.passiveHit(e, source);
    const s = this.state; e.hp -= amount; e.hit = .15;
    const resistance = e.kind === 'boss' ? 0 : e.kind === 'elite' ? .25 : 1;
    if (source !== 'burn') {
      e.knockX += Math.cos(angle) * this.stats.knockback * 16 * resistance;
      e.knockY += Math.sin(angle) * this.stats.knockback * 16 * resistance;
    }
    this.events.push({ type: 'hit', x: e.x, y: e.y, amount, elite: e.kind === 'elite' || e.kind === 'boss', enemyKind: e.kind, lethal: e.hp <= 0, source });
    if (e.hp > 0) return false;
    this.events.push({ type: 'kill', x: e.x, y: e.y, tier: this.tier, elite: e.kind === 'elite' || e.kind === 'boss' });
    const p = s.passive;
    if (this.bladeId === 'scrap') {
      p.kills++;
      const stacks = Math.min(this.rules.scrapCap, Math.floor(p.kills / 5));
      if (stacks > p.stacks) { p.stacks = stacks; this.emitPassive('scrap'); }
    }
    if (this.bladeId === 'deer-cutter' && e.hunt > 0 && p.cooldown <= 0) {
      s.dashCooldown = Math.max(0, s.dashCooldown - this.rules.huntRefund); p.cooldown = .6; this.emitPassive('deer-cutter', e.x, e.y);
    }
    if (this.bladeId === 'ryujin' && (e.burnTime > 0 || source === 'burn')) {
      for (const other of this.grid.query(e.x, e.y, this.rules.burnSpread + 45)) if (other.id !== e.id && Math.hypot(other.x - e.x, other.y - e.y) <= this.rules.burnSpread + other.radius) this.ignite(other, e.burnDamage);
      this.emitPassive('ryujin', e.x, e.y, this.rules.burnSpread);
    }
    if (e.kind === 'boss') { s.mode = 'won'; this.events.push({ type: 'win' }); return true; }
    if (e.kind === 'elite') { s.eliteKills++; this.addOrb(e.x + 12, e.y, 10, 'heal'); }
    else s.kills++;
    if (e.kind === 'splitter') {
      let slots = encounterDensity(s.time, this.simplified).cap - s.enemies.filter(other => other.hp > 0).length;
      for (const side of [-1, 1]) if (slots-- > 0) {
        const child = this.spawnEnemy('brood', e.x + Math.cos(angle + side * 1.1) * 24, e.y + Math.sin(angle + side * 1.1) * 24, .45);
        child.cooldown = 1;
      }
    }
    s.recentKills.push(s.time + s.bossTime);
    this.addOrb(e.x, e.y, e.xp, 'xp'); return true;
  }
  private resolveMelee(angle: number) {
    const s = this.state, stats = this.stats, id = this.bladeId, p = s.passive;
    const targets = this.grid.query(s.player.x, s.player.y, stats.range + 45).filter(e => e.hp > 0 && e.spawn <= 0 && sectorHits(e.x - s.player.x, e.y - s.player.y, e.radius, angle, stats.range, stats.arc));
    if (!targets.length) return 0;
    const rules = this.rules;
    const cycle = id === 'well-moon' ? rules.moonCycle : id === 'full-moon' ? rules.ringCycle : id === 'enma' ? rules.enmaCycle : 0;
    if (cycle) p.hits = (p.hits + 1) % cycle;
    let multiplier = id === 'scrap' ? 1 + rules.scrapBonus * p.stacks : id === 'dark-dagger' && p.empowered > 0 ? 1 + rules.daggerBonus : 1;
    let spent = 0, cleave = 0;
    if (id === 'enma' && p.hits === 0) {
      spent = s.hp > s.maxHp * .35 ? rules.enmaCost : 0; s.hp -= spent;
      multiplier = 1 + (spent ? rules.enmaPaidBonus : rules.enmaBonus); this.emitPassive(id, s.player.x, s.player.y, stats.range);
    }
    for (const e of targets) {
      let damage = stats.damage * multiplier;
      if (id === 'dark-dagger' && e.kind === 'armor') damage *= 1 + rules.armorBonus;
      if (id === 'deer-cutter' && e.hunt > 0) damage *= 1 + rules.huntBonus;
      if (id === 'shusui') {
        e.dragonHits = (e.dragonHits + 1) % rules.dragonCycle;
        if (e.dragonHits === 0) { damage += stats.damage * rules.dragonBonus * (e.kind === 'boss' || e.kind === 'elite' ? 2 : 1); this.emitPassive(id, e.x, e.y, e.radius + 24); }
      }
      if (this.hitEnemy(e, Math.round(damage), angle)) cleave++;
    }
    if (id === 'dark-dagger' && p.empowered > 0) { p.empowered = 0; this.emitPassive(id, s.player.x, s.player.y, stats.range); }
    if (spent && cleave) s.hp = Math.min(s.maxHp, s.hp + spent);
    if (id === 'well-moon' && p.hits === 0) {
      const spreads = rules.moonCount === 5 ? [-.6, -.3, 0, .3, .6] : [-.36, 0, .36];
      for (const spread of spreads) this.createWave(angle + spread, Math.round(stats.damage * rules.moonDamage), rules.moonRange, rules.moonPierce, 'moon');
      this.emitPassive(id, s.player.x, s.player.y, stats.range);
    }
    if (id === 'full-moon' && p.hits === 0) {
      const radius = stats.range * rules.ringRadius;
      for (const e of this.grid.query(s.player.x, s.player.y, radius + 45)) if (Math.hypot(e.x - s.player.x, e.y - s.player.y) <= radius + e.radius) this.hitEnemy(e, Math.round(stats.damage * rules.ringDamage), Math.atan2(e.y - s.player.y, e.x - s.player.x), 'passive');
      this.emitPassive(id, s.player.x, s.player.y, radius);
    }
    if (id === 'dragon-slayer' && p.cooldown <= 0) {
      const radius = stats.range + 45; p.cooldown = rules.roarCooldown;
      for (const e of this.grid.query(s.player.x, s.player.y, radius + 45)) if (e.hp > 0 && e.spawn <= 0 && Math.hypot(e.x - s.player.x, e.y - s.player.y) <= radius + e.radius) {
        if (e.kind === 'boss' || e.kind === 'elite') { e.slow = rules.roarSlow; e.slowTime = 1.2; }
        else e.stun = rules.roarStun;
        const a = Math.atan2(e.y - s.player.y, e.x - s.player.x), resistance = e.kind === 'boss' ? 0 : e.kind === 'elite' ? .25 : 1;
        e.knockX += Math.cos(a) * 450 * resistance; e.knockY += Math.sin(a) * 450 * resistance;
        if (rules.roarDamage) this.hitEnemy(e, Math.round(stats.damage * rules.roarDamage), a, 'passive');
      }
      this.emitPassive(id, s.player.x, s.player.y, radius);
    }
    return cleave;
  }
  addOrb(x: number, y: number, value: number, kind: 'xp' | 'heal') {
    const s = this.state, limit = this.simplified ? 100 : 150;
    if (s.orbs.length >= limit) {
      let closest: Orb | undefined, distance = Infinity;
      for (const orb of s.orbs) if (orb.kind === kind) {
        const d = Math.hypot(orb.x - x, orb.y - y); if (d < distance) { closest = orb; distance = d; }
      }
      if (closest) { closest.value += value; return; }
      // Preserve rewards even when no matching object can be merged.
      if (kind === 'xp') this.grantXp(value); else s.hp = Math.min(s.maxHp, s.hp + value);
      return;
    }
    s.orbs.push({ id: s.nextId++, x, y, value, kind });
  }
  private spawnOutside(kind?: EnemyKind) {
    const s = this.state, angle = this.random() * Math.PI * 2;
    const distance = 1 / Math.max(Math.abs(Math.cos(angle)) / (this.view.width / 2 + 55), Math.abs(Math.sin(angle)) / (this.view.height / 2 + 55));
    const x = s.player.x + Math.cos(angle) * distance;
    const y = s.player.y + Math.sin(angle) * distance;
    if (!kind) {
      const counts: Partial<Record<EnemyKind, number>> = {};
      for (const enemy of s.enemies) if (enemy.hp > 0) counts[enemy.kind] = (counts[enemy.kind] ?? 0) + 1;
      kind = encounterKind(s.time, this.random(), counts);
    }
    this.spawnEnemy(kind, x, y);
  }
  private beginBoss() {
    const s = this.state;
    s.bossStarted = true; s.mode = 'boss-intro'; s.transition = 1; s.bullets = []; s.enemies = []; s.waves = []; s.shocks = []; s.swing = null;
    for (const orb of s.orbs) { if (orb.kind === 'xp') this.grantXp(orb.value); else s.hp = Math.min(s.maxHp, s.hp + orb.value); }
    s.orbs = []; s.hp = Math.min(s.maxHp, s.hp + 15);
    this.spawnEnemy('boss', s.player.x, s.player.y - 190);
    this.events.push({ type: 'boss' });
  }
  private updateEnemyEffects(e: Enemy, dt: number) {
    e.hunt = Math.max(0, e.hunt - dt); e.freeze = Math.max(0, e.freeze - dt); e.freezeCooldown = Math.max(0, e.freezeCooldown - dt);
    e.stun = Math.max(0, e.stun - dt); e.chill = Math.max(0, e.chill - dt); e.slowTime = Math.max(0, e.slowTime - dt);
    if (e.chill === 0) e.chillStacks = 0;
    if (e.slowTime === 0) e.slow = 0;
    if (e.burnTime > 0) {
      const burnDt = Math.min(dt, e.burnTime);
      e.burnTime = Math.max(0, e.burnTime - dt); e.burnTick -= burnDt;
      while (e.burnTick <= .000001 && e.hp > 0 && this.state.mode === 'playing') {
        e.burnTick += .5;
        this.hitEnemy(e, e.burnDamage, 0, 'burn');
      }
      if (e.burnTime === 0) { e.burnDamage = 0; e.burnTick = .5; }
    }
  }
  private updateEnemy(e: Enemy, dt: number) {
    const s = this.state;
    e.hit = Math.max(0, e.hit - dt); e.age += dt;
    if (e.spawn > 0) { e.spawn = Math.max(0, e.spawn - dt); return; }
    this.updateEnemyEffects(e, dt);
    if (e.hp <= 0 || s.mode !== 'playing') return;
    if (e.freeze > 0 || e.stun > 0) {
      e.x += e.knockX * dt; e.y += e.knockY * dt; e.knockX *= Math.exp(-16 * dt); e.knockY *= Math.exp(-16 * dt); return;
    }
    const slow = Math.max(e.slowTime > 0 ? e.slow : 0, e.chill > 0 ? Math.min(e.kind === 'boss' || e.kind === 'elite' ? .15 : .65, e.chillStacks * this.rules.chillSlow) : 0);
    const moveFactor = 1 - slow;
    const dx = s.player.x - e.x, dy = s.player.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.cooldown -= dt;
    const special = e.kind === 'boss' || e.kind === 'elite';
    let moving = true;
    if (e.action === 'windup') {
      moving = false; e.timer -= dt;
      if (e.timer <= 0) {
        if (e.kind === 'spiker') {
          const capacity = (this.simplified ? 24 : 32) - s.bullets.length;
          // A volley is all-or-nothing, so its six previewed gaps stay predictable at the cap.
          if (capacity >= 6) for (let i = 0; i < 6; i++) {
            const angle = e.angle + i * Math.PI / 3;
            s.bullets.push({ id: s.nextId++, x: e.x + Math.cos(angle) * 22, y: e.y + Math.sin(angle) * 22, vx: Math.cos(angle) * 130, vy: Math.sin(angle) * 130, life: 3.6, damage: 8, kind: 'spine' });
          }
          e.action = 'recover'; e.timer = .7;
        } else if (e.kind === 'shooter') {
          if (s.bullets.length < (this.simplified ? 24 : 32)) s.bullets.push({ id: s.nextId++, x: e.x, y: e.y, vx: Math.cos(e.angle) * 150, vy: Math.sin(e.angle) * 150, life: 5, kind: 'orb', damage: 12 });
          e.action = 'idle'; e.cooldown = 2.8;
        } else if (e.move % 4 === 1 && e.kind === 'boss') {
          s.shocks.push({ id: s.nextId++, x: e.x, y: e.y, radius: 0, gap: e.angle + .8 });
          e.action = 'recover'; e.timer = 1.1;
        } else if (e.move % 4 === 3 && e.kind === 'boss') {
          const summonCount = Math.min(2, 6 - s.enemies.filter(a => a.kind === 'swift').length);
          for (let j = 0; j < summonCount; j++) {
            const a = e.angle + (j === 0 ? 1.3 : -1.3);
            this.spawnEnemy('swift', s.player.x + Math.cos(a) * 195, s.player.y + Math.sin(a) * 195, .8);
          }
          e.action = 'recover'; e.timer = 1;
        } else { e.action = 'charge'; e.timer = e.kind === 'wisp' ? .36 : e.kind === 'charger' ? .55 : .6; }
      }
    } else if (e.action === 'charge') {
      const speed = e.kind === 'wisp' ? 245 : e.kind === 'charger' ? 300 : 360;
      moving = false; e.x += Math.cos(e.angle) * speed * dt * moveFactor; e.y += Math.sin(e.angle) * speed * dt * moveFactor; e.timer -= dt;
      if (e.timer <= 0) { e.action = 'recover'; e.timer = e.kind === 'wisp' ? .85 : 1.1; }
    } else if (e.action === 'recover') {
      moving = false; e.timer -= dt;
      if (e.timer <= 0) { e.action = 'idle'; e.move++; e.cooldown = e.kind === 'boss' ? (e.hp < e.maxHp / 2 ? .8 : 1) : e.kind === 'spiker' ? 3.8 : e.kind === 'wisp' ? 2.6 : 3.5; }
    } else if ((e.kind === 'charger' || e.kind === 'wisp') && e.cooldown <= 0 && d < 230 && Math.abs(dx) < this.view.width / 2 - 25 && Math.abs(dy) < this.view.height / 2 - 25) {
      e.action = 'windup'; e.angle = Math.atan2(dy, dx); e.timer = e.kind === 'wisp' ? .6 : .8; moving = false;
    } else if (e.kind === 'spiker') {
      if (e.cooldown <= 0 && d < 320) {
        e.action = 'windup'; e.angle = Math.atan2(dy, dx) + Math.PI / 6; e.timer = .85; moving = false;
      } else {
        const direction = d < 140 ? -.5 : d > 210 ? 1 : 0;
        e.x += dx / d * e.speed * dt * direction * moveFactor; e.y += dy / d * e.speed * dt * direction * moveFactor; moving = false;
      }
    } else if (special && e.cooldown <= 0 && d < 220 && Math.abs(dx) < this.view.width / 2 - 35 && Math.abs(dy) < this.view.height / 2 - 35) {
      e.action = 'windup'; e.angle = Math.atan2(dy, dx); e.timer = e.kind === 'boss' && e.move % 4 === 1 ? .9 : .8; moving = false;
    } else if (e.kind === 'shooter') {
      if (e.cooldown <= 0 && d < 340) { e.action = 'windup'; e.timer = .5; e.angle = Math.atan2(dy, dx); moving = false; }
      else { const direction = d < 155 ? -1 : d > 230 ? 1 : 0; e.x += dx / d * e.speed * dt * direction * moveFactor; e.y += dy / d * e.speed * dt * direction * moveFactor; moving = false; }
    }
    if (moving) {
      const speed = e.kind === 'boss' && d < 145 ? 0 : e.speed * moveFactor;
      e.x += dx / d * speed * dt; e.y += dy / d * speed * dt;
      if (e.kind === 'wisp') {
        const flank = Math.sin(e.age * 2.5 + e.id) * Math.min(1, d / 120) * 75 * dt * moveFactor;
        e.x -= dy / d * flank; e.y += dx / d * flank;
      }
      if (e.kind !== 'boss') for (const other of this.grid.query(e.x, e.y, 52)) {
        if (other.id === e.id || other.hp <= 0 || other.kind === 'boss') continue;
        const sx = e.x - other.x, sy = e.y - other.y, sd = Math.hypot(sx, sy) || .1, spacing = e.radius + other.radius;
        if (sd < spacing) { const push = Math.min(35 * dt, (spacing - sd) * .3); e.x += sx / sd * push; e.y += sy / sd * push; }
      }
    }
    e.x += e.knockX * dt; e.y += e.knockY * dt;
    e.knockX *= Math.exp(-16 * dt); e.knockY *= Math.exp(-16 * dt);
    if (Math.hypot(e.x - s.player.x, e.y - s.player.y) < e.radius + 16) this.damagePlayer(e.action === 'charge' ? e.kind === 'charger' ? 16 : e.kind === 'wisp' ? 11 : 25 : e.damage, e.kind === 'boss' ? '倒在了圆甲暴君的攻势下' : e.kind === 'elite' ? '被精英的冲锋击中' : e.kind === 'charger' ? '被赤角冲兽的突击撞中' : '被怪群包围，未能脱身');
  }
  step(dt: number, input: MoveInput) {
    this.events = []; this.passiveFxCount = 0;
    const s = this.state;
    if (s.mode === 'won' || s.mode === 'dead' || s.mode === 'forge') return;
    this.syncPassive();
    if (s.mode === 'evolving') { s.evolutionTime -= dt; if (s.evolutionTime <= 0) s.mode = 'forge'; return; }
    if (s.mode === 'boss-intro') {
      s.transition -= dt;
      if (s.transition <= 0) { s.mode = 'playing'; s.invincible = 1; if (s.pending.length) this.startEvolution(); }
      return;
    }
    if (s.pending.length) { this.startEvolution(); return; }
    if (s.bossStarted) { s.bossTime += dt; if (s.bossTime >= BOSS_DURATION) { s.mode = 'dead'; s.failure = '首领战时间耗尽'; return; } }
    else { s.time = Math.min(GAME_DURATION, s.time + dt); if (s.time >= GAME_DURATION) { this.beginBoss(); return; } }
    this.processXp();
    if (s.pending.length) { this.startEvolution(); return; }
    s.invincible = Math.max(0, s.invincible - dt); s.dashCooldown = Math.max(0, s.dashCooldown - dt);
    this.updatePassive(dt);
    const stats = this.stats;
    const magnitude = Math.hypot(input.x, input.y);
    if (magnitude > .05 && s.dashTime <= 0) s.direction = { x: input.x / Math.max(1, magnitude), y: input.y / Math.max(1, magnitude) };
    if (input.dash) this.dash();
    if (s.dashTime > 0) {
      s.velocity = { x: 0, y: 0 };
      const distance = Math.min(dt, s.dashTime) * (140 / .18);
      const norm = Math.hypot(s.direction.x, s.direction.y) || 1;
      s.player.x += s.direction.x / norm * distance; s.player.y += s.direction.y / norm * distance;
      s.dashTime = Math.max(0, s.dashTime - dt);
      if (s.dashTime <= .000001 && s.passive.tensaPending && this.bladeId === 'tensa') {
        s.passive.tensaPending = false; s.passive.haste = this.rules.hasteTime;
        this.createWave(Math.atan2(s.direction.y, s.direction.x), Math.round(stats.damage * this.rules.getsugaDamage), this.rules.getsugaRange, this.rules.getsugaPierce, 'getsuga');
        this.emitPassive('tensa', s.player.x, s.player.y, 44);
      }
    } else if (magnitude <= .05) {
      // Release always stops, including on touch. Inertia applies to starting/turning only.
      s.velocity = { x: 0, y: 0 };
    } else {
      const speed = stats.moveSpeed * swingMoveFactor(stats, s.swing);
      const vx = input.x / Math.max(1, magnitude) * speed, vy = input.y / Math.max(1, magnitude) * speed;
      const dx = vx - s.velocity.x, dy = vy - s.velocity.y, difference = Math.hypot(dx, dy);
      const factor = Math.min(1, stats.acceleration * dt / (difference || 1));
      s.velocity.x += dx * factor; s.velocity.y += dy * factor;
      s.player.x += s.velocity.x * dt; s.player.y += s.velocity.y * dt;
    }
    if (!s.bossStarted) {
      const { cap, rate: intensity } = encounterDensity(s.time, this.simplified);
      s.spawnBudget = Math.min(intensity * 3, s.spawnBudget + dt * intensity);
      while (s.spawnBudget >= 1 && s.enemies.length < cap) { s.spawnBudget--; this.spawnOutside(); }
      if (s.eliteIndex < 4 && s.time >= (s.eliteIndex + 1) * ELITE_INTERVAL) {
        s.eliteIndex++;
        if (s.enemies.length >= cap) s.enemies.splice(s.enemies.findIndex(e => e.kind !== 'elite'), 1);
        this.spawnOutside('elite');
      }
    }
    this.grid.rebuild(s.enemies);
    for (const e of s.enemies) if (e.hp > 0 && s.mode === 'playing') this.updateEnemy(e, dt);
    if (s.mode !== 'playing') return;
    this.grid.rebuild(s.enemies);
    s.attackTimer -= dt;
    if (s.swing) {
      s.swing.age += dt;
      if (s.swing.age >= s.swing.windup + s.swing.strike * .45 && !s.swing.resolved) {
        s.swing.resolved = true;
        const cleave = this.resolveMelee(s.swing.angle);
        s.bestCleave = Math.max(s.bestCleave, cleave);
        s.attackCount++;
        if (stats.waveEvery && s.attackCount % stats.waveEvery === 0) this.createWave(s.swing.angle, Math.round(stats.damage * .6), stats.waveRange, stats.pierce);
      }
      if (s.swing.age > s.swing.windup + s.swing.strike + s.swing.recovery) s.swing = null;
    }
    if (s.attackTimer <= 0 && !s.swing) {
      const targets = this.grid.query(s.player.x, s.player.y, stats.range + 45).filter(e => e.hp > 0 && e.spawn <= 0 && Math.hypot(e.x - s.player.x, e.y - s.player.y) <= stats.range + e.radius);
      targets.sort((a, b) => Math.hypot(a.x - s.player.x, a.y - s.player.y) - Math.hypot(b.x - s.player.x, b.y - s.player.y));
      let target = targets[0]; const existing = targets.find(e => e.id === s.targetId);
      if (existing && target && Math.hypot(existing.x - s.player.x, existing.y - s.player.y) < Math.hypot(target.x - s.player.x, target.y - s.player.y) * 1.25) target = existing;
      if (target) {
        s.targetId = target.id; s.aim = Math.atan2(target.y - s.player.y, target.x - s.player.x); s.attackTimer = stats.interval;
        s.swing = { id: s.nextId++, angle: s.aim, age: 0, resolved: false, tier: this.tier, windup: stats.windup, strike: stats.strike, recovery: stats.recovery };
        this.events.push({ type: 'slash', x: s.player.x, y: s.player.y, tier: this.tier });
      }
    }
    for (const wave of s.waves) {
      const ox = wave.x, oy = wave.y, length = Math.min(420 * dt, wave.maxRange - wave.distance);
      wave.x += Math.cos(wave.angle) * length; wave.y += Math.sin(wave.angle) * length; wave.distance += length;
      const candidates = this.grid.query(wave.x, wave.y, length + 55).filter(e => e.hp > 0 && e.spawn <= 0 && !wave.hit.includes(e.id));
      candidates.sort((a, b) => Math.hypot(a.x - ox, a.y - oy) - Math.hypot(b.x - ox, b.y - oy));
      for (const e of candidates) {
        if (wave.hit.length >= wave.pierce) break;
        const tAlong = Math.max(0, Math.min(1, ((e.x - ox) * (wave.x - ox) + (e.y - oy) * (wave.y - oy)) / Math.max(.001, length * length)));
        if (Math.hypot(e.x - ox - (wave.x - ox) * tAlong, e.y - oy - (wave.y - oy) * tAlong) < e.radius + 10) {
          wave.hit.push(e.id); this.hitEnemy(e, wave.damage, wave.angle, 'wave');
        }
      }
    }
    s.waves = s.waves.filter(w => w.distance < w.maxRange && w.hit.length < w.pierce);
    for (const b of s.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (Math.hypot(b.x - s.player.x, b.y - s.player.y) < 22) { this.damagePlayer(b.damage ?? 12, b.kind === 'spine' ? '未能穿过针背刺团的尖刺间隙' : '未能躲过吐弹者的弹丸'); b.life = 0; }
    }
    s.bullets = s.bullets.filter(b => b.life > 0);
    for (const shock of s.shocks) {
      shock.radius += 220 * dt;
      const d = Math.hypot(s.player.x - shock.x, s.player.y - shock.y), a = Math.atan2(s.player.y - shock.y, s.player.x - shock.x);
      if (Math.abs(d - shock.radius) < 25 && Math.abs(angleDelta(a, shock.gap)) > 35 * Math.PI / 180) this.damagePlayer(20, '被暴君的震荡波击中');
    }
    s.shocks = s.shocks.filter(a => a.radius <= 240);
    for (const orb of s.orbs) {
      const dx = s.player.x - orb.x, dy = s.player.y - orb.y, distance = Math.hypot(dx, dy);
      if (distance < stats.magnet || orb.kind === 'heal' && distance < 100) {
        const amount = Math.min(distance, (270 + (stats.magnet - distance) * 4) * dt);
        orb.x += dx / (distance || 1) * amount; orb.y += dy / (distance || 1) * amount;
      }
      if (Math.hypot(s.player.x - orb.x, s.player.y - orb.y) < 18) {
        if (orb.kind === 'xp') { this.grantXp(orb.value); this.events.push({ type: 'pickup', x: orb.x, y: orb.y, amount: orb.value }); }
        else s.hp = Math.min(s.maxHp, s.hp + orb.value);
        orb.value = 0;
      }
    }
    s.orbs = s.orbs.filter(o => o.value > 0);
    const far = Math.hypot(this.view.width, this.view.height) + 400;
    s.enemies = s.enemies.filter(e => e.hp > 0 && (e.kind === 'boss' || e.kind === 'elite' || Math.hypot(e.x - s.player.x, e.y - s.player.y) < far));
    s.recentKills = s.recentKills.filter(t => t > s.time + s.bossTime - 10);
    s.maxCombo = Math.max(s.maxCombo, s.recentKills.length);
    if (s.mode === 'playing' && s.pending.length) this.startEvolution();
  }
  score() {
    const s = this.state;
    return s.totalXp + s.kills * 10 + s.eliteKills * 150 + (s.mode === 'won' ? 1000 + Math.floor(Math.max(0, BOSS_DURATION - s.bossTime)) * 10 : 0);
  }
  snapshot() { return structuredClone(this.state); }
}

export function validSnapshot(value: unknown): value is RunState {
  if (!value || typeof value !== 'object') return false;
  const s = value as RunState;
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (s.version !== 5 || !Number.isInteger(s.blade) || s.blade < 0 || s.blade >= TIERS.length || typeof s.forgeAwakening !== 'boolean' || typeof s.id !== 'string' || !['playing', 'evolving', 'forge', 'boss-intro'].includes(s.mode)) return false;
  if (!s.player || !finite(s.player.x) || !finite(s.player.y) || !s.direction || !finite(s.direction.x) || !finite(s.direction.y)) return false;
  if (!s.velocity || !finite(s.velocity.x) || !finite(s.velocity.y) || Math.hypot(s.velocity.x, s.velocity.y) > 1000) return false;
  for (const key of ['time', 'bossTime', 'hp', 'maxHp', 'level', 'xp', 'totalXp', 'formStartedAt', 'rng', 'seed', 'nextId', 'targetId', 'attackTimer', 'attackCount', 'dashTime', 'dashCooldown', 'invincible', 'aim', 'eliteIndex', 'spawnBudget', 'evolutionTime', 'transition', 'kills', 'eliteKills', 'bestCleave', 'bossHits', 'maxCombo'] as const) if (!finite(s[key])) return false;
  if (typeof s.bossStarted !== 'boolean') return false;
  if (s.level < 1 || s.level > MAX_LEVEL || !Number.isInteger(s.level) || s.hp <= 0 || s.hp > s.maxHp || s.maxHp > 190 || s.time < 0 || s.time > GAME_DURATION || s.bossTime < 0 || s.bossTime > BOSS_DURATION) return false;
  if (s.formStartedAt < 0 || s.formStartedAt > s.time + s.bossTime + .001 || s.xp < 0 || s.totalXp < 0) return false;
  if (!s.perks || !Object.keys(PERKS).every(k => Number.isInteger(s.perks[k as PerkId]) && s.perks[k as PerkId] >= 0 && s.perks[k as PerkId] <= PERKS[k as PerkId].cap)) return false;
  const p = s.passive;
  if (!p || ['tier', 'hits', 'kills', 'stacks', 'empowered', 'cooldown', 'safeTime', 'haste'].some(k => !finite(p[k as keyof PassiveState]) || Number(p[k as keyof PassiveState]) < 0)) return false;
  if (p.tier !== s.blade || !Number.isInteger(p.hits) || p.hits > 7 || !Number.isInteger(p.kills) || !Number.isInteger(p.stacks) || p.stacks > 7 || p.empowered > 5.001 || p.cooldown > 12.001 || p.safeTime > 6.001 || p.haste > 3.001 || typeof p.shield !== 'boolean' || typeof p.tensaPending !== 'boolean') return false;
  if (!Array.isArray(s.pending) || s.pending.length > 1 || s.pending.some(t => !Number.isInteger(t) || t < 2 || t > MAX_LEVEL || t !== s.level)) return false;
  if (!Array.isArray(s.choices) || s.choices.length > 3 || s.choices.some(k => !Object.hasOwn(PERKS, k)) || (s.mode === 'forge' || s.mode === 'evolving') && (s.pending.length === 0 || s.choices.length !== 3)) return false;
  for (const [array, max] of [[s.enemies, 280], [s.orbs, 150], [s.bullets, 32], [s.waves, 32], [s.shocks, 8]] as const) {
    if (!Array.isArray(array) || array.length > max || array.some(e => !e || !finite(e.x) || !finite(e.y) || !finite(e.id))) return false;
  }
  const enemyNumbers = ['hp', 'maxHp', 'radius', 'damage', 'speed', 'xp', 'hit', 'spawn', 'age', 'cooldown', 'timer', 'angle', 'move', 'targetX', 'targetY', 'knockX', 'knockY'] as const;
  if (s.enemies.some(e => !Object.hasOwn(ENEMIES, e.kind) || enemyNumbers.some(k => !finite(e[k])) || !['idle', 'windup', 'charge', 'recover'].includes(e.action))) return false;
  const effectKeys = Object.keys(freshEnemyEffects()) as (keyof EnemyEffects)[];
  if (s.enemies.some(e => effectKeys.some(k => !finite(e[k]) || e[k] < 0) || !Number.isInteger(e.chillStacks) || e.chillStacks > 3 || !Number.isInteger(e.dragonHits) || e.dragonHits > 2 || e.slow > 1 || e.burnTime > 4.001 || e.burnTick > .501 || e.hunt > 6.001 || e.chill > 3.001 || e.freeze > 1.401 || e.freezeCooldown > 4.001 || e.stun > 1.201 || e.slowTime > 1.201)) return false;
  if (s.orbs.some(o => !finite(o.value) || o.value <= 0 || !['xp', 'heal'].includes(o.kind))) return false;
  if (s.bullets.some(b => !finite(b.vx) || !finite(b.vy) || !finite(b.life) || b.kind !== undefined && !['orb', 'spine'].includes(b.kind) || b.damage !== undefined && (!finite(b.damage) || b.damage <= 0 || b.damage > 30))) return false;
  if (s.waves.some(w => !finite(w.angle) || !finite(w.distance) || !finite(w.maxRange) || !finite(w.damage) || !Number.isInteger(w.pierce) || w.pierce < 1 || w.pierce > 24 || !Number.isInteger(w.tier) || w.tier < 0 || w.tier >= TIERS.length || !['basic', 'moon', 'getsuga'].includes(w.kind) || !Array.isArray(w.hit) || w.hit.length > w.pierce || w.hit.some(id => !finite(id)))) return false;
  if (s.shocks.some(shock => !finite(shock.radius) || !finite(shock.gap))) return false;
  if (s.swing && (!finite(s.swing.id) || !finite(s.swing.age) || !finite(s.swing.angle) || !Number.isInteger(s.swing.tier) || s.swing.tier < 0 || s.swing.tier >= TIERS.length || typeof s.swing.resolved !== 'boolean' || ['windup', 'strike', 'recovery'].some(k => !finite(s.swing![k as keyof Swing]) || Number(s.swing![k as keyof Swing]) <= 0 || Number(s.swing![k as keyof Swing]) > 1))) return false;
  if (!Array.isArray(s.recentKills) || s.recentKills.some(t => !finite(t))) return false;
  return true;
}

// Legacy runs keep their currently equipped blade; further levels train that same blade.
export function restoreSnapshot(value: unknown): RunState | null {
  if (validSnapshot(value)) return structuredClone(value);
  if (!value || typeof value !== 'object') return null;
  const version = (value as { version?: unknown }).version;
  if (![1, 2, 3, 4].includes(Number(version))) return null;
  const migrated = structuredClone(value) as RunState;
  const oldLevels = [1, 5, 10, 15, 20, 25];
  const oldTiers = [1, 3, 5, 7, 9, 11, 13, 16, 19, 22, 25, 28];
  const oldBlade = (level: number) => oldTiers.reduce((tier, threshold, i) => level >= threshold ? i : tier, 0);
  const inRange = (n: number, max: number) => Number.isInteger(n) && n >= 0 && n < max;
  if (!migrated.perks || typeof migrated.perks !== 'object' || !Array.isArray(migrated.pending) || !Array.isArray(migrated.waves) || !Array.isArray(migrated.enemies)) return null;
  const oldCount = version === 1 ? 6 : 12;
  if (migrated.pending.length >= oldCount || migrated.pending.some(t => !inRange(t, oldCount) || t === 0)) return null;
  if (migrated.waves.some(w => !w || !inRange(w.tier, oldCount)) || migrated.swing && !inRange(migrated.swing.tier, oldCount)) return null;
  if (version === 1) {
    migrated.waves.forEach(w => { w.tier = oldBlade(oldLevels[w.tier]); });
    if (migrated.swing) migrated.swing.tier = oldBlade(oldLevels[migrated.swing.tier]);
  }
  if (version === 1 || version === 2) {
    for (const key of ['long', 'broad', 'giant', 'hollow', 'grip', 'stride'] as PerkId[]) if (migrated.perks[key] === undefined) migrated.perks[key] = 0;
    migrated.velocity = { x: 0, y: 0 };
    if (migrated.bossStarted) migrated.time = GAME_DURATION;
    migrated.formStartedAt = migrated.time + migrated.bossTime;
    if (Number.isFinite(migrated.xp)) migrated.xp = Math.round(migrated.xp * xpNext(migrated.level) / legacyXpNext(migrated.level));
    if (migrated.swing && typeof migrated.swing === 'object') Object.assign(migrated.swing, { windup: .04, strike: .10, recovery: .10 });
  }
  migrated.version = 5; migrated.blade = oldBlade(migrated.level);
  migrated.forgeAwakening = migrated.pending.length > 0;
  migrated.pending = migrated.pending.length ? [migrated.level] : [];
  if (version !== 4) {
    migrated.passive = freshPassive(migrated.blade);
    if (migrated.enemies.some(e => !e || typeof e !== 'object')) return null;
    for (const enemy of migrated.enemies) Object.assign(enemy, freshEnemyEffects());
    for (const wave of migrated.waves) wave.kind = 'basic';
  }
  if (migrated.passive) {
    const id = TIERS[migrated.blade].id, rules = passiveRules(tierForLevel(migrated.level));
    const cycle = id === 'well-moon' ? rules.moonCycle : id === 'full-moon' ? rules.ringCycle : id === 'enma' ? rules.enmaCycle : 8;
    migrated.passive.hits = Math.min(migrated.passive.hits, cycle - 1);
  }
  return validSnapshot(migrated) ? migrated : null;
}
