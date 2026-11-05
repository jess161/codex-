import Phaser from 'phaser';
import { RENDITION_LAYOUT } from '../assets/carrot-sword/rendition-layout';
import type { CarrotElements } from '../carrot-elements';
import { activeVFXElements, type VFXElement } from './profiles';
import { ELEMENT_VFX_CONFIG as E, WEAPON_VFX_CONFIG as C } from './config';
import { drawElementIdle, type Point } from './element-renderers';
import { drawElementImpact, type Impact } from './impact-renderers';
import { drawElementTrail, type TrailSample } from './trail-renderers';

export interface WeaponVFXPose {
  x: number; y: number; angle: number; scaleX: number; scaleY: number; texture: string;
  attackId?: number; striking: boolean;
}
interface Bolt { age: number; life: number; gap: number; points: Point[] }
interface Reaction { x: number; y: number; age: number; size: number }
const ART = RENDITION_LAYOUT, SPAN = ART.tip[0] - ART.grip[0], TAU = Math.PI * 2;
const OUTLINE = Array.from(ART.outline.matchAll(/(-?\d+)\s+(-?\d+)/g), m => ({
  x: (+m[1] - ART.grip[0]) / SPAN, y: (+m[2] - ART.grip[1]) / SPAN,
}));

/** Seven rendering layers; no damage, enemy references, status ticks or combat RNG. */
export class WeaponVFX {
  readonly root: Phaser.GameObjects.Container;
  readonly WeaponSprite: Phaser.GameObjects.Image;
  readonly InnerAura: Phaser.GameObjects.Graphics;
  readonly OuterAura: Phaser.GameObjects.Graphics;
  readonly ElementParticles: Phaser.GameObjects.Graphics;
  readonly AttackTrail: Phaser.GameObjects.Graphics;
  readonly HitVFX: Phaser.GameObjects.Graphics;
  readonly ReactionVFX: Phaser.GameObjects.Graphics;
  reducedMotion = false;
  simplified = false;
  private elements: CarrotElements = { fire: 0, frost: 0, poison: 0, electric: 0 };
  private active: VFXElement[] = ['none'];
  private pose?: WeaponVFXPose;
  private previous?: WeaponVFXPose;
  private time = 0;
  private boost = 0;
  private auraAlpha = E.none.alpha.inner[0];
  private attackId?: number;
  private trail: TrailSample[] = [];
  private hits: Impact[] = [];
  private reactions: Reaction[] = [];
  private bolts: Bolt[] = [];
  private boltLifetimes: number[] = [];
  private randomState = C.seed;
  private visible = true;
  private electricArcs = 0;
  private elementalCounts = { fire: 0, ice: 0, poison: 0 };
  private particles = 0;
  private pulses: Partial<Record<VFXElement, number>> = {};

  constructor(private readonly scene: Phaser.Scene, depth = 27.15) {
    const graphics = (name: string) => scene.add.graphics().setName(name);
    this.InnerAura = graphics('InnerAura');
    this.OuterAura = graphics('OuterAura');
    this.ElementParticles = graphics('ElementParticles');
    this.WeaponSprite = scene.add.image(0, 0, this.texture('carrot-rendition-base')).setName('WeaponSprite')
      .setOrigin(ART.grip[0] / ART.width, ART.grip[1] / ART.height).setDisplaySize(ART.width / SPAN, ART.height / SPAN);
    this.root = scene.add.container(0, 0, [this.InnerAura, this.OuterAura, this.WeaponSprite, this.ElementParticles])
      .setName('WeaponVFXRoot').setDepth(depth);
    this.AttackTrail = graphics('AttackTrail').setDepth(depth - .01);
    this.HitVFX = graphics('HitVFX').setDepth(depth + .16);
    this.ReactionVFX = graphics('ReactionVFX').setDepth(depth + .15);
  }

