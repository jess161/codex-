import Phaser from 'phaser';
import { RENDITION_LAYOUT } from '../assets/carrot-sword/rendition-layout';
import { WEAPON_VFX_PROFILES, type VFXElement } from './profiles';

interface Point { x: number; y: number }
export interface WeaponVFXPose {
  x: number; y: number; angle: number; scaleX: number; scaleY: number; texture: string;
  attackId?: number; striking: boolean;
}
interface TrailSample { base: Point; tip: Point; age: number; attack: number }
interface Mote { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number }
interface Burst { x: number; y: number; age: number; life: number; size: number }

const ART = RENDITION_LAYOUT, SPAN = ART.tip[0] - ART.grip[0];
// Keep the supplied painted silhouette; only the surrounding light is procedural.
const OUTLINE = Array.from(ART.outline.matchAll(/(-?\d+)\s+(-?\d+)/g), m => ({
  x: (+m[1] - ART.grip[0]) / SPAN, y: (+m[2] - ART.grip[1]) / SPAN,
}));
const LIMITS = { full: { particles: 32, trail: 56, hits: 12, reactions: 4 }, low: { particles: 10, trail: 24, hits: 5, reactions: 2 } };

/** Rendering only. No simulation, enemy references, damage, timers or global RNG. */
export class WeaponVFX {
  readonly root: Phaser.GameObjects.Container;
  readonly WeaponSprite: Phaser.GameObjects.Image;
  readonly InnerAura: Phaser.GameObjects.Graphics;
  readonly OuterAura: Phaser.GameObjects.Graphics;
  readonly ElementParticles: Phaser.GameObjects.Graphics;
  readonly AttackTrail: Phaser.GameObjects.Graphics;
  readonly HitVFX: Phaser.GameObjects.Graphics;
  readonly ReactionVFX: Phaser.GameObjects.Graphics;
  element: VFXElement = 'none';
  reducedMotion = false;
  simplified = false;
  private pose?: WeaponVFXPose;
  private time = 0;
  private boost = 0;
  private auraAlpha = .24;
  private attackId?: number;
  private previous?: WeaponVFXPose;
  private trail: TrailSample[] = [];
  private motes: Mote[] = [];
  private hits: Burst[] = [];
  private reactions: Burst[] = [];
  private emission = 0;
  private serial = 0;
  private visible = true;

  constructor(private readonly scene: Phaser.Scene, depth = 27.15) {
    const graphics = (name: string) => scene.add.graphics().setName(name);
    this.InnerAura = graphics('InnerAura');
    this.OuterAura = graphics('OuterAura');
    this.ElementParticles = graphics('ElementParticles');
    this.WeaponSprite = scene.add.image(0, 0, this.texture('carrot-rendition-base')).setName('WeaponSprite')
      .setOrigin(ART.grip[0] / ART.width, ART.grip[1] / ART.height).setDisplaySize(ART.width / SPAN, ART.height / SPAN);
    this.root = scene.add.container(0, 0, [this.InnerAura, this.OuterAura, this.WeaponSprite, this.ElementParticles])
      .setName('WeaponVFXRoot').setDepth(depth);
    // Historical trails and impacts stay in world space after the weapon moves away.
    this.AttackTrail = graphics('AttackTrail').setDepth(depth - .01);
    this.HitVFX = graphics('HitVFX').setDepth(depth + .16);
    this.ReactionVFX = graphics('ReactionVFX').setDepth(depth + .15);
  }

