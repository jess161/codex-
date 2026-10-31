export const GAME_DURATION = 600;
export const BOSS_DURATION = 90;
export const SAVE_KEY = 'blade-evolution-save-v1';
export const FIXED_STEP = 1 / 60;
export const MAX_LEVEL = 30;
export const XP_DROP_TIME = .22;
export const EVOLUTION_HEAL = 4;
export const MIN_FORM_TIME = 75;
export const ELITE_INTERVAL = GAME_DURATION / 5;
// Mastery belongs to the wielder. Blade indices identify parallel loadouts, never ranks.
export const TIER_LEVELS = [1, 6, 12, 20, 28];
export const MASTERIES = ['初识', '磨合', '熟练', '共鸣', '觉醒'] as const;
export const TIERS = [
  { id: 'scrap', name: '铁片小刀', title: '微末之刃', source: '本作原创', bearer: '此刻的你', lore: '没有传说，也没有来历。一块打磨过的铁片，等待你写下它的第一场胜利。', technique: '朴素钢光', effect: 'steel', slash: 1, color: '#71899f', hex: 0x71899f, range: 72, arc: 118, interval: 0.72, multiplier: 1.05, waveEvery: 0, waveRange: 0, pierce: 0, role: '百炼成长', description: '从无名铁片出发，以击杀不断磨出锋芒。' },
  { id: 'dark-dagger', name: '玄铁匕首', title: '藏锋于袖', source: '金庸《鹿鼎记》', bearer: '韦小宝', lore: '韦小宝随身的锋利匕首，短小却能破坚。江湖未必要靠一柄巨刃，机敏同样能打开生路。', technique: '寒锋切口', effect: 'steel', slash: 1, color: '#527f91', hex: 0x527f91, range: 64, arc: 108, interval: 0.57, multiplier: 0.9, waveEvery: 0, waveRange: 0, pierce: 0, role: '瞬步刺杀', description: '轻巧短锋，瞬步后的致命一斩擅破坚甲。' },
  { id: 'well-moon', name: '井中月', title: '月映长锋', source: '黄易《大唐双龙传》', bearer: '寇仲', lore: '陪伴寇仲闯荡天下的名刀，刀身带着金黄月色。井中一轮月，映照少年从市井走向风云。', technique: '金月弧', effect: 'moon', slash: 6, color: '#b18d39', hex: 0xb18d39, range: 82, arc: 126, interval: 0.76, multiplier: 1, waveEvery: 0, waveRange: 0, pierce: 0, role: '扇形刀气', description: '以有效命中衔接刀法，金月刀气分路破阵。' },
  { id: 'deer-cutter', name: '割鹿刀', title: '逐鹿江湖', source: '古龙《萧十一郎》', bearer: '萧十一郎', lore: '引来江湖争夺的宝刀，与萧十一郎的命运紧紧相连。刀锋之外，是人心与自由的较量。', technique: '碧玉刀气', effect: 'jade', slash: 2, color: '#29a78d', hex: 0x29a78d, range: 80, arc: 120, interval: 0.68, multiplier: 1, waveEvery: 0, waveRange: 0, pierce: 0, role: '追猎游走', description: '标记目标、持续追斩，以击杀续接瞬步。' },
  { id: 'full-moon', name: '圆月弯刀', title: '弦月成圆', source: '古龙《圆月弯刀》', bearer: '丁鹏', lore: '丁鹏执掌的神秘弯刀，刀与刀法一同染上传奇色彩。弯若月轮的锋芒，也映着他的抉择。', technique: '圆月连斩', effect: 'moon', slash: 5, color: '#8b77bc', hex: 0x8b77bc, range: 78, arc: 146, interval: 0.8, multiplier: 1, waveEvery: 0, waveRange: 0, pierce: 0, role: '环斩清场', description: '积蓄月轮，兼顾前方挥砍与身周清场。' },
  { id: 'dragon-slayer', name: '屠龙刀', title: '重刃镇岳', source: '金庸《倚天屠龙记》', bearer: '金毛狮王谢逊', lore: '武林争夺的厚重宝刀，曾由谢逊持有。它与倚天剑相互牵连，藏着足以搅动江湖的秘密。', technique: '玄金重斩', effect: 'heavy', slash: 6, color: '#a1874b', hex: 0xa1874b, range: 94, arc: 138, interval: 0.95, multiplier: 1.3, waveEvery: 0, waveRange: 0, pierce: 0, role: '重斩震慑', description: '厚重刀锋配合狮吼，以控制争取重斩空间。' },
  { id: 'snow-drinker', name: '雪饮狂刀', title: '霜雪凌风', source: '马荣成《风云》', bearer: '聂风', lore: '聂家世代相传的宝刀，随聂风驰骋风云。清寒刀意与迅疾身法相伴，成为武林熟悉的锋芒。', technique: '霜雪流刃', effect: 'frost', slash: 5, color: '#4dacc6', hex: 0x4dacc6, range: 84, arc: 126, interval: 0.73, multiplier: 0.96, waveEvery: 0, waveRange: 0, pierce: 0, role: '寒霜控场', description: '连斩叠加寒意，在冻结形成的空隙中穿行。' },
  { id: 'wado', name: '和道一文字', title: '约定之锋', source: '尾田荣一郎《航海王》', bearer: '罗罗诺亚·索隆', lore: '原属古伊娜的名刀，承载索隆与她的约定。洁白的刀装之中，寄托着走向剑道顶点的决心。', technique: '清风一线', effect: 'wind', slash: 2, color: '#6aa78d', hex: 0x6aa78d, range: 82, arc: 122, interval: 0.69, multiplier: 1, waveEvery: 0, waveRange: 0, pierce: 0, role: '护刃反击', description: '稳健挥斩、守约护刃，为从容走位提供余地。' },
  { id: 'shusui', name: '秋水', title: '黑刀藏秋', source: '尾田荣一郎《航海王》', bearer: '霜月龙马 · 后由索隆使用', lore: '与剑豪龙马相连的黑刀，曾随索隆一同冒险。厚重而沉静的黑色刀身，记载着和之国的往事。', technique: '墨浪回锋', effect: 'ink', slash: 5, color: '#627ba8', hex: 0x627ba8, range: 88, arc: 128, interval: 0.82, multiplier: 1.18, waveEvery: 0, waveRange: 0, pierce: 0, role: '破甲斩将', description: '黑刀连续击中同一目标，擅长挑战强敌。' },
  { id: 'enma', name: '阎魔', title: '驭刃试炼', source: '尾田荣一郎《航海王》', bearer: '光月御田 · 后由索隆使用', lore: '光月御田曾使用的名刀，后来交到索隆手中。它会引出持有者的霸气，驾驭它本身就是试炼。', technique: '紫焰裂隙', effect: 'violet', slash: 4, color: '#9770cf', hex: 0x9770cf, range: 86, arc: 128, interval: 0.79, multiplier: 1.08, waveEvery: 0, waveRange: 0, pierce: 0, role: '耗血爆发', description: '以生命驾驭爆发，在击杀中夺回代价。' },
  { id: 'ryujin', name: '流刃若火', title: '万象归焰', source: '久保带人《BLEACH》', bearer: '山本元柳斋重国', lore: '山本元柳斋重国的炎系斩魄刀。解放时迸发的烈焰，使这柄刀成为《BLEACH》中鲜明的存在。', technique: '赤焰天幕', effect: 'flame', slash: 3, color: '#db743d', hex: 0xdb743d, range: 80, arc: 134, interval: 0.82, multiplier: 0.88, waveEvery: 0, waveRange: 0, pierce: 0, role: '灼烧传火', description: '以灼烧接力，怪群越密，烈焰越容易蔓延。' },
  { id: 'tensa', name: '天锁斩月', title: '黑月终临', source: '久保带人《BLEACH》', bearer: '黑崎一护', lore: '黑崎一护的斩魄刀斩月，其卍解之名。力量凝聚于刀锋，漆黑月影见证他一次次越过极限。', technique: '黑月终斩', effect: 'eclipse', slash: 4, color: '#cc6386', hex: 0xcc6386, range: 80, arc: 116, interval: 0.64, multiplier: 0.92, waveEvery: 0, waveRange: 0, pierce: 0, role: '机动月牙', description: '瞬步接月牙，以高速走位切开敌群。' },
] as const;
// Catalogue order groups authors/works; stable blade IDs remain compatible with older saves.
export const BLADE_CATALOGUE = [0, 1, 5, 2, 3, 4, 6, 7, 8, 9, 10, 11].map(index => ({ blade: TIERS[index], index }));
export type PerkId = 'sharp' | 'quick' | 'range' | 'magnet' | 'force' | 'vital' | 'long' | 'broad' | 'giant' | 'hollow' | 'grip' | 'stride' | 'heal';
export const PERKS: Record<PerkId, { name: string; label: string; description: string; cap: number; icon: string; color: string }> = {
  sharp: { name: '锋利', label: '伤害 +12%', description: '让每一次挥刀更有分量', cap: 8, icon: 'sword', color: '#ec966c' },
  quick: { name: '轻刃', label: '当前基础间隔 −8%', description: '刀光更密，刀气更频繁', cap: 8, icon: 'bolt', color: '#9a83df' },
  range: { name: '广域', label: '近战范围 +8%', description: '一刀清出更宽的道路', cap: 6, icon: 'expand', color: '#e4b24e' },
  magnet: { name: '牵引', label: '经验吸附 +35%', description: '让成长主动向你靠近', cap: 6, icon: 'magnet', color: '#5bbdd2' },
  force: { name: '震刃', label: '击退距离 +35%', description: '在包围之中斩出空隙', cap: 6, icon: 'wind', color: '#60baa7' },
  vital: { name: '坚韧', label: '生命上限 +15', description: '同时恢复 15 点生命，最多 6 层', cap: 6, icon: 'heart', color: '#de808d' },
  long: { name: '延展锻打', label: '刀长 +22%', description: '更远的刀尖，换来更重的手感', cap: 12, icon: 'expand', color: '#6aa8c4' },
  broad: { name: '阔刃开锋', label: '刀宽 +35% · 伤害 +10%', description: '斩面更宽，起步与挥刀更费力', cap: 10, icon: 'broad', color: '#c2955b' },
  giant: { name: '巨刃重铸', label: '长 +18% · 宽 +28%', description: '伤害 +16%，重量与收刀时间增加', cap: 8, icon: 'sword', color: '#b77b68' },
  hollow: { name: '镂空减重', label: '当前刀重 −14%', description: '保留刀的尺寸，减轻负担', cap: 10, icon: 'feather', color: '#71b8aa' },
  grip: { name: '双手握持', label: '当前挥刀负担 −18%', description: '缩短蓄力与收刀，挥刀时更灵活', cap: 8, icon: 'grip', color: '#9c91c8' },
  stride: { name: '驭刃步法', label: '基础移速 +7%', description: '起步和转向更利落，驾驭沉重刀锋', cap: 6, icon: 'dash', color: '#6fa8b8' },
  heal: { name: '修复', label: '恢复 20 生命', description: '稍作喘息，继续向前', cap: 999, icon: 'heart', color: '#72ba87' },
};
export const freshPerks = (): Record<PerkId, number> => Object.fromEntries(Object.keys(PERKS).map(id => [id, 0])) as Record<PerkId, number>;
export type EnemyKind = 'blob' | 'swift' | 'armor' | 'shooter' | 'charger' | 'wisp' | 'splitter' | 'brood' | 'spiker' | 'poison' | 'bomber' | 'stalker' | 'elite' | 'boss';
export const ENEMIES: Record<EnemyKind, { hp: number; damage: number; speed: number; xp: number; radius: number; size: number }> = {
  blob: { hp: 20, damage: 10, speed: 80, xp: 3, radius: 14, size: 38 },
  swift: { hp: 15, damage: 8, speed: 155, xp: 4, radius: 11, size: 31 },
  armor: { hp: 70, damage: 14, speed: 65, xp: 7, radius: 17, size: 43 },
  shooter: { hp: 28, damage: 8, speed: 75, xp: 6, radius: 15, size: 40 },
  charger: { hp: 38, damage: 10, speed: 76, xp: 6, radius: 16, size: 44 },
  wisp: { hp: 24, damage: 8, speed: 102, xp: 5, radius: 12, size: 37 },
  splitter: { hp: 44, damage: 10, speed: 62, xp: 5, radius: 20, size: 50 },
  brood: { hp: 9, damage: 5, speed: 125, xp: 1, radius: 9, size: 25 },
  spiker: { hp: 38, damage: 10, speed: 58, xp: 7, radius: 17, size: 45 },
  poison: { hp: 42, damage: 8, speed: 68, xp: 7, radius: 16, size: 43 },
  bomber: { hp: 32, damage: 18, speed: 105, xp: 6, radius: 14, size: 38 },
  stalker: { hp: 30, damage: 11, speed: 108, xp: 7, radius: 13, size: 38 },
  elite: { hp: 420, damage: 16, speed: 68, xp: 25, radius: 26, size: 68 },
  boss: { hp: 8000, damage: 20, speed: 65, xp: 0, radius: 42, size: 109 },
};
export const ENEMY_INFO: Record<EnemyKind, { name: string; role: string; description: string; from: number }> = {
  blob: { name: '软团', role: '追逐', description: '缓慢靠近，适合聚在一起清扫。', from: 0 },
  swift: { name: '疾爪', role: '快袭', description: '移动迅速，避免让它贴到身后。', from: 60 },
  armor: { name: '甲壳', role: '坚甲', description: '生命较高，连续命中或破甲刀法更有效。', from: 130 },
  shooter: { name: '吐弹者', role: '瞄准射击', description: '射线预警后发射弹丸，横向走位躲开。', from: 130 },
  splitter: { name: '裂壳母团', role: '分裂', description: '倒下后裂出两只幼团。出生光圈结束前幼团不会攻击。', from: 90 },
  brood: { name: '裂壳幼团', role: '幼体', description: '生命低、速度快，由母团分裂而来，不会继续分裂。', from: 90 },
  charger: { name: '赤角冲兽', role: '蓄力冲锋', description: '红色路径预警后直线冲锋，侧移躲过，再趁收势反击。', from: 165 },
  wisp: { name: '游灯幽魂', role: '绕行突进', description: '侧向飘移包抄，青色路径亮起时准备短距离突进。', from: 240 },
  spiker: { name: '针背刺团', role: '放射尖刺', description: '六道橙色预警后沿固定方向发射尖刺，从两道之间穿过。', from: 330 },
  poison: { name: '毒气泡团', role: '毒气封路', description: '落点预警后留下短时毒气，离开圈外即可安全；可在蓄气时击杀。', from: 210 },
  bomber: { name: '爆燃球', role: '定点爆炸', description: '靠近后停下引爆，趁倒计时击杀或离开橙色范围。', from: 300 },
  stalker: { name: '隐纹幽球', role: '隐身突袭', description: '平时呈淡紫轮廓；显形锁向后直线突刺，侧移躲开并趁收势反击。', from: 420 },
  elite: { name: '裂甲先锋', role: '精英', description: '高生命、强冲锋，倒下后留下治疗。', from: 120 },
  boss: { name: '圆甲暴君', role: '首领', description: '在冲锋、震荡波与召唤之间切换，找到缺口再出刀。', from: 600 },
};
const ENCOUNTERS: { kind: EnemyKind; weight: number; cap?: number }[] = [
  { kind: 'blob', weight: 40 }, { kind: 'swift', weight: 18 }, { kind: 'armor', weight: 13 }, { kind: 'shooter', weight: 8, cap: 6 },
  { kind: 'poison', weight: 5, cap: 3 }, { kind: 'bomber', weight: 5, cap: 5 }, { kind: 'stalker', weight: 5, cap: 5 },
  { kind: 'splitter', weight: 9, cap: 12 }, { kind: 'charger', weight: 7, cap: 8 }, { kind: 'wisp', weight: 5, cap: 10 }, { kind: 'spiker', weight: 3, cap: 3 },
];
export function encounterKind(time: number, roll: number, counts: Partial<Record<EnemyKind, number>> = {}): EnemyKind {
  const pool = ENCOUNTERS.filter(e => time >= ENEMY_INFO[e.kind].from && (!e.cap || (counts[e.kind] ?? 0) < e.cap));
  const total = pool.reduce((n, e) => n + e.weight, 0);
  let cursor = Math.max(0, Math.min(.999999, roll)) * total;
  for (const entry of pool) { cursor -= entry.weight; if (cursor < 0) return entry.kind; }
  return 'blob';
}
export const ACHIEVEMENTS = [
  { id: 'divine', name: '人刀合一', description: '任意一把刀首次抵达觉醒阶段', icon: 'sword' },
  { id: 'cleave', name: '一刀开路', description: '同一次近战击杀至少 8 只怪', icon: 'wind' },
  { id: 'combo', name: '连斩时刻', description: '10 秒内击杀至少 15 只怪', icon: 'bolt' },
  { id: 'flawless', name: '刀锋舞者', description: '首领战未受到敌人伤害', icon: 'star' },
  { id: 'veteran', name: '百炼成锋', description: '完成 5 次试炼', icon: 'shield' },
];
export const tierForLevel = (level: number) => TIER_LEVELS.reduce((tier, threshold, index) => level >= threshold ? index : tier, 0);
export const legacyXpNext = (level: number) => 10 + 3 * level + 5 * Math.floor(level / 5);
export const xpNext = (level: number) => Math.ceil(legacyXpNext(level) * 1.4);
export const xpToLevel = (level: number) => Array.from({ length: Math.max(0, Math.min(MAX_LEVEL, level) - 1) }, (_, i) => xpNext(i + 1)).reduce((sum, xp) => sum + xp, 0);
export const formatTime = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;
export function angleDelta(a: number, b: number) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
export function sectorHits(dx: number, dy: number, radius: number, facing: number, range: number, arc: number) {
  const distance = Math.hypot(dx, dy);
  return distance <= range + radius && (distance <= radius || Math.abs(angleDelta(Math.atan2(dy, dx), facing)) <= arc * Math.PI / 360 + Math.asin(Math.min(1, radius / distance)));
}

export const LATE_GAME_LEVEL = 20;
export function lateGameDifficulty(level: number) {
  const progress = Math.max(0, Math.min(1, (level - LATE_GAME_LEVEL) / (MAX_LEVEL - LATE_GAME_LEVEL)));
  return { progress, enemyHealth: 1 + .60 * progress, eliteHealth: 1 + .45 * progress,
    bossHealth: 1 + .35 * progress, speed: 1 + .08 * progress, spawnRate: 1 + .25 * progress };
}

export function encounterDensity(time: number, simplified = false, level = 1) {
  const progress = Math.max(0, Math.min(1, time / GAME_DURATION));
  const surge = Math.max(0, (progress - .4) / .6);
  return { rate: (.9 + 3.0 * progress + 6.9 * surge * surge) * lateGameDifficulty(level).spawnRate, cap: Math.floor((simplified ? 72 : 100) + (simplified ? 108 : 180) * surge) };
}
