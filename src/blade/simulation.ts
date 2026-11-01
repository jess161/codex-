import { COIN_VALUES, GEAR_CAP, SURVIVAL_DURATION, FINALE_DURATION, freshEconomy, isGearId, gearPrice, validEconomy, type EconomyState, type GearId } from './gear';
import {isBow,freshArchery,shootBow,activateBow,stepArchery,validArchery,type ArcheryState,type BowHost} from './bows';
import {freshRelicLoot,dropCandidates,drawRelic,relicRandom,validRelicLoot,validRelicDrops,type RelicDrop,type RelicLootState} from './relic-loot';
import { ACTIVE_SKILLS, activePlan, freshActive, validActive, type ActiveState, type ActivePulse } from './active-skills';
import { THREATS, type Hazard } from './threats';
import { DEFAULT_WEAPON, isBasicWeapon, CLASSIC_TIMING, classicXpNext, BOSS_DURATION, ELITE_INTERVAL, ENEMIES, EVOLUTION_HEAL, GAME_DURATION, MAX_LEVEL, MIN_FORM_TIME, XP_DROP_TIME, PERKS, TIERS, TIER_LEVELS, angleDelta, encounterDensity, encounterKind, lateGameDifficulty, freshPerks, legacyXpNext, sectorHits, thrustHits, tierForLevel, xpNext, type EnemyKind, type PerkId } from './config';
import { BASE_RELIC_IDS, LEGACY_RELICS, RELIC_CAP, LEGACY_RELIC_SLOTS, RELIC_IDS, RELICS, eligibleRelics, ownedRelics, weightedRelic, freshRelics, freshRelicState, isRelicId, relicGroups, validRelics, type RelicId, type RelicInventory, type RelicState } from './relics';
import { FOODS, foodForRoll, isFoodId, type FoodId } from './food';
import { shopEquipmentStats, equipmentStats, swingMoveFactor, type SwingTiming } from './equipment';
import { PASSIVE_SIZE_LIMITS, passiveSize, waveDimensions } from './passive-size';
import { freshEnemyEffects, freshPassive, passiveForTier, passiveRules, type BladeId, type EnemyEffects, type PassiveState } from './passives';

