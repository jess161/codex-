export type Point = { x: number; y: number };
export type ItemId = 'wood' | 'stone' | 'fiber' | 'coconut' | 'berries' | 'scrap' | 'fish' | 'water' | 'meal' | 'bandage';
export type RecipeId = 'axe' | 'spear' | 'campfire' | 'shelter' | 'catcher' | 'signal' | 'bandage';
export type StructureKind = 'campfire' | 'shelter' | 'catcher' | 'signal';
export type NodeKind = 'wood' | 'stone' | 'fiber' | 'palm' | 'berries' | 'wreck' | 'spring' | 'fishing' | 'relic';
export type Inventory = Record<ItemId, number>;
export interface WorldNode extends Point { id: string; kind: NodeKind; remaining: number; variant: number }
export interface Recipe { id: RecipeId; name: string; en: string; category: 'tools' | 'camp'; description: string; costs: Partial<Inventory>; requires?: RecipeId[]; structure?: StructureKind }

export const ITEMS: Record<ItemId, { name: string; description: string; icon: string }> = {
  wood: { name: '木材', description: '海浪送来的第一份馈赠。用于制作工具与搭建营地。', icon: 'wood' },
  stone: { name: '石料', description: '磨制工具，也为营火围出一圈安全。', icon: 'stone' },
  fiber: { name: '纤维', description: '柔韧的植物纤维，可以搓绳、编织和包扎。', icon: 'fiber' },
  coconut: { name: '椰子', description: '食物 +12 · 水分 +28。树荫里藏着生的希望。', icon: 'coconut' },
  berries: { name: '野果', description: '食物 +20 · 水分 +5。岛上可以放心食用的红色浆果。', icon: 'berries' },
  scrap: { name: '残骸零件', description: '船上残留的金属，能用来搭建求救信号台。', icon: 'scrap' },
  fish: { name: '鲜鱼', description: '在营火旁按 E 烤熟后食用，需要 1 份木材。', icon: 'fish' },
  water: { name: '淡水', description: '水分 +45。清洁的饮水永远值得珍惜。', icon: 'water' },
  meal: { name: '烤鱼', description: '食物 +50 · 生命 +8。一顿热饭，就是家的开始。', icon: 'meal' },
  bandage: { name: '草药绷带', description: '生命 +32。来自岛屿的治愈。', icon: 'bandage' },
};
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export const EMPTY_INVENTORY = (): Inventory => Object.fromEntries(ITEM_IDS.map(id => [id, 0])) as Inventory;

export const RECIPES: Recipe[] = [
  { id: 'axe', name: '石斧', en: 'STONE AXE', category: 'tools', description: '解锁椰树采集，木材收获翻倍。让双手更有力量。', costs: { wood: 3, stone: 2, fiber: 2 } },
  { id: 'spear', name: '木矛', en: 'WOODEN SPEAR', category: 'tools', description: '在浅滩捕鱼，也能驱赶林地里的野猪。', costs: { wood: 4, stone: 2, fiber: 2 }, requires: ['axe'] },
  { id: 'bandage', name: '草药绷带', en: 'HERBAL BANDAGE', category: 'tools', description: '编织纤维，敷上草药。恢复 32 点生命。', costs: { fiber: 3, berries: 1 } },
  { id: 'campfire', name: '营火', en: 'CAMPFIRE', category: 'camp', description: '抵御寒夜，烤熟鲜鱼。在火光里找回一点勇气。', costs: { wood: 5, stone: 4 }, structure: 'campfire' },
  { id: 'shelter', name: '棕叶庇护所', en: 'LEAF SHELTER', category: 'camp', description: '抵挡风雨。靠近按 E，休息到下一次日出。', costs: { wood: 8, fiber: 6 }, requires: ['axe'], structure: 'shelter' },
  { id: 'catcher', name: '集雨器', en: 'RAIN COLLECTOR', category: 'camp', description: '每 55 秒收集一份淡水，雨天效率加倍。', costs: { wood: 4, fiber: 4, stone: 2 }, structure: 'catcher' },
  { id: 'signal', name: '求救信号台', en: 'SIGNAL BEACON', category: 'camp', description: '第三天起有船经过。准备好信号台，再添 3 份木材点火。', costs: { wood: 12, stone: 6, scrap: 3, fiber: 4 }, requires: ['campfire', 'shelter'], structure: 'signal' },
];

export const NODE_INFO: Record<NodeKind, { name: string; verb: string; duration: number; hint: string }> = {
  wood: { name: '海漂木', verb: '拾取木材', duration: .7, hint: '木材 +3' },
  stone: { name: '碎石', verb: '收集石料', duration: .85, hint: '石料 +3' },
  fiber: { name: '野生亚麻', verb: '采集纤维', duration: .7, hint: '纤维 +3' },
  palm: { name: '椰树', verb: '采集椰树', duration: 1.2, hint: '需要石斧 · 木材、椰子与纤维' },
  berries: { name: '野果灌木', verb: '采摘野果', duration: .8, hint: '野果 +3' },
  wreck: { name: '破碎的远航号', verb: '打捞残骸', duration: 1.6, hint: '残骸零件 +1 · 木材 +3' },
  spring: { name: '林间淡水泉', verb: '取用淡水', duration: .8, hint: '补充水分 · 淡水 +1' },
  fishing: { name: '浅滩鱼群', verb: '在浅滩捕鱼', duration: 1.8, hint: '需要木矛 · 鲜鱼 +2' },
  relic: { name: '漂流者的石碑', verb: '阅读刻字', duration: 1, hint: '或许，你并非第一个来到这里的人' },
};
export const STRUCTURE_INFO: Record<StructureKind, { name: string; verb: string; hint: string }> = {
  campfire: { name: '营火', verb: '围坐营火', hint: '有鲜鱼时烹饪 · 靠近缓慢恢复体力' },
  shelter: { name: '棕叶庇护所', verb: '休息到天明', hint: '消耗 20 食物、25 水分 · 恢复生命与体力' },
  catcher: { name: '集雨器', verb: '取用积水', hint: '收集清洁的饮用水' },
  signal: { name: '求救信号台', verb: '点燃求救信号', hint: '第三天起 · 需要 3 份木材' },
};

