import { NEW_RELICS, expandedRelicDetail } from './expanded-relics';
// Stable IDs let old collections survive the expanded catalogue.
export const BASE_RELIC_IDS = ['stone', 'ruler', 'anvil', 'feather', 'bell', 'hourglass', 'ember', 'crystal', 'thunder', 'heart', 'magnet', 'star'] as const;
export const RELIC_IDS = [...BASE_RELIC_IDS, ...Object.keys(NEW_RELICS) as (keyof typeof NEW_RELICS)[]] as const;
export type RelicId = typeof RELIC_IDS[number];
export type RelicGroup = 'forge' | 'wind' | 'arcane' | 'spirit' | 'hunt' | 'chaos';
export type RelicInventory = Record<RelicId, number>;
export const RELIC_CAP = 5;
// Only used to validate historical v7 inventories before migration.
export const LEGACY_RELIC_SLOTS = 5;
export const RARITIES = {
  common:{name:'普通',color:'#6d8196',tint:'#edf2f7',weight:45},
  rare:{name:'稀有',color:'#268caa',tint:'#e4f7ff',weight:28},
  epic:{name:'史诗',color:'#9161bf',tint:'#f1e7ff',weight:16},
  legendary:{name:'传说',color:'#b98121',tint:'#fff2d5',weight:7},
  mythic:{name:'神话',color:'#c85c91',tint:'#ffe6f2',weight:3},
  chaos:{name:'混沌',color:'#7950b6',tint:'#eee4ff',weight:1},
} as const;
export type RelicRarity = keyof typeof RARITIES;
export const RELIC_GROUPS = {
  forge: { name: '铸刃', color: '#b98532', tint: '#fff3d8', two: '伤害额外 +8%', three: '刀长额外 +10%，击退 +15%' },
  wind: { name: '疾风', color: '#278d83', tint: '#e1f8f1', two: '挥刀负担降低 33%', three: '瞬步冷却缩短 15%' },
  arcane: { name: '灵能', color: '#8c63bc', tint: '#f0e8ff', two: '道具灼烧、毒伤与闪电伤害 +20%', three: '直击异常状态敌人，伤害 +10%' },
  spirit: { name: '灵护', color: '#bd6381', tint: '#ffeaf0', two: '治疗效果 +20%', three: '获得泡泡盾，破碎后 20 秒恢复' },
  hunt: {name:'猎杀',color:'#bb6c3d',tint:'#fff0df',two:'暴击率 +8%，暴击伤害提升至 200%',three:'击杀减少 0.04 秒挥刀等待'},
  chaos: {name:'混沌',color:'#7554ac',tint:'#ede5ff',two:'灼烧、毒伤和闪电伤害 +20%',three:'半血以下伤害 +25%，额外减伤 8%'},
} as const;
const ORIGINAL_RELICS: Record<typeof BASE_RELIC_IDS[number], { name: string; group: RelicGroup; column: number; row: number; effect: string; note: string }> = {
  stone: { name: '磨刀石', group: 'forge', column: 0, row: 0, effect: '基础伤害加成 +18%', note: '锋芒更盛，适合每一种刀。' },
  ruler: { name: '伸缩尺', group: 'forge', column: 0, row: 1, effect: '刀身长度加成 +33%', note: '刀尖更远，也会增加负重。刀长上限 420。' },
  anvil: { name: '铸刃铁砧', group: 'forge', column: 0, row: 2, effect: '刀宽加成 +52.5%，基础伤害加成 +15%', note: '宽厚的巨刃更重，可搭配轻羽。' },
  feather: { name: '轻羽', group: 'wind', column: 1, row: 0, effect: '当前刀重 −14%', note: '保留刀具尺寸，减轻移动与挥刀负担。' },
  bell: { name: '风铃', group: 'wind', column: 1, row: 1, effect: '基础移速 +7%', note: '同时改善起步与转向。' },
  hourglass: { name: '流沙漏', group: 'wind', column: 1, row: 2, effect: '当前基础挥砍间隔 −8%', note: '实际间隔仍受蓄力、出刀与收刀时间限制。' },
  ember: { name: '火种', group: 'arcane', column: 2, row: 0, effect: '直击附加 2 秒灼烧', note: '每级每半秒造成 4% 刀伤。刷新不叠层，不削弱刀具自带灼烧。' },
  crystal: { name: '冰晶', group: 'arcane', column: 2, row: 1, effect: '直击附加 16% 减速，持续 1.2 秒', note: '每升一级减速再加 4%；精英与首领最多减速 15%。' },
  thunder: { name: '雷珠', group: 'arcane', column: 2, row: 2, effect: '每 6 次有效挥砍释放连锁闪电', note: '初始 70% 刀伤，最多 3 个目标。每级周期减少 1 次、伤害增加 15%。' },
  heart: { name: '心泡', group: 'spirit', column: 3, row: 0, effect: '生命上限 +15，立即恢复 15 生命', note: '本局保留，治疗受灵护组合加成。' },
  magnet: { name: '小磁铁', group: 'spirit', column: 3, row: 1, effect: '经验吸取范围加成 +25%', note: '经验球仍需进入吸取范围才会靠近。' },
  star: { name: '星糖', group: 'spirit', column: 3, row: 2, effect: '拾取经验 +6%', note: '每颗经验只加成一次。达到最高等级后不再出现。' },
};
const BASE_RARITY: Record<typeof BASE_RELIC_IDS[number], RelicRarity> = {stone:'common',ruler:'rare',anvil:'epic',feather:'common',bell:'common',hourglass:'rare',ember:'epic',crystal:'epic',thunder:'epic',heart:'common',magnet:'common',star:'common'};
export interface RelicDefinition {name:string;group:RelicGroup;rarity:RelicRarity;effect:string;note:string;column?:number;row?:number}
export const RELICS = Object.fromEntries([...BASE_RELIC_IDS.map(id=>[id,{...ORIGINAL_RELICS[id],rarity:BASE_RARITY[id]}]),...Object.entries(NEW_RELICS)]) as Record<RelicId,RelicDefinition>;
export const freshRelics = (): RelicInventory => Object.fromEntries(RELIC_IDS.map(id => [id, 0])) as RelicInventory;
export interface RelicState {lightning:number;shield:boolean;shieldCooldown:number;echo:number;comet:number;vortex:number;leechCooldown:number;phoenixUsed:boolean;dashWave:boolean;heartPeak:number}
export const freshRelicState = (): RelicState => ({lightning:0,shield:false,shieldCooldown:0,echo:0,comet:0,vortex:0,leechCooldown:0,phoenixUsed:false,dashWave:false,heartPeak:0});
export const isRelicId = (id: unknown): id is RelicId => typeof id === 'string' && Object.hasOwn(RELICS, id);
export function relicGroups(items: RelicInventory): Record<RelicGroup, number> {
  const counts = { forge: 0, wind: 0, arcane: 0, spirit: 0, hunt:0,chaos:0 };
  for (const id of RELIC_IDS) if (items[id] > 0) counts[RELICS[id].group]++;
  return counts;
}
export const ownedRelics = (items: RelicInventory) => RELIC_IDS.filter(id=>items[id]>0);
export function eligibleRelics(items:RelicInventory,level:number,range:number) {
  return RELIC_IDS.filter(id=>items[id]<RELIC_CAP&&(id!=='star'||level<30)&&(id!=='ruler'||range<419.999));
}
export function weightedRelic(pool:readonly RelicId[],roll:number,level:number):RelicId {
  const progress=Math.max(0,Math.min(1,(level-1)/29));
  const weights=pool.map(id=>{const rarity=RELICS[id].rarity;return RARITIES[rarity].weight*(rarity==='chaos'?1+2*progress:rarity==='mythic'?1+progress:rarity==='legendary'?1+.5*progress:1);});
  let cursor=Math.max(0,Math.min(.999999,roll))*weights.reduce((a,b)=>a+b,0);
  for(let i=0;i<pool.length;i++){cursor-=weights[i];if(cursor<0)return pool[i];}
  return pool[pool.length-1];
}
export function validRelics(value: unknown): value is RelicInventory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const items = value as RelicInventory;
  return Object.keys(items).length === RELIC_IDS.length && RELIC_IDS.every(id => Number.isInteger(items[id]) && items[id] >= 0 && items[id] <= RELIC_CAP);
}
export function relicDetail(id: RelicId, rank: number) {
  if (id === 'stone') return `基础伤害加成累计 +${rank * 18}%`;
  if (id === 'ruler') return `刀身长度加成累计 +${rank * 33}%`;
  if (id === 'anvil') return `刀宽加成累计 +${rank * 52.5}%，基础伤害加成 +${rank * 15}%`;
  if (id === 'feather') return `刀重合计 −${Math.round((1 - .86 ** rank) * 100)}%`;
  if (id === 'bell') return `基础移速累计 +${rank * 7}%`;
  if (id === 'hourglass') return `基础挥砍间隔合计 −${Math.round((1 - .92 ** rank) * 100)}%`;
  if (id === 'heart') return `生命上限累计 +${rank * 15}`;
  if (id === 'magnet') return `经验吸取范围加成累计 +${rank * 25}%`;
  if (id === 'ember') return `每半秒造成 ${rank * 4}% 刀伤，持续 2 秒`;
  if (id === 'crystal') return `减速 ${12 + rank * 4}%，持续 1.2 秒`;
  if (id === 'thunder') return `每 ${7 - rank} 次有效挥砍，连锁 ${Math.round((.55 + rank * .15) * 100)}% 刀伤`;
  if (id === 'star') return `拾取经验 +${rank * 6}%`;
  return expandedRelicDetail(id as keyof typeof NEW_RELICS,rank);
}
// Old forge choices get a stable one-time equivalent. Existing forge stacks remain intact.
export const LEGACY_RELICS: Record<string, RelicId> = { sharp: 'stone', long: 'ruler', range: 'ruler', broad: 'anvil', giant: 'anvil', hollow: 'feather', grip: 'feather', stride: 'bell', quick: 'hourglass', force: 'thunder', vital: 'heart', heal: 'heart', magnet: 'magnet' };