export interface Point { x: number; y: number }
export interface Enemy extends Point, EnemyEffects {
  id: number; kind: EnemyKind; reveal?: number; hp: number; maxHp: number; radius: number; damage: number; speed: number; xp: number;
  hit: number; spawn: number; age: number; cooldown: number; action: 'idle' | 'windup' | 'charge' | 'recover';
  timer: number; angle: number; move: number; targetX: number; targetY: number; knockX: number; knockY: number;
}
export interface Orb extends Point { id: number; value: number; kind: 'xp' | 'heal' | 'coin'; dropTimer?: number; food?:FoodId }
export interface Bullet extends Point { id: number; vx: number; vy: number; life: number; kind?: 'orb' | 'spine'; damage?: number }
export interface Wave extends Point { id: number; angle: number; distance: number; maxRange: number; damage: number; pierce: number; hit: number[]; tier: number; kind: 'basic' | 'moon' | 'getsuga'; radius?: number; hitRadius?: number; source?:'active'; boomerang?:boolean; returning?:boolean }
export interface Shock extends Point { id: number; radius: number; gap: number }
export interface Swing extends SwingTiming { id: number; angle: number; resolved: boolean; tier: number }
export type RunMode = 'playing' | 'evolving' | 'relic' | 'boss-intro' | 'relic-trim' | 'won' | 'dead';
export interface RunState {
  version: 8 | 9; economy?: EconomyState; classicTiming:boolean; relicLoot:RelicLootState; relicDrops:RelicDrop[]; lootRng:number; skipped:number; relicResume?: 'playing'|'evolving'|'relic'|'boss-intro'; relics: RelicInventory; relicState: RelicState; blade: number; forgeAwakening: boolean; id: string; seed: number; rng: number; nextId: number; mode: RunMode;
  time: number; bossTime: number; bossStarted: boolean; transition: number; eliteIndex: number; spawnBudget: number;
  player: Point; direction: Point; velocity: Point; hp: number; maxHp: number; invincible: number; dashTime: number; dashCooldown: number;
  level: number; xp: number; totalXp: number; formStartedAt: number; perks: Record<PerkId, number>; pending: number[]; choices: RelicId[]; evolutionTime: number;
  passive: PassiveState; active?:ActiveState; archery?:ArcheryState;
  aim: number; targetId: number; attackTimer: number; attackCount: number; swing: Swing | null;
  hazards?: Hazard[]; enemies: Enemy[]; orbs: Orb[]; bullets: Bullet[]; waves: Wave[]; shocks: Shock[];
  kills: number; eliteKills: number; bestCleave: number; bossHits: number; recentKills: number[]; maxCombo: number; failure: string;
}
export type RunEvent = { type: 'coin' | 'gear-buy' | 'shot' | 'bow-blast' | 'slash' | 'hit' | 'kill' | 'pickup' | 'hurt' | 'dash' | 'level' | 'evolve' | 'boss' | 'win' | 'passive' | 'relic' | 'blast' | 'active' | 'item-drop' | 'item-pickup'; gearId?: GearId; relicId?:RelicId;rank?:number;lootKind?:'gain'|'upgrade'|'overflow'; activePhase?:'cast'|'pulse'|'heal'; pulseKind?:ActivePulse['kind']; angle?:number; arc?:number; item?: 'thunder' | 'shield' | 'vortex' | 'phoenix'; critical?:boolean; food?:FoodId; toX?: number; toY?: number; x?: number; y?: number; amount?: number; tier?: number; elite?: boolean; skill?: BladeId; radius?: number; size?: number; detail?: 'ready' | 'break'; enemyKind?: EnemyKind; enemyId?: number; lethal?: boolean; source?: 'melee' | 'wave' | 'passive' | 'burn' | 'poison' | 'relic' | 'active' };
export interface MoveInput { x: number; y: number; dash: boolean; active?:boolean }
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
  constructor(seed = Date.now() >>> 0, snapshot?: RunState, blade: number = DEFAULT_WEAPON) {
    if (!Number.isInteger(blade) || blade < 0 || blade >= TIERS.length) blade = DEFAULT_WEAPON;
    this.state = snapshot ? structuredClone(snapshot) : {
      version: isBasicWeapon(blade) ? 9 : 8, ...(isBasicWeapon(blade) ? {economy: freshEconomy()} : {}), classicTiming:false,relicLoot:freshRelicLoot(seed),relicDrops:[],lootRng: (seed ^ 0xa5b35705) >>> 0, skipped:0, relics: freshRelics(), relicState: freshRelicState(), blade, forgeAwakening: false, id: `${Date.now()}-${seed}`, seed, rng: seed || 1, nextId: 1, mode: 'playing',
      time: 0, bossTime: 0, bossStarted: false, transition: 0, eliteIndex: 0, spawnBudget: 0,
      player: { x: 0, y: 0 }, direction: { x: 0, y: -1 }, velocity: { x: 0, y: 0 }, hp: 100, maxHp: 100, invincible: .7, dashTime: 0, dashCooldown: 0,
      level: 1, xp: 0, totalXp: 0, formStartedAt: 0, perks: freshPerks(), pending: [], choices: [], evolutionTime: 0,
      passive: freshPassive(blade), active:freshActive(),
      aim: -Math.PI / 4, targetId: -1, attackTimer: .2, attackCount: 0, swing: null,
      hazards: [], enemies: [], orbs: [], bullets: [], waves: [], shocks: [],
      kills: 0, eliteKills: 0, bestCleave: 0, bossHits: 0, recentKills: [], maxCombo: 0, failure: '',
    };
    this.state.active ??= freshActive();
    if(isBow(this.state.blade))this.state.archery??=freshArchery();
    if (!snapshot) for (let i = 0; i < 3; i++) {
      const angle = -Math.PI / 2 + (i - 1) * 1.05;
      this.spawnEnemy('blob', Math.cos(angle) * (175 + i * 12), Math.sin(angle) * (175 + i * 12), .65);
    }
  }
  // `tier` is the existing art/passive key. Its value is the chosen blade, never its power rank.
  get duration(){return this.state.economy ? SURVIVAL_DURATION : this.state.classicTiming?CLASSIC_TIMING.game:GAME_DURATION;}
  get bossDuration(){return this.state.economy ? FINALE_DURATION : this.state.classicTiming?CLASSIC_TIMING.boss:BOSS_DURATION;}
  get practiceTime(){return this.state.economy ? 60 : this.state.classicTiming?CLASSIC_TIMING.practice:MIN_FORM_TIME;}
  get xpNeeded(){return this.state.classicTiming?classicXpNext(this.state.level):xpNext(this.state.level);}
  get relicOrder(){const order=this.state.relicLoot.order.filter(id=>this.state.relics[id]>0);return [...order,...ownedRelics(this.state.relics).filter(id=>!order.includes(id))];}
  get tier() { return this.state.blade; }
  get mastery() { return tierForLevel(this.state.level); }
  get rules() {
    const mastery = this.mastery;
    if (mastery !== this.rulesMastery) { this.rulesMastery = mastery; this.cachedRules = passiveRules(mastery); }
    return this.cachedRules;
  }
  get bladeId() { return TIERS[this.tier].id; }
  get active() { return this.state.active!; }
  get hasActiveSkill() { return !isBasicWeapon(this.tier); }
  get activeInfo() { return isBasicWeapon(this.tier) ? null : ACTIVE_SKILLS[this.bladeId as keyof typeof ACTIVE_SKILLS]; }
  get passiveInfo() { return passiveForTier(this.tier, this.mastery); }
  get passiveSize() { return passiveSize(this.stats, this.rules); }
  get stats() { return this.state.economy ? shopEquipmentStats(this.state.level, this.tier, this.state.economy.gear) : this.statsForRelics(this.state.relics); }
  statsForRelics(items: RelicInventory) {
    const stats = equipmentStats(this.state.level, this.state.perks, this.tier, items);
    if(!this.state.classicTiming)stats.damage=Math.round(stats.damage*(1+.02*(this.state.level-1)));
    if (this.state.hp < this.state.maxHp * .5) {
      stats.interval = Math.max(stats.windup + stats.strike + stats.recovery + .015, stats.interval * .9 ** items.overdrive);
      stats.moveSpeed *= 1 + .04 * items.overdrive;
      if (relicGroups(items).chaos >= 3) { stats.damage = Math.round(stats.damage * 1.25); stats.damageReduction += .08; }
    }
    if(this.active.buff>0) {
      if(this.bladeId==='scrap')stats.interval=Math.max(stats.windup+stats.strike+stats.recovery+.015,stats.interval*.75);
      if(this.bladeId==='tensa'){stats.moveSpeed*=1.2;stats.interval=Math.max(stats.windup+stats.strike+stats.recovery+.015,stats.interval*.8);}
    }
    if (this.bladeId === 'tensa' && this.state.passive.haste > 0) {
      stats.moveSpeed *= 1 + this.rules.hasteBonus;
      stats.interval = Math.max(stats.windup + stats.strike + stats.recovery + .015, stats.interval * (1 - this.rules.hasteBonus));
    }
    return stats;
  }
  get gearOrder() { return this.state.economy?.order ?? []; }
  get coinRange() { return 48 * (1 + .18 * (this.state.economy?.gear.pickupBoots ?? 0)); }
  buyGear(value: unknown) {
    const s = this.state, e = s.economy;
    if (!e || s.mode !== 'playing' || !isGearId(value) || e.gear[value] >= GEAR_CAP) return false;
    const price = gearPrice(value, e.gear[value]);
    if (e.wallet < price) return false;
    e.wallet -= price; e.spent += price;
    if (e.gear[value] === 0) e.order.push(value);
    e.gear[value]++;
    if (value === 'jellyVest') { s.maxHp += 20; this.heal(20); }
    if (value === 'springBoots') s.dashCooldown = Math.max(0, s.dashCooldown - .4);
    if (value === 'honeyCharm' && e.gear[value] === 1) e.regen = 0;
    this.events.push({type: 'gear-buy', gearId: value, rank: e.gear[value], amount: price});
    return true;
  }
  private updateGear(dt: number) {
    const e = this.state.economy;
    if (!e || !e.gear.honeyCharm) return;
    e.regen += dt;
    while (e.regen >= 5 - 1e-9) { e.regen = Math.max(0, e.regen - 5); this.heal(2 * e.gear.honeyCharm); }
  }
  get isRanged(){return isBow(this.tier);}
  get archery(){return this.state.archery??=freshArchery();}
  private targetOnScreen(e:Enemy){return !this.isRanged||(Math.abs(e.x-this.state.player.x)<=this.view.width/2+e.radius&&Math.abs(e.y-this.state.player.y)<=this.view.height/2+e.radius);}
  private bowHost():BowHost {
    const s=this.state;
    return {archery:this.archery,player:s.player,stats:this.stats,mastery:this.mastery,index:this.tier,scope:s.relics.scope,elemental:this.elementalBonus*(relicGroups(s.relics).arcane>=2?1.2:1),enemies:s.enemies,
      nextId:()=>s.nextId++,live:()=>s.mode==='playing',hit:(e,d,a,source)=>{this.hitEnemy(e,d,a,source);},strike:e=>{this.relicStrike(e);},
      emit:(type,p,radius)=>this.events.push({type,x:p.x,y:p.y,radius,tier:this.tier})};
  }
  activateSkill() {
    const s=this.state,a=this.active, ability=this.activeInfo;
    if(!ability || !this.hasActiveSkill||s.mode!=='playing'||a.cooldown>.000001)return false;
    const reach=Math.max(260,Math.hypot(this.view.width,this.view.height)/2);
    const nearby=s.enemies.filter(e=>e.hp>0&&e.spawn<=0&&this.targetOnScreen(e)&&Math.hypot(e.x-s.player.x,e.y-s.player.y)<=reach)
      .sort((x,y)=>Math.hypot(x.x-s.player.x,x.y-s.player.y)-Math.hypot(y.x-s.player.x,y.y-s.player.y)||x.id-y.id);
    const target=(this.bladeId==='shusui'||this.isRanged?nearby.find(e=>e.kind==='boss'||e.kind==='elite'):undefined)??nearby[0];
    const angle=target?Math.atan2(target.y-s.player.y,target.x-s.player.x):s.aim;
    if(this.isRanged){
      a.cooldown=ability.cooldown;a.casts++;
      const tx=target?.x??s.player.x+Math.cos(angle)*this.stats.range,ty=target?.y??s.player.y+Math.sin(angle)*this.stats.range;
      s.aim=angle;activateBow(this.bowHost(),angle,{x:tx,y:ty});
      this.events.push({type:'active',activePhase:'cast',skill:this.bladeId,x:s.player.x,y:s.player.y,angle,tier:this.tier});
      stepArchery(this.bowHost(),0);return true;
    }
    const plan=activePlan(this.bladeId,this.mastery,this.stats.damage,this.passiveSize.meleeRadius,angle);
    a.cooldown=ability.cooldown;a.casts++;a.buff=plan.buff;a.pending=plan.pulses;a.fields=plan.fields;
    const tx=target?.x??s.player.x+Math.cos(angle)*120,ty=target?.y??s.player.y+Math.sin(angle)*120;
    for(const f of a.fields){f.x=tx;f.y=ty;}
    if(plan.targeted)for(const p of a.pending){p.x=tx;p.y=ty;}
    if(plan.chainDamage) {
      const used=new Set<number>();let from:Point=s.player;
      for(let i=0;i<6;i++){
        const e=s.enemies.filter(e=>e.hp>0&&e.spawn<=0&&!used.has(e.id)&&Math.hypot(e.x-from.x,e.y-from.y)<=(i?190:reach))
          .sort((x,y)=>Math.hypot(x.x-from.x,x.y-from.y)-Math.hypot(y.x-from.x,y.y-from.y)||x.id-y.id)[0];
        if(!e)break;used.add(e.id);
        a.pending.push({kind:'hunt',delay:i*.06,angle,radius:20,arc:360,damage:plan.chainDamage,targetId:e.id});from=e;
      }
    }
    s.aim=angle;
    this.events.push({type:'active',activePhase:'cast',pulseKind:plan.targeted?'execution':undefined,skill:this.bladeId,x:plan.targeted?tx:s.player.x,y:plan.targeted?ty:s.player.y,angle,tier:this.tier,radius:plan.pulses[0]?.radius??this.passiveSize.meleeRadius});
    if(plan.clearBullets){const radius=(plan.pulses[0]?.radius??108)+30;s.bullets=s.bullets.filter(b=>Math.hypot(b.x-s.player.x,b.y-s.player.y)>radius);}
    for(const wave of plan.waves)this.createWave(wave.angle,wave.damage,wave.range,wave.pierce,wave.kind,'active',wave.size,wave.boomerang);
    this.grid.rebuild(s.enemies);this.updateActive(0);
    if(plan.move&&s.mode==='playing'){s.player.x+=Math.cos(angle)*plan.move;s.player.y+=Math.sin(angle)*plan.move;s.velocity={x:0,y:0};s.invincible=Math.max(s.invincible,.45);}
    return true;
  }
  private updateActive(dt:number) {
    const s=this.state,a=this.active;
    a.cooldown=Math.max(0,a.cooldown-dt);a.buff=Math.max(0,a.buff-dt);
    const due:ActivePulse[]=[];
    a.pending=a.pending.filter(p=>{p.delay=Math.max(0,p.delay-dt);if(p.delay<=.000001){due.push(p);return false;}return true;});
    for(const p of due) {
      if(s.mode!=='playing')break;
      const tracked=p.targetId?s.enemies.find(e=>e.id===p.targetId&&e.hp>0&&e.spawn<=0):undefined;
      if(p.targetId&&!tracked)continue;
      const x=tracked?.x??p.x??s.player.x,y=tracked?.y??p.y??s.player.y;
      this.events.push({type:'active',activePhase:'pulse',pulseKind:p.kind,skill:this.bladeId,x,y,toX:s.player.x,toY:s.player.y,radius:p.radius,angle:p.angle,arc:p.arc,tier:this.tier});
      let hits=0;
      for(const e of s.enemies) {
        if(s.mode!=='playing')break;
        if(e.hp<=0||e.spawn>0||p.targetId&&e.id!==p.targetId||!p.targetId&&!sectorHits(e.x-x,e.y-y,e.radius,p.angle,p.radius,p.arc))continue;
        const damage=p.damage*(p.kind==='thrust'&&e.kind==='armor'?1.5:1)*(p.kind==='hunt'&&e.hunt>0?1+this.rules.huntBonus:1);
        this.hitEnemy(e,Math.round(damage),Math.atan2(e.y-y,e.x-x),'active');hits++;
      }
      if(p.kind==='soul'&&hits){const healed=this.heal(s.maxHp*Math.min(.2,.02*hits));if(healed>0)this.events.push({type:'active',activePhase:'heal',skill:'enma',x:s.player.x,y:s.player.y,amount:healed});}
    }
    for(const f of a.fields) {
      if(s.mode!=='playing')break;
      const elapsed=Math.min(dt,f.life);f.life=Math.max(0,f.life-dt);f.tick-=elapsed;
      while(f.tick<=.000001&&s.mode==='playing'){
        f.tick+=.5;
        const positions=f.kind==='mirror'?this.mirrorPositions(f):[f.kind==='spin'?s.player:f];
        for(const origin of positions)for(const e of s.enemies){
          if(s.mode!=='playing'||e.hp<=0||e.spawn>0)continue;
          const dx=origin.x-e.x,dy=origin.y-e.y,d=Math.hypot(dx,dy);
          const radius=f.kind==='mirror'?f.radius*.65:f.radius;
          if(d>radius+e.radius)continue;
          if(f.kind==='vortex'){
            const pull=Math.max(0,Math.min(26,d-15))*(e.kind==='boss'?0:e.kind==='elite'?.25:1);
            e.x+=dx/(d||1)*pull;e.y+=dy/(d||1)*pull;
          }
          this.hitEnemy(e,f.damage,Math.atan2(e.y-origin.y,e.x-origin.x),'active');
        }
      }
    }
    a.fields=a.fields.filter(f=>f.life>.000001);
    if(a.fields.length)this.grid.rebuild(s.enemies);
  }
  mirrorPositions(f:NonNullable<RunState['active']>['fields'][number]) {
    const a=(f.duration-f.life)*2.7,reach=Math.min(110,Math.max(48,f.radius*.55));
    return [-1,1].map(side=>({x:this.state.player.x+Math.cos(a)*reach*side,y:this.state.player.y+Math.sin(a)*reach*.7*side}));
  }
  private syncPassive() {
    if (this.state.passive.tier === this.tier) return;
    this.state.passive = freshPassive(this.tier);
    for (const enemy of this.state.enemies) Object.assign(enemy, freshEnemyEffects());
    this.state.waves = [];
  }
  get formRemaining() { return Math.max(0, this.practiceTime - (this.state.time + this.state.bossTime - this.state.formStartedAt)); }
  get holdingXp() { return TIER_LEVELS.includes(this.state.level + 1) && this.state.xp >= this.xpNeeded && this.formRemaining > .001; }
  random() {
    let t = this.state.rng += 0x6d2b79f5;
    this.state.rng >>>= 0;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  private lootRandom() {
    let t = this.state.lootRng += 0x6d2b79f5; this.state.lootRng >>>= 0;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  spawnEnemy(kind: EnemyKind, x: number, y: number, cue = 0) {
    const s = this.state, c = ENEMIES[kind], minute = s.time / 60;
    const difficulty = lateGameDifficulty(s.level);
    let hp = c.hp * (kind === 'boss' || kind === 'elite' ? 1 : 1 + (kind === 'armor' ? .17 : .12) * minute + .025 * Math.max(0, minute - 4) ** 2);
    if (kind === 'elite') hp = [420, 1000, 1800, 2800][Math.max(0, Math.min(3, s.eliteIndex - 1))];
    // Apply level pressure once at birth. Existing enemies and restored saves keep their own stats.
    if(!s.classicTiming)hp*=kind==='boss'?.5:kind==='elite'?.65:.8;
    hp *= kind === 'boss' ? difficulty.bossHealth : kind === 'elite' ? difficulty.eliteHealth : difficulty.enemyHealth;
    const e: Enemy = { id: s.nextId++, kind, x, y, hp, maxHp: hp, radius: c.radius, speed: c.speed * difficulty.speed, damage: c.damage, xp: c.xp, hit: 0, spawn: cue, age: 0, cooldown: 1.6 + this.random(), action: 'idle', timer: 0, angle: 0, move: 0, targetX: 0, targetY: 0, knockX: 0, knockY: 0, reveal: 0, ...freshEnemyEffects() };
    s.enemies.push(e); return e;
  }
  grantXp(value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    const s = this.state; value *= s.economy ? 1 : 1 + .06 * s.relics.star; s.totalXp += value; s.xp += value;
    this.processXp();
  }
  private processXp() {
    const s = this.state;
    while (s.level < MAX_LEVEL && s.xp >= this.xpNeeded) {
      const evolves = TIER_LEVELS.includes(s.level + 1);
      if (evolves && this.formRemaining > .0001) break;
      s.xp -= this.xpNeeded; s.level++;
      s.maxHp+=2;this.heal(evolves?EVOLUTION_HEAL+2:2);
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
      if(evolves)this.events.push({type:'evolve',tier:this.tier,amount:this.mastery});
    }
    if (s.level === MAX_LEVEL) s.xp = 0;
    this.convertSpentDrops();
  }
  get availableRelics() {
    return this.state.economy ? [] : dropCandidates(this.state.relics,this.state.level,this.stats.range);
  }
  addRelicDrop(relic:RelicId,x:number,y:number,group?:number) {
    if(this.state.economy||!isRelicId(relic)||!Number.isFinite(x)||!Number.isFinite(y))return;
    const s=this.state,drop:RelicDrop={id:s.nextId++,x,y,relic,spawn:.28,...(group?{group}:{})};
    s.relicDrops.push(drop);s.relicLoot.totalDropped++;
    this.events.push({type:'item-drop',x,y,relicId:relic});return drop;
  }
  private tryRelicReward(e:Enemy) {
    const s=this.state,l=s.relicLoot,pool=this.availableRelics;
    if(!pool.length)return;
    const elite=e.kind==='elite',now=s.time+s.bossTime;
    if(!elite){
      const gap=now-l.lastNormal;
      const first=l.normalDrops===0,min=first?20:45*(this.duration/360),pity=first?30:65*(this.duration/360);
      if(gap<min||gap<pity&&relicRandom(l)>=.06)return;
    }
    const id=drawRelic(l,pool,s.relics,s.level,elite);if(!id)return;
    this.addRelicDrop(id,e.x,e.y);
    if(!elite){l.lastNormal=now;l.normalDrops++;}
  }
  pickupRelic(dropId:number) {
    const s=this.state,d=s.relicDrops.find(d=>d.id===dropId);
    if(s.economy||s.mode!=='playing'||!d||d.spawn>0||Math.hypot(d.x-s.player.x,d.y-s.player.y)>22)return false;
    s.relicDrops=s.relicDrops.filter(other=>other.id!==d.id&&(!d.group||other.group!==d.group));
    s.relicLoot.picked++;
    if(!this.availableRelics.includes(d.relic)){
      s.orbs.push({id:d.id,x:d.x,y:d.y,kind:'xp',value:10,dropTimer:XP_DROP_TIME});
      this.events.push({type:'item-pickup',relicId:d.relic,rank:s.relics[d.relic],lootKind:'overflow',x:d.x,y:d.y});return true;
    }
    const id=d.relic,before=relicGroups(s.relics),old=s.relics[id];
    if(!old)s.relicLoot.order=[...this.relicOrder,id];
    s.relics[id]++;
    s.relicState.lightning=Math.min(s.relicState.lightning,Math.max(0,6-s.relics.thunder));
    if(id==='heart'){s.maxHp+=15*Math.max(0,s.relics.heart-s.relicState.heartPeak);s.relicState.heartPeak=Math.max(s.relicState.heartPeak,s.relics.heart);this.heal(15);}
    if(before.spirit<3&&relicGroups(s.relics).spirit>=3){s.relicState.shield=true;s.relicState.shieldCooldown=0;this.events.push({type:'relic',item:'shield',x:s.player.x,y:s.player.y,detail:'ready'});}
    this.events.push({type:'item-pickup',relicId:id,rank:s.relics[id],lootKind:old?'upgrade':'gain',x:d.x,y:d.y});
    this.convertSpentDrops();return true;
  }
  private convertSpentDrops() {
    if (this.state.economy) return;
    const s=this.state,pool=this.availableRelics;
    s.relicDrops=s.relicDrops.filter(d=>{if(d.group||pool.includes(d.relic))return true;s.orbs.push({id:d.id,x:d.x,y:d.y,kind:'xp',value:10,dropTimer:XP_DROP_TIME});return false;});
  }
  private updateRelicDrops(dt:number) {
    if (this.state.economy) return;
    const s=this.state;
    for(const d of s.relicDrops)d.spawn=Math.max(0,d.spawn-dt);
    for(const d of [...s.relicDrops])if(d.spawn<=0&&Math.hypot(d.x-s.player.x,d.y-s.player.y)<=22)this.pickupRelic(d.id);
  }
  private heal(value: number) {
    const s = this.state, before=s.hp;
    s.hp = Math.min(s.maxHp, s.hp + value * (relicGroups(s.relics).spirit >= 2 ? 1.2 : 1) * (1-.12*s.relics.redmoon));
    return s.hp-before;
  }
  private get elementalBonus() {
    const items=this.state.relics,groups=relicGroups(items);
    return (1+.15*items.prism)*(groups.chaos>=2?1.2:1);
  }
  private mirrorCounter() {
    const s=this.state;if(s.relics.mirror)this.createWave(s.aim,Math.round(this.stats.damage*.35*s.relics.mirror),180,3+s.relics.mirror);
  }
  private updateRelics(dt: number) {
    if (this.state.economy) return;
    const s = this.state, p = s.relicState;
    p.leechCooldown=Math.max(0,p.leechCooldown-dt);
    if (relicGroups(s.relics).spirit >= 3 && !p.shield) {
      p.shieldCooldown = Math.max(0, p.shieldCooldown - dt);
      if (p.shieldCooldown <= .000001) {
        p.shield = true; p.shieldCooldown = 0;
        this.events.push({ type: 'relic', item: 'shield', x: s.player.x, y: s.player.y, detail: 'ready' });
      }
    }
  }
  private relicHit(e: Enemy) {
    if (this.state.economy) return;
    const s = this.state, items = s.relics, bonus = (relicGroups(items).arcane >= 2 ? 1.2 : 1) * this.elementalBonus;
    if (items.ember) {
      if (e.burnTime <= 0) e.burnTick = .5;
      e.burnTime = Math.max(e.burnTime, 2);
      e.burnDamage = Math.max(e.burnDamage, Math.max(1, Math.round(this.stats.damage * .04 * items.ember * bonus)));
    }
    if(items.venom) {
      if(e.poisonTime<=0)e.poisonTick=.5;
      e.poisonTime=2.5;
      e.poisonDamage=Math.max(1,Math.round(this.stats.damage*.03*items.venom*bonus*(e.kind==='boss'||e.kind==='elite'?1.25:1)));
    }
    if (items.crystal) {
      const slow = Math.min(e.kind === 'boss' || e.kind === 'elite' ? .15 : 1, .12 + .04 * items.crystal);
      // A weak item slow must not indefinitely refresh a stronger innate effect.
      if (slow >= e.slow) { e.slow = slow; e.slowTime = Math.max(e.slowTime, 1.2); }
    }
  }
  private relicStrike(origin: Point) {
    if (this.state.economy) return;
    const s = this.state, rank = s.relics.thunder;
    const items=s.relics,r=s.relicState,damage=this.stats.damage;
    if(items.echo && ++r.echo>=5){r.echo=0;this.createWave(s.aim,Math.round(damage*(.30+.15*items.echo)),this.stats.range,2+items.echo);}
    if(items.comet && ++r.comet>=4){r.comet=0;for(const spread of [-.3,0,.3])this.createWave(s.aim+spread,Math.round(damage*(.20+.15*items.comet)),150+10*items.comet,2+items.comet,'moon');}
    if(items.blackhole && ++r.vortex>=8){
      r.vortex=0;const radius=Math.min(360,this.stats.range*.9+10*items.blackhole);
      this.events.push({type:'relic',item:'vortex',x:s.player.x,y:s.player.y,radius});
      for(const e of this.grid.query(s.player.x,s.player.y,radius+45)) {
        const dx=s.player.x-e.x,dy=s.player.y-e.y,d=Math.hypot(dx,dy);
        if(e.hp<=0||e.spawn>0||d>radius+e.radius)continue;
        const pull=Math.max(0,Math.min(50,d-60))*(e.kind==='boss'?0:e.kind==='elite'?.25:1);
        e.x+=dx/(d||1)*pull;e.y+=dy/(d||1)*pull;
        this.hitEnemy(e,Math.round(damage*.15*items.blackhole),0,'relic');
      }
      this.grid.rebuild(s.enemies);
    }
    if (!rank) return;
    if (++s.relicState.lightning < 7 - rank) return;
    s.relicState.lightning = 0;
    const lightningDamage = Math.round(this.stats.damage * this.elementalBonus * (.55 + .15 * rank) * (relicGroups(s.relics).arcane >= 2 ? 1.2 : 1));
    const hit = new Set<number>(); let from = origin;
    for (let hop = 0; hop < 3 && s.mode === 'playing'; hop++) {
      const target = this.grid.query(from.x, from.y, 185).filter(e => e.hp > 0 && e.spawn <= 0 && !hit.has(e.id) && Math.hypot(e.x - from.x, e.y - from.y) <= 140 + e.radius)
        .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y) || a.id - b.id)[0];
      if (!target) break;
      hit.add(target.id);
      this.events.push({ type: 'relic', item: 'thunder', x: from.x, y: from.y, toX: target.x, toY: target.y });
      this.hitEnemy(target, lightningDamage, 0, 'relic'); from = { x: target.x, y: target.y };
    }
  }
  damagePlayer(amount: number, reason: string) {
    const s = this.state;
    if (s.invincible > 0 || s.mode !== 'playing') return false;
    if (s.relicState.shield && relicGroups(s.relics).spirit >= 3) {
      s.relicState.shield = false; s.relicState.shieldCooldown = 20; s.invincible = .35;
      this.events.push({ type: 'relic', item: 'shield', x: s.player.x, y: s.player.y, detail: 'break' }); this.mirrorCounter(); return false;
    }
    if (this.bladeId === 'wado' && s.passive.shield) {
      s.passive.shield = false; s.passive.cooldown = this.rules.guardCooldown; s.passive.safeTime = 0; s.invincible = .35;
      if (this.rules.guardCounter) {
        const radius = this.passiveSize.guardCounterRadius;
        for (const e of s.enemies) if (Math.hypot(e.x - s.player.x, e.y - s.player.y) <= radius + e.radius) this.hitEnemy(e, Math.round(this.stats.damage * this.rules.guardCounter), Math.atan2(e.y - s.player.y, e.x - s.player.x), 'passive');
      }
      this.emitPassive('wado', s.player.x, s.player.y, this.rules.guardCounter ? this.passiveSize.guardCounterRadius : this.passiveSize.guardRadius, 'break'); this.mirrorCounter(); return false;
    }
    amount *= (1-this.stats.damageReduction) * (s.hp<s.maxHp*.5?1+.08*s.relics.overdrive:1);
    s.hp = Math.max(0, s.hp - amount); s.invincible = .65;
    s.passive.safeTime = 0;
    if (s.bossStarted) s.bossHits++;
    this.events.push({ type: 'hurt', x: s.player.x, y: s.player.y, amount });
    this.mirrorCounter();
    if(s.hp<=0 && s.relics.phoenix && !s.relicState.phoenixUsed){
      s.relicState.phoenixUsed=true;this.heal(s.maxHp*(.2+.1*s.relics.phoenix));s.invincible=2;
      this.events.push({type:'relic',item:'phoenix',x:s.player.x,y:s.player.y,radius:70});
    }
    if (s.hp <= 0) { s.mode = 'dead'; s.failure = reason; }
    return true;
  }
  dash() {
    const s = this.state;
    if (s.mode !== 'playing' || s.dashCooldown > 0) return false;
    this.syncPassive();
    s.dashTime = .18; s.dashCooldown = this.stats.dashCooldown; s.invincible = Math.max(s.invincible, .12+.015*s.relics.boots); s.relicState.dashWave=s.relics.fan>0;
    if (this.bladeId === 'dark-dagger') { s.passive.empowered = this.rules.daggerTime; this.emitPassive('dark-dagger'); }
    if (this.bladeId === 'tensa') s.passive.tensaPending = true;
    this.events.push({ type: 'dash', x: s.player.x, y: s.player.y }); return true;
  }
  private emitPassive(skill: BladeId, x = this.state.player.x, y = this.state.player.y, radius = this.passiveSize.pulseRadius, detail?: 'ready' | 'break') {
    if (this.passiveFxCount++ >= 8) return;
    this.events.push({ type: 'passive', skill, x, y, radius, size: this.passiveSize.scale, detail, tier: this.tier });
  }
  private createWave(angle: number, damage: number, maxRange: number, pierce: number, kind: Wave['kind'] = 'basic', source?:'active', visualScale=1, boomerang=false) {
    const s = this.state;
    if (s.waves.length >= 32) return;
    // Freeze dimensions at release so a later upgrade cannot resize an airborne wave.
    const size = this.passiveSize, shape = waveDimensions({ kind }, this.mastery, Math.min(6,size.scale*visualScale));
    s.waves.push({ id: s.nextId++, x: s.player.x, y: s.player.y, angle, distance: 0,
      maxRange: Math.min(PASSIVE_SIZE_LIMITS.travel, maxRange * size.travelScale * (1+.12*s.relics.scope)), damage, pierce:Math.min(24,pierce+s.relics.scope), hit: [], tier: this.tier, kind,
      radius: shape.radius, hitRadius: shape.hitRadius, ...(source?{source}:{}),...(boomerang?{boomerang:true,returning:false}:{}) });
  }
  private updatePassive(dt: number) {
    const p = this.state.passive;
    p.empowered = Math.max(0, p.empowered - dt); p.cooldown = Math.max(0, p.cooldown - dt); p.haste = Math.max(0, p.haste - dt);
    if (this.bladeId === 'wado') {
      p.safeTime = Math.min(this.rules.guardSafe, p.safeTime + dt);
      if (!p.shield && p.cooldown <= .0001 && p.safeTime >= this.rules.guardSafe - .0001) {
        p.shield = true; this.emitPassive('wado', this.state.player.x, this.state.player.y, this.passiveSize.guardRadius, 'ready');
      }
    }
  }
  private ignite(e: Enemy, damage: number) {
    if (e.hp <= 0 || e.spawn > 0) return;
    if (e.burnTime <= 0) e.burnTick = .5;
    e.burnTime = this.rules.burnTime; e.burnDamage = Math.max(e.burnDamage, damage);
  }
  private passiveHit(e: Enemy, source: 'melee' | 'wave' | 'passive' | 'burn' | 'poison' | 'relic' | 'active') {
    if (source !== 'melee' && source !== 'wave' && source!=='active') return;
    const id = this.bladeId;
    if (id === 'deer-cutter' && source === 'melee') e.hunt = this.rules.huntTime;
    if (id === 'snow-drinker') {
      e.chill = this.rules.chillTime; e.chillStacks = Math.min(3, e.chillStacks + 1);
      if (e.chillStacks >= this.rules.freezeStacks && e.kind !== 'boss' && e.kind !== 'elite' && e.freezeCooldown <= 0) {
        e.freeze = this.rules.freezeTime; e.freezeCooldown = 4; this.emitPassive(id, e.x, e.y, e.radius + 12 * this.passiveSize.scale);
      }
    }
    if (id === 'ryujin') this.ignite(e, Math.max(1, Math.round(this.stats.damage * this.rules.burnTickDamage * this.elementalBonus)));
  }
  private hitEnemy(e: Enemy, amount: number, angle: number, source: 'melee' | 'wave' | 'passive' | 'burn' | 'poison' | 'relic' | 'active' = 'melee') {
    if (e.hp <= 0 || e.spawn > 0) return false;
    const direct=source==='melee'||source==='wave'||source==='active', items=this.state.relics;
    let critical=false;
    if(direct){
      if(items.execution && e.hp/e.maxHp<(e.kind==='boss'||e.kind==='elite'?.1:.2))amount*=1+.12*items.execution*(e.kind==='boss'||e.kind==='elite'?.5:1);
      if(this.stats.critChance>0 && this.random()<this.stats.critChance){amount*=this.stats.critMultiplier;critical=true;}
    }
    if (direct && relicGroups(items).arcane >= 3 && (e.poisonTime>0 || e.burnTime > 0 || e.slowTime > 0 || e.chill > 0 || e.freeze > 0 || e.stun > 0)) amount = Math.round(amount * 1.1);
    this.passiveHit(e, source);
    if (direct) this.relicHit(e);
    amount=Math.max(1,Math.round(amount));
    const s = this.state;
    if(source==='active'&&this.bladeId==='shusui'&&(e.kind==='boss'||e.kind==='elite'))amount=Math.round(amount*1.5);
    e.hp -= amount; e.hit = .15; e.reveal = .85;
    const resistance = e.kind === 'boss' ? 0 : e.kind === 'elite' ? .25 : 1;
    if (source !== 'burn' && source !== 'poison' && source !== 'relic') {
      e.knockX += Math.cos(angle) * this.stats.knockback * 16 * resistance;
      e.knockY += Math.sin(angle) * this.stats.knockback * 16 * resistance;
    }
    this.events.push({ type: 'hit', x: e.x, y: e.y, amount, elite: e.kind === 'elite' || e.kind === 'boss', enemyKind: e.kind, enemyId:e.id, lethal: e.hp <= 0, source, critical });
    if (e.hp > 0) return false;
    this.events.push({ type: 'kill', enemyKind:e.kind, enemyId:e.id, source, x: e.x, y: e.y, tier: this.tier, elite: e.kind === 'elite' || e.kind === 'boss' });
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
      const radius = this.passiveSize.burnSpread;
      for (const other of this.grid.query(e.x, e.y, radius + 45)) if (other.id !== e.id && Math.hypot(other.x - e.x, other.y - e.y) <= radius + other.radius) this.ignite(other, Math.max(1, Math.round(e.burnDamage * .65)));
      this.emitPassive('ryujin', e.x, e.y, radius);
    }
    if (s.economy) this.addOrb(e.x, e.y, COIN_VALUES[e.kind], 'coin');
    if (e.kind === 'boss') { s.mode = 'won'; this.events.push({ type: 'win' }); return true; }
    this.tryRelicReward(e);
    if (e.kind === 'elite') { s.eliteKills++; this.addOrb(e.x + 12, e.y, 16, 'heal','bread'); }
    else {
      s.kills++;
      if(this.lootRandom()<.05+.02*items.food){const food=foodForRoll(this.lootRandom());this.addOrb(e.x,e.y,FOODS[food].heal,'heal',food);}
    }
    if(items.leech && s.relicState.leechCooldown<=0){this.heal(.4*items.leech);s.relicState.leechCooldown=.5;}
    if(relicGroups(items).hunt>=3)s.attackTimer=Math.max(0,s.attackTimer-.04);
    if (e.kind === 'splitter') {
      let slots = encounterDensity(s.time, this.simplified, s.level,this.duration).cap - s.enemies.filter(other => other.hp > 0).length;
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
    const targets = this.grid.query(s.player.x, s.player.y, stats.range + 45).filter(e => e.hp > 0 && e.spawn <= 0 && (id === 'spear' ? thrustHits(e.x - s.player.x, e.y - s.player.y, e.radius, angle, stats.range, stats.thrustWidth) : sectorHits(e.x - s.player.x, e.y - s.player.y, e.radius, angle, stats.range, stats.arc)));
    if (!targets.length) return 0;
    const rules = this.rules;
    const cycle = id === 'well-moon' ? rules.moonCycle : id === 'full-moon' ? rules.ringCycle : id === 'enma' ? rules.enmaCycle : 0;
    if (cycle) p.hits = (p.hits + 1) % cycle;
    let multiplier = id === 'scrap' ? 1 + rules.scrapBonus * p.stacks : id === 'dark-dagger' && p.empowered > 0 ? 1 + rules.daggerBonus : 1;
    let spent = 0, cleave = 0;
    if (id === 'enma' && p.hits === 0) {
      spent = s.hp > s.maxHp * .35 ? rules.enmaCost : 0; s.hp -= spent;
      multiplier = 1 + (spent ? rules.enmaPaidBonus : rules.enmaBonus); this.emitPassive(id, s.player.x, s.player.y, this.passiveSize.meleeRadius);
    }
    for (const e of targets) {
      let damage = stats.damage * multiplier;
      if (id === 'dark-dagger' && e.kind === 'armor') damage *= 1 + rules.armorBonus;
      if (id === 'deer-cutter' && e.hunt > 0) damage *= 1 + rules.huntBonus;
      if (id === 'shusui') {
        e.dragonHits = (e.dragonHits + 1) % rules.dragonCycle;
        if (e.dragonHits === 0) { damage += stats.damage * rules.dragonBonus * (e.kind === 'boss' || e.kind === 'elite' ? 2 : 1); this.emitPassive(id, e.x, e.y, e.radius + 24 * this.passiveSize.scale); }
      }
      if (this.hitEnemy(e, Math.round(damage), angle)) cleave++;
    }
    if (id === 'dark-dagger' && p.empowered > 0) { p.empowered = 0; this.emitPassive(id, s.player.x, s.player.y, this.passiveSize.meleeRadius); }
    if (spent && cleave) s.hp = Math.min(s.maxHp, s.hp + spent);
    if (id === 'well-moon' && p.hits === 0) {
      const spreads = rules.moonCount === 5 ? [-.6, -.3, 0, .3, .6] : [-.36, 0, .36];
      for (const spread of spreads) this.createWave(angle + spread, Math.round(stats.damage * rules.moonDamage), rules.moonRange, rules.moonPierce, 'moon');
      this.emitPassive(id, s.player.x, s.player.y, this.passiveSize.meleeRadius);
    }
    if (id === 'full-moon' && p.hits === 0) {
      const radius = this.passiveSize.ringRadius;
      for (const e of this.grid.query(s.player.x, s.player.y, radius + 45)) if (Math.hypot(e.x - s.player.x, e.y - s.player.y) <= radius + e.radius) this.hitEnemy(e, Math.round(stats.damage * rules.ringDamage), Math.atan2(e.y - s.player.y, e.x - s.player.x), 'passive');
      this.emitPassive(id, s.player.x, s.player.y, radius);
    }
    if (id === 'dragon-slayer' && p.cooldown <= 0) {
      const radius = this.passiveSize.roarRadius; p.cooldown = rules.roarCooldown;
      for (const e of this.grid.query(s.player.x, s.player.y, radius + 45)) if (e.hp > 0 && e.spawn <= 0 && Math.hypot(e.x - s.player.x, e.y - s.player.y) <= radius + e.radius) {
        if (e.kind === 'boss' || e.kind === 'elite') { e.slow = rules.roarSlow; e.slowTime = 1.2; }
        else e.stun = rules.roarStun;
        const a = Math.atan2(e.y - s.player.y, e.x - s.player.x), resistance = e.kind === 'boss' ? 0 : e.kind === 'elite' ? .25 : 1;
        e.knockX += Math.cos(a) * 450 * resistance; e.knockY += Math.sin(a) * 450 * resistance;
        if (rules.roarDamage) this.hitEnemy(e, Math.round(stats.damage * rules.roarDamage), a, 'passive');
      }
      this.emitPassive(id, s.player.x, s.player.y, radius);
    }
    this.relicStrike(targets[0]);
    return cleave;
  }
  addOrb(x: number, y: number, value: number, kind: 'xp' | 'heal' | 'coin', food?:FoodId) {
    if (!Number.isFinite(value) || value <= 0) return;
    // Every reward keeps its own world position and identity. Never merge or credit remotely.
    const s = this.state; s.orbs.push({ id: s.nextId++, x, y, value, kind, ...(food?{food}:{}), dropTimer: XP_DROP_TIME });
  }
  private spawnOutside(kind?: EnemyKind) {
    const s = this.state, angle = this.random() * Math.PI * 2;
    const distance = 1 / Math.max(Math.abs(Math.cos(angle)) / (this.view.width / 2 + 55), Math.abs(Math.sin(angle)) / (this.view.height / 2 + 55));
    const x = s.player.x + Math.cos(angle) * distance;
    const y = s.player.y + Math.sin(angle) * distance;
    if (!kind) {
      const counts: Partial<Record<EnemyKind, number>> = {};
      for (const enemy of s.enemies) if (enemy.hp > 0) counts[enemy.kind] = (counts[enemy.kind] ?? 0) + 1;
      kind = encounterKind(s.time*600/this.duration, this.random(), counts);
    }
    this.spawnEnemy(kind, x, y);
  }
  private beginBoss() {
    const s = this.state;
    s.bossStarted = true; s.mode = s.economy ? 'playing' : 'boss-intro'; s.transition = s.economy ? 0 : 1; s.invincible = Math.max(s.invincible, 1); s.bullets = []; s.enemies = []; s.waves = []; s.shocks = []; s.swing = null;
    s.hazards = []; this.heal(15);
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
  private updatePoison(e:Enemy,dt:number) {
    if(e.poisonTime<=0)return;
    const poisonDt=Math.min(dt,e.poisonTime);e.poisonTime=Math.max(0,e.poisonTime-dt);if(e.poisonTime<.000001)e.poisonTime=0;e.poisonTick-=poisonDt;
    while(e.poisonTick<=.000001 && e.hp>0 && this.state.mode==='playing'){e.poisonTick+=.5;this.hitEnemy(e,e.poisonDamage,0,'poison');}
    if(e.poisonTime===0){e.poisonDamage=0;e.poisonTick=.5;}
  }
  private updateThreat(e: Enemy, dt: number, factor: number, dx: number, dy: number, distance: number) {
    const s = this.state; let moving = e.action === 'idle';
    if (e.action === 'windup') {
      e.timer -= dt;
      if (e.timer <= 0) {
        if (e.kind === 'poison') {
          const hazards = s.hazards ??= [];
          if (hazards.length < (this.simplified ? 8 : 12) && hazards.filter(h => h.kind === 'poison').length < (this.simplified ? 4 : 6)) hazards.push({ id: s.nextId++, kind: 'poison', x: e.targetX, y: e.targetY, radius: 56, age: 0, duration: 3.2, damage: 3 });
          e.action = 'idle'; e.cooldown = 6.2;
        } else if (e.kind === 'bomber') {
          e.hp = 0; const hazards = s.hazards ??= [];
          if (hazards.length < (this.simplified ? 8 : 12)) hazards.push({ id: s.nextId++, kind: 'blast', x: e.x, y: e.y, radius: 72, age: 0, duration: .28, damage: 0 });
          if (distance <= 72) this.damagePlayer(18, '未能离开爆燃球的爆炸范围');
          this.addOrb(e.x, e.y, e.xp, 'xp'); this.events.push({ type: 'blast', x: e.x, y: e.y }); return;
        } else { e.action = 'charge'; e.timer = .42; }
      }
    } else if (e.action === 'charge') {
      e.x += Math.cos(e.angle) * 260 * dt * factor; e.y += Math.sin(e.angle) * 260 * dt * factor;
      e.timer -= dt;
      if (Math.hypot(e.x - s.player.x, e.y - s.player.y) < e.radius + 16) this.damagePlayer(11, '未能躲过隐纹幽球的锁向突刺');
      if (e.timer <= 0) { e.action = 'recover'; e.timer = 1.15; }
    } else if (e.action === 'recover') {
      e.timer -= dt; if (e.timer <= 0) { e.action = 'idle'; e.cooldown = 3.5; }
    } else if (e.cooldown <= 0 && distance < (e.kind === 'poison' ? 240 : e.kind === 'bomber' ? 96 : 125)) {
      e.action = 'windup'; moving = false;
      e.timer = e.kind === 'poison' ? .85 : e.kind === 'bomber' ? 1.1 : .8;
      e.targetX = s.player.x; e.targetY = s.player.y; e.angle = Math.atan2(dy, dx);
    }
    if (moving) { e.x += dx / distance * e.speed * dt * factor; e.y += dy / distance * e.speed * dt * factor; }
    e.x += e.knockX * dt; e.y += e.knockY * dt; e.knockX *= Math.exp(-16 * dt); e.knockY *= Math.exp(-16 * dt);
    if (e.kind === 'poison' && Math.hypot(e.x - s.player.x, e.y - s.player.y) < e.radius + 16) this.damagePlayer(e.damage, '被毒气泡团贴近');
  }
  private updateHazards(dt: number) {
    const s = this.state; if (!s.hazards) return;
    for (const hazard of s.hazards) {
      hazard.age += dt;
      if (hazard.kind === 'poison' && hazard.age < hazard.duration && Math.hypot(hazard.x - s.player.x, hazard.y - s.player.y) <= hazard.radius) this.damagePlayer(hazard.damage, '停留在毒气区域中');
    }
    s.hazards = s.hazards.filter(h => h.age < h.duration);
  }
  private updateEnemy(e: Enemy, dt: number, effectsDt=dt) {
    const s = this.state;
    e.hit = Math.max(0, e.hit - dt); e.reveal = Math.max(0, (e.reveal ?? 0) - dt); e.age += dt;
    if (e.spawn > 0) { e.spawn = Math.max(0, e.spawn - dt); return; }
    this.updateEnemyEffects(e, effectsDt);
    if (e.hp <= 0 || s.mode !== 'playing') return;
    if (e.freeze > 0 || e.stun > 0) {
      e.x += e.knockX * dt; e.y += e.knockY * dt; e.knockX *= Math.exp(-16 * dt); e.knockY *= Math.exp(-16 * dt); return;
    }
    const slow = Math.max(e.slowTime > 0 ? e.slow : 0, e.chill > 0 ? Math.min(e.kind === 'boss' || e.kind === 'elite' ? .15 : .65, (this.bladeId==='frost-bow'?.2+.02*this.mastery:e.chillStacks * this.rules.chillSlow)) : 0);
    const moveFactor = 1 - slow;
    const dx = s.player.x - e.x, dy = s.player.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.cooldown -= dt;
    if (e.kind === 'poison' || e.kind === 'bomber' || e.kind === 'stalker') { this.updateThreat(e, dt, moveFactor, dx, dy, d); return; }
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
    if (s.mode === 'won' || s.mode === 'dead' || s.mode === 'relic' || s.mode === 'relic-trim') return;
    this.syncPassive();
    if (s.mode === 'evolving') { s.evolutionTime -= dt; if (s.evolutionTime <= 0) s.mode = 'relic'; return; }
    if (s.mode === 'boss-intro') {
      s.transition -= dt;
      if (s.transition <= 0) { s.mode = 'playing'; s.invincible = 1;  }
      return;
    }
    if (s.bossStarted) { s.bossTime = Math.min(this.bossDuration, s.bossTime + dt); if (s.bossTime >= this.bossDuration) { s.mode = 'dead'; s.failure = '首领战时间耗尽'; return; } }
    else { s.time = Math.min(this.duration, s.time + dt); if (s.time >= this.duration) { this.beginBoss(); return; } }
    this.processXp();
    s.invincible = Math.max(0, s.invincible - dt); s.dashCooldown = Math.max(0, s.dashCooldown - dt);
    this.updateGear(dt); this.updatePassive(dt); this.updateRelics(dt); this.updateActive(dt);
    if(s.mode!=='playing')return;
    if(input.active)this.activateSkill();
    if(s.mode!=='playing')return;
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
      if(s.dashTime<=.000001 && s.relicState.dashWave){s.relicState.dashWave=false;this.createWave(Math.atan2(s.direction.y,s.direction.x),Math.round(stats.damage*(.25+.15*s.relics.fan)),170+25*s.relics.fan,3+s.relics.fan);}
      if (s.dashTime <= .000001 && s.passive.tensaPending && this.bladeId === 'tensa') {
        s.passive.tensaPending = false; s.passive.haste = this.rules.hasteTime;
        this.createWave(Math.atan2(s.direction.y, s.direction.x), Math.round(stats.damage * this.rules.getsugaDamage), this.rules.getsugaRange, this.rules.getsugaPierce, 'getsuga');
        this.emitPassive('tensa', s.player.x, s.player.y, 44 * this.passiveSize.scale);
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
      const { cap, rate: intensity } = encounterDensity(s.time, this.simplified, s.level,this.duration);
      s.spawnBudget = Math.min(intensity * 3, s.spawnBudget + dt * intensity);
      while (s.spawnBudget >= 1 && s.enemies.length < cap) { s.spawnBudget--; this.spawnOutside(); }
      if (s.eliteIndex < 4 && s.time >= (s.eliteIndex + 1) * this.duration/5) {
        s.eliteIndex++;
        if (s.enemies.length >= cap) s.enemies.splice(s.enemies.findIndex(e => e.kind !== 'elite'), 1);
        this.spawnOutside('elite');
      }
    }
    this.grid.rebuild(s.enemies);
    for (const e of s.enemies) if (e.hp > 0 && s.mode === 'playing') { this.updatePoison(e,dt); if(e.hp>0)this.updateEnemy(e, dt*(this.bladeId==='tensa'&&this.active.buff>0?(e.kind==='boss'||e.kind==='elite'?.7:.4):1),dt); }
    if (s.mode !== 'playing') return;
    this.grid.rebuild(s.enemies);
    s.attackTimer -= dt;
    if (s.swing) {
      s.swing.age += dt;
      if (this.bladeId === 'spear' && !s.swing.resolved) {
        const target = s.enemies.find(e => e.id === s.targetId && e.hp > 0 && e.spawn <= 0 && Math.hypot(e.x - s.player.x, e.y - s.player.y) <= stats.range + e.radius);
        if (target) s.aim = s.swing.angle = Math.atan2(target.y - s.player.y, target.x - s.player.x);
      }
      if(!this.isRanged && s.swing.age >= s.swing.windup && s.swing.age-dt < s.swing.windup) this.events.push({type:'slash',x:s.player.x,y:s.player.y,tier:this.tier});
      if (s.swing.age >= s.swing.windup + s.swing.strike * .45 && !s.swing.resolved) {
        s.swing.resolved = true;
        let cleave=0;
        if(this.isRanged){
          const target=s.enemies.find(e=>e.id===s.targetId&&e.hp>0&&e.spawn<=0&&this.targetOnScreen(e)&&Math.hypot(e.x-s.player.x,e.y-s.player.y)<=stats.range+e.radius);
          if(target)s.swing.angle=Math.atan2(target.y-s.player.y,target.x-s.player.x);
          s.aim=s.swing.angle;shootBow(this.bowHost(),s.aim);
        }else cleave=this.resolveMelee(s.swing.angle);
        s.bestCleave = Math.max(s.bestCleave, cleave);
        s.attackCount++;
        if (stats.waveEvery && s.attackCount % stats.waveEvery === 0) this.createWave(s.swing.angle, Math.round(stats.damage * .6), stats.waveRange, stats.pierce);
      }
      if (s.swing.age > s.swing.windup + s.swing.strike + s.swing.recovery) s.swing = null;
    }
    if (s.attackTimer <= 0 && !s.swing) {
      const targets = this.grid.query(s.player.x, s.player.y, stats.range + 45).filter(e => e.hp > 0 && e.spawn <= 0 && this.targetOnScreen(e) && Math.hypot(e.x - s.player.x, e.y - s.player.y) <= stats.range + e.radius);
      targets.sort((a, b) => Math.hypot(a.x - s.player.x, a.y - s.player.y) - Math.hypot(b.x - s.player.x, b.y - s.player.y) || a.id - b.id);
      let target = targets[0]; const existing = targets.find(e => e.id === s.targetId);
      if (existing && target && Math.hypot(existing.x - s.player.x, existing.y - s.player.y) < Math.hypot(target.x - s.player.x, target.y - s.player.y) * 1.25) target = existing;
      if (target) {
        s.targetId = target.id; s.aim = Math.atan2(target.y - s.player.y, target.x - s.player.x); s.attackTimer = stats.interval;
        s.swing = { id: s.nextId++, angle: s.aim, age: 0, resolved: false, tier: this.tier, windup: stats.windup, strike: stats.strike, recovery: stats.recovery };
      }
    }
    if(this.isRanged)stepArchery(this.bowHost(),dt);
    if(s.mode!=='playing')return;
    for (const wave of s.waves) {
      if(wave.returning)wave.angle=Math.atan2(s.player.y-wave.y,s.player.x-wave.x);
      const ox = wave.x, oy = wave.y, length = Math.min(420 * dt, wave.returning?Math.hypot(s.player.x-wave.x,s.player.y-wave.y):wave.maxRange - wave.distance);
      wave.x += Math.cos(wave.angle) * length; wave.y += Math.sin(wave.angle) * length; wave.distance += length;
      const hitRadius = waveDimensions(wave, this.mastery).hitRadius;
      const candidates = this.grid.query(wave.x, wave.y, length + 45 + hitRadius).filter(e => e.hp > 0 && e.spawn <= 0 && !wave.hit.includes(e.id));
      candidates.sort((a, b) => Math.hypot(a.x - ox, a.y - oy) - Math.hypot(b.x - ox, b.y - oy));
      for (const e of candidates) {
        if (wave.hit.length >= wave.pierce) break;
        const tAlong = Math.max(0, Math.min(1, ((e.x - ox) * (wave.x - ox) + (e.y - oy) * (wave.y - oy)) / Math.max(.001, length * length)));
        if (Math.hypot(e.x - ox - (wave.x - ox) * tAlong, e.y - oy - (wave.y - oy) * tAlong) < e.radius + hitRadius) {
          wave.hit.push(e.id); this.hitEnemy(e, wave.damage, wave.angle, wave.source??'wave');
        }
      }
    }
    s.waves = s.waves.filter(w => {
      if(w.boomerang){
        if(!w.returning&&(w.distance>=w.maxRange||w.hit.length>=w.pierce)){w.returning=true;w.distance=0;w.hit=[];return true;}
        if(w.returning)return Math.hypot(w.x-s.player.x,w.y-s.player.y)>18&&w.distance<w.maxRange*2&&w.hit.length<w.pierce;
      }
      return w.distance<w.maxRange&&w.hit.length<w.pierce;
    });
    const hostileDt=dt*(this.bladeId==='tensa'&&this.active.buff>0?.4:1);
    for (const b of s.bullets) {
      b.x += b.vx * hostileDt; b.y += b.vy * hostileDt; b.life -= hostileDt;
      if (Math.hypot(b.x - s.player.x, b.y - s.player.y) < 22) { this.damagePlayer(b.damage ?? 12, b.kind === 'spine' ? '未能穿过针背刺团的尖刺间隙' : '未能躲过吐弹者的弹丸'); b.life = 0; }
    }
    s.bullets = s.bullets.filter(b => b.life > 0);
    for (const shock of s.shocks) {
      shock.radius += 220 * hostileDt;
      const d = Math.hypot(s.player.x - shock.x, s.player.y - shock.y), a = Math.atan2(s.player.y - shock.y, s.player.x - shock.x);
      if (Math.abs(d - shock.radius) < 25 && Math.abs(angleDelta(a, shock.gap)) > 35 * Math.PI / 180) this.damagePlayer(20, '被暴君的震荡波击中');
    }
    s.shocks = s.shocks.filter(a => a.radius <= 240);
    this.updateHazards(hostileDt);
    if (s.mode !== 'playing') return;
    this.updateRelicDrops(dt);
    let collected = false;
    for (const orb of s.orbs) {
      if(orb.kind==='heal' && s.hp>=s.maxHp)continue;
      if ((orb.dropTimer ?? 0) > 0) { orb.dropTimer = Math.max(0, orb.dropTimer! - dt); if (orb.dropTimer > 0) continue; }
      if (Math.abs(orb.x - s.player.x) > Math.max(100, stats.magnet) || Math.abs(orb.y - s.player.y) > Math.max(100, stats.magnet)) continue;
      const dx = s.player.x - orb.x, dy = s.player.y - orb.y, distance = Math.hypot(dx, dy);
      const pickupRange = orb.kind === 'coin' ? this.coinRange : stats.magnet;
      if (distance < pickupRange || orb.kind === 'heal' && distance < 100) {
        const amount = Math.min(distance, (270 + (stats.magnet - distance) * 4) * dt);
        orb.x += dx / (distance || 1) * amount; orb.y += dy / (distance || 1) * amount;
      }
      if (Math.hypot(s.player.x - orb.x, s.player.y - orb.y) < 18) {
        if (orb.kind === 'xp') { this.grantXp(orb.value); this.events.push({ type: 'pickup', x: orb.x, y: orb.y, amount: orb.value }); }
        else if (orb.kind === 'coin') {
          const economy = s.economy;
          if (!economy) continue;
          economy.wallet += orb.value; economy.earned += orb.value;
          this.events.push({type: 'coin', x: orb.x, y: orb.y, amount: orb.value});
        }
        else {const amount=this.heal(orb.value*(1+.1*s.relics.food));this.events.push({type:'pickup',x:orb.x,y:orb.y,amount,food:orb.food??'bread'});}
        orb.value = 0; collected = true;
      }
    }
    if (collected) s.orbs = s.orbs.filter(o => o.value > 0);
    const far = Math.hypot(this.view.width, this.view.height) + 400;
    s.enemies = s.enemies.filter(e => e.hp > 0 && (e.kind === 'boss' || e.kind === 'elite' || Math.hypot(e.x - s.player.x, e.y - s.player.y) < far));
    s.recentKills = s.recentKills.filter(t => t > s.time + s.bossTime - 10);
    s.maxCombo = Math.max(s.maxCombo, s.recentKills.length);

  }
  score() {
    const s = this.state;
    return s.totalXp + s.kills * 10 + s.eliteKills * 150 + (s.mode === 'won' ? 1000 + Math.floor(Math.max(0, this.bossDuration - s.bossTime)) * 10 : 0);
  }
  snapshot() { return structuredClone(this.state); }
}

