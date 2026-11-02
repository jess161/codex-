import { GEAR, type GearId } from './gear';
const images=import.meta.glob('./assets/seasonings/*.webp',{eager:true,query:'?inline',import:'default'}) as Record<string,string>;
export const GEAR_ART=Object.fromEntries(Object.entries(images).map(([path,url])=>[path.split('/').at(-1)!.replace('.webp',''),url])) as Record<GearId,string>;
// The existing coin is a simple vector symbol; all seven seasoning icons are generated raster art.
export const COIN_ART='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="gold" x2=".3" y2="1"><stop stop-color="#fff0a3"/><stop offset="1" stop-color="#f3b950"/></linearGradient></defs><g stroke="#29475d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><circle cx="64" cy="64" r="49" fill="url(#gold)"/><circle cx="64" cy="64" r="36" fill="none" stroke="#d69440" stroke-width="4"/><path d="M64 39v50m12-39H59q-14 0-14 11t17 11h7q14 0 14 10t-15 11H51" fill="none" stroke-width="6"/><path d="M29 49q8-20 28-22" fill="none" stroke="white" stroke-width="6"/></g></svg>');
export const gearIcon=(id:GearId)=>`<img class="gear-icon" src="${GEAR_ART[id]}" alt="${GEAR[id].name}" draggable="false">`;
export const coinIcon=()=>`<img class="coin-icon" src="${COIN_ART}" alt="" draggable="false">`;
