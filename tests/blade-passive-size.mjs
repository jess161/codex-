import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173/';
const output = 'test-results/blade/passive-size'; await fs.mkdir(output, { recursive: true });
const checks = [], errors = [], metrics = {};
const check = (name, ok) => { assert.ok(ok, name); checks.push(name); console.log('PASS', name); };
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
async function boot(page, webgl = false) {
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + (base.includes('?') ? '&' : '?') + 'qa=1' + (webgl ? '&renderer=webgl' : ''));
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name:'开始试炼', exact:true }).click(); await page.getByRole('button', { name:'持刀出发', exact:true }).click();
  await isolate(page);
  await page.evaluate(() => {
    const g = __BLADE__.scene.fx, arc = g.arc, circle = g.strokeCircle;
    window.__sizeArcs = []; window.__sizeCircles = [];
    g.arc = function(x,y,r,...rest) { window.__sizeArcs.push({x,y,r}); return arc.call(this,x,y,r,...rest); };
    g.strokeCircle = function(x,y,r) { window.__sizeCircles.push({x,y,r}); return circle.call(this,x,y,r); };
  });
}
async function isolate(page) { await page.evaluate(() => { const a=__BLADE__;a.scene.onFrame=undefined;a.game.loop.stop();const s=a.run.state;s.enemies=[];s.spawnBudget=-100000;s.attackTimer=100000;s.invincible=1000; }); }
async function equip(page, blade) { await page.evaluate(b=>{const a=__BLADE__;a.selectedBlade=b;a.start();},blade);await isolate(page); }
async function frame(page,n=1) { await page.evaluate(n=>{const a=__BLADE__;for(let i=0;i<n;i++){window.__sizeArcs=[];window.__sizeCircles=[];a.frame(1/60);a.game.step(performance.now(),1000/60);}a.ui.render(true);},n); }
async function offer(page, item) {
  await page.evaluate(id=>{const a=__BLADE__,r=a.run,d=r.addRelicDrop(id,r.state.player.x,r.state.player.y);d.spawn=0;a.ui.render(true);},item);
  check(`${item}: size item appears on the ground without a choice menu`, await page.evaluate(id=>__BLADE__.run.state.relicDrops.some(d=>d.relic===id)&&__BLADE__.run.state.mode==='playing',item)&&await page.locator('.relic-card').count()===0);
}
async function pick(page,item,touch=false) {await offer(page,item);await frame(page);check(`${item}: touching the drop equips its bottom icon without pausing`,await page.locator(`.relic-chip[data-relic="${item}"]`).count()===1&&await page.evaluate(()=>__BLADE__.run.state.mode==='playing'));}
async function cast(page,touch=false) {if(touch)await page.locator('#dash-button').tap();else await page.keyboard.press(' ');await frame(page,12);return page.evaluate(()=>{const a=__BLADE__,w=a.run.state.waves.find(w=>w.kind==='getsuga');return {wave:structuredClone(w),drawn:window.__sizeArcs.some(p=>Math.abs(p.r-w.radius)<.001&&Math.hypot(p.x-w.x,p.y-w.y)<.001),renderer:a.game.renderer.type};});}
const shot=(page,name)=>page.screenshot({path:`${output}/${name}.png`});
try {
  const desktop=await browser.newPage({viewport:{width:1100,height:800}});await boot(desktop,true);await equip(desktop,11);
  const small=await cast(desktop);metrics.small=small.wave;
  check('a native Space dash releases the initial-size getsuga with matching draw commands',small.wave.radius===30&&small.wave.hitRadius===10&&small.drawn);
  await shot(desktop,'01-initial-getsuga');
  await pick(desktop,'ruler');await pick(desktop,'anvil');
  check('already released getsuga retains its exact radius, hit width and range after size choices',await desktop.evaluate(w=>{const v=__BLADE__.run.state.waves[0];return v.radius===w.radius&&v.hitRadius===w.hitRadius&&v.maxRange===w.maxRange;},small.wave));
  await desktop.evaluate(()=>__BLADE__.advance(5100));const large=await cast(desktop);metrics.large=large.wave;
  check('native item pickups enlarge the next getsuga visually and mechanically',large.wave.radius>small.wave.radius&&large.wave.hitRadius>small.wave.hitRadius&&large.wave.maxRange>small.wave.maxRange&&large.drawn);
  check('WebGL renders the larger skill through the same graphics path',large.renderer===2);await shot(desktop,'02-grown-getsuga');
  await desktop.evaluate(()=>__BLADE__.save());await desktop.reload();await desktop.locator('#boot-status').waitFor({state:'hidden'});await desktop.getByRole('button',{name:'继续试炼',exact:true}).click();await isolate(desktop);
  check('browser reload preserves grown skill dimensions and collected size items',await desktop.evaluate(w=>{const a=__BLADE__,v=a.run.state.waves.find(w=>w.kind==='getsuga');return v.radius===w.radius&&v.hitRadius===w.hitRadius&&v.maxRange===w.maxRange&&a.run.state.relics.ruler===1&&a.run.state.relics.anvil===1;},large.wave));
  // Reinstall the renderer trace after reload, without changing any gameplay geometry.
  await desktop.evaluate(()=>{const g=__BLADE__.scene.fx,circle=g.strokeCircle;window.__sizeCircles=[];g.strokeCircle=function(x,y,r){window.__sizeCircles.push({x,y,r});return circle.call(this,x,y,r);};});
  for(const [blade,key] of [[4,'ringRadius'],[5,'roarRadius'],[10,'burnSpread']]) {
    await equip(desktop,blade);const before=await desktop.evaluate(k=>__BLADE__.run.passiveSize[k],key);await pick(desktop,'anvil');
    const radius=await desktop.evaluate(k=>{const a=__BLADE__,r=a.run,s=r.state,radius=r.passiveSize[k];const e=r.spawnEnemy(k==='burnSpread'?'blob':'armor',45,0);e.hp=e.maxHp=k==='burnSpread'?1:10000;e.speed=0;e.cooldown=10000;s.passive.hits=r.rules.ringCycle-1;const t=r.stats;s.swing={id:s.nextId++,tier:r.tier,angle:0,age:t.windup+t.strike*.45,windup:t.windup,strike:t.strike,recovery:t.recovery,resolved:false};return radius;},key);
    await frame(desktop);
    check(`${key}: the enlarged area event and rendered outer boundary use the same radius`,radius>before&&await desktop.evaluate(radius=>__BLADE__.run.events.some(e=>e.type==='passive'&&e.radius===radius)&&window.__sizeCircles.some(c=>Math.abs(c.r-radius)<.001),radius));
    await shot(desktop,`03-${key}`);
  }
  await desktop.close();
  const phone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});await boot(phone);await equip(phone,11);
  const phoneSmall=await cast(phone,true);await pick(phone,'ruler',true);await pick(phone,'anvil',true);await phone.evaluate(()=>__BLADE__.advance(5100));const phoneBig=await cast(phone,true);
  check('phone item pickups and the native dash button enlarge the visible getsuga',phoneBig.wave.radius>phoneSmall.wave.radius&&phoneBig.wave.hitRadius>phoneSmall.wave.hitRadius&&phoneBig.drawn);
  check('DPR3 phone Canvas stays sharp and has no page overflow with enlarged passives',await phone.evaluate(()=>__BLADE__.game.canvas.width===1170&&__BLADE__.game.canvas.height===2532&&__BLADE__.game.renderer.type===1&&document.documentElement.scrollWidth<=innerWidth));
  await shot(phone,'04-phone-grown-getsuga');await phone.evaluate(()=>{const a=__BLADE__;a.pause();a.action('settings');});
  await phone.locator('[data-setting="motion"]').uncheck();await phone.locator('[data-setting="simplified"]').check();await phone.getByRole('button',{name:'完成',exact:true}).tap();await phone.getByRole('button',{name:'继续试炼',exact:true}).tap();await frame(phone);
  check('reduced motion and lite mode preserve the projectile size and damage geometry',await phone.evaluate(w=>{const v=__BLADE__.run.state.waves.find(w=>w.kind==='getsuga');return v.radius===w.radius&&v.hitRadius===w.hitRadius&&v.maxRange===w.maxRange;},phoneBig.wave));
  await phone.close();check('desktop WebGL, phone Canvas, pickups, reload and accessibility have no runtime errors',errors.length===0);
  await fs.writeFile(`${output}/results.json`,JSON.stringify({passed:checks.length,checks,errors,metrics,fixtures:'Ground items at the player and stationary enemies are declared fixtures; physical pickups, Space, touch dash, native skill resolution, saves and reloads use real game paths. Renderer method traces record actual Phaser draw radii. No physical-device FPS claim.'},null,2));
}catch(error){for(const c of browser.contexts())for(const p of c.pages())try{await p.screenshot({path:`${output}/failure-${p.viewportSize()?.width}.png`});}catch{}throw error;}finally{await browser.close();}
