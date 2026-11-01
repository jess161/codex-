import { ACHIEVEMENTS, BLADE_CATALOGUE, DEFAULT_WEAPON, isBasicWeapon, BOSS_DURATION, ENEMY_INFO, LATE_GAME_LEVEL, MAX_LEVEL, MASTERIES, TIERS, TIER_LEVELS, formatTime } from './config';
import { ASSETS } from './assets';
import type { BladeApp } from './main';
import { GROUNDS, groundPreview } from './grounds';
import { shopEquipmentStats, loadName } from './equipment';
import { passiveProgress } from './passives';
import { GEAR, GEAR_IDS, GEAR_BRANCHES, GEAR_RARITIES, GEAR_SLOTS, gearBlockReason, gearPurchaseHint, gearSellPrice, RUN_DURATION, SURVIVAL_DURATION, COIN_VALUES, coinDropChance, freshGear, gearDetail, gearPrice, type GearId, type GearCategory } from './gear';
import { gearIcon, coinIcon } from './gear-art';
import type { BladeInspector } from './inspector';
import { combatPower } from './power';


const paths: Record<string, string> = {
  carrot: '<path d="M8 7c5-2 10 2 12 11 1 3-1 4-3 2C9 17 5 12 8 7Z"/><path d="m9 8-5-5m4 4V2M7 8H2m10 3 2-1m0 6 2-1"/>',
  banana: '<path d="M5 3c12 1 17 13 5 18l-2-2c8-6 6-10-4-14Z"/><path d="m4 3 2-1m3 18 2 1M7 6c7 3 10 8 4 12M4 4v16"/>',
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
  shop: '<path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0M9 20v-6h6v6M7 4v6m10-6v6"/>',
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
    if (this.app.panel !== 'codex' || !Number.isInteger(blade) || !isBasicWeapon(blade)) return;
    this.app.clearInputs();
    const { BladeInspector } = await import('./inspector');
    if (this.app.panel !== 'codex') return;
    this.inspector ??= new BladeInspector(); void this.inspector.open(blade);
  }
  shopOpen = false;
  shopCategory: GearCategory | 'all' = 'all';
  selectedGear?: GearId;
  private shopFocus?: HTMLElement;
  private shopKey = '';
  private key = '';
  private gearKey = '';
  private pickupTimer = 0;
  toggleShop(category?: GearCategory | 'all') {
    if (this.app.panel !== 'none' || !this.app.run || ['won','dead'].includes(this.app.run.state.mode)) return;
    const wasOpen = this.shopOpen;
    this.shopOpen = category !== undefined ? true : !wasOpen;
    if (!wasOpen && this.shopOpen) {
      this.shopFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
      this.shopCategory = category ?? 'all'; this.selectedGear = undefined;
    } else if (category !== undefined) { this.shopCategory = category; this.selectedGear = undefined; }
    if (wasOpen !== this.shopOpen) { this.app.clearInputs(); this.app.scene.pausedRun = this.app.battlePaused; this.app.save(); }
    this.renderShop();
    if (!wasOpen && this.shopOpen) document.querySelector<HTMLButtonElement>('[data-shop-close]')?.focus({preventScroll:true});
    if (wasOpen && !this.shopOpen) (this.shopFocus?.isConnected ? this.shopFocus : document.querySelector<HTMLElement>('#shop-button'))?.focus({preventScroll:true});
  }
  selectGear(id: GearId) {
    if (this.app.panel !== 'none' || !this.app.run || ['won','dead'].includes(this.app.run.state.mode)) return;
    if (!this.shopOpen) this.toggleShop(GEAR[id].category);
    this.selectedGear = id; this.renderShop();
    const list=document.querySelector<HTMLElement>('.shop-items'),item=document.querySelector<HTMLElement>('.shop-item.selected');
    if (list && item) {
      const view=list.getBoundingClientRect(),tile=item.getBoundingClientRect();
      if (tile.bottom>view.bottom) list.scrollTop+=tile.bottom-view.bottom+6;
      else if (tile.top<view.top) list.scrollTop-=view.top-tile.top+6;
    }
  }
  showGearPickup(id: GearId, rank: number) {
    const node = document.querySelector<HTMLElement>('#pickup-note')!;
    node.innerHTML = `${gearIcon(id)}<span>${GEAR[id].from?'升级为':'获得'}${GEAR[id].name} · ${GEAR_RARITIES[GEAR[id].rarity].name}${id==='ironBlade'&&rank>1?` ×${rank}`:''}</span>`;
    node.style.setProperty('--relic', GEAR_RARITIES[GEAR[id].rarity].color); node.hidden = false;
    clearTimeout(this.pickupTimer); this.pickupTimer = window.setTimeout(() => node.hidden = true, 1500);
  }
  private renderShop() {
    const node = document.querySelector<HTMLElement>('#equipment-shop')!, run = this.app.run, e = run?.state.economy;
    if (this.app.panel !== 'none' || !run || ['won', 'dead'].includes(run.state.mode)) this.shopOpen = false;
    node.hidden = !this.shopOpen || !e;
    document.querySelector<HTMLElement>('#shop-backdrop')!.hidden = node.hidden;
    const opener = document.querySelector<HTMLElement>('#shop-button')!;
    opener.setAttribute('aria-expanded', String(!node.hidden));
    opener.setAttribute('aria-label', node.hidden ? '打开商店，暂停战斗' : '关闭商店，继续战斗');
    if (node.hidden || !e) return;
    const key = `${this.shopCategory}:${this.selectedGear ?? ''}:${GEAR_IDS.map(id => e.gear[id]).join(',')}:${run.state.mode}`;
    if (key === this.shopKey) {
      node.querySelector('[data-shop-wallet]')!.textContent = String(e.wallet);
      const buy = node.querySelector<HTMLButtonElement>('[data-action="buy-gear"]');
      if (buy && this.selectedGear) {
        const reason = gearBlockReason(e,this.selectedGear);
        buy.disabled = !!reason || run.state.mode !== 'playing'; buy.title = reason;
        node.querySelector('[data-purchase-status]')!.textContent = reason || gearPurchaseHint(this.selectedGear);
      }
      return;
    }
    this.shopKey = key;
    const list = node.querySelector<HTMLElement>('.shop-items'), scroll = list?.scrollTop ?? 0;
    const active = node.contains(document.activeElement) ? document.activeElement as HTMLElement : undefined;
    const focusAction = active?.dataset.action, focusValue = active?.dataset.value;
    node.innerHTML = `<header class="shop-heading"><div><h2 id="shop-title">装备商店</h2><span>${icon('pause')}普通 → 稀有 → 史诗 · 战斗已暂停</span></div><div class="shop-gold">${coinIcon()}<b data-shop-wallet>${e.wallet}</b></div><button data-shop-close data-action="shop" class="icon-button" aria-label="关闭商店">${icon('close')}</button></header>
      ${this.shopTree()}
      ${this.shopDetail()}
      <footer class="shop-footer"><span>已装备 ${e.order.length}/${GEAR_SLOTS}<small>升级替换原装备 · 出售返还 75%</small></span><button data-action="shop" data-shop-resume>继续战斗 ${icon('play')}</button></footer>`;
    const nextList = node.querySelector<HTMLElement>('.shop-items')!; nextList.scrollTop = scroll;
    if (focusAction) {
      const target=Array.from(node.querySelectorAll<HTMLElement>('[data-action]')).find(el=>el.dataset.action===focusAction&&el.dataset.value===focusValue);
      (target?.matches(':disabled') ? node.querySelector<HTMLElement>('.shop-item.selected') : target)?.focus({preventScroll:true});
    }
  }
  private shopTree() {
    const e=this.app.run!.state.economy!,selected=this.selectedGear;
    const tile=(id:GearId)=>{
      const item=GEAR[id],count=e.gear[id],passed=id==='ironBlade'?e.order.some(held=>held!=='ironBlade'):GEAR_BRANCHES.some(([rare,epic])=>id===rare&&e.gear[epic]>0);
      const badge=count?(id==='ironBlade'?`×${count}`:'持有'):passed?'已升级':'';
      const price=count&&item.rarity==='epic'?'已完成':passed&&item.rarity==='rare'?'已升级':`${item.from?'+ ':''}${coinIcon()}${gearPrice(id)}`;
      return `<button class="shop-item ${item.rarity}${selected===id?' selected':''}${count?' owned':''}${passed?' passed':''}" data-action="gear-detail" data-value="${id}" data-gear="${id}" aria-pressed="${selected===id}" aria-label="查看${item.name}，${GEAR_RARITIES[item.rarity].name}${count?`，持有 ${count} 件`:''}${item.from?`，由${GEAR[item.from].name}加${gearPrice(id)}金币升级`:''}"><span class="shop-item-art">${gearIcon(id)}<small class="shop-item-rarity">${GEAR_RARITIES[item.rarity].name}</small>${badge?`<small class="shop-item-rank">${badge}</small>`:''}</span><b class="shop-item-name">${item.name}</b><span class="shop-item-price">${price}</span></button>`;
    };
    const fork=GEAR_BRANCHES.map(([rare,epic],i)=>`<path class="${e.gear[rare]||e.gear[epic]?'reached ':''}${selected===rare||selected===epic?'selected':''}" d="M150 0V16H${50+i*100}V32"/>`).join('');
    const links=GEAR_BRANCHES.map(([rare,epic],i)=>`<path class="${e.gear[epic]?'reached ':''}${selected===rare||selected===epic?'selected':''}" d="M${50+i*100} 0V28"/>`).join('');
    return `<div class="shop-items shop-tree" role="group" aria-label="装备升级树，一件普通装备分为三条稀有与史诗升级路线"><p class="shop-tree-hint">先购买普通装备，沿连线补金币升级</p><div class="shop-tree-root">${tile('ironBlade')}</div><svg class="shop-tree-fork" viewBox="0 0 300 32" preserveAspectRatio="none" aria-hidden="true">${fork}</svg><div class="shop-tree-row">${GEAR_BRANCHES.map(([rare])=>tile(rare)).join('')}</div><svg class="shop-tree-links" viewBox="0 0 300 28" preserveAspectRatio="none" aria-hidden="true">${links}</svg><div class="shop-tree-row">${GEAR_BRANCHES.map(([,epic])=>tile(epic)).join('')}</div></div>`;
  }
  private shopDetail() {
    const id=this.selectedGear,e=this.app.run!.state.economy!;
    if (!id) return '<section class="shop-detail empty"><span>点击图标查看属性与升级所需金币</span></section>';
    const item=GEAR[id],count=e.gear[id],settled=count>0&&id!=='ironBlade',reason=gearBlockReason(e,id),price=gearPrice(id);
    const verb=settled?(item.rarity==='epic'?'已完成':'已拥有'):item.from?'升级':count?'再买一件':'购买';
    const route=item.from?`<div class="shop-detail-route"><b>${GEAR[item.from].name}</b><span>+ ${price} 金币 →</span><b>${item.name}</b><small>累计 ${item.price} 金币</small></div>`:'<div class="shop-detail-route"><span>共享起点 · 每件短刃可走一条路线</span></div>';
    return `<section class="shop-detail" aria-label="装备详情"><div class="shop-detail-heading">${gearIcon(id)}<div><h3>${item.name}<small class="rarity-label ${item.rarity}">${GEAR_RARITIES[item.rarity].name}${count?` · 持有 ${count} 件`:''}</small></h3><p>${item.effect}</p></div></div>${route}<p class="shop-detail-note">${item.note}</p><div class="shop-actions"><small data-purchase-status>${reason || gearPurchaseHint(id)}</small>${count?`<button class="sell-gear" data-action="sell-gear" data-value="${id}" aria-label="出售一件${item.name}，返还${gearSellPrice(id)}金币">出售${count>1?'一件':''} ${gearSellPrice(id)}</button>`:''}<button class="buy-gear" data-action="buy-gear" data-value="${id}" title="${reason}" ${reason?'disabled':''} aria-label="${verb}${item.name}，${price}金币"><b>${verb}</b>${settled?'':`<span>${coinIcon()}${price}</span>`}</button></div></section>`;
  }
  private toastTimer = 0;
  private deferredToast = '';
  private touchButtons = new Map<number, { button: HTMLElement; x: number; y: number }>();
  private handledTouchUntil = 0;
  constructor(readonly app: BladeApp) {
    document.querySelector('#app')!.innerHTML = `
      <header class="brandbar" id="brandbar"><a class="brand" href="#" aria-label="刃之进化首页"><span class="brand-mark">${icon('carrot')}</span><span>刃之进化<small>BLADE EVOLUTION</small></span></a><nav><button class="nav-button" data-action="codex">${icon('book')}<span>武器图鉴</span></button><button class="icon-button" data-action="sound" aria-label="切换声音" id="title-sound">${icon('sound')}</button><button class="icon-button" data-action="settings" aria-label="设置">${icon('settings')}</button><button class="icon-button fullscreen-control" data-action="fullscreen" aria-label="全屏">${icon('full')}</button></nav></header>
      <div id="battle-hud" hidden>
        <div class="hud-top"><div class="health-cluster"><span class="health-icon">${icon('heart')}</span><div class="health-track"><i id="health-fill"></i></div><b id="health-value">100 / 100</b></div><div class="battle-clock"><span id="stage-label">生存试炼</span><b id="clock">00:00</b><small id="clock-goal">/ ${formatTime(RUN_DURATION)}</small></div><div class="hud-buttons"><button class="icon-button" data-action="power" aria-label="战斗力（C）">${icon('star')}</button><button class="icon-button" data-action="sound" aria-label="切换声音" id="battle-sound">${icon('sound')}</button><button class="icon-button" data-action="pause" aria-label="暂停">${icon('pause')}</button></div></div>
        <div class="xp-row"><b id="level-label">Lv.1</b><div class="xp-track"><i id="xp-fill"></i></div><span id="next-form">磨合 Lv.6</span></div>
        <div id="boss-health" hidden><span>圆甲暴君<small>寻找震荡波缺口 · 瞬步避开冲锋</small></span><div><i id="boss-fill"></i></div></div>
        <div class="wallet-bar">${coinIcon()}<b id="coin-balance">0</b><button id="shop-button" data-action="shop" aria-controls="equipment-shop" aria-expanded="false" aria-label="打开商店，暂停战斗" title="商店（B）· 暂停战斗">${icon('shop')}<span>商店</span><kbd>B</kbd></button></div><div id="shop-backdrop" class="shop-backdrop" data-action="shop" aria-hidden="true" hidden></div><aside id="equipment-shop" class="equipment-shop" role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="shop-title" hidden></aside><div class="equipment-dock" id="equipment-dock" hidden><div id="equipment-strip" class="equipment-strip" role="group" aria-label="已获得装备，左右滑动查看" tabindex="0"></div></div><div id="pickup-note" class="pickup-note" role="status" hidden></div><div class="run-counters"><span>${icon('carrot')}<b id="kill-count">0</b><small>击败</small></span><span class="combo-counter" id="combo-counter"></span></div>
        <div class="current-blade"><div class="current-blade-art"><img id="current-blade-image" src="${ASSETS[`blade-${DEFAULT_WEAPON + 1}`]}" alt="当前武器"></div><div><small id="current-tier">初识 · 胡萝卜横扫</small><b id="current-name">胡萝卜刀</b><div class="tier-pips" id="tier-pips"></div><small id="blade-loadout" class="blade-loadout">轻巧</small><button id="current-passive" class="current-passive" data-action="codex" aria-label="查看当前武器的攻击方式"><b id="passive-name">横扫</b><small id="passive-state">45°横扫 · 刀尖拖地</small></button></div></div>
        <div id="build-state" class="build-state"></div><div class="desktop-controls"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>移动</span><kbd>SPACE</kbd><span>瞬步</span><span>自动攻击</span></div>
        <div id="touch-joystick" class="touch-joystick" hidden aria-hidden="true"><span class="joystick-guide"></span><span id="joystick-thumb"></span></div>
        <button id="active-button" class="active-button" data-action="active" aria-label="释放武器主动技能（Q）"><svg class="dash-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45"/><circle id="active-progress" cx="50" cy="50" r="45"/></svg><img id="active-image" src="${ASSETS[`blade-${DEFAULT_WEAPON + 1}`]}" alt=""><b>绝招</b><span id="active-label">就绪</span><kbd>Q</kbd></button>
        <button id="dash-button" class="dash-button" aria-label="瞬步" data-action="dash"><svg class="dash-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45"/><circle id="dash-progress" cx="50" cy="50" r="45"/></svg>${icon('dash')}<span id="dash-label">瞬步</span><kbd>SPACE</kbd></button>
        <div id="tutorial" class="tutorial">走位聚怪，胡萝卜会自动横扫<span>同一把武器，一路觉醒 · 打怪掉金币 · 走近拾取 · 商店购买</span></div>
        <div id="boss-warning" class="boss-warning" hidden><small>THE FINAL TRIAL</small><strong>圆甲暴君</strong><span>${BOSS_DURATION} 秒，斩出最后一条路。</span></div>
        <div id="evolution-flash" class="evolution-flash" hidden></div>
      </div>
      <main id="overlay" class="overlay"></main><div id="toast" class="toast" role="status"></div>
      <div class="boot-status" id="boot-status">正在唤醒刀锋<span></span></div>`;
    this.overlay = document.querySelector('#overlay')!;
    const root = document.querySelector('#app')!;
    document.querySelector('#equipment-shop')!.addEventListener('keydown', event => {
      const key=event as KeyboardEvent;if(key.key!=='Tab')return;
      const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('#equipment-shop button:not(:disabled)'));
      const first=buttons[0],last=buttons[buttons.length-1];
      if(key.shiftKey&&document.activeElement===first){key.preventDefault();last?.focus();}
      else if(!key.shiftKey&&document.activeElement===last){key.preventDefault();first?.focus();}
    });
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
      if (!start && ['dash','active'].includes(target?.dataset.action??'')) { this.handledTouchUntil = performance.now() + 700; return; }
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
    return `<div class="title-layout"><section class="title-copy"><div class="eyebrow"><i></i> 果蔬上阵，两种手感</div><h1>选择你的武器，<br>闯出<span>自己的路。</span></h1><p class="title-description">胡萝卜刀45°横扫，香蕉弓射程140。<br>选一种顺手的武器，走位、聚怪，拾取金币、购买装备变强。</p><div class="title-facts"><span><b>${BLADE_CATALOGUE.length}</b> 种果蔬武器</span><i></i><span><b>${MASTERIES.length}</b> 重掌握阶段</span><i></i><span><b>${RUN_DURATION / 60}</b> 分钟试炼</span></div><div class="title-actions"><button class="primary-button start-button" data-action="${saved ? 'continue' : 'start'}">${icon('play')}<span>${saved ? '继续试炼' : '开始试炼'}</span>${icon('arrow')}</button>${saved ? '<button class="text-button" data-action="start">重新选择武器，开启新的一局</button>' : ''}</div><div class="title-keyboard"><span><kbd>WASD</kbd> 移动</span><span><kbd>空格</kbd> 瞬步</span><span>自动攻击，专注走位</span></div>${m.bestScore > 0 ? `<div class="personal-best">${icon('trophy')} 个人最佳 <b>${m.bestScore.toLocaleString()}</b><span>· ${m.wins} 次通关</span></div>` : ''}</section>
      <section class="title-art" aria-label="胡萝卜刀与香蕉弓两种果蔬武器"><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><div class="art-cross cross-one">+</div><div class="art-cross cross-two">+</div><div class="hero-light"></div><img class="art-enemy art-blob" src="${ASSETS.blob}" alt="软团"><img class="art-enemy art-swift" src="${ASSETS.swift}" alt="疾爪"><img class="art-enemy art-armor" src="${ASSETS.armor}" alt="甲壳"><img class="art-xp xp-one" src="${ASSETS.xp}" alt=""><img class="art-xp xp-two" src="${ASSETS.xp}" alt=""><div class="title-hero"><img src="${ASSETS.hero}" style="filter:hue-rotate(${[0, 185, 70][this.app.storage.data.settings.color]}deg)" alt="主角"><img class="title-weapon ${t.id==='bow'?'fruit-bow':'fruit-knife'}" src="${ASSETS[`blade-${blade + 1}`]}" alt="${t.name}"></div><div class="weapon-caption" style="--tier:${t.color}"><span class="tiny-label">FRESH FROM THE GARDEN</span><b>${t.name}</b><span>${t.role} · 一路相伴，直到觉醒。</span></div><div class="art-note"><span>∞</span><i></i>一根横扫，一弯连射。</div></section>
      <section class="evolution-rail"><div class="rail-caption"><span>CHOOSE YOUR PATH</span><b>胡萝卜刀、香蕉弓，选好出发。</b></div><div class="rail-blades">${BLADE_CATALOGUE.map(({ blade: t, index: i }) => `<button data-action="blade-pick" data-value="${i}" class="rail-blade" style="--tier:${t.color}" aria-label="选择${t.name}"><span>${t.role}</span><img src="${ASSETS[`blade-${i + 1}`]}" alt="${t.name}"><b>${t.name}</b></button>`).join('')}</div></section><footer class="title-footer"><span>单人 PvE · 十分钟一局 · 金币购买装备</span><span>V 3.1 <i></i> 鲜脆上阵。</span></footer></div>`;
  }
  private weaponFacts(blade: number) {
    const stats = shopEquipmentStats(1, blade, freshGear()), id = TIERS[blade].id;
    return `<div class="weapon-facts"><span><b>${stats.interval.toFixed(2)} 秒</b><small>攻击间隔</small></span><span><b>${Math.round(stats.range)}</b><small>${id === 'bow' ? '瓜子射程' : '攻击距离'}</small></span><span><b>${id === 'bow' ? '单枚瓜子' : `${Math.round(stats.arc)}°`}</b><small>${id === 'bow' ? '自动瞄准' : '攻击角度'}</small></span></div>`;
  }
  private loadout() {
    const blade = this.app.selectedBlade, t = TIERS[blade];
    return `<section class="loadout-panel" style="--tier:${t.color}"><button class="back-button" data-action="back">${icon('back')}返回</button>${this.header('FRESH WEAPONS, TWO WAYS', '选一种顺手的武器。', '胡萝卜刀45°横扫 · 香蕉弓射程140')}<div class="loadout-layout"><div class="blade-options" role="group" aria-label="选择本局武器">${BLADE_CATALOGUE.map(({blade: b, index: i}) => `<button class="blade-option ${blade === i ? 'selected' : ''}" style="--blade:${b.color}" data-action="blade-pick" data-value="${i}" aria-pressed="${blade === i}"><img src="${ASSETS[`blade-${i + 1}`]}" alt=""><b>${b.name}</b><span>${b.role}</span>${blade === i ? '<i>✓</i>' : ''}</button>`).join('')}</div><article class="loadout-detail"><span class="eyebrow">${t.role}</span><img class="loadout-weapon ${t.id==='bow'?'fruit-bow':'fruit-knife'}" src="${ASSETS[`blade-${blade + 1}`]}" alt="${t.name}"><h3>${t.name}<small>日常果蔬，认真开打</small></h3><p>${t.lore}</p><div class="loadout-passive"><small>基础攻击 · ${t.technique}</small><p>${t.description}</p></div>${this.weaponFacts(blade)}<p class="weapon-growth-note">攻击会自动瞄准。移动收集经验与金币，随时购买通用装备，同一把武器陪你完成十分钟试炼。</p></article></div><footer class="loadout-footer"><span><b>${t.name}</b><small>${this.app.storage.data.run ? '出发后替换未完成对局，战绩保留' : '自动攻击 · 打怪掉金币 · 走近拾取 · 商店购买'}</small></span><button class="primary-button" data-action="begin">${icon('play')}带上${t.name}出发${icon('arrow')}</button></footer></section>`;
  }
  private header(kicker: string, title: string, subtitle: string) { return `<div class="panel-header"><span class="eyebrow">${kicker}</span><h2>${title}</h2><p>${subtitle}</p></div>`; }
  private relicInventory() {
    const run = this.app.run!, e = run.state.economy;
    return `<section class="gear-inventory small-panel"><button class="back-button" data-action="back">${icon('back')}返回</button>${this.header('YOUR EVERYDAY KIT', '这一局的装备', '普通短刃逐级升级为稀有与史诗，胡萝卜刀与香蕉弓均可使用。')}<section class="owned-gear-category"><h3>已装备 ${e?.order.length??0}/${GEAR_SLOTS}</h3>${(e?.order??[]).map(id=>`<article>${gearIcon(id)}<div><b>${GEAR[id].name} · ${GEAR_RARITIES[GEAR[id].rarity].name}</b><p>${gearDetail(id)}</p></div></article>`).join('')||'<p class="gear-empty">暂未购买装备</p>'}</section><p class="gear-inventory-note">本局已拾取 ${e?.earned ?? 0} 金币 · 已花费 ${e?.spent ?? 0} · 出售返还 ${e?.refunded ?? 0} · 剩余 ${e?.wallet ?? 0}。回到战场后点“商店”沿连线升级；打开商店暂停战斗，关闭后继续。</p></section>`;
  }
  private powerPanel() {
    const run = this.app.run!, p = combatPower(run);
    return `<section class="small-panel power-panel"><button class="back-button" data-action="back">${icon('back')}返回</button>${this.header('BLADE GROWTH','战斗力',p.blade+' · 本局成长参考')}<strong class="power-value">${p.value.toLocaleString()}</strong><p>这把武器初始为 1,000，展示当前装备与等级的成长。各武器分别归一，不用于武器排名。</p><div class="power-axes">${p.axes.map(a=>`<div><span>${a.name}<small>权重 ${a.weight*100}%</small></span><meter min="0" max="5" value="${Math.min(5,a.ratio)}"></meter><b>×${a.ratio.toFixed(2)}</b></div>`).join('')}</div><p class="muted">按输出、范围与控制、移动、生命与恢复的相对增幅加权计算；攻击方式与走位仍会影响实战。</p></section>`;
  }
  private pausePanel() {
    const s = this.app.run!.state;
    return `<section class="small-panel">${this.header('TAKE A BREATH', '刀锋暂歇', '休息一下，这一局还在等你。')}<div class="pause-summary"><img src="${ASSETS[`blade-${this.app.run!.tier + 1}`]}" alt=""><div><b>${TIERS[this.app.run!.tier].name}</b><span>Lv.${s.level} · ${formatTime(s.time + s.bossTime)} · ${s.kills} 击败</span></div></div><button class="primary-button" data-action="resume">${icon('play')}继续试炼</button><div class="pause-links"><button class="secondary-button" data-action="power">${icon('star')}战斗力</button><button class="secondary-button" data-action="relics">${icon('star')}已购装备</button><button class="secondary-button" data-action="codex">${icon('book')}武器图鉴</button><button class="secondary-button" data-action="settings">${icon('settings')}游戏设置</button></div><button class="text-button" data-action="save-title">保存并返回首页</button><button class="text-button muted" data-action="restart">重新开始</button></section>`;
  }
  private settings() {
    const s = this.app.storage.data.settings;
    const toggle = (key: string, name: string, text: string, checked: boolean) => `<label class="setting-row"><span><b>${name}</b><small>${text}</small></span><input type="checkbox" data-setting="${key}" ${checked ? 'checked' : ''}><i class="toggle"></i></label>`;
    const themes = GROUNDS.map(ground => `<button class="ground-choice ${s.ground === ground.id ? 'selected' : ''}" data-action="ground" data-value="${ground.id}" aria-pressed="${s.ground === ground.id}" aria-label="${ground.name}">
      <div class="ground-preview"><img src="${groundPreview(ground.id)}" alt=""><span class="ground-selected">✓</span></div>
      <strong>${ground.name}${ground.id === 'grid' ? '<em>推荐</em>' : ''}</strong><small>${ground.description}</small></button>`).join('');
    const skins = ['青空', '曙光', '星紫'].map((name, index) => {
      const unlocked = index === 0 || index === 1 && this.app.storage.data.meta.maxTier >= MASTERIES.length - 1 || index === 2 && this.app.storage.data.meta.runs >= 5;
      return `<button data-action="skin" data-value="${index}" class="${s.color === index ? 'selected' : ''}" ${unlocked ? '' : 'disabled'} title="${index === 1 ? '任意武器完成觉醒后解锁' : index === 2 ? '完成五次试炼解锁' : '初始配色'}"><i style="background:${['#67b9ed', '#e7a768', '#aa86e5'][index]}"></i>${name}${unlocked ? '' : icon('lock')}</button>`;
    }).join('');
    return `<section class="small-panel settings-panel"><button class="back-button" data-action="back">${icon('back')}返回</button>
      ${this.header('MAKE IT YOURS', '挑一片喜欢的战场。', '选择立即生效，也会记住你的偏好。')}
      <div class="settings-content"><section class="ground-section"><h3>战场主题<span>全部可用 · 随时切换</span></h3><div class="ground-options" role="group" aria-label="战场主题">${themes}</div></section>
      <section class="preferences-section"><h3>感官与反馈</h3>
      ${toggle('sound', '攻击与音效', '挥斩、射击、命中与拾取反馈', s.sound)}
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
    return `<section class="codex-panel"><button class="back-button" data-action="back">${icon('back')}返回</button><div class="codex-heading">${this.header('THE WEAPON ARCHIVE', '胡萝卜横扫，香蕉弓连射。', '全部开局可选。等级与通用装备提升伤害、距离和手感，武器保持原有攻击方式。')}<span class="archive-count">${BLADE_CATALOGUE.filter(({index}) => m.seenBlades.includes(index)).length}<small>/ ${BLADE_CATALOGUE.length} 已试用 · 全部可选</small></span></div><div class="codex-grid">${BLADE_CATALOGUE.map(({blade: t, index: i}) => `<article data-tier="${i}" class="codex-card" style="--tier:${t.color}"><div class="codex-number"><b>${t.role}</b><span>${m.seenBlades.includes(i) ? '已试用' : '随时可选'}</span>${icon(m.seenBlades.includes(i) ? 'star' : t.id==='bow'?'banana':'carrot')}</div><button class="codex-art" data-action="inspect" data-value="${i}" aria-label="旋转鉴赏${t.name}"><img src="${ASSETS[`blade-${i + 1}`]}" alt="${t.name}"><span>⟳ 旋转鉴赏</span></button><h3>${t.name}<em>${t.title}</em></h3><p class="codex-lore">${t.lore}</p><div class="codex-passive"><small>基础攻击</small><b>${t.technique}</b><p>${t.description}</p></div>${this.weaponFacts(i)}<small>本局始终使用这把武器 · 通用装备改变伤害、距离与手感</small></article>`).join('')}</div><p class="archive-note">胡萝卜刀横扫前方45°扇形；香蕉弓在140射程内自动发射瓜子箭。</p><section class="monster-archive"><div class="monster-archive-heading"><div><span class="eyebrow">CREATURES OF THE TRIAL</span><h3>怪物志</h3></div><span>12 种普通形态 · 精英与首领</span></div><div class="monster-cards">${Object.entries(ENEMY_INFO).map(([kind, info]) => `<article class="monster-card" data-monster="${kind}"><img src="${ASSETS[kind]}" alt="${info.name}"><div><h4>${info.name}<span>${info.role}</span></h4><p>${info.description}</p><small>${coinDropChance(kind as keyof typeof COIN_VALUES) === 1 ? '必掉' : `${Math.round(coinDropChance(kind as keyof typeof COIN_VALUES)*100)}% 概率掉落`} ${COIN_VALUES[kind as keyof typeof COIN_VALUES]} 金币 · ${kind === 'brood' ? '母团分裂时出现' : kind === 'elite' ? `每 ${Math.round((this.app.run?.duration??SURVIVAL_DURATION)/5)} 秒出现精英` : info.from ? `${formatTime(info.from*(this.app.run?.duration??SURVIVAL_DURATION)/600)} 起登场` : '开局登场'}</small></div></article>`).join('')}</div></section><div class="achievements-heading"><b>试炼印记</b><span>${m.achievements.length} / ${ACHIEVEMENTS.length}</span></div><div class="achievements-grid">${ACHIEVEMENTS.map(a => `<div class="achievement ${m.achievements.includes(a.id) ? 'unlocked' : ''}">${icon(a.icon)}<span><b>${a.name}</b><small>${a.description}</small></span>${m.achievements.includes(a.id) ? '<i>已达成</i>' : icon('lock')}</div>`).join('')}</div><div class="codex-records"><span>试炼次数 <b>${m.runs}</b></span><span>通关次数 <b>${m.wins}</b></span><span>最高战绩 <b>${m.bestScore.toLocaleString()}</b></span></div></section>`;
  }
  private result() {
    const run = this.app.run!, s = run.state, win = s.mode === 'won', t = TIERS[run.tier];
    const items = s.economy?.order ?? [];
    return `<section class="result-panel" style="--tier:${t.color}"><span class="result-emblem">${icon(win ? 'trophy' : run.isRanged?'banana':'carrot')}</span><span class="eyebrow">${win ? 'DAWN HAS COME' : 'EVERY BLADE HAS A BEGINNING'}</span><h2>${win ? '你，斩出了破晓。' : '刀锋暂折，来日更利。'}</h2><p>${win ? '圆甲暴君已倒下。这把神兵，属于这一局的你。' : s.failure}</p><div class="result-weapon"><img src="${ASSETS[`blade-${run.tier + 1}`]}" alt="${t.name}"><b>${t.name}<small>${MASTERIES[run.mastery]} · Lv.${s.level}${s.level === MAX_LEVEL ? ' 极境' : ''}</small></b></div><div class="result-score"><small>本局战绩</small><strong>${run.score().toLocaleString()}</strong>${this.app.isNewBest ? '<span>NEW PERSONAL BEST</span>' : ''}</div><div class="result-stats"><span><b>${formatTime(s.time + s.bossTime)}</b><small>存活时间</small></span><span><b>${s.kills}</b><small>击败怪物</small></span><span><b>${s.bestCleave}</b><small>最高一刀</small></span><span><b>${s.eliteKills}</b><small>精英击败</small></span></div>${items.length ? `<div class="relic-result-items">${items.map(id => `<span>${gearIcon(id)}${GEAR[id].name} · ${GEAR_RARITIES[GEAR[id].rarity].name}</span>`).join('')}</div>` : ''}<button class="primary-button" data-action="restart-now">${icon('play')}再开一局${icon('arrow')}</button><button class="text-button" data-action="title">返回首页</button><small class="reset-note">图鉴与战绩保留，下一局可重新选择武器，从初识开始。</small></section>`;
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
    const key = `${s?.id}|${app.selectedBlade}|${s?.level}|${s?.economy ? Object.values(s.economy.gear).join(',') : ''}|${panel}|${s?.mode}|${s?.pending[0]}|${s?.choices.join(',')}|${app.storage.data.meta.maxTier}|${app.storage.data.settings.sound}|${app.storage.data.settings.ground}|${app.storage.data.run?.id}`;
    if (force || key !== this.key) {
      const scrollSelector = panel === 'codex' ? '.codex-panel' : panel === 'settings' ? '.settings-panel' : panel === 'loadout' ? '.loadout-panel' : '';
      const scrollTop = scrollSelector ? this.overlay.querySelector<HTMLElement>(scrollSelector)?.scrollTop : undefined;
      this.key = key;
      document.body.dataset.screen = panel === 'title' ? 'title' : panel === 'none' && !end ? 'battle' : 'menu';
      document.body.classList.toggle('reduced-motion', !app.storage.data.settings.motion);
      document.querySelector<HTMLElement>('#brandbar')!.hidden = panel !== 'title';
      document.querySelector<HTMLElement>('#battle-hud')!.hidden = !s || panel === 'title' || !!end;
      this.overlay.className = `overlay ${panel === 'title' ? 'title-overlay' : 'modal-overlay'}`;
      const content = panel === 'title' ? this.title() : panel === 'loadout' ? this.loadout() : panel === 'power' ? this.powerPanel() : panel === 'relics' ? this.relicInventory() : panel === 'pause' ? this.pausePanel() : panel === 'settings' ? this.settings() : panel === 'codex' ? this.codex() : panel === 'confirm' ? `<section class="small-panel confirm-panel">${this.header('A NEW BEGINNING', '开启新的试炼？', '当前未完成的对局会被新一局替代，图鉴和战绩将保留。')}<button class="primary-button" data-action="restart-now">重新选择武器出发</button><button class="secondary-button" data-action="back">返回</button></section>` : end ? this.result() : '';
      const items = run?.gearOrder ?? [], strip = document.querySelector<HTMLElement>('#equipment-strip')!, signature = items.map(id => `${id}:${s!.economy!.gear[id]}`).join('|');
      if (signature !== this.gearKey) {
        const scroll = strip.scrollLeft, previous = strip.childElementCount; this.gearKey = signature;
        strip.innerHTML = items.map(id => `<button class="equipment-chip ${GEAR[id].rarity}" data-action="gear-detail" data-value="${id}" aria-label="${GEAR[id].name}，${GEAR_RARITIES[GEAR[id].rarity].name}" title="${GEAR[id].name} · ${gearDetail(id)}">${gearIcon(id)}<small>${GEAR_RARITIES[GEAR[id].rarity].name}</small></button>`).join('');
        strip.scrollLeft = items.length > previous ? strip.scrollWidth : scroll;
      }
      const dockVisible = !!s && items.length > 0 && panel !== 'title' && !end;
      document.querySelector<HTMLElement>('#equipment-dock')!.hidden = !dockVisible; document.body.classList.toggle('has-equipment', dockVisible);
      this.overlay.innerHTML = content; this.overlay.hidden = !content;
      if (panel === 'relics') requestAnimationFrame(() => this.overlay.querySelector<HTMLButtonElement>('.back-button')?.focus({ preventScroll: true }));
      if (scrollTop !== undefined) this.overlay.querySelector<HTMLElement>(scrollSelector)!.scrollTop = scrollTop;
      for (const id of ['title-sound', 'battle-sound']) document.querySelector(`#${id}`)!.innerHTML = icon(app.storage.data.settings.sound ? 'sound' : 'mute');
    }
    this.renderShop();
    if (!run || panel === 'title') return;
    const state = run.state, tier = run.tier, stage = run.mastery, t = TIERS[tier];
    const text = (id: string, value: string) => { const node = document.getElementById(id)!; if (node.textContent !== value) node.textContent = value; };
    const percent = (id: string, value: number) => { document.getElementById(id)!.style.width = `${Math.max(0, Math.min(100, value * 100))}%`; };
    text('health-value', `${Math.ceil(state.hp)} / ${state.maxHp}`); percent('health-fill', state.hp / state.maxHp);
    document.querySelector('.health-cluster')!.classList.toggle('low', state.hp < state.maxHp * .3);
    text('coin-balance', String(state.economy?.wallet ?? 0));
    const build=state.build;
    text('build-state',state.economy&&build?.bloodShield?'血契盾 '+Math.ceil(build.bloodShield):'');
    text('level-label', `Lv.${state.level}`); percent('xp-fill', state.level === MAX_LEVEL ? 1 : state.xp / run.xpNeeded);
    text('next-form', run.holdingXp ? `磨合 ${Math.ceil(run.formRemaining)}s · 经验已存` : state.level === MAX_LEVEL ? '极境 · 满级' : stage === MASTERIES.length - 1 ? '觉醒 · 极境之路' : `${MASTERIES[stage + 1]} Lv.${TIER_LEVELS[stage + 1]}`);
    text('clock', formatTime(state.bossStarted ? Math.ceil(run.bossDuration - state.bossTime) : state.time));
    text('stage-label', state.bossStarted ? '首领决战' : state.level > LATE_GAME_LEVEL ? '高压试炼' : '生存试炼'); text('clock-goal', state.bossStarted ? '倒计时' : `/ ${formatTime(state.economy ? RUN_DURATION : run.duration)}`);
    document.getElementById('stage-label')!.classList.toggle('high-pressure', state.level > LATE_GAME_LEVEL);
    document.querySelector('.battle-clock')!.classList.toggle('urgent', state.bossStarted && state.bossTime >= run.bossDuration-15);
    text('kill-count', String(state.kills)); text('combo-counter', state.recentKills.length >= 5 ? `${state.recentKills.length} 连斩` : '');
    const equipment = run.stats;
    text('blade-loadout', run.isRanged?`射程 ${Math.round(equipment.range)} · 射速 ${(1/equipment.interval).toFixed(1)}/秒 · ${loadName(equipment.mass).replace('巨刃','重弓')}`:`长 ${equipment.lengthScale.toFixed(2)}× · 宽 ${equipment.widthScale.toFixed(2)}× · ${loadName(equipment.mass)}`);
    document.getElementById('current-passive')!.setAttribute('aria-label','查看当前武器的攻击方式');
    const tutorial=document.getElementById('tutorial')!;const tutorialText=run.isRanged?'边走边射，香蕉弓自动发射瓜子':'走位聚怪，胡萝卜刀自动横扫';if(tutorial.firstChild?.textContent!==tutorialText)tutorial.firstChild!.textContent=tutorialText;
    text('passive-name', run.passiveInfo.name); text('passive-state', passiveProgress(t.id, state.passive, state.dashCooldown, stage));
    const passiveButton = document.querySelector<HTMLElement>('#current-passive')!; passiveButton.style.setProperty('--passive', t.color);
    passiveButton.classList.toggle('ready', state.passive.shield || state.passive.empowered > 0 || state.passive.haste > 0);
    text('current-name', t.name); text('current-tier', `${MASTERIES[stage]} · ${t.role}`);
    const currentImage = document.querySelector<HTMLImageElement>('#current-blade-image')!;
    if (currentImage.dataset.tier !== String(tier)) { currentImage.src = ASSETS[`blade-${tier + 1}`]; currentImage.dataset.tier = String(tier); }
    document.querySelector('#tier-pips')!.innerHTML = MASTERIES.map((name, i) => `<i title="${name}" class="${i <= stage ? 'lit' : ''}" style="--tier:${t.color}"></i>`).join('');
    document.querySelector('#current-name')!.setAttribute('style', `color:${t.color}`);
    const activeButton=document.querySelector<HTMLButtonElement>('#active-button')!,ability=run.activeInfo,a=run.active;
    activeButton.hidden = !run.hasActiveSkill;
    activeButton.style.setProperty('--active',t.color);
    activeButton.disabled=!run.hasActiveSkill||panel!=='none'||state.mode!=='playing'||a.cooldown>.000001;
    activeButton.classList.toggle('ready',!activeButton.disabled);
    activeButton.classList.toggle('cooling',a.cooldown>.000001);
    if (ability) {
      activeButton.title=`${ability.name} · ${ability.cooldown} 秒冷却 · ${ability.description}`;
      activeButton.setAttribute('aria-label',`释放武器主动技能（Q）：${ability.name}${a.cooldown>.000001?`，冷却 ${a.cooldown.toFixed(1)} 秒`:''}`);
      text('active-label',a.cooldown>.000001?`${a.cooldown.toFixed(1)}s`:'就绪');
      const activeImage=document.querySelector<HTMLImageElement>('#active-image')!;
      if(activeImage.dataset.tier!==String(tier)){activeImage.src=ASSETS[`blade-${tier+1}`];activeImage.dataset.tier=String(tier);}
      document.querySelector<SVGCircleElement>('#active-progress')!.style.strokeDashoffset=`${282.75*a.cooldown/ability.cooldown}`;
    }
    const dashProgress = document.querySelector<SVGCircleElement>('#dash-progress')!;
    dashProgress.style.strokeDashoffset = `${282.75 * (state.dashCooldown / run.stats.dashCooldown)}`;
    document.querySelector('#dash-button')!.classList.toggle('cooling', state.dashCooldown > 0);
    text('dash-label', state.dashCooldown > .1 ? `${state.dashCooldown.toFixed(1)}s` : '瞬步');
    document.querySelector<HTMLElement>('#tutorial')!.hidden = state.time > 16 || state.bossStarted || state.time > 18;
    document.querySelector<HTMLElement>('#boss-warning')!.hidden = state.mode !== 'boss-intro';
    document.querySelector<HTMLElement>('#evolution-flash')!.hidden = state.mode !== 'evolving';
    document.querySelector('#boss-warning>span')!.textContent=`${run.bossDuration} 秒，斩出最后一条路。`;
    const boss = state.enemies.find(e => e.kind === 'boss');
    document.querySelector<HTMLElement>('#boss-health')!.hidden = !boss;
    if (boss) percent('boss-fill', boss.hp / boss.maxHp);
  }
}
