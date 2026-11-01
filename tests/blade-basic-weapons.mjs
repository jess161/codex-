import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173/';
const out = 'test-results/blade/basic-weapons';
await fs.mkdir(out, {recursive: true});
const browser = await chromium.launch({executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const checks = [], errors = [];
const check = (name, ok) => {assert.ok(ok, name); checks.push(name); console.log('PASS', name);};
const snapshot = p => p.evaluate(() => structuredClone(__BLADE__.run.state));
async function frame(p, n = 1) {await p.evaluate(n => {const a = __BLADE__; for (let i = 0; i < n; i++) {a.frame(1 / 60); a.scene.update(0, 1000 / 60);} a.ui.render(true);}, n);}
async function boot(p, index, webgl = false) {
  await p.addInitScript(() => {let app; Object.defineProperty(window, '__BLADE__', {configurable: true, get: () => app, set: a => {app = a; a.scene.onFrame = undefined;}});});
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(base + (base.includes('?') ? '&' : '?') + 'qa=1' + (webgl ? '&renderer=webgl' : ''));
  await p.locator('#boot-status').waitFor({state: 'hidden'});
  check(`weapon ${index}: home offers four plain weapons`, await p.locator('.rail-blade').count() === 4 && await p.locator('.title-facts').textContent().then(t => t.includes('4') && t.includes('基础武器')));
  await p.getByRole('button', {name: '开始试炼', exact: true}).click();
  check(`weapon ${index}: selection has exactly knife, sword, bow, spear`, JSON.stringify(await p.locator('.blade-option>b').allTextContents()) === JSON.stringify(['刀', '剑', '弓', '矛']));
  await p.locator(`.blade-option[data-value="${index}"]`).click();
  check(`weapon ${index}: selection explains basic attack without old skill panels`, await p.locator('.loadout-detail').textContent().then(t => t.includes(['横扫', '快斩', '自动射击', '直刺'][index - 15]) && !/名刀|绝招|技能树/.test(t)) && await p.locator('.active-description').count() === 0);
  await p.screenshot({path: `${out}/selection-${index}-${p.viewportSize().width}.png`});
  await p.locator('[data-action="begin"]').click();
  await p.evaluate(index => {
    const r = __BLADE__.run, s = r.state;
    s.enemies = []; s.invincible = 1000; s.spawnBudget = -100000; s.eliteIndex = 4; s.attackTimer = 0;
    for (const [x, y] of index === 17 ? [[180, 0], [240, 50]] : [[55, 0], [100, 0], [75, 55]]) {const e = r.spawnEnemy('armor', x, y); e.hp = e.maxHp = 10000; e.speed = 0; e.cooldown = 10000;}
  }, index);
  await frame(p, 2);
}
try {
  for (const index of (process.env.BASIC_TEST_SECTION === 'phone' ? [] : [15, 16, 17, 18])) {
    const p = await browser.newPage({viewport: {width: 1100, height: 800}, deviceScaleFactor: 2});
    await boot(p, index, index >= 17);
    check(`weapon ${index}: no active-skill control is exposed`, !await p.locator('#active-button').isVisible() && await p.locator('.desktop-controls').textContent().then(t => !t.includes('绝招')));
    await frame(p, 90);
    const fought = await snapshot(p);
    check(`weapon ${index}: automatic basic attack deals real damage`, fought.attackCount > 0 && fought.enemies.some(e => e.hp < e.maxHp));
    check(`weapon ${index}: plain combat sprite uses its own shared artwork`, await p.evaluate(i => {const a = __BLADE__, image = a.scene.liveSprites.get(i === 17 ? 'held-bow' : 'basic-weapon'); return image?.texture.key === (i === 17 ? 'bow-limbs-18' : `blade-${i + 1}`) && image.visible && !a.scene.blade.visible && !a.scene.hilt.visible;}, index));
    await p.keyboard.press('q'); await frame(p, 1);
    check(`weapon ${index}: Q cannot trigger a retired special attack`, (await snapshot(p)).active.casts === 0);
    await p.keyboard.down('s'); await frame(p, 18); await p.keyboard.up('s');
    check(`weapon ${index}: normal keyboard movement works during attacks`, (await snapshot(p)).player.y > fought.player.y + 10);
    await p.evaluate(() => {const r = __BLADE__.run; for (const id of ['ruler', 'anvil', 'hourglass']) {const d = r.addRelicDrop(id, r.state.player.x, r.state.player.y); d.spawn = 0;}});
    await frame(p, 2);
    check(`weapon ${index}: world item pickup and dock remain continuous`, await p.locator('.relic-chip').count() === 3 && (await snapshot(p)).mode === 'playing');
    await p.screenshot({path: `${out}/battle-${index}.png`});
    const stored = await snapshot(p); await p.evaluate(() => __BLADE__.save());
    await p.reload(); await p.locator('#boot-status').waitFor({state: 'hidden'}); await p.getByRole('button', {name: '继续试炼', exact: true}).click();
    const restored = await snapshot(p);
    check(`weapon ${index}: reload exactly preserves basic attack, items and random streams`, JSON.stringify(restored) === JSON.stringify(stored));
    await p.keyboard.press('i'); check(`weapon ${index}: inventory stays available`, await p.locator('.relic-inventory').isVisible()); await p.keyboard.press('Escape');
    await p.keyboard.press('Escape'); await p.getByRole('button', {name: '武器图鉴', exact: true}).click();
    check(`weapon ${index}: archive has only four basics and no old variants`, await p.locator('.codex-card').count() === 4 && await p.locator('.codex-panel').textContent().then(t => !/屠龙|玄铁|疾风短弓|霜月长弓|焰星重弓|技能树|主动绝招/.test(t)));
    await p.locator(`.codex-card[data-tier="${index}"] .codex-art`).click(); await p.waitForFunction(() => document.querySelector('.blade-inspector')?.dataset.ready === 'true');
    check(`weapon ${index}: inspection opens shared artwork and only four selectable models`, await p.locator('#inspector-choice option').count() === 4 && await p.locator('.inspector-flat').evaluate(i => i.complete && i.naturalWidth > 0));
    await p.screenshot({path: `${out}/inspector-${index}.png`});
    await p.locator('[data-inspect="next"]').click(); await p.waitForFunction(() => document.querySelector('.blade-inspector')?.dataset.ready === 'true');
    check(`weapon ${index}: inspector cycles exclusively through four basics`, await p.locator('#inspector-choice').inputValue() === String(index === 18 ? 15 : index + 1));
    await p.close();
  }
  for (const index of (process.env.BASIC_TEST_SECTION === 'desktop' ? [] : [15, 16, 17, 18])) {
    const p = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true});
    await boot(p, index);
    const cdp = await p.context().newCDPSession(p), point = (x, y, id = 1) => ({x, y, id}), send = (type, touchPoints = []) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints});
    await send('touchStart', [point(60, 430)]); const primary = point(103, 430); await send('touchMove', [primary]); await frame(p, 12);
    const before = await snapshot(p), d = await p.locator('#dash-button').boundingBox(), secondary = point(d.x + d.width / 2, d.y + d.height / 2, 2);
    await send('touchStart', [primary, secondary]); await send('touchEnd', [secondary]); await frame(p, 15);
    const dashed = await snapshot(p);
    check(`phone ${index}: second-finger dash preserves held movement`, dashed.dashCooldown > 0 && dashed.player.x > before.player.x + 100 && await p.locator('#touch-joystick').isVisible());
    await p.evaluate(() => {const r = __BLADE__.run, d = r.addRelicDrop('ruler', r.state.player.x, r.state.player.y); d.spawn = 0;}); await frame(p, 2);
    check(`phone ${index}: touching loot does not interrupt movement`, await p.locator('#touch-joystick').isVisible() && await p.locator('.relic-chip').count() === 1);
    await send('touchEnd'); await frame(p, 1); const stopped = (await snapshot(p)).player; await frame(p, 10);
    check(`phone ${index}: releasing joystick stops immediately`, JSON.stringify((await snapshot(p)).player) === JSON.stringify(stopped));
    check(`phone ${index}: crisp DPR3 canvas and hidden old skill control`, await p.evaluate(() => __BLADE__.game.canvas.width === 1170 && __BLADE__.game.canvas.height === 2532) && !await p.locator('#active-button').isVisible());
    await p.screenshot({path: `${out}/phone-${index}.png`});
    for (const size of [{width: 320, height: 568}, {width: 740, height: 360}]) {
      await p.setViewportSize(size); await frame(p); const dash = await p.locator('#dash-button').boundingBox(), dock = await p.locator('#relic-dock').boundingBox();
      check(`phone ${index} ${size.width}x${size.height}: controls fit clear of item dock`, dash.width >= 44 && dash.y >= 0 && dash.x + dash.width <= size.width && dock.y >= dash.y + dash.height && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await p.locator('[data-action="pause"]').click(); const paused = await snapshot(p); await frame(p, 20);
    check(`phone ${index}: pause freezes the full game state`, JSON.stringify(await snapshot(p)) === JSON.stringify(paused));
    await p.close();
  }
  const p = await browser.newPage({viewport: {width: 390, height: 844}}); await boot(p, 17);
  const legacyFixture = await p.evaluate(() => {
    const a = __BLADE__; a.save(); const s = JSON.parse(localStorage.getItem('blade-evolution-save-v1'));
    s.settings.blade = 13; s.run.blade = 13; s.run.passive.tier = 13; s.run.swing = null;
    s.meta.seenBlades = [0, 7, 12, 13, 14]; s.meta.bestScore = 1234;
    return s;
  });
  await p.addInitScript(s => localStorage.setItem('blade-evolution-save-v1', JSON.stringify(s)), legacyFixture);
  await p.reload(); await p.locator('#boot-status').waitFor({state: 'hidden'});
  check('legacy save: home maps old bow and records to the plain catalogue', await p.locator('.rail-blade').count() === 4 && await p.evaluate(() => __BLADE__.selectedBlade === 17 && __BLADE__.storage.data.meta.bestScore === 1234));
  await p.getByRole('button', {name: '继续试炼', exact: true}).click();
  check('legacy save: continuation uses plain bow with no retired powers', (await snapshot(p)).blade === 17 && (await snapshot(p)).passive.tier === 17 && !await p.locator('#active-button').isVisible());
  await p.close();
  check('all four weapons render in Canvas, WebGL and mobile without runtime errors', errors.length === 0);
  await fs.writeFile(`${out}/results.json`, JSON.stringify({passed: checks.length, checks, errors, artifact: base, scope: 'Keyboard, CDP multitouch, native menus, world pickups, exact saves and 3D/fallback inspection. Stationary high-HP enemies and on-player item drops are explicit fixtures. Mobile is Chromium emulation, not a physical-device benchmark.'}, null, 2));
} catch (error) {
  for (const c of browser.contexts()) for (const p of c.pages()) try {await p.screenshot({path: `${out}/failure-${p.viewportSize()?.width}.png`});} catch {}
  throw error;
} finally {await browser.close();}
