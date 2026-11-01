import type Phaser from 'phaser';
import { basicWeaponKind } from './config';
import { bladePresentation } from './feedback';
import { swingPhase, type EquipmentStats, type SwingTiming } from './equipment';
import type { BladeRun } from './simulation';

// Plain steel and wood; the same paths are used in cards, combat and 3D inspection.
export const BASIC_DESIGNS = {
  15: { body: 'M126 103 L534 70 Q566 68 600 100 L578 146 Q558 177 498 180 L126 151 Z', hilt: 'M24 110 H124 V148 H24 Q12 128 24 110 Z M118 94 H144 V164 H118 Z', light: '#adc6d4' },
  16: { body: 'M128 114 L551 110 L600 128 L551 146 L128 142 Z', hilt: 'M23 116 H122 V140 H23 Q10 128 23 116 Z M111 85 H140 V171 H111 Z', light: '#c1d8df' },
  18: { body: 'M502 123 L557 98 L600 128 L557 158 L502 133 Z', hilt: 'M20 121 H539 V135 H20 Q13 128 20 121 Z', light: '#b6c9d0' },
} as const;
export const BASIC_BOW_PATH = 'M200 52 Q393 256 200 460 L180 445 Q344 256 180 67 Z';
const svg = (body: string, width = 640, height = 256) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`)}`;
const outlined = (path: string, fill: string) => `<path d="${path}" fill="${fill}" stroke="#2d4352" stroke-width="7" stroke-linejoin="round"/>`;
export const BASIC_WEAPON_ART: Record<string, string> = Object.fromEntries(Object.entries(BASIC_DESIGNS).map(([index, d]) => [
  `blade-${Number(index) + 1}`, svg(outlined(d.hilt, '#a78051') + outlined(d.body, d.light) + `<path d="${Number(index) === 18 ? 'M549 127 L578 127' : 'M155 130 H535'}" fill="none" stroke="#eef5f7" stroke-width="4" stroke-linecap="round"/>`),
]));
const limbs = outlined(BASIC_BOW_PATH, '#b68a53') + '<rect x="307" y="227" width="29" height="58" rx="9" fill="#73614e" stroke="#2d4352" stroke-width="5"/>';
BASIC_WEAPON_ART['blade-18'] = svg(limbs + '<path d="M181 68 V444" stroke="#536777" stroke-width="4" fill="none"/>', 512, 512);
BASIC_WEAPON_ART['bow-limbs-18'] = svg(limbs, 512, 512);

export function basicMeleePose(index: number, swing: (SwingTiming & { angle: number }) | null, aim: number, stats: EquipmentStats) {
  const kind = basicWeaponKind(index), rest = aim + (kind === 'knife' ? .9 : kind === 'sword' ? .5 : 0);
  if (kind !== 'spear') {
    const pose = swing ? bladePresentation(swing, aim, stats.arc * Math.PI / 180, stats.mass, rest) : {angle: rest, opacity: 0};
    return {...pose, hand: 12, reach: stats.range};
  }
  let extension = 0, opacity = 0;
  if (swing) {
    const {phase, progress} = swingPhase(swing);
    if (phase === 'strike') { extension = progress <= .45 ? progress / .45 : 1 - (progress - .45) / .55 * .35; opacity = Math.sin(Math.PI * progress); }
    if (phase === 'recovery') extension = .65 * (1 - progress);
  }
  const hand = 12 - (stats.range - 12) * .4 * (1 - extension);
  return {angle: swing?.angle ?? aim, opacity, hand, reach: hand + stats.range - 12};
}

export function drawBasicMelee(g: Phaser.GameObjects.Graphics, run: BladeRun, sprite: (id: string, texture: string, x: number, y: number, size: number, depth: number) => Phaser.GameObjects.Image) {
  const s = run.state, stats = run.stats, kind = basicWeaponKind(run.tier), pose = basicMeleePose(run.tier, s.swing, s.aim, stats);
  const a = pose.angle, dx = Math.cos(a), dy = Math.sin(a), x = s.player.x + dx * pose.hand, y = s.player.y + dy * pose.hand;
  const length = (stats.range - 12) * 640 / 544;
  sprite('basic-weapon', `blade-${run.tier + 1}`, x, y, length, 28).setOrigin(56 / 640, .5).setRotation(a).setDisplaySize(length, length * .4 * Math.min(2.5, Math.sqrt(stats.widthScale)));
  if (s.swing && pose.opacity > 0) {
    if (kind === 'spear') {
      const tx = s.player.x + dx * pose.reach, ty = s.player.y + dy * pose.reach;
      g.lineStyle(stats.thrustWidth * 2 + 4, 0xa6c7d7, pose.opacity * .2).lineBetween(s.player.x, s.player.y, tx, ty);
      g.lineStyle(2, 0xf7fcff, pose.opacity).lineBetween(s.player.x + dx * 25, s.player.y + dy * 25, tx, ty);
    } else {
      const arc = stats.arc * Math.PI / 180, start = s.swing.angle - arc / 2;
      for (const [r, w, alpha] of [[.97, kind === 'knife' ? 15 : 6, .16], [1, 2.5, .8]])
        g.lineStyle(w * Math.sqrt(stats.widthScale), 0x90b9cc, pose.opacity * alpha).beginPath().arc(s.player.x, s.player.y, stats.range * r, start, a).strokePath();
    }
  }
}
