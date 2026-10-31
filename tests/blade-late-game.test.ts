import { describe, it, expect } from 'vitest';
import { BladeRun, restoreSnapshot, validSnapshot } from '../src/blade/simulation';
import { ENEMIES, MAX_LEVEL, encounterDensity, lateGameDifficulty, xpNext, type EnemyKind } from '../src/blade/config';
const idle = { x: 0, y: 0, dash: false };
function run(level: number, time = 300) {
  const r = new BladeRun(717); const s = r.state;
  s.level = level; s.time = time; s.enemies = []; s.spawnBudget = -100000; s.attackTimer = 100000; s.invincible = 1000;
  s.eliteIndex = Math.min(4, Math.floor(time / (r.duration/5))); return r;
}
function step(r: BladeRun, n = 1) { for (let i = 0; i < n; i++) r.step(1 / 60, idle); }

describe('difficulty after level twenty', () => {
  it.each([1,10,19,20])('keeps the existing pressure at level %i', level => {
    expect(lateGameDifficulty(level)).toEqual({progress:0,enemyHealth:1,eliteHealth:1,bossHealth:1,speed:1,spawnRate:1});
    for (const time of [0,300,590]) expect(encounterDensity(time,false,level)).toEqual(encounterDensity(time));
  });
  it('ramps smoothly from level 21 through 30 and stops growing above the level cap', () => {
    let previous = lateGameDifficulty(20);
    for (let level = 21; level <= MAX_LEVEL; level++) {
      const current = lateGameDifficulty(level);
      for (const key of ['enemyHealth','eliteHealth','bossHealth','speed','spawnRate'] as const) expect(current[key]).toBeGreaterThan(previous[key]);
      expect(current.enemyHealth - previous.enemyHealth).toBeCloseTo(.06); previous = current;
    }
    expect(lateGameDifficulty(21).enemyHealth).toBeCloseTo(1.06);
    expect(lateGameDifficulty(25).enemyHealth).toBeCloseTo(1.30);
    expect(lateGameDifficulty(30)).toEqual({progress:1,enemyHealth:1.6,eliteHealth:1.45,bossHealth:1.35,speed:1.08,spawnRate:1.25});
    expect(lateGameDifficulty(40)).toEqual(previous);
  });
  it.each(['blob','armor','swift','poison','bomber','stalker'] as EnemyKind[])('%s gets stronger only when born at a higher level', kind => {
    const low = run(20), high = run(30); const a = low.spawnEnemy(kind,300,0), b = high.spawnEnemy(kind,300,0);
    expect(b.hp/a.hp).toBeCloseTo(1.6); expect(b.speed/a.speed).toBeCloseTo(1.08);
    expect(b.maxHp).toBe(b.hp); expect(b.damage).toBe(a.damage); expect(b.xp).toBe(ENEMIES[kind].xp);
    expect(b.cooldown).toBe(a.cooldown); expect(b.radius).toBe(a.radius);
  });
  it('strengthens all four elite waves on their original schedule', () => {
    const r=run(30);
    for (const [index,hp] of [420,1000,1800,2800].entries()) {
      r.state.eliteIndex=index+1;expect(r.spawnEnemy('elite',300,0).maxHp).toBeCloseTo(hp*1.45*.65);
    }
  });
  it('starts the native boss battle with the new level-based HP while preserving scattered XP', () => {
    const low=run(20,599.99), high=run(30,599.99);
    for (const r of [low,high]) {r.addOrb(900,900,3,'xp');step(r);expect(r.state.mode).toBe('boss-intro');expect(r.state.orbs[0]).toMatchObject({x:900,y:900,value:3});}
    expect(low.state.enemies[0].maxHp).toBe(4000);expect(high.state.enemies[0].maxHp).toBe(5400);
    expect(high.state.bossTime).toBe(0);expect(high.state.totalXp).toBe(0);
  });
  it('increases the real native spawn rate at the same survival time', () => {
    const low=run(20),high=run(30);
    for(const r of [low,high])r.state.spawnBudget=0;
    step(low,120);step(high,120);
    expect(high.state.enemies.length).toBeGreaterThan(low.state.enemies.length);
    expect(encounterDensity(600,false,30).rate).toBe(13.5);
  });
  it.each([false,true])('retains the original enemy capacity in lite=%s', lite => {
    const r=run(30,599);r.simplified=lite;r.state.spawnBudget=1000;r.view={width:20000,height:20000};
    const cap=encounterDensity(599,lite,30).cap;
    expect(cap).toBe(encounterDensity(599,lite,20).cap);
    for(let i=0;i<cap;i++)r.spawnEnemy('blob',1000+i*35,1000);
    step(r);expect(r.state.enemies.length).toBeLessThanOrEqual(cap);
    expect(validSnapshot(r.snapshot())).toBe(true);
  });
  it('does not change existing enemy HP on level-up or multiply difficulty again on restore', () => {
    const r=run(20),old=r.spawnEnemy('armor',400,0);old.hp-=10;
    const hp=old.hp,maxHp=old.maxHp,speed=old.speed;r.state.level=30;step(r);
    expect(old.hp).toBe(hp);expect(old.maxHp).toBe(maxHp);expect(old.speed).toBe(speed);
    const fresh=r.spawnEnemy('armor',500,0);expect(fresh.maxHp).toBeGreaterThan(maxHp);
    const saved=r.snapshot();expect(validSnapshot(saved)).toBe(true);
    const restored=new BladeRun(1,restoreSnapshot(saved)!);expect(restored.state.enemies).toEqual(saved.enemies);
    step(restored);expect(restored.state.enemies.map(e=>e.maxHp)).toEqual(saved.enemies.map(e=>e.maxHp));
  });
  it('crosses level twenty through XP without a choice interruption',()=>{
    const r=run(20);r.grantXp(xpNext(20));expect(r.state.level).toBe(21);const start=r.state.time;r.step(1/60,{x:1,y:0,dash:false});expect(r.state.mode).toBe('playing');expect(r.state.choices).toEqual([]);expect(r.state.time).toBeGreaterThan(start);expect(r.state.player.x).toBeGreaterThan(0);expect(lateGameDifficulty(r.state.level).enemyHealth).toBeCloseTo(1.06);
  });

  it.each([['poison',160,.85],['bomber',60,1.1],['stalker',110,.8]] as const)('keeps the %s warning window intact after level twenty', (kind,distance,windup) => {
    const r=run(30),e=r.spawnEnemy(kind,distance,0);e.cooldown=0;step(r);
    expect(e.action).toBe('windup');expect(e.timer).toBe(windup);
  });
  it('reads level pressure without consuming RNG or mutating the run', () => {
    const r=run(30),before=r.snapshot();lateGameDifficulty(30);encounterDensity(r.state.time,true,30);expect(r.snapshot()).toEqual(before);
  });
});
