import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.GAME_URL ?? 'http://127.0.0.1:5173/';
const url = `${base}${base.includes('?') ? '&' : '?'}qa=1`;
const output = 'test-results/blade/themes'; await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const checks = [], errors = [];
const check = (name, passed) => { assert.ok(passed, name); checks.push(name); console.log('PASS', name); };
const boot = async page => { page.on('pageerror', error => errors.push(error.message)); await page.goto(url, { waitUntil: 'networkidle' }); await page.locator('#boot-status').waitFor({ state: 'hidden' }); };
const shot = async (page, name) => { await page.waitForTimeout(150); await page.screenshot({ path: `${output}/${name}.png` }); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); await boot(page);
  check('a legacy or fresh settings record defaults to the more visible grid', await page.evaluate(() => window.__BLADE__.storage.data.settings.ground === 'grid'));
  await page.getByRole('button', { name: '设置', exact: true }).click();
  check('all six themes are selectable with actual embedded previews', await page.locator('[data-action="ground"]').count() === 6 && await page.locator('.ground-preview img').evaluateAll(images => images.every(i => i.complete && i.naturalWidth > 0 && i.src.startsWith('data:'))));
  await shot(page, '01-selector-desktop');
  await page.getByRole('button', { name: '完成', exact: true }).click(); await page.getByRole('button', { name: '开始试炼', exact: true }).click(); await page.getByRole('button', { name: '持刀出发', exact: true }).click();
  // Representative visual fixture; changing the ground itself must preserve every simulation field.
  await page.evaluate(() => {
    const app = window.__BLADE__, r = app.run; r.state.enemies = []; r.state.level = 25; r.state.time = 130; r.state.invincible = 1000;
    for (const [i, kind] of ['blob', 'swift', 'armor', 'shooter', 'elite', 'blob', 'armor', 'shooter'].entries()) { const angle = i * 2.399, d = 140 + i % 4 * 45; r.spawnEnemy(kind, Math.cos(angle) * d, Math.sin(angle) * d); }
    for (let i = 0; i < 8; i++) r.addOrb(-130 + i * 32, 130 + Math.sin(i) * 20, 3, 'xp');
  });
  for (const id of ['grid', 'meadow', 'dunes', 'ruins', 'night', 'classic']) {
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: '游戏设置', exact: true }).click();
    const before = await page.evaluate(() => JSON.stringify(window.__BLADE__.run.snapshot()));
    await page.locator(`[data-action="ground"][data-value="${id}"]`).click();
    check(`${id}: selection preserves combat state, clocks, drops and RNG`, await page.evaluate(() => JSON.stringify(window.__BLADE__.run.snapshot())) === before);
    check(`${id}: the selected preference is saved and accessible`, await page.locator(`[data-value="${id}"][aria-pressed="true"]`).count() === 1 && await page.evaluate(id => JSON.parse(localStorage.getItem('blade-evolution-save-v1')).settings.ground === id, id));
    await page.getByRole('button', { name: '完成', exact: true }).click(); await page.getByRole('button', { name: '继续试炼', exact: true }).click(); await shot(page, `ground-${id}`);
  }
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: '游戏设置', exact: true }).click(); await page.getByRole('button', { name: '星夜幻境', exact: true }).click();
  await page.reload({ waitUntil: 'networkidle' }); await page.locator('#boot-status').waitFor({ state: 'hidden' }); await page.getByRole('button', { name: '继续试炼', exact: true }).click();
  check('reload restores the chosen ground and the same unfinished run', await page.evaluate(() => window.__BLADE__.run.state.level === 25 && window.__BLADE__.scene.groundTheme === 'night' && document.body.dataset.battleTheme === 'night'));
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: '游戏设置', exact: true }).click(); await page.getByRole('button', { name: '几何训练场', exact: true }).click(); await page.getByRole('button', { name: '完成', exact: true }).click(); await page.getByRole('button', { name: '继续试炼', exact: true }).click();
  const beforeGround = await page.evaluate(() => ({ x: window.__BLADE__.run.state.player.x, pixels: [...window.__BLADE__.game.canvas.getContext('2d').getImageData(30, 180, 160, 160).data] }));
  await page.keyboard.down('d'); await page.waitForTimeout(260); await page.keyboard.up('d'); await page.waitForTimeout(50);
  const afterGround = await page.evaluate(() => ({ x: window.__BLADE__.run.state.player.x, pixels: [...window.__BLADE__.game.canvas.getContext('2d').getImageData(30, 180, 160, 160).data] }));
  check('real movement visibly scrolls the ground with the player-centered camera', afterGround.x > beforeGround.x + 20 && beforeGround.pixels.some((v, i) => Math.abs(v - afterGround.pixels[i]) > 15));
  await page.evaluate(() => { const app = window.__BLADE__; app.save(); const save = JSON.parse(localStorage.getItem('blade-evolution-save-v1')); delete save.settings.ground; localStorage.setItem('blade-evolution-save-v1', JSON.stringify(save)); });
  await page.reload({ waitUntil: 'networkidle' }); await page.locator('#boot-status').waitFor({ state: 'hidden' });
  check('older saves without a theme retain the unfinished run and get a valid default', await page.evaluate(() => window.__BLADE__.storage.data.settings.ground === 'grid' && window.__BLADE__.storage.data.run?.level === 25));
  await page.close();
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await boot(mobile); await mobile.getByRole('button', { name: '设置', exact: true }).tap(); await shot(mobile, '02-selector-mobile');
  await mobile.getByRole('button', { name: '星夜幻境', exact: true }).tap(); await mobile.getByRole('button', { name: '完成', exact: true }).tap(); await mobile.getByRole('button', { name: '开始试炼', exact: true }).tap(); await mobile.getByRole('button', { name: '持刀出发', exact: true }).tap(); await shot(mobile, '04-night-mobile');
  check('touch selection applies the dark theme to the battlefield and HUD', await mobile.evaluate(() => document.body.dataset.battleTheme === 'night' && window.__BLADE__.scene.groundTheme === 'night'));
  await mobile.getByRole('button', { name: '暂停', exact: true }).tap(); await mobile.getByRole('button', { name: '游戏设置', exact: true }).tap(); await mobile.setViewportSize({ width: 320, height: 568 }); await shot(mobile, '03-selector-small');
  check('small-screen settings remain scrollable without horizontal overflow', await mobile.locator('.settings-panel').evaluate(el => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= innerWidth));
  check('theme generation and switching produce no runtime errors', errors.length === 0);
  await fs.writeFile(`${output}/results.json`, JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
} catch (error) { console.error(error); process.exitCode = 1; for (const page of browser.contexts().flatMap(context => context.pages())) { try { await page.screenshot({ path: `${output}/failure.png` }); } catch {} } }
finally { await browser.close(); }
