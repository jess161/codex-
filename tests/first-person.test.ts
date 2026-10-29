import { describe, expect, test, vi } from 'vitest';
import { relativeMovement, viewDot, clampPitch, forwardPoint } from '../src/render/firstPerson';
import { Survival, freshState, SAVE_KEY } from '../src/game/simulation';
import { SPAWN } from '../src/game/content';

describe('first-person movement and interaction frame',()=>{
  test('forward follows the view bearing, while strafing stays perpendicular',()=>{
    expect(relativeMovement(0,1,0)).toEqual({x:0,y:-1});
    const east=relativeMovement(0,1,Math.PI/2);expect(east.x).toBeCloseTo(1);expect(east.y).toBeCloseTo(0);
    const right=relativeMovement(1,0,Math.PI/2);expect(right.x).toBeCloseTo(0);expect(right.y).toBeCloseTo(1);
    const backward=relativeMovement(0,-1,Math.PI);expect(backward.y).toBeCloseTo(-1);
  });
  test('interaction prioritizes what is ahead, not resources behind the player',()=>{
    expect(viewDot({x:100,y:100},{x:100,y:50},0)).toBeCloseTo(1);
    expect(viewDot({x:100,y:100},{x:100,y:150},0)).toBeCloseTo(-1);
    expect(viewDot({x:100,y:100},{x:150,y:100},0)).toBeCloseTo(0);
  });
  test('looking up and down cannot flip the camera',()=>{
    expect(clampPitch(100)).toBe(1.3);expect(clampPitch(-100)).toBe(-1.3);expect(clampPitch(.4)).toBe(.4);
  });
  test('placement fallback is in front of the player in the simulation coordinate system',()=>{
    const point=forwardPoint({x:500,y:500},Math.PI/2,100);expect(point.x).toBeCloseTo(600);expect(point.y).toBeCloseTo(500);
  });
});
describe('3D scene bridge preserves simulation boundaries',()=>{
  test('static rock footprints stop movement and prevent building without spending materials',()=>{
    const game=new Survival();game.obstacles=[{x:SPAWN.x+20,y:SPAWN.y,radius:18}];
    game.move(1,0,.1);expect(game.state.player.x).toBe(SPAWN.x);
    game.state.inventory.wood=8;game.state.inventory.stone=8;
    expect(game.craft('campfire',{x:SPAWN.x+20,y:SPAWN.y})).toBe(false);expect(game.state.inventory.wood).toBe(8);expect(game.state.structures).toHaveLength(0);
  });
  test('old 2D saves load without a view, while first-person saves retain the bearing',()=>{
    const store=new Map<string,string>();vi.stubGlobal('localStorage',{setItem:(k:string,v:string)=>store.set(k,v),getItem:(k:string)=>store.get(k)??null});
    store.set(SAVE_KEY,JSON.stringify(freshState()));expect(Survival.load()?.view).toBeUndefined();expect(Survival.load()?.player).toEqual(SPAWN);
    const game=new Survival();game.state.view={yaw:1.7,pitch:.32};game.save();expect(Survival.load()?.view).toEqual({yaw:1.7,pitch:.32});vi.unstubAllGlobals();
  });
});
