import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173/';
const out = 'test-results/blade/item-builds'; await fs.mkdir(out, {recursive: true});
const browser = await chromium.launch({executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const checks = [], errors = [], ids = ['sugarCore','clearLens','clockGrip','bloodFang','bubbleGuard','springBoots'];
const category = id => ['jellyVest','bubbleGuard','honeyCharm','emberPlate','thornArmor'].includes(id) ? 'defense' : ['breezeBoots','springBoots','pickupBoots'].includes(id) ? 'footwear' : 'attack';
const check = (name, ok) => {assert.ok(ok, name); checks.push(name); console.log('PASS', name);};
const snapshot = p => p.evaluate(() => structuredClone(__BLADE__.run.state));
async function frame(p, n = 1) {await p.evaluate(n => {const a = __BLADE__; for (let i = 0; i < n; i++) {a.frame(1/60); a.scene.update(0, 1000/60);} a.ui.render(true);}, n);}
async function boot(p, index, webgl = false) {
  await p.addInitScript(() => {let app; Object.defineProperty(window, '__BLADE__', {configurable: true, get: () => app, set: a => {app = a; a.scene.onFrame = undefined;}});});
  p.on('pageerror', e => errors.push(e.message)); await p.goto(base + '?qa=1' + (webgl ? '&renderer=webgl' : '')); await p.locator('#boot-status').waitFor({state: 'hidden'});
  check(`weapon ${index}: home advertises ten-minute runs with four ordinary weapons`, await p.locator('.rail-blade').count() === 4 && await p.locator('.title-facts').textContent().then(t => t.includes('10')));
  await p.getByRole('button', {name: '开始试炼', exact: true}).click(); await p.locator(`.blade-option[data-value="${index}"]`).click(); await p.locator('[data-action="begin"]').click();
  await p.evaluate(() => {const r = __BLADE__.run; r.state.enemies = []; r.state.spawnBudget = -1e6; r.state.eliteIndex = 4; r.state.invincible = 1000;}); await frame(p, 1);
  check(`weapon ${index}: empty run has no bottom placeholders or old item dock`, await p.locator('.equipment-chip').count() === 0 && !await p.locator('#equipment-dock').isVisible() && await p.locator('#relic-dock').count() === 0);
}
async function fundWithCoins(p, count = 10) {await p.evaluate(n => {const r = __BLADE__.run; for (let i = 0; i < n; i++) r.addOrb(r.state.player.x, r.state.player.y, 100, 'coin');}, count); await frame(p, 16);}
async function buy(p, id) {
  if (!await p.locator('#equipment-shop').isVisible()) await p.locator('#shop-button').click();
  await p.locator(`[data-action="shop-category"][data-value="${category(id)}"]`).click();
  await p.locator(`[data-action="buy-gear"][data-value="${id}"]`).click();
}
try {
  for (const index of [15, 16, 17, 18]) {
    const p = await browser.newPage({viewport: {width: 1100, height: 800}, deviceScaleFactor: 2}); await boot(p, index, index === 17);
    await p.evaluate(() => {const r = __BLADE__.run, e = r.spawnEnemy('elite', 75, 0); e.hp = 1; e.speed = 0; e.cooldown = 1000; r.state.attackTimer = 0;}); await frame(p, 80);
    const dead = await snapshot(p), coin = dead.orbs.find(o => o.kind === 'coin');
    check(`weapon ${index}: actual elite kill drops a guaranteed 25-value coin without remote credit`, dead.eliteKills === 1 && coin?.value === 25 && dead.economy.wallet === 0 && dead.relicDrops.length === 0);
    await p.keyboard.down('d'); await frame(p, 20); await p.keyboard.up('d'); await frame(p, 14);
    check(`weapon ${index}: approaching the dropped coin credits it once`, (await snapshot(p)).economy.earned === 25);
    await fundWithCoins(p);
    check(`weapon ${index}: shop uses a transparent outlined icon with an accessible label`, await p.locator('#shop-button').evaluate(b=>getComputedStyle(b).backgroundColor==='rgba(0, 0, 0, 0)'&&!!b.querySelector('svg[fill="none"]')&&b.getAttribute('aria-label').includes('暂停')) && await p.locator('.wallet-bar').evaluate(b=>getComputedStyle(b).backgroundColor==='rgba(0, 0, 0, 0)'));
    await p.keyboard.down('s'); await frame(p,6); const moving = await snapshot(p); await p.locator('#shop-button').click(); const frozen=await snapshot(p);await frame(p,120);
    check(`weapon ${index}: opening shop freezes the entire simulation and clears held movement`, JSON.stringify(await snapshot(p))===JSON.stringify(frozen) && frozen.time===moving.time && await p.evaluate(() => __BLADE__.battlePaused && __BLADE__.scene.pausedRun && __BLADE__.panel === 'none'));
    await p.keyboard.press('Space');await p.locator('#dash-button').click();await frame(p,30);
    check(`weapon ${index}: neither keyboard nor dash button can queue an action while shopping`,JSON.stringify(await snapshot(p))===JSON.stringify(frozen));
    check(`weapon ${index}: shop has defense, attack, footwear and no random offers`, JSON.stringify(await p.locator('.shop-tabs button').allTextContents()) === JSON.stringify(['防御类','攻击类','足具类']) && await p.locator('.shop-row').count() === 6);
    const prior = await snapshot(p); await buy(p, 'sugarCore'); await frame(p, 6); await p.keyboard.up('s'); await frame(p, 1);
    const bought = await snapshot(p);
    check(`weapon ${index}: buying costs exactly 60 coins while combat stays paused`, bought.economy.wallet === prior.economy.wallet - 60 && bought.player.y === prior.player.y && bought.time === prior.time && bought.economy.gear.sugarCore === 1 && await p.locator('.equipment-chip').count() === 1);
    for (const id of ids.filter(id => id !== 'sugarCore')) await buy(p, id);
    check(`weapon ${index}: six chosen items fill the loadout without unowned placeholders`, await p.locator('.equipment-chip').count() === 6 && JSON.stringify((await snapshot(p)).economy.order) === JSON.stringify(ids));
    await p.selectOption('#build-choice', 'onhit');
    await p.locator('#build-choice').focus();await p.keyboard.press('ArrowDown');
    check(`weapon ${index}: build selector works with arrow keys during the pause`,await p.locator('#build-choice').inputValue()==='sustain'&&(await snapshot(p)).time===prior.time);
    await p.selectOption('#build-choice','onhit');
    check(`weapon ${index}: five recipes explain stat interactions without auto-buying`, await p.locator('#build-choice option').count() === 5 && (await snapshot(p)).economy.order.length === 6 && await p.locator('.build-guide').textContent().then(t => t.includes('六') || t.includes('6/6')));
    await p.locator('[data-action="shop-category"][data-value="attack"]').click();
    check(`weapon ${index}: seventh identity is disabled at six slots`, await p.locator('[data-action="buy-gear"][data-value="stormCoil"]').isDisabled());
    const preSell = await snapshot(p); await p.locator('[data-action="sell-gear"][data-value="clockGrip"]').click();
    check(`weapon ${index}: sell refunds 41 coins and frees a slot immediately`, (await snapshot(p)).economy.wallet === preSell.economy.wallet + 41 && await p.locator('.equipment-chip').count() === 5);
    await buy(p,'stormCoil');
    check(`weapon ${index}: replacing a sold item changes the six owned icons`, await p.locator('.equipment-chip').count() === 6 && (await snapshot(p)).economy.gear.stormCoil === 1 && (await snapshot(p)).economy.gear.clockGrip === 0);
    await p.locator('[data-action="shop-category"][data-value="footwear"]').click();
    check(`weapon ${index}: owned boots can be sold before choosing a different pair`, await p.locator('[data-action="buy-gear"][data-value="pickupBoots"]').isDisabled());
    await p.locator('[data-action="sell-gear"][data-value="springBoots"]').click();
    await buy(p,'pickupBoots');
    check(`weapon ${index}: selling boots permits a real footwear swap without losing the rest of the build`, (await snapshot(p)).economy.gear.springBoots === 0 && (await snapshot(p)).economy.gear.pickupBoots === 1 && await p.locator('.equipment-chip').count() === 6);
    check(`weapon ${index}: shared candy icons load locally at full resolution`, await p.locator('.equipment-chip .gear-icon').evaluateAll(images => images.every(i => i.complete && i.naturalWidth === 128 && i.src.startsWith('data:'))));
    const ds=await p.locator('#equipment-shop').boundingBox(),dd=await p.locator('#dash-button').boundingBox();
    check(`weapon ${index}: shop leaves the complete dash button exposed`,ds.y+ds.height<=dd.y||ds.x+ds.width<=dd.x);
    await p.screenshot({path: `${out}/desktop-shop-${index}.png`});
    await p.keyboard.press('Escape'); check(`weapon ${index}: Escape closes the shop and resumes combat`, !await p.locator('#equipment-shop').isVisible() && await p.evaluate(() => __BLADE__.panel === 'none'));
    const closed=await snapshot(p);await frame(p,12);
    check(`weapon ${index}: closing resumes time without replaying old movement or queued dash`,(await snapshot(p)).time>closed.time&&JSON.stringify((await snapshot(p)).player)===JSON.stringify(closed.player)&&(await snapshot(p)).dashCooldown===closed.dashCooldown&&!await p.evaluate(()=>__BLADE__.battlePaused));
    const stored = await snapshot(p); await p.evaluate(() => __BLADE__.save()); await p.reload(); await p.locator('#boot-status').waitFor({state: 'hidden'}); await p.getByRole('button', {name: '继续试炼', exact: true}).click();
    check(`weapon ${index}: refresh restores exact gold, equipment, drops and RNG`, JSON.stringify(await snapshot(p)) === JSON.stringify(stored) && await p.locator('.equipment-chip').count() === 6);
    await p.keyboard.press('i'); check(`weapon ${index}: owned inventory has three groups and no old set bonuses`, await p.locator('.owned-gear-category').count() === 3 && await p.locator('.owned-gear-category article').count() === 6 && await p.locator('.relic-set-bonuses').count() === 0);
    await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); const paused = await snapshot(p); await frame(p, 30);
    check(`weapon ${index}: explicit pause freezes coins, regen and the combat clock`, JSON.stringify(await snapshot(p)) === JSON.stringify(paused)); await p.close();
  }
  for (const index of [15, 16, 17, 18]) {
    const p = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 3, hasTouch: true, isMobile: true}); await boot(p, index); await fundWithCoins(p, 30);
    const cdp = await p.context().newCDPSession(p), pt = (x, y, id = 1) => ({x, y, id}), send = (type, touchPoints = []) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints});
    const center = async selector => {const r = await p.locator(selector).boundingBox(); return pt(r.x + r.width / 2, r.y + r.height / 2, 2);};
    await send('touchStart', [pt(25, 590)]); const primary = pt(60, 590); await send('touchMove', [primary]); await frame(p, 8);
    const before = await snapshot(p), open = await center('#shop-button'); await send('touchStart', [primary, open]); await send('touchEnd', [open]); await frame(p, 8);
    check(`phone ${index}: second finger opens a paused shop and releases the old joystick`, !await p.locator('#touch-joystick').isVisible() && (await snapshot(p)).time === before.time && JSON.stringify((await snapshot(p)).player)===JSON.stringify(before.player) && await p.locator('#equipment-shop').isVisible());
    const button = await center('[data-action="buy-gear"][data-value="sugarCore"]'), preBuy = await snapshot(p);
    await send('touchStart', [primary, button]);
    // A physical coin added during the pause must stay on the ground until closing.
    await p.evaluate(() => {const r = __BLADE__.run; r.addOrb(r.state.player.x, r.state.player.y, 1, 'coin');}); await frame(p, 16);
    await send('touchEnd', [button]); await frame(p, 8); const postBuy = await snapshot(p);
    check(`phone ${index}: touch purchase works during pause and ground coins stay uncollected`, postBuy.economy.gear.sugarCore === 1 && postBuy.economy.spent === 60 && postBuy.economy.wallet === preBuy.economy.wallet-60 && postBuy.time===preBuy.time && postBuy.player.x === preBuy.player.x && postBuy.orbs.some(o=>o.kind==='coin'&&o.value===1) && !await p.locator('#touch-joystick').isVisible());
    await send('touchEnd'); await frame(p, 1); const stopped = (await snapshot(p)).player; await frame(p, 8);
    check(`phone ${index}: shopping stays stationary after releasing all fingers`, JSON.stringify((await snapshot(p)).player) === JSON.stringify(stopped));
    for (const id of ids.filter(id => id !== 'sugarCore')) await buy(p, id);
    const pausedWallet=(await snapshot(p)).economy.wallet;await p.locator('#shop-button').click();await frame(p,16);
    check(`phone ${index}: closing resumes pickup without reviving the old movement gesture`,(await snapshot(p)).economy.wallet===pausedWallet+1&&JSON.stringify((await snapshot(p)).player)===JSON.stringify(stopped)&&!await p.evaluate(()=>__BLADE__.battlePaused));
    await p.setViewportSize({width:320,height:568}); await frame(p);
    const strip = await p.locator('#equipment-strip').boundingBox();
    await send('touchStart', [pt(strip.x + strip.width - 14, strip.y + strip.height / 2)]);
    for (let i = 1; i <= 6; i++) {await send('touchMove', [pt(strip.x + strip.width - 14 - i * 34, strip.y + strip.height / 2)]); await p.waitForTimeout(35);}
    await send('touchEnd'); await p.waitForTimeout(80);
    check(`phone ${index}: owned-icon strip scrolls with touch without moving the player or opening shop`, await p.locator('#equipment-strip').evaluate(e => e.scrollWidth <= e.clientWidth || e.scrollLeft > 0) && JSON.stringify((await snapshot(p)).player) === JSON.stringify(stopped) && !await p.locator('#equipment-shop').isVisible());
    await p.setViewportSize({width:390,height:844}); await frame(p); await p.screenshot({path: `${out}/phone-equipment-${index}.png`}); await p.locator('#shop-button').click(); await p.screenshot({path: `${out}/phone-shop-${index}.png`});
    for (const size of [{width:390,height:844},{width: 320, height: 568}, {width: 740, height: 360}]) {
      await p.setViewportSize(size); await frame(p, 1); const shop = await p.locator('#equipment-shop').boundingBox(), dash = await p.locator('#dash-button').boundingBox(), dock = await p.locator('#equipment-dock').boundingBox();
      check(`phone ${index} ${size.width}x${size.height}: paused shop, dash and scrolling dock fit on-screen`, shop.x >= 0 && shop.x + shop.width <= size.width && shop.y + shop.height <= size.height && (shop.y+shop.height<=dash.y || shop.x+shop.width<=dash.x) && dash.y + dash.height <= dock.y && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if(size.width===320){await p.locator('[data-action="buy-gear"][data-value="springBoots"]').click();check(`phone ${index}: compact shop can actually upgrade the equipped boots`,(await snapshot(p)).economy.gear.springBoots===2&&await p.evaluate(()=>__BLADE__.panel==='none'));}

    }
    await p.setViewportSize({width: 390, height: 844}); await frame(p); await p.locator('#shop-button').click();
    await send('touchStart', [pt(30, 580)]); const held = pt(62, 580); await send('touchMove', [held]);
    await p.evaluate(() => {__BLADE__.run.state.time = 539.98;}); await frame(p, 5); const finale = await snapshot(p);
    check(`phone ${index}: ninth-minute boss entry preserves the original movement gesture`, finale.bossStarted && finale.time === 540 && finale.mode === 'playing' && await p.locator('#touch-joystick').isVisible());
    await send('touchEnd'); await p.evaluate(() => {const r = __BLADE__.run; r.state.bossTime = 59.98; r.state.attackTimer = 1e6; r.state.swing = null;}); await frame(p, 3);
    check(`phone ${index}: failed finale ends precisely at ten minutes with equipment in results`, (await snapshot(p)).mode === 'dead' && (await snapshot(p)).time + (await snapshot(p)).bossTime === 600 && await p.locator('.result-panel .gear-icon').count() === 6);
    await p.close();
  }
  const legacyPage = await browser.newPage({viewport: {width: 390, height: 844}}); await boot(legacyPage, 17);
  const legacyFixture = await legacyPage.evaluate(() => {
    const a = __BLADE__; a.save(); const data = JSON.parse(localStorage.getItem('blade-evolution-save-v1')), s = data.run;
    data.version = 8; data.meta.bestScore = 8080; s.version = 8; delete s.economy;
    s.time = 180; s.maxHp = 115; s.hp = 80; s.relics.stone = 2; s.relics.heart = 1; s.relicState.heartPeak = 1;
    s.relicLoot.order = ['stone', 'heart']; s.relicDrops = [{id: s.nextId++, x: 200, y: 100, relic: 'crystal', spawn: 0}]; s.orbs = [];
    return data;
  });
  await legacyPage.addInitScript(data => {if(!sessionStorage.getItem('fixture-ready')){localStorage.setItem('blade-evolution-save-v1',JSON.stringify(data));sessionStorage.setItem('fixture-ready','1');}}, legacyFixture);
  await legacyPage.reload(); await legacyPage.locator('#boot-status').waitFor({state: 'hidden'}); await legacyPage.getByRole('button', {name: '继续试炼', exact: true}).click();
  const migrated = await snapshot(legacyPage);
  check('legacy v8: retired carried gear becomes 108 coins while health ratio and permanent score survive', migrated.version === 10 && migrated.economy.wallet === 108 && Math.abs(migrated.hp / migrated.maxHp - 80/115) < 1e-9 && await legacyPage.evaluate(() => __BLADE__.storage.data.meta.bestScore === 8080));
  check('legacy v8: old ground equipment becomes a local coin drop and old combinations are empty', migrated.time === 270 && migrated.orbs.some(o => o.kind === 'coin' && o.x === 200 && o.y === 100 && o.value === 20) && migrated.relicDrops.length === 0 && Object.values(migrated.relics).every(n => n === 0) && await legacyPage.locator('.equipment-chip').count() === 0);
  await buy(legacyPage, 'sugarCore'); await legacyPage.evaluate(() => __BLADE__.save());
  await legacyPage.reload(); await legacyPage.locator('#boot-status').waitFor({state: 'hidden'}); await legacyPage.getByRole('button', {name: '继续试炼', exact: true}).click();
  check('legacy conversion refunds only once and the new purchased equipment survives another load', (await snapshot(legacyPage)).economy.wallet === 48 && (await snapshot(legacyPage)).economy.gear.sugarCore === 1 && await legacyPage.locator('.equipment-chip').count() === 1);
  await legacyPage.close();
  const v9 = await browser.newPage({viewport:{width:390,height:844}}); await boot(v9,15);
  const v9Fixture=await v9.evaluate(()=>{
    __BLADE__.save();const data=JSON.parse(localStorage.getItem('blade-evolution-save-v1')),s=data.run;
    data.version=9;s.version=9;delete s.build;
    s.economy={wallet:200,earned:284,spent:84,gear:{jellyVest:2,bubbleGuard:0,honeyCharm:0,sugarCore:0,clockGrip:0,clearLens:0,breezeBoots:0,springBoots:0,pickupBoots:0},order:['jellyVest'],regen:3};
    s.maxHp=140;s.hp=70;s.time=180;return data;
  });
  await v9.addInitScript(data=>{if(!sessionStorage.getItem('fixture-ready')){localStorage.setItem('blade-evolution-save-v1',JSON.stringify(data));sessionStorage.setItem('fixture-ready','1');}},v9Fixture);
  await v9.reload();await v9.locator('#boot-status').waitFor({state:'hidden'});await v9.getByRole('button',{name:'继续试炼',exact:true}).click();
  const newBuild=await snapshot(v9);
  check('previous nine-item v9: all 84 spent coins are refunded, time and health ratio survive',newBuild.version===10&&newBuild.economy.wallet===284&&newBuild.economy.spent===0&&newBuild.time===180&&newBuild.hp===50&&await v9.locator('.equipment-chip').count()===0);
  await buy(v9,'sugarCore');await v9.evaluate(()=>__BLADE__.save());await v9.reload();await v9.locator('#boot-status').waitFor({state:'hidden'});await v9.getByRole('button',{name:'继续试炼',exact:true}).click();
  check('v9 refund is not repeated after purchasing a new build item and reloading', (await snapshot(v9)).economy.wallet===224&&(await snapshot(v9)).economy.gear.sugarCore===1);await v9.close();
  check('six-slot builds, shop recommendations, selling, paused shopping and mobile input have no runtime errors', errors.length === 0);
  await fs.writeFile(`${out}/results.json`, JSON.stringify({passed: checks.length, checks, errors, artifact: base, scope: 'Native menus, physical coin pickup, paused shop with frozen full snapshots, clean input release and native keyboard selection, real keyboard and CDP multitouch, scrolling, exact saves, continuous boss entry and ten-minute deadline. Stationary enemies, on-player coin funding and timeline-edge fixtures are explicit QA fixtures. Fourteen equipment effects on all four weapons are separately exercised in unit simulation tests.'}, null, 2));
} catch (error) {
  for (const c of browser.contexts()) for (const p of c.pages()) try {await p.screenshot({path: `${out}/failure-${p.viewportSize()?.width}.png`});} catch {}
  throw error;
} finally {await browser.close();}