  private texture(requested: string) {
    if (this.scene.textures.exists(requested)) return requested;
    const key = 'weapon-vfx-placeholder';
    if (!this.scene.textures.exists(key)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 });
      const sx = 424 / ART.width, sy = 288 / ART.height;
      g.fillStyle(0xf49a43).lineStyle(3, 0x29475d).beginPath()
        .moveTo(700 * sx, 450 * sy).lineTo(1545 * sx, 575 * sy)
        .lineTo(700 * sx, 700 * sy).closePath().fillPath().strokePath();
      g.fillStyle(0x79b65c).fillEllipse(310 * sx, 575 * sy, 390 * sx, 170 * sy);
      g.lineStyle(16 * sx, 0x85603d).lineBetween(310 * sx, 575 * sy, 700 * sx, 575 * sy);
      g.generateTexture(key, 424, 288); g.destroy();
    }
    return key;
  }

  setPose(pose: WeaponVFXPose) {
    this.pose = { ...pose };
    this.root.setPosition(pose.x, pose.y).setRotation(pose.angle).setScale(pose.scaleX * SPAN, pose.scaleY * SPAN);
    this.WeaponSprite.setTexture(this.texture(pose.texture)).setDisplaySize(ART.width / SPAN, ART.height / SPAN);
    if (pose.attackId !== undefined && pose.attackId !== this.attackId) {
      this.attackId = pose.attackId; this.boost = 1;
    }
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    for (const object of [this.root, this.AttackTrail, this.HitVFX, this.ReactionVFX]) object.setVisible(visible);
    if (!visible) this.reset();
  }

  hit(x: number, y: number, size = 1) {
    const cap = this.limits.hits;
    if (this.hits.length >= cap) this.hits.shift();
    this.hits.push({ x, y, age: 0, life: .28, size: Phaser.Math.Clamp(size, .5, 2) });
  }

  reaction(x: number, y: number, size = 1) {
    if (this.reactions.length >= this.limits.reactions) this.reactions.shift();
    this.reactions.push({ x, y, age: 0, life: .6, size: Phaser.Math.Clamp(size, .5, 2) });
  }

  private get limits() { return this.simplified ? LIMITS.low : LIMITS.full; }
  private point(pose: WeaponVFXPose, distance: number): Point {
    return { x: pose.x + Math.cos(pose.angle) * pose.scaleX * SPAN * distance,
      y: pose.y + Math.sin(pose.angle) * pose.scaleX * SPAN * distance };
  }

  private sampleTrail(dt: number) {
    const pose = this.pose, old = this.previous;
    if (!pose) return;
    const same = old?.striking && old.attackId === pose.attackId;
    const delta = old ? Phaser.Math.Angle.Wrap(pose.angle - old.angle) : 0;
    const length = Math.abs(pose.scaleX * SPAN);
    const continuous = same && Math.hypot(pose.x - old.x, pose.y - old.y) < Math.max(24, length * .6)
      && Math.abs(delta) < Math.PI * .6 && Math.abs(pose.scaleX / old.scaleX - 1) < .2;
    if (pose.striking && pose.attackId !== undefined && dt > 0) {
      // Interpolate the real rendered motion, never a predetermined slash arc.
      const steps = continuous ? Math.min(8, Math.max(1, Math.ceil(Math.abs(delta) / .045))) : 1;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const p = continuous ? { ...pose, x: Phaser.Math.Linear(old.x, pose.x, t), y: Phaser.Math.Linear(old.y, pose.y, t), angle: old.angle + delta * t } : pose;
        this.trail.push({ base: this.point(p, .25), tip: this.point(p, 1), age: 0, attack: pose.attackId });
        // A discontinuity starts a fresh ribbon even during the same swing.
        if (!continuous && i === 1 && this.trail.length > 1) this.trail[this.trail.length - 2].attack = -1;
      }
      if (this.trail.length > this.limits.trail) this.trail.splice(0, this.trail.length - this.limits.trail);
    }
    this.previous = { ...pose };
  }

  update(delta: number) {
    if (!this.visible || !this.pose) return;
    const dt = Phaser.Math.Clamp(delta, 0, .05), profile = WEAPON_VFX_PROFILES[this.element];
    this.time += dt;
    this.boost *= Math.exp(-dt * 9);
    const idle = this.reducedMotion ? .24 : .24 + Math.sin(this.time * 2.4) * .075;
    const target = idle + this.boost * (this.reducedMotion ? .1 : .34);
    this.auraAlpha += (target - this.auraAlpha) * (1 - Math.exp(-dt * 14));
    const inner = this.InnerAura.clear().setAlpha(this.auraAlpha);
    for (const [width, alpha] of [[.075, .16], [.035, .33], [.012, .7]]) {
      inner.lineStyle(width, profile.color, alpha).strokePoints(OUTLINE, true);
    }
    const outer = this.OuterAura.clear().setAlpha(this.reducedMotion ? .15 : .18 + this.boost * .17);
    for (let i = 0; i < (this.simplified ? 2 : 3); i++) {
      const phase = (this.time * (this.reducedMotion ? 0 : .45) + i / 3) % 1;
      const x = .13 + phase * .85, y = Math.sin(phase * Math.PI * 2 + i) * .11;
      outer.lineStyle(.01, profile.light, Math.sin(phase * Math.PI) * .8)
        .beginPath().moveTo(x - .12, y).lineTo(x, y * .8).lineTo(x + .09, y * .55).strokePath();
    }
    this.emission = Math.min(2, this.emission + dt * (this.reducedMotion ? 0 : profile.particleRate));
    while (this.emission >= 1) {
      this.emission--;
      if (this.motes.length >= this.limits.particles) break;
      const n = ++this.serial;
      this.motes.push({ x: .25 + ((n * .618) % .72), y: Math.sin(n * 2.4) * .09,
        vx: -.035, vy: Math.sin(n) * .04, age: 0, life: .55 + (n % 3) * .12, size: .008 + (n % 2) * .004 });
    }
    const particles = this.ElementParticles.clear();
    this.motes = this.motes.filter(p => (p.age += dt) < p.life);
    for (const p of this.motes) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      particles.fillStyle(profile.light, Math.sin(p.age / p.life * Math.PI) * .55).fillCircle(p.x, p.y, p.size);
    }
    this.trail = this.trail.filter(p => (p.age += dt) < (this.reducedMotion ? .09 : .18));
    this.sampleTrail(dt);
    const trail = this.AttackTrail.clear();
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1], b = this.trail[i];
      if (a.attack !== b.attack) continue;
      const fade = Math.max(0, 1 - a.age / (this.reducedMotion ? .09 : .18));
      trail.fillStyle(profile.color, fade * .15)
        .fillTriangle(a.base.x, a.base.y, a.tip.x, a.tip.y, b.tip.x, b.tip.y)
        .fillTriangle(a.base.x, a.base.y, b.tip.x, b.tip.y, b.base.x, b.base.y);
      trail.lineStyle(1.2, profile.light, fade * .7).lineBetween(a.tip.x, a.tip.y, b.tip.x, b.tip.y);
    }
    this.drawBursts(this.HitVFX, this.hits, dt, false);
    this.drawBursts(this.ReactionVFX, this.reactions, dt, true);
  }

  private drawBursts(g: Phaser.GameObjects.Graphics, bursts: Burst[], dt: number, reaction: boolean) {
    g.clear();
    const profile = WEAPON_VFX_PROFILES[this.element];
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.age += dt;
      if (b.age >= b.life) { bursts.splice(i, 1); continue; }
      const t = b.age / b.life, fade = (1 - t) ** 2;
      const radius = (reaction ? 12 + t * (this.reducedMotion ? 15 : 42) : 2 + t * 17) * b.size;
      g.lineStyle(reaction ? 2 : 1.2, profile.color, fade * .65).strokeCircle(b.x, b.y, radius);
      const rays = this.simplified || this.reducedMotion ? 4 : reaction ? 10 : 6;
      for (let j = 0; j < rays; j++) {
        const a = j / rays * Math.PI * 2 + .35, c = Math.cos(a), s = Math.sin(a);
        g.lineStyle(reaction ? 2 : 1.5, profile.light, fade).lineBetween(b.x + c * radius * .45, b.y + s * radius * .45, b.x + c * radius, b.y + s * radius);
      }
    }
  }

  get counts() {
    const particles = this.motes.length, auras = this.visible && this.pose ? 2 : 0;
    const trail = this.trail.reduce((n, p, i, samples) => n + (i > 0 && samples[i - 1].attack === p.attack ? 1 : 0), 0);
    return { auras, particles, trail, hits: this.hits.length, reactions: this.reactions.length,
      total: auras + particles + trail + this.hits.length + this.reactions.length,
      auraAlpha: this.auraAlpha };
  }

  reset() {
    this.trail = []; this.motes = []; this.hits = []; this.reactions = [];
    this.previous = undefined; this.pose = undefined; this.attackId = undefined;
    this.boost = 0; this.auraAlpha = .24; this.emission = 0; this.time = 0; this.serial = 0;
    for (const g of [this.InnerAura, this.OuterAura, this.ElementParticles, this.AttackTrail, this.HitVFX, this.ReactionVFX]) g.clear();
  }

  destroy() {
    this.reset(); this.root.destroy(); this.AttackTrail.destroy(); this.HitVFX.destroy(); this.ReactionVFX.destroy();
  }
}
