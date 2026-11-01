import { swingPhase, type SwingTiming } from './equipment';
interface Point { x: number; y: number }
export interface DragContact extends Point { player: Point; range: number; widthScale: number; mass: number; color: number; markWidth?: number }
export interface DragMark { from: Point; to: Point; width: number; strength: number; age: number; life: number; color: number }
export interface DragSpark extends Point { origin: Point; vx: number; vy: number; age: number; life: number; size: number }
export const DRAG_REST_ANGLE = Math.PI * .30;
export const DRAG_REST_INCLINATION = Math.PI / 4;
export const DRAG_LIMITS = { normal: 320, simplified: 112 } as const;
export const DRAG_SPARK_LIMITS = { normal: 40, simplified: 14 } as const;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const angleDifference = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export function frictionProfile(range: number, widthScale: number) {
  const length = clamp((range - 60) / 360, 0, 1), breadth = clamp((widthScale - 1) / 7, 0, 1);
  return { growth: length * .55 + breadth * .45, sparkScale: 1 + length * 1.3 + breadth * 1.1 };
}
export function dragProfile(range: number, widthScale: number, mass: number) {
  const length = clamp((range - 60) / 360, 0, 1), breadth = clamp((widthScale - 1) / 7, 0, 1), weight = clamp((mass - 1) / 8, 0, 1);
  return { width: 1.8 + length * 1.4 + breadth * 2.7 + weight, strength: .46 + length * .12 + breadth * .10 + weight * .08, life: 3 + length * .7 + weight * .8 };
}
export const dragOpacity = (m: DragMark) => m.strength * Math.max(0, 1 - m.age / m.life) ** 1.15;
export class BladeDrag {
  angle = DRAG_REST_ANGLE; inclination = DRAG_REST_INCLINATION; bank = 0;
  marks: DragMark[] = []; sparks: DragSpark[] = []; sparkFlash = 0; contact?: DragContact;
  private anchor?: DragContact; private lastPlayer?: Point; private heading?: number; private previousSpeed = 0;
  private sparkCooldown = 0; private sparkSeed = 0x63a4971;
  pose(dt: number, direction: Point | undefined, mass: number, reducedMotion: boolean, motion: { speed?: number; range?: number } = {}) {
    if (dt <= 0) return this.angle;
    const speed = direction ? motion.speed ?? 210 : 0;
    if (direction) this.heading = Math.atan2(direction.y, direction.x);
    if (reducedMotion) {
      this.bank = 0; this.inclination = DRAG_REST_INCLINATION; this.previousSpeed = speed;
      if (direction) this.angle = this.heading! + Math.PI - .20;
      this.angle = Math.atan2(Math.sin(this.angle), Math.cos(this.angle)); return this.angle;
    }
    const weight = clamp((mass - 1) / 8, 0, 1), length = clamp(((motion.range ?? 72) - 72) / 348, 0, 1);
    const pace = clamp(speed / 210, 0, 1.25), acceleration = clamp((speed - this.previousSpeed) / (dt * 1800), -1, 1); this.previousSpeed = speed;
    const side = .17 + pace * (.20 - length * .05), trailing = this.heading === undefined ? DRAG_REST_ANGLE : this.heading + Math.PI - side;
    const turn = direction ? clamp(angleDifference(this.angle, trailing) * .3, -.30, .30) : 0, settle = 1 - Math.exp(-dt * (9 - weight * 3));
    this.bank += (turn - this.bank) * settle;
    const target = clamp(DRAG_REST_INCLINATION + pace * .055 - length * .045 * Math.min(1, pace) - weight * .025 * Math.min(1, pace) + Math.abs(this.bank) * .12 + acceleration * .035, Math.PI * 35 / 180, Math.PI * 55 / 180);
    this.inclination += (target - this.inclination) * settle;
    this.angle += angleDifference(this.angle, trailing - this.bank * .35) * (1 - Math.exp(-dt * 10 / (1 + clamp(mass - 1, 0, 10) * .22)));
    this.angle = Math.atan2(Math.sin(this.angle), Math.cos(this.angle)); return this.angle;
  }
  presentation(swing: SwingTiming | null, reducedMotion = false) {
    let opening = 0;
    if (swing) { const { phase, progress } = swingPhase(swing), eased = progress * progress * (3 - 2 * progress); opening = reducedMotion || phase === 'strike' ? 1 : phase === 'windup' ? eased : 1 - eased; }
    const inclination = (reducedMotion ? DRAG_REST_INCLINATION : this.inclination) * (1 - opening);
    // Deliberate visual exaggeration: quarter-width at 45 degrees, full face on the strike.
    const faceScale = Math.cos(inclination) ** 4;
    return { opening, inclination, faceScale, faceAlpha: 1, backAlpha: 1 - opening, hiltScale: faceScale };
  }
  faceScale(swing: SwingTiming | null, reducedMotion = false) { return this.presentation(swing, reducedMotion).faceScale; }
  update(dt: number, contact: DragContact | undefined, simplified: boolean, reducedMotion = false) {
    if (reducedMotion) this.clearSparks();
    if (dt > 0) {
      for (const m of this.marks) m.age += dt; this.marks = this.marks.filter(m => m.age < m.life);
      for (const p of this.sparks) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 100 * dt; }
      this.sparks = this.sparks.filter(p => p.age < p.life); this.sparkFlash = Math.max(0, this.sparkFlash - dt * 11); this.sparkCooldown = Math.max(0, this.sparkCooldown - dt);
    }
    const sparkLimit = simplified ? 14 : 40, limit = simplified ? 112 : 320;
    if (this.sparks.length > sparkLimit) this.sparks.splice(0, this.sparks.length - sparkLimit);
    if (this.marks.length > limit) this.marks.splice(0, this.marks.length - limit);
    this.contact = contact;
    if (!contact) { this.sparkFlash = 0; this.sparkCooldown = 0; this.disconnect(); return; }
    if (dt <= 0) { this.disconnect(); return; }
    const previous = this.anchor, step = this.lastPlayer ? distance(contact.player, this.lastPlayer) : 0;
    const heading = this.lastPlayer ? Math.atan2(contact.player.y - this.lastPlayer.y, contact.player.x - this.lastPlayer.x) : 0;
    this.lastPlayer = { ...contact.player };
    if (!previous || step > 80 || previous.color !== contact.color || Math.abs(previous.range - contact.range) > .01 || Math.abs(previous.widthScale - contact.widthScale) > .01) {
      this.anchor = contact; this.sparkFlash = 0; this.sparkCooldown = 0; return;
    }
    if (step < .02) { this.anchor = contact; this.sparkFlash = 0; return; }
    const length = distance(previous, contact), spacing = simplified ? 10 : 6;
    if (length > Math.max(96, contact.range * .55)) { this.anchor = contact; this.sparkFlash = 0; return; }
    if (!reducedMotion && this.sparkCooldown <= 0) {
      const { growth, sparkScale } = frictionProfile(contact.range, contact.widthScale), pace = clamp(step / dt / 210, 0, 1.3);
      const count = simplified ? 1 + Math.floor(growth * 2) : 3 + Math.floor(growth * 3);
      for (let i = 0; i < count && this.sparks.length < sparkLimit; i++) {
        const angle = heading + Math.PI + (this.sparkRandom() - .5) * (1.8 + growth * .55), speed = (38 + this.sparkRandom() * 45) * (1 + growth * .9);
        this.sparks.push({ x: contact.x, y: contact.y, origin: { x: contact.x, y: contact.y }, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 20 - growth * 20, age: 0, life: .16 + this.sparkRandom() * .07 + growth * .05, size: (1.4 + this.sparkRandom() * .6) * sparkScale });
      }
      this.sparkFlash = .8 + growth * .2; this.sparkCooldown = Math.max(.045, .09 - growth * .03 - pace * .012) * (simplified ? 1.6 : 1);
    }
    if (length < spacing) return;
    this.anchor = contact; const count = Math.min(simplified ? 12 : 24, Math.ceil(length / spacing)), profile = dragProfile(contact.range, contact.widthScale, contact.mass);
    if(contact.markWidth!==undefined)profile.width=contact.markWidth;
    let from: Point = { x: previous.x, y: previous.y };
    for (let i = 1; i <= count; i++) { const t = i / count, to = { x: previous.x + (contact.x - previous.x) * t, y: previous.y + (contact.y - previous.y) * t }; this.marks.push({ from, to, ...profile, color: contact.color, age: 0 }); from = to; }
    if (this.marks.length > limit) this.marks.splice(0, this.marks.length - limit);
  }
  private sparkRandom() { let s = this.sparkSeed; s ^= s << 13; s ^= s >>> 17; s ^= s << 5; this.sparkSeed = s; return (s >>> 0) / 4294967296; }
  private disconnect() { this.anchor = undefined; this.lastPlayer = undefined; }
  clearSparks() { this.sparks = []; this.sparkFlash = 0; this.sparkCooldown = 0; }
  reset() { this.angle = DRAG_REST_ANGLE; this.inclination = DRAG_REST_INCLINATION; this.bank = 0; this.heading = undefined; this.previousSpeed = 0; this.marks = []; this.contact = undefined; this.disconnect(); this.clearSparks(); this.sparkSeed = 0x63a4971; }
}
