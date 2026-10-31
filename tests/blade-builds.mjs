import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.GAME_URL??'http://127.0.0.1:4173/';
const output='test-results/blade/builds';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const checks=[],errors=[],metrics={};
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
const isolate=p=>p.evaluate(()=>{const a=__BLADE__;a.scene.onFrame=undefined;a.run.state.enemies=[];a.run.state.spawnBudget=-100000;a.run.state.attackTimer=10000;});
const frame=(p,n=1)=>p.evaluate(n=>{const a=__BLADE__;for(let i=0;i<n;i++){a.frame(1/60);a.scene.update(0,1000/60);}a.ui.render(true);},n);
async function boot(p,webgl=false){p.on('pageerror',e=>errors.push(e.message));await p.goto(`${base}?qa=1${webgl?'&renderer=webgl':''}`);await p.locator('#boot-status').waitFor({state:'hidden'});await p.getByRole('button',{name:'开始试炼',exact:true}).click();await p.getByRole('button',{name:'持刀出发',exact:true}).click();await isolate(p);}
const snap=p=>p.evaluate(()=>structuredClone(__BLADE__.run.state));
async function fresh(p,blade=0){await p.evaluate(blade=>{const a=__BLADE__;a.selectedBlade=blade;a.start();},blade);await isolate(p);}
async function offer(p,id){await p.evaluate(id=>{const a=__BLADE__,r=a.run,s=r.state;s.level++;s.pending=[s.level];s.mode='evolving';s.evolutionTime=.01;s.forgeAwakening=false;s.choices=id?[id,...r.availableRelics.filter(k=>k!==id).slice(0,2)]:r.availableRelics.slice(0,3);a.clearInputs();},id);await frame(p,2);}
async function pick(p,id,touch=false){await offer(p,id);const card=p.locator(`.relic-card[data-value="${id}"]`);if(touch)await card.tap();else await card.click();}
const screenshot=async(p,name)=>{await p.waitForTimeout(50);await p.screenshot({path:`${output}/${name}.png`});};
try{
 const desktop=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:2});await boot(desktop);
 await desktop.evaluate(()=>__BLADE__.run.grantXp(19));await frame(desktop,20);
 check('native XP upgrade offers three unique cards and a clearly labelled skip',await desktop.locator('.relic-card').count()===3&&await desktop.getByRole('button',{name:'跳过本次选择'}).isVisible());
 check('every offer identifies its rarity, group and rank in text',await desktop.locator('.relic-card').evaluateAll(cards=>new Set(cards.map(c=>c.dataset.value)).size===3&&cards.every(c=>c.querySelector('.relic-rarity').textContent&&c.querySelector('.relic-group-tag').textContent&&c.querySelector('.relic-rank').textContent)));
 const frozen=await snap(desktop);await desktop.keyboard.down('d');await frame(desktop,120);await desktop.keyboard.up('d');check('choice freezes world, damage, statuses and both RNG streams',JSON.stringify(await snap(desktop))===JSON.stringify(frozen));
 await desktop.keyboard.press('2');const chosen=await snap(desktop);check('number key chooses one actual offered item',chosen.mode==='playing'&&chosen.relics[frozen.choices[1]]===1);
 await offer(desktop);const skipBefore=await snap(desktop);await desktop.keyboard.press('0');check('zero skips one upgrade without items or RNG reroll',await desktop.evaluate(before=>{const s=__BLADE__.run.state;return s.mode==='playing'&&s.skipped===before.skipped+1&&s.rng===before.rng&&s.lootRng===before.lootRng&&JSON.stringify(s.relics)===JSON.stringify(before.relics);},skipBefore));
 await fresh(desktop);for(const id of ['stone','ruler','heart','feather','magnet'])await pick(desktop,id);
 check('HUD presents five equipped slots and 5/5 capacity',await desktop.locator('#relic-count').textContent()==='道具 5/5'&&await desktop.locator('#relic-slots img').count()===5);
 await offer(desktop);const full=await snap(desktop);check('full slots restrict offers to owned unfinished items',full.choices.every(id=>full.relics[id]>0&&full.relics[id]<5));
 await desktop.evaluate(()=>__BLADE__.save());await desktop.reload();await desktop.locator('#boot-status').waitFor({state:'hidden'});await desktop.getByRole('button',{name:'继续试炼',exact:true}).click();await isolate(desktop);
 check('reload retains choices, ranks and both RNG states',await desktop.evaluate(old=>{const s=__BLADE__.run.state;return JSON.stringify(s.choices)===JSON.stringify(old.choices)&&JSON.stringify(s.relics)===JSON.stringify(old.relics)&&s.rng===old.rng&&s.lootRng===old.lootRng;},full));
 await desktop.getByRole('button',{name:'跳过本次选择'}).click();await desktop.getByRole('button',{name:'查看被动道具',exact:true}).click();
 check('catalogue shows thirty sharp embedded icons across six families',await desktop.locator('.relic-family').count()===6&&await desktop.locator('.relic-owned img').evaluateAll(imgs=>imgs.length===30&&imgs.every(i=>i.complete&&i.naturalWidth===384&&i.src.startsWith('data:'))));
 check('all six quality names appear in the catalogue',await desktop.locator('.relic-catalog-rarity').evaluateAll(nodes=>new Set(nodes.map(n=>n.textContent)).size===6));await screenshot(desktop,'01-six-build-families');await desktop.keyboard.press('Escape');
 const ids=Object.keys((await snap(desktop)).relics),qualities=new Set();
 for(const id of ids){await fresh(desktop);await offer(desktop,id);const card=desktop.locator(`.relic-card[data-value="${id}"]`);qualities.add(await card.getAttribute('data-rarity'));check(`${id}: card has a sharp icon and grants one rank`,await card.locator('img').evaluate(i=>i.complete&&i.naturalWidth===384));await card.click();assert.equal((await snap(desktop)).relics[id],1);}
 check('real selection renders every quality treatment',qualities.size===6);
 await fresh(desktop);for(const id of ['stone','wrap','heart','scope','fang'])for(let i=0;i<5;i++)await pick(desktop,id);
 await offer(desktop);check('maxed five-slot build offers only skip, with no filler cards',await desktop.locator('.relic-card').count()===0&&await desktop.locator('.relic-build-complete').isVisible());await desktop.getByRole('button',{name:'跳过本次选择'}).click();
 check('skip-only screen resumes the same maxed build',Object.values((await snap(desktop)).relics).reduce((a,b)=>a+b,0)===25&&(await snap(desktop)).skipped===1);
 await desktop.evaluate(()=>__BLADE__.game.loop.stop());
 const phone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});await boot(phone,true);
 await offer(phone,'venom');await screenshot(phone,'02-phone-poison-choice');
 check('phone shows rarity, effect text and five rank pips',await phone.locator('.relic-card[data-value="venom"]').evaluate(c=>c.querySelector('.relic-rarity').textContent==='史诗'&&c.querySelector('.relic-rank i').children.length===5&&c.querySelector('.relic-effect').textContent.includes('毒伤')));
 const box=await phone.locator('.relic-skip').boundingBox();check('phone skip is visible before scrolling with 44px touch target',box&&box.y>=0&&box.y+box.height<=844&&box.height>=44);await phone.locator('.relic-skip').tap();check('native touch skip spends one choice',(await snap(phone)).skipped===1);
 await pick(phone,'food',true);await pick(phone,'heart',true);
 await phone.evaluate(()=>{const a=__BLADE__,s=a.run.state;s.hp=s.maxHp;for(const [id,value,x]of[['berry',8,-35],['bread',16,0],['drumstick',28,35]])a.run.addOrb(x,35,value,'heal',id);});await frame(phone,60);const foods=await snap(phone);
 check('all three foods stay at their own ground position at full HP',foods.orbs.filter(o=>o.kind==='heal').length===3&&foods.orbs.every(o=>o.y===35));
 check('WebGL loads transparent generated food textures at full resolution',await phone.evaluate(()=>['berry','bread','drumstick'].every(id=>__BLADE__.scene.textures.get(`food-${id}`).getSourceImage().width===384)));
 await screenshot(phone,'03-phone-ground-food');await phone.evaluate(()=>__BLADE__.save());await phone.reload();await phone.locator('#boot-status').waitFor({state:'hidden'});await phone.getByRole('button',{name:'继续试炼',exact:true}).tap();await isolate(phone);
 check('food IDs, values and coordinates survive browser reload',JSON.stringify((await snap(phone)).orbs)===JSON.stringify(foods.orbs));
 await phone.evaluate(()=>__BLADE__.run.state.hp=20);await frame(phone,60);check('hurt player eats food once, receiving HP and no substituted XP',(await snap(phone)).hp>70&&(await snap(phone)).orbs.length===0&&(await snap(phone)).totalXp===0);
 // Declared v6 overload fixture. Migration, native trimming and reload use production paths.
 await fresh(phone);await phone.evaluate(()=>{const a=__BLADE__,s=a.run.snapshot(),ids=['stone','ruler','anvil','feather','bell','hourglass','ember','crystal','thunder','heart','magnet','star'];s.version=6;s.level=14;s.hp=70;s.maxHp=130;s.totalXp=200;s.relics=Object.fromEntries(ids.map(id=>[id,id==='heart'?2:1]));s.relicState={lightning:0,shield:true,shieldCooldown:0};s.orbs=[{id:s.nextId++,x:800,y:900,value:8,kind:'xp'}];a.storage.write();const key=Object.keys(localStorage).find(key=>{try{return JSON.parse(localStorage[key])?.settings?.ground;}catch{return false;}});const saved=JSON.parse(localStorage[key]);saved.version=6;saved.run=s;a.run=undefined;a.scene.activeRun=false;a.storage.data=saved;a.storage.write();});
 await phone.reload();await phone.locator('#boot-status').waitFor({state:'hidden'});await phone.getByRole('button',{name:'继续试炼',exact:true}).tap();await isolate(phone);
 check('old overload asks the player which five to retain',await phone.locator('.relic-trim-item').count()===12&&(await snap(phone)).mode==='relic-trim');const trim=await snap(phone);await frame(phone,120);check('migration selection freezes the complete old run',JSON.stringify(await snap(phone))===JSON.stringify(trim));
 for(const id of ['stone','ruler','anvil','feather','bell'])await phone.locator(`[data-action="relic-trim-toggle"][data-value="${id}"]`).tap();await screenshot(phone,'04-phone-old-save-keep-five');
 check('five selected items enable explicit confirmation',await phone.locator('[data-action="relic-trim-confirm"]').isEnabled());await phone.locator('[data-action="relic-trim-confirm"]').tap();const trimmed=await snap(phone);
 check('keep-five preserves earned HP, XP and distant XP drops',trimmed.mode==='playing'&&Object.values(trimmed.relics).filter(n=>n>0).length===5&&trimmed.hp===70&&trimmed.maxHp===130&&trimmed.totalXp===200&&trimmed.orbs[0].x===800);
 for(const size of [{width:320,height:568},{width:740,height:360}]){await phone.setViewportSize(size);await fresh(phone);await offer(phone,'blackhole');const b=await phone.locator('.relic-skip').boundingBox();check(`${size.width}x${size.height}: skip is visible and cards fit width`,b&&b.y+b.height<=size.height&&await phone.locator('.relic-choice').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await phone.locator('.relic-skip').tap();}
 await phone.setViewportSize({width:390,height:844});await fresh(phone,11);await phone.evaluate(()=>__BLADE__.run.dash());await frame(phone,12);
 for(const id of ['hourglass','bell','overdrive']){await offer(phone,id);if(id==='overdrive')await phone.evaluate(()=>{__BLADE__.run.state.hp=30;__BLADE__.ui.render(true);});metrics[id]=await phone.locator(`[data-value="${id}"] .relic-preview`).textContent();await phone.locator(`.relic-card[data-value="${id}"]`).tap();check(`${id}: native haste plus new item keeps finite combat stats`,(await snap(phone)).relics[id]===1&&await phone.evaluate(()=>Object.values(__BLADE__.run.stats).every(Number.isFinite)));}
 check('desktop and phone flows have no runtime errors',errors.length===0);metrics.foods=foods.orbs;metrics.kept=Object.entries(trimmed.relics).filter(([,n])=>n>0);
 await fs.writeFile(`${output}/results.json`,JSON.stringify({passed:checks.length,checks,errors,metrics,scope:'DPR3 touch emulation, not a physical phone measurement. Fixtures isolate offers; native XP transition, keyboard/touch, saving, reload, skip and old-save migration use production paths.'},null,2));
}catch(error){for(const c of browser.contexts())for(const p of c.pages())try{await p.screenshot({path:`${output}/failure-${p.viewportSize()?.width}.png`});}catch{}throw error;}finally{await browser.close();}
