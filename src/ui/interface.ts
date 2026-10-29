import { ACHIEVEMENTS, ITEMS, ITEM_IDS, RECIPES, regionAt, type ItemId, type RecipeId } from '../game/content';
import type { Session } from '../game/session';
import { IslandAudio } from '../game/audio';
import type { GameEvent } from '../game/simulation';
import { icon } from './icons';

const chapters = [
  { number: '01', title: '从一双手开始', text: '海浪把我留在这里。没有航线，没有归期。至少，我还有一双手。', done: 'first-tool' },
  { number: '02', title: '黑夜里的归所', text: '我在沙地上围起石头，看着第一簇火苗站起来。那一刻，岛屿不再只是荒岛。', done: 'first-home' },
  { number: '03', title: '昨日留下的希望', text: '沿东边的海岸走，远航号的桅杆还在。那些碎片，也许能带我回去。', done: 'wreck' },
  { number: '04', title: '海的另一边', text: '第三天的航线，会有船经过。我得把信号举得再高一些，把希望留得再久一些。', done: 'rescued' },
];
export class Interface {
  private root: HTMLElement;
  private session: Session;
  private audio = new IslandAudio();
  private selected: ItemId = 'coconut';
  private category: 'camp' | 'tools' = 'tools';
  private journalTab: 'story' | 'achievements' = 'story';
  private objectiveCollapsed = false;
  private restartConfirm = false;
  private lastPanel: string | null = null;
  private wasStarted = false;
  private regionTimer?: ReturnType<typeof setTimeout>;
  private updateTimer = 0;
  constructor(session: Session) {
    this.session=session;this.root=document.getElementById('app')!;
    this.root.innerHTML=`
      <div class="world-vignette"></div><div class="grain"></div>
      <section id="landing" class="landing">
        <header class="landing-header"><span class="edition">${icon('palm',25)} AN ISLAND. A SECOND CHANCE.</span><button class="sound-button" data-action="sound" title="开启或关闭环境音" aria-label="开启环境音">${icon('mute',19)}<span>听见岛屿</span></button></header>
        <div class="landing-content"><div class="eyebrow"><span class="small-line"></span> 一个关于生存与希望的故事</div><h1>余生<span class="title-dot">。</span></h1><div class="landing-subtitle"><span>无 名 之 岛</span><span class="subtitle-line"></span><span class="english">CASTAWAY</span></div><p class="opening">风暴带走了一切。<br>而你，还拥有一座岛，和下一次日出。</p><div class="landing-actions"><button class="primary start-button" data-action="${session.hasSave?'continue':'start'}"><span>${session.hasSave?'继续旅程':'开始漂流'}</span>${icon('arrow',23)}</button>${session.hasSave?'<button class="text-button" data-action="new-journey">从头开始</button>':''}</div><p class="landing-note">${icon('save',13)} 旅程会自动保存于此浏览器</p></div>
        <div class="landing-coordinate"><span>0° 18′ N &nbsp; 167° 42′ E</span><span>在地图之外，在希望之中。</span></div>
        <footer class="landing-footer"><div><span class="outlined-number">01</span><span>探索未知 <i>／</i> 学会生存 <i>／</i> 重新开始</span></div><span class="desktop-hint">W A S D 移动 &nbsp; · &nbsp; E 互动 &nbsp; · &nbsp; 鼠标环顾 · 第一人称</span></footer>
      </section>
      <div id="hud" class="hud hidden"><div id="crosshair" class="crosshair hidden"><span></span></div><div id="look-hint" class="look-hint hidden"><button data-action="capture">点击锁定视角 · 也可按住画面拖动环顾</button></div><div id="loot-feedback" class="loot-feedback" aria-live="polite"></div><div id="graphics-status" class="graphics-status hidden" role="status"></div>
        <header class="game-header"><div class="game-brand">${icon('palm',32)}<div><span class="brand-title">余生<span>CASTAWAY</span></span><span class="brand-subtitle">无 名 之 岛</span></div></div><div class="clock"><div class="clock-main"><span id="weather-icon">${icon('sun',20)}</span><span id="day-label">第 1 天</span><span class="clock-divider"></span><span id="clock-time">08:20</span></div><div class="day-track"><span id="day-sun"></span></div><span id="weather-label" class="clock-weather">晴朗 · 海风轻拂</span></div><nav class="header-tools"><button class="icon-button map-shortcut" data-action="map" title="岛屿地图 [M]" aria-label="打开岛屿地图">${icon('map',21)}</button><button class="icon-button" data-action="journal" title="生存手记 [J]" aria-label="生存手记">${icon('book',21)}</button><button class="icon-button sound-button" data-action="sound" title="开启环境音" aria-label="开启环境音">${icon('mute',21)}</button><span class="tool-divider"></span><button class="icon-button" data-action="pause" title="暂停 [Esc]" aria-label="暂停游戏">${icon('pause',21)}</button></nav></header>
        <section class="objective"><button class="objective-heading" data-action="objective" aria-label="展开或收起当前目标"><span class="eyebrow">生存手记 <span class="objective-dot">·</span> <span id="chapter-label">第一章</span></span><span id="objective-toggle">−</span></button><div id="objective-content"><h2 id="objective-title">从一双手开始</h2><p id="objective-description"></p><button class="objective-progress" data-action="craft"><span id="objective-icon">${icon('wood',14)}</span><span id="objective-progress">采集第一份木材</span>${icon('chevron',13)}</button></div></section>
        <aside class="map-cluster"><button class="minimap-button" data-action="map" title="打开岛屿地图 [M]" aria-label="打开岛屿地图"><span class="mini-north">N</span><canvas id="minimap" width="220" height="170"></canvas><span class="minimap-corners"></span><span class="mini-map-key">M</span></button><div class="map-caption"><span class="map-dot"></span><span id="region-label">初醒海滩</span><span class="exploration" id="explored">01 / 05</span></div><div class="zoom-controls"><button data-action="zoom-out" aria-label="缩小视野">${icon('minus',14)}</button><span>视野</span><button data-action="zoom-in" aria-label="放大视野">${icon('plus',14)}</button></div></aside>
        <div id="discovery" class="discovery hidden"><span class="eyebrow" id="discovery-en">AWAKENING SHORE</span><h2 id="discovery-title">初醒海滩</h2><span class="discovery-line"></span></div>
        <div id="interaction" class="interaction hidden"></div>
        <div id="placement" class="placement hidden"></div>
        <section class="survival-status" aria-label="生存状态"><div class="status-heading"><span class="status-live"></span><span id="status-mood">尚有余力，继续前行。</span></div>${([
          ['hp','heart','生命','health'],['hunger','food','饱腹','hunger'],['thirst','water','水分','thirst'],['energy','energy','体力','energy']
        ] as const).map(([key,ico,name,color])=>`<div class="stat-row ${color}" id="stat-${key}" title="${name}"><span class="stat-icon">${icon(ico,16)}</span><span class="stat-label">${name}</span><div class="stat-track"><span id="bar-${key}"></span></div><span class="stat-number" id="value-${key}">100</span></div>`).join('')}<div class="level-row"><span id="level-label">Lv.1 <span>初来乍到</span></span><div class="xp-track"><span id="xp-bar"></span></div><span id="xp-label">0 XP</span></div></section>
        <section class="quickbar" aria-label="快捷补给"><div class="quick-slots">${(['coconut','berries','water','meal'] as ItemId[]).map((id,i)=>`<button class="quick-item item-${id}" data-action="consume" data-item="${id}" title="${ITEMS[id].name} [${i+1}] · ${ITEMS[id].description}"><kbd>${i+1}</kbd><span class="quick-illustration">${icon(ITEMS[id].icon,31)}</span><span class="quick-count" id="quick-${id}">0</span><span class="quick-label">${ITEMS[id].name}</span></button>`).join('')}<span class="quick-separator"></span><button class="quick-item bag-slot" data-action="inventory" title="背包 [I / Tab]">${icon('bag',27)}<span class="quick-label">背包 <kbd>I</kbd></span><span class="bag-dot" id="bag-dot"></span></button></div><p class="control-hint"><kbd>W A S D</kbd> 移动 <span>·</span> 鼠标环顾 <span>·</span> <kbd>E</kbd> 互动</p></section>
        <div class="build-control"><button class="build-button" data-action="craft">${icon('build',22)}<span>制作与建造</span><kbd>B</kbd></button><span class="save-indicator">${icon('save',11)} 旅程自动保存</span></div>
        <div class="mobile-controls"><div id="joystick" class="joystick" aria-label="拖动以移动角色"><div id="joystick-knob"></div></div><button class="mobile-interact" data-action="interact" aria-label="采集或互动">${icon('plus',26)}<span>互动</span></button></div>
      </div>
      <div id="panel-root"></div><div id="toast-root" class="toast-stack" aria-live="polite"></div><div id="achievement-root" class="achievement-root" aria-live="polite"></div><div id="end-root"></div><div id="loading" class="loading"><span class="loading-palm">${icon('palm',38)}</span><span>正在听见海浪…</span></div>`;
    this.root.addEventListener('click',e=>this.onClick(e));
    window.addEventListener('keydown',e=>this.onKey(e));
    document.addEventListener('visibilitychange',()=>{session.hidden=document.hidden;if(document.hidden&&session.started)session.model.save();});
    window.addEventListener('beforeunload',()=>{if(session.started)session.model.save();});
    session.on(event=>this.onGameEvent(event));
    session.onChange(()=>{this.render();this.updateHUD();});
    this.installJoystick();
    setInterval(()=>this.updateHUD(),120);
  }
  ready(){ document.getElementById('loading')!.classList.add('hidden');this.updateHUD(); }
  private el(id:string){return document.getElementById(id)!;}
  private text(id:string,value:string){const el=this.el(id);if(el.textContent!==value)el.textContent=value;}
  private onClick(event:MouseEvent){
    const target=(event.target as HTMLElement).closest<HTMLElement>('[data-action]');if(!target)return;
    if(target instanceof HTMLButtonElement&&target.disabled)return;
    const action=target.dataset.action!,s=this.session;
    if(action==='start'||action==='continue'){s.start(action==='continue');this.audio.start(s.sound);this.showRegion();s.capture();return;}
    if(action==='new-journey'){this.restartConfirm=true;this.renderRestart();return;}
    if(action==='sound'){s.sound=!s.sound;this.audio.start(s.sound);this.updateSound();return;}
    if(action==='objective'){this.objectiveCollapsed=!this.objectiveCollapsed;this.el('objective-content').classList.toggle('hidden',this.objectiveCollapsed);this.text('objective-toggle',this.objectiveCollapsed?'+':'−');return;}
    if(action==='close'){s.close();this.restartConfirm=false;this.render();return;}
    if(action==='resume'){s.close();s.capture();return;}
    if(action==='capture'){s.capture();return;}
    if(action==='restart'){this.restartConfirm=true;this.renderPanel();return;}
    if(action==='restart-now'){this.restartConfirm=false;s.start();this.audio.start(s.sound);this.el('panel-root').innerHTML='';this.showRegion();return;}
    if(action==='cancel-restart'){this.restartConfirm=false;this.render();return;}
    if(action==='save'){const ok=s.model.save();this.toast(ok?'已记下此刻的旅程':'暂时无法保存',ok?'下次在同一浏览器中，可以从这里继续。':'浏览器存储空间或隐私设置不允许保存。','save');return;}
    if(action==='craft-tab'){this.category=target.dataset.tab as typeof this.category;this.renderPanel();return;}
    if(action==='journal-tab'){this.journalTab=target.dataset.tab as typeof this.journalTab;this.renderPanel();return;}
    if(action==='select-item'){this.selected=target.dataset.item as ItemId;this.renderPanel();return;}
    if(action==='consume'){s.model.consume(target.dataset.item as ItemId);this.renderPanel();this.updateHUD();return;}
    if(action==='craft-recipe'){
      const id=target.dataset.recipe as RecipeId,recipe=RECIPES.find(r=>r.id===id)!;
      if(recipe.structure){s.panel=null;s.placement=id;s.changed();s.capture();}else{s.model.craft(id);this.renderPanel();}return;
    }
    if(action==='sleep'){if(s.model.rest())s.close();return;}
    if(action==='interact'){s.interact();return;}
    if(['inventory','craft','journal','map','pause'].includes(action)){
      if(action==='craft'&&!s.model.state.tools.includes('axe'))this.category='tools';
      s.open(action as Session['panel']);
    }
  }
  private onKey(event:KeyboardEvent){
    const s=this.session;if(!s.started)return;
    if(['INPUT','TEXTAREA','SELECT'].includes((event.target as HTMLElement)?.tagName))return;
    if(event.repeat)return;
    const map:Record<string,Session['panel']>={KeyI:'inventory',KeyB:'craft',KeyJ:'journal',KeyM:'map'};
    if(event.code==='Escape'){
      event.preventDefault();if(this.restartConfirm){this.restartConfirm=false;this.render();return;}
      if(s.panel||s.placement)s.close();else s.open('pause');return;
    }
    if(event.code==='Tab'&&!(event.target as HTMLElement).closest('.sheet,.modal')){event.preventDefault();s.open('inventory');return;}
    if(map[event.code]){event.preventDefault();if(event.code==='KeyB'&&!s.model.state.tools.includes('axe'))this.category='tools';s.open(map[event.code]);return;}
    if(event.code.startsWith('Digit')&&!s.panel){const id=(['coconut','berries','water','meal'] as ItemId[])[Number(event.code.slice(-1))-1];if(id)s.model.consume(id);}
  }
  private updateSound(){
    for(const element of this.root.querySelectorAll<HTMLElement>('.sound-button')){element.innerHTML=icon(this.session.sound?'sound':'mute',20)+(element.closest('#landing')?`<span>${this.session.sound?'海风与潮声':'听见岛屿'}</span>`:'');element.title=this.session.sound?'关闭环境音':'开启环境音';element.setAttribute('aria-label',element.title);element.setAttribute('aria-pressed',String(this.session.sound));}
  }
  private render(){
    const s=this.session;
    this.el('landing').classList.toggle('hidden',s.started);
    this.el('hud').classList.toggle('hidden',!s.started||s.model.state.status!=='playing');
    this.root.classList.toggle('in-game',s.started);
    if(!this.wasStarted&&s.started)this.wasStarted=true;
    this.renderPanel();this.renderEnd();
  }
  private panelHeader(eyebrow:string,title:string){return `<header class="panel-header"><div><span class="eyebrow">${eyebrow}</span><h2>${title}</h2></div><button class="close-button" data-action="close" aria-label="关闭面板">${icon('close',21)}</button></header>`;}
  private renderPanel(){
    const panel=this.session.panel,root=this.el('panel-root');
    if(!panel){root.innerHTML='';this.lastPanel=null;return;}
    const previousScroll=root.querySelector('.panel-content')?.scrollTop??0;
    const previousAction=(document.activeElement as HTMLElement)?.dataset.action,previousRecipe=(document.activeElement as HTMLElement)?.dataset.recipe;
    if(this.restartConfirm){this.renderRestart();return;}
    let content='';const s=this.session.model.state;
    if(panel==='craft'){
      content=`<aside class="sheet craft-sheet">${this.panelHeader('BUILD A LIFE, NOT JUST A SHELTER','让这里，成为家。')}<p class="panel-intro">工具让你走得更远，营地让你有所归依。</p><nav class="panel-tabs"><button class="${this.category==='tools'?'active':''}" data-action="craft-tab" data-tab="tools">${icon('axe',16)} 生存工具</button><button class="${this.category==='camp'?'active':''}" data-action="craft-tab" data-tab="camp">${icon('shelter',17)} 营地建造</button></nav><div class="panel-content recipes">${RECIPES.filter(r=>r.category===this.category).map(r=>{
        const check=this.session.model.canCraft(r.id),made=check.reason==='已经制作';
        return `<article class="recipe ${made?'made':''}"><div class="recipe-top"><span class="recipe-art ${r.id}">${icon(r.id,38)}</span><div><span class="recipe-en">${r.en}</span><h3>${r.name}</h3></div>${made?`<span class="made-badge">${icon('check',13)} 已拥有</span>`:''}</div><p>${r.description}</p><div class="recipe-materials">${Object.entries(r.costs).map(([id,n])=>`<span class="${s.inventory[id as ItemId]>=n?'enough':'missing'}" title="${ITEMS[id as ItemId].name}">${icon(ITEMS[id as ItemId].icon,15)} <span>${s.inventory[id as ItemId]}</span><i>/ ${n}</i></span>`).join('')}</div><button class="recipe-button ${check.ok?'available':''}" data-action="craft-recipe" data-recipe="${r.id}" ${check.ok?'':'disabled'}>${made?icon('check',15):check.ok?icon(r.structure?'plus':'build',15):icon('leaf',15)}${check.reason}</button></article>`;
      }).join('')}</div><footer class="panel-footer">${icon('pause',12)} 翻阅时，岛上的时间暂时停留。</footer></aside>`;
    }
    if(panel==='inventory'){
      const entry=ITEMS[this.selected];
      content=`<aside class="sheet inventory-sheet">${this.panelHeader('EVERY LITTLE THING MATTERS','随身行囊')}<div class="inventory-summary"><span>${icon('bag',16)} 已收集 <strong>${Object.values(s.inventory).reduce((a,b)=>a+b,0)}</strong> 份物资</span><span>没有一份微不足道</span></div><div class="panel-content"><div class="inventory-grid">${ITEM_IDS.map(id=>`<button class="inventory-item ${this.selected===id?'selected':''} ${s.inventory[id]===0?'empty':''}" data-action="select-item" data-item="${id}"><span class="item-illustration item-${id}">${icon(ITEMS[id].icon,34)}</span><span class="inventory-count">${s.inventory[id]}</span><span>${ITEMS[id].name}</span></button>`).join('')}</div><div class="item-detail"><div class="detail-title"><span class="item-illustration item-${this.selected}">${icon(entry.icon,42)}</span><div><span class="eyebrow">来自岛屿的馈赠</span><h3>${entry.name}</h3></div></div><p>${entry.description}</p>${['coconut','berries','water','meal','bandage'].includes(this.selected)?`<button class="primary use-item" data-action="consume" data-item="${this.selected}" ${s.inventory[this.selected]?'':'disabled'}>${icon(this.selected==='bandage'?'bandage':'food',18)} ${s.inventory[this.selected]?'使用一份':'背包中暂无此物'}</button>`:'<p class="item-usage">'+icon(this.selected==='fish'?'campfire':'build',14)+(this.selected==='fish'?'靠近营火按 E 烹饪':'按 B 查看可以制作的物品')+'</p>'}</div><div class="tools-owned"><span class="eyebrow">随身工具</span><div>${s.tools.length?s.tools.map(t=>`<span>${icon(t,21)} ${RECIPES.find(r=>r.id===t)!.name}</span>`).join(''):'<p>双手是你最初的工具。试着制作一把石斧。</p>'}</div></div></div><footer class="panel-footer">${icon('energy',12)} 小提示：按 1—4，快速使用补给。</footer></aside>`;
    }
    if(panel==='journal'){
      content=`<aside class="sheet journal-sheet">${this.panelHeader('THE DAYS THAT MADE YOU','漂流者手记')}<nav class="panel-tabs"><button class="${this.journalTab==='story'?'active':''}" data-action="journal-tab" data-tab="story">${icon('book',16)} 生存篇章</button><button class="${this.journalTab==='achievements'?'active':''}" data-action="journal-tab" data-tab="achievements">${icon('trophy',16)} 岛屿印记 <small>${s.achievements.length}/10</small></button></nav><div class="panel-content">${this.journalTab==='story'?`<div class="journal-stats"><div><strong>${s.day}</strong><span>生存天数</span></div><div><strong>${s.discoveries.length}<small>/5</small></strong><span>发现之地</span></div><div><strong>${s.structures.length}</strong><span>营地建筑</span></div></div><div class="chapter-list">${chapters.map(ch=>`<article class="journal-chapter ${s.achievements.includes(ch.done)?'complete':''}"><span class="chapter-number">${ch.number}</span><div><h3>${ch.title} ${s.achievements.includes(ch.done)?icon('check',15):''}</h3><p>${ch.text}</p></div></article>`).join('')}</div><blockquote>「别数失去的日子，<br>去数新生的叶子。」<cite>— 林间石碑上的刻字</cite></blockquote>`:`<div class="achievement-list">${ACHIEVEMENTS.map(a=>`<article class="achievement-item ${s.achievements.includes(a.id)?'unlocked':''}"><div class="achievement-icon">${icon(a.icon,28)}</div><div><h3>${a.title}</h3><p>${a.description}</p></div><span>${s.achievements.includes(a.id)?icon('check',15):'—'}</span></article>`).join('')}</div>`}</div><footer class="panel-footer">第 ${s.day} 天 · ${this.session.model.levelName} · ${s.xp} XP</footer></aside>`;
    }
    if(panel==='map')content=`<section class="modal map-modal">${this.panelHeader('SOMEWHERE IN THE PACIFIC','无名之岛')}<div class="chart"><canvas id="full-map" width="850" height="610" aria-label="岛屿地图，标记当前位置和营地"></canvas><span class="chart-north">N<span>✧</span>S</span><span class="chart-coordinate">0° 18′ N · 167° 42′ E</span></div><footer class="map-footer"><span><i class="legend-player"></i> 你在这里</span><span><i class="legend-camp"></i> 营地</span><span class="map-discovered">已发现 ${s.discoveries.length} / 5 处区域</span></footer><p class="map-tip">海难之后，你能确定的方向，是下一步。</p></section>`;
    if(panel==='pause')content=`<section class="modal pause-modal">${this.panelHeader('A MOMENT TO BREATHE','让风，再吹一会儿。')}<p>第 ${s.day} 天 · ${regionAt(s.player).name}<br>不用着急，岛屿会等你。</p><div class="pause-actions"><button class="primary" data-action="resume">${icon('arrow',19)} 继续旅程</button><button data-action="save">${icon('save',18)} 保存此刻</button><button data-action="journal">${icon('book',18)} 翻阅手记</button><button class="restart-button" data-action="restart">重新开始</button></div><div class="pause-controls"><span>WASD / 方向键 · 移动</span><span>鼠标 / 右侧触屏 · 环顾</span><span>E / 空格 · 采集与互动</span><span>Shift · 奔跑　Q · 持矛</span><span>B · 制作　I · 背包</span><span>J · 手记　M · 地图</span></div></section>`;
    if(panel==='sleep')content=`<section class="modal sleep-modal">${this.panelHeader('TOMORROW IS ANOTHER CHANCE','睡到下一次日出')}<span class="sleep-art">${icon('shelter',75)}</span><p>棕叶挡住了夜风，海浪渐渐远去。<br>好好休息，明天还会有新的希望。</p><div class="sleep-cost"><span>${icon('food',17)} 食物 −20</span><span>${icon('water',17)} 水分 −25</span><span>${icon('heart',17)} 生命 +28</span></div><button class="primary" data-action="sleep" ${s.hunger>=22&&s.thirst>=27?'':'disabled'}>${icon('moon',18)} ${s.hunger>=22&&s.thirst>=27?'闭上眼睛，等待天明':'先补足食物与水分'}</button><button class="text-button" data-action="close">还不想睡</button></section>`;
    root.innerHTML=`<div class="panel-backdrop" data-action="close"></div>${content}`;
    if(this.lastPanel===panel&&root.querySelector('.panel-content'))root.querySelector('.panel-content')!.scrollTop=previousScroll;
    this.lastPanel=panel;
    if(previousAction&&previousRecipe)root.querySelector<HTMLElement>(`[data-action="${previousAction}"][data-recipe="${previousRecipe}"]`)?.focus({preventScroll:true});
    if(panel==='map')this.session.map(this.el('full-map') as HTMLCanvasElement,true);
  }
  private renderRestart(){this.el('panel-root').innerHTML=`<div class="panel-backdrop" data-action="cancel-restart"></div><section class="modal pause-modal">${this.panelHeader('A NEW SHORE','重新开始这场漂流？')}<p>当前浏览器中的旅程会被新旅程替换。<br>从第一天开始，再认识一次这座岛。</p><div class="pause-actions"><button class="primary" data-action="restart-now">开始新的旅程 ${icon('arrow',18)}</button><button data-action="cancel-restart">保留当前旅程</button></div></section>`;}
  private renderEnd(){
    const s=this.session.model.state,root=this.el('end-root');
    if(!this.session.started||s.status==='playing'){root.innerHTML='';return;}
    const win=s.status==='rescued';
    root.innerHTML=`<div class="ending-backdrop"></div><section class="ending"><span class="ending-icon">${icon(win?'ship':'palm',54)}</span><span class="eyebrow">${win?'THE SEA BROUGHT YOU HOME':'THE ISLAND WILL REMEMBER'}</span><h1>${win?'你终于，<br>不再孤单。':'海浪记得，<br>你曾来过。'}</h1><p>${win?'当那艘船终于转向你，你回头看了一眼。<br>那座小小的庇护所，曾是你的整个世界。':'风暴很大，岛屿很远。<br>下一次，你会更懂得如何与它相处。'}</p><div class="ending-stats"><div><strong>${s.day}</strong><span>天的坚持</span></div><div><strong>${s.structures.length}</strong><span>亲手建造</span></div><div><strong>${s.achievements.length}</strong><span>岛屿印记</span></div></div><button class="primary" data-action="restart-now">${win?'再听一次海浪':'再次开始漂流'} ${icon('arrow',21)}</button><span class="ending-caption">${win?'你带走的不只是生命，还有重新开始的勇气。':'学会优先寻找饮水、制作工具，并在密林里保持警惕。'}</span></section>`;
  }
  private onGameEvent(event:GameEvent){
    this.audio.play(event.type);
    if(event.type==='achievement')this.achievement(event);
    else if(event.type==='discovery'){this.showRegion(event.title);this.toast(event.title,event.detail,'compass');}
    else if(event.type==='end'){this.session.panel=null;this.render();}
    else if(event.type==='gather'){const entry=document.createElement('div');entry.textContent=event.title;this.el('loot-feedback').append(entry);setTimeout(()=>entry.remove(),2400);}
    else this.toast(event.title,event.detail,event.icon??(event.type==='hurt'?'warning':'leaf'));
    if(this.session.panel&&['craft','inventory','journal'].includes(this.session.panel))this.renderPanel();
    this.updateHUD();
  }
  private toast(title:string,detail?:string,ico='leaf'){
    const root=this.el('toast-root');const el=document.createElement('div');el.className=`toast ${ico==='warning'?'danger':''}`;
    const graphic=document.createElement('span');graphic.className='toast-icon';graphic.innerHTML=icon(ico,22);
    const body=document.createElement('div'),heading=document.createElement('strong');heading.textContent=title;body.append(heading);
    if(detail){const p=document.createElement('p');p.textContent=detail;body.append(p);}
    el.append(graphic,body);root.append(el);while(root.children.length>3)root.firstElementChild?.remove();
    setTimeout(()=>{el.classList.add('leaving');setTimeout(()=>el.remove(),300);},5200);
  }
  private achievement(event:GameEvent){
    const el=document.createElement('div');el.className='achievement-banner';el.innerHTML=`<span class="achievement-seal">${icon(event.icon??'trophy',30)}</span><div><span class="eyebrow">岛屿印记 · +30 XP</span><h3>${event.title}</h3><p>${event.detail??''}</p></div><span class="achievement-star">✧</span>`;
    const root=this.el('achievement-root');root.append(el);while(root.children.length>2)root.firstElementChild?.remove();setTimeout(()=>{el.classList.add('leaving');setTimeout(()=>el.remove(),400);},5000);
  }
  private showRegion(name?:string){
    const region=regionAt(this.session.model.state.player);this.text('discovery-title',name??region.name);this.text('discovery-en',region.en);const el=this.el('discovery');el.classList.remove('hidden');clearTimeout(this.regionTimer);this.regionTimer=setTimeout(()=>el.classList.add('hidden'),4300);
  }
  private updateHUD(){
    const session=this.session,s=session.model.state;if(!session.started)return;
    const crosshair=this.el('crosshair');crosshair.classList.toggle('hidden',session.paused);crosshair.classList.toggle('has-target',!!session.nearby);crosshair.classList.toggle('gathering',session.gathering>0);crosshair.style.setProperty('--progress',`${Math.min(100,session.gathering*100)}%`);
    this.el('look-hint').classList.toggle('hidden',session.paused||session.lookLocked||session.isTouch);
    this.el('hud').classList.toggle('is-touch',session.isTouch);
    this.text('day-label',`第 ${s.day} 天`);this.text('clock-time',`${Math.floor(s.minute/60).toString().padStart(2,'0')}:${Math.floor(s.minute%60).toString().padStart(2,'0')}`);
    this.el('day-sun').style.left=`${Math.max(0,Math.min(100,(s.minute-360)/840*100))}%`;
    const weather=session.model.weather==='rain'?'rain':session.model.night?'moon':'sun';
    if(this.el('weather-icon').dataset.weather!==weather){this.el('weather-icon').innerHTML=icon(weather,20);this.el('weather-icon').dataset.weather=weather;}
    this.text('weather-label',weather==='rain'?'阵雨 · 留意体温与补给':weather==='moon'?'夜色渐深 · 寻一处火光':'晴朗 · 海风轻拂');
    const objective=session.model.objective;
    this.text('chapter-label',`第${['一','二','三','四'][Number(objective.chapter)-1]}章`);this.text('objective-title',objective.title);this.text('objective-description',objective.description);this.text('objective-progress',objective.progress);
    this.el('objective-progress').dataset.action=!s.achievements.includes('first-gather')?'interact':objective.progress==='探索沉船海岸'?'map':s.structures.some(a=>a.kind==='signal')?'journal':'craft';
    if(this.el('objective-icon').dataset.icon!==objective.icon){this.el('objective-icon').innerHTML=icon(objective.icon,14);this.el('objective-icon').dataset.icon=objective.icon;}
    this.text('region-label',regionAt(s.player).name);this.text('explored',`${String(s.discoveries.length).padStart(2,'0')} / 05`);
    for(const stat of ['hp','hunger','thirst','energy'] as const){this.text(`value-${stat}`,String(Math.ceil(s[stat])));this.el(`bar-${stat}`).style.width=`${s[stat]}%`;this.el(`stat-${stat}`).classList.toggle('critical',s[stat]<20);}
    this.text('status-mood',s.hp<30?'每一次呼吸，都值得坚持。':s.thirst<25?'找一些水，椰子也不错。':s.hunger<25?'该吃些东西了。':session.model.night?'火光之外，是漫长的夜。':'尚有余力，继续前行。');
    this.el('level-label').innerHTML=`Lv.${session.model.level} <span>${session.model.levelName}</span>`;
    const floors=[0,90,260,550,1000],level=session.model.level;
    this.el('xp-bar').style.width=`${Math.min(100,(s.xp-floors[level-1])/(floors[level]-floors[level-1])*100)}%`;this.text('xp-label',`${s.xp} XP`);
    for(const id of ['coconut','berries','water','meal'] as ItemId[]){this.text(`quick-${id}`,String(s.inventory[id]));const button=this.el(`quick-${id}`).closest('button')!;button.disabled=s.inventory[id]===0;}
    this.el('bag-dot').classList.toggle('hidden',Object.values(s.inventory).reduce((a,b)=>a+b,0)===0);
    const interaction=this.el('interaction'),near=session.nearby;
    interaction.classList.toggle('hidden',!near||session.paused||!!session.placement);
    if(near&&!session.paused){const html=`<span class="interaction-name">${near.name}</span><button data-action="interact"><kbd>${session.gathering>0?'…':'E'}</kbd><strong>${session.gathering>0?'正在'+near.verb:near.verb}</strong></button><span class="interaction-hint">${near.hint}</span>`;if(interaction.dataset.key!==near.id+String(session.gathering>0)){interaction.innerHTML=html;interaction.dataset.key=near.id+String(session.gathering>0);}}
    const placement=this.el('placement');placement.classList.toggle('hidden',!session.placement);
    if(session.placement){const name=RECIPES.find(r=>r.id===session.placement)!.name;const html=`${icon('shelter',24)}<div><strong>为${name}选一处位置</strong><span>瞄准身边的空地 · E 搭建 · Esc 取消</span></div><button data-action="close" aria-label="取消搭建">${icon('close',18)}</button>`;if(placement.dataset.recipe!==session.placement){placement.innerHTML=html;placement.dataset.recipe=session.placement;}}
    if(this.updateTimer++%3===0){session.map(this.el('minimap') as HTMLCanvasElement,false);if(session.panel==='map')session.map(this.el('full-map') as HTMLCanvasElement,true);}
    this.audio.tick(session.model.weather==='rain',session.paused);
  }
  private installJoystick(){
    const joystick=this.el('joystick'),knob=this.el('joystick-knob');let pointer:number|null=null;
    const move=(event:PointerEvent)=>{if(event.pointerId!==pointer)return;const rect=joystick.getBoundingClientRect(),dx=event.clientX-rect.left-rect.width/2,dy=event.clientY-rect.top-rect.height/2,length=Math.hypot(dx,dy),scale=length>35?35/length:1;knob.style.transform=`translate(${dx*scale}px,${dy*scale}px)`;window.dispatchEvent(new CustomEvent('castaway-joystick',{detail:{x:dx*scale/35,y:dy*scale/35}}));};
    joystick.addEventListener('pointerdown',event=>{pointer=event.pointerId;joystick.setPointerCapture(pointer);move(event);});joystick.addEventListener('pointermove',move);
    const up=()=>{pointer=null;knob.style.transform='translate(0,0)';window.dispatchEvent(new CustomEvent('castaway-joystick',{detail:{x:0,y:0}}));};
    joystick.addEventListener('pointerup',up);joystick.addEventListener('pointercancel',up);
  }
}
