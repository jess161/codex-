import { BLADE_ART } from './blade-art';
import { MONSTER_ART } from './monster-art';

const files = import.meta.glob(['./assets/heal.png', './assets/slash-*.png'], { eager: true, query: '?inline', import: 'default' }) as Record<string, string>;
export const ASSETS: Record<string, string> = { ...Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace('.png', ''), url])), ...BLADE_ART, ...MONSTER_ART };
