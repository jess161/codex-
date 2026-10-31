import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.GAME_URL??'http://127.0.0.1:4173/',out='test-results/blade/bows';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const checks=[],errors=[];const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
const snapshot=p=>p.evaluate(()=>structuredClone(__BLADE__.run.state));
async function frame(p,n=1){await p.evaluate(n=>{const a=__BLADE__;for(let i=0;i<n;i++){a.frame(1/60);a.scene.update(0,1000/60);}a.ui.render(true);},n);}
async function boot(p,index,webgl=false){
 await p.addInitScript(()=>{let app;Object.defineProperty(window,'__BLADE__',{configurable:true,get:()=>app,set:a=>{app=a;a.scene.onFrame=undefined;}});});
 p.on('pageerror',e=>errors.push(e.message));await p.goto(base+(base.includes('?')?'&':'?')+'qa=1'+(webgl?'&renderer=webgl':''));await p.locator('#boot-status').waitFor({state:'hidden'});
 await p.getByRole('button',{name:'开始试炼',exact:true}).click();check(`weapon ${index}: all fifteen choices are available`,await p.locator('.blade-option').count()===15);
 await p.locator(`.blade-option[data-value="${index}"]`).click();check(`weapon ${index}: selection explains its own passive and manual active`,await p.locator('.loadout-detail').textContent().then(t=>t.includes(['顺风连矢','凝霜','余烬'][index-12])&&t.includes(['疾风骤雨','寒星箭雨','陨火贯星'][index-12])));
 await p.getByRole('button',{name:'持弓出发',exact:true}).click();
 await p.evaluate(()=>{const r=__BLADE__.run;r.state.enemies=[];r.state.invincible=1000;r.state.spawnBudget=-100000;r.state.eliteIndex=4;r.state.attackTimer=0;for(const [x,y]of [[160,0],[200,55],[200,-55]]){const e=r.spawnEnemy('armor',x,y);e.hp=e.maxHp=10000;e.speed=0;e.cooldown=1000;}});await frame(p,2);
}
async function shot(p,name){await p.screenshot({path:`${out}/${name}.png`});}
try{
 for(const index of [12,13,14]){
  const p=await browser.newPage({viewport:{width:1100,height:800},deviceScaleFactor:2});await boot(p,index,index!==12);
  check(`weapon ${index}: matching crisp 512px bow body renders without a blade frame`,await p.evaluate(i=>{const a=__BLADE__,image=a.scene.liveSprites.get('held-bow');return image?.texture.key===`bow-limbs-${i+1}`&&image.texture.getSourceImage().width===512&&!a.scene.blade.visible&&!a.scene.hilt.visible;},index));
  await p.keyboard.down('s');await frame(p,60);const moving=await snapshot(p);await frame(p,10);await p.keyboard.up('s');
  check(`weapon ${index}: native movement, auto aim and real ranged damage work together`,moving.archery.shots>0&&moving.enemies.some(e=>e.hp<e.maxHp)&&(await snapshot(p)).player.y>moving.player.y);
  await p.keyboard.press('q');await frame(p,4);const cast=await snapshot(p);
  check(`weapon ${index}: Q invokes its unique ranged active once`,cast.active.casts===1&&(index===12?cast.archery.bursts.length>0:index===13?cast.archery.rains.length===1:cast.archery.arrows.some(a=>a.active)));
  await p.keyboard.press('q');await frame(p,4);check(`weapon ${index}: cooldown blocks an extra cast`,(await snapshot(p)).active.casts===1);
  await frame(p,8);await shot(p,`desktop-${index}`);
  const stored=await snapshot(p);await p.evaluate(()=>__BLADE__.save());await p.reload();await p.locator('#boot-status').waitFor({state:'hidden'});await p.getByRole('button',{name:'继续试炼',exact:true}).click();const restored=await snapshot(p);
  check(`weapon ${index}: reload exactly restores arrows, active state and all RNG`,JSON.stringify(restored.archery)===JSON.stringify(stored.archery)&&JSON.stringify(restored.active)===JSON.stringify(stored.active)&&restored.rng===stored.rng&&restored.relicLoot.rng===stored.relicLoot.rng);
  await p.evaluate(()=>{const r=__BLADE__.run;for(const id of ['ruler','anvil','hourglass']){const d=r.addRelicDrop(id,r.state.player.x,r.state.player.y);d.spawn=0;}});await frame(p);
  check(`weapon ${index}: physical items appear in the existing unlimited bottom dock`,await p.locator('.relic-chip').count()===3&&(await snapshot(p)).mode==='playing');
  await p.keyboard.press('i');check(`weapon ${index}: item explanations adapt sword length to arrow range`,await p.locator('.relic-owned').filter({hasText:'伸缩尺'}).textContent().then(t=>t.includes('射程')&&!t.includes('刀身长度')));await p.keyboard.press('Escape');
  await p.keyboard.press('Escape');await p.getByRole('button',{name:'武器图鉴',exact:true}).click();check(`weapon ${index}: codex includes fifteen complete weapon entries`,await p.locator('.codex-card').count()===15);
  await p.locator(`.codex-card[data-tier="${index}"] .codex-art`).click();await p.waitForFunction(()=>document.querySelector('.blade-inspector')?.dataset.ready==='true'||document.querySelector('[data-ready="true"]'));
  check(`weapon ${index}: bow inspection opens its real art in a 3D model or supported fallback`,await p.locator('#inspector-mode').textContent().then(t=>t.includes('鉴赏'))&&await p.locator('.inspector-flat').evaluate(i=>i.complete&&i.naturalWidth===512));await shot(p,`inspector-${index}`);await p.close();
 }
 for(const index of [12,13,14]){
  const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});await boot(p,index);
  const cdp=await p.context().newCDPSession(p),point=(x,y,id=1)=>({x,y,id}),send=(type,touchPoints=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  await send('touchStart',[point(65,440)]);const primary=point(105,440);await send('touchMove',[primary]);await frame(p,12);
  const ab=await p.locator('#active-button').boundingBox(),secondary=point(ab.x+ab.width/2,ab.y+ab.height/2,2);await send('touchStart',[primary,secondary]);await send('touchEnd',[secondary]);await frame(p,4);const cast=await snapshot(p);await frame(p,12);
  check(`phone weapon ${index}: second-finger skill casting preserves the movement finger`,cast.active.casts===1&&(await snapshot(p)).player.x>cast.player.x&&await p.locator('#touch-joystick').isVisible());
  await p.evaluate(()=>{const r=__BLADE__.run,d=r.addRelicDrop('ruler',r.state.player.x,r.state.player.y);d.spawn=0;});await frame(p,4);
  check(`phone weapon ${index}: item pickup neither stops moving nor opens a choice`,await p.locator('#touch-joystick').isVisible()&&await p.locator('.relic-chip').count()===1&&await p.locator('.relic-card').count()===0);await send('touchEnd');await frame(p,2);await shot(p,`phone-${index}`);
  check(`phone weapon ${index}: native DPR3 canvas is sharp and the bow makes no drag scars`,await p.evaluate(()=>__BLADE__.game.canvas.width===1170&&__BLADE__.game.canvas.height===2532&&__BLADE__.scene.drag.marks.length===0));
  for(const size of [{width:320,height:568},{width:740,height:360}]){await p.setViewportSize(size);await frame(p);const a=await p.locator('#active-button').boundingBox(),d=await p.locator('#dash-button').boundingBox(),dock=await p.locator('#relic-dock').boundingBox();check(`phone weapon ${index} ${size.width}x${size.height}: combat controls remain touchable above the dock`,a.width>=44&&d.width>=44&&dock.y>=a.y+a.height&&dock.y>=d.y+d.height&&await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await p.close();
 }
 check('all three bows work in Canvas, WebGL, touch, saves and inspection without runtime errors',errors.length===0);
 await fs.writeFile(`${out}/results.json`,JSON.stringify({passed:checks.length,checks,errors,artifact:base,scope:'Native selection, automatic shooting, Q, CDP multi-touch, pickup, inventory, exact reload and 3D inspection. Stationary high-HP enemies and on-player item drops are explicit fixtures. Phone is browser emulation, not a physical-device benchmark.'},null,2));
}catch(error){for(const c of browser.contexts())for(const p of c.pages())try{await p.screenshot({path:`${out}/failure-${p.viewportSize()?.width}.png`});}catch{}throw error;}finally{await browser.close();}
