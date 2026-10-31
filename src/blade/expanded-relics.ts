export const NEW_RELICS = {
  wrap: {name:'缠柄绳',group:'forge',rarity:'rare',effect:'挥刀操控负担降低 18%',note:'改善蓄力、收刀和转向负担，不缩小刀身。'},
  echo: {name:'回响刃环',group:'forge',rarity:'legendary',effect:'每 5 次有效挥砍放出回响刀气',note:'初始 45% 刀伤，每级再加 15%，随刀身尺寸放大。'},
  boots: {name:'疾步靴',group:'wind',rarity:'rare',effect:'瞬步冷却 −0.25 秒，无敌 +0.015 秒',note:'强化瞬步流，位移距离保持 140。'},
  fan: {name:'回风扇',group:'wind',rarity:'legendary',effect:'瞬步结束释放回风刀气',note:'初始 40% 刀伤，每级再加 15%，沿瞬步方向释放。'},
  venom: {name:'翡翠毒囊',group:'arcane',rarity:'epic',effect:'直击附加 2.5 秒毒伤',note:'每半秒造成 3% 刀伤/级，对精英和首领再加 25%；不叠层。'},
  prism: {name:'虹光棱镜',group:'arcane',rarity:'mythic',effect:'灼烧、毒伤和闪电伤害 +15%',note:'每级继续增加 15%，适合多元素持续伤害。'},
  food: {name:'爱心餐盒',group:'spirit',rarity:'rare',effect:'食物掉率 +2%，食物治疗 +10%',note:'每级继续增加；普通怪基础掉率 5%，满血时食物保留在原地。'},
  phoenix: {name:'不灭羽',group:'spirit',rarity:'mythic',effect:'每局一次，致命伤时恢复 30% 生命',note:'每级恢复比例增加 10%，最多 70%，获得 2 秒无敌；升级和读档不重置次数。'},
  fang: {name:'獠牙坠',group:'hunt',rarity:'legendary',effect:'直击暴击率 +5%',note:'每级再加 5%；基础暴击伤害为 175%，持续伤害不暴击。'},
  scope: {name:'远星镜',group:'hunt',rarity:'rare',effect:'刀气射程 +12%，穿透 +1',note:'每级继续成长，对刀具与道具释放的刀气都有效。'},
  leech: {name:'心滴坠',group:'hunt',rarity:'legendary',effect:'击杀恢复 0.4 生命，冷却 0.5 秒',note:'每级恢复量再加 0.4；自爆怪自行引爆不触发。'},
  comet: {name:'彗星徽',group:'hunt',rarity:'legendary',effect:'每 4 次有效挥砍放出三道星刃',note:'初始各 35% 刀伤，每级再加 15%；扇形覆盖，适合远程清群。'},
  execution: {name:'终结月镰',group:'hunt',rarity:'epic',effect:'直击残血敌人伤害 +12%',note:'每级再加 12%；普通怪生命低于 20% 生效，强敌低于 10% 时以一半增幅生效。'},
  crown: {name:'万象王冠',group:'chaos',rarity:'mythic',effect:'每个已用道具格提供 2.5% 伤害',note:'每级继续增加，五格满配时每级提供 12.5% 伤害。'},
  redmoon: {name:'赤月契约',group:'chaos',rarity:'chaos',effect:'伤害 +25%，治疗效果 −12%',note:'每级同时增加收益和代价；满级伤害 +125%，治疗减少 60%。'},
  blackhole: {name:'吞星核',group:'chaos',rarity:'chaos',effect:'每 8 次有效挥砍触发引力脉冲',note:'吸引附近普通怪并造成 15% 刀伤/级；精英受拉拽减弱，首领不受拉拽。'},
  mirror: {name:'逆光镜',group:'chaos',rarity:'mythic',effect:'减伤 3%，受伤或挡击时释放反击波',note:'每级减伤再加 3%，反击波造成 35% 刀伤/级；护盾挡击也能触发。'},
  overdrive: {name:'零界沙漏',group:'chaos',rarity:'chaos',effect:'半血以下攻速加快 10%，移速 +4%',note:'每级继续成长；半血以下受到的伤害也增加 8%/级，适合低血爆发。'},
} as const;

export function expandedRelicDetail(id: keyof typeof NEW_RELICS, rank: number) {
  switch(id) {
    case 'wrap': return `操控负担合计 −${Math.round((1-.82**rank)*100)}%`;
    case 'echo': return `每 5 次有效挥砍追加 ${Math.round((.30+.15*rank)*100)}% 伤害刀气`;
    case 'boots': return `瞬步冷却 −${(rank*.25).toFixed(2)}s，无敌 +${(rank*.015).toFixed(3)}s`;
    case 'fan': return `瞬步后斩出 ${Math.round((.25+.15*rank)*100)}% 伤害回风`;
    case 'venom': return `每半秒造成 ${rank*3}% 毒伤，持续 2.5s，对强敌额外 +25%`;
    case 'prism': return `灼烧、毒伤和闪电伤害 +${rank*15}%`;
    case 'food': return `食物掉率 +${rank*2}%，食物治疗 +${rank*10}%`;
    case 'phoenix': return `每局一次复活，恢复 ${20+rank*10}% 最大生命`;
    case 'fang': return `直击暴击率 +${rank*5}%`;
    case 'scope': return `刀气射程 +${rank*12}%，穿透 +${rank}`;
    case 'leech': return `击杀恢复 ${(rank*.4).toFixed(1)} 生命，冷却 0.5s`;
    case 'comet': return `每 4 次有效挥砍放出三道 ${Math.round((.20+.15*rank)*100)}% 伤害星刃`;
    case 'execution': return `对残血目标伤害 +${rank*12}%，强敌以一半增幅生效`;
    case 'crown': return `每个已用道具格提供 ${(rank*2.5).toFixed(1)}% 伤害`;
    case 'redmoon': return `伤害 +${rank*25}%，治疗效果 −${rank*12}%`;
    case 'blackhole': return `每 8 次有效挥砍，引力脉冲造成 ${rank*15}% 刀伤`;
    case 'mirror': return `减伤 ${rank*3}%，挡击或受伤反击 ${rank*35}% 刀伤`;
    case 'overdrive': return `半血以下间隔 −${Math.round((1-.9**rank)*100)}%、移速 +${rank*4}%，受伤 +${rank*8}%`;
  }
}
