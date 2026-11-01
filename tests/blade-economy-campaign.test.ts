import { it, expect } from 'vitest';
import { BladeRun } from '../src/blade/simulation';
import { BASIC_WEAPON_INDICES, TIERS, xpToLevel } from '../src/blade/config';

import { BUILDS, GEAR_CAP, gearPrice, validEconomy, type GearId } from '../src/blade/gear';

// An input-only bot completes the real campaign without changing HP, damage, XP or clocks.
// This verifies reachability and deterministic long-run behavior, not human difficulty.
it.each(BASIC_WEAPON_INDICES.flatMap(i => Object.entries(BUILDS).map(([build,recipe]) => [i, TIERS[i].name, build, recipe.items] as const)))('completes weapon %i · %s with %s build', async (blade, _name, build, recipe) => {
  await new Promise(resolve => setTimeout(resolve, 0));
  const seed = blade + 1, r = new BladeRun(seed, undefined, blade);
  let lastMastery=0; const formTimes: number[] = [];
  for (let tick = 0; tick < 37000; tick++) {
    const s = r.state;
    const economy = s.economy!;
    const plan: readonly GearId[] = recipe;
    const lowest = Math.min(...plan.map(id=>economy.gear[id]));
    const next = plan.find(id => economy.gear[id] === lowest && lowest < GEAR_CAP);
    if (next && economy.wallet >= gearPrice(next, economy.gear[next])) r.buyGear(next);
    if(r.mastery!==lastMastery){lastMastery=r.mastery;formTimes.push(s.time+s.bossTime);}
    if (s.mode === 'won' || s.mode === 'dead') break;
    const distance = (p: { x: number; y: number }) => Math.hypot(p.x - s.player.x, p.y - s.player.y);
    const enemies = s.enemies.filter(e => e.spawn <= 0 && e.hp > 0).sort((a, b) => distance(a) - distance(b));
    const orbs = s.orbs.filter(o=>o.kind==='xp'||o.kind==='coin'||s.hp<s.maxHp-5).sort((a, b) => distance(a) - distance(b));
    const loot=[...s.relicDrops].sort((a,b)=>distance(a)-distance(b)).find(d=>distance(d)<700);
    const target = orbs.find(o=>o.kind==='heal'&&s.hp<s.maxHp*.65) ?? (s.bossStarted?undefined:loot) ?? (s.bossStarted ? enemies.find(e=>e.kind==='boss') : undefined) ?? orbs.find(o=>o.kind==='heal'&&s.hp<s.maxHp-10) ?? orbs[0] ?? enemies[0] ?? { x: 0, y: -160 };
    let dx = target.x - s.player.x, dy = target.y - s.player.y;
    const norm = Math.hypot(dx, dy) || 1; dx /= norm; dy /= norm;
    let dash = false;
    const attackRange = r.stats.range;
    for (const e of enemies) {
      const ex = s.player.x - e.x, ey = s.player.y - e.y, d = Math.hypot(ex, ey) || 1, safe = Math.min(attackRange + e.radius - 20, 120) * (s.hp<s.maxHp*.6?1.2:1.04);
      if (d < safe) { const force = (safe - d) / safe * 3.8; dx += ex / d * force; dy += ey / d * force; }
      if (e.action === 'windup' && (e.kind === 'elite' || e.kind === 'boss')) {
        const cross = Math.abs((s.player.x - e.x) * Math.sin(e.angle) - (s.player.y - e.y) * Math.cos(e.angle));
        if (cross < e.radius + 28) { dx = -Math.sin(e.angle); dy = Math.cos(e.angle); dash = s.dashCooldown <= 0 && e.timer < .25; }
      }
    }
    // Avoid the three reconstructed threats using only movement and dash input.
    for(const h of s.hazards??[]) if(h.kind==='poison') {
      const ex=s.player.x-h.x,ey=s.player.y-h.y,d=Math.hypot(ex,ey)||1,safe=h.radius+38;
      if(d<safe) { dx+=(ex/d||1)*(safe-d)/safe*5; dy+=ey/d*(safe-d)/safe*5; }
    }
    for(const e of enemies) if(e.action==='windup' && (e.kind==='poison'||e.kind==='bomber'||e.kind==='stalker')) {
      if(e.kind==='stalker') { const cross=Math.abs((s.player.x-e.x)*Math.sin(e.angle)-(s.player.y-e.y)*Math.cos(e.angle)); if(cross<34) {dx=-Math.sin(e.angle);dy=Math.cos(e.angle);} }
      else { const x=e.kind==='poison'?e.targetX:e.x,y=e.kind==='poison'?e.targetY:e.y,ex=s.player.x-x,ey=s.player.y-y,d=Math.hypot(ex,ey)||1; if(d<110) {dx+=(ex/d||1)*4;dy+=ey/d*4;dash=s.dashCooldown<=0&&e.timer<.25;} }
    }
    for (const b of s.bullets) {
      const ex = s.player.x - b.x, ey = s.player.y - b.y, d = Math.hypot(ex, ey) || 1;
      if (d < 90) { dx += ex / d * (90 - d) / 90 * 3; dy += ey / d * (90 - d) / 90 * 3; }
    }
    if (enemies[0] && distance(enemies[0]) < enemies[0].radius + 20) dash = s.dashCooldown <= 0;
    const length = Math.hypot(dx, dy) || 1;
    // Use the same manual activation action as Q/touch; no timer or cooldown overrides.
    const active = r.active.cooldown<=0 && !!enemies[0] && distance(enemies[0])<Math.max(160,r.stats.range*1.4);
    r.step(1 / 60, { x: dx / length, y: dy / length, dash });
  }
  expect(r.state.mode, JSON.stringify({ seed, time: r.state.time, hp: r.state.hp, maxHp:r.state.maxHp, level: r.state.level, bossTime: r.state.bossTime, failure:r.state.failure, economy:r.state.economy, equipment:r.stats })).toBe('won'); expect(r.state.time).toBe(540); expect(r.state.time+r.state.bossTime).toBeLessThanOrEqual(600);
  // Winning does not require max level in the slower mode; collecting well can reach every form.
  expect(r.state.level).toBeGreaterThanOrEqual(20); expect(r.state.pending).toEqual([]);expect(r.state.choices).toEqual([]); expect(r.tier).toBe(blade);
  expect(r.state.bossTime).toBeLessThan(r.bossDuration); expect(r.state.totalXp).toBeGreaterThanOrEqual(xpToLevel(r.state.level));
  expect(r.state.enemies.length).toBeLessThanOrEqual(280);
  if (r.hasActiveSkill) expect(r.active.casts).toBeGreaterThan(10); else expect(r.active.casts).toBe(0);expect(r.state.economy!.earned).toBeGreaterThan(100); expect(r.gearOrder).toHaveLength(6); expect(validEconomy(r.state.economy)).toBe(true); expect(r.state.relicDrops).toEqual([]);
  expect(formTimes[0]).toBeGreaterThanOrEqual(r.practiceTime - .01);
  formTimes.slice(1).forEach((time, i) => expect(time - formTimes[i]).toBeGreaterThanOrEqual(r.practiceTime - .01));
  if((globalThis as unknown as {process?:{env?:Record<string,string>}}).process?.env?.BLADE_CAMPAIGN_METRICS)console.info('CAMPAIGN_METRICS '+JSON.stringify({blade:TIERS[blade].name,build,time:r.state.time+r.state.bossTime,level:r.state.level,kills:r.state.kills,earned:r.state.economy!.earned,spent:r.state.economy!.spent,wallet:r.state.economy!.wallet,owned:r.gearOrder.length,gear:r.state.economy!.gear,casts:r.active.casts,mode:r.state.mode}));
}, 30000);
