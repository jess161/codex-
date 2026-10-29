import { ACHIEVEMENTS, EMPTY_INVENTORY, ITEMS, RECIPES, SPAWN, createNodes, distance, isLand, regionAt, type Inventory, type ItemId, type Point, type RecipeId, type StructureKind, type WorldNode } from './content';

export interface Structure extends Point { id: string; kind: StructureKind; stored: number; timer: number }
export interface Boar extends Point { id: string; home: Point; phase: number; cooldown: number }
export interface GameState {
  version: 1; day: number; minute: number; elapsed: number; player: Point; hp: number; hunger: number; thirst: number; energy: number;
  inventory: Inventory; tools: RecipeId[]; structures: Structure[]; nodes: WorldNode[]; achievements: string[]; discoveries: string[];
  xp: number; gathered: number; distance: number; status: 'playing' | 'dead' | 'rescued'; boars: Boar[]; rescueTimer: number;
  view?: { yaw: number; pitch: number };
}
export type GameEvent = { type: 'toast' | 'achievement' | 'gather' | 'build' | 'hurt' | 'discovery' | 'sleep' | 'end' | 'eat'; title: string; detail?: string; icon?: string; point?: Point; rewards?: Partial<Inventory> };
export const SAVE_KEY = 'castaway-island-save-v1';
export function freshState(): GameState {
  const inventory = EMPTY_INVENTORY(); inventory.coconut = 1;
  return { version: 1, day: 1, minute: 8 * 60 + 20, elapsed: 0, player: { ...SPAWN }, hp: 100, hunger: 78, thirst: 68, energy: 100,
    inventory, tools: [], structures: [], nodes: createNodes(), achievements: [], discoveries: ['初醒海滩'], xp: 0, gathered: 0, distance: 0, status: 'playing', rescueTimer: 0,
    boars: [{ id: 'boar-1', x: 1250, y: 900, home: { x: 1250, y: 900 }, phase: 0, cooldown: 0 }, { id: 'boar-2', x: 2050, y: 800, home: { x: 2050, y: 800 }, phase: 3, cooldown: 0 }] };
}
const clamp = (n: number) => Math.max(0, Math.min(100, n));
export class Survival {
  state: GameState;
  obstacles: (Point & { radius: number })[] = [];
  listeners = new Set<(event: GameEvent) => void>();
  private dangerTimer = 0;
  constructor(state = freshState()) { this.state = state; }
  on(listener: (event: GameEvent) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(event: GameEvent) { this.listeners.forEach(listener => listener(event)); }
  toast(title: string, detail?: string, icon = 'leaf') { this.emit({ type: 'toast', title, detail, icon }); }
  get night() { return this.state.minute >= 18 * 60 + 30 || this.state.minute < 6 * 60; }
  get weather(): 'rain' | 'clear' { return this.state.day % 3 === 2 && this.state.minute >= 9 * 60 && this.state.minute < 16 * 60 ? 'rain' : 'clear'; }
  get sheltered() { return this.state.structures.some(s => s.kind === 'shelter' && distance(s, this.state.player) < 130); }
  get nearFire() { return this.state.structures.some(s => s.kind === 'campfire' && distance(s, this.state.player) < 140); }
  get level() { return this.state.xp >= 550 ? 4 : this.state.xp >= 260 ? 3 : this.state.xp >= 90 ? 2 : 1; }
  get levelName() { return ['初来乍到', '学会生存', '岛屿居民', '不屈之人'][this.level - 1]; }
  get objective() {
    const s = this.state;
    if (!s.achievements.includes('first-gather')) return { chapter: '01', title: '从一双手开始', description: '靠近海漂木，按 E 拾取。你还有重新开始的力量。', progress: '采集第一份木材', icon: 'wood' };
    if (!s.tools.includes('axe')) return { chapter: '01', title: '让双手更有力量', description: '收集 3 木材、2 石料、2 纤维，制作一把石斧。', progress: '按 B 打开制作', icon: 'axe' };
    if (!s.structures.some(a => a.kind === 'campfire')) return { chapter: '02', title: '在天黑之前', description: '搭起营火。夜晚的寒意，远比想象中来得更快。', progress: '建造第一堆营火', icon: 'campfire' };
    if (!s.structures.some(a => a.kind === 'shelter')) return { chapter: '02', title: '给自己一个归所', description: '用木材与棕叶搭起庇护所，安稳地睡到下一次日出。', progress: '建造棕叶庇护所', icon: 'shelter' };
    if (s.inventory.scrap < 3 && !s.structures.some(a => a.kind === 'signal')) return { chapter: '03', title: '昨日留下的希望', description: '沿海岸向东探索，在沉船里找到 3 份残骸零件。', progress: '探索沉船海岸', icon: 'compass' };
    if (!s.structures.some(a => a.kind === 'signal')) return { chapter: '03', title: '让世界看见你', description: '搭建求救信号台。准备木材、石料、纤维和残骸零件。', progress: '建造求救信号台', icon: 'flag' };
    if (s.day < 3) return { chapter: '04', title: '等到第三次日出', description: '第三天会有船只经过。补足食物与饮水，在庇护所休息。', progress: `已生存 ${s.day} / 3 天`, icon: 'sun' };
    return { chapter: '04', title: '海的另一边', description: '带上 3 份木材，在信号台按 E 点火。别放弃，船就快看见你了。', progress: s.rescueTimer > 0 ? '信号已点燃 · 等待回应' : '点燃求救信号', icon: 'flag' };
  }
  award(id: string) {
    if (this.state.achievements.includes(id)) return;
    const entry = ACHIEVEMENTS.find(a => a.id === id); if (!entry) return;
    this.state.achievements.push(id); this.state.xp += 30;
    this.emit({ type: 'achievement', title: entry.title, detail: entry.description, icon: entry.icon });
  }
  move(dx: number, dy: number, dt: number, sprint = false) {
    const s = this.state; if (s.status !== 'playing') return;
    const length = Math.hypot(dx, dy); if (!length) return;
    const running = sprint && s.energy > 5;
    const speed = (running ? 230 : 145) * (this.weather === 'rain' ? .86 : 1) * (s.energy < 8 ? .7 : 1);
    const stepX = dx / length * speed * dt, stepY = dy / length * speed * dt;
    const start = { ...s.player };
    const clear = (x: number, y: number) => isLand(x,y) && !this.obstacles.some(o => Math.hypot(o.x-x,o.y-y)<o.radius) && !s.nodes.some(n => (n.kind === 'palm' || n.kind === 'wreck') && Math.hypot(n.x-x,n.y-y) < (n.kind === 'palm' ? 17 : 40));
    if (clear(s.player.x + stepX, s.player.y)) s.player.x += stepX;
    if (clear(s.player.x, s.player.y + stepY)) s.player.y += stepY;
    s.distance += distance(start, s.player);
    if (running) s.energy = clamp(s.energy - dt * 11);
    const region = regionAt(s.player);
    if (!s.discoveries.includes(region.name)) {
      s.discoveries.push(region.name); s.xp += 25;
      this.emit({ type: 'discovery', title: region.name, detail: region.description });
    }
  }
  tick(dt: number, moving = false) {
    const s = this.state; if (s.status !== 'playing') return;
    dt = Math.min(dt, .15);
    s.elapsed += dt; s.minute += dt * 3.2;
    if (s.minute >= 1440) { s.day++; s.minute -= 1440; this.newDay(); }
    s.hunger = clamp(s.hunger - dt * .052); s.thirst = clamp(s.thirst - dt * (.075 + (this.weather === 'rain' && !this.sheltered ? .025 : 0)));
    if (!moving) s.energy = clamp(s.energy + dt * (this.nearFire || this.sheltered ? 5 : 3));
    if (this.night && !this.nearFire && !this.sheltered) s.energy = clamp(s.energy - dt * .65);
    if (s.hunger === 0 || s.thirst === 0) {
      s.hp = clamp(s.hp - dt * 1.8);
      this.dangerTimer -= dt;
      if (this.dangerTimer <= 0) { this.toast(s.thirst === 0 ? '你急需补充饮水' : '你急需补充食物', '打开背包使用补给，或寻找椰树与淡水泉。', 'warning'); this.dangerTimer = 12; }
    }
    if (this.nearFire && s.hunger > 30 && s.thirst > 25) s.hp = clamp(s.hp + dt * .16);
    for (const structure of s.structures) {
      if (structure.kind !== 'catcher') continue;
      structure.timer += dt * (this.weather === 'rain' ? 2 : 1);
      if (structure.timer >= 55) { structure.stored = Math.min(5, structure.stored + 1); structure.timer -= 55; }
    }
    for (const boar of s.boars) {
      boar.phase += dt * .24; boar.cooldown = Math.max(0, boar.cooldown - dt);
      const close = distance(boar, s.player) < 150;
      const target = close && !s.tools.includes('spear') ? s.player : { x: boar.home.x + Math.sin(boar.phase) * 70, y: boar.home.y + Math.cos(boar.phase * .7) * 45 };
      const d = distance(boar, target);
      if (d > 4) { const step = Math.min(d, dt * (close ? 80 : 26)); boar.x += (target.x - boar.x) / d * step; boar.y += (target.y - boar.y) / d * step; }
      if (distance(boar, s.player) < 44 && boar.cooldown <= 0) {
        if (s.tools.includes('spear')) { boar.home = { x: boar.x - 140, y: boar.y - 90 }; this.toast('木矛驱退了野猪', '保持距离，林地里还有很多未知。', 'spear'); }
        else { s.hp = clamp(s.hp - 9); this.emit({ type: 'hurt', title: '野猪袭击 −9', detail: '离开密林，或制作木矛保护自己。' }); }
        boar.cooldown = 4;
      }
    }
    if (s.rescueTimer > 0) { s.rescueTimer += dt; if (s.rescueTimer >= 12) { s.status = 'rescued'; this.award('rescued'); this.emit({ type: 'end', title: '你终于，不再孤单。' }); } }
    if (s.hp <= 0) { s.status = 'dead'; this.emit({ type: 'end', title: '海浪记得，你曾来过。' }); }
  }
  gather(id: string) {
    const s = this.state, node = s.nodes.find(n => n.id === id);
    if (!node || s.status !== 'playing') return false;
    if (distance(node, s.player) > 115) { this.toast('再靠近一些', '向前移动，面向资源后按 E 互动。'); return false; }
    if (node.remaining <= 0) { this.toast('这里暂时没有可采集的资源', '普通资源会在次日清晨恢复。'); return false; }
    if (s.energy < 4) { this.toast('先停下来，喘口气', '静止时可以恢复体力，在营火旁恢复更快。'); return false; }
    if (node.kind === 'palm' && !s.tools.includes('axe')) { this.toast('需要一把石斧', '先拾取海漂木、碎石和亚麻，按 B 制作石斧。', 'axe'); return false; }
    if (node.kind === 'fishing' && !s.tools.includes('spear')) { this.toast('鱼群就在眼前，但你需要木矛', '按 B 打开制作。', 'spear'); return false; }
    const rewards: Partial<Inventory> = {};
    switch (node.kind) {
      case 'wood': rewards.wood = s.tools.includes('axe') ? 5 : 3; break;
      case 'stone': rewards.stone = 3; break;
      case 'fiber': rewards.fiber = 3; break;
      case 'berries': rewards.berries = 3; break;
      case 'palm': rewards.wood = 4; rewards.coconut = 2; rewards.fiber = 1; break;
      case 'wreck': rewards.scrap = 1; rewards.wood = 3; this.award('wreck'); break;
      case 'spring': rewards.water = 1; s.thirst = clamp(s.thirst + 32); this.award('first-drink'); break;
      case 'fishing': rewards.fish = 2; this.award('fisher'); break;
      case 'relic': this.toast('「别数失去的日子，去数新生的叶子。」', '石碑旁留着一只旧水壶。你将它装进了背包。', 'journal'); rewards.water = 2; s.xp += 35; break;
    }
    for (const [item, amount] of Object.entries(rewards)) s.inventory[item as ItemId] += amount;
    if (!['fishing', 'spring'].includes(node.kind)) node.remaining--;
    s.energy = clamp(s.energy - (node.kind === 'fishing' ? 8 : 4)); s.gathered++; s.xp += 5;
    this.emit({ type: 'gather', title: Object.entries(rewards).map(([k, n]) => `${ITEMS[k as ItemId].name} +${n}`).join(' · '), point: node, rewards, icon: node.kind });
    this.award('first-gather'); return true;
  }
  canCraft(id: RecipeId) {
    const recipe = RECIPES.find(r => r.id === id)!;
    if (id !== 'bandage' && (this.state.tools.includes(id) || this.state.structures.some(a => a.kind === id))) return { ok: false, reason: '已经制作' };
    const missing = recipe.requires?.filter(r => !this.state.tools.includes(r) && !this.state.structures.some(a => a.kind === r));
    if (missing?.length) return { ok: false, reason: `先制作${missing.map(r => RECIPES.find(a => a.id === r)!.name).join('、')}` };
    if (Object.entries(recipe.costs).some(([k, n]) => this.state.inventory[k as ItemId] < n)) return { ok: false, reason: '还需要一些材料' };
    return { ok: true, reason: recipe.structure ? '选择搭建位置' : '开始制作' };
  }
  craft(id: RecipeId, point?: Point) {
    const s = this.state, recipe = RECIPES.find(r => r.id === id)!;
    if (s.status !== 'playing') return false;
    const check = this.canCraft(id); if (!check.ok) { this.toast(check.reason); return false; }
    if (recipe.structure) {
      if (!point || !isLand(point.x, point.y) || distance(point, s.player) > 300) { this.toast('请选择身边的陆地', '搭建位置需要在你附近，避开水面。'); return false; }
      if (s.structures.some(a => distance(a, point) < 110) || this.obstacles.some(o=>distance(o,point)<o.radius+25) || s.nodes.some(n => ['palm','wreck','relic'].includes(n.kind) && distance(n, point) < 65)) { this.toast('这里有些拥挤', '离开树木、岩石或其他建筑，再留出一些空间。'); return false; }
      s.structures.push({ id: `${recipe.structure}-${s.structures.length}`, kind: recipe.structure, ...point, stored: 0, timer: 0 });
    } else if (id === 'bandage') s.inventory.bandage++;
    else s.tools.push(id);
    for (const [key, n] of Object.entries(recipe.costs)) s.inventory[key as ItemId] -= n;
    s.xp += recipe.structure ? 25 : 15;
    this.emit({ type: 'build', title: `${recipe.name}已${recipe.structure ? '搭建' : '制作'}`, detail: recipe.description, icon: recipe.id, point: point ?? s.player });
    if (id === 'axe') this.award('first-tool');
    if (id === 'campfire') this.award('first-fire');
    if (id === 'shelter') this.award('first-home');
    return true;
  }
  consume(id: ItemId) {
    const s = this.state;
    if (s.status !== 'playing' || s.inventory[id] < 1) return false;
    if (!['coconut', 'berries', 'water', 'meal', 'bandage'].includes(id)) { this.toast(id === 'fish' ? '先在营火旁烤熟' : '这份材料可以用来制作', ITEMS[id].description); return false; }
    if (id === 'coconut') { s.hunger = clamp(s.hunger + 12); s.thirst = clamp(s.thirst + 28); this.award('first-drink'); }
    if (id === 'berries') { s.hunger = clamp(s.hunger + 20); s.thirst = clamp(s.thirst + 5); }
    if (id === 'water') { s.thirst = clamp(s.thirst + 45); this.award('first-drink'); }
    if (id === 'meal') { s.hunger = clamp(s.hunger + 50); s.hp = clamp(s.hp + 8); }
    if (id === 'bandage') s.hp = clamp(s.hp + 32);
    s.inventory[id]--; this.emit({ type: 'eat', title: `使用了${ITEMS[id].name}`, detail: ITEMS[id].description, icon: ITEMS[id].icon }); return true;
  }
  interactStructure(id: string): 'sleep' | void {
    const s = this.state, structure = s.structures.find(a => a.id === id);
    if (!structure || distance(structure, s.player) > 120 || s.status !== 'playing') return;
    if (structure.kind === 'shelter') return 'sleep';
    if (structure.kind === 'campfire') {
      if (s.inventory.fish && s.inventory.wood) { s.inventory.fish--; s.inventory.wood--; s.inventory.meal++; s.xp += 10; this.award('first-meal'); this.toast('烤鱼做好了', '打开背包享用一顿热饭。食物 +50 · 生命 +8', 'meal'); }
      else this.toast('火还在，你就还有家', '靠近营火可恢复体力。带来鲜鱼与 1 份木材可以烹饪。', 'campfire');
    }
    if (structure.kind === 'catcher') {
      if (structure.stored > 0) { const n = structure.stored; s.inventory.water += n; structure.stored = 0; this.toast(`淡水 +${n}`, '按 3 快捷饮用，或在背包中使用。', 'water'); }
      else this.toast('水滴正在慢慢汇集', `${Math.ceil((55 - structure.timer) / (this.weather === 'rain' ? 2 : 1))} 秒后可收集下一份淡水。`, 'water');
    }
    if (structure.kind === 'signal') {
      if (s.day < 3) { this.toast('再坚持到第三天', '远处的航线每三天有船经过。补足食物与水，休息等待。', 'flag'); return; }
      if (s.rescueTimer > 0) { this.toast('他们会看见你的', '信号正升向天空。再等一会儿。', 'flag'); return; }
      if (s.inventory.wood < 3) { this.toast('还需要 3 份木材来点火', '这一次，火光会把你带回家。', 'wood'); return; }
      s.inventory.wood -= 3; s.rescueTimer = .01; this.toast('信号已点燃', '地平线上，似乎有一艘船正在转向……', 'flag');
    }
  }
  rest() {
    const s = this.state;
    if (!s.structures.some(a => a.kind === 'shelter' && distance(a, s.player) < 120) || s.status !== 'playing') return false;
    if (s.hunger < 22 || s.thirst < 27) { this.toast('先吃点东西，再补充些水', '休息需要至少 22 食物和 27 水分。', 'warning'); return false; }
    s.day++; s.minute = 7 * 60; s.hunger = clamp(s.hunger - 20); s.thirst = clamp(s.thirst - 25); s.hp = clamp(s.hp + 28); s.energy = 100;
    s.structures.filter(a => a.kind === 'catcher').forEach(a => { a.stored = 5; });
    this.newDay(); this.emit({ type: 'sleep', title: `第 ${s.day} 天 · 你又看见了日出`, detail: '生命 +28 · 体力已恢复。普通资源已经重新生长。', icon: 'sun' }); return true;
  }
  private newDay() {
    for (const node of this.state.nodes) if (!['wreck', 'relic', 'spring', 'fishing'].includes(node.kind)) node.remaining = node.kind === 'palm' ? 4 : 3;
    if (this.state.day >= 3) this.award('survivor');
  }
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); return true; } catch { return false; } }
  static load(): GameState | undefined {
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return;
      const state = JSON.parse(raw) as GameState;
      if (state.version !== 1 || !Array.isArray(state.nodes) || !Array.isArray(state.structures) || !Array.isArray(state.tools) || !Array.isArray(state.boars) || !state.player || !Number.isFinite(state.player.x) || !Number.isFinite(state.player.y) || !isLand(state.player.x, state.player.y) || state.status !== 'playing' || !Number.isFinite(state.day) || state.day < 1 || !Number.isFinite(state.minute)) return;
      for (const stat of ['hp','hunger','thirst','energy'] as const) if (!Number.isFinite(state[stat]) || state[stat] < 0 || state[stat] > 100) return;
      for (const key of Object.keys(EMPTY_INVENTORY()) as ItemId[]) if (!Number.isFinite(state.inventory?.[key]) || state.inventory[key] < 0) return;
      return state;
    } catch { return; }
  }
}
