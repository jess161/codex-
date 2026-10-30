import type { RelicId } from './relics';
const images = import.meta.glob('./assets/relics/*.webp', { eager: true, query: '?inline', import: 'default' }) as Record<string, string>;
export const RELIC_ART = Object.fromEntries(Object.entries(images).map(([path, url]) => [path.split('/').at(-1)!.replace('.webp', ''), url])) as Record<RelicId, string>;
export const relicIcon = (id: RelicId) => `<img class="relic-icon" src="${RELIC_ART[id]}" alt="" aria-hidden="true" draggable="false">`;
