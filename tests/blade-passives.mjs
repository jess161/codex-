import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.GAME_URL ?? 'http://127.0.0.1:5173/';
const url = `${base}${base.includes('?') ? '&' : '?'}qa=1`;
const output = 'test-results/blade/passives'; await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const errors = [], checks = [];
const check = (name, result) => { assert.ok(result, name); checks.push(name); console.log('PASS', name); };
const advance = (page, ms) => page.evaluate(ms => window.advanceTime(ms), ms);
const shot = async (page, name) => { await page.waitForTimeout(100); await page.screenshot({ path: `${output}/${name}.png` }); };
const boot = async page => { page.on('pageerror', e => errors.push(e.message)); await page.goto(url, { waitUntil: 'networkidle' }); await page.locator('#boot-status').waitFor({ state: 'hidden' }); };
const names = ['百炼初锋', '袖里藏锋', '井中八法', '逐鹿留痕', '魔刀归圆', '狮吼震岳', '寒魄凝霜', '不负约定', '斩龙遗志', '霸气索取', '万象焚尽', '月牙天冲'];

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }); await boot(page);
  await page.getByRole('button', { name: '刀型图鉴', exact: true }).click();
  check('all twelve blades have distinct passives with a story connection and rules', await page.locator('.codex-passive').evaluateAll(cards => cards.length === 12 && new Set(cards.map(c => c.querySelector('b').textContent)).size === 12 && cards.every(c => c.querySelector('p').textContent.length > 25 && c.querySelector('span').textContent.includes('取意'))));
  await shot(page, '01-archive'); await page.getByRole('button', { name: '返回', exact: true }).click();

  const equip = async tier => page.evaluate(tier => {
    const app = window.__BLADE__; app.selectedBlade = tier; app.start(); app.scene.onFrame = undefined;
    const r = app.run, s = r.state;
    s.enemies = []; s.level = 1; s.invincible = 0; s.attackTimer = 10000; s.spawnBudget = -1000;
    r.step(0, { x: 0, y: 0, dash: false }); app.ui.render(true);
  }, tier);
  const enemy = async (kind = 'armor', x = 75, y = 0, hp = 10000) => page.evaluate(({ kind, x, y, hp }) => {
    const r = window.__BLADE__.run, e = r.spawnEnemy(kind, x, y); e.hp = e.maxHp = hp; e.speed = 0; e.cooldown = 1000; return e.id;
  }, { kind, x, y, hp });
  const strike = async () => page.evaluate(() => {
    const a = window.__BLADE__, r = a.run, s = r.state, stats = r.stats;
    for (const e of s.enemies) e.knockX = e.knockY = 0;
    s.attackTimer = 10000; s.attackCount = 0;
    s.swing = { id: s.nextId++, tier: r.tier, angle: 0, age: stats.windup + stats.strike * .45, windup: stats.windup, strike: stats.strike, recovery: stats.recovery, resolved: false };
    a.advance(16);
  });
  for (let i = 0; i < 12; i++) { await equip(i); check(`${names[i]}: the HUD identifies the current passive`, await page.locator('#passive-name').textContent() === names[i]); }

  await equip(2); await enemy('armor', 55);
  for (let i = 0; i < 7; i++) await strike();
  check('the HUD displays actual eight-form charge progress', (await page.locator('#passive-state').textContent()).includes('7/8'));
  const savedRng = await page.evaluate(() => { const a = window.__BLADE__; a.save(); return a.run.state.rng; });
  await page.reload({ waitUntil: 'networkidle' }); await page.locator('#boot-status').waitFor({ state: 'hidden' }); await page.getByRole('button', { name: '继续试炼', exact: true }).click();
  await page.evaluate(() => { window.__BLADE__.scene.onFrame = undefined; });
  check('reload preserves passive charge and combat RNG', await page.evaluate(rng => window.__BLADE__.run.state.passive.hits === 7 && window.__BLADE__.run.state.rng === rng, savedRng));
  await strike(); check('the next real hit releases all three golden waves', await page.evaluate(() => window.__BLADE__.run.state.waves.filter(w => w.kind === 'moon').length === 3));
  await shot(page, '02-eight-form-waves');

  await equip(4); await enemy('armor', 70); await enemy('armor', -70);
  for (let i = 0; i < 5; i++) await strike();
  check('the circular moon passive reaches enemies behind the hero', await page.evaluate(() => window.__BLADE__.run.state.enemies.find(e => e.x < 0).hp < 10000));
  await shot(page, '03-moon-ring');

  await equip(6); const frozenId = await enemy('armor', 95);
  for (let i = 0; i < 3; i++) await strike();
  check('three hits visibly freeze an ordinary target', await page.evaluate(id => { const e = window.__BLADE__.run.state.enemies.find(e => e.id === id); return e.chillStacks === 3 && e.freeze > .7; }, frozenId));
  await shot(page, '04-frost');
  await page.getByRole('button', { name: '查看当前刀的被动技能', exact: true }).click();
  const status = await page.evaluate(() => JSON.stringify(window.__BLADE__.run.snapshot())); await advance(page, 3000);
  check('clicking a passive opens its own archive card and freezes the whole battle', await page.locator('[data-tier="6"] .codex-passive>b').textContent() === '寒魄凝霜' && await page.locator('.codex-card[data-tier="6"]').evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }) && await page.evaluate(() => JSON.stringify(window.__BLADE__.run.snapshot())) === status);
  await shot(page, '05-contextual-archive');

  await equip(7); await advance(page, 6100);
  check('six safe seconds create a visible, ready guard', await page.evaluate(() => window.__BLADE__.run.state.passive.shield) && await page.locator('#current-passive.ready').count() === 1);
  await shot(page, '06-promise-guard');
  await page.evaluate(() => { const s = window.__BLADE__.run.state; s.invincible = 0; s.bullets.push({ id: s.nextId++, x: s.player.x + 20, y: s.player.y, vx: -100, vy: 0, life: 1 }); });
  await advance(page, 16);
  check('an actual projectile consumes the guard without losing HP', await page.evaluate(() => { const s = window.__BLADE__.run.state; return s.hp === 100 && !s.passive.shield && s.passive.cooldown === 12 && s.bullets.length === 0; }));

  await equip(10); await enemy('blob', 45, 0, 1); const burningId = await enemy('armor', -40);
  await strike();
  check('a fire kill spreads a real burning status to a target outside the melee sector', await page.evaluate(id => { const e = window.__BLADE__.run.state.enemies.find(e => e.id === id); return e.hp === 10000 && e.burnTime === 3 && e.burnDamage > 0; }, burningId));
  await shot(page, '07-burning-chain'); await advance(page, 600);
  check('burning deals damage through the normal combat path', await page.evaluate(id => window.__BLADE__.run.state.enemies.find(e => e.id === id).hp < 10000, burningId));

  await equip(11); await page.keyboard.press(' '); await advance(page, 400);
  check('the real dash key releases a getsuga wave and enables the temporary speed burst', await page.evaluate(() => { const s = window.__BLADE__.run.state; return s.waves.some(w => w.kind === 'getsuga' && w.pierce === 12) && s.passive.haste > 1.7 && s.player.y <= -139; }));
  await shot(page, '08-getsuga'); await page.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await boot(mobile);
  await mobile.getByRole('button', { name: '开始试炼', exact: true }).tap();
  await mobile.locator('.blade-option[data-value="11"]').tap(); await mobile.getByRole('button', { name: '持刀出发', exact: true }).tap();
  await mobile.evaluate(() => { const a = window.__BLADE__, r = a.run; a.scene.onFrame = undefined; r.state.time = 75; r.state.level = 27; r.grantXp(163); }); await advance(mobile, 700);
  check('phone evolution explains the passive and its story before forging', (await mobile.locator('.blade-passive').textContent()).includes('月牙天冲') && (await mobile.locator('.blade-passive').textContent()).includes('黑崎一护'));
  await shot(mobile, '09-mobile-evolution'); await mobile.locator('.forge-card').first().tap();
  check('the phone HUD passive button stays within the playfield edge', await mobile.locator('#current-passive').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top > 80 && r.bottom < 185; }));
  await mobile.getByRole('button', { name: '查看当前刀的被动技能', exact: true }).tap(); await mobile.setViewportSize({ width: 320, height: 568 });
  check('long passive descriptions remain scrollable on a narrow phone', await mobile.locator('.codex-panel').evaluate(el => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= innerWidth) && await mobile.locator('.codex-passive').count() === 12);
  await mobile.locator('[data-tier="9"]').scrollIntoViewIfNeeded(); await shot(mobile, '10-mobile-enma');
  check('all passive effects and interfaces run without browser errors', errors.length === 0);
  await fs.writeFile(`${output}/results.json`, JSON.stringify({ passed: checks.length, checks, errors, fixtures: 'Blade levels, charge counters, isolated encounter spawns and target HP are explicit fixtures. Actual combat, status ticking, keyboard/touch, rendering, save/reload and pause use game code.' }, null, 2));
} catch (error) { console.error(error); console.error(errors); process.exitCode = 1; for (const p of browser.contexts().flatMap(c => c.pages())) { try { await p.screenshot({ path: `${output}/failure.png` }); } catch {} } }
finally { await browser.close(); }
