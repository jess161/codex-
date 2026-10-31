import { angleDelta } from './config';
import { swingPhase, type SwingTiming } from './equipment';
export type ImpactQuality = 'light' | 'solid' | 'heavy' | 'cleave';
export function impactFeedback(damage: number, mass: number, targets: number, elite = false) {
  const quality: ImpactQuality = targets >= 4 ? 'cleave' : elite || mass >= 3 || damage >= 65 ? 'heavy' : damage >= 24 || mass >= 1.6 ? 'solid' : 'light';
  const index = ['light','solid','heavy','cleave'].indexOf(quality);
  return { quality, index, hitStop: [0,.018,.032,.045][index], shake: [.25,.7,1.6,2.7][index], squash: [.05,.08,.12,.14][index] };
}
export function squashResponse(age: number, duration = .22) { return age < duration ? Math.sin(Math.min(1, age / duration) * Math.PI * 2) * (1 - age / duration) ** 2 : 0; }
export function cameraImpulse(age: number, strength: number) {
  if (age >= .16) return { x: 0, y: 0 };
  const fade = (1 - age / .16) ** 2; return { x: Math.sin(age * 105) * strength * fade, y: Math.sin(age * 73) * strength * .55 * fade };
}
export function bladePresentation(swing: SwingTiming & { angle: number }, aim: number, arc: number, mass: number, rest: number) {
  const { phase, progress } = swingPhase(swing), eased = progress * progress * (3 - 2 * progress), start = swing.angle - arc / 2;
  if (phase === 'windup') return { angle: rest + angleDelta(start - .12, rest) * eased, opacity: 0 };
  if (phase === 'strike') {
    // The physical contact threshold is at 45% of the strike; the visible edge agrees there.
    const p = progress <= .45 ? .5 * (progress / .45) ** .65 : .5 + .5 * (1 - (1 - (progress - .45) / .55) ** 2);
    return { angle: start + arc * p, opacity: Math.sin(Math.PI * progress) };
  }
  const end = swing.angle + arc / 2; return { angle: end + angleDelta(rest, end) * eased, opacity: (1 - progress) * .35 };
}
