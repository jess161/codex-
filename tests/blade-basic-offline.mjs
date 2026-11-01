import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const file = path.resolve('dist/blade-evolution.html'), out = 'test-results/blade/basic-offline';
await fs.mkdir(out, {recursive: true});
const browser = await chromium.launch({executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']});
const checks = [], errors = [], remoteRequests = [];
const offlineUrl = 'http://127.0.0.1:4174/embedded-offline.html', document = await fs.readFile(file);
// Supply only the local HTML bytes in memory. Network stays disabled for all assets
// and reloads; this environment's browser policy disallows file:// navigation.
const check = (name, ok) => {assert.ok(ok, name); checks.push(name); console.log('PASS', name);};
try {
  for (const [index, name] of [[15, '刀'], [16, '剑'], [17, '弓'], [18, '矛']]) {
    const context = await browser.newContext({offline: true, viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
    const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('request', r => {if (/^https?:/.test(r.url()) && r.url() !== offlineUrl) remoteRequests.push(r.url());});
    await p.route('**/*', route => route.request().url() === offlineUrl ? route.fulfill({contentType: 'text/html', body: document}) : route.abort());
    await p.goto(offlineUrl); await p.locator('#boot-status').waitFor({state: 'hidden'});
    check(`offline ${name}: production game exposes no QA controller`, await p.evaluate(() => window.__BLADE__ === undefined));
    await p.getByRole('button', {name: '开始试炼', exact: true}).click();
    check(`offline ${name}: four choices load without network`, await p.locator('.blade-option').count() === 4);
    await p.locator(`.blade-option[data-value="${index}"]`).click();
    for (const width of [320, 390]) {
      await p.setViewportSize({width, height: 844});
      check(`offline ${name} ${width}px: start label fits on one line`, await p.locator('[data-action="begin"]').evaluate(button => {
        const node = [...button.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
        const range = document.createRange(); range.selectNodeContents(node);
        return range.getClientRects().length === 1 && button.scrollWidth <= button.clientWidth;
      }));
    }
    await p.locator('[data-action="begin"]').click();
    check(`offline ${name}: correct weapon starts and old skill button stays hidden`, await p.locator('#current-name').textContent() === name && !await p.locator('#active-button').isVisible());
    await p.locator('#shop-button').click();
    check(`offline ${name}: all eighteen icon-and-name items load without build presets`, await p.locator('.shop-tabs button').count() === 4 && await p.locator('#build-choice,.build-guide').count() === 0 && await p.locator('.shop-item .gear-icon').evaluateAll(images => images.length === 18 && images.every(i => i.complete && i.naturalWidth === 128)));
    await p.locator('[data-action="shop-category"][data-value="defense"]').click();
    await p.locator('.shop-item[data-value="jellyVest"]').click();
    check(`offline ${name}: paused shop requires actual coins to buy`,await p.locator('.buy-gear').count()===1 && await p.locator('.buy-gear').evaluateAll(buttons => buttons.every(b => b.disabled)) && await p.locator('#clock-goal').textContent() === '/ 10:00');
    const frozen = await p.evaluate(() => render_game_to_text());
    await p.locator('#equipment-shop').focus();await p.keyboard.press('Space');await p.waitForTimeout(900);
    check(`offline ${name}: shop freezes combat and rejects queued dash without a QA controller`, await p.evaluate(() => render_game_to_text()) === frozen && JSON.parse(frozen).battlePaused === true);
    await p.locator('[data-shop-resume]').click();
    await p.keyboard.down('w'); await p.waitForTimeout(1200); await p.keyboard.up('w');
    check(`offline ${name}: real game clock advances`, await p.locator('#clock').textContent() !== '00:00');
    await p.getByRole('button', {name: '暂停', exact: true}).click(); const clock = await p.locator('#clock').textContent();
    await p.getByRole('button', {name: '保存并返回首页', exact: true}).click(); await p.reload(); await p.locator('#boot-status').waitFor({state: 'hidden'});
    await p.getByRole('button', {name: '继续试炼', exact: true}).click();
    check(`offline ${name}: same weapon and clock survive refresh`, await p.locator('#current-name').textContent() === name && await p.locator('#clock').textContent() === clock);
    if (name === '弓') await p.screenshot({path: `${out}/bow-phone.png`});
    await context.close();
  }
  check('offline HTML has no remote requests or runtime errors', errors.length === 0 && remoteRequests.length === 0);
  const bytes = await fs.readFile(file);
  await fs.writeFile(`${out}/results.json`, JSON.stringify({passed: checks.length, checks, errors, remoteRequests, file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')}, null, 2));
} finally {await browser.close();}