function validateRun(value: unknown, legacy: 0|5|6|7 = 0): boolean {
  if (!value || typeof value !== 'object') return false;
  const s = value as RunState;
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (s.version !== (legacy || (s.economy ? 9 : 8)) || !Number.isInteger(s.blade) || s.blade < 0 || s.blade >= (legacy?12:TIERS.length) || typeof s.forgeAwakening !== 'boolean' || typeof s.id !== 'string' || !(legacy?['playing','evolving',legacy===5?'forge':'relic','boss-intro',...(legacy===7?['relic-trim']:[])]:['playing','boss-intro']).includes(s.mode)) return false;
  if (s.version === 9 && (!isBasicWeapon(s.blade) || !validEconomy(s.economy) || s.classicTiming || Object.values(s.perks ?? {}).some(v => v !== 0) || Object.values(s.relics ?? {}).some(v => v !== 0) || s.relicDrops?.length || s.waves?.length || s.active?.casts || s.active?.buff || s.active?.fields?.length || s.active?.pending?.length)) return false;
  if (!s.player || !finite(s.player.x) || !finite(s.player.y) || !s.direction || !finite(s.direction.x) || !finite(s.direction.y)) return false;
  if (!s.velocity || !finite(s.velocity.x) || !finite(s.velocity.y) || Math.hypot(s.velocity.x, s.velocity.y) > 1000) return false;
  for (const key of ['time', 'bossTime', 'hp', 'maxHp', 'level', 'xp', 'totalXp', 'formStartedAt', 'rng', 'seed', 'nextId', 'targetId', 'attackTimer', 'attackCount', 'dashTime', 'dashCooldown', 'invincible', 'aim', 'eliteIndex', 'spawnBudget', 'evolutionTime', 'transition', 'kills', 'eliteKills', 'bestCleave', 'bossHits', 'maxCombo'] as const) if (!finite(s[key])) return false;
  if (typeof s.bossStarted !== 'boolean') return false;
  if (s.level < 1 || s.level > MAX_LEVEL || !Number.isInteger(s.level) || s.hp <= 0 || s.hp > s.maxHp || s.maxHp > (legacy===5 ? 190 : legacy===6 ? 250 : legacy===7 ? 265 : s.economy ? 258 : 323) || s.time < 0 || s.time > (s.economy ? SURVIVAL_DURATION : legacy||s.classicTiming?CLASSIC_TIMING.game:GAME_DURATION) || s.bossTime < 0 || s.bossTime > (s.economy ? FINALE_DURATION : legacy||s.classicTiming?CLASSIC_TIMING.boss:BOSS_DURATION)) return false;
  if (s.formStartedAt < 0 || s.formStartedAt > s.time + s.bossTime + .001 || s.xp < 0 || s.totalXp < 0) return false;
  if (!s.perks || !Object.keys(PERKS).every(k => Number.isInteger(s.perks[k as PerkId]) && s.perks[k as PerkId] >= 0 && s.perks[k as PerkId] <= PERKS[k as PerkId].cap)) return false;
  if(s.active!==undefined&&!validActive(s.active))return false;
  if(s.archery!==undefined&&!validArchery(s.archery))return false;
  const p = s.passive;
  if (!p || ['tier', 'hits', 'kills', 'stacks', 'empowered', 'cooldown', 'safeTime', 'haste'].some(k => !finite(p[k as keyof PassiveState]) || Number(p[k as keyof PassiveState]) < 0)) return false;
  if (p.tier !== s.blade || !Number.isInteger(p.hits) || p.hits > 7 || !Number.isInteger(p.kills) || !Number.isInteger(p.stacks) || p.stacks > 7 || p.empowered > 5.001 || p.cooldown > 12.001 || p.safeTime > 6.001 || p.haste > 3.001 || typeof p.shield !== 'boolean' || typeof p.tensaPending !== 'boolean') return false;
  if (!Array.isArray(s.pending) || s.pending.length > 1 || s.pending.some(t => !Number.isInteger(t) || t < 2 || t > MAX_LEVEL || t !== s.level)) return false;
  if (!Array.isArray(s.choices) || s.choices.length > 3) return false;
  const trim = legacy===7 && s.mode==='relic-trim';
  if(trim && !['playing','relic','evolving','boss-intro'].includes(s.relicResume??''))return false;
  if(!trim && s.relicResume!==undefined)return false;
  const effectiveMode=trim?s.relicResume:s.mode;
  const selecting = (effectiveMode as string) === (legacy===5 ? 'forge' : 'relic') || effectiveMode === 'evolving';
  if (selecting && (s.pending.length !== 1 || (legacy===5||legacy===6) && s.choices.length !== 3)) return false;
  if ((legacy===0||legacy===7) && (!Number.isInteger(s.lootRng)||s.lootRng<0||s.lootRng>4294967295||!Number.isInteger(s.skipped)||s.skipped<0||s.skipped>29))return false;
  if (legacy===5) { if (s.choices.some(k => !Object.hasOwn(PERKS, k))) return false; }
  else {
    if(legacy===6) {
      if(!s.relics||Object.keys(s.relics).length!==12||BASE_RELIC_IDS.some(id=>!Number.isInteger(s.relics[id])||s.relics[id]<0||s.relics[id]>4))return false;
    }else if(!validRelics(s.relics)||(legacy===7&&((!trim&&ownedRelics(s.relics).length>LEGACY_RELIC_SLOTS)||(trim&&ownedRelics(s.relics).length<=LEGACY_RELIC_SLOTS))))return false;
    const items={...freshRelics(),...s.relics};
    if(legacy && Object.values(items).reduce((a,b)=>a+b,0)+(legacy===7?s.skipped:0)+s.pending.length>s.level-1)return false;
    const eligible = eligibleRelics(items,s.level,equipmentStats(s.level,s.perks,s.blade,items).range);
    if(new Set(s.choices).size!==s.choices.length||s.choices.some(k=>!isRelicId(k)||(legacy===6&&!BASE_RELIC_IDS.includes(k as typeof BASE_RELIC_IDS[number]))||items[k]>=(legacy===6?4:RELIC_CAP)||legacy===7&&!trim&&(!eligible.includes(k)||ownedRelics(items).length>=5&&!items[k]))||!selecting&&s.choices.length!==0)return false;
    const r = s.relicState;
    if (!r || !Number.isInteger(r.lightning) || r.lightning < 0 || r.lightning > (items.thunder ? 6 - items.thunder : 0) || typeof r.shield !== 'boolean' || !finite(r.shieldCooldown) || r.shieldCooldown < 0 || r.shieldCooldown > 20 || r.shield && r.shieldCooldown !== 0 || (r.shield || r.shieldCooldown > 0) && relicGroups(items).spirit < 3) return false;
    if(!legacy||legacy===7) {
      for(const [key,max] of [['echo',4],['comet',3],['vortex',7],['heartPeak',5]] as const)if(!Number.isInteger(r[key])||r[key]<0||r[key]>max)return false;
      if(!finite(r.leechCooldown)||r.leechCooldown<0||r.leechCooldown>.501||typeof r.phoenixUsed!=='boolean'||typeof r.dashWave!=='boolean')return false;
    }
  }
  if(!legacy&&(typeof s.classicTiming!=='boolean'||s.pending.length||s.choices.length||!validRelicLoot(s.relicLoot)||!validRelicDrops(s.relicDrops)||s.relicLoot.order.some(id=>s.relics[id]<=0)||new Set(s.relicDrops.map(d=>d.id)).size!==s.relicDrops.length))return false;
  for (const [array, max] of [[s.enemies, 280], [s.orbs, Infinity], [s.bullets, 32], [s.waves, 32], [s.shocks, 8]] as const) {
    if (!Array.isArray(array) || array.length > max || array.some(e => !e || !finite(e.x) || !finite(e.y) || !finite(e.id))) return false;
  }
  const enemyNumbers = ['hp', 'maxHp', 'radius', 'damage', 'speed', 'xp', 'hit', 'spawn', 'age', 'cooldown', 'timer', 'angle', 'move', 'targetX', 'targetY', 'knockX', 'knockY'] as const;
  if (s.enemies.some(e => !Object.hasOwn(ENEMIES, e.kind) || enemyNumbers.some(k => !finite(e[k])) || !['idle', 'windup', 'charge', 'recover'].includes(e.action))) return false;
  const effectKeys = (Object.keys(freshEnemyEffects()) as (keyof EnemyEffects)[]).filter(k=>!legacy||!k.startsWith('poison'));
  if (s.enemies.some(e => effectKeys.some(k => !finite(e[k]) || e[k] < 0) || !Number.isInteger(e.chillStacks) || e.chillStacks > 3 || !Number.isInteger(e.dragonHits) || e.dragonHits > 2 || e.slow > 1 || e.burnTime > 4.001 || e.burnTick > .501 || e.hunt > 6.001 || e.chill > 3.001 || e.freeze > 1.401 || e.freezeCooldown > 4.001 || e.stun > 1.201 || e.slowTime > (s.blade===13?2.301:1.201))) return false;
  if(!legacy && s.enemies.some(e=>e.poisonTime>2.501||e.poisonTick>.501))return false;
  if (s.hazards !== undefined && (!Array.isArray(s.hazards) || s.hazards.length > 12 || s.hazards.some(h => !h || !['poison', 'blast'].includes(h.kind) || ['id','x','y','radius','age','duration','damage'].some(k => !finite(h[k as keyof Hazard])) || h.radius <= 0 || h.radius > 80 || h.age < 0 || h.age > h.duration || h.duration <= 0 || h.duration > 3.201 || h.damage < 0 || h.damage > 18))) return false;
  if (s.enemies.some(e => e.reveal !== undefined && (!finite(e.reveal) || e.reveal < 0 || e.reveal > .851))) return false;
  if (s.orbs.some(o => o.dropTimer !== undefined && (!finite(o.dropTimer) || o.dropTimer < 0 || o.dropTimer > XP_DROP_TIME + .001) || !finite(o.value) || o.value <= 0 || !(s.economy ? ['xp', 'heal', 'coin'] : ['xp', 'heal']).includes(o.kind) || o.kind === 'coin' && (!Number.isSafeInteger(o.value) || o.value > 100)||o.food!==undefined&&(!isFoodId(o.food)||o.kind!=='heal'))) return false;
  if (s.bullets.some(b => !finite(b.vx) || !finite(b.vy) || !finite(b.life) || b.kind !== undefined && !['orb', 'spine'].includes(b.kind) || b.damage !== undefined && (!finite(b.damage) || b.damage <= 0 || b.damage > 30))) return false;
  if (s.waves.some(w => w.source!==undefined&&w.source!=='active' || w.boomerang!==undefined&&typeof w.boomerang!=='boolean' || w.returning!==undefined&&(typeof w.returning!=='boolean'||!w.boomerang) || !finite(w.angle) || !finite(w.distance) || !finite(w.maxRange) || !finite(w.damage) || !Number.isInteger(w.pierce) || w.pierce < 1 || w.pierce > 24 || !Number.isInteger(w.tier) || w.tier < 0 || w.tier >= TIERS.length || !['basic', 'moon', 'getsuga'].includes(w.kind) || !Array.isArray(w.hit) || w.hit.length > w.pierce || w.hit.some(id => !finite(id)))) return false;
  if (s.waves.some(w => w.radius !== undefined && (!finite(w.radius) || w.radius <= 0 || w.radius > 252) || w.hitRadius !== undefined && (!finite(w.hitRadius) || w.hitRadius <= 0 || w.hitRadius > 60))) return false;
  if (s.shocks.some(shock => !finite(shock.radius) || !finite(shock.gap))) return false;
  if (s.swing && (!finite(s.swing.id) || !finite(s.swing.age) || !finite(s.swing.angle) || !Number.isInteger(s.swing.tier) || s.swing.tier < 0 || s.swing.tier >= TIERS.length || typeof s.swing.resolved !== 'boolean' || ['windup', 'strike', 'recovery'].some(k => !finite(s.swing![k as keyof Swing]) || Number(s.swing![k as keyof Swing]) <= 0 || Number(s.swing![k as keyof Swing]) > 1))) return false;
  if (!Array.isArray(s.recentKills) || s.recentKills.some(t => !finite(t))) return false;
  return true;
}

