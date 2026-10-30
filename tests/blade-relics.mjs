import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173/';
const output = 'test-results/blade/relics'; await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const checks = [], errors = [], metrics = {};
const check = (name, ok) => { assert.ok(ok, name); checks.push(name); console.log('PASS', name); };
const boot = async (page, webgl = false) => {
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}${base.includes('?') ? '&' : '?'}qa=1${webgl ? '&renderer=webgl' : ''}`);
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '开始试炼', exact: true }).click();
  await page.getByRole('button', { name: '持刀出发', exact: true }).click();
  await isolate(page);
};
const isolate = page => page.evaluate(() => {
  const a = window.__BLADE__; a.scene.onFrame = undefined;
  a.run.state.enemies = []; a.run.state.spawnBudget = -100000; a.run.state.attackTimer = 10000;
});
const advance = (page, n = 1) => page.evaluate(n => {
  const a = window.__BLADE__; for (let i = 0; i < n; i++) { a.frame(1 / 60); a.scene.update(0, 1000 / 60); } a.ui.render(true);
}, n);
// Most UI cases declare one offered item to avoid probabilistic waiting. Selection always uses native input.
const offer = async (page, id) => {
  await page.evaluate(id => {
    const a = window.__BLADE__, r = a.run, s = r.state;
    s.level++; s.pending = [s.level]; s.mode = 'evolving'; s.evolutionTime = .01; s.forgeAwakening = false;
    const ids = r.availableRelics;
    s.choices = id ? [id, ...ids.filter(key => key !== id).slice(0, 2)] : ids.slice(0, 3);
    a.clearInputs();
  }, id);
  await advance(page, 2);
};
const pick = async (page, id, touch = false) => {
  await offer(page, id);
  const card = page.locator(`.relic-card[data-value="${id}"]`);
  if (touch) await card.tap(); else await card.click();
};
const snap = page => page.evaluate(() => structuredClone(window.__BLADE__.run.state));
const screenshot = async (page, name) => { await page.waitForTimeout(60); await page.screenshot({ path: `${output}/${name}.png` }); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 }); await boot(page);
  // First choice comes through the actual XP threshold and evolution countdown, not the offer fixture.
  await page.evaluate(() => window.__BLADE__.run.grantXp(19)); await advance(page, 20);
  check('a real XP level-up opens exactly three passive-item cards', await page.locator('.relic-card').count() === 3 && (await snap(page)).mode === 'relic');
  check('the old forging cards, tabs and actions have been removed', await page.locator('.forge-card,.forge-tabs,[data-action="forge"],[data-action="forge-tab"]').count() === 0);
  check('three offers have distinct IDs and contain clear group, rank and actual-effect previews', await page.locator('.relic-card').evaluateAll(cards => new Set(cards.map(c => c.dataset.value)).size === 3 && cards.every(c => c.querySelector('.relic-group-tag').textContent && c.querySelector('.relic-rank').textContent && c.querySelector('.relic-preview').textContent)));
  check('generated collectible icons are sharp embedded images with real source pixels', await page.locator('.relic-card img').evaluateAll(images => images.length === 3 && images.every(i => i.complete && i.naturalWidth === 384 && i.src.startsWith('data:'))));
  const frozen = JSON.stringify(await snap(page)); await page.keyboard.down('d'); await advance(page, 120); await page.keyboard.up('d');
  check('movement, monsters, world timers and RNG remain frozen during selection', JSON.stringify(await snap(page)) === frozen);
  await page.keyboard.press('4'); await page.keyboard.press('6');
  check('only keys one through three can choose an item', JSON.stringify(await snap(page)) === frozen);
  const offered = (await snap(page)).choices;
  await page.evaluate(() => { const a = window.__BLADE__; a.action('forge', 'sharp'); const other = a.run.availableRelics.find(id => !a.run.state.choices.includes(id)); a.action('relic', other); });
  check('stale forge actions and unoffered item requests cannot bypass three choices', JSON.stringify(await snap(page)) === frozen);
  await screenshot(page, '01-desktop-three-choices');
  await page.keyboard.press('2');
  check('a native number-key choice grants one item and immediately resumes play', (await snap(page)).mode === 'playing' && (await snap(page)).relics[offered[1]] === 1 && (await snap(page)).pending.length === 0);
  const ranks = (await snap(page)).relics; await page.keyboard.press('2');
  check('a repeated selection cannot spend the same upgrade twice', JSON.stringify((await snap(page)).relics) === JSON.stringify(ranks));
  const start = (await snap(page)).player.x; await page.keyboard.down('d'); await advance(page, 30); await page.keyboard.up('d');
  check('movement resumes normally with a fresh input after the item choice', (await snap(page)).player.x > start + 20);

  await pick(page, 'heart'); await offer(page, 'ruler');
  await page.evaluate(() => window.__BLADE__.save()); const saved = await snap(page);
  await page.reload(); await page.locator('#boot-status').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '继续试炼', exact: true }).click(); await isolate(page);
  const restored = await snap(page);
  check('saving and reloading restores the exact offered IDs and RNG without rerolling', JSON.stringify(restored.choices) === JSON.stringify(saved.choices) && restored.rng === saved.rng);
  check('item levels and maximum health survive a full browser reload', JSON.stringify(restored.relics) === JSON.stringify(saved.relics) && restored.maxHp === saved.maxHp);
  await page.locator('.relic-card[data-value="ruler"]').click();

  const ids = ['stone','ruler','anvil','feather','bell','hourglass','ember','crystal','thunder','heart','magnet','star'];
  for (const id of ids) {
    const oldRank = (await snap(page)).relics[id]; await pick(page, id);
    check(`${id}: a real card click grants exactly one rank`, (await snap(page)).relics[id] === oldRank + 1 && (await snap(page)).mode === 'playing');
  }
  const beforeBag = JSON.stringify(await snap(page));
  await page.getByRole('button', { name: '查看被动道具', exact: true }).click(); await advance(page, 30);
  check('the inventory pauses combat without changing the world state', JSON.stringify(await snap(page)) === beforeBag);
  check('all twelve collectible icons and four distinct families are visible in the inventory', await page.locator('.relic-owned.collected').count() === 12 && await page.locator('.relic-family').count() === 4 && await page.locator('.relic-icon').evaluateAll(images => images.length === 12 && images.every(i => i.complete && i.naturalWidth === 384)));
  check('two-piece and three-piece bonuses activate from distinct collected items', await page.locator('.relic-set-bonuses .active').count() === 8);
  await screenshot(page, '02-desktop-collections'); await page.keyboard.press('Escape');
  check('escaping the inventory returns to the same running game', await page.evaluate(() => window.__BLADE__.panel === 'none') && (await snap(page)).mode === 'playing');
  while ((await snap(page)).relics.stone < 4) await pick(page, 'stone');
  await page.evaluate(() => { const a = window.__BLADE__; a.run.state.relicState.shield = false; a.run.state.relicState.shieldCooldown = 12.5; a.run.state.relicState.lightning = 2; a.save(); });
  check('maxed-out items disappear from the native candidate pool', await page.evaluate(() => !window.__BLADE__.run.availableRelics.includes('stone')));
  const charged = await snap(page); await page.reload(); await page.locator('#boot-status').waitFor({ state: 'hidden' }); await page.getByRole('button', { name: '继续试炼', exact: true }).click(); await isolate(page);
  const resumed = await snap(page);
  check('reloading keeps partial lightning charge and a recovering shield instead of resetting them', resumed.relicState.lightning === charged.relicState.lightning && resumed.relicState.shieldCooldown <= charged.relicState.shieldCooldown && resumed.relicState.shieldCooldown > 12 && !resumed.relicState.shield);
  metrics.desktop = { ranks: resumed.relics, maxHp: resumed.maxHp, relicState: resumed.relicState };

  await page.evaluate(() => { const a = window.__BLADE__; a.selectedBlade = 11; a.start(); }); await isolate(page);
  await page.keyboard.press(' '); await advance(page, 12);
  check('the native Tensa dash supplies a real temporary haste state for item previews', (await snap(page)).passive.haste > 0);
  for (const id of ['hourglass', 'bell']) {
    await offer(page, id); const before = await page.evaluate(id => { const a = window.__BLADE__; return id === 'hourglass' ? a.run.stats.interval.toFixed(2) : String(Math.round(a.run.stats.moveSpeed)); }, id);
    const preview = await page.locator(`.relic-card[data-value="${id}"] .relic-preview`).textContent();
    await page.locator(`.relic-card[data-value="${id}"]`).click();
    const after = await page.evaluate(id => { const a = window.__BLADE__; return id === 'hourglass' ? a.run.stats.interval.toFixed(2) : String(Math.round(a.run.stats.moveSpeed)); }, id);
    check(`${id}: its preview matches the actual before/after stats while temporary haste is active`, preview.includes(`${before} → ${after}`));
  }

  await pick(page, 'heart'); await pick(page, 'magnet');
  await page.evaluate(() => { const s = window.__BLADE__.run.state; s.hp = 50; s.time = 599.99; }); await advance(page);
  check('the healing combination also improves native boss-entry recovery', (await snap(page)).mode === 'boss-intro' && (await snap(page)).hp === 68);

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }); await boot(phone); await offer(phone, 'stone');
  check('phone cards remain a three-choice list with usable touch targets and no page overflow', await phone.locator('.relic-card').count() === 3 && await phone.locator('.relic-card').evaluateAll(cards => cards.every(c => { const r = c.getBoundingClientRect(); return r.width >= 300 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth; })) && await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await screenshot(phone, '03-phone-three-choices');
  await phone.locator('.relic-card[data-value="stone"]').tap();
  check('one real touch grants one rank and does not click through to another action', (await snap(phone)).relics.stone === 1 && (await snap(phone)).mode === 'playing' && await phone.locator('#touch-joystick').isHidden());
  await pick(phone, 'ruler', true); const long = await phone.evaluate(() => window.__BLADE__.run.stats);
  await pick(phone, 'anvil', true); const wide = await phone.evaluate(() => window.__BLADE__.run.stats);
  await pick(phone, 'feather', true); const light = await phone.evaluate(() => window.__BLADE__.run.stats);
  check('phone item choices change real blade size and weight without shrinking the lightened blade', wide.widthScale > long.widthScale && light.range === wide.range && light.widthScale === wide.widthScale && Math.abs(light.mass / wide.mass - .86) < .001);
  await phone.setViewportSize({ width: 844, height: 390 }); await offer(phone, 'bell');
  await phone.locator('.relic-card').last().scrollIntoViewIfNeeded();
  check('landscape keeps the third choice reachable inside a scrollable panel', await phone.locator('.relic-card').last().evaluate(node => { const r = node.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }) && await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await screenshot(phone, '04-phone-landscape'); await phone.locator('.relic-card').last().tap();
  await phone.setViewportSize({ width: 360, height: 640 }); await offer(phone, 'heart');
  await phone.locator('.relic-card').last().scrollIntoViewIfNeeded();
  check('small phones keep the last card tappable without clipping its effect text', await phone.locator('.relic-card').last().evaluate(node => { const r = node.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }) && await phone.locator('.relic-preview').evaluateAll(nodes => nodes.every(n => n.scrollWidth <= n.clientWidth + 1)));
  await screenshot(phone, '05-small-phone'); await phone.locator('.relic-card').last().tap(); await phone.close();

  const effects = await browser.newPage({ viewport: { width: 1000, height: 720 } }); await boot(effects, true);
  for (const id of ['ember','crystal','thunder']) await pick(effects, id);
  const combat = await effects.evaluate(() => {
    const a = window.__BLADE__, r = a.run, s = r.state; s.relicState.lightning = 5; s.aim = 0;
    for (const [x,y] of [[45,0],[120,55],[205,65]]) { const e = r.spawnEnemy('armor',x,y); e.hp = e.maxHp = 1000; e.speed = 0; e.cooldown = 1000; }
    const stats = r.stats; s.swing = { id: s.nextId++, tier: r.tier, angle: 0, age: stats.windup + stats.strike * .45, windup: stats.windup, strike: stats.strike, recovery: stats.recovery, resolved: false };
    a.frame(1/60); a.scene.update(0,1000/60); a.scene.pausedRun = true;
    return { renderer: a.game.renderer.type, targets: s.enemies.map(e => ({ hp:e.hp,burn:e.burnTime,slow:e.slowTime })), links:a.scene.relicFx.length, charge:s.relicState.lightning };
  });
  check('a native strike applies real burn and slow and releases a bounded lightning chain', combat.targets[0].hp < 1000 && combat.targets[0].burn > 0 && combat.targets[0].slow > 0 && combat.links === 3 && combat.charge === 0);
  check('WebGL renders the item combat effects without changing renderer support', combat.renderer === 2);
  metrics.combat = combat; await screenshot(effects, '06-webgl-item-combat');
  check('desktop, reload, keyboard, touch, small screens and WebGL have no runtime errors', errors.length === 0);
  await fs.writeFile(`${output}/results.json`, JSON.stringify({ passed:checks.length, checks, metrics, errors, fixtures:'The first level uses the native XP threshold. Subsequent UI cases declare exact offers and use real clicks, keys and touch. Combat declares stationary high-HP targets and a partially charged relic; strike resolution is native. These fixtures do not claim physical-device performance or human difficulty.' }, null, 2));
} catch (error) {
  for (const context of browser.contexts()) for (const page of context.pages()) try { await page.screenshot({ path: `${output}/failure-${page.viewportSize()?.width}.png` }); } catch {}
  throw error;
} finally { await browser.close(); }
