import { ACHIEVEMENTS, BLADE_CATALOGUE, BOSS_DURATION, ENEMY_INFO, GAME_DURATION, LATE_GAME_LEVEL, MAX_LEVEL, MASTERIES, MIN_FORM_TIME, TIERS, TIER_LEVELS, formatTime, xpNext } from './config';
import { ASSETS } from './assets';
import type { BladeApp } from './main';
import { GROUNDS, groundPreview } from './grounds';
import { loadName } from './equipment';
import { passiveForTier, passiveGrowth, passiveProgress } from './passives';
import { RELICS, RELIC_IDS, RELIC_CAP, RELIC_SLOTS, RARITIES, ownedRelics, RELIC_GROUPS, relicGroups, relicDetail, type RelicId, type RelicGroup } from './relics';
import { relicIcon } from './relic-art';
import type { BladeInspector } from './inspector';
import { combatPower } from './power';
import { FOODS } from './food';

const paths: Record<string, string> = {
  sword: '<path d="m5 19 9-9m-5 8-3-3m-2 5 2-2M14 4l6-1-1 6-7 7-5-5z"/>',
  broad: '<path d="M9 3h12l-3 12-5 3-7-7zM8 14l-5 7m1-6 5 5M13 6l4 5"/>',
  feather: '<path d="M20 3C10 1 3 8 6 15l4 3C18 17 23 9 20 3ZM3 22 17 7M8 17v-6m4 2h6"/>',
  grip: '<path d="m8 14-3-3a2 2 0 0 1 3-3l2 2V5a2 2 0 0 1 4 0v5l2-1a2 2 0 0 1 3 2v6l-3 4H9l-3-6M13 3l7-2"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
  expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6M4 4l6 6m10-6-6 6M4 20l6-6m10 6-6-6"/>',
  magnet: '<path d="M6 4v9a6 6 0 0 0 12 0V4h-4v9a2 2 0 0 1-4 0V4zM6 8h4m4 0h4"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3M2 12h16a3 3 0 1 1-3 3M4 17h4a2 2 0 1 1-2 2"/>',
  heart: '<path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/>',
  star: '<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back: '<path d="m13 5-7 7 7 7M6 12h15"/>',
  sound: '<path d="M11 4 6 8H3v8h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 4 6 8H3v8h3l5 4zM16 9l6 6m0-6-6 6"/>',
  settings: '<path d="m10 3-1 3-3 1-3 3v4l3 3 3 1 1 3h4l1-3 3-1 3-3v-4l-3-3-3-1-1-3z"/><circle cx="12" cy="12" r="3"/>',
  book: '<path d="M12 5c-3-3-7-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-2-10 1Zm0 0v15"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  dash: '<path d="m3 5 7 7-7 7m10-14 7 7-7 7"/>',
  trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0zM7 5H3v3c0 3 4 4 5 3m9-6h4v3c0 3-4 4-5 3m-4 3v6m-5 1h10"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
  full: '<path d="M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6"/>',
};
export const icon = (name: string, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.star}</svg>`;
export type Panel = 'title' | 'none' | 'pause' | 'settings' | 'codex' | 'confirm' | 'loadout' | 'relics' | 'power';
export class BladeUI {
  private overlay: HTMLElement;
  inspector?: BladeInspector;
  async inspect(blade: number) {
    if (this.app.panel !== 'codex' || !Number.isInteger(blade) || blade < 0 || blade >= TIERS.length) return;
    this.app.clearInputs();
    const { BladeInspector } = await import('./inspector');
    if (this.app.panel !== 'codex') return;
    this.inspector ??= new BladeInspector(); void this.inspector.open(blade);
  }
  private key = '';
  private trimRun='';
  trimSelected=new Set<RelicId>();
  toggleTrim(id:RelicId){
    const s=this.app.run?.state;if(s?.mode!=='relic-trim'||!s.relics[id])return;
    if(this.trimSelected.has(id))this.trimSelected.delete(id);else if(this.trimSelected.size<RELIC_SLOTS)this.trimSelected.add(id);
    this.render(true);
  }
  private toastTimer = 0;
  private deferredToast = '';
  private touchButtons = new Map<number, { button: HTMLElement; x: number; y: number }>();
  private handledTouchUntil = 0;
  constructor(readonly app: BladeApp) {
    document.querySelector('#app')!.innerHTML = `
      <header class="brandbar" id="brandbar"><a class="brand" href="#" aria-label="刃之进化首页"><span class="brand-mark">${icon('sword')}</span><span>刃之进化<small>BLADE EVOLUTION</small></span></a><nav><button class="nav-button" data-action="codex">${icon('book')}<span>刀型图鉴</span></button><button class="icon-button" data-action="sound" aria-label="切换声音" id="title-sound">${icon('sound')}</button><button class="icon-button" data-action="settings" aria-label="设置">${icon('settings')}</button><button class="icon-button fullscreen-control" data-action="fullscreen" aria-label="全屏">${icon('full')}</button></nav></header>
      <div id="battle-hud" hidden>
        <div class="hud-top"><div class="health-cluster"><span class="health-icon">${icon('heart')}</span><div class="health-track"><i id="health-fill"></i></div><b id="health-value">100 / 100</b></div><div class="battle-clock"><span id="stage-label">生存试炼</span><b id="clock">00:00</b><small id="clock-goal">/ ${formatTime(GAME_DURATION)}</small></div><div class="hud-buttons"><button class="icon-button" data-action="power" aria-label="战斗力（C）">${icon('star')}</button><button class="icon-button" data-action="sound" aria-label="切换声音" id="battle-sound">${icon('sound')}</button><button class="icon-button" data-action="pause" aria-label="暂停">${icon('pause')}</button></div></div>
        <div class="xp-row"><b id="level-label">Lv.1</b><div class="xp-track"><i id="xp-fill"></i></div><span id="next-form">磨合 Lv.6</span></div>
        <div id="boss-health" hidden><span>圆甲暴君<small>寻找震荡波缺口 · 瞬步避开冲锋</small></span><div><i id="boss-fill"></i></div></div>
        <button id="relic-open" class="relic-open" data-action="relics" aria-label="查看被动道具">${icon('star')}<span id="relic-count">道具 0/5</span><span id="relic-slots" class="relic-slots"></span><small id="relic-shield"></small></button><div class="run-counters"><span>${icon('sword')}<b id="kill-count">0</b><small>击败</small></span><span class="combo-counter" id="combo-counter"></span></div>
        <div class="current-blade"><div class="current-blade-art"><img id="current-blade-image" src="${ASSETS['blade-1']}" alt="当前刀型"></div><div><small id="current-tier">初识 · 百炼成长</small><b id="current-name">铁片小刀</b><div class="tier-pips" id="tier-pips"></div><small id="blade-loadout" class="blade-loadout">轻巧</small><button id="current-passive" class="current-passive" data-action="codex" aria-label="查看当前刀的被动技能"><b id="passive-name">百炼初锋</b><small id="passive-state">磨刃 0/3</small></button></div></div>
        <div class="desktop-controls"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>移动</span><kbd>SPACE</kbd><span>瞬步</span></div>
        <div id="touch-joystick" class="touch-joystick" hidden aria-hidden="true"><span class="joystick-guide"></span><span id="joystick-thumb"></span></div>
        <button id="dash-button" class="dash-button" aria-label="瞬步" data-action="dash"><svg class="dash-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45"/><circle id="dash-progress" cx="50" cy="50" r="45"/></svg>${icon('dash')}<span id="dash-label">瞬步</span><kbd>SPACE</kbd></button>
        <div id="tutorial" class="tutorial">走位聚怪，刀会自动挥砍<span>同一把刀，一路觉醒 · 升级道具三选一</span></div>
        <div id="boss-warning" class="boss-warning" hidden><small>THE FINAL TRIAL</small><strong>圆甲暴君</strong><span>90 秒，斩出最后一条路。</span></div>
        <div id="evolution-flash" class="evolution-flash" hidden></div>
      </div>
      <main id="overlay" class="overlay"></main><div id="toast" class="toast" role="status"></div>
      <div class="boot-status" id="boot-status">正在唤醒刀锋<span></span></div>`;
    this.overlay = document.querySelector('#overlay')!;
    const root = document.querySelector('#app')!;
    root.addEventListener('pointerdown', event => {
      const pointer = event as PointerEvent;
      if (pointer.pointerType !== 'touch' && pointer.pointerType !== 'pen') return;
      const button = (pointer.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (button && !button.matches(':disabled')) this.touchButtons.set(pointer.pointerId, { button, x: pointer.clientX, y: pointer.clientY });
    });
    // Non-primary fingers do not reliably generate click events in mobile browsers.
    // Activate a completed button tap directly, while keeping scrolling and mouse/keyboard clicks.
    window.addEventListener('pointerup', event => {
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
      const start = this.touchButtons.get(event.pointerId); this.touchButtons.delete(event.pointerId);
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      // Dash already fires on pointerdown, including when another finger is moving.
      if (!start && target?.dataset.action === 'dash') { this.handledTouchUntil = performance.now() + 700; return; }
      if (!start) return;
      this.handledTouchUntil = performance.now() + 700;
      if (!start.button.isConnected) return;
      const button = start.button, r = button.getBoundingClientRect();
      if (button.matches(':disabled') || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12 || event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) return;
      event.preventDefault(); event.stopPropagation();
      this.app.action(button.dataset.action!, button.dataset.value);
    }, { capture: true });
    window.addEventListener('pointercancel', event => this.touchButtons.delete(event.pointerId), { capture: true });
    root.addEventListener('click', event => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (target) {
        event.stopPropagation();
        const pointerType = (event as PointerEvent).pointerType;
        // The compatibility click can hit a different button after the first action
        // replaced the menu, so suppress it for the whole gesture, not by button key.
        if ((event as MouseEvent).detail > 0 && (pointerType === 'touch' || pointerType === 'pen' || pointerType !== 'mouse' && performance.now() < this.handledTouchUntil)) { event.preventDefault(); return; }
        this.app.action(target.dataset.action!, target.dataset.value);
      }
    });
    document.querySelector('.brand')!.addEventListener('click', event => { event.preventDefault(); if (this.app.run) this.app.pause(); });
    this.overlay.addEventListener('change', event => {
      const target = event.target as HTMLInputElement;
      if (target.dataset.setting) this.app.setSetting(target.dataset.setting, target.checked);
    });
    this.render(true);
  }
  ready() { document.querySelector('#boot-status')!.setAttribute('hidden', ''); }
  toast(message: string) {
    if (this.app.panel === 'relics' || this.app.panel === 'none' && this.app.run && ['evolving', 'relic', 'relic-trim', 'boss-intro'].includes(this.app.run.state.mode)) { this.deferredToast = message; return; }
    const toast = document.querySelector('#toast')!; toast.innerHTML = `${icon('star')}<span>${message}</span>`; toast.classList.add('show');
    clearTimeout(this.toastTimer); this.toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
  }
  private title() {
    const m = this.app.storage.data.meta, saved = this.app.storage.data.run, blade = this.app.selectedBlade, t = TIERS[blade];
    return `<div class="title-layout"><section class="title-copy"><div class="eyebrow"><i></i> 一局，一把刀，练出自己的传说</div><h1>选择你的刀，<br>斩出<span>自己的路。</span></h1><p class="title-description">聚怪、挥斩、道具搭配与觉醒。<br>从第一刀到最后一斩，始终是你选中的那把。</p><div class="title-facts"><span><b>${TIERS.length}</b> 种独立流派</span><i></i><span><b>${MASTERIES.length}</b> 重掌握阶段</span><i></i><span><b>${GAME_DURATION / 60}</b> 分钟试炼</span></div><div class="title-actions"><button class="primary-button start-button" data-action="${saved ? 'continue' : 'start'}">${icon('play')}<span>${saved ? '继续试炼' : '开始试炼'}</span>${icon('arrow')}</button>${saved ? '<button class="text-button" data-action="start">选择名刀，开启新的一局</button>' : ''}</div><div class="title-keyboard"><span><kbd>WASD</kbd> 移动</span><span><kbd>空格</kbd> 瞬步</span><span>自动挥刀，专注走位</span></div>${m.bestScore > 0 ? `<div class="personal-best">${icon('trophy')} 个人最佳 <b>${m.bestScore.toLocaleString()}</b><span>· ${m.wins} 次通关</span></div>` : ''}</section>
      <section class="title-art" aria-label="每把刀都有自己的成长之路"><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><div class="art-cross cross-one">+</div><div class="art-cross cross-two">+</div><div class="hero-light"></div><img class="art-enemy art-blob" src="${ASSETS.blob}" alt="软团"><img class="art-enemy art-swift" src="${ASSETS.swift}" alt="疾爪"><img class="art-enemy art-armor" src="${ASSETS.armor}" alt="甲壳"><img class="art-xp xp-one" src="${ASSETS.xp}" alt=""><img class="art-xp xp-two" src="${ASSETS.xp}" alt=""><div class="title-hero"><img src="${ASSETS.hero}" style="filter:hue-rotate(${[0, 185, 70][this.app.storage.data.settings.color]}deg)" alt="主角"><img class="title-weapon" src="${ASSETS[`blade-${blade + 1}`]}" alt="${t.name}"></div><div class="weapon-caption" style="--tier:${t.color}"><span class="tiny-label">YOUR BLADE · YOUR STORY</span><b>${t.name}</b><span>${t.role} · 一路相伴，直到觉醒。</span></div><div class="art-note"><span>∞</span><i></i>十二种选择，各有锋芒。</div></section>
      <section class="evolution-rail"><div class="rail-caption"><span>CHOOSE YOUR PATH</span><b>十二柄刀，平行的传说。</b></div><div class="rail-blades">${BLADE_CATALOGUE.map(({ blade: t, index: i }) => `<button data-action="blade-pick" data-value="${i}" class="rail-blade" style="--tier:${t.color}" aria-label="选择${t.name}"><span>${t.role}</span><img src="${ASSETS[`blade-${i + 1}`]}" alt="${t.name}"><b>${t.name}</b></button>`).join('')}</div></section><footer class="title-footer"><span>单人 PvE · 每局重置道具与掌握程度</span><span>V 2.1 <i></i> 一刀，向前。</span></footer></div>`;
  }
  private loadout() {
    const blade = this.app.selectedBlade, t = TIERS[blade], passive = passiveForTier(blade);
    return `<section class="loadout-panel" style="--tier:${t.color}"><button class="back-button" data-action="back">${icon('back')}返回</button>${this.header('TWELVE STORIES, YOUR CHOICE', '选一把，练一整局。', '全部流派均可选择。刀名与故事相伴，道具搭配和觉醒由你决定。')}<div class="loadout-layout"><div class="blade-options" role="group" aria-label="选择本局名刀">${BLADE_CATALOGUE.map(({ blade: b, index: i }) => `<button class="blade-option ${blade === i ? 'selected' : ''}" style="--blade:${b.color}" data-action="blade-pick" data-value="${i}" aria-pressed="${blade === i}"><img src="${ASSETS[`blade-${i + 1}`]}" alt=""><b>${b.name}</b><span>${b.role}</span>${blade === i ? '<i>✓</i>' : ''}</button>`).join('')}</div><article class="loadout-detail"><span class="eyebrow">${t.role}</span><img class="loadout-weapon" src="${ASSETS[`blade-${blade + 1}`]}" alt="${t.name}"><h3>${t.name}<small>${t.source} · ${t.bearer}</small></h3><p>${t.lore}</p><div class="loadout-passive"><small>初识 · ${passive.name}</small><p>${passive.description}</p></div><div class="loadout-destination"><small>觉醒后</small><b>${passiveGrowth(blade, 4)}</b></div><div class="mastery-path">${MASTERIES.map((stage, i) => `<span>${stage}<small>Lv.${TIER_LEVELS[i]}</small></span>`).join('')}</div></article></div><footer class="loadout-footer"><span><b>${t.name}</b><small>${this.app.storage.data.run ? '出发后替换未完成对局，战绩保留' : '本局从初识开始 · 升级道具三选一'}</small></span><button class="primary-button" data-action="begin">${icon('play')}持刀出发${icon('arrow')}</button></footer></section>`;
  }
  private header(kicker: string, title: string, subtitle: string) { return `<div class="panel-header"><span class="eyebrow">${kicker}</span><h2>${title}</h2><p>${subtitle}</p></div>`; }
  private relicPreview(id: RelicId) {
    const run = this.app.run!, s = run.state, before = run.stats;
    const after = run.statsForRelics({ ...s.relics, [id]: s.relics[id] + 1 });
    const rank = s.relics[id] + 1;
    if (id === 'stone') return `伤害 ${before.damage} → ${after.damage}`;
    if (id === 'ruler') return `刀长 ${before.lengthScale.toFixed(2)} → ${after.lengthScale.toFixed(2)} 倍`;
    if (id === 'anvil') return `刀宽 ${before.widthScale.toFixed(2)} → ${after.widthScale.toFixed(2)} 倍 · 伤害 ${after.damage}`;
    if (id === 'feather') return `刀重 ${before.mass.toFixed(2)} → ${after.mass.toFixed(2)}`;
    if (id === 'bell') return `移速 ${Math.round(before.moveSpeed)} → ${Math.round(after.moveSpeed)}`;
    if (id === 'hourglass') return `间隔 ${before.interval.toFixed(2)} → ${after.interval.toFixed(2)} 秒`;
    if (id === 'heart') return rank<=s.relicState.heartPeak?'生命上限已保留 · 恢复 15 生命':`生命上限 ${s.maxHp} → ${s.maxHp + 15}`;
    if (id === 'magnet') return `吸取范围 ${Math.round(before.magnet)} → ${Math.round(after.magnet)}`;
    if (id === 'wrap') return `蓄力 ${before.windup.toFixed(2)} → ${after.windup.toFixed(2)}s · 收刀 ${after.recovery.toFixed(2)}s`;
    if (id === 'boots') return `瞬步冷却 ${before.dashCooldown.toFixed(2)} → ${after.dashCooldown.toFixed(2)}s`;
    if (id === 'echo') return `蓄力 ${s.relicState.echo}/5 · 回响基础伤害 ${Math.round(after.damage*(.3+.15*rank))}`;
    if (id === 'comet') return `蓄力 ${s.relicState.comet}/4 · 三道扇形星刃`;
    if (id === 'fan') return `瞬步后刀气基础伤害 ${Math.round(after.damage*(.25+.15*rank))}`;
    if (id === 'food') return `普通怪掉率 ${5+2*s.relics.food}% → ${5+2*rank}%`;
    if (id === 'phoenix') return s.relicState.phoenixUsed?'本局复活已使用 · 升级不重置':'剩余一次复活 · 触发后无敌 2 秒';
    if (id === 'fang') return `直击暴击率 ${Math.round(before.critChance*100)}% → ${Math.round(after.critChance*100)}%`;
    if (id === 'scope') return `刀气基础射程 ×${(1+.12*rank).toFixed(2)} · 穿透 +${rank}`;
    if (id === 'mirror') return `减伤 ${Math.round(before.damageReduction*100)}% → ${Math.round(after.damageReduction*100)}%`;
    if (id === 'crown' || id === 'redmoon') return `伤害 ${before.damage} → ${after.damage}${id==='redmoon'?` · 治疗保留 ${100-12*rank}%`:''}`;
    if (id === 'overdrive') return s.hp<s.maxHp*.5?`间隔 ${before.interval.toFixed(2)} → ${after.interval.toFixed(2)}s · 低血强化中`:'半血以下生效 · 收益与受伤风险同时增加';
    if (id === 'venom') {
      const groups=relicGroups({...s.relics,venom:rank}),bonus=(groups.arcane>=2?1.2:1)*(groups.chaos>=2?1.2:1)*(1+.15*s.relics.prism);
      return `每次毒伤基础值 ${Math.max(1,Math.round(after.damage*.03*rank*bonus))} · 不叠层`;
    }
    if (id === 'prism') return `本局所有灼烧、毒伤与闪电共同增强`;
    if (id === 'blackhole') return `引力蓄力 ${s.relicState.vortex}/8 · 首领不被拉拽`;
    if (id === 'leech') return `击杀触发 · 两次恢复至少间隔 0.5 秒`;
    if (id === 'execution') return `生命触发线：普通 20% · 精英与首领 10%`;
    return relicDetail(id, rank);
  }
  private relicChoice() {
    const run = this.app.run!, s = run.state, groups = relicGroups(s.relics);
    return `<section class="relic-choice" role="dialog" aria-modal="true" aria-labelledby="relic-choice-title">
      <header class="relic-choice-heading"><span class="eyebrow">A LITTLE GIFT, A NEW POSSIBILITY</span><h2 id="relic-choice-title">五件道具，走出你的流派。</h2><p>Lv.${s.level} · 选择一件被动道具 · 已装备 ${ownedRelics(s.relics).length}/${RELIC_SLOTS}${s.forgeAwakening ? ` · ${MASTERIES[run.mastery]}已解锁` : ''}</p><span class="relic-blade-note">${TIERS[run.tier].name} · ${run.passiveInfo.name}持续生效</span></header>
      <p class="relic-rules">最多携带五种 · 每件五级 · 满级不再出现${ownedRelics(s.relics).length>=RELIC_SLOTS?" · 行囊已满，仅升级已有道具":" · 可跳过，为心仪道具留格子"}</p>
      <button class="relic-skip" data-action="relic-skip">跳过本次选择 <kbd>0</kbd></button>
      <div class="relic-cards">${s.choices.map((id, index) => {
        const item = RELICS[id], group = RELIC_GROUPS[item.group], rarity = RARITIES[item.rarity], rank = s.relics[id], count = groups[item.group], nextCount = count + (rank === 0 ? 1 : 0);
        const combo = nextCount > count && nextCount >= 2 ? `集齐 ${nextCount} 件：${nextCount === 2 ? group.two : group.three}` : `同组 ${count}/5 件 · ${count < 2 ? '两件解锁组合' : count < 3 ? '再集一件解锁完整组合' : '完整组合已生效'}`;
        return `<button class="relic-card" data-action="relic" data-value="${id}" style="--relic:${rarity.color};--relic-tint:${rarity.tint}" data-rarity="${item.rarity}" aria-label="${rarity.name} · ${rank ? '升级' : '获得'}${item.name}至${rank + 1}级">
          <span class="relic-card-top"><span class="relic-group-tag">${group.name}</span><span class="relic-rarity">${rarity.name}</span><kbd>${index + 1}</kbd></span>
          <span class="relic-art-well">${relicIcon(id)}</span><strong>${item.name}</strong><span class="relic-rank">${rank ? `Lv.${rank} → Lv.${rank + 1}` : '新道具 · Lv.1'}<i>${Array.from({length: RELIC_CAP}, (_, i) => `<b class="${i <= rank ? 'lit' : ''}"></b>`).join('')}</i></span>
          <b class="relic-effect">${relicDetail(id, rank + 1)}</b><span class="relic-preview">${this.relicPreview(id)}</span><p>${item.note}</p><span class="relic-combo-preview ${nextCount > count && nextCount >= 2 ? 'activates' : ''}">${combo}</span><span class="relic-pick-label">${rank ? '升级道具' : '收入行囊'} ${icon('arrow')}</span></button>`;
      }).join('')}</div>${s.choices.length===0?'<p class="relic-build-complete">现有道具已无可升级项，流派成型！跳过即可继续战斗。</p>':''}<footer class="relic-choice-footer">${icon('pause')} 战斗与计时已暂停 · 跳过会消耗本次选择，不会重抽</footer></section>`;
  }
  private relicTrim() {
    const s=this.app.run!.state;
    return `<section class="relic-inventory relic-trim" role="dialog" aria-modal="true" aria-labelledby="relic-trim-title"><header><span class="eyebrow">MAKE ROOM FOR YOUR BUILD</span><h2 id="relic-trim-title">为这一局，保留五件。</h2><p>旧存档携带超过五种道具，请选择保留五件。其余道具效果将移除，已获得的经验与生命上限保留。确认前，原行囊完整保存。</p></header><div class="relic-trim-options">${ownedRelics(s.relics).map(id=>{const item=RELICS[id],rarity=RARITIES[item.rarity];return `<button class="relic-trim-item ${this.trimSelected.has(id)?'selected':''}" data-action="relic-trim-toggle" data-value="${id}" aria-pressed="${this.trimSelected.has(id)}" style="--relic:${rarity.color}">${relicIcon(id)}<span><b>${item.name}</b><small>${rarity.name} · Lv.${s.relics[id]}</small><span>${relicDetail(id,s.relics[id])}</span></span><i>${this.trimSelected.has(id)?'✓':'○'}</i></button>`;}).join('')}</div><footer class="relic-trim-footer"><span>已选 ${this.trimSelected.size} / ${RELIC_SLOTS}</span><button class="primary-button" data-action="relic-trim-confirm" ${this.trimSelected.size===RELIC_SLOTS?'':'disabled'}>保留这五件，继续试炼</button></footer></section>`;
  }
  private relicInventory() {
    const s = this.app.run!.state, groups = relicGroups(s.relics);
    return `<section class="relic-inventory" role="dialog" aria-modal="true" aria-labelledby="relic-bag-title"><button class="back-button" data-action="back">${icon('back')}返回</button><header><span class="eyebrow">COLLECT, COMBINE, BECOME</span><h2 id="relic-bag-title">这一局的随身道具</h2><p>30 件道具，六种品质 · 本局最多装备五种，每件五级。同组两件、三件解锁组合；升级不占新格。</p></header>
      ${(Object.keys(RELIC_GROUPS) as RelicGroup[]).map(id => { const group = RELIC_GROUPS[id], count = groups[id]; return `<section class="relic-family" style="--relic:${group.color};--relic-tint:${group.tint}"><h3>${group.name}<small>${count}/5 件</small></h3><div class="relic-family-items">${RELIC_IDS.filter(key => RELICS[key].group === id).map(key => `<article class="relic-owned ${s.relics[key] ? 'collected' : ''}">${relicIcon(key)}<div><b>${RELICS[key].name}<em class="relic-catalog-rarity" style="color:${RARITIES[RELICS[key].rarity].color}">${RARITIES[RELICS[key].rarity].name}</em><small>${s.relics[key] ? `Lv.${s.relics[key]}/${RELIC_CAP}` : '未获得'}</small></b><span>${s.relics[key] ? relicDetail(key, s.relics[key]) : RELICS[key].effect}</span></div></article>`).join('')}</div><div class="relic-set-bonuses"><span class="${count >= 2 ? 'active' : ''}">${count >= 2 ? '✓' : '○'} 两件 · ${group.two}</span><span class="${count >= 3 ? 'active' : ''}">${count >= 3 ? '✓' : '○'} 三件 · ${group.three}</span></div></section>`; }).join('')}
      <section class="food-guide"><h3>战斗间隙，吃点好的。</h3><p>普通怪击杀食物掉率 ${5+s.relics.food*2}% · 满血时留在地上，受伤后靠近拾取。</p><div>${Object.entries(FOODS).map(([id,food])=>`<span><img src="${ASSETS[`food-${id}`]}" alt=""><b>${food.name}<small>基础恢复 ${food.heal} 生命</small></b></span>`).join('')}</div></section>
      <p class="relic-inventory-note">道具只在本局生效，退出时随对局保存。${Object.values(s.perks).some(rank => rank > 0) ? '旧存档的锻造积累已保留，后续升级仅选择道具。' : '名刀自身的故事被动与道具同时生效。'}</p></section>`;
  }
  private powerPanel() {
    const run = this.app.run!, p = combatPower(run);
    return `<section class="small-panel power-panel"><button class="back-button" data-action="back">${icon('back')}返回</button>${this.header('BLADE GROWTH','战斗力',p.blade+' · 本局成长参考')}<strong class="power-value">${p.value.toLocaleString()}</strong><p>这把刀初始为 1,000，展示当前装备与道具的成长。各刀分别归一，不用于刀型排名。</p><div class="power-axes">${p.axes.map(a=>`<div><span>${a.name}<small>权重 ${a.weight*100}%</small></span><meter min="0" max="5" value="${Math.min(5,a.ratio)}"></meter><b>×${a.ratio.toFixed(2)}</b></div>`).join('')}</div><p class="muted">按输出、范围与控制、移动、生命与灵护的相对增幅加权计算；专属技能的触发时机仍会影响实战。</p></section>`;
  }
  private pausePanel() {
    const s = this.app.run!.state;
    return `<section class="small-panel">${this.header('TAKE A BREATH', '刀锋暂歇', '休息一下，这一局还在等你。')}<div class="pause-summary"><img src="${ASSETS[`blade-${this.app.run!.tier + 1}`]}" alt=""><div><b>${TIERS[this.app.run!.tier].name}</b><span>Lv.${s.level} · ${formatTime(s.time + s.bossTime)} · ${s.kills} 击败</span></div></div><button class="primary-button" data-action="resume">${icon('play')}继续试炼</button><div class="pause-links"><button class="secondary-button" data-action="power">${icon('star')}战斗力</button><button class="secondary-button" data-action="relics">${icon('star')}随身道具</button><button class="secondary-button" data-action="codex">${icon('book')}刀型图鉴</button><button class="secondary-button" data-action="settings">${icon('settings')}游戏设置</button></div><button class="text-button" data-action="save-title">保存并返回首页</button><button class="text-button muted" data-action="restart">重新开始</button></section>`;
  }
  private settings() {
    const s = this.app.storage.data.settings;
    const toggle = (key: string, name: string, text: string, checked: boolean) => `<label class="setting-row"><span><b>${name}</b><small>${text}</small></span><input type="checkbox" data-setting="${key}" ${checked ? 'checked' : ''}><i class="toggle"></i></label>`;
    const themes = GROUNDS.map(ground => `<button class="ground-choice ${s.ground === ground.id ? 'selected' : ''}" data-action="ground" data-value="${ground.id}" aria-pressed="${s.ground === ground.id}" aria-label="${ground.name}">
      <div class="ground-preview"><img src="${groundPreview(ground.id)}" alt=""><span class="ground-selected">✓</span></div>
      <strong>${ground.name}${ground.id === 'grid' ? '<em>推荐</em>' : ''}</strong><small>${ground.description}</small></button>`).join('');
    const skins = ['青空', '曙光', '星紫'].map((name, index) => {
      const unlocked = index === 0 || index === 1 && this.app.storage.data.meta.maxTier >= MASTERIES.length - 1 || index === 2 && this.app.storage.data.meta.runs >= 5;
      return `<button data-action="skin" data-value="${index}" class="${s.color === index ? 'selected' : ''}" ${unlocked ? '' : 'disabled'} title="${index === 1 ? '任意刀完成觉醒后解锁' : index === 2 ? '完成五次试炼解锁' : '初始配色'}"><i style="background:${['#67b9ed', '#e7a768', '#aa86e5'][index]}"></i>${name}${unlocked ? '' : icon('lock')}</button>`;
    }).join('');
    return `<section class="small-panel settings-panel"><button class="back-button" data-action="back">${icon('back')}返回</button>
      ${this.header('MAKE IT YOURS', '挑一片喜欢的战场。', '选择立即生效，也会记住你的偏好。')}
      <div class="settings-content"><section class="ground-section"><h3>战场主题<span>全部可用 · 随时切换</span></h3><div class="ground-options" role="group" aria-label="战场主题">${themes}</div></section>
      <section class="preferences-section"><h3>感官与反馈</h3>
      ${toggle('sound', '刀声与音效', '挥刀、命中、拾取与进化反馈', s.sound)}
      ${toggle('monsterSound', '怪物受伤声', '软团啾鸣、甲壳碰响与幽魂气声，自动限制叠音', s.monsterSound)}
      ${toggle('motion', '动态效果', '关闭后减少浮动与非必要动效', s.motion)}
      ${toggle('hitPause', '命中停顿', '重击短暂停顿，最多 45 毫秒', s.hitPause)}
      ${toggle('haptics', '重击触感', '支持的设备在重击时轻振，默认关闭', s.haptics)}
      ${toggle('shake', '轻微震屏', '受伤和关键重击时的反馈', s.shake)}
      ${toggle('simplified', '轻量画面', '减少粒子与怪物数量，适合较慢设备', s.simplified)}
      <div class="skin-setting"><b>角色配色 <small>成就解锁，仅改变外观</small></b><div class="skin-options">${skins}</div></div></section></div>
      <div class="setting-footer">${icon('shield')} 切换窗口自动暂停 · 每 5 秒自动保存</div><button class="primary-button" data-action="back">完成</button></section>`;
  }
  private codex() {
    const m = this.app.storage.data.meta;
    return `<section class="codex-panel"><button class="back-button" data-action="back">${icon('back')}返回</button><div class="codex-heading">${this.header('THE BLADE ARCHIVE', '十二柄刀，十二条成长之路。', `每局任选一把，从初识练到觉醒。每个掌握阶段至少实战 ${MIN_FORM_TIME} 秒，道具与专属被动在本局持续成长。`)}<span class="archive-count">${m.seenBlades.length}<small>/ ${TIERS.length} 已试用 · 全部可选</small></span></div><div class="codex-grid">${BLADE_CATALOGUE.map(({ blade: t, index: i }) => { const passive = passiveForTier(i); return `<article data-tier="${i}" class="codex-card" style="--tier:${t.color}"><div class="codex-number"><b>${t.role}</b><span>${m.seenBlades.includes(i) ? '已试用' : '随时可选'}</span>${icon(m.seenBlades.includes(i) ? 'star' : 'sword')}</div><button class="codex-art" data-action="inspect" data-value="${i}" aria-label="旋转鉴赏${t.name}"><img src="${ASSETS[`blade-${i + 1}`]}" alt="${t.name}"><span>⟳ 旋转鉴赏</span></button><h3>${t.name}<em>${t.title}</em></h3><div class="codex-source">${t.source}<span>${t.bearer}</span></div><p class="codex-lore">${t.lore}</p><div class="codex-passive"><small>初识 · 专属被动</small><b>${passive.name}</b><p>${passive.description}</p><span>${passive.story}</span></div><div class="codex-growth">${MASTERIES.map((stage, j) => `<div><b>${stage}<small>Lv.${TIER_LEVELS[j]}</small></b><span>${passiveGrowth(i, j)}</span></div>`).join('')}</div><small>本局始终使用这把刀 · 道具改变尺寸与手感</small></article>`; }).join('')}</div><p class="archive-note">刀名与背景参考所标注作品，介绍为简述；掌握阶段、被动成长、造型与特效均为本作玩法演绎。不同名刀是平行流派，图鉴按来源陈列。</p><section class="monster-archive"><div class="monster-archive-heading"><div><span class="eyebrow">CREATURES OF THE TRIAL</span><h3>怪物志</h3></div><span>12 种普通形态 · 精英与首领</span></div><div class="monster-cards">${Object.entries(ENEMY_INFO).map(([kind, info]) => `<article class="monster-card" data-monster="${kind}"><img src="${ASSETS[kind]}" alt="${info.name}"><div><h4>${info.name}<span>${info.role}</span></h4><p>${info.description}</p><small>${kind === 'brood' ? '母团分裂时出现' : kind === 'elite' ? '每两分钟出现精英' : info.from ? `${formatTime(info.from)} 起登场` : '开局登场'}</small></div></article>`).join('')}</div></section><div class="achievements-heading"><b>试炼印记</b><span>${m.achievements.length} / ${ACHIEVEMENTS.length}</span></div><div class="achievements-grid">${ACHIEVEMENTS.map(a => `<div class="achievement ${m.achievements.includes(a.id) ? 'unlocked' : ''}">${icon(a.icon)}<span><b>${a.name}</b><small>${a.description}</small></span>${m.achievements.includes(a.id) ? '<i>已达成</i>' : icon('lock')}</div>`).join('')}</div><div class="codex-records"><span>试炼次数 <b>${m.runs}</b></span><span>通关次数 <b>${m.wins}</b></span><span>最高战绩 <b>${m.bestScore.toLocaleString()}</b></span></div></section>`;
  }
  private result() {
    const run = this.app.run!, s = run.state, win = s.mode === 'won', t = TIERS[run.tier];
    const items = RELIC_IDS.filter(id => s.relics[id] > 0);
    return `<section class="result-panel" style="--tier:${t.color}"><span class="result-emblem">${icon(win ? 'trophy' : 'sword')}</span><span class="eyebrow">${win ? 'DAWN HAS COME' : 'EVERY BLADE HAS A BEGINNING'}</span><h2>${win ? '你，斩出了破晓。' : '刀锋暂折，来日更利。'}</h2><p>${win ? '圆甲暴君已倒下。这把神兵，属于这一局的你。' : s.failure}</p><div class="result-weapon"><img src="${ASSETS[`blade-${run.tier + 1}`]}" alt="${t.name}"><b>${t.name}<small>${MASTERIES[run.mastery]} · Lv.${s.level}${s.level === MAX_LEVEL ? ' 极境' : ''}</small></b></div><div class="result-score"><small>本局战绩</small><strong>${run.score().toLocaleString()}</strong>${this.app.isNewBest ? '<span>NEW PERSONAL BEST</span>' : ''}</div><div class="result-stats"><span><b>${formatTime(s.time + s.bossTime)}</b><small>存活时间</small></span><span><b>${s.kills}</b><small>击败怪物</small></span><span><b>${s.bestCleave}</b><small>最高一刀</small></span><span><b>${s.eliteKills}</b><small>精英击败</small></span></div>${items.length ? `<div class="relic-result-items">${items.map(id => `<span>${relicIcon(id)}${RELICS[id].name} Lv.${s.relics[id]}</span>`).join('')}</div>` : ''}<button class="primary-button" data-action="restart-now">${icon('play')}再开一局${icon('arrow')}</button><button class="text-button" data-action="title">返回首页</button><small class="reset-note">图鉴与战绩保留，下一局可重新选刀，从初识开始。</small></section>`;
  }
  render(force = false) {
    const app = this.app, run = app.run, s = run?.state, panel = app.panel;
    const end = s?.mode === 'dead' || s?.mode === 'won';
    if (panel !== 'codex' && this.inspector?.active) this.inspector.close();
    if (panel === 'relics' || s && ['evolving', 'relic', 'relic-trim', 'boss-intro'].includes(s.mode)) {
      const toast = document.querySelector('#toast')!;
      if (toast.classList.contains('show')) { this.deferredToast = toast.querySelector('span')?.textContent ?? this.deferredToast; toast.classList.remove('show'); clearTimeout(this.toastTimer); }
    }
    if (this.deferredToast && (!s || end || s.mode === 'playing' && panel === 'none')) { const message = this.deferredToast; this.deferredToast = ''; this.toast(message); }
    if(s?.id!==this.trimRun){this.trimRun=s?.id??'';this.trimSelected.clear();}
    const key = `${[...this.trimSelected].join(',')}|${s?.id}|${app.selectedBlade}|${s?.level}|${s ? Object.values(s.relics).join(',') : ''}|${panel}|${s?.mode}|${s?.pending[0]}|${s?.choices.join(',')}|${app.storage.data.meta.maxTier}|${app.storage.data.settings.sound}|${app.storage.data.settings.ground}|${app.storage.data.run?.id}`;
    if (force || key !== this.key) {
      const scrollSelector = panel === 'codex' ? '.codex-panel' : panel === 'settings' ? '.settings-panel' : panel === 'loadout' ? '.loadout-panel' : s?.mode==='relic-trim'?'.relic-trim':'';
      const scrollTop = scrollSelector ? this.overlay.querySelector<HTMLElement>(scrollSelector)?.scrollTop : undefined;
      this.key = key;
      document.body.dataset.screen = panel === 'title' ? 'title' : panel === 'none' && !end ? 'battle' : 'menu';
      document.body.classList.toggle('reduced-motion', !app.storage.data.settings.motion);
      document.querySelector<HTMLElement>('#brandbar')!.hidden = panel !== 'title';
      document.querySelector<HTMLElement>('#battle-hud')!.hidden = !s || panel === 'title' || !!end;
      this.overlay.className = `overlay ${panel === 'title' ? 'title-overlay' : 'modal-overlay'}`;
      const content = panel === 'title' ? this.title() : panel === 'loadout' ? this.loadout() : panel === 'power' ? this.powerPanel() : panel === 'relics' ? this.relicInventory() : panel === 'pause' ? this.pausePanel() : panel === 'settings' ? this.settings() : panel === 'codex' ? this.codex() : panel === 'confirm' ? `<section class="small-panel confirm-panel">${this.header('A NEW BEGINNING', '开启新的试炼？', '当前未完成的对局会被新一局替代，图鉴和战绩将保留。')}<button class="primary-button" data-action="restart-now">重新选刀出发</button><button class="secondary-button" data-action="back">返回</button></section>` : end ? this.result() : s?.mode === 'relic' ? this.relicChoice() : s?.mode==='relic-trim'?this.relicTrim():'';
      if(s){const items=ownedRelics(s.relics);document.querySelector('#relic-slots')!.innerHTML=Array.from({length:RELIC_SLOTS},(_,i)=>items[i]?`<span title="${RELICS[items[i]].name} Lv.${s.relics[items[i]]}" style="--relic:${RARITIES[RELICS[items[i]].rarity].color}">${relicIcon(items[i])}</span>`:'<span class="empty"></span>').join('');}
      this.overlay.innerHTML = content; this.overlay.hidden = !content;
      if (panel === 'relics') requestAnimationFrame(() => this.overlay.querySelector<HTMLButtonElement>('.back-button')?.focus({ preventScroll: true }));
      if (scrollTop !== undefined) this.overlay.querySelector<HTMLElement>(scrollSelector)!.scrollTop = scrollTop;
      for (const id of ['title-sound', 'battle-sound']) document.querySelector(`#${id}`)!.innerHTML = icon(app.storage.data.settings.sound ? 'sound' : 'mute');
      if (s?.mode === 'relic') requestAnimationFrame(() => this.overlay.querySelector<HTMLButtonElement>('.relic-card, .relic-skip')?.focus({ preventScroll: true }));
    }
    if (!run || panel === 'title') return;
    const state = run.state, tier = run.tier, stage = run.mastery, t = TIERS[tier];
    const text = (id: string, value: string) => { const node = document.getElementById(id)!; if (node.textContent !== value) node.textContent = value; };
    const percent = (id: string, value: number) => { document.getElementById(id)!.style.width = `${Math.max(0, Math.min(100, value * 100))}%`; };
    text('health-value', `${Math.ceil(state.hp)} / ${state.maxHp}`); percent('health-fill', state.hp / state.maxHp);
    document.querySelector('.health-cluster')!.classList.toggle('low', state.hp < state.maxHp * .3);
    text('relic-count', `道具 ${ownedRelics(state.relics).length}/${RELIC_SLOTS}`);
    text('relic-shield', relicGroups(state.relics).spirit >= 3 ? state.relicState.shield ? '泡泡盾就绪' : `护盾 ${Math.ceil(state.relicState.shieldCooldown)}s` : '');
    text('level-label', `Lv.${state.level}`); percent('xp-fill', state.level === MAX_LEVEL ? 1 : state.xp / xpNext(state.level));
    text('next-form', run.holdingXp ? `练刀 ${Math.ceil(run.formRemaining)}s · 经验已存` : state.level === MAX_LEVEL ? '极境 · 满级' : stage === MASTERIES.length - 1 ? '觉醒 · 极境之路' : `${MASTERIES[stage + 1]} Lv.${TIER_LEVELS[stage + 1]}`);
    text('clock', formatTime(state.bossStarted ? Math.ceil(BOSS_DURATION - state.bossTime) : state.time));
    text('stage-label', state.bossStarted ? '首领决战' : state.level > LATE_GAME_LEVEL ? '高压试炼' : '生存试炼'); text('clock-goal', state.bossStarted ? '倒计时' : `/ ${formatTime(GAME_DURATION)}`);
    document.getElementById('stage-label')!.classList.toggle('high-pressure', state.level > LATE_GAME_LEVEL);
    document.querySelector('.battle-clock')!.classList.toggle('urgent', state.bossStarted && state.bossTime >= 75);
    text('kill-count', String(state.kills)); text('combo-counter', state.recentKills.length >= 5 ? `${state.recentKills.length} 连斩` : '');
    const equipment = run.stats;
    text('blade-loadout', `长 ${equipment.lengthScale.toFixed(2)}× · 宽 ${equipment.widthScale.toFixed(2)}× · ${loadName(equipment.mass)}`);
    text('passive-name', run.passiveInfo.name); text('passive-state', passiveProgress(t.id, state.passive, state.dashCooldown, stage));
    const passiveButton = document.querySelector<HTMLElement>('#current-passive')!; passiveButton.style.setProperty('--passive', t.color);
    passiveButton.classList.toggle('ready', state.passive.shield || state.passive.empowered > 0 || state.passive.haste > 0);
    text('current-name', t.name); text('current-tier', `${MASTERIES[stage]} · ${t.role}`);
    const currentImage = document.querySelector<HTMLImageElement>('#current-blade-image')!;
    if (currentImage.dataset.tier !== String(tier)) { currentImage.src = ASSETS[`blade-${tier + 1}`]; currentImage.dataset.tier = String(tier); }
    document.querySelector('#tier-pips')!.innerHTML = MASTERIES.map((name, i) => `<i title="${name}" class="${i <= stage ? 'lit' : ''}" style="--tier:${t.color}"></i>`).join('');
    document.querySelector('#current-name')!.setAttribute('style', `color:${t.color}`);
    const dashProgress = document.querySelector<SVGCircleElement>('#dash-progress')!;
    dashProgress.style.strokeDashoffset = `${282.75 * (state.dashCooldown / run.stats.dashCooldown)}`;
    document.querySelector('#dash-button')!.classList.toggle('cooling', state.dashCooldown > 0);
    text('dash-label', state.dashCooldown > .1 ? `${state.dashCooldown.toFixed(1)}s` : '瞬步');
    document.querySelector<HTMLElement>('#tutorial')!.hidden = state.time > 16 || state.bossStarted;
    document.querySelector<HTMLElement>('#boss-warning')!.hidden = state.mode !== 'boss-intro';
    document.querySelector<HTMLElement>('#evolution-flash')!.hidden = state.mode !== 'evolving';
    const boss = state.enemies.find(e => e.kind === 'boss');
    document.querySelector<HTMLElement>('#boss-health')!.hidden = !boss;
    if (boss) percent('boss-fill', boss.hp / boss.maxHp);
  }
}
