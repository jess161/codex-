import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.GAME_URL??'http://127.0.0.1:4174/',out='test-results/blade/build-effects';await fs.mkdir(out,{recursive:true});
const recipes={critical:['sugarCore','clearLens','clockGrip','bloodFang','bubbleGuard','springBoots'],onhit:['clockGrip','tideFang','stormCoil','bloodFang','bubbleGuard','pickupBoots'],sustain:['bloodFang','honeyCharm','clockGrip','jellyVest','bubbleGuard','pickupBoots'],burn:['emberPlate','jellyVest','honeyCharm','bubbleGuard','bloodFang','breezeBoots'],reflect:['thornArmor','jellyVest','honeyCharm','bubbleGuard','bloodFang','breezeBoots']};
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const checks=[],errors=[],seen={};const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
const frame=(p,n)=>p.evaluate(n=>{const a=__BLADE__;for(let i=0;i<n;i++){a.frame(1/60);a.scene.update(0,1000/60);}a.ui.render(true);},n);
try{
 for(const [build,items]of Object.entries(recipes)){
  const p=await browser.newPage({viewport:{width:1100,height:800},deviceScaleFactor:2});p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{let app;Object.defineProperty(window,'__BLADE__',{configurable:true,get:()=>app,set:a=>{app=a;a.scene.onFrame=undefined;}});});
  await p.goto(base+'?qa=1&renderer=webgl');await p.locator('#boot-status').waitFor({state:'hidden'});await p.getByRole('button',{name:'开始试炼',exact:true}).click();await p.locator('[data-action="begin"]').click();
  await p.evaluate(items=>{
   const a=__BLADE__,r=a.run;r.state.enemies=[];r.state.spawnBudget=-1e6;r.state.eliteIndex=4;
   r.state.economy.wallet=r.state.economy.earned=3000;for(const id of items)r.buyGear(id);
   for(let i=0;i<5;i++){const e=r.spawnEnemy(i===0?'boss':'armor',i===0?65:130,i===0?0:(i-2)*45);e.hp=e.maxHp=10000;e.speed=0;e.cooldown=1e6;}
   r.state.hp=20;r.state.invincible=0;window.__PROC_KINDS__=[];
   const original=a.scene.ingest.bind(a.scene);a.scene.ingest=events=>{window.__PROC_KINDS__.push(...events.filter(e=>e.type==='gear-proc').map(e=>e.procKind));original(events);};
   r.events=[];r.damagePlayer(15,'visual fixture');if(r.state.economy.gear.springBoots){r.dash();r.state.dashTime=0;}
   a.scene.ingest(r.events);r.state.attackTimer=0;
  },items);
  await frame(p,230);seen[build]=await p.evaluate(()=>[...new Set(window.__PROC_KINDS__)]);
  check(`${build}: native basic attacks trigger real gear effects`,await p.evaluate(()=>__BLADE__.run.state.attackCount>=4)&&seen[build].includes('leech')&&seen[build].includes('shield'));
  if(build==='onhit')check('onhit: lightning actually renders and heat reaches its cap',seen[build].includes('lightning')&&await p.evaluate(()=>__BLADE__.run.state.build.heat===4));
  if(build==='burn')check('burn: persistent body aura and native pulse damage render',seen[build].includes('aura')&&await p.evaluate(()=>__BLADE__.run.state.enemies.some(e=>e.hp<e.maxHp)));
  if(build==='reflect')check('reflect: receiving damage emits the native reflection effect',seen[build].includes('reflect'));
  if(build==='critical')check('critical: dash charge emits its own native first-hit effect',seen[build].includes('surge'));
  await p.locator('#shop-button').click();
  check(`${build}: six purchased identities appear in the free catalogue without a build preset`,await p.locator('.shop-item.owned').count()===6&&await p.locator('.shop-item').count()===14&&await p.locator('#build-choice,.build-guide').count()===0);
  await p.screenshot({path:`${out}/${build}.png`});await p.close();
 }
 check('all five builds render in WebGL without runtime errors',errors.length===0);
 await fs.writeFile(`${out}/results.json`,JSON.stringify({passed:checks.length,checks,errors,seen,artifact:base,scope:'Five sample equipment combinations and native effect rendering; no build selection in the game. Stationary high-HP enemies, direct coin funding, low player HP and an initial received hit are explicit visual fixtures; ordinary attacks and item triggers then use the game loop.'},null,2));
}finally{await browser.close();}
