import { COIN_ART, GEAR_ART } from './gear-art';
import { BLADE_ART } from './blade-art';
import { MONSTER_ART } from './monster-art';

const files = import.meta.glob(['./assets/heal.png', './assets/slash-*.png', './assets/food/*.webp'], { eager: true, query: '?inline', import: 'default' }) as Record<string, string>;
export const ASSETS: Record<string, string> = { coin: COIN_ART, ...Object.fromEntries(Object.entries(GEAR_ART).map(([id, url]) => ['gear-' + id, url])), ...Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace(/\.(png|webp)$/, ''), url])), ...BLADE_ART, ...MONSTER_ART };
