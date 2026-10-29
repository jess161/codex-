import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const url=process.env.GAME_URL??'http://127.0.0.1:5173/castaway.html';
const output='test-results/first-person';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],checks=[];
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
const snapshot=page=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const track=page=>{page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});};
const shot=async(page,name)=>{await page.waitForTimeout(450);await page.screenshot({path:`${output}/${name}.png`});};
async function face(page,point){await page.evaluate(point=>window.__CASTAWAY__.world.lookAtPoint(point),point);}
async function harvest(page,kind){
  const point=await page.evaluate(kind=>{const n=window.__CASTAWAY__.session.model.state.nodes.find(n=>n.kind===kind&&n.remaining>0);return {x:n.x,y:n.y};},kind);
  await face(page,point);
  const d=await page.evaluate(p=>Math.hypot(window.__CASTAWAY__.session.model.state.player.x-p.x,window.__CASTAWAY__.session.model.state.player.y-p.y),point);
  if(d>95){await page.keyboard.down('w');await page.waitForFunction(p=>Math.hypot(window.__CASTAWAY__.session.model.state.player.x-p.x,window.__CASTAWAY__.session.model.state.player.y-p.y)<90,point,{timeout:10000});await page.keyboard.up('w');}
  await face(page,point);
  const amount=await page.evaluate(kind=>window.__CASTAWAY__.session.model.state.inventory[kind],kind);
  await page.keyboard.press('e');await page.waitForFunction(({kind,amount})=>window.__CASTAWAY__.session.model.state.inventory[kind]>amount,{kind,amount},{timeout:12000});
}
async function build(page,id,point){
  await page.keyboard.press('b');await page.locator('[data-action="craft-tab"][data-tab="camp"]').click();
  await page.locator(`[data-action="craft-recipe"][data-recipe="${id}"]`).click();await page.waitForTimeout(350);
  await face(page,point);await page.waitForFunction(()=>window.__CASTAWAY__.session.buildValid,{},{timeout:8000});await page.keyboard.press('e');
  await page.waitForFunction(id=>window.__CASTAWAY__.session.model.state.structures.some(s=>s.kind===id),id,{timeout:10000});
}
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});track(page);
  await page.goto(url,{waitUntil:'networkidle'});await page.waitForSelector('#loading',{state:'hidden'});await shot(page,'01-title');
  check('boots into an actionable 3D title screen',!!await page.evaluate(()=>window.__CASTAWAY__?.world?.renderer));
  await page.getByRole('button',{name:'开始漂流',exact:true}).click();await page.waitForTimeout(2000);
  const start=await snapshot(page);
  check('perspective camera is at player eye level',start.perspective==='first-person'&&Math.abs(start.camera.worldPosition[0]-start.position.x*.025)<.01&&Math.abs(start.camera.worldPosition[2]-start.position.y*.025)<.01&&start.camera.eyeHeight===1.65);
  check('center reticle is visible',await page.locator('#crosshair').isVisible());
  await page.keyboard.press('e');await page.waitForFunction(()=>window.__CASTAWAY__.session.model.state.inventory.wood===3);
  check('E gathers the resource in front of the player',(await snapshot(page)).achievements.includes('first-gather'));
  const oldYaw=(await snapshot(page)).camera.yaw;
  if((await snapshot(page)).pointerLocked){await page.mouse.move(850,425);}else{await page.mouse.move(640,360);await page.mouse.down();await page.mouse.move(770,375,{steps:5});await page.mouse.up();}
  await page.waitForTimeout(250);check('real mouse movement rotates the camera',Math.abs((await snapshot(page)).camera.yaw-oldYaw)>.08);
  const p=(await snapshot(page)).position;await face(page,{x:p.x+400,y:p.y});
  await page.keyboard.down('w');await page.waitForTimeout(450);await page.keyboard.up('w');
  const moved=(await snapshot(page)).position;check('W moves in the current viewing direction',moved.x>p.x+20&&Math.abs(moved.y-p.y)<5);
  await harvest(page,'stone');await harvest(page,'fiber');check('view-relative walking reaches and harvests stone and fiber',(await snapshot(page)).inventory.fiber===3);
  await page.keyboard.press('b');await page.waitForTimeout(400);
  check('opening a menu releases pointer lock and pauses survival',(await snapshot(page)).mode==='paused'&&!(await snapshot(page)).pointerLocked);
  const paused=await snapshot(page);await page.mouse.move(600,290);await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('w');
  const still=await snapshot(page);check('menus freeze time, position, and camera',still.minute===paused.minute&&still.position.x===paused.position.x&&still.camera.yaw===paused.camera.yaw);
  await shot(page,'02-crafting');await page.locator('[data-action="craft-recipe"][data-recipe="axe"]').click();
  check('stone axe still crafts with exact material costs',(await snapshot(page)).tools.includes('axe')&&(await snapshot(page)).inventory.wood===0);
  await page.keyboard.press('Escape');await page.waitForTimeout(250);
  check('crafted axe appears in the first-person hands',await page.evaluate(()=>window.__CASTAWAY__.world.camera.getObjectByName('held-axe').visible));
  await page.keyboard.press('1');check('quick supplies still restore water',(await snapshot(page)).inventory.coconut===0&&(await snapshot(page)).water>90);
  await page.keyboard.press('m');await shot(page,'03-map');check('map includes the player position and bearing',await page.locator('#full-map').isVisible());await page.keyboard.press('Escape');
  // A midgame fixture provisions materials; placement, sleep, reload, and endings use actual game actions.
  await page.evaluate(()=>{const s=window.__CASTAWAY__.session.model.state;for(const id of Object.keys(s.inventory))s.inventory[id]=40;s.player={x:1640,y:1810};});
  await build(page,'campfire',{x:1635,y:1885});check('crosshair placement builds the campfire',(await snapshot(page)).structures.some(s=>s.kind==='campfire'));
  await build(page,'shelter',{x:1830,y:1760});check('a second 3D structure can be placed',(await snapshot(page)).structures.some(s=>s.kind==='shelter'));
  const home=await page.evaluate(()=>{const s=window.__CASTAWAY__.session.model.state,home=s.structures.find(s=>s.kind==='shelter');s.player={x:home.x-85,y:home.y};return {x:home.x,y:home.y};});
  await face(page,home);await page.waitForTimeout(250);await page.keyboard.press('e');await page.waitForSelector('.sleep-modal');await page.locator('[data-action="sleep"]').click();
  check('first-person shelter interaction sleeps to dawn',(await snapshot(page)).day===2);
  await page.evaluate(()=>{window.__CASTAWAY__.session.model.state.minute=11*60;});await face(page,{x:1540,y:1810});await page.waitForTimeout(5500);await shot(page,'04-rainy-camp');
  await page.evaluate(()=>{window.__CASTAWAY__.session.model.state.minute=20*60;});await shot(page,'05-night-fire');
  const pose=await snapshot(page);await page.evaluate(()=>window.__CASTAWAY__.session.model.save());
  await page.reload({waitUntil:'networkidle'});await page.waitForSelector('#loading',{state:'hidden'});await page.getByRole('button',{name:'继续旅程',exact:true}).click();await page.waitForTimeout(1200);
  check('save restores the camp, survival day, and view orientation',(await snapshot(page)).day===2&&(await snapshot(page)).structures.length===2&&Math.abs((await snapshot(page)).camera.yaw-pose.camera.yaw)<.01);
  await page.keyboard.press('b');await page.waitForTimeout(200);await page.keyboard.press('Escape');
  const supported=await page.evaluate(()=>{const ext=window.__CASTAWAY__.world.renderer.getContext().getExtension('WEBGL_lose_context');if(!ext)return false;window.__TEST_CONTEXT__=ext;ext.loseContext();return true;});
  if(supported){await page.waitForSelector('#graphics-status',{state:'visible'});await page.waitForTimeout(700);await page.evaluate(()=>window.__TEST_CONTEXT__.restoreContext());await page.waitForSelector('#graphics-status',{state:'hidden',timeout:15000});check('WebGL context loss pauses safely and restores the scene',(await snapshot(page)).mode==='paused');await page.locator('[data-action="resume"]').click();}
  await page.evaluate(()=>{const m=window.__CASTAWAY__.session.model,s=m.state;s.day=3;s.minute=9*60;s.hunger=90;s.thirst=90;s.player={x:2040,y:1730};m.craft('signal',{x:2040,y:1730});m.interactStructure(s.structures.find(a=>a.kind==='signal').id);});
  await page.waitForFunction(()=>window.__CASTAWAY__.session.model.state.status==='rescued',{},{timeout:25000});check('3D survival journey retains the rescue ending',(await snapshot(page)).achievements.includes('rescued'));await shot(page,'06-rescued');
  await page.locator('#end-root [data-action="restart-now"]').click();await page.waitForTimeout(500);await page.evaluate(()=>{const s=window.__CASTAWAY__.session.model.state;s.hp=.01;s.thirst=0;});await page.waitForFunction(()=>window.__CASTAWAY__.session.model.state.status==='dead');check('failure state still offers a fresh journey',await page.locator('#end-root [data-action="restart-now"]').isVisible());await page.close();
  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});track(mobile);
  await mobile.goto(url,{waitUntil:'networkidle'});await mobile.waitForSelector('#loading',{state:'hidden'});await mobile.getByRole('button',{name:'开始漂流',exact:true}).tap();await mobile.waitForTimeout(1500);
  check('mobile uses touch controls without pointer lock',!(await snapshot(mobile)).pointerLocked&&await mobile.locator('#joystick').isVisible());
  const touch=await mobile.context().newCDPSession(mobile),r=await mobile.locator('#joystick').boundingBox(),jx=r.x+r.width/2,jy=r.y+r.height/2,before=await snapshot(mobile);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:jx,y:jy,id:1},{x:265,y:350,id:2}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:jx+29,y:jy,id:1},{x:315,y:365,id:2}]});await mobile.waitForTimeout(550);
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const after=await snapshot(mobile);check('left joystick and right look drag work simultaneously',Math.hypot(after.position.x-before.position.x,after.position.y-before.position.y)>20&&Math.abs(after.camera.yaw-before.camera.yaw)>.15);
  await shot(mobile,'07-mobile');await mobile.locator('[data-action="craft"]').last().tap();await shot(mobile,'08-mobile-crafting');check('mobile workbench fits the viewport',await mobile.locator('.sheet').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}));
  check('no horizontal page overflow',await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mobile.close();
  check('no runtime, shader, or external resource errors',errors.length===0);
  await fs.writeFile(`${output}/results.json`,JSON.stringify({passed:checks.length,checks,errors},null,2));console.log(`\n${checks.length} first-person browser checks passed.`);
}catch(error){console.error('PLAYTEST FAILED',error);console.error('Browser errors:',errors);for(const page of browser.contexts().flatMap(c=>c.pages())){try{console.error('STATE',await snapshot(page));await page.screenshot({path:`${output}/failure.png`});}catch{}}process.exitCode=1;}
finally{await browser.close();}
