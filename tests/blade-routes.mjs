import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.GAME_URL ?? 'http://127.0.0.1:5173/';
const url = `${base}${base.includes('?') ? '&' : '?'}qa=1`;
const output = 'test-results/blade/routes'; await fs.mkdir(output, { recursive: true });
const focus = process.env.BLADE_SUITE ?? 'all';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const checks = [], errors = [], metrics = {};
const check = (name, ok) => { assert.ok(ok, name); checks.push(name); console.log('PASS', name); };
const boot = async page => { page.on('pageerror', e => errors.push(e.message)); await page.goto(url, { waitUntil: 'networkidle' }); await page.locator('#boot-status').waitFor({ state: 'hidden' }); };
const advance = (page, ms) => page.evaluate(ms => window.advanceTime(ms), ms);
const shot = async (page, name) => { await page.waitForTimeout(200); await page.screenshot({ path: `${output}/${name}.png` }); };
const prepare = async (page, blade = 6) => page.evaluate(blade => { const a = window.__BLADE__; a.selectedBlade = blade; a.start(); a.scene.onFrame = undefined; a.run.state.enemies = []; a.run.state.spawnBudget = -10000; }, blade);
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }); await boot(page);
  if (focus !== 'weight') {
    check('the title presents parallel styles without a tier or level ranking', await page.locator('.rail-blade').count() === 12 && await page.locator('.rail-blade').evaluateAll(cards => cards.every(c => !/Lv\.|XII|第.+阶/.test(c.textContent))));
    await shot(page, '01-home'); await page.getByRole('button', { name: '开始试炼', exact: true }).click();
    check('all twelve loadouts are selectable immediately with no locked options', await page.locator('.blade-option').count() === 12 && await page.locator('.blade-option:disabled').count() === 0);
    for (let blade = 0; blade < 12; blade++) {
      await page.locator(`.blade-option[data-value="${blade}"]`).click();
      const name = await page.locator('.blade-option.selected>b').textContent();
      check(`${name}: selection shows its story, own passive and five mastery steps`, (await page.locator('.loadout-detail h3').textContent()).includes(name) && (await page.locator('.loadout-passive p').textContent()).length > 25 && await page.locator('.mastery-path>span').count() === 5);
    }
    await page.locator('.blade-option[data-value="6"]').click(); await shot(page, '02-select-snow'); await page.getByRole('button', { name: '持刀出发', exact: true }).click();
    await page.evaluate(() => { window.__BLADE__.scene.onFrame = undefined; window.__BLADE__.run.state.enemies = []; });
    check('the selected blade and its passive are equipped from level one', await page.evaluate(() => { const r = window.__BLADE__.run; return r.state.level === 1 && r.tier === 6 && r.passiveInfo.name === '寒魄凝霜'; }));
    const before = await page.evaluate(() => window.__BLADE__.run.state.player.x);
    await page.keyboard.down('d'); await advance(page, 450); await page.keyboard.up('d'); await page.keyboard.press(' '); await advance(page, 220);
    check('keyboard movement and dash still work with a chosen loadout', await page.evaluate(x => { const s = window.__BLADE__.run.state; return s.player.x > x + 200 && s.dashCooldown > 4; }, before));
    await page.evaluate(() => { const a = window.__BLADE__; a.run.state.spawnBudget = -10000; a.run.grantXp(2770); });
    const stages = [], forgeNames = []; let forgeCount = 0;
    for (let tries = 0; tries < 90; tries++) {
      const status = await page.evaluate(() => { const r = window.__BLADE__.run; return { level: r.state.level, pending: r.state.pending.length, holding: r.holdingXp, mode: r.state.mode, stage: r.mastery }; });
      if (status.level === 30 && !status.pending) break;
      if (status.holding) await page.evaluate(() => { const r = window.__BLADE__.run; r.state.time = r.state.formStartedAt + 75; });
      await advance(page, 1000);
      if (await page.locator('.forge-card').count()) {
        const state = await page.evaluate(() => { const r = window.__BLADE__.run; return { blade: r.tier, stage: r.mastery, awake: r.state.forgeAwakening, clock: r.state.time, rng: r.state.rng }; });
        assert.equal(state.blade, 6); forgeNames.push(await page.locator('.forge-heading h2').textContent());
        if (state.awake) { stages.push(state.stage); if (state.stage === 3) await shot(page, '03-snow-resonance'); }
        if (forgeCount === 0) {
          const saved = await page.evaluate(() => { const a = window.__BLADE__; a.save(); return a.run.snapshot(); });
          await advance(page, 10000);
          check('forge freezes the world and does not consume stored XP or reroll choices', await page.evaluate(snapshot => JSON.stringify(window.__BLADE__.run.snapshot()) === JSON.stringify(snapshot), saved));
          await page.reload({ waitUntil: 'networkidle' }); await page.locator('#boot-status').waitFor({ state: 'hidden' }); await page.getByRole('button', { name: '继续试炼', exact: true }).click(); await page.evaluate(() => { window.__BLADE__.scene.onFrame = undefined; });
          check('reload restores the chosen blade, banked XP and exact forge choices', await page.evaluate(snapshot => JSON.stringify(window.__BLADE__.run.snapshot()) === JSON.stringify(snapshot), saved));
        }
        await page.locator('[data-action="forge-tab"][data-value="shape"]').click();
        await page.locator('.forge-card').first().click(); forgeCount++;
      }
    }
    check('the same named blade survives all 29 upgrades and four mastery transitions', forgeCount === 29 && stages.join(',') === '1,2,3,4' && forgeNames.every(n => n.includes('雪饮狂刀')) && await page.evaluate(() => window.__BLADE__.run.state.level === 30 && window.__BLADE__.run.tier === 6));
    check('the HUD has five mastery marks instead of a twelve-blade ladder', await page.locator('#tier-pips>i').count() === 5 && (await page.locator('#current-tier').textContent()).includes('觉醒'));
    await page.locator('#current-passive').click();
    check('the archive explains every independent mastery route with no locked cards', await page.locator('.codex-card').count() === 12 && await page.locator('.codex-growth>div').count() === 60 && await page.locator('.codex-card.undiscovered').count() === 0 && !(await page.locator('.codex-grid').textContent()).includes('抵达 Lv.'));
    await shot(page, '04-independent-archive');
    await page.getByRole('button', { name: '返回', exact: true }).click(); await page.getByRole('button', { name: '继续试炼', exact: true }).click();
    // Restore a real old-format browser save, including permanent collection and cosmetics.
    await prepare(page, 2);
    const legacyData = await page.evaluate(() => {
      const a = window.__BLADE__, r = a.run; r.state.level = 5; r.state.time = 60; r.state.passive.hits = 7; r.state.perks.long = 3;
      const legacy = structuredClone(a.storage.data); legacy.version = 4; legacy.run = r.snapshot(); legacy.run.version = 4;
      delete legacy.run.blade; delete legacy.run.forgeAwakening;
      legacy.meta.maxTier = 11; delete legacy.meta.seenBlades; legacy.meta.achievements = ['divine']; legacy.meta.runs = 7; legacy.meta.bestScore = 8888;
      legacy.settings.ground = 'night'; legacy.settings.color = 1;
      return JSON.stringify(legacy);
    });
    const legacyPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await legacyPage.addInitScript(data => localStorage.setItem('blade-evolution-save-v1', data), legacyData); await boot(legacyPage);
    await legacyPage.getByRole('button', { name: '继续试炼', exact: true }).click();
    await legacyPage.evaluate(() => { window.__BLADE__.scene.onFrame = undefined; });
    check('v4 browser saves keep the current blade, partial charge, collection, skin and records', await legacyPage.evaluate(() => {
      const a = window.__BLADE__, r = a.run, m = a.storage.data.meta, s = a.storage.data.settings;
      return r.tier === 2 && r.mastery === 0 && r.state.passive.hits === 7 && r.state.perks.long === 3 && m.maxTier === 4 && m.seenBlades.length === 12 && m.achievements.includes('divine') && m.bestScore === 8888 && s.color === 1 && s.ground === 'night';
    }));
    await legacyPage.close();
  }
  if (focus !== 'growth') {
    await prepare(page, 5);
    // Deliberately large, explicitly labeled art/combat fixture; not a normal progression result.
    await page.evaluate(() => { const a = window.__BLADE__, r = a.run, s = r.state; s.level = 30; s.time = 540; s.invincible = 1000; Object.assign(s.perks, { long: 7, broad: 7, giant: 6, hollow: 3, grip: 2, magnet: 2 }); for (let i = 0; i < 240; i++) { const angle = i * 2.399963, d = 100 + i % 16 * 22; const e = r.spawnEnemy(i % 6 === 0 ? 'armor' : 'blob', Math.cos(angle) * d, Math.sin(angle) * d); e.spawn = 0; } a.ui.render(true); });
    await shot(page, '05-giant-horde-before');
    const oldKills = await page.evaluate(() => window.__BLADE__.run.state.kills);
    await page.evaluate(() => { const a = window.__BLADE__; a.scene.onFrame = delta => a.frame(delta); });
    metrics.crowd = await page.evaluate(() => new Promise(resolve => { let frames = 0, first = performance.now(); const frame = now => { frames++; if (now - first < 1500) requestAnimationFrame(frame); else resolve({ frames, duration: now - first, monsters: window.__BLADE__.run.state.enemies.length, kills: window.__BLADE__.run.state.kills }); }; requestAnimationFrame(frame); }));
    await page.evaluate(() => { window.__BLADE__.scene.onFrame = undefined; });
    check('the late giant blade actually clears dense monsters through normal combat', metrics.crowd.kills > oldKills + 35 && await page.evaluate(() => { const s = window.__BLADE__.run.stats; return s.range > 350 && s.widthScale > 6; }));
    check('the dense Canvas scene keeps a responsive frame cadence', metrics.crowd.frames / metrics.crowd.duration * 1000 >= 30);
    await shot(page, '06-giant-horde-cleave');
    await page.evaluate(() => { const a = window.__BLADE__, r = a.run, s = r.state; s.attackTimer = 0; s.swing = null; const e = r.spawnEnemy('armor', s.player.x + 80, s.player.y); e.hp = e.maxHp = 10000; e.speed = 0; }); await advance(page, 100); await page.waitForTimeout(100);
    check('the heavy attack still displays a visible effort expression', await page.evaluate(() => window.__BLADE__.scene.effortLevel > .3));
    await shot(page, '07-heavy-effort');
    await page.evaluate(() => { const a = window.__BLADE__, s = a.run.state; s.mode = 'forge'; s.level = 29; s.pending = [29]; s.choices = ['long', 'grip', 'sharp']; a.ui.render(true); });
    await page.locator('[data-action="forge-tab"][data-value="handling"]').click();
    const dimensions = await page.evaluate(() => { const r = window.__BLADE__.run; return { stats: r.stats, rng: r.state.rng, perks: { ...r.state.perks } }; });
    check('directed handling offers the raised reduction, grip and footwork caps', await page.locator('.forge-card').count() === 3 && (await page.locator('[data-action="forge"][data-value="hollow"]').textContent()).includes('/ 10 层'));
    await page.locator('[data-action="forge"][data-value="hollow"]').click();
    check('choosing reduction changes real mass while retaining exaggerated reach, width and damage', await page.evaluate(before => { const r = window.__BLADE__.run, after = r.stats; return r.state.perks.hollow === before.perks.hollow + 1 && Math.abs(after.mass / before.stats.mass - .86) < .00001 && after.range === before.stats.range && after.widthScale === before.stats.widthScale && after.damage === before.stats.damage && r.state.rng === before.rng; }, dimensions));
    await page.evaluate(() => { const a = window.__BLADE__; a.run.state.enemies = []; a.save(); });
    const saved = await page.evaluate(() => window.__BLADE__.run.snapshot());
    await page.reload({ waitUntil: 'networkidle' }); await page.locator('#boot-status').waitFor({ state: 'hidden' }); await page.getByRole('button', { name: '继续试炼', exact: true }).click(); await page.evaluate(() => { window.__BLADE__.scene.onFrame = undefined; });
    check('high forge stacks and the same blade survive save and reload', await page.evaluate(snapshot => { const s = window.__BLADE__.run.state; return s.blade === snapshot.blade && JSON.stringify(s.perks) === JSON.stringify(snapshot.perks); }, saved));
    const scale = await page.evaluate(() => { const a = window.__BLADE__, b = a.scene.blade; return { x: b.scaleX, y: b.scaleY, reach: Math.hypot(b.x - a.run.state.player.x, b.y - a.run.state.player.y) + b.displayWidth, grip: a.scene.hilt.displayWidth, readable: a.scene.hero.depth > b.depth, stats: a.run.stats }; });
    check('blade artwork stretches length and width independently to match physical reach', Math.abs(scale.reach - scale.stats.range) < .01 && scale.y > .5 && scale.grip < 30 && scale.readable);
    // A real input-only comparison under identical target-free conditions.
    const walk = async heavy => { await prepare(page, 0); await page.evaluate(heavy => { if (heavy) Object.assign(window.__BLADE__.run.state.perks, { long: 8, broad: 7, giant: 6 }); }, heavy); await page.keyboard.down('d'); await advance(page, 450); await page.keyboard.up('d'); const x = await page.evaluate(() => window.__BLADE__.run.state.player.x); await advance(page, 150); assert.equal(await page.evaluate(() => window.__BLADE__.run.state.player.x), x); return x; };
    const light = await walk(false), heavy = await walk(true); check('larger knives alter movement and releasing controls always stops immediately', heavy < light * .85);
    await prepare(page, 6); await page.evaluate(() => { const a = window.__BLADE__, r = a.run; r.state.time = 590; r.state.spawnBudget = 0; r.state.attackTimer = 10000; r.view = { width: 20000, height: 20000 }; }); await advance(page, 500);
    check('the late campaign generates more monsters per second than the old final-minute pace', await page.evaluate(() => window.__BLADE__.run.state.enemies.length >= 6));
    // Boss telegraph and terminal-result paths remain real; target HP is a fixture.
    await prepare(page, 8); await page.evaluate(() => { const a = window.__BLADE__, r = a.run; r.state.time = 599.99; r.state.level = 28; r.state.invincible = 1000; }); await advance(page, 50);
    check('the boss still enters after the full survival clock', await page.evaluate(() => window.__BLADE__.run.state.mode === 'boss-intro'));
    await advance(page, 1150); await page.evaluate(() => { const a = window.__BLADE__, r = a.run, e = r.state.enemies.find(e => e.kind === 'boss'); e.x = r.state.player.x + 80; e.y = r.state.player.y; e.hp = 1; e.speed = 0; r.state.attackTimer = 0; }); await advance(page, 600);
    check('victory retains the selected blade and its mastery in the result panel', await page.evaluate(() => window.__BLADE__.run.state.mode === 'won') && (await page.locator('.result-weapon').textContent()).includes('秋水') && !(await page.locator('.reset-note').textContent()).includes('小刀'));
  }
  await page.close();
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await boot(mobile);
  await mobile.getByRole('button', { name: '开始试炼', exact: true }).tap(); await mobile.locator('.blade-option[data-value="10"]').tap();
  check('phone selection supports all twelve styles without horizontal overflow', await mobile.locator('.loadout-panel').evaluate(el => el.scrollWidth <= el.clientWidth) && await mobile.locator('.blade-option').count() === 12);
  await shot(mobile, '08-mobile-selection'); await mobile.getByRole('button', { name: '持刀出发', exact: true }).tap();
  check('phone taps equip the selected fire blade exactly once', await mobile.evaluate(() => window.__BLADE__.run?.tier === 10 && window.__BLADE__.panel === 'none'));
  await mobile.evaluate(() => { const a = window.__BLADE__; a.scene.onFrame = undefined; a.run.state.enemies = []; a.run.state.spawnBudget = -10000; a.run.grantXp(19); }); await advance(mobile, 300);
  await mobile.locator('[data-action="forge-tab"][data-value="shape"]').tap();
  check('phone shaping exposes length, width and giant options with their new caps', await mobile.locator('.forge-card').count() === 3 && (await mobile.locator('.forge-cards').textContent()).includes('/ 12 层') && (await mobile.locator('.forge-cards').textContent()).includes('/ 10 层') && (await mobile.locator('.forge-cards').textContent()).includes('/ 8 层'));
  await shot(mobile, '09-mobile-shaping'); await mobile.locator('[data-action="forge"][data-value="giant"]').tap();
  check('a phone forge tap applies one upgrade and resumes normal play', await mobile.evaluate(() => window.__BLADE__.run.state.perks.giant === 1 && window.__BLADE__.run.state.mode === 'playing'));
  await mobile.evaluate(() => { const a = window.__BLADE__, r = a.run; r.state.level = 28; r.state.time = 540; r.state.invincible = 1000; Object.assign(r.state.perks, { long: 7, broad: 6, giant: 6, hollow: 4, grip: 3 }); for (let i = 0; i < 170; i++) { const angle = i * 2.399963, d = 100 + i % 14 * 28; r.spawnEnemy('blob', Math.cos(angle) * d, Math.sin(angle) * d); } a.ui.render(true); }); await advance(mobile, 450); await shot(mobile, '10-mobile-awakened-horde');
  await mobile.getByRole('button', { name: '暂停', exact: true }).tap(); await mobile.getByRole('button', { name: '重新开始', exact: true }).tap();
  await mobile.locator('.blade-option[data-value="7"]').tap(); await mobile.setViewportSize({ width: 320, height: 568 });
  check('narrow-phone selection remains scrollable with its departure button reachable', await mobile.locator('.loadout-panel').evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight > el.clientHeight) && await mobile.getByRole('button', { name: '持刀出发', exact: true }).isVisible());
  await shot(mobile, '11-narrow-selection'); await mobile.getByRole('button', { name: '返回', exact: true }).tap();
  check('canceling a new loadout preserves the active blade and run', await mobile.evaluate(() => window.__BLADE__.panel === 'pause' && window.__BLADE__.run.tier === 10));
  check('all route, combat and responsive flows run without browser errors', errors.length === 0);
  await fs.writeFile(`${output}/${focus}-results.json`, JSON.stringify({ passed: checks.length, checks, errors, metrics, fixtures: 'Explicit XP, clock, perk and target fixtures exercise UI/combat boundaries; seeded unit campaigns verify normal-action reachability.' }, null, 2));
} catch (error) { console.error(error); console.error(errors); process.exitCode = 1; for (const p of browser.contexts().flatMap(c => c.pages())) { try { await p.screenshot({ path: `${output}/failure.png` }); } catch {} } }
finally { await browser.close(); }