  private texture(requested: string) {
    if (this.scene.textures.exists(requested)) return requested;
    const key = 'weapon-vfx-placeholder';
    if (!this.scene.textures.exists(key)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }), colors = C.placeholder;
      const sx = 424 / ART.width, sy = 288 / ART.height;
      g.fillStyle(colors.body).lineStyle(3, colors.outline).beginPath()
        .moveTo(700 * sx, 450 * sy).lineTo(1545 * sx, 575 * sy)
        .lineTo(700 * sx, 700 * sy).closePath().fillPath().strokePath();
      g.fillStyle(colors.leaf).fillEllipse(310 * sx, 575 * sy, 390 * sx, 170 * sy)
        .lineStyle(16 * sx, colors.grip).lineBetween(310 * sx, 575 * sy, 700 * sx, 575 * sy);
      g.generateTexture(key, 424, 288); g.destroy();
    }
    return key;
  }

  setPose(pose: WeaponVFXPose) {
    const wasStriking = this.pose?.striking && this.pose.attackId === pose.attackId;
    this.pose = { ...pose };
    this.root.setPosition(pose.x, pose.y).setRotation(pose.angle).setScale(pose.scaleX * SPAN, pose.scaleY * SPAN);
    this.WeaponSprite.setTexture(this.texture(pose.texture)).setDisplaySize(ART.width / SPAN, ART.height / SPAN).setAlpha(1);
    if (pose.attackId !== undefined && pose.attackId !== this.attackId) {
      this.attackId = pose.attackId; this.boost = C.attack.windupGain;
    }
    if (pose.striking && !wasStriking) this.boost = C.attack.strikeGain;
  }

  setElements(elements: CarrotElements) {
    if (!elements.electric || !this.elements.electric) this.bolts = [];
    this.elements = { ...elements };
    this.active = activeVFXElements(elements);
  }

  setVisible(visible: boolean) {
    if (this.visible && !visible) this.reset();
    this.visible = visible;
    for (const object of [this.root, this.AttackTrail, this.HitVFX, this.ReactionVFX]) object.setVisible(visible);
  }

  hit(x: number, y: number, size = 1, elements = this.elements) {
    const active = activeVFXElements(elements);
    if (this.hits.length >= this.limits.hits) this.hits.shift();
    this.hits.push({ x, y, age: 0, life: Math.max(...active.map(key => E[key].hit.life)),
      size: Phaser.Math.Clamp(size, C.hit.minSize, C.hit.maxSize), seed: this.random() * TAU, elements: active });
  }

  reaction(x: number, y: number, size = 1) {
    if (this.reactions.length >= this.limits.reactions) this.reactions.shift();
    this.reactions.push({ x, y, age: 0, size: Phaser.Math.Clamp(size, C.hit.minSize, C.hit.maxSize) });
  }

  private random() {
    let x = this.randomState; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.randomState = x >>> 0; return this.randomState / 0x100000000;
  }
  private between(range: readonly [number, number]) { return range[0] + (range[1] - range[0]) * this.random(); }
  private get limits() { return this.simplified ? C.limits.low : C.limits.full; }
  private count(n: number, rank = 1) {
    if (!n) return 0;
    return Math.max(1, Math.round(n * (this.reducedMotion ? C.quality.reducedCount : this.simplified ? C.quality.simplifiedCount : 1)
      * (1 + Math.max(0, rank - 1) * C.quality.rankCountGain)));
  }
  private worldPixels(pixels: number) {
    const dpr = this.scene.game.canvas.width / Math.max(1, this.scene.game.canvas.clientWidth);
    return pixels * dpr / Math.max(.01, this.scene.cameras.main.zoom);
  }
  private localPixels(pixels: number) {
    return this.worldPixels(pixels) / Math.max(.01, Math.min(Math.abs(this.root.scaleX), Math.abs(this.root.scaleY)));
  }
  private point(pose: WeaponVFXPose, distance: number): Point {
    return { x: pose.x + Math.cos(pose.angle) * pose.scaleX * SPAN * distance,
      y: pose.y + Math.sin(pose.angle) * pose.scaleX * SPAN * distance };
  }

  private sampleTrail(dt: number) {
    const pose = this.pose, old = this.previous;
    if (!pose) return;
    const delta = old ? Phaser.Math.Angle.Wrap(pose.angle - old.angle) : 0;
    const continuous = old?.striking && old.attackId === pose.attackId
      && Math.hypot(pose.x - old.x, pose.y - old.y) < Math.max(C.trail.teleport, Math.abs(pose.scaleX * SPAN) * C.trail.teleportRatio)
      && Math.abs(delta) < C.trail.maxAngle && Math.abs(pose.scaleX / old.scaleX - 1) < C.trail.maxScaleDelta;
    if (pose.striking && pose.attackId !== undefined && dt > 0) {
      const steps = continuous ? Math.min(C.trail.maxSteps, Math.max(1, Math.ceil(Math.abs(delta) / C.trail.stepAngle))) : 1;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const p = continuous ? { ...pose, x: Phaser.Math.Linear(old.x, pose.x, t), y: Phaser.Math.Linear(old.y, pose.y, t), angle: old.angle + delta * t } : pose;
        this.trail.push({ base: this.point(p, C.geometry.trailBase), tip: this.point(p, 1), age: 0,
          attack: pose.attackId, connect: !!continuous || i > 1, elements: [...this.active] });
      }
      if (this.trail.length > this.limits.trail) this.trail.splice(0, this.trail.length - this.limits.trail);
    }
    this.previous = { ...pose };
  }

  private newBolt(): Bolt {
    const start = C.geometry.start + this.random() * (C.geometry.end - C.geometry.start - C.lightning.length[1]);
    const length = this.between(C.lightning.length), side = this.random() > .5 ? 1 : -1;
    const points: Point[] = [];
    for (let i = 0; i <= C.lightning.segments; i++) {
      const u = i / C.lightning.segments, x = start + length * u;
      points.push({ x, y: side * (C.geometry.edge * (1 - x) + C.geometry.tipEdge)
        + (this.random() * 2 - 1) * C.lightning.jitter * Math.sin(u * Math.PI) });
    }
    const life = this.between(C.lightning.duration);
    this.boltLifetimes.push(life);
    if (this.boltLifetimes.length > C.lightning.history) this.boltLifetimes.shift();
    return { age: 0, life, gap: this.between(C.lightning.gap), points };
  }

  private drawLightning(dt: number, alpha: number) {
    this.electricArcs = 0;
    if (!this.elements.electric) { this.bolts = []; return; }
    const cfg = E.lightning, target = this.count(cfg.counts.electric, this.elements.electric);
    while (this.bolts.length < target) this.bolts.push(this.newBolt());
    this.bolts.length = target;
    for (let i = 0; i < this.bolts.length; i++) {
      let bolt = this.bolts[i];
      if (!this.reducedMotion) bolt.age += dt;
      if (bolt.age >= bolt.life + bolt.gap) bolt = this.bolts[i] = this.newBolt();
      if (!this.reducedMotion && bolt.age >= bolt.life) continue;
      const a = this.reducedMotion ? C.lightning.staticAlpha : cfg.alpha.foreground + this.boost * C.lightning.attackGain;
      const width = this.localPixels(C.lightning.edgePx);
      this.OuterAura.lineStyle(width * C.lightning.glowScale, cfg.colors.main, a * C.lightning.glowAlpha * alpha).strokePoints(bolt.points, false);
      this.ElementParticles.lineStyle(width, cfg.colors.main, a * alpha).strokePoints(bolt.points, false)
        .lineStyle(width * C.lightning.coreScale, cfg.colors.light, a * alpha).strokePoints(bolt.points, false);
      this.electricArcs++;
    }
  }

  update(delta: number) {
    if (!this.visible || !this.pose) return;
    const dt = Phaser.Math.Clamp(delta, 0, C.maxDelta);
    this.time += dt; this.boost *= Math.exp(-dt / C.attack.release);
    const inner = this.InnerAura.clear(), back = this.OuterAura.clear(), front = this.ElementParticles.clear();
    this.elementalCounts = { fire: 0, ice: 0, poison: 0 }; this.particles = 0; this.pulses = {};
    const multiAlpha = this.active.length > 1 ? C.quality.multiAlpha : 1;
    const scale = Math.sqrt(Math.abs(this.root.scaleX * this.root.scaleY));
    const up = { x: -Math.sin(this.pose.angle) * scale / this.root.scaleX, y: -Math.cos(this.pose.angle) * scale / this.root.scaleY };
    let totalAlpha = 0;
    for (const element of this.active) {
      const cfg = E[element], cycle = this.reducedMotion ? .5 : .5 - .5 * Math.cos(TAU * this.time / cfg.timing.breath);
      const pulse = Phaser.Math.Linear(...cfg.alpha.inner, cycle) + this.boost * C.attack.alphaGain;
      this.pulses[element] = pulse; totalAlpha += pulse;
      for (let i = 0; i < C.silhouette.widths.length; i++) inner.lineStyle(C.silhouette.widths[i], cfg.colors.main,
        C.silhouette.alpha[i] * pulse * multiAlpha).strokePoints(OUTLINE, true);
      const rank = element === 'fire' ? this.elements.fire : element === 'ice' ? this.elements.frost : element === 'poison' ? this.elements.poison : this.elements.electric;
      const live = drawElementIdle(element, { back, front, time: this.time, boost: this.boost, rank,
        alpha: multiAlpha * (C.quality.breathFloor + cycle * C.quality.breathGain), reduced: this.reducedMotion,
        count: n => this.count(n, rank), pixels: n => this.localPixels(n), up });
      if (element === 'fire' || element === 'ice' || element === 'poison') this.elementalCounts[element] = live;
      else this.particles += live;
    }
    this.auraAlpha = totalAlpha / this.active.length;
    this.drawLightning(dt, multiAlpha);
    this.trail = this.trail.filter(s => (s.age += dt) < (this.reducedMotion ? C.trail.reducedLife : Math.max(...s.elements.map(e => E[e].trail.life))));
    this.sampleTrail(dt);
    const trail = this.AttackTrail.clear();
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1], b = this.trail[i];
      if (!b.connect || a.attack !== b.attack) continue;
      for (const element of b.elements) drawElementTrail(trail, a, b, element, i, this.reducedMotion, n => this.worldPixels(n));
    }
    this.hits = this.hits.filter(b => (b.age += dt) < b.life);
    const hits = this.HitVFX.clear();
    for (const b of this.hits) for (const element of b.elements) drawElementImpact(hits, b, element, this.reducedMotion, this.simplified);
    this.drawReactions(dt);
  }

  private drawReactions(dt: number) {
    const g = this.ReactionVFX.clear(), cfg = C.reaction;
    this.reactions = this.reactions.filter(r => (r.age += dt) < cfg.life);
    for (const r of this.reactions) {
      const t = r.age / cfg.life, radius = (cfg.radius + t * (this.reducedMotion ? cfg.reducedTravel : cfg.travel)) * r.size;
      g.lineStyle(cfg.lineWidth, cfg.colors[0], cfg.alpha * (1 - t) ** 2).strokeCircle(r.x, r.y, radius);
      for (let i = 0, count = this.count(cfg.count); i < count; i++) {
        const angle = i / count * TAU;
        g.lineStyle(cfg.lineWidth, cfg.colors[1], cfg.alpha * (1 - t))
          .lineBetween(r.x + Math.cos(angle) * radius * .5, r.y + Math.sin(angle) * radius * .5,
            r.x + Math.cos(angle) * radius, r.y + Math.sin(angle) * radius);
      }
    }
  }

  get counts() {
    const auras = this.visible && this.pose ? 2 : 0;
    const trail = this.trail.reduce((n, p, i, samples) => n + (i > 0 && p.connect && samples[i - 1].attack === p.attack ? 1 : 0), 0);
    const elemental = this.elementalCounts.fire + this.elementalCounts.ice + this.elementalCounts.poison;
    return { auras, particles: this.particles, trail, elemental: { ...this.elementalCounts }, electricArcs: this.electricArcs,
      hits: this.hits.length, reactions: this.reactions.length,
      total: auras + this.particles + trail + elemental + this.electricArcs + this.hits.length + this.reactions.length,
      auraAlpha: this.auraAlpha };
  }

  get diagnostics() {
    return { time: this.time, state: this.hits.length ? 'hit' : this.pose?.attackId !== undefined ? 'attack' : 'idle',
      active: [...this.active], pulses: { ...this.pulses },
      periods: Object.fromEntries(this.active.map(e => [e, E[e].timing.breath])),
      boltLifetimes: [...this.boltLifetimes], activeBolts: this.bolts.filter(b => b.age < b.life).map(b => ({ age: b.age, life: b.life })),
      hitElements: this.hits.flatMap(b => b.elements), weaponAlpha: this.WeaponSprite.alpha, counts: this.counts };
  }

  reset() {
    this.trail = []; this.hits = []; this.reactions = []; this.bolts = []; this.boltLifetimes = [];
    this.previous = undefined; this.pose = undefined; this.attackId = undefined;
    this.boost = 0; this.auraAlpha = E.none.alpha.inner[0]; this.time = 0; this.randomState = C.seed;
    this.electricArcs = 0; this.elementalCounts = { fire: 0, ice: 0, poison: 0 }; this.particles = 0; this.pulses = {};
    for (const g of [this.InnerAura, this.OuterAura, this.ElementParticles, this.AttackTrail, this.HitVFX, this.ReactionVFX]) if (g.scene) g.clear();
  }

  destroy() {
    this.reset(); this.root.destroy(); this.AttackTrail.destroy(); this.HitVFX.destroy(); this.ReactionVFX.destroy();
  }
}