export function validSnapshot(value: unknown): value is RunState { return validateRun(value); }
type LegacyRunState = Omit<RunState, 'version' | 'mode' | 'choices' | 'relics' | 'relicState' | 'lootRng' | 'skipped' | 'relicResume' | 'classicTiming' | 'relicLoot' | 'relicDrops'> & { version: 5; mode: RunMode | 'forge'; choices: PerkId[] };
function upgradeLegacy(legacy: LegacyRunState): RunState {
  const state: RunState = { ...legacy, version: 8,classicTiming:true,relicLoot:freshRelicLoot(legacy.seed),relicDrops:[],lootRng:(legacy.seed^0xa5b35705)>>>0, skipped:0, mode: legacy.mode === 'forge' ? 'relic' : legacy.mode,
    relics: freshRelics(), relicState: freshRelicState(), choices: [] };
  if (state.mode === 'relic' || state.mode === 'evolving') {
    for (const id of [...legacy.choices.map(k => LEGACY_RELICS[k]), ...RELIC_IDS]) {
      if (id && !state.choices.includes(id) && !(id === 'star' && state.level === MAX_LEVEL) && !(id === 'ruler' && equipmentStats(state.level, state.perks, state.blade, state.relics).range >= 419.999)) state.choices.push(id);
      if (state.choices.length === 3) break;
    }
  }
  for(const e of state.enemies)Object.assign(e,{poisonTime:0,poisonTick:.5,poisonDamage:0});
  return upgradeToLoot(state);
}
function upgradeToLoot(state:RunState):RunState {
  state.version=8;state.classicTiming=true;state.relicLoot=freshRelicLoot(state.seed);state.relicLoot.order=ownedRelics(state.relics);state.relicDrops=[];
  const oldMode=state.mode==='relic-trim'?state.relicResume??'playing':state.mode;
  if(state.pending.length){
    const choices=state.choices.filter(id=>isRelicId(id)&&state.relics[id]<RELIC_CAP);
    if(choices.length){const group=state.nextId++;for(const [i,relic]of choices.entries()){const a=-Math.PI/2+i*Math.PI*2/choices.length;state.relicDrops.push({id:state.nextId++,relic,x:state.player.x+Math.cos(a)*72,y:state.player.y+Math.sin(a)*72,spawn:0,group});}state.relicLoot.totalDropped+=choices.length;}
    else state.orbs.push({id:state.nextId++,x:state.player.x+40,y:state.player.y,value:10,kind:'xp',dropTimer:0});
  }
  state.mode=oldMode==='boss-intro'?'boss-intro':'playing';state.pending=[];state.choices=[];state.evolutionTime=0;delete state.relicResume;
  return state;
}
// Legacy runs retain their blade, HP, experience, RNG and all already-earned forge stats.
export function restoreSnapshot(value: unknown): RunState | null {
  if (validSnapshot(value)) return structuredClone(value);
  if (!value || typeof value !== 'object') return null;
  const version = (value as { version?: unknown }).version;
  if(version===7)return validateRun(value,7)?upgradeToLoot(structuredClone(value) as RunState):null;
  if(version===6) {
    if(!validateRun(value,6))return null;
    const old=structuredClone(value) as RunState;
    const state:RunState={...old,version:8,classicTiming:true,relicLoot:freshRelicLoot(old.seed),relicDrops:[],lootRng:(old.seed^0xa5b35705)>>>0,skipped:0,relics:{...freshRelics(),...old.relics},relicState:{...freshRelicState(),...old.relicState,heartPeak:old.relics.heart}};
    for(const e of state.enemies)Object.assign(e,{poisonTime:0,poisonTick:.5,poisonDamage:0});
    if(ownedRelics(state.relics).length>LEGACY_RELIC_SLOTS){state.relicResume=state.mode as RunState['relicResume'];state.mode='relic-trim';}
    return upgradeToLoot(state);
  }
  if (version === 5) return validateRun(value, 5) ? upgradeLegacy(structuredClone(value) as LegacyRunState) : null;
  if (![1, 2, 3, 4].includes(Number(version))) return null;
  const migrated = structuredClone(value) as LegacyRunState;
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
    if (migrated.bossStarted) migrated.time = CLASSIC_TIMING.game;
    migrated.formStartedAt = migrated.time + migrated.bossTime;
    if (Number.isFinite(migrated.xp)) migrated.xp = Math.round(migrated.xp * classicXpNext(migrated.level) / legacyXpNext(migrated.level));
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
  return validateRun(migrated, 5) ? upgradeLegacy(migrated) : null;
}
