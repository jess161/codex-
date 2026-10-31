export const THREATS = {
  poison: { from: 210, cap: 3, windup: .85, radius: 56, duration: 3.2, damage: 3, cooldown: 6.2 },
  bomber: { from: 300, cap: 5, windup: 1.1, trigger: 96, radius: 72, damage: 18 },
  stalker: { from: 420, cap: 5, windup: .8, trigger: 125, charge: .42, speed: 260, recovery: 1.15 },
} as const;
export interface Hazard { id: number; kind: 'poison' | 'blast'; x: number; y: number; radius: number; age: number; duration: number; damage: number }
export function stalkerCloaked(e: { action: string; hit: number; burnTime: number; freeze: number; stun: number; reveal?: number }) {
  return e.action === 'idle' && e.hit <= 0 && e.burnTime <= 0 && e.freeze <= 0 && e.stun <= 0 && (e.reveal ?? 0) <= 0;
}
