// Lossless sprites generated as one consistent family; originals and anchors are recorded in art/reconstructed.
const files = import.meta.glob('./assets/orbs/*.webp', { eager:true, query:'?inline', import:'default' }) as Record<string,string>;
export const MONSTER_ART: Record<string,string> = Object.fromEntries(Object.entries(files).map(([p,url])=>[p.split('/').pop()!.replace('.webp',''),url]));
