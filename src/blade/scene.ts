import Phaser from 'phaser';
import { ASSETS } from './assets';
import { ENEMIES, TIERS } from './config';
import { BladeRun, type RunEvent } from './simulation';
import { GROUND_MAX_DENSITY, GROUND_TILE_SIZE, groundDensity, groundInfo, groundPattern, type GroundId } from './grounds';
import { swingPhase } from './equipment';
import { stalkerCloaked } from './threats';
import { BladeDrag, dragOpacity, frictionProfile } from './blade-drag';
import { bladeBackGeometry } from './blade-back';
import { BLADE_COLORS } from './blade-art';
import { bladePresentation, cameraImpulse, squashResponse } from './feedback';
import type { BladeId } from './passives';

interface Particle { x: number; y: number; vx: number; vy: number; age: number; life: number; color: number; size: number }
interface DamageLabel { object: Phaser.GameObjects.Text; age: number; life: number; startY: number }
interface RelicFX { x: number; y: number; toX: number; toY: number; item: 'thunder' | 'shield'; age: number }
interface PassiveFX { skill: BladeId; x: number; y: number; age: number; radius: number; detail?: 'ready' | 'break' }
export class BattleScene extends Phaser.Scene {
  run?: BladeRun;
  activeRun = false;
  pausedRun = false;
  reducedMotion = false;
  simplified = false;
  shakeEnabled = true;
  heroColor = 0;
  pixelRatio = 1;
  private groundTextureKey = 'ground-classic-1';
  private groundRasterDensity = 1;
  private groundMaxDensity = GROUND_MAX_DENSITY;
  groundTheme: GroundId = 'grid';
  private activeGround?: GroundId;
  onFrame?: (delta: number) => void;
  onReady?: () => void;
  private dots!: Phaser.GameObjects.TileSprite;
  private shadows!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private danger!: Phaser.GameObjects.Graphics;
  private hero!: Phaser.GameObjects.Image;
  private expression!: Phaser.GameObjects.Graphics;
  private hands!: Phaser.GameObjects.Graphics;
  effortLevel = 0;
  impactStopped = false;
  readonly drag = new BladeDrag();
  private grooves!: Phaser.GameObjects.Graphics;
  private friction!: Phaser.GameObjects.Graphics;
  private bladeBack!: Phaser.GameObjects.Graphics;
  private groundHazards!: Phaser.GameObjects.Graphics;
  private recoilAge = 1;
  private recoilStrength = 0;
  private hitResponses = new Map<number,number>();
  private contacts: {x:number;y:number;age:number;death:boolean;color:number}[] = [];
  impact(strength: number) { if(this.shakeEnabled && !this.reducedMotion) { this.recoilAge=0; this.recoilStrength=Math.min(2.7,strength); } }
  clearImpact() { this.impactStopped=false; this.recoilAge=1; this.recoilStrength=0; }
  private blade!: Phaser.GameObjects.Image;
  private hilt!: Phaser.GameObjects.Image;
  private slash!: Phaser.GameObjects.Image;
  private liveSprites = new Map<string, Phaser.GameObjects.Image>();
  private spareSprites: Phaser.GameObjects.Image[] = [];
  private used = new Set<string>();
  private particles: Particle[] = [];
  private passiveFx: PassiveFX[] = [];
  private relicFx: RelicFX[] = [];
  private labels: DamageLabel[] = [];
  private spareLabels: Phaser.GameObjects.Text[] = [];
  private clock = 0;
  private lastDamage = 0;
  private zoomValue = 0;
  constructor() { super('battle'); }
  preload() {
    for (const [key, url] of Object.entries(ASSETS)) this.load.image(key, url);
    this.load.on('loaderror', () => { document.querySelector('#boot-status')!.textContent = '图片加载失败，请刷新重试。'; });
  }
  create() {
    const source = this.textures.get('hero').getSourceImage() as HTMLImageElement;
    for (const [index, hue] of [[1, 185], [2, 70]]) {
      const texture = this.textures.createCanvas(`hero-color-${index}`, source.width, source.height)!;
      const context = texture.getContext(); context.filter = `hue-rotate(${hue}deg)`; context.drawImage(source, 0, 0); texture.refresh();
    }
    if (this.game.renderer.type === Phaser.WEBGL) this.groundMaxDensity = Math.max(1, Math.min(GROUND_MAX_DENSITY, Math.floor((this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).getMaxTextureSize() / GROUND_TILE_SIZE)));
    this.addGroundTexture(this.groundTextureKey, 'classic', 1);
    this.dots = this.add.tileSprite(0, 0, 1000, 800, this.groundTextureKey).setDepth(0);
    this.grooves = this.add.graphics().setDepth(1);
    this.groundHazards = this.add.graphics().setDepth(3);
    this.friction = this.add.graphics().setDepth(22);
    this.bladeBack = this.add.graphics().setDepth(20.5);
    this.shadows = this.add.graphics().setDepth(2);
    this.fx = this.add.graphics().setDepth(24);
    this.danger = this.add.graphics().setDepth(32);
    this.hero = this.add.image(0, 0, 'hero').setDepth(27);
    this.expression = this.add.graphics().setDepth(28);
    this.hands = this.add.graphics().setDepth(29);
    for (let i=1;i<=TIERS.length;i++) {
      const texture = this.textures.get(`blade-${i}`);
      texture.add('body',0,264,0,868,512); texture.add('hilt',0,36,0,228,512);
    }
    this.blade = this.add.image(0,0,'blade-1','body').setOrigin(0,.5).setDepth(20);
    this.hilt = this.add.image(0,0,'blade-1','hilt').setOrigin(76/228,.5).setDepth(21);
    this.slash = this.add.image(0, 0, 'slash-1').setOrigin(.5, .83).setDepth(23);
    this.onReady?.();
  }
  private addGroundTexture(key: string, ground: GroundId, density: number) {
    if (this.textures.exists(key)) return;
    const canvas = groundPattern(ground, density);
    this.textures.create(key, canvas)!.add('__BASE', 0, 0, 0, canvas.width, canvas.height);
  }
  reset(run: BladeRun) {
    this.run = run; this.activeRun = true; this.particles = []; this.passiveFx = []; this.relicFx = []; this.drag.reset(); this.clearImpact(); this.hitResponses.clear(); this.contacts=[]; this.pausedRun=false;
    for (const label of this.labels) { label.object.setVisible(false); this.spareLabels.push(label.object); }
    this.labels = [];
  }
  private sprite(id: string, texture: string, x: number, y: number, size: number, depth: number) {
    let sprite = this.liveSprites.get(id);
    if (!sprite) { sprite = this.spareSprites.pop() ?? this.add.image(x, y, texture); this.liveSprites.set(id, sprite); }
    this.used.add(id); sprite.setTexture(texture).setVisible(true).setPosition(x, y).setDisplaySize(size, size).setRotation(0).setAlpha(1).setDepth(depth);
    return sprite;
  }
  ingest(events: RunEvent[]) {
    const kills=events.filter(e=>e.type==='kill' && e.source==='melee');
    if(kills.length>=3 && this.run) this.damageLabel(`一刀 ${kills.length}`,this.run.state.player.x,this.run.state.player.y-22);
    for (const event of events) {
      const x = event.x ?? 0, y = event.y ?? 0, color = TIERS[event.tier ?? this.run?.tier ?? 0].hex;
      const direct = event.type==='hit' && (event.source==='melee' || event.source==='wave');
      if(direct && event.enemyId!==undefined) this.hitResponses.set(event.enemyId,0);
      if((direct || event.type==='kill') && this.contacts.length<(this.simplified?24:60)) this.contacts.push({x,y,age:0,death:event.type==='kill',color});
      if (event.type === 'relic' && event.item && this.relicFx.length < (this.simplified ? 9 : 18)) this.relicFx.push({ item: event.item, x, y, toX: event.toX ?? x, toY: event.toY ?? y, age: 0 });
      if (event.type === 'passive' && event.skill && this.passiveFx.length < (this.simplified ? 12 : 24)) this.passiveFx.push({ skill: event.skill, x, y, age: 0, radius: event.radius ?? 32, detail: event.detail });
      if (direct || event.type === 'kill' || event.type === 'dash') {
        const count = event.type === 'kill' ? (this.simplified ? 3 : 8) : event.type === 'dash' ? 10 : 3;
        const cap = this.simplified ? 100 : 280;
        for (let i = 0; i < count && this.particles.length < cap; i++) {
          const a = (i / count * Math.PI * 2) + (event.amount ?? 0) * .1, speed = event.type === 'kill' ? 35 + (i % 3) * 22 : 35;
          this.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, age: 0, life: .25 + (i % 3) * .07, color: event.type === 'dash' ? 0x52c4cf : color, size: 1.4 + (i % 3) });
        }
      }
      if (event.type==='hit' && (event.elite || performance.now()-this.lastDamage>140)) { this.lastDamage=performance.now(); this.damageLabel(String(event.amount),x,y); }
      if(event.type==='hurt') this.impact(2.2);

    }
  }
  private damageLabel(text: string,x:number,y:number) {
    if(this.labels.length>=22) return;
    const object=this.spareLabels.pop()??this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontStyle:'bold',fontSize:'15px',color:'#253d54',stroke:'#ffffff',strokeThickness:3}).setOrigin(.5).setDepth(40);
    object.setText(text).setPosition(x,y-24).setVisible(true).setAlpha(1).setResolution(Math.min(4,Math.max(1,Math.ceil(this.cameras.main.zoom))));
    object.setColor(groundInfo(this.groundTheme).dark?'#f1e5bc':'#253d54').setStroke(groundInfo(this.groundTheme).dark?'#263b50':'#ffffff',3);
    this.labels.push({object,age:0,life:.5,startY:y-24});
  }
  update(_time: number, deltaMs: number) {
    const dt = Math.min(.05, deltaMs / 1000);
    this.onFrame?.(dt);
    if (!this.dots) return;
    const worldFrozen=this.pausedRun||this.impactStopped||!!this.run&&this.run.state.mode!=='playing';
    if(!worldFrozen) { this.clock+=dt; this.recoilAge+=dt; }
    const { width, height } = this.scale, camera = this.cameras.main;
    const weaponRange = this.activeRun && this.run ? this.run.stats.range : 100;
    const desiredZoom = Math.min(width, height) / (540 + Math.max(0, weaponRange - 140) * .8);
    // A little extra room lets a giant blade remain readable without changing its hit range.
    const zoom = this.zoomValue ? Phaser.Math.Linear(this.zoomValue, desiredZoom, this.reducedMotion ? 1 : Math.min(1, dt * 4)) : desiredZoom;
    if (zoom !== this.zoomValue) { this.zoomValue = zoom; camera.setZoom(zoom); }
    const s = this.run?.state, active = this.activeRun && !!s;
    const px = active ? s!.player.x : 0, py = active ? s!.player.y : 0;
    const ground = active ? this.groundTheme : 'classic';
    const density = Math.min(this.groundMaxDensity, groundDensity(zoom));
    if (this.activeGround !== ground || density !== this.groundRasterDensity) {
      const key = `ground-${ground}-${density}`, previous = this.groundTextureKey;
      this.addGroundTexture(key, ground, density); this.dots.setTexture(key);
      this.activeGround = ground; this.groundRasterDensity = density; this.groundTextureKey = key;
      if (previous !== key) this.textures.remove(previous);
      camera.setBackgroundColor(groundInfo(ground).base);
    }
    const kick=worldFrozen||!this.shakeEnabled||this.reducedMotion ? {x:0,y:0} : cameraImpulse(this.recoilAge,this.recoilStrength);
    camera.centerOn(px+kick.x*this.pixelRatio/zoom, py+kick.y*this.pixelRatio/zoom);
    const worldWidth = width / zoom, worldHeight = height / zoom;
    if (this.run) { this.run.view.width = worldWidth; this.run.view.height = worldHeight; }
    // TileSprite's intermediate canvas is native-sized. Camera zoom is canceled once.
    this.dots.setPosition(px, py).setSize(width + 16, height + 16).setScale(1 / zoom)
      .setTileScale(zoom / density, zoom / density)
      .setTilePosition((px - worldWidth / 2 - 8 / zoom) * density, (py - worldHeight / 2 - 8 / zoom) * density);
    this.shadows.clear(); this.fx.clear(); this.danger.clear(); this.grooves.clear(); this.groundHazards.clear(); this.friction.clear(); this.bladeBack.clear(); this.used.clear();
    this.hero.setVisible(active); this.blade.setVisible(active); this.hilt.setVisible(active); this.slash.setVisible(false);
    this.expression.clear().setVisible(active); this.hands.clear().setVisible(active); this.effortLevel = 0;
    if (active && this.run) this.drawBattle(dt);
    for (const [id, sprite] of this.liveSprites) if (!this.used.has(id)) { sprite.setVisible(false); this.spareSprites.push(sprite); this.liveSprites.delete(id); }
  }
  private drawBattle(dt: number) {
    const run = this.run!, s = run.state, t = TIERS[run.tier], g = this.fx, danger = this.danger;
    const stats = run.stats, phase = s.swing ? swingPhase(s.swing) : null;
    const effort = Math.min(1, Math.max(0, stats.mass - 1) / 2.4);
    const strain = phase ? effort * (phase.phase === 'recovery' ? 1 - phase.progress * .75 : phase.phase === 'windup' ? .45 + phase.progress * .55 : 1) : 0;
    this.effortLevel = strain;
    const frozen = this.pausedRun || this.impactStopped || ['relic', 'evolving', 'boss-intro'].includes(s.mode), fxDt = frozen ? 0 : dt;
    const moving = !frozen && (s.dashTime > 0 || Math.hypot(s.velocity.x, s.velocity.y) > .1);
    const walkFrequency = 11 / (1 + effort * .5);
    const bob = this.reducedMotion || !moving ? 0 : Math.sin(this.clock * walkFrequency) * (.8 + effort * 1.2);
    const dark = groundInfo(this.groundTheme).dark;
    this.shadows.fillStyle(dark ? 0xb6d6e5 : 0x294e6a, dark ? .11 : .1).fillEllipse(s.player.x + 2, s.player.y + 13, 34, 10);
    // The same blade gradually gains rings and sparks; enemy warnings are drawn above this layer.
    if (run.mastery >= 2) {
      const aura = 24 + run.mastery * 6;
      this.shadows.lineStyle(1, t.hex, .12 + run.mastery * .025).strokeCircle(s.player.x, s.player.y, aura);
      if (run.mastery === 4) this.shadows.lineStyle(5, t.hex, .06).strokeCircle(s.player.x, s.player.y, aura + 6);
    }
    for(const h of s.hazards??[]) {
      const fade=Math.min(1,(h.duration-h.age)/.3), color=h.kind==='poison'?0x72b960:0xffb951;
      this.groundHazards.fillStyle(color,(h.kind==='poison'?.18:.24)*fade).fillCircle(h.x,h.y,h.radius);
      this.groundHazards.lineStyle(2,color,.7*fade).strokeCircle(h.x,h.y,h.radius);
      if(h.kind==='poison') for(let i=0;i<3;i++) this.groundHazards.lineStyle(1.5,0xc1dc84,.65*fade).strokeCircle(h.x+(i-1)*20,h.y+(i%2?12:-8),9);
    }
    for (const orb of s.orbs) {
      if (Math.abs(orb.x - s.player.x) > run.view.width / 2 + 40 || Math.abs(orb.y - s.player.y) > run.view.height / 2 + 40) continue;
      const size = orb.kind === 'heal' ? 21 : 12 + Math.min(7, Math.log2(orb.value + 1));
      this.sprite(`o${orb.id}`, orb.kind, orb.x, orb.y, size, 29).setRotation(orb.kind === 'xp' ? Math.sin(this.clock * 2 + orb.id) * .12 : 0);
    }
    for (const e of s.enemies) {
      const size = ENEMIES[e.kind].size;
      this.shadows.fillStyle(dark ? 0xb6d6e5 : 0x294e6a, .09).fillEllipse(e.x + 2, e.y + size * .3, size * .7, size * .20);
      if (dark && ['armor', 'elite', 'boss'].includes(e.kind)) this.shadows.lineStyle(1.5, 0x9dbbc9, .3).strokeCircle(e.x, e.y, e.radius + 3);
      const sprite = this.sprite(`e${e.id}`, e.kind, e.x, e.y - (this.reducedMotion || e.freeze > 0 || e.stun > 0 ? 0 : Math.sin(e.age * 7 + e.id) * 1), size, 12 + e.radius / 30);
      if (e.kind === 'stalker') sprite.setAlpha(stalkerCloaked(e) ? this.reducedMotion ? .25 : .18 : 1);
      if (e.kind === 'wisp' && !this.reducedMotion) sprite.y -= 3 + Math.sin(e.age * 3 + e.id) * 2;
      if (e.kind === 'charger' && (e.action === 'windup' || e.action === 'charge')) sprite.setRotation(e.angle + Math.PI / 2);
      const responseAge=this.hitResponses.get(e.id);
      if(responseAge!==undefined) { const squash=this.reducedMotion?0:squashResponse(responseAge)*.14; sprite.setDisplaySize(size*(1+squash),size*(1-squash)); if(responseAge<.04) g.fillStyle(0xfff8df,.25).fillCircle(e.x,e.y,e.radius*.72); }
      if (e.kind === 'charger' && e.action === 'charge') g.lineStyle(10, 0xdb7988, .2).lineBetween(e.x, e.y, e.x - Math.cos(e.angle) * 40, e.y - Math.sin(e.angle) * 40);
      if (e.hunt > 0) {
        g.lineStyle(1.4, 0x36ab8e, .7).strokeCircle(e.x, e.y, e.radius + 4);
        g.lineBetween(e.x - 4, e.y - e.radius - 7, e.x + 4, e.y - e.radius - 7).lineBetween(e.x, e.y - e.radius - 11, e.x, e.y - e.radius - 3);
      }
      if (e.chill > 0) {
        g.lineStyle(1.3, 0x69bfd5, .7).strokeCircle(e.x, e.y, e.radius + 3);
        for (let i = 0; i < e.chillStacks; i++) g.fillStyle(0x8fdaed, .9).fillTriangle(e.x - 7 + i * 7, e.y + e.radius + 7, e.x - 4 + i * 7, e.y + e.radius + 3, e.x - 1 + i * 7, e.y + e.radius + 7);
      }
      if (e.freeze > 0) {
        g.fillStyle(0xc3f3fa, .13).fillCircle(e.x, e.y, e.radius + 6);
        const points = Array.from({ length: 6 }, (_, i) => ({ x: e.x + Math.cos(i * Math.PI / 3) * (e.radius + 7), y: e.y + Math.sin(i * Math.PI / 3) * (e.radius + 7) }));
        g.lineStyle(2, 0x9cdeef, .95).strokePoints(points, true);
      }
      if (e.stun > 0) for (let i = 0; i < 3; i++) {
        const sx = e.x - 10 + i * 10, sy = e.y - e.radius - 9 - (i % 2) * 3;
        g.lineStyle(1.5, 0xd9b75f, .9).lineBetween(sx - 2, sy, sx + 2, sy).lineBetween(sx, sy - 2, sx, sy + 2);
      }
      if (e.dragonHits > 0) for (let i = 0; i < 2; i++) g.fillStyle(i < e.dragonHits ? 0x6c85ae : 0xc4d0df, .85).fillCircle(e.x - 3 + i * 6, e.y + e.radius + 6, 1.8);
      if (e.slowTime > 0) g.lineStyle(1.4, 0x8fd7ed, .7).strokeEllipse(e.x, e.y + e.radius * .7, e.radius * 2.2, e.radius * .6);
      if (e.burnTime > 0) for (let i = 0; i < (this.simplified ? 2 : 3); i++) {
        const sx = e.x - e.radius * .6 + e.radius * .6 * i, sy = e.y + e.radius * .7;
        const flame = this.reducedMotion ? 9 : 8 + Math.sin(this.clock * 10 + e.id + i) * 3;
        g.fillStyle(0xe28c43, .55).fillTriangle(sx - 3, sy, sx + 4, sy, sx + 1, sy - flame).fillStyle(0xffd78a, .9).fillTriangle(sx - 1, sy, sx + 2, sy, sx + 1, sy - flame * .6);
      }
      if (e.spawn > 0) {
        sprite.setAlpha(.25 + (1 - Math.min(1, e.spawn)) * .3);
        danger.lineStyle(1.5, 0xec8e7b, .5).strokeCircle(e.x, e.y, e.radius + 8);
      }
      if (e.kind === 'elite' || e.kind === 'boss' || e.hp < e.maxHp && e.kind === 'armor') {
        const w = e.kind === 'boss' ? 82 : size * .8, y = e.y - size * .5 - 7;
        danger.fillStyle(0xcad4db, .9).fillRoundedRect(e.x - w / 2, y, w, 3.5, 1.5);
        danger.fillStyle(e.kind === 'boss' ? 0xe47172 : 0xe89173, 1).fillRoundedRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 3.5, 1.5);
      }
      if (e.action === 'windup') {
        if(e.kind==='poison') {
          danger.fillStyle(0x8fbe5c,.09).fillCircle(e.targetX,e.targetY,56).lineStyle(2,0x72a550,.85).strokeCircle(e.targetX,e.targetY,56);
          danger.lineStyle(1,0x72a550,.6).lineBetween(e.targetX-6,e.targetY,e.targetX+6,e.targetY).lineBetween(e.targetX,e.targetY-6,e.targetX,e.targetY+6);
        } else if(e.kind==='bomber') {
          const progress=1-Math.max(0,e.timer)/1.1;
          danger.fillStyle(0xf29d55,.10+progress*.10).fillCircle(e.x,e.y,72).lineStyle(2.5,0xe48450,.9).strokeCircle(e.x,e.y,72);
          danger.beginPath().lineStyle(3,0xfff0aa,1).arc(e.x,e.y,72,-Math.PI/2,-Math.PI/2+Math.PI*2*progress).strokePath();
        } else if (e.kind === 'spiker') {
          danger.lineStyle(2, 0xc58d4b, .8).strokeCircle(e.x, e.y, e.radius + 8);
          for (let i = 0; i < 6; i++) {
            const a = e.angle + i * Math.PI / 3;
            danger.lineStyle(2, 0xc58d4b, .3 + .3 * (1 - Math.min(1, e.timer))).lineBetween(e.x + Math.cos(a) * 23, e.y + Math.sin(a) * 23, e.x + Math.cos(a) * 155, e.y + Math.sin(a) * 155);
          }
        } else if (e.kind === 'shooter') {
          danger.lineStyle(1.2, 0xe08279, .55).lineBetween(e.x, e.y, e.x + Math.cos(e.angle) * 250, e.y + Math.sin(e.angle) * 250);
          danger.lineStyle(2, 0xef8a6e, 1).strokeCircle(e.x, e.y, e.radius + 5 + (Math.sin(e.timer * 20) + 1) * 2);
        } else if (e.kind === 'boss' && e.move % 4 === 1) {
          const gap = e.angle + .8, start = gap + 35 * Math.PI / 180, end = gap + Math.PI * 2 - 35 * Math.PI / 180;
          danger.beginPath().lineStyle(2, 0xe98379, .5).arc(e.x, e.y, 185, start, end).strokePath();
          danger.lineStyle(1, 0xe98379, .25).strokeCircle(e.x, e.y, 52);
        } else if (e.kind === 'boss' && e.move % 4 === 3) {
          danger.lineStyle(2, 0xe78f7e, .7).strokeCircle(e.x, e.y, e.radius + 13 + Math.sin(e.timer * 10) * 3);
        } else {
          const length = e.kind === 'stalker' ? 110 : e.kind === 'wisp' ? 100 : e.kind === 'charger' ? 175 : 220, half = e.radius * .7, dx = Math.cos(e.angle), dy = Math.sin(e.angle), color = e.kind === 'wisp' ? 0x4ba9b8 : 0xeb7067;
          danger.fillStyle(color, .16).beginPath().moveTo(e.x - dy * half, e.y + dx * half).lineTo(e.x + dx * length - dy * half, e.y + dy * length + dx * half).lineTo(e.x + dx * length + dy * half, e.y + dy * length - dx * half).lineTo(e.x + dy * half, e.y - dx * half).closePath().fillPath();
          danger.lineStyle(1.5, color, .8).lineBetween(e.x, e.y, e.x + dx * length, e.y + dy * length);
        }
      }
    }
    const lean = this.reducedMotion ? 0 : (s.velocity.x / 210 * effort * .10 + (phase?.phase === 'windup' ? -.18 * strain : phase?.phase === 'strike' ? .20 * strain : .08 * strain));
    const hx = s.player.x, hy = s.player.y + bob + (this.reducedMotion ? 0 : strain * 1.6);
    this.hero.setTexture(this.heroColor ? `hero-color-${this.heroColor}` : 'hero').setPosition(hx, hy).setDisplaySize(46 * (1 + .07 * strain), 46 * (1 - .08 * strain)).setRotation(lean).setAlpha(s.invincible > 0 && Math.sin(this.clock * 28) > 0 ? .55 : 1);
    this.drawEffort(hx, hy, lean, strain);
    if (s.passive.shield && run.bladeId === 'wado') {
      g.lineStyle(5, 0x8acbb8, .16).strokeCircle(hx, hy, 28);
      g.lineStyle(1.6, 0x6ab9a3, .8).strokeCircle(hx, hy, 27).lineStyle(1, 0xf4fff4, .9).strokeCircle(hx, hy, 24);
    }
    if (s.passive.haste > 0 && moving) g.lineStyle(7, 0xcd6c91, .22).lineBetween(hx, hy, hx - s.direction.x * 48, hy - s.direction.y * 48);
    if (s.dashTime > 0) {
      g.lineStyle(9, 0x5dc9d6, .13).lineBetween(s.player.x, s.player.y, s.player.x - s.direction.x * 58, s.player.y - s.direction.y * 58);
      g.lineStyle(3, 0x54becc, .4).lineBetween(s.player.x, s.player.y, s.player.x - s.direction.x * 45, s.player.y - s.direction.y * 45);
    }
    const speed=Math.hypot(s.velocity.x,s.velocity.y);
    const direction=moving?(s.dashTime>0?s.direction:{x:s.velocity.x/(speed||1),y:s.velocity.y/(speed||1)}):undefined;
    const rest=this.drag.pose(fxDt,direction,stats.mass,this.reducedMotion,{speed:s.dashTime>0?500:speed,range:stats.range});
    const presentation=this.drag.presentation(s.swing,this.reducedMotion);
    const swing=s.swing?bladePresentation(s.swing,s.aim,stats.arc*Math.PI/180,stats.mass,rest):null;
    const bladeAngle=swing?.angle??rest;
    if(s.swing && phase && swing && swing.opacity>0) {
      const opacity=swing.opacity,arc=stats.arc*Math.PI/180,start=s.swing.angle-arc*.5;
      this.slash.setVisible(true).setTexture(`slash-${t.slash}`).setPosition(s.player.x,s.player.y).setRotation(s.swing.angle+Math.PI/2).setDisplaySize(stats.range*2,stats.range*1.23).setAlpha(opacity*(this.simplified?.3:.45));
      g.beginPath().lineStyle((2+run.mastery*.7)*Math.min(2.5,stats.widthScale),BLADE_COLORS[run.tier],opacity*.7).arc(s.player.x,s.player.y,stats.range,start,bladeAngle).strokePath();
      this.bladeFlourish(run.tier,s.player.x,s.player.y,stats.range,s.swing.angle,arc,opacity,run.mastery);
    }
    const gripScale=(t.range-10)/510,guardOffset=76*gripScale;
    const bx=s.player.x+Math.cos(bladeAngle)*11,by=s.player.y+Math.sin(bladeAngle)*11;
    this.hilt.setTexture(`blade-${run.tier+1}`,'hilt').setScale(gripScale/2,gripScale*presentation.hiltScale/2).setPosition(bx,by).setRotation(bladeAngle);
    this.blade.setTexture(`blade-${run.tier+1}`,'body').setScale((stats.range-11-guardOffset)/868,gripScale*stats.widthScale*presentation.faceScale/2).setPosition(bx+Math.cos(bladeAngle)*guardOffset,by+Math.sin(bladeAngle)*guardOffset).setRotation(bladeAngle);
    const back=bladeBackGeometry(run.tier,{length:stats.range-11-guardOffset,fullHeight:256*gripScale*stats.widthScale,range:stats.range,widthScale:stats.widthScale,mass:stats.mass,...presentation});
    this.bladeBack.setPosition(this.blade.x,this.blade.y).setRotation(bladeAngle).setAlpha(presentation.backAlpha);
    this.bladeBack.fillStyle(back.colors.outline,1).fillPoints(back.outline,true).fillStyle(back.colors.plane,1).fillPoints(back.plane,true).lineStyle(.8,back.colors.highlight,.9).strokePoints(back.highlight,false);
    const tip={x:this.blade.x+Math.cos(bladeAngle)*back.tip.x-Math.sin(bladeAngle)*back.tip.y,y:this.blade.y+Math.sin(bladeAngle)*back.tip.x+Math.cos(bladeAngle)*back.tip.y};
    const contact=!s.swing && s.mode==='playing'?{...tip,player:{...s.player},range:stats.range,widthScale:stats.widthScale,mass:stats.mass,color:BLADE_COLORS[run.tier]}:undefined;
    this.drag.update(fxDt,contact,this.simplified,this.reducedMotion);
    for(const m of this.drag.marks) {
      const alpha=dragOpacity(m);
      this.grooves.lineStyle(m.width+1.4,dark?0x172536:0xffffff,alpha*.5).lineBetween(m.from.x,m.from.y+.7,m.to.x,m.to.y+.7);
      this.grooves.lineStyle(m.width,m.color,alpha).lineBetween(m.from.x,m.from.y,m.to.x,m.to.y);
      this.grooves.lineStyle(.65,dark?0xf7f2dc:0x263a50,alpha*.4).lineBetween(m.from.x,m.from.y-.8,m.to.x,m.to.y-.8);
    }
    if(contact) this.shadows.fillStyle(dark?0xadc7da:0x263a50,.19).fillEllipse(tip.x+1,tip.y+1,9+Math.min(18,stats.widthScale*2),4);
    for(const p of this.drag.sparks) {
      const alpha=1-p.age/p.life;
      this.friction.lineStyle(p.size*.7,0xffbb47,alpha*.7).lineBetween(p.x-p.vx*.018,p.y-p.vy*.018,p.x,p.y);
      this.friction.fillStyle(0xffe7a0,alpha).fillCircle(p.x,p.y,p.size*.48).fillStyle(0xffffff,alpha*.9).fillCircle(p.x,p.y,p.size*.20);
    }
    if(contact && this.drag.sparkFlash>0 && !this.reducedMotion) {
      const r=3.5*frictionProfile(stats.range,stats.widthScale).sparkScale,alpha=this.drag.sparkFlash;
      this.friction.fillStyle(0xffc34f,alpha*.22).fillCircle(tip.x,tip.y,r*1.7).lineStyle(1.3,0xfff6cb,alpha*.9).lineBetween(tip.x-r,tip.y,tip.x+r,tip.y).lineBetween(tip.x,tip.y-r,tip.x,tip.y+r);
    }
    if (stats.mass > 1.55) {
      const hand = this.hands;
      hand.lineStyle(3, 0x4c8cac, .9).lineBetween(hx + 5, hy + 8, bx, by);
      for (const offset of [-2, 5]) hand.fillStyle(0xedfaff, 1).fillCircle(bx + Math.cos(bladeAngle) * offset, by + Math.sin(bladeAngle) * offset, 3).lineStyle(1, 0x446981, 1).strokeCircle(bx + Math.cos(bladeAngle) * offset, by + Math.sin(bladeAngle) * offset, 3);
    }
    for (const wave of s.waves) {
      const color = TIERS[wave.tier].hex;
      const radius = (wave.kind === 'getsuga' ? 30 : wave.kind === 'moon' ? 23 : 18) + run.mastery * 3;
      g.beginPath().lineStyle(wave.kind === 'getsuga' ? 12 : 7, color, .16).arc(wave.x, wave.y, radius, wave.angle - 1.1, wave.angle + 1.1).strokePath();
      if (wave.kind === 'getsuga') g.beginPath().lineStyle(7, 0x3b2c48, .9).arc(wave.x, wave.y, radius - 2, wave.angle - 1.05, wave.angle + 1.05).strokePath();
      g.beginPath().lineStyle(2.5, color, .95).arc(wave.x, wave.y, radius, wave.angle - 1.1, wave.angle + 1.1).strokePath();
      g.beginPath().lineStyle(1.2, 0xffffff, 1).arc(wave.x, wave.y, radius - 1, wave.angle - 1.1, wave.angle + 1.1).strokePath();
    }
    if (s.relicState.shield) {
      g.fillStyle(0x82cee8, .08).fillCircle(s.player.x, s.player.y, 26);
      g.lineStyle(1.6, 0x88cfe7, .75).strokeCircle(s.player.x, s.player.y, 26);
      g.beginPath().lineStyle(2.2, 0xffffff, .9).arc(s.player.x, s.player.y, 22, -2.6, -1.9).strokePath();
    }
    for (const effect of this.relicFx) {
      effect.age += fxDt; const alpha = Math.max(0, 1 - effect.age / .24);
      if (effect.item === 'shield') {
        g.lineStyle(2, 0xa9def1, alpha).strokeCircle(effect.x, effect.y, 26 + (this.reducedMotion ? 0 : effect.age * 35));
        continue;
      }
      const dx = effect.toX - effect.x, dy = effect.toY - effect.y, length = Math.hypot(dx, dy) || 1;
      const count = this.reducedMotion ? 2 : 5;
      const points = Array.from({ length: count }, (_, i) => {
        const t = i / (count - 1), bend = i === 0 || i === count - 1 ? 0 : (i % 2 ? 1 : -1) * 5;
        return { x: effect.x + dx * t - dy / length * bend, y: effect.y + dy * t + dx / length * bend };
      });
      g.lineStyle(4, 0xaa8ad7, alpha * .5).strokePoints(points, false);
      g.lineStyle(1.5, 0xffedb2, alpha).strokePoints(points, false);
      g.fillStyle(0xfff5cf, alpha).fillCircle(effect.toX, effect.toY, 3);
    }
    this.relicFx = this.relicFx.filter(effect => effect.age < .24);
    for (const effect of this.passiveFx) {
      effect.age += fxDt;
      const progress = Math.min(1, effect.age / .5), alpha = 1 - progress;
      const color = TIERS.find(tier => tier.id === effect.skill)!.hex;
      const r = effect.radius * (this.reducedMotion ? .9 : .45 + progress * .55);
      g.lineStyle(effect.skill === 'dragon-slayer' ? 3 : 1.8, color, alpha * .8).strokeCircle(effect.x, effect.y, r);
      if (effect.skill === 'full-moon' || effect.skill === 'wado' || effect.skill === 'dragon-slayer') g.lineStyle(1, 0xfff5cc, alpha * .8).strokeCircle(effect.x, effect.y, r * .82);
      if (!this.reducedMotion && !this.simplified) for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3, x = effect.x + Math.cos(a) * r, y = effect.y + Math.sin(a) * r;
        g.fillStyle(color, alpha * .7).fillTriangle(x - 2, y + 3, x + 2, y + 3, x, y - 4);
      }
    }
    this.passiveFx = this.passiveFx.filter(effect => effect.age < .5);
    for (const b of s.bullets) {
      if (b.kind === 'spine') {
        const a = Math.atan2(b.vy, b.vx), x = Math.cos(a), y = Math.sin(a);
        danger.fillStyle(0xe6b867, 1).fillTriangle(b.x + x * 9, b.y + y * 9, b.x - x * 6 - y * 3.5, b.y - y * 6 + x * 3.5, b.x - x * 6 + y * 3.5, b.y - y * 6 - x * 3.5);
        danger.lineStyle(1.3, 0x9d6d3c, 1).lineBetween(b.x - x * 5, b.y - y * 5, b.x + x * 7, b.y + y * 7);
        continue;
      }
      danger.lineStyle(3, 0xeea087, .35).lineBetween(b.x, b.y, b.x - b.vx * .08, b.y - b.vy * .08);
      danger.fillStyle(0xe77d68, 1).fillCircle(b.x, b.y, 5.5).lineStyle(1.4, 0x9e4e50, 1).strokeCircle(b.x, b.y, 5.5).fillStyle(0xffedc1, 1).fillCircle(b.x - 1, b.y - 1, 2);
    }
    for (const shock of s.shocks) {
      const start = shock.gap + 35 * Math.PI / 180, end = shock.gap + Math.PI * 2 - 35 * Math.PI / 180;
      danger.beginPath().lineStyle(18, 0xe88676, .17).arc(shock.x, shock.y, shock.radius, start, end).strokePath();
      danger.beginPath().lineStyle(3, 0xe77b6e, .85).arc(shock.x, shock.y, shock.radius, start, end).strokePath();
    }
    for(const [id,age] of this.hitResponses) { if(age>.22) this.hitResponses.delete(id); else this.hitResponses.set(id,age+fxDt); }
    for(const c of this.contacts) {
      c.age+=fxDt; const progress=c.age/(c.death?.28:.16),alpha=Math.max(0,1-progress),r=c.death?8+progress*16:3+progress*6;
      if(c.death) g.lineStyle(1.5,c.color,alpha*.7).strokeCircle(c.x,c.y,r);
      else { g.lineStyle(2,0xfff5c7,alpha).lineBetween(c.x-r,c.y,c.x+r,c.y).lineBetween(c.x,c.y-r,c.x,c.y+r); }
    }
    this.contacts=this.contacts.filter(c=>c.age<(c.death?.28:.16));
    for (const p of this.particles) {
      p.age += fxDt; p.x += p.vx * fxDt; p.y += p.vy * fxDt;
      g.fillStyle(p.color, Math.max(0, 1 - p.age / p.life)).fillTriangle(p.x - p.size, p.y, p.x + p.size, p.y, p.x, p.y - p.size * 1.5);
    }
    this.particles = this.particles.filter(p => p.age < p.life);
    for (const label of this.labels) { label.age += fxDt; label.object.setY(label.startY - label.age * 30).setAlpha(Math.max(0, 1 - label.age / label.life)); }
    this.labels = this.labels.filter(label => { if (label.age < label.life) return true; label.object.setVisible(false); this.spareLabels.push(label.object); return false; });
  }

  private drawEffort(x: number, y: number, angle: number, strain: number) {
    const face = this.expression;
    face.setPosition(x, y).setRotation(angle).setScale(1 + .07 * strain, 1 - .08 * strain).setAlpha(this.hero.alpha);
    if (strain < .12) return;
    face.lineStyle(1.3,0x263a50,.75).lineBetween(-6,-8,-1,-6).lineBetween(4,-6,9,-8);
    if (strain > .3) {
      face.fillStyle(0x7ddbe9, 1).fillTriangle(21, -12, 18.5, -6, 23, -6).fillCircle(20.8, -6, 2.3);
      face.lineStyle(.8, 0xf5ffff, .9).lineBetween(21, -9, 20, -6);
    }
    if (strain > .75) face.fillStyle(0x89deee, .9).fillTriangle(-1, -6, -3.5, -1, .8, -1).fillCircle(-1.3, -.5, 2);
  }

  private bladeFlourish(tier: number, x: number, y: number, range: number, angle: number, arc: number, opacity: number, mastery: number) {
    if (this.reducedMotion || opacity < .08) return;
    const t = TIERS[tier], g = this.fx, start = angle - arc * .5, end = angle + arc * .5;
    const point = (a: number, r: number) => ({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
    const count = this.simplified ? 2 : 2 + mastery * 2;
    if (t.effect === 'moon' || t.effect === 'wind' || t.effect === 'eclipse') {
      const darkMoon = t.effect === 'eclipse';
      g.beginPath().lineStyle(darkMoon ? 6 : 1.5, darkMoon ? 0x463447 : t.hex, opacity * .5).arc(x, y, range - 10, start + .08, end - .12).strokePath();
      g.beginPath().lineStyle(1.4, darkMoon ? 0xf19bbb : 0xffffff, opacity * .85).arc(x, y, range - 13, start + .15, end - .2).strokePath();
      if (mastery < 1) return;
    }
    for (let i = 0; i < count; i++) {
      const a = start + arc * (i + .5) / count, p = point(a, range - 4), q = point(a, range + 7 + i % 2 * 4);
      const side = point(a + .035, range + 2), other = point(a - .035, range + 2);
      if (t.effect === 'frost' || t.effect === 'jade' || t.effect === 'eclipse') {
        g.fillStyle(t.effect === 'eclipse' ? 0x463447 : t.hex, opacity * .7).fillPoints([p, side, q, other], true);
        g.lineStyle(1, t.effect === 'eclipse' ? 0xf19bbb : 0xe4ffff, opacity * .9).lineBetween(p.x, p.y, q.x, q.y);
        if (t.effect === 'frost') g.lineStyle(1, t.hex, opacity * .65).lineBetween(side.x - 2, side.y, other.x + 2, other.y);
      } else if (t.effect === 'violet') {
        const mid = point(a + .05, range - 9), tail = point(a - .025, range - 21);
        g.beginPath().lineStyle(1.8, t.hex, opacity * .9).moveTo(q.x, q.y).lineTo(p.x, p.y).lineTo(mid.x, mid.y).lineTo(tail.x, tail.y).strokePath();
      } else if (t.effect === 'flame') {
        const tail = point(a - .07, range - 17), tip = point(a + .05, range + 13);
        g.fillStyle(t.hex, opacity * .35).fillTriangle(tail.x, tail.y, tip.x, tip.y, other.x, other.y);
        g.lineStyle(1.5, 0xffd37c, opacity * .9).lineBetween(p.x, p.y, tip.x, tip.y);
      } else if (t.effect === 'heavy') {
        const tail = point(a, range - 14);
        g.lineStyle(3, t.hex, opacity * .6).lineBetween(tail.x, tail.y, p.x, p.y);
      } else if (t.effect === 'ink') {
        g.beginPath().lineStyle(2.5, 0x405678, opacity * .55).arc(x, y, range - 7 - i * 4, a - .16, a + .1).strokePath();
      } else if (t.effect === 'wind') {
        g.beginPath().lineStyle(1, 0xf0fff8, opacity * .75).arc(x, y, range - 18 - i * 3, a - .23, a + .16).strokePath();
      } else if (t.effect === 'moon') {
        g.fillStyle(0xf2dfff, opacity * .85).fillCircle(q.x, q.y, 1.5);
      } else if (mastery > 0) {
        g.lineStyle(1, 0xe1f6ff, opacity * .75).lineBetween(p.x, p.y, q.x, q.y);
      }
    }
  }
}
