import { it, expect } from 'vitest';
import { BladeRun } from '../src/blade/simulation';
import { GAME_DURATION, MIN_FORM_TIME, TIERS, xpToLevel } from '../src/blade/config';

// An input-only bot completes the real campaign without changing HP, damage, XP or clocks.
// This verifies reachability and deterministic long-run behavior, not human difficulty.
it.each(TIERS.map((blade, i) => [i, blade.name] as const))('completes a full campaign with parallel blade %i · %s', async (blade) => {
  await new Promise(resolve => setTimeout(resolve, 0));
  const seed = blade + 1, r = new BladeRun(seed, undefined, blade);
  let forgeChoices = 0; const formTimes: number[] = [];
  for (let tick = 0; tick < 45000; tick++) {
    const s = r.state;
    if (s.mode === 'relic') {
      const preference = ['magnet', 'star', 'stone', 'ruler', 'anvil', 'feather', 'hourglass', 'heart', 'thunder', 'crystal', 'ember', 'bell'];
      const choice = s.choices.map((perk, index) => ({ index, rank: preference.indexOf(perk) })).sort((a, b) => a.rank - b.rank)[0];
      if (s.forgeAwakening) formTimes.push(s.time + s.bossTime); r.chooseRelic(choice.index); forgeChoices++; continue;
    }
    if (s.mode === 'won' || s.mode === 'dead') break;
    const distance = (p: { x: number; y: number }) => Math.hypot(p.x - s.player.x, p.y - s.player.y);
    const enemies = s.enemies.filter(e => e.spawn <= 0 && e.hp > 0).sort((a, b) => distance(a) - distance(b));
    const orbs = [...s.orbs].sort((a, b) => distance(a) - distance(b));
    const target = orbs.find(o => o.kind === 'heal' && s.hp < s.maxHp - 10) ?? orbs[0] ?? enemies[0] ?? { x: 0, y: -160 };
    let dx = target.x - s.player.x, dy = target.y - s.player.y;
    const norm = Math.hypot(dx, dy) || 1; dx /= norm; dy /= norm;
    let dash = false;
    const attackRange = r.stats.range;
    for (const e of enemies) {
      const ex = s.player.x - e.x, ey = s.player.y - e.y, d = Math.hypot(ex, ey) || 1, safe = Math.min(attackRange + e.radius - 8, 165) * 1.36;
      if (d < safe) { const force = (safe - d) / safe * 3.8; dx += ex / d * force; dy += ey / d * force; }
      if (e.action === 'windup' && (e.kind === 'elite' || e.kind === 'boss')) {
        const cross = Math.abs((s.player.x - e.x) * Math.sin(e.angle) - (s.player.y - e.y) * Math.cos(e.angle));
        if (cross < e.radius + 28) { dx = -Math.sin(e.angle); dy = Math.cos(e.angle); dash = s.dashCooldown <= 0 && e.timer < .25; }
      }
    }
    for (const b of s.bullets) {
      const ex = s.player.x - b.x, ey = s.player.y - b.y, d = Math.hypot(ex, ey) || 1;
      if (d < 90) { dx += ex / d * (90 - d) / 90 * 3; dy += ey / d * (90 - d) / 90 * 3; }
    }
    if (enemies[0] && distance(enemies[0]) < enemies[0].radius + 20) dash = s.dashCooldown <= 0;
    const length = Math.hypot(dx, dy) || 1;
    r.step(1 / 60, { x: dx / length, y: dy / length, dash });
  }
  expect(r.state.mode, JSON.stringify({ seed, time: r.state.time, hp: r.state.hp, level: r.state.level, bossTime: r.state.bossTime, perks: r.state.perks })).toBe('won'); expect(r.state.time).toBe(GAME_DURATION);
  // Winning does not require max level in the slower mode; collecting well can reach every form.
  expect(r.state.level).toBeGreaterThanOrEqual(20); expect(forgeChoices).toBe(r.state.level - 1); expect(r.tier).toBe(blade);
  if (blade === 0) { expect(r.state.level).toBe(30); expect(forgeChoices).toBe(29); }
  expect(r.state.bossTime).toBeLessThan(90); expect(r.state.totalXp).toBeGreaterThanOrEqual(xpToLevel(r.state.level));
  expect(r.state.enemies.length).toBeLessThanOrEqual(280);
  expect(formTimes[0]).toBeGreaterThanOrEqual(MIN_FORM_TIME - .01);
  formTimes.slice(1).forEach((time, i) => expect(time - formTimes[i]).toBeGreaterThanOrEqual(MIN_FORM_TIME - .01));
}, 30000);
