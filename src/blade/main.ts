import Phaser from 'phaser';
import './style.css';
import { ACHIEVEMENTS, FIXED_STEP, MASTERIES, TIERS, TIER_LEVELS, encounterDensity } from './config';
import { BladeRun, type MoveInput } from './simulation';
import { BattleScene } from './scene';
import { BladeStorage, type Settings } from './storage';
import { BladeAudio } from './audio';
import { BladeUI, type Panel } from './ui';
import { isGroundId } from './grounds';
import { isRelicId } from './relics';
import { swingPhase } from './equipment';

export class BladeApp {
  readonly storage = new BladeStorage();
  readonly audio = new BladeAudio();
  readonly scene = new BattleScene();
  readonly ui: BladeUI;
  readonly game: Phaser.Game;
  panel: Panel = 'title';
  selectedBlade = this.storage.data.settings.blade;
  private backPanel: Panel = 'title';
  run?: BladeRun;
  isNewBest = false;
  private keys = new Set<string>();
  private joystick = { x: 0, y: 0 };
  private dashQueued = false;
  private accumulator = 0;
  private hudClock = 0;
  private lastSaved = 0;
  private ready = false;
  private hitStop = 0;
  private lastHitStop = 0;
  private pausedByBlur = false;
  private activeTouch: number | null = null;
  private touchOrigin: { x: number; y: number } | null = null;
  private touchRadius = 35;
  constructor() {
    this.ui = new BladeUI(this);
    this.scene.onReady = () => { this.ready = true; this.ui.ready(); this.applySettings(); if (this.storage.warning) this.ui.toast(this.storage.warning); };
    this.scene.onFrame = dt => this.frame(dt);
    this.game = new Phaser.Game({
      type: new URLSearchParams(location.search).get('renderer') === 'webgl' ? Phaser.AUTO : Phaser.CANVAS,
      parent: 'game', backgroundColor: '#f3f6f9', antialias: true, transparent: false,
      scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
      scene: [this.scene], banner: false, fps: { target: 60, smoothStep: true },
      render: { pixelArt: false, roundPixels: false, maxTextures: 16 },
      input: { activePointers: 3 }, audio: { noAudio: true },
    });
    this.bindInputs();
    this.applySettings();
  }
  private applySettings() {
    const settings = this.storage.data.settings;
    this.audio.enabled = settings.sound; this.audio.monsterEnabled = settings.monsterSound;
    this.scene.reducedMotion = !settings.motion; this.scene.shakeEnabled = settings.shake; this.scene.simplified = settings.simplified;
    this.scene.heroColor = settings.color;
    this.scene.groundTheme = settings.ground;
    document.body.dataset.battleTheme = settings.ground;
    if (this.run) {
      this.run.simplified = settings.simplified;
      if (settings.simplified) {
        const r = this.run, s = r.state, special = s.enemies.filter(e => e.kind === 'boss' || e.kind === 'elite');
        const normal = s.enemies.filter(e => e.kind !== 'boss' && e.kind !== 'elite').sort((a, b) => Math.hypot(a.x - s.player.x, a.y - s.player.y) - Math.hypot(b.x - s.player.x, b.y - s.player.y));
        s.enemies = [...special, ...normal.slice(0, Math.max(0, encounterDensity(s.time, true).cap - special.length))]; s.bullets = s.bullets.slice(0, 24);
        while (s.orbs.length > 100) { const orb = s.orbs.pop()!; r.addOrb(orb.x, orb.y, orb.value, orb.kind); }
      }
    }
  }
  clearInputs() {
    this.keys.clear(); this.dashQueued = false; this.releaseTouch();
    if (this.run) this.run.state.velocity = { x: 0, y: 0 };
    this.accumulator = 0;
  }
  private releaseTouch() {
    const id = this.activeTouch;
    this.activeTouch = null; this.touchOrigin = null; this.joystick = { x: 0, y: 0 };
    const joystick = document.querySelector<HTMLElement>('#touch-joystick'); if (joystick) joystick.hidden = true;
    document.querySelector<HTMLElement>('#joystick-thumb')?.style.setProperty('transform', 'translate(-50%, -50%)');
    const surface = document.querySelector<HTMLElement>('#game');
    if (id !== null && surface?.hasPointerCapture(id)) surface.releasePointerCapture(id);
  }
  private bindInputs() {
    const movement = ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', ' '];
    window.addEventListener('keydown', event => {
      const key = event.key.toLowerCase();
      if (movement.includes(key) || key === 'escape') event.preventDefault();
      if (event.repeat && (key === ' ' || key === 'escape')) return;
      if (key === 'escape' || key === 'p') {
        if (this.panel === 'settings' || this.panel === 'codex' || this.panel === 'confirm' || this.panel === 'loadout' || this.panel === 'relics') this.action('back');
        else if (this.panel === 'pause') this.action('resume'); else if (this.run && this.panel === 'none') this.pause();
        return;
      }
      if (key === 'f') { this.action('fullscreen'); return; }
      if (this.panel !== 'none' || !this.run) return;
      if (this.run.state.mode === 'relic' && /^[1-3]$/.test(key)) { if (!event.repeat) this.action('relic', this.run.state.choices[Number(key) - 1]); return; }
      if (key === 'i') { this.action('relics'); return; }
      if (this.run.state.mode !== 'playing') return;
      this.keys.add(key);
      if (key === ' ') this.dashQueued = true;
    });
    window.addEventListener('keyup', event => this.keys.delete(event.key.toLowerCase()));
    window.addEventListener('blur', () => { this.clearInputs(); if (this.run && this.panel === 'none' && !['won', 'dead'].includes(this.run.state.mode)) { this.pausedByBlur = true; this.pause(); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.clearInputs(); if (this.run && this.panel === 'none') this.pause(); this.save(); } });
    window.addEventListener('pagehide', () => this.save());
    window.addEventListener('resize', () => this.clearInputs());
    const surface = document.querySelector<HTMLElement>('#game')!;
    const joystick = document.querySelector<HTMLElement>('#touch-joystick')!;
    const updateStick = (event: PointerEvent) => {
      if (!this.touchOrigin) return;
      const dx = event.clientX - this.touchOrigin.x, dy = event.clientY - this.touchOrigin.y;
      const radius = this.touchRadius, distance = Math.hypot(dx, dy), factor = Math.min(1, radius / (distance || 1));
      const magnitude = Math.min(1, Math.max(0, (distance - 4) / (radius - 4)));
      this.joystick = { x: dx / (distance || 1) * magnitude, y: dy / (distance || 1) * magnitude };
      document.querySelector<HTMLElement>('#joystick-thumb')!.style.transform = `translate(calc(-50% + ${dx * factor}px), calc(-50% + ${dy * factor}px))`;
    };
    surface.addEventListener('pointerdown', event => {
      if (this.panel !== 'none' || this.run?.state.mode !== 'playing') return;
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') {
        if (event.button === 0) { this.dashQueued = true; this.audio.unlock(); }
        return;
      }
      event.preventDefault();
      if (this.activeTouch !== null) return;
      this.activeTouch = event.pointerId; this.touchOrigin = { x: event.clientX, y: event.clientY }; this.joystick = { x: 0, y: 0 };
      joystick.style.left = `${event.clientX}px`; joystick.style.top = `${event.clientY}px`; joystick.hidden = false;
      this.touchRadius = joystick.clientWidth * .31;
      document.querySelector<HTMLElement>('#joystick-thumb')!.style.transform = 'translate(-50%, -50%)';
      surface.setPointerCapture(event.pointerId); this.audio.unlock();
    });
    surface.addEventListener('pointermove', event => { if (this.activeTouch === event.pointerId) { updateStick(event); event.preventDefault(); } });
    const release = (event: PointerEvent) => {
      if (event.pointerId !== this.activeTouch) return;
      this.releaseTouch();
    };
    surface.addEventListener('pointerup', release); surface.addEventListener('pointercancel', release);
    surface.addEventListener('lostpointercapture', event => { if (event.target === surface) release(event); });
    document.querySelector('#dash-button')!.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); if (this.panel === 'none' && this.run?.state.mode === 'playing') { this.dashQueued = true; this.audio.unlock(); } });
  }
  start(resume = false) {
    if (!this.ready) { this.ui.toast('刀锋即将就绪，请稍候。'); return; }
    this.clearInputs();
    this.run = new BladeRun(Date.now() >>> 0, resume ? this.storage.data.run ?? undefined : undefined, this.selectedBlade);
    const chosen = this.run.tier;
    this.selectedBlade = chosen; this.storage.data.settings.blade = chosen;
    if (!this.storage.data.meta.seenBlades.includes(chosen)) this.storage.data.meta.seenBlades.push(chosen);
    this.isNewBest = false; this.panel = 'none'; this.scene.reset(this.run); this.applySettings();
    this.lastSaved = performance.now(); this.audio.unlock(); this.save(); this.ui.render(true);
    if (resume) this.ui.toast('已回到上次的试炼。');
  }
  pause() {
    if (!this.run || ['won', 'dead'].includes(this.run.state.mode)) return;
    this.panel = 'pause'; this.scene.pausedRun = true; this.clearInputs(); this.save(); this.ui.render(true);
  }
  action(action: string, value?: string) {
    if (action === 'inspect') { this.ui.inspect(Number(value)); return; }
    if (action === 'back' && this.ui.inspector?.active) { this.ui.inspector.close(); return; }
    if (action === 'ground' && isGroundId(value)) {
      const scrollTop = document.querySelector('.settings-panel')?.scrollTop ?? 0;
      this.storage.data.settings.ground = value;
      this.scene.groundTheme = value; document.body.dataset.battleTheme = value;
      // A scenery preference must not prune entities or change the combat simulation.
      this.save(); this.ui.render(true);
      const panel = document.querySelector('.settings-panel'); if (panel) panel.scrollTop = scrollTop;
      document.querySelector<HTMLButtonElement>(`[data-action="ground"][data-value="${value}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (action === 'sound') { this.setSetting('sound', !this.storage.data.settings.sound); this.audio.unlock(); return; }
    if (action === 'skin') {
      const index = Number(value), meta = this.storage.data.meta;
      if (index === 0 || index === 1 && meta.maxTier >= MASTERIES.length - 1 || index === 2 && meta.runs >= 5) { this.storage.data.settings.color = index; this.applySettings(); this.storage.write(); this.ui.render(true); }
      return;
    }
    if (action === 'fullscreen') { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.().catch(() => this.ui.toast('当前浏览器未开放全屏。')); return; }
    if (action === 'blade-pick') {
      const blade = Number(value);
      if (Number.isInteger(blade) && blade >= 0 && blade < TIERS.length) {
        if (this.panel !== 'loadout') this.backPanel = this.panel;
        this.selectedBlade = blade; this.panel = 'loadout'; this.clearInputs(); this.ui.render(true);
      }
      return;
    }
    if (action === 'start' || action === 'restart-now' || action === 'restart') { this.backPanel = this.panel; this.panel = 'loadout'; this.scene.pausedRun = true; this.clearInputs(); this.ui.render(true); return; }
    if (action === 'begin') { this.start(); return; }
    if (action === 'continue') { this.start(true); return; }
    if (action === 'pause') { this.pause(); return; }
    if (action === 'resume') { this.panel = 'none'; this.scene.pausedRun = false; this.clearInputs(); this.pausedByBlur = false; this.audio.unlock(); this.ui.render(true); return; }
    if (action === 'settings' || action === 'codex') {
      this.backPanel = this.panel === 'none' && this.run ? 'pause' : this.panel;
      this.panel = action; this.scene.pausedRun = true; this.clearInputs(); this.save(); this.ui.render(true);
      if (action === 'codex' && this.run) requestAnimationFrame(() => document.querySelector(`.codex-card[data-tier="${this.run!.tier}"]`)?.scrollIntoView({ block: 'center' }));
      return;
    }
    if (action === 'relics' && this.run) { this.backPanel = this.panel; this.panel = 'relics'; this.scene.pausedRun = true; this.clearInputs(); this.save(); this.ui.render(true); return; }
    if (action === 'back' && this.panel === 'relics') { this.panel = this.backPanel; this.scene.pausedRun = this.panel !== 'none'; this.clearInputs(); this.ui.render(true); return; }
    if (action === 'back') { this.panel = this.backPanel === 'none' && !['won', 'dead'].includes(this.run?.state.mode ?? '') ? 'pause' : this.backPanel; this.ui.render(true); return; }
    if (action === 'title' || action === 'save-title') {
      if (action === 'save-title') this.save();
      this.run = undefined; this.scene.activeRun = false; this.scene.pausedRun = false; this.panel = 'title'; this.clearInputs(); this.ui.render(true); return;
    }
    if (action === 'dash') { if (this.panel === 'none' && this.run?.state.mode === 'playing') this.dashQueued = true; return; }
    if (action === 'relic' && this.panel === 'none' && this.run && isRelicId(value) && this.run.chooseRelic(value)) {
      this.clearInputs(); this.audio.choose(); this.save(); this.ui.render(true);
    }
  }
  setSetting(key: string, value: boolean) {
    if (!['sound', 'monsterSound', 'simplified', 'motion', 'shake'].includes(key)) return;
    (this.storage.data.settings as unknown as Record<string, boolean>)[key] = value;
    this.applySettings(); this.storage.write(); this.ui.render(true);
  }
  private input(): MoveInput {
    const right = this.keys.has('d') || this.keys.has('arrowright'), left = this.keys.has('a') || this.keys.has('arrowleft');
    const up = this.keys.has('w') || this.keys.has('arrowup'), down = this.keys.has('s') || this.keys.has('arrowdown');
    return { x: Number(right) - Number(left) + this.joystick.x, y: Number(down) - Number(up) + this.joystick.y, dash: this.dashQueued };
  }
  private tick() {
    if (!this.run || this.panel !== 'none') return;
    const modeBefore = this.run.state.mode;
    this.run.step(FIXED_STEP, this.input()); this.dashQueued = false;
    this.scene.ingest(this.run.events);
    for (const event of this.run.events) {
      if (event.type === 'slash') this.audio.slash(event.tier ?? 0, this.run.stats.mass);
      if (event.type === 'hit') {
        if (event.source !== 'burn') this.audio.hit();
        if (event.enemyKind) this.audio.enemyHurt(event.enemyKind, event.lethal, event.source);
        if (event.elite && this.storage.data.settings.motion && performance.now() - this.lastHitStop > 200) { this.lastHitStop = performance.now(); this.hitStop = .025; }
      }
      if (event.type === 'pickup') this.audio.pickup();
      if (event.type === 'passive') this.audio.passive(event.tier ?? this.run.tier);
      if (event.type === 'hurt') this.audio.hurt();
      if (event.type === 'dash') this.audio.dash();
      if (event.type === 'evolve') { this.audio.evolve(this.run.mastery); this.clearInputs(); this.storage.data.meta.maxTier = Math.max(this.storage.data.meta.maxTier, this.run.mastery); this.save(); }
      if (event.type === 'boss') { this.audio.boss(); this.clearInputs(); this.save(); }
      if (event.type === 'win') this.audio.win();
    }
    this.storage.data.meta.maxTier = Math.max(this.storage.data.meta.maxTier, this.run.mastery);
    this.checkAchievements();
    if (this.run.state.mode !== modeBefore) { this.clearInputs(); this.ui.render(true); }
    if (['won', 'dead'].includes(this.run.state.mode)) this.finish();
  }
  private checkAchievements() {
    if (!this.run) return;
    const s = this.run.state, m = this.storage.data.meta;
    const conditions: Record<string, boolean> = { divine: s.level >= TIER_LEVELS[MASTERIES.length - 1], cleave: s.bestCleave >= 8, combo: s.maxCombo >= 15, flawless: s.mode === 'won' && s.bossHits === 0, veteran: m.runs >= 5 };
    for (const a of ACHIEVEMENTS) if (conditions[a.id] && !m.achievements.includes(a.id)) { m.achievements.push(a.id); this.ui.toast(`试炼印记 · ${a.name}`); this.save(); }
  }
  private finish() {
    if (!this.run) return;
    const s = this.run.state, m = this.storage.data.meta;
    if (m.lastFinishedId === s.id) return;
    m.lastFinishedId = s.id; m.runs++; if (s.mode === 'won') m.wins++;
    this.isNewBest = this.run.score() > m.bestScore;
    m.bestScore = Math.max(m.bestScore, this.run.score()); m.bestKills = Math.max(m.bestKills, s.kills); m.bestTime = Math.max(m.bestTime, s.time + s.bossTime);
    this.storage.write(null); this.checkAchievements(); this.clearInputs(); this.ui.render(true);
  }
  save() {
    const run = this.run;
    if (run) {
      const terminal = run.state.mode === 'won' || run.state.mode === 'dead';
      const success = this.storage.write(terminal ? null : run.snapshot());
      if (!success) this.ui.toast(this.storage.warning);
    } else this.storage.write();
  }
  frame(dt: number) {
    this.scene.pausedRun = this.panel !== 'none';
    if (this.hitStop > 0) { this.hitStop -= dt; this.ui.render(); return; }
    if (this.run && this.panel === 'none' && !['won', 'dead'].includes(this.run.state.mode)) {
      this.accumulator += Math.min(dt, .1);
      let ticks = 0;
      while (this.accumulator >= FIXED_STEP && ticks++ < 6) { this.accumulator -= FIXED_STEP; this.tick(); }
      if (performance.now() - this.lastSaved > 5000) { this.lastSaved = performance.now(); this.save(); }
    }
    this.hudClock += dt;
    if (this.hudClock > .075) { this.hudClock = 0; this.ui.render(); }
  }
  advance(ms: number) { for (let i = 0; i < Math.min(36000, Math.ceil(ms / (FIXED_STEP * 1000))); i++) this.tick(); this.ui.render(true); }
  text() {
    const s = this.run?.state;
    return JSON.stringify(s ? { mode: s.mode, panel: this.panel, coordinateSystem: 'world units, x right, y down, player-centered camera', time: +s.time.toFixed(2), bossTime: +s.bossTime.toFixed(2), level: s.level, mastery: MASTERIES[this.run!.mastery], bladeIndex: this.run!.tier, tier: this.run!.mastery + 1, density: encounterDensity(s.time, this.run!.simplified), blade: TIERS[this.run!.tier].name, xp: s.xp, totalXp: s.totalXp, formRemaining: this.run!.formRemaining, holdingXp: this.run!.holdingXp, equipment: this.run!.stats, passive: { id: this.run!.bladeId, name: this.run!.passiveInfo.name, ...s.passive }, attackPhase: s.swing ? swingPhase(s.swing).phase : 'idle', hp: s.hp, maxHp: s.maxHp, position: s.player, velocity: s.velocity, dashCooldown: +s.dashCooldown.toFixed(2), invincible: s.invincible, enemies: s.enemies.map(e => ({ id: e.id, kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), hp: Math.ceil(e.hp), action: e.action, effects: { hunt: e.hunt, chill: e.chillStacks, freeze: e.freeze, stun: e.stun, burn: e.burnTime, dragonHits: e.dragonHits } })), orbs: s.orbs.length, bullets: s.bullets.length, waves: s.waves.length, choices: s.choices, pending: s.pending, relics: s.relics, relicState: s.relicState, legacyPerks: s.perks, kills: s.kills, score: this.run!.score(), achievements: this.storage.data.meta.achievements } : { mode: 'title', panel: this.panel, canContinue: !!this.storage.data.run, meta: this.storage.data.meta });
  }
}

declare global { interface Window { render_game_to_text: () => string; advanceTime: (ms: number) => void; __BLADE__?: BladeApp } }
const app = new BladeApp();
window.render_game_to_text = () => app.text();
if (import.meta.env.DEV || new URLSearchParams(location.search).has('qa')) { window.__BLADE__ = app; window.advanceTime = ms => app.advance(ms); }
