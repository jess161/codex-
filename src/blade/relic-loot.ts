import {RELIC_IDS,RELIC_CAP,RELICS,eligibleRelics,weightedRelic,isRelicId,type RelicId,type RelicInventory} from './relics';
export interface RelicDrop {id:number;x:number;y:number;relic:RelicId;spawn:number;group?:number}
export interface RelicLootState {rng:number;lastNormal:number;normalDrops:number;totalDropped:number;picked:number;order:RelicId[]}
export const freshRelicLoot=(seed:number):RelicLootState=>({rng:(seed^0x71b4ca39)>>>0,lastNormal:0,normalDrops:0,totalDropped:0,picked:0,order:[]});
export function relicRandom(s:RelicLootState){
 let t=s.rng+=0x6d2b79f5;s.rng>>>=0;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;
}
export function dropCandidates(items:RelicInventory,level:number,range:number){
 return eligibleRelics(items,level,range);
}
export function drawRelic(s:RelicLootState,pool:RelicId[],items:RelicInventory,level:number,elite:boolean):RelicId|undefined {
 if(!pool.length)return;
 let eligible=pool;
 if(elite){const high=pool.filter(id=>!['common','rare'].includes(RELICS[id].rarity));if(high.length)eligible=high;}
 else if(s.totalDropped===0){const opening=pool.filter(id=>['stone','ruler','anvil','ember','echo','comet'].includes(id));if(opening.length)eligible=opening;}
 else {
  const owned=pool.filter(id=>items[id]>0),unowned=pool.filter(id=>!items[id]);
  const bias=owned.length>=6?.7:owned.length>=3?.45:.15;
  if(owned.length&&unowned.length)eligible=relicRandom(s)<bias?owned:unowned;
 }
 return weightedRelic(eligible,relicRandom(s),level);
}
export function validRelicLoot(v:unknown):v is RelicLootState {
 if(!v||typeof v!=='object')return false;const s=v as RelicLootState;
 return Number.isInteger(s.rng)&&s.rng>=0&&s.rng<=4294967295&&Number.isFinite(s.lastNormal)&&s.lastNormal>=0
 &&[s.normalDrops,s.totalDropped,s.picked].every(n=>Number.isInteger(n)&&n>=0&&n<=1e6)&&s.normalDrops<=s.totalDropped
 &&Array.isArray(s.order)&&s.order.length<=30&&s.order.every(isRelicId)&&new Set(s.order).size===s.order.length;
}
export function validRelicDrops(v:unknown):v is RelicDrop[]{
 return Array.isArray(v)&&v.every(d=>d&&Number.isInteger(d.id)&&d.id>0&&Number.isFinite(d.x)&&Number.isFinite(d.y)&&isRelicId(d.relic)
 &&Number.isFinite(d.spawn)&&d.spawn>=0&&d.spawn<=.281&&(d.group===undefined||Number.isInteger(d.group)&&d.group>0));
}
