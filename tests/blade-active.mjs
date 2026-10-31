import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.GAME_URL??'http://127.0.0.1:4173/',out='test-results/blade/active';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const checks=[],errors=[],metrics={};const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
const snapshot=p=>p.evaluate(()=>structuredClone(__BLADE__.run.state));
async function isolate(p){await p.evaluate(()=>{const a=__BLADE__;a.scene.onFrame=undefined;a.run.state.enemies=[];a.run.state.spawnBudget=-100000;a.run.state.attackTimer=100000;});}
async function frame(p,n=1){await p.evaluate(n=>{const a=__BLADE__;for(let i=0;i<n;i++){a.frame(1/60);a.scene.update(0,1000/60);}a.ui.render(true);},n);}
async function boot(p,webgl=false){p.on('pageerror',e=>errors.push(e.message));await p.goto(`${base}?qa=1${webgl?'&renderer=webgl':''}`);await p.locator('#boot-status').waitFor({state:'hidden'});await p.getByRole('button',{name:'开始试炼',exact:true}).click();await p.getByRole('button',{name:'持刀出发',exact:true}).click();await isolate(p);}
async function fresh(p,blade){await p.evaluate(blade=>{const a=__BLADE__;a.selectedBlade=blade;a.start();},blade);await isolate(p);await frame(p);}
async function shot(p,name){await p.screenshot({path:`${out}/${name}.png`});}
try{
 const desktop=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:2});await boot(desktop);
 check('one dedicated active button is ready at the start',await desktop.locator('#active-button').isEnabled()&&await desktop.locator('#active-label').textContent()==='就绪');
 for(let blade=0;blade<12;blade++){
  await fresh(desktop,blade);const initial=await snapshot(desktop);await desktop.keyboard.press('q');await frame(desktop);
  const cast=await snapshot(desktop);check(`blade ${blade}: Q casts exactly once, with its own cooldown`,cast.active.casts===1&&cast.active.cooldown>=10&&await desktop.locator('#active-button').isDisabled());
  check(`blade ${blade}: active remains independent from relics and dash`,JSON.stringify(cast.relics)===JSON.stringify(initial.relics)&&cast.dashCooldown===0);
 }
 await fresh(desktop,1);await desktop.keyboard.down('q');await frame(desktop,30);const held=await snapshot(desktop);await desktop.evaluate(()=>dispatchEvent(new KeyboardEvent('keydown',{key:'q',repeat:true})));await frame(desktop,30);await desktop.keyboard.up('q');check('holding Q and repeated key events never double-cast',held.active.casts===1&&(await snapshot(desktop)).active.casts===1);
 await desktop.getByRole('button',{name:'暂停',exact:true}).click();const paused=await snapshot(desktop);await desktop.keyboard.press('q');await frame(desktop,60);check('pause freezes skill timing and blocks queued casts',JSON.stringify(await snapshot(desktop))===JSON.stringify(paused));await desktop.getByRole('button',{name:'继续试炼',exact:true}).click();await frame(desktop);check('resume does not fire an activation pressed inside a menu',(await snapshot(desktop)).active.casts===1);
 await fresh(desktop,10);await desktop.evaluate(()=>{const e=__BLADE__.run.spawnEnemy('armor',160,0);e.hp=e.maxHp=100000;e.speed=0;e.cooldown=100000;});await desktop.keyboard.press('q');await frame(desktop,5);const fire=await snapshot(desktop);await desktop.evaluate(()=>__BLADE__.save());await desktop.reload();await desktop.locator('#boot-status').waitFor({state:'hidden'});await desktop.getByRole('button',{name:'继续试炼',exact:true}).click();await isolate(desktop);const restored=await snapshot(desktop);
 check('reload preserves the active fire field, cooldown and cast count',restored.active.casts===fire.active.casts&&JSON.stringify(restored.active.fields)===JSON.stringify(fire.active.fields)&&restored.active.cooldown===fire.active.cooldown);
 await desktop.getByRole('button',{name:'暂停',exact:true}).click();await desktop.getByRole('button',{name:'刀型图鉴',exact:true}).click();check('codex explains twelve active skills separately from the twelve passive skills',await desktop.locator('.codex-card .active-description').count()===12&&await desktop.locator('.codex-passive').count()===12);await shot(desktop,'01-active-skill-catalogue');await desktop.close();
 const phone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});await boot(phone);await fresh(phone,6);
 const cdp=await phone.context().newCDPSession(phone);const pt=(x,y,id=1)=>({x,y,id}),send=(type,touchPoints=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 await send('touchStart',[pt(55,500)]);const moving=pt(100,500);await send('touchMove',[moving]);await frame(phone,10);const before=await snapshot(phone);
 const b=await phone.locator('#active-button').boundingBox(),button=pt(b.x+b.width/2,b.y+b.height/2,2);await send('touchStart',[moving,button]);await frame(phone,5);
 check('a second finger can cast while the movement finger stays captured',(await snapshot(phone)).active.casts===1&&(await snapshot(phone)).player.x>before.player.x&&await phone.locator('#touch-joystick').isVisible());
 await send('touchEnd',[button]);const after=await snapshot(phone);await frame(phone,10);check('releasing the skill finger preserves the movement gesture',(await snapshot(phone)).player.x>after.player.x+20);await send('touchEnd');
 check('Snow active actually renders two ice mirror characters',await phone.evaluate(()=>['active-mirror-0','active-mirror-1'].every(id=>__BLADE__.scene.liveSprites.get(id)?.visible)));
 await shot(phone,'02-phone-ice-mirrors');await send('touchStart',[button]);await send('touchEnd');await frame(phone);check('tapping a cooling button cannot spend another cast',(await snapshot(phone)).active.casts===1);
 await phone.getByRole('button',{name:'暂停',exact:true}).tap();await phone.getByRole('button',{name:'保存并返回首页',exact:true}).tap();await phone.reload();await phone.locator('#boot-status').waitFor({state:'hidden'});await phone.getByRole('button',{name:'继续试炼',exact:true}).tap();await isolate(phone);check('phone reload keeps mirror field and its remaining cooldown',(await snapshot(phone)).active.fields[0]?.kind==='mirror'&&(await snapshot(phone)).active.cooldown>10);
 for(const [blade,name]of [[5,'03-phone-moving-whirlwind'],[7,'04-phone-iai-dash'],[8,'05-phone-falling-blade'],[11,'06-phone-time-rift']]){
  await fresh(phone,blade);await phone.evaluate(()=>{const r=__BLADE__.run;for(let i=0;i<5;i++){const e=r.spawnEnemy('armor',50+i*20,(i%2)*30);e.hp=e.maxHp=100000;e.speed=0;e.cooldown=10000;}});await phone.locator('#active-button').tap();await frame(phone,3);await shot(phone,name);
 }
 for(const size of [{width:320,height:568},{width:740,height:360}]){await phone.setViewportSize(size);await fresh(phone,0);const a=await phone.locator('#active-button').boundingBox(),d=await phone.locator('#dash-button').boundingBox();check(`${size.width}x${size.height}: skill and dash are touch-sized, on screen and separate`,a&&d&&a.width>=44&&a.height>=44&&a.x>=0&&a.y>=0&&a.x+a.width<=size.width&&a.y+a.height<=size.height&&(a.x+a.width<d.x||a.y+a.height<d.y));await phone.locator('#active-button').tap();await frame(phone);check(`${size.width}x${size.height}: native skill tap activates once`,(await snapshot(phone)).active.casts===1);}
 await phone.close();
 const webgl=await browser.newPage({viewport:{width:960,height:640},deviceScaleFactor:1});await boot(webgl,true);await fresh(webgl,4);await webgl.keyboard.press('q');await frame(webgl,50);check('WebGL renders the returning active blade using its actual projectile phase',(await snapshot(webgl)).waves.some(w=>w.boomerang&&w.returning));await shot(webgl,'07-webgl-returning-moon');
 check('all active UI and rendering scenarios have no runtime errors',errors.length===0);metrics.renderers=['desktop Canvas','DPR3 phone Canvas','desktop WebGL'];
 await fs.writeFile(`${out}/results.json`,JSON.stringify({passed:checks.length,checks,errors,metrics,scope:'Real Q, button, multi-touch, pause and reload paths; fixtures choose blades and isolate enemies. Phone viewport is emulated, not a physical device measurement.'},null,2));
}catch(error){for(const c of browser.contexts())for(const p of c.pages())try{await p.screenshot({path:`${out}/failure-${p.viewportSize()?.width}.png`});}catch{}throw error;}finally{await browser.close();}
