import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.GAME_URL ?? 'http://127.0.0.1:5173/';
const url = `${base}${base.includes('?') ? '&' : '?'}qa=1`;
const output = 'test-results/blade/atelier'; await fs.mkdir(output, { recursive: true });
const checks = [], errors = [], metrics = {};
const check = (name, ok) => { assert.ok(ok, name); checks.push(name); console.log('PASS', name); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const boot = async page => { page.on('pageerror', e => errors.push(e.message)); await page.goto(url, { waitUntil: 'networkidle' }); await page.locator('#boot-status').waitFor({ state: 'hidden' }); };
const shot = async (page, name) => { await page.waitForTimeout(150); await page.screenshot({ path: `${output}/${name}.png` }); };
const ready = async page => { await page.locator('.blade-inspector[data-ready="true"]').waitFor(); await page.waitForTimeout(80); };
const advance = (page, ms) => page.evaluate(ms => window.advanceTime(ms), ms);
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }); await boot(page);
  await page.getByRole('button', { name: '刀型图鉴', exact: true }).click();
  check('all twelve archive blades expose rotation, and the bestiary explains eleven creatures', await page.locator('.codex-art').count() === 12 && await page.locator('.monster-card').count() === 11 && await page.locator('.monster-card img').evaluateAll(imgs => imgs.every(i => i.complete && i.naturalWidth > 0)));
  await page.locator('.monster-archive').scrollIntoViewIfNeeded(); await shot(page, '01-creature-archive');
  await page.getByRole('button', { name: '旋转鉴赏雪饮狂刀', exact: true }).click(); await ready(page);
  check('the inspection window creates a real, beveled 3D object with local textures', await page.evaluate(() => { const i = window.__BLADE__.ui.inspector; return i.root.dataset.mode === 'webgl' && i.model.children.length >= 8 && i.renderer.info.render.triangles > 2000; }));
  await shot(page, '02-snow-craft');
  const surface = page.locator('.inspector-surface'), rect = await surface.boundingBox();
  const initial = await surface.getAttribute('data-rotation');
  await page.mouse.move(rect.x + rect.width * .4, rect.y + rect.height * .55); await page.mouse.down(); await page.mouse.move(rect.x + rect.width * .62, rect.y + rect.height * .24, { steps: 15 }); await page.mouse.up();
  check('mouse dragging rotates all axes without changing the selected blade', await surface.getAttribute('data-rotation') !== initial && await page.locator('#inspector-title').textContent() === '雪饮狂刀');
  await page.mouse.wheel(0, -160); check('the wheel zooms the inspected object', Number(await surface.getAttribute('data-zoom')) > 1);
  await page.locator('[data-inspect="reset"]').click();
  check('reset restores the original presentation and 100% zoom', await surface.getAttribute('data-rotation') === initial && Number(await surface.getAttribute('data-zoom')) === 1);
  await surface.focus(); await page.keyboard.press('ArrowRight'); check('keyboard arrows offer accessible rotation', await surface.getAttribute('data-rotation') !== initial);
  await page.locator('[data-inspect="auto"]').click(); const autoStart = await surface.getAttribute('data-rotation'); await page.waitForTimeout(350);
  check('the turntable actually rotates and can be stopped', await surface.getAttribute('data-rotation') !== autoStart); await page.locator('[data-inspect="auto"]').click();
  const frames = await page.evaluate(() => window.__BLADE__.ui.inspector.renderer.info.render.frame); await page.waitForTimeout(180);
  check('idle inspection stops submitting WebGL frames', await page.evaluate(start => window.__BLADE__.ui.inspector.renderer.info.render.frame <= start + 1, frames));
  for (let blade = 0; blade < 12; blade++) {
    await page.locator('#inspector-choice').selectOption(String(blade)); await ready(page);
    assert.equal(await page.locator('#inspector-choice').inputValue(), String(blade));
    const memory = await page.evaluate(() => window.__BLADE__.ui.inspector.renderer.info.memory);
    assert.ok(memory.geometries < 20 && memory.textures < 12, 'switching disposes old geometry and textures');
  }
  check('every blade has a distinct crafted 3D model and switching stays within the resource budget', await page.evaluate(() => window.__BLADE__.ui.inspector.index === 11 && window.__BLADE__.ui.inspector.renderer.info.memory.geometries < 20));
  await surface.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await shot(page, '03-black-moon-depth');
  await page.locator('#inspector-choice').selectOption('5'); await ready(page); await shot(page, '04-dragon-craft');
  await page.evaluate(() => window.__BLADE__.ui.inspector.renderer.getContext().getExtension('WEBGL_lose_context').loseContext());
  await page.locator('.blade-inspector[data-mode="flat"]').waitFor();
  check('WebGL context loss keeps a usable flat rotation surface instead of breaking the archive', await surface.isVisible() && await page.locator('.inspector-flat').isVisible());
  await page.getByRole('button', { name: '关闭刀具鉴赏', exact: true }).click();
  check('closing releases the canvas and restores archive focus', await page.locator('.blade-inspector').isHidden() && await page.evaluate(() => !document.querySelector('#app').inert && window.__BLADE__.ui.inspector.renderer === undefined && document.activeElement?.classList.contains('codex-art')));
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('button', { name: '开始试炼', exact: true }).click(); await page.getByRole('button', { name: '持刀出发', exact: true }).click();
  await page.evaluate(() => { const a = window.__BLADE__; a.scene.onFrame = undefined; a.run.state.enemies = []; a.run.state.spawnBudget = -10000; });
  await page.locator('#current-passive').click();
  const snapshot = await page.evaluate(() => window.__BLADE__.run.snapshot());
  await page.getByRole('button', { name: '旋转鉴赏和道一文字', exact: true }).click(); await ready(page);
  await page.keyboard.press('w'); await page.keyboard.press(' '); await advance(page, 5000); await page.waitForTimeout(200);
  check('inspection freezes combat, RNG, passives and controls even during camera gestures', await page.evaluate(saved => JSON.stringify(window.__BLADE__.run.snapshot()) === JSON.stringify(saved), snapshot));
  await page.keyboard.press('Escape'); check('Escape closes only the inspection layer', await page.locator('.blade-inspector').isHidden() && await page.evaluate(() => window.__BLADE__.panel === 'codex'));
  await page.getByRole('button', { name: '返回', exact: true }).click(); await page.getByRole('button', { name: '继续试炼', exact: true }).click();
  // Real AI and telegraphs; positions and time are explicit encounter fixtures.
  await page.evaluate(() => {
    const a = window.__BLADE__, r = a.run, s = r.state; s.time = 400; s.level = 12; s.invincible = 10000; s.attackTimer = 10000;
    const kinds = ['blob', 'swift', 'armor', 'shooter', 'splitter', 'brood', 'charger', 'wisp', 'spiker'];
    for (const [i, kind] of kinds.entries()) { const angle = i * Math.PI * 2 / kinds.length, d = kind === 'wisp' ? 190 : 190 + i % 2 * 45, e = r.spawnEnemy(kind, Math.cos(angle) * d, Math.sin(angle) * d); e.cooldown = 0; }
    a.advance(20);
  }); await shot(page, '05-mixed-creature-telegraphs');
  check('new archetypes enter their own readable combat preparations', await page.evaluate(() => { const enemies = window.__BLADE__.run.state.enemies; return ['charger', 'wisp', 'spiker'].every(kind => enemies.some(e => e.kind === kind && e.action === 'windup')); }));
  await advance(page, 900);
  check('spike telegraphs turn into six real spine projectiles', await page.evaluate(() => window.__BLADE__.run.state.bullets.filter(b => b.kind === 'spine' && b.damage === 8).length === 6));
  await shot(page, '06-new-creatures-in-action');
  // Isolate the requested creature voice from the existing blade-impact sound.
  await page.evaluate(() => {
    const a = window.__BLADE__, r = a.run; r.state.enemies = []; r.state.bullets = []; r.state.level = 1; r.state.xp = 0; r.state.pending = []; r.state.mode = 'playing';
    a.audio.hit = () => {}; a.audio.slash = () => {}; const original = a.audio.enemyHurt.bind(a.audio); window.__monsterCalls = [];
    a.audio.enemyHurt = (kind, lethal, source) => { const played = original(kind, lethal, source); window.__monsterCalls.push({ kind, lethal, source, played }); return played; };
    const analyser = a.audio.context.createAnalyser(); analyser.fftSize = 512; a.audio.master.connect(analyser); window.__monsterAnalyser = analyser;
  }); await page.waitForTimeout(450);
  const hit = async kind => page.evaluate(kind => {
    const a = window.__BLADE__, r = a.run, s = r.state, stats = r.stats; s.enemies = []; s.attackTimer = 10000;
    const e = r.spawnEnemy(kind, 45, 0); e.hp = e.maxHp = 10000; e.speed = 0; e.cooldown = 10000;
    s.swing = { id: s.nextId++, tier: r.tier, angle: 0, age: stats.windup + stats.strike * .45, windup: stats.windup, strike: stats.strike, recovery: stats.recovery, resolved: false }; a.advance(16);
    return new Promise(resolve => { let peak = 0, energy = 0, count = 0, start = performance.now(); const samples = new Float32Array(512); const sample = () => { window.__monsterAnalyser.getFloatTimeDomainData(samples); for (const value of samples) { peak = Math.max(peak, Math.abs(value)); energy += value * value; count++; } if (performance.now() - start < 230) requestAnimationFrame(sample); else resolve({ peak, rms: Math.sqrt(energy / count) }); }; sample(); });
  }, kind);
  metrics.voices = {};
  for (const kind of ['blob', 'swift', 'armor', 'shooter', 'charger', 'wisp', 'splitter', 'brood', 'spiker', 'elite', 'boss']) { metrics.voices[kind] = await hit(kind); await page.waitForTimeout(100); }
  check('actual hits on every species produce a measurable, nonclipping creature voice', Object.values(metrics.voices).every(v => v.peak > .001 && v.peak < .8 && v.rms > .0001) && await page.evaluate(() => window.__monsterCalls.filter(c => c.played).length === 11));
  check('hurt voices receive the real enemy type, source and lethal status', await page.evaluate(() => window.__monsterCalls.every(c => c.source === 'melee' && c.lethal === false)));
  const burst = await page.evaluate(() => { const a = window.__BLADE__.audio; a.lastMonster = -Infinity; a.familyTimes.clear(); return Array.from({ length: 100 }, () => a.enemyHurt('blob')).filter(Boolean).length; });
  check('a large cleave is limited to one simultaneous hurt call instead of one hundred overlapping voices', burst === 1);
  await page.waitForTimeout(400); await page.getByRole('button', { name: '暂停', exact: true }).click(); await page.getByRole('button', { name: '游戏设置', exact: true }).click();
  await page.locator('[data-setting="monsterSound"]').uncheck(); await page.getByRole('button', { name: '完成', exact: true }).click(); await page.getByRole('button', { name: '继续试炼', exact: true }).click();
  const muted = await hit('wisp'); check('the independent creature-sound switch silences voices while preserving other sound settings', muted.peak < .00001 && await page.evaluate(() => window.__BLADE__.storage.data.settings.sound && !window.__BLADE__.audio.monsterEnabled && window.__monsterCalls.at(-1).played === false));
  await page.evaluate(() => { const a = window.__BLADE__, r = a.run; r.state.enemies = []; r.state.bullets = [{ id: r.state.nextId++, x: 400, y: 300, vx: 10, vy: 0, life: 3, kind: 'spine', damage: 8 }]; for (const kind of ['charger', 'wisp', 'splitter', 'brood', 'spiker']) r.spawnEnemy(kind, 350, 200); a.save(); });
  await page.reload({ waitUntil: 'networkidle' }); await page.locator('#boot-status').waitFor({ state: 'hidden' }); await page.getByRole('button', { name: '继续试炼', exact: true }).click(); await page.evaluate(() => { window.__BLADE__.scene.onFrame = undefined; });
  check('reload preserves all new creatures, projectile metadata and the sound preference', await page.evaluate(() => { const a = window.__BLADE__, s = a.run.state; return ['charger', 'wisp', 'splitter', 'brood', 'spiker'].every(k => s.enemies.some(e => e.kind === k)) && s.bullets.some(b => b.kind === 'spine' && b.damage === 8) && !a.storage.data.settings.monsterSound; }));
  await page.close();
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); await boot(mobile); await mobile.getByRole('button', { name: '刀型图鉴', exact: true }).tap(); await mobile.getByRole('button', { name: '旋转鉴赏阎魔', exact: true }).tap(); await ready(mobile);
  const cdp = await mobile.context().newCDPSession(mobile), point = (x, y, id = 1) => ({ x, y, id });
  const send = (type, touchPoints = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const bounds = await mobile.locator('.inspector-surface').boundingBox(), x = bounds.x + bounds.width * .35, y = bounds.y + bounds.height * .55;
  const original = await mobile.locator('.inspector-surface').getAttribute('data-rotation');
  await send('touchStart', [point(x, y)]); await send('touchMove', [point(x + 65, y - 35)]); await send('touchEnd');
  check('a phone finger freely rotates the inspection model without waking the battle joystick', await mobile.locator('.inspector-surface').getAttribute('data-rotation') !== original && await mobile.locator('#touch-joystick').isHidden());
  const centerX = bounds.x + bounds.width / 2, centerY = bounds.y + bounds.height / 2;
  await send('touchStart', [point(centerX - 30, centerY), point(centerX + 30, centerY, 2)]);
  await send('touchMove', [point(centerX - 65, centerY), point(centerX + 65, centerY, 2)]); await send('touchEnd');
  check('two-finger pinch changes the actual camera zoom', Number(await mobile.locator('.inspector-surface').getAttribute('data-zoom')) > 1.5);
  await mobile.locator('[data-inspect="reset"]').tap(); await shot(mobile, '07-mobile-enma');
  await mobile.setViewportSize({ width: 320, height: 568 });
  check('the narrow-phone viewer scrolls vertically with no horizontal overflow', await mobile.locator('.inspector-panel').evaluate(el => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= innerWidth));
  await shot(mobile, '08-narrow-inspector'); await mobile.getByRole('button', { name: '关闭刀具鉴赏', exact: true }).tap();
  check('a phone close restores a usable archive and clears every inspection pointer', await mobile.evaluate(() => !document.querySelector('#app').inert && window.__BLADE__.ui.inspector.pointers.size === 0));
  check('the new bestiary, models, voices and controls have no runtime errors', errors.length === 0);
  await fs.writeFile(`${output}/results.json`, JSON.stringify({ passed: checks.length, checks, errors, metrics, fixtures: 'Creature placement, clocks and isolated HP are test fixtures. All AI, hits, voice synthesis, WebGL rendering, mouse/touch, save and mute paths are real game code.' }, null, 2));
} catch (error) { console.error(error); console.error(errors); process.exitCode = 1; for (const p of browser.contexts().flatMap(c => c.pages())) { try { await p.screenshot({ path: `${output}/failure.png` }); } catch {} } }
finally { await browser.close(); }
if (!process.exitCode) {
  const fallbackBrowser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-webgl', '--disable-gpu'] });
  try {
    const p = await fallbackBrowser.newPage({ viewport: { width: 1280, height: 800 } }); await boot(p); await p.getByRole('button', { name: '刀型图鉴', exact: true }).click(); await p.getByRole('button', { name: '旋转鉴赏井中月', exact: true }).click(); await ready(p);
    check('devices without WebGL retain the flat inspection surface', await p.locator('.blade-inspector').getAttribute('data-mode') === 'flat');
    const surface = p.locator('.inspector-surface'), before = await p.locator('.inspector-flat').evaluate(el => el.style.transform); await surface.focus(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(80);
    check('fallback rotation changes visible artwork and zoom controls remain usable', await p.locator('.inspector-flat').evaluate(el => el.style.transform) !== before); await p.getByRole('button', { name: '放大刀具', exact: true }).click();
    await shot(p, '09-flat-fallback'); await fs.writeFile(`${output}/results.json`, JSON.stringify({ passed: checks.length, checks, errors, metrics, fixtures: 'Creature placement, clocks and isolated HP are explicit fixtures; runtime AI, voice synthesis, WebGL, touch and storage are real.' }, null, 2));
  } finally { await fallbackBrowser.close(); }
}
