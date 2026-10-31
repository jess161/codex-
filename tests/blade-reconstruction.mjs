import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.GAME_URL??'http://127.0.0.1:4173/';
const out='test-results/blade/reconstruction';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const checks=[],errors=[],metrics={};
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
async function boot(page,webgl=false){
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+(base.includes('?')?'&':'?')+'qa=1'+(webgl?'&renderer=webgl':''));
  await page.locator('#boot-status').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'开始试炼',exact:true}).click();await page.getByRole('button',{name:'持刀出发',exact:true}).click();
  await isolate(page);
}
const isolate=page=>page.evaluate(()=>{const a=window.__BLADE__;a.scene.onFrame=undefined;a.game.loop.stop();a.run.state.enemies=[];a.run.state.spawnBudget=-100000;a.run.state.attackTimer=100000;});
const step=(page,n=1)=>page.evaluate(n=>{const a=window.__BLADE__;for(let i=0;i<n;i++){a.frame(1/60);a.game.step(performance.now(),1000/60);}a.ui.render(true);},n);
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
try {
  const page=await browser.newPage({viewport:{width:1000,height:720}});await boot(page);await step(page);
  check('all new characters and twelve blades use lossless high resolution source pixels',await page.evaluate(()=>{
    const t=__BLADE__.scene.textures;return ['hero','blob','swift','armor','shooter','charger','wisp','splitter','brood','spiker','elite','boss','poison','bomber','stalker','xp'].every(k=>t.get(k).getSourceImage().width===512)&&Array.from({length:12},(_,i)=>`blade-${i+1}`).every(k=>t.get(k).getSourceImage().width===1280);
  }));
  check('body and hilt share one atlas per blade without tripling the texture memory',await page.evaluate(()=>{const t=__BLADE__.scene.textures;return !t.exists('blade-1-body')&&t.get('blade-1').has('body')&&t.get('blade-1').has('hilt');}));
  const idle=await page.evaluate(()=>({inclination:__BLADE__.scene.drag.inclination,face:__BLADE__.scene.drag.presentation(null).faceScale}));
  check('idle weapon rests at 45 degrees with its face narrowed to one quarter',Math.abs(idle.inclination-Math.PI/4)<.001&&Math.abs(idle.face-.25)<.001);
  await page.evaluate(()=>{const c=__BLADE__.audio.context,create=c.createOscillator.bind(c);window.__dragOscillators=0;c.createOscillator=()=>{window.__dragOscillators++;return create();};});
  await page.keyboard.down('d');await step(page,60);await page.keyboard.up('d');await step(page,3);
  const drag=await page.evaluate(()=>{const a=__BLADE__,d=a.scene.drag;return {marks:d.marks.length,sparks:d.sparks.length,contact:d.contact,blade:{x:a.scene.blade.x,y:a.scene.blade.y,angle:a.scene.blade.rotation,scaleX:a.scene.blade.scaleX},inclination:d.inclination,rng:a.run.state.rng,velocity:a.run.state.velocity};});
  check('real keyboard movement emits colored grooves and enlarged contact sparks',drag.marks>10&&drag.sparks>0&&drag.contact.color===0x64b8ef);
  check('the shared projected nose anchors ground effects to the visible tip',Math.abs(Math.hypot(drag.contact.x-drag.blade.x,drag.contact.y-drag.blade.y)-drag.blade.scaleX*868)<1);
  check('dragging across the ground creates no friction audio nodes',await page.evaluate(()=>window.__dragOscillators===0));
  await shot(page,'01-sharp-drag-and-sparks');
  await page.keyboard.press('Escape');const frozen=await page.evaluate(()=>({state:__BLADE__.run.snapshot(),marks:structuredClone(__BLADE__.scene.drag.marks),sparks:structuredClone(__BLADE__.scene.drag.sparks)}));await step(page,60);
  check('pause freezes simulation, scratch fading and spark movement',await page.evaluate(f=>JSON.stringify(__BLADE__.run.snapshot())===JSON.stringify(f.state)&&JSON.stringify(__BLADE__.scene.drag.marks)===JSON.stringify(f.marks)&&JSON.stringify(__BLADE__.scene.drag.sparks)===JSON.stringify(f.sparks),frozen));
  await page.getByRole('button',{name:'继续试炼',exact:true}).click();
  await page.keyboard.press('c');await step(page,20);check('native C key opens a paused four-axis combat-power panel',await page.locator('.power-axes>div').count()===4&&await page.evaluate(()=>__BLADE__.panel==='power'&&__BLADE__.scene.pausedRun));await shot(page,'02-combat-power');await page.keyboard.press('Escape');

  await page.evaluate(()=>{const a=__BLADE__,s=a.run.state;s.orbs=[];for(let i=0;i<5000;i++)a.run.addOrb(2000+i*2,2000+i%20,1,'xp');s.velocity={x:0,y:0};a.game.step(performance.now(),1000/60);});
  metrics.orbs=await page.evaluate(()=>{const a=__BLADE__;for(let i=0;i<3;i++)a.scene.update(0,1000/60);const start=performance.now();for(let i=0;i<10;i++)a.scene.update(0,1000/60);return {stored:a.run.state.orbs.length,sprites:[...a.scene.liveSprites.keys()].filter(k=>k.startsWith('o')).length,sceneUpdateMeanMs:(performance.now()-start)/10,canvas:[a.game.canvas.width,a.game.canvas.height]};});
  check('5000 offscreen rewards remain in data while offscreen sprites are culled',metrics.orbs.stored===5000&&metrics.orbs.sprites===0);
  const positions=await page.evaluate(()=>__BLADE__.run.state.orbs.map(o=>[o.id,o.x,o.y,o.value]));
  await page.evaluate(()=>{const a=__BLADE__;a.setSetting('simplified',true);a.save();});
  check('lite mode and browser storage retain every individual orb and position',await page.evaluate(p=>JSON.stringify(__BLADE__.run.state.orbs.map(o=>[o.id,o.x,o.y,o.value]))===JSON.stringify(p)&&JSON.parse(localStorage.getItem('blade-evolution-save-v1')).run.orbs.length===5000,positions));
  await page.evaluate(()=>{const a=__BLADE__;a.setSetting('simplified',false);const s=a.run.state;s.player={x:0,y:0};s.orbs.forEach(o=>o.dropTimer=0);s.swing=null;const e=a.run.spawnEnemy('blob',45,0);e.hp=1;e.speed=0;s.attackTimer=0;});await step(page,12);
  check('native kills still create fresh XP drops beyond the former cap',await page.evaluate(()=>__BLADE__.run.state.orbs.length>=5001&&__BLADE__.run.state.kills>=1));
  await page.evaluate(()=>{const a=__BLADE__,s=a.run.state;s.player={x:2000,y:2000};s.velocity={x:0,y:0};a.game.step(performance.now(),1000/60);});
  check('returning to the drop area renders the same old orbs in their stored positions',await page.evaluate(()=>[...__BLADE__.scene.liveSprites.keys()].filter(k=>k.startsWith('o')).length>20));

  await page.evaluate(()=>{const a=__BLADE__;a.start();a.run.state.enemies=[];a.run.state.spawnBudget=-100000;a.run.state.attackTimer=100000;a.run.state.hp=100;a.run.state.player={x:0,y:0};a.run.state.invincible=0;const e=a.run.spawnEnemy('bomber',60,0);e.speed=0;e.cooldown=0;});await step(page,1);
  check('bomber locks into its visible 1.1-second danger warning',await page.evaluate(()=>__BLADE__.run.state.enemies[0].action==='windup'&&__BLADE__.run.state.enemies[0].timer===1.1));await shot(page,'03-bomber-warning');await step(page,67);
  check('bomber self destruction deals one blast and drops XP without kill credit',await page.evaluate(()=>{const s=__BLADE__.run.state;return s.hp===82&&s.kills===0&&s.orbs.length===1;}));
  await page.evaluate(()=>{const a=__BLADE__,s=a.run.state;s.orbs=[];s.enemies=[];s.hazards=[];s.player={x:0,y:0};s.hp=100;const e=a.run.spawnEnemy('poison',160,0);e.speed=0;e.cooldown=0;});await step(page,1);await page.keyboard.down('s');await step(page,54);await page.keyboard.up('s');
  check('poison windup targets the old position while native movement escapes damage',await page.evaluate(()=>{const s=__BLADE__.run.state;return s.hazards[0]?.kind==='poison'&&s.hazards[0].x===0&&s.hazards[0].y===0&&s.player.y>120&&s.hp===100;}));await shot(page,'04-poison-target');
  await page.evaluate(()=>{const a=__BLADE__,s=a.run.state;s.player={x:0,y:0};s.velocity={x:0,y:0};s.enemies=[];s.hazards=[];const e=a.run.spawnEnemy('stalker',150,0);e.speed=0;e.cooldown=100;a.game.step(performance.now(),1000/60);});
  check('stalker keeps a faint visible outline while idle',await page.evaluate(()=>Math.abs(__BLADE__.scene.liveSprites.get('e'+__BLADE__.run.state.enemies[0].id).alpha-.18)<.001));
  await page.evaluate(()=>{const e=__BLADE__.run.state.enemies[0];e.x=110;e.cooldown=0;});await step(page,1);check('stalker fully reveals for its locked-direction warning',await page.evaluate(()=>__BLADE__.run.state.enemies[0].action==='windup'&&__BLADE__.scene.liveSprites.get('e'+__BLADE__.run.state.enemies[0].id).alpha===1));await shot(page,'05-stalker-warning');

  await page.evaluate(()=>{const a=__BLADE__,s=a.run.state;s.enemies=[];s.hazards=[];s.attackTimer=100000;s.player={x:0,y:0};s.velocity={x:0,y:0};s.swing=null;const e=a.run.spawnEnemy('armor',45,0);e.hp=e.maxHp=1000;e.speed=0;e.cooldown=10000;const t=a.run.stats;s.swing={id:s.nextId++,tier:a.run.tier,angle:0,age:t.windup+t.strike*.45,resolved:false,windup:t.windup,strike:t.strike,recovery:t.recovery};});await step(page,1);
  // The base blade produces a light hit; a second native fixture declares a heavy enemy flag.
  await page.evaluate(()=>{const a=__BLADE__,s=a.run.state;s.enemies=[];const e=a.run.spawnEnemy('elite',45,0);e.hp=e.maxHp=1000;e.speed=0;e.cooldown=1000;const t=a.run.stats;s.swing={id:s.nextId++,tier:a.run.tier,angle:0,age:t.windup+t.strike*.45,resolved:false,windup:t.windup,strike:t.strike,recovery:t.recovery};a.lastHitStop=0;});await step(page,1);
  const pausedTime=await page.evaluate(()=>__BLADE__.run.state.time);check('one native heavy strike starts a bounded 32ms impact pause',await page.evaluate(()=>__BLADE__.hitStop===.032));
  await page.keyboard.down('d');await page.keyboard.press(' ');await step(page,2);check('impact pause uses real frame time while holding physics and buffering dash input',await page.evaluate(t=>__BLADE__.run.state.time===t&&__BLADE__.dashQueued===true,pausedTime));await step(page,1);await page.keyboard.up('d');check('buffered movement and dash execute after impact pause',await page.evaluate(()=>__BLADE__.run.state.dashCooldown>4));

  await page.keyboard.press('Escape');await page.getByRole('button',{name:'游戏设置',exact:true}).click();
  for(const key of ['sound','monsterSound']){await page.locator(`[data-setting="${key}"]`).uncheck();await page.locator(`[data-setting="${key}"]`).check();}
  check('both audio switches can be enabled through actual trusted settings input',await page.evaluate(()=>__BLADE__.audio.enabled&&__BLADE__.audio.monsterEnabled&&__BLADE__.audio.context?.state==='running'));
  await page.locator('[data-setting="motion"]').uncheck();await page.getByRole('button',{name:'完成',exact:true}).click();await page.getByRole('button',{name:'继续试炼',exact:true}).click();await step(page,2);
  check('reduced motion clears contact sparks and any remaining impact pause',await page.evaluate(()=>__BLADE__.scene.drag.sparks.length===0&&!__BLADE__.scene.impactStopped&&__BLADE__.hitStop===0));
  await page.close();

  const phone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});await boot(phone);await step(phone);
  check('phone DPR3 uses a native 1170 by 2532 canvas with CSS-sized display',await phone.evaluate(()=>__BLADE__.game.canvas.width===1170&&__BLADE__.game.canvas.height===2532&&__BLADE__.game.canvas.style.width==='390px'));
  await phone.getByRole('button',{name:'暂停',exact:true}).tap();await phone.getByRole('button',{name:'游戏设置',exact:true}).tap();
  for(const id of ['grid','meadow','dunes','ruins','night','classic']){await phone.locator(`[data-action="ground"][data-value="${id}"]`).tap();await step(phone);check(`${id}: clear native-density ground loads on DPR3`,await phone.evaluate(()=>{const a=__BLADE__,s=a.scene,t=s.textures.get(s.groundTextureKey).getSourceImage();return t.width>=(s.groundTheme==='classic'?40:576)*s.groundRasterDensity&&s.groundRasterDensity>=Math.ceil(s.cameras.main.zoom);}));}
  await phone.locator('[data-setting="simplified"]').check();check('phone lite mode limits canvas density without changing CSS layout',await phone.evaluate(()=>__BLADE__.game.canvas.width===585&&__BLADE__.game.canvas.height===1266&&document.documentElement.scrollWidth<=innerWidth));
  await phone.locator('[data-setting="simplified"]').uncheck();await phone.getByRole('button',{name:'完成',exact:true}).tap();await phone.getByRole('button',{name:'继续试炼',exact:true}).tap();
  await phone.evaluate(()=>{const r=__BLADE__.run,d=r.addRelicDrop('ruler',r.state.player.x,r.state.player.y);d.spawn=0;});await step(phone,20);check('reconstruction supports continuous physical item pickup and its bottom icon',await phone.locator('.relic-chip[data-relic="ruler"]').count()===1&&await phone.locator('.relic-card').count()===0);await shot(phone,'06-phone-ground-item');
  await phone.setViewportSize({width:844,height:390});await phone.waitForFunction(()=>__BLADE__.game.canvas.width===2532&&__BLADE__.game.canvas.height===1170);await step(phone);check('rotation resizes native canvas and leaves all HUD actions reachable',await phone.evaluate(()=>__BLADE__.game.canvas.width===2532&&__BLADE__.game.canvas.height===1170&&document.documentElement.scrollWidth<=innerWidth));await phone.close();

  const webgl=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:2});await boot(webgl,true);
  await webgl.evaluate(()=>{const a=__BLADE__,s=a.run.state;s.level=30;Object.assign(s.perks,{long:6,broad:6,giant:4});for(const [i,k]of ['poison','bomber','stalker','elite','armor','blob','swift','splitter'].entries()){const e=a.run.spawnEnemy(k,-230+(i%4)*150,-190+Math.floor(i/4)*290);e.speed=0;e.cooldown=1000;}s.velocity={x:130,y:0};});await webgl.keyboard.down('d');await step(webgl,25);await webgl.keyboard.up('d');
  check('WebGL supports new atlases, large projected blades, contact effects and all new monsters',await webgl.evaluate(()=>__BLADE__.game.renderer.type===2&&__BLADE__.scene.drag.marks.length>0&&__BLADE__.run.state.enemies.length===8));await shot(webgl,'07-webgl-large-blade');
  await webgl.keyboard.press('Escape');await webgl.getByRole('button',{name:'武器图鉴',exact:true}).click();await webgl.locator('.codex-art').first().click();await webgl.waitForFunction(()=>__BLADE__.ui.inspector?.active&&document.querySelector('#inspector-mode')?.textContent!=='正在展开刀锋');
  check('lazy loaded 3D inspection opens the same candy art with a working model or supported fallback',await webgl.locator('.inspector-panel').isVisible()&&(await webgl.locator('#inspector-finish').textContent()).includes('糖果'));
  await shot(webgl,'08-matching-inspector');await webgl.close();
  check('all desktop, phone and WebGL reconstruction scenarios have no runtime errors',errors.length===0);
  await fs.writeFile(`${out}/results.json`,JSON.stringify({passed:checks.length,checks,metrics,errors,fixtures:'Deterministic isolated scenarios use real keys/taps and native combat. Deliberate setups create 5000 drops, fixed attack phases and stationary enemies. CPU update timings describe the same synthetic offscreen fixture as orb-baseline.json, not real device FPS. Screenshots cover Canvas DPR1, phone DPR3 and software WebGL DPR2.'},null,2));
} catch(error){for(const c of browser.contexts())for(const p of c.pages())try{await p.screenshot({path:`${out}/failure-${p.viewportSize()?.width}.png`});}catch{}throw error;}finally{await browser.close();}
