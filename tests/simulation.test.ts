import { describe, expect, test, vi } from 'vitest';
import { Survival, freshState, SAVE_KEY } from '../src/game/simulation';
import { ITEMS, RECIPES, SPRING, SPAWN, createNodes, distance, isLand, type ItemId, type RecipeId, type Point } from '../src/game/content';

function harvest(game: Survival, kind: string, count = 1) {
  const node = game.state.nodes.find(n => n.kind === kind && n.remaining >= count)!;
  game.state.player = { x: node.x, y: node.y };
  for (let i = 0; i < count; i++) { game.state.energy = 100; expect(game.gather(node.id)).toBe(true); }
}
function fund(game: Survival) { for (const id of Object.keys(ITEMS) as ItemId[]) game.state.inventory[id] = 40; }
function site(game: Survival, id: RecipeId): Point {
  for (let y = 1730; y < 1950; y += 80) for (let x = 1510; x < 2220; x += 90) {
    const p = { x, y }; game.state.player = p;
    if (!isLand(x,y) || game.state.structures.some(s => distance(s,p)<110) || game.state.nodes.some(n => ['palm','wreck','relic'].includes(n.kind)&&distance(n,p)<65)) continue;
    if (game.craft(id,p)) return p;
  }
  throw new Error(`No building site for ${id}`);
}