export const ACHIEVEMENTS = [
  { id: 'first-gather', title: '双手，还能创造', description: '第一次从岛上获得资源', icon: 'wood' },
  { id: 'first-drink', title: '生命的甘甜', description: '饮用椰汁或淡水', icon: 'water' },
  { id: 'first-tool', title: '不再赤手空拳', description: '制作你的第一把石斧', icon: 'axe' },
  { id: 'first-fire', title: '黑夜里的一束光', description: '点燃第一堆营火', icon: 'campfire' },
  { id: 'first-home', title: '此处，便是归所', description: '搭建棕叶庇护所', icon: 'shelter' },
  { id: 'wreck', title: '昨日的回声', description: '发现并打捞远航号残骸', icon: 'compass' },
  { id: 'fisher', title: '大海的馈赠', description: '在浅滩捕获鲜鱼', icon: 'fish' },
  { id: 'first-meal', title: '好好吃一顿饭', description: '在营火烹饪一条鲜鱼', icon: 'meal' },
  { id: 'survivor', title: '活着，就有希望', description: '迎来第三天的日出', icon: 'sun' },
  { id: 'rescued', title: '海的另一边', description: '让过往的船看见你的信号', icon: 'flag' },
];

export const WORLD = { width: 3200, height: 2500, cx: 1590, cy: 1200, rx: 1120, ry: 810 };
export const SPAWN: Point = { x: 1640, y: 1810 };
export const SPRING: Point = { x: 1770, y: 1050 };
export function random(seed: number) {
  let a = seed;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function coastline(scale = 1): Point[] {
  return Array.from({ length: 120 }, (_, i) => {
    const a = i / 120 * Math.PI * 2;
    const r = 1 + .075 * Math.sin(a * 3 + .5) + .038 * Math.cos(a * 7) + .018 * Math.sin(a * 11);
    return { x: WORLD.cx + Math.cos(a) * WORLD.rx * r * scale, y: WORLD.cy + Math.sin(a) * WORLD.ry * r * scale };
  });
}
const coast = coastline(.985);
export function isLand(x: number, y: number, includePond = false): boolean {
  let inside = false;
  for (let i = 0, j = coast.length - 1; i < coast.length; j = i++) {
    const a = coast[i], b = coast[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  if (!includePond && ((x - SPRING.x) / 115) ** 2 + ((y - (SPRING.y - 45)) / 80) ** 2 < 1) return false;
  return inside;
}
export function distance(a: Point, b: Point) { return Math.hypot(a.x - b.x, a.y - b.y); }
export function createNodes(): WorldNode[] {
  const nodes: WorldNode[] = [];
  const add = (kind: NodeKind, x: number, y: number, remaining = 2) => nodes.push({ id: `${kind}-${nodes.length}`, kind, x, y, remaining, variant: nodes.length % 4 });
  add('wood', 1545, 1855, 3); add('stone', 1770, 1840, 3); add('fiber', 1510, 1670, 3);
  add('palm', 1780, 1655, 4); add('palm', 1445, 1780, 4);
  add('berries', 1845, 1570, 3); add('wood', 1940, 1810, 3);
  add('wreck', 2350, 1450, 3); add('spring', SPRING.x, SPRING.y + 55, 999);
  add('fishing', 2130, 1820, 999); add('fishing', 1020, 1735, 999);
  add('relic', 1080, 870, 1);
  const rng = random(2506);
  for (let i = 0; i < 110; i++) {
    const x = 640 + rng() * 1930, y = 550 + rng() * 1400;
    if (!isLand(x, y) || distance({ x, y }, SPAWN) < 230 || distance({ x, y }, { x: 2350, y: 1450 }) < 150 || distance({ x, y }, SPRING) < 175) continue;
    if (nodes.some(n => distance(n, { x, y }) < 90)) continue;
    const kind = (['palm', 'palm', 'wood', 'stone', 'fiber', 'berries'] as NodeKind[])[i % 6];
    add(kind, x, y, kind === 'palm' ? 4 : 3);
  }
  return nodes;
}

export function regionAt(p: Point): { name: string; en: string; description: string } {
  if (distance(p, { x: 2350, y: 1450 }) < 300) return { name: '沉船海岸', en: 'THE WRECKED COAST', description: '曾经载你远航的船，如今也需要你的告别。' };
  if (distance(p, SPRING) < 290) return { name: '翡翠泉', en: 'EMERALD SPRING', description: '在叶片与光的缝隙之间，你听见了淡水的声音。' };
  if (p.y < 1000) return { name: '低语密林', en: 'WHISPERING WOODS', description: '脚下是旧叶，耳边有陌生的呼吸。不要空手深入。' };
  if (p.x < 1150) return { name: '落日岬', en: 'SUNSET POINT', description: '海的尽头，或许正有一艘船驶向你。' };
  return { name: '初醒海滩', en: 'AWAKENING SHORE', description: '海浪把你带到了这里。接下来的路，由你决定。' };
}
