// Passive collectibles are independent of the blade's innate story passive.
export const RELIC_IDS = ['stone', 'ruler', 'anvil', 'feather', 'bell', 'hourglass', 'ember', 'crystal', 'thunder', 'heart', 'magnet', 'star'] as const;
export type RelicId = typeof RELIC_IDS[number];
export type RelicGroup = 'forge' | 'wind' | 'arcane' | 'spirit';
export type RelicInventory = Record<RelicId, number>;
export const RELIC_CAP = 4;
export const RELIC_GROUPS = {
  forge: { name: '铸刃', color: '#b98532', tint: '#fff3d8', two: '伤害额外 +8%', three: '刀长额外 +10%，击退 +15%' },
  wind: { name: '疾风', color: '#278d83', tint: '#e1f8f1', two: '挥刀负担降低 33%', three: '瞬步冷却缩短 15%' },
  arcane: { name: '灵能', color: '#8c63bc', tint: '#f0e8ff', two: '道具灼烧与闪电伤害 +20%', three: '直击异常状态敌人，伤害 +10%' },
  spirit: { name: '灵护', color: '#bd6381', tint: '#ffeaf0', two: '治疗效果 +20%', three: '获得泡泡盾，破碎后 20 秒恢复' },
} as const;
export const RELICS: Record<RelicId, { name: string; group: RelicGroup; column: number; row: number; effect: string; note: string }> = {
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
export const freshRelics = (): RelicInventory => Object.fromEntries(RELIC_IDS.map(id => [id, 0])) as RelicInventory;
export interface RelicState { lightning: number; shield: boolean; shieldCooldown: number }
export const freshRelicState = (): RelicState => ({ lightning: 0, shield: false, shieldCooldown: 0 });
export const isRelicId = (id: unknown): id is RelicId => typeof id === 'string' && Object.hasOwn(RELICS, id);
export function relicGroups(items: RelicInventory): Record<RelicGroup, number> {
  const counts = { forge: 0, wind: 0, arcane: 0, spirit: 0 };
  for (const id of RELIC_IDS) if (items[id] > 0) counts[RELICS[id].group]++;
  return counts;
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
  return ''; // All stable IDs are handled above.
}
// Old forge choices get a stable one-time equivalent. Existing forge stacks remain intact.
export const LEGACY_RELICS: Record<string, RelicId> = { sharp: 'stone', long: 'ruler', range: 'ruler', broad: 'anvil', giant: 'anvil', hollow: 'feather', grip: 'feather', stride: 'bell', quick: 'hourglass', force: 'thunder', vital: 'heart', heal: 'heart', magnet: 'magnet' };