describe('island and navigation rules', () => {
  test('all authored resources are reachable on land, with an impassable spring', () => {
    expect(isLand(SPAWN.x, SPAWN.y)).toBe(true);
    expect(isLand(0, 0)).toBe(false);
    expect(isLand(SPRING.x, SPRING.y-45)).toBe(false);
    for (const node of createNodes()) expect(isLand(node.x,node.y),node.id).toBe(true);
  });
  test('movement cannot enter ocean and sprint spends stamina', () => {
    const game=new Survival();
    for(let i=0;i<300;i++)game.move(0,1,.1);
    expect(isLand(game.state.player.x,game.state.player.y)).toBe(true);
    game.state.player={...SPAWN};const energy=game.state.energy;
    game.move(1,0,.1,true);
    expect(game.state.player.x).toBeGreaterThan(SPAWN.x);expect(game.state.energy).toBeLessThan(energy);
  });
});
describe('resource economy and crafting',()=>{
  test('distant resources and missing tools cannot be harvested',()=>{
    const game=new Survival(),palm=game.state.nodes.find(n=>n.kind==='palm')!;
    expect(game.gather(palm.id)).toBe(false);
    game.state.player={x:palm.x,y:palm.y};expect(game.gather(palm.id)).toBe(false);
    expect(game.state.inventory.wood).toBe(0);expect(palm.remaining).toBe(4);
  });
  test('finite sources deplete and first-gather is awarded only once',()=>{
    const game=new Survival();harvest(game,'wood',3);
    const wood=game.state.nodes.find(n=>n.kind==='wood')!;
    expect(game.gather(wood.id)).toBe(false);expect(game.state.inventory.wood).toBe(9);
    expect(game.state.achievements.filter(a=>a==='first-gather')).toHaveLength(1);
  });
  test('failed crafting does not spend partial materials; successful crafting spends exact costs',()=>{
    const game=new Survival();game.state.inventory.wood=3;
    expect(game.craft('axe')).toBe(false);expect(game.state.inventory.wood).toBe(3);
    game.state.inventory.stone=2;game.state.inventory.fiber=2;
    expect(game.craft('axe')).toBe(true);
    expect(game.state.inventory.wood).toBe(0);expect(game.state.inventory.stone).toBe(0);expect(game.state.inventory.fiber).toBe(0);
    expect(game.state.tools).toContain('axe');expect(game.craft('axe')).toBe(false);
    harvest(game,'palm');expect(game.state.inventory.coconut).toBe(3);
  });
  test('construction rejects ocean, remote sites, and occupied footprints without spending resources',()=>{
    const game=new Survival();fund(game);
    expect(game.craft('campfire',{x:0,y:0})).toBe(false);expect(game.state.inventory.wood).toBe(40);
    const p=site(game,'campfire');game.craft('axe');
    expect(game.craft('shelter',p)).toBe(false);
    expect(game.state.structures).toHaveLength(1);
  });
  test('food and water apply their effects once and empty inventories cannot be used',()=>{
    const game=new Survival();game.state.thirst=30;game.state.hunger=40;
    expect(game.consume('coconut')).toBe(true);
    expect(game.state.thirst).toBe(58);expect(game.state.hunger).toBe(52);
    expect(game.consume('coconut')).toBe(false);expect(game.state.thirst).toBe(58);
    expect(game.state.achievements).toContain('first-drink');
  });
});
describe('survival, shelter, and rescue',()=>{
  test('campfire cooks a fish using one log and unlocks the meal achievement',()=>{
    const game=new Survival();fund(game);site(game,'campfire');
    const structure=game.state.structures[0];const wood=game.state.inventory.wood;
    game.state.inventory.fish=1;game.state.inventory.meal=0;game.interactStructure(structure.id);
    expect(game.state.inventory.wood).toBe(wood-1);expect(game.state.inventory.fish).toBe(0);expect(game.state.inventory.meal).toBe(1);
    expect(game.state.achievements).toContain('first-meal');
  });
  test('collector produces water and rain doubles collection',()=>{
    const clear=new Survival();fund(clear);site(clear,'catcher');
    const rain=new Survival();fund(rain);site(rain,'catcher');rain.state.day=2;rain.state.minute=600;
    for(let i=0;i<300;i++){clear.tick(.1);rain.tick(.1);}
    expect(clear.state.structures[0].stored).toBe(0);expect(rain.state.structures[0].stored).toBe(1);
    rain.interactStructure(rain.state.structures[0].id);expect(rain.state.structures[0].stored).toBe(0);expect(rain.state.inventory.water).toBe(41);
  });
  test('rest requires supplies, advances day, restores renewable resources but not wreck salvage',()=>{
    const game=new Survival();fund(game);game.craft('axe');site(game,'shelter');
    const home={...game.state.player};harvest(game,'wood',3);harvest(game,'wreck',3);game.state.player=home;
    game.state.hunger=20;game.state.thirst=60;expect(game.rest()).toBe(false);expect(game.state.day).toBe(1);
    game.state.hunger=80;game.state.hp=50;expect(game.rest()).toBe(true);
    expect(game.state.day).toBe(2);expect(game.state.minute).toBe(420);expect(game.state.hunger).toBe(60);expect(game.state.thirst).toBe(35);expect(game.state.hp).toBe(78);
    expect(game.state.nodes.find(n=>n.kind==='wood')!.remaining).toBe(3);expect(game.state.nodes.find(n=>n.kind==='wreck')!.remaining).toBe(0);
  });
  test('thirst can cause death, and dead players cannot consume, gather, craft, or move',()=>{
    const game=new Survival();game.state.hp=.1;game.state.thirst=0;game.tick(.1);
    expect(game.state.status).toBe('dead');const before={...game.state.player};
    expect(game.consume('coconut')).toBe(false);expect(game.gather(game.state.nodes[0].id)).toBe(false);expect(game.craft('axe')).toBe(false);game.move(1,0,.1);expect(game.state.player).toEqual(before);
  });
  test('wild boars damage an unprepared player; a spear protects them',()=>{
    const game=new Survival();const boar=game.state.boars[0];game.state.player={x:boar.x,y:boar.y};game.tick(.1);expect(game.state.hp).toBe(91);
    const armed=new Survival();armed.state.tools.push('spear');armed.state.player={x:armed.state.boars[0].x,y:armed.state.boars[0].y};armed.tick(.1);expect(armed.state.hp).toBe(100);
  });
  test('complete a survival journey using harvested resources, sleep, and a signal on the third day',()=>{
    const game=new Survival();harvest(game,'wood',3);harvest(game,'stone',3);harvest(game,'fiber',3);expect(game.craft('axe')).toBe(true);
    for(const node of game.state.nodes.filter(n=>['palm','wood','stone','fiber','berries','wreck'].includes(n.kind)).slice(0,29)){
      game.state.player={x:node.x,y:node.y};for(let i=0;i<node.remaining;i++){game.state.energy=100;game.gather(node.id);}
    }
    // Salvage is unique; finish the wreck if the above batch only took some charges.
    const wreck=game.state.nodes.find(n=>n.kind==='wreck')!;game.state.player={x:wreck.x,y:wreck.y};while(wreck.remaining>0){game.state.energy=100;game.gather(wreck.id);}
    for(const id of ['campfire','shelter','signal'] as RecipeId[])site(game,id);
    const home=game.state.structures.find(s=>s.kind==='shelter')!;game.state.player={x:home.x,y:home.y};
    expect(game.rest()).toBe(true);expect(game.consume('coconut')).toBe(true);expect(game.rest()).toBe(true);expect(game.state.day).toBe(3);
    const signal=game.state.structures.find(s=>s.kind==='signal')!;game.state.player={x:signal.x,y:signal.y};game.interactStructure(signal.id);
    expect(game.state.rescueTimer).toBeGreaterThan(0);
    for(let i=0;i<125;i++)game.tick(.1);
    expect(game.state.status).toBe('rescued');expect(game.state.achievements).toContain('rescued');expect(game.state.achievements).toContain('survivor');
  });
  test('signal cannot rescue players before day three or without fuel',()=>{
    const game=new Survival();fund(game);game.craft('axe');site(game,'campfire');site(game,'shelter');site(game,'signal');const signal=game.state.structures.at(-1)!;
    game.interactStructure(signal.id);expect(game.state.rescueTimer).toBe(0);game.state.day=3;game.state.inventory.wood=0;game.interactStructure(signal.id);expect(game.state.rescueTimer).toBe(0);
  });
});
describe('local save boundary',()=>{
  test('saves serializable state and rejects malformed, dead, or invalid-position saves',()=>{
    const store=new Map<string,string>();vi.stubGlobal('localStorage',{setItem:(key:string,value:string)=>store.set(key,value),getItem:(key:string)=>store.get(key)??null});
    const game=new Survival();harvest(game,'wood');game.save();expect(Survival.load()?.inventory.wood).toBe(3);
    store.set(SAVE_KEY,'{bad');expect(Survival.load()).toBeUndefined();
    const invalid=freshState();invalid.player={x:0,y:0};store.set(SAVE_KEY,JSON.stringify(invalid));expect(Survival.load()).toBeUndefined();
    invalid.player={...SPAWN};invalid.status='dead';store.set(SAVE_KEY,JSON.stringify(invalid));expect(Survival.load()).toBeUndefined();vi.unstubAllGlobals();
  });
});
