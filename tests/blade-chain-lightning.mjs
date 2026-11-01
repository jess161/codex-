import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.GAME_URL??'http://127.0.0.1:4174/',out='test-results/blade/chain-lightning';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const checks=[],errors=[];
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
const state=p=>p.evaluate(()=>structuredClone(__BLADE__.run.state));
const frame=(p,n)=>p.evaluate(n=>{const a=__BLADE__;for(let i=0;i<n;i++){a.frame(1/60);a.scene.update(0,1000/60);}a.ui.render(true);},n);
async function boot(p,blade){
 await p.addInitScript(()=>{let app;Object.defineProperty(window,'__BLADE__',{configurable:true,get:()=>app,set:a=>{app=a;a.scene.onFrame=undefined;}});});
 p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'?qa=1&renderer=webgl');await p.locator('#boot-status').waitFor({state:'hidden'});
 await p.getByRole('button',{name:'开始试炼',exact:true}).click();await p.locator(`.blade-option[data-value="${blade}"]`).click();await p.locator('[data-action="begin"]').click();
 await p.evaluate(()=>{const r=__BLADE__.run;r.state.enemies=[];r.state.spawnBudget=-1e6;r.state.eliteIndex=4;r.state.invincible=1000;for(let i=0;i<6;i++)r.addOrb(0,0,100,'coin');});await frame(p,16);
}
async function watch(p){await p.evaluate(()=>{window.__CHAIN_EVENTS__=[];const a=__BLADE__,original=a.scene.ingest.bind(a.scene);a.scene.ingest=events=>{__CHAIN_EVENTS__.push(...events.filter(e=>e.type==='gear-proc'&&e.gearId==='chainLightning'));original(events);};});}
async function until(p,full){return p.evaluate(full=>{const a=__BLADE__;for(let i=0;i<1200;i++){a.frame(1/60);a.scene.update(0,1000/60);if(full?a.run.state.build.chainCharge===100:__CHAIN_EVENTS__.length>0){a.ui.render(true);return true;}}return false;},full);}
try{
 for(const blade of[15,16,17,18]){
  const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});await boot(p,blade);
  const before=await p.evaluate(()=>structuredClone(__BLADE__.run.stats));await p.locator('#shop-button').click();await p.locator('[data-action="shop-category"][data-value="attack"]').click();
  check(`${blade}: attack filter contains ten freely selectable items`,await p.locator('.shop-item').count()===10&&await p.locator('#build-choice,.build-guide').count()===0);
  await p.locator('.shop-item[data-value="chainLightning"]').click();
  check(`${blade}: new item displays exact flat attack and attack-speed bonuses`,await p.locator('.shop-detail').textContent().then(t=>t.includes('攻击力 +20')&&t.includes('攻击速度 +15%')));
  check(`${blade}: original metallic-node icon is embedded and sharp at 128 pixels`,await p.locator('.shop-item[data-value="chainLightning"] .gear-icon').evaluate(i=>i.complete&&i.naturalWidth===128&&i.src.startsWith('data:image/svg+xml,')));
  await p.screenshot({path:`${out}/shop-${blade}.png`});await p.locator('[data-action="buy-gear"][data-value="chainLightning"]').click();
  check(`${blade}: native purchase spends 150 coins and applies both actual stats`,await p.evaluate(before=>__BLADE__.run.state.economy.wallet===450&&__BLADE__.run.stats.damage-before.damage===20&&Math.abs(before.interval/__BLADE__.run.stats.interval-1.15)<1e-9,before));
  await p.locator('[data-shop-resume]').click();
  await p.evaluate(()=>{const r=__BLADE__.run;for(let i=0;i<10;i++){const angle=(i-1)*Math.PI*2/9;const e=r.spawnEnemy('boss',i===0?60:Math.cos(angle)*145,i===0?0:Math.sin(angle)*145);e.hp=e.maxHp=10000;e.speed=0;e.cooldown=1e6;}r.state.attackTimer=0;});await watch(p);
  check(`${blade}: five native attacks reach full energy without firing lightning`,await until(p,true)&&await p.evaluate(()=>__CHAIN_EVENTS__.length===0&&__BLADE__.run.state.build.chainCharge===100));
  check(`${blade}: HUD and owned icon show full energy`,await p.locator('#build-state').textContent().then(t=>t.includes('盈能已满'))&&await p.locator('.equipment-chip.energized .gear-energy em').evaluate(el=>el.style.width==='100%'));
  await p.locator('#shop-button').click();await p.locator('.shop-item[data-value="chainLightning"]').click();const full=await state(p);await frame(p,120);
  check(`${blade}: paused shop freezes full energy and combat clock`,JSON.stringify(await state(p))===JSON.stringify(full));await p.evaluate(()=>__BLADE__.save());
  await p.reload();await p.locator('#boot-status').waitFor({state:'hidden'});await p.getByRole('button',{name:'继续试炼',exact:true}).click();
  check(`${blade}: refresh preserves full energy, equipment and all world state`,JSON.stringify(await state(p))===JSON.stringify(full));await watch(p);
  check(`${blade}: the next native attack releases four unique real lightning hits`,await until(p,false)&&await p.evaluate(()=>__CHAIN_EVENTS__.length===4&&new Set(__CHAIN_EVENTS__.map(e=>e.enemyId)).size===4&&__BLADE__.run.state.build.chainCharge===0));
  await p.evaluate(()=>{const a=__BLADE__;a.run.state.level=30;window.__CHAIN_EVENTS__=[];});
  check(`${blade}: level thirty still builds energy through normal attacks`,await until(p,true)&&await p.evaluate(()=>__CHAIN_EVENTS__.length===0));
  check(`${blade}: level growth really expands the lightning to eight different targets`,await until(p,false)&&await p.evaluate(()=>__CHAIN_EVENTS__.length===8&&new Set(__CHAIN_EVENTS__.map(e=>e.enemyId)).size===8&&__CHAIN_EVENTS__.every((e,i)=>i===0||e.amount<=__CHAIN_EVENTS__[i-1].amount)));
  await p.evaluate(()=>{__BLADE__.scene.pausedRun=true;});
  check(`${blade}: all eight lightning links reach the WebGL effects renderer`,await p.evaluate(()=>__BLADE__.game.renderer.type===2&&__BLADE__.scene.buildFx.filter(f=>f.event.gearId==='chainLightning').length===8));
  await p.screenshot({path:`${out}/eight-links-${blade}.png`});
  await p.locator('#shop-button').click();await p.locator('.shop-item[data-value="chainLightning"]').click();await p.locator('.buy-gear').click();await p.locator('.buy-gear').click();
  check(`${blade}: real upgrades reach rank three and the shared cap`,(await state(p)).economy.gear.chainLightning===3&&(await state(p)).economy.wallet===45&&await p.locator('.buy-gear').isDisabled());
  await p.locator('.sell-gear').click();
  check(`${blade}: selling returns 416 coins and removes the energy icon and stat bonus`,(await state(p)).economy.wallet===461&&(await state(p)).build.chainCharge===0&&await p.locator('.equipment-chip[data-value="chainLightning"]').count()===0);
  await p.close();
 }
 const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});await boot(p,15);
 const previous=await p.evaluate(()=>{const a=__BLADE__;a.run.buyGear('sugarCore');a.run.buyGear('clockGrip');a.run.state.build.heat=2;a.run.state.build.heatTime=1.5;a.run.state.time=173;a.storage.data.meta.bestScore=9001;a.save();const data=JSON.parse(localStorage.getItem('blade-evolution-save-v1'));data.version=10;data.run.version=10;for(const id of ['chainLightning','redMoonBlade','solarEdge','stoneCleaver'])delete data.run.economy.gear[id];for(const key of ['chainCharge','bloodShield','bloodShieldTime'])delete data.run.build[key];return data;});
 await p.addInitScript(data=>{if(!sessionStorage.getItem('previous-v10')){localStorage.setItem('blade-evolution-save-v1',JSON.stringify(data));sessionStorage.setItem('previous-v10','1');}},previous);
 await p.reload();await p.locator('#boot-status').waitFor({state:'hidden'});await p.getByRole('button',{name:'继续试炼',exact:true}).click();const migrated=await state(p);
 check('previous v10 saves keep paid equipment, gold, time, heat and permanent score',migrated.version===12&&migrated.economy.wallet===485&&migrated.economy.gear.sugarCore===1&&migrated.economy.gear.clockGrip===1&&migrated.economy.refunded===0&&migrated.time===173&&migrated.build.heat===2&&migrated.build.chainCharge===0&&await p.evaluate(()=>__BLADE__.storage.data.meta.bestScore===9001));
 await p.locator('#shop-button').click();await p.locator('.shop-item[data-value="chainLightning"]').click();await p.locator('.buy-gear').click();await p.reload();await p.locator('#boot-status').waitFor({state:'hidden'});await p.getByRole('button',{name:'继续试炼',exact:true}).click();
 check('v10 migration does not replay after buying the new item and refreshing',(await state(p)).economy.wallet===335&&(await state(p)).economy.gear.chainLightning===1&&(await state(p)).economy.refunded===0);
 await p.setViewportSize({width:320,height:568});await p.locator('#shop-button').tap();await p.locator('[data-action="shop-category"][data-value="attack"]').tap();await p.locator('.shop-item[data-value="chainLightning"]').tap();await p.locator('.buy-gear').tap();
 check('320px touch detail keeps the new item upgrade visible, usable and paused',(await state(p)).economy.gear.chainLightning===2&&(await state(p)).economy.wallet===150&&await p.evaluate(()=>__BLADE__.battlePaused));await p.screenshot({path:`${out}/small-shop.png`});
 const icon=await p.locator('.shop-detail-heading>.gear-icon').getAttribute('src');
 const iconPage=await browser.newPage({viewport:{width:128,height:128},deviceScaleFactor:2});await iconPage.setContent(`<html><body style="margin:0;background:transparent"><img src="${icon}" width="128" height="128"></body></html>`);await iconPage.screenshot({path:`${out}/icon.png`,omitBackground:true});await iconPage.close();await p.close();
 check('new item, lightning visuals, shop and migration produce no runtime errors',errors.length===0);
 await fs.writeFile(`${out}/results.json`,JSON.stringify({passed:checks.length,checks,errors,artifact:base,scope:'Native shop purchase/upgrade/sell, ordinary attack charging and next-hit lightning, pause, exact full-energy reload, four weapons, WebGL links, and v10 compatibility. Physical coin funding, stationary high-HP targets and the level-thirty boundary are explicit QA fixtures.'},null,2));
}catch(error){for(const c of browser.contexts())for(const p of c.pages())try{await p.screenshot({path:`${out}/failure.png`});}catch{}throw error;}finally{await browser.close();}
