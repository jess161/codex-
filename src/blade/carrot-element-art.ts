import type Phaser from 'phaser';
import type {BladeRun} from './simulation';
import type {DragMark} from './blade-drag';
import {carrotElements,type CarrotElements,type CarrotTrail} from './carrot-elements';
import {CARROT_SWORD_FX as art} from './assets/carrot-sword/layout';

const images=import.meta.glob('./assets/carrot-sword/materials/*.webp',{eager:true,query:'?inline',import:'default'}) as Record<string,string>;
export const CARROT_ELEMENT_ART=Object.fromEntries(Object.entries(images).map(([path,url])=>['carrot-'+path.split('/').at(-1)!.replace('.webp',''),url]));
type Graphics=Phaser.GameObjects.Graphics;
type Sprite=(id:string,texture:string,x:number,y:number,size:number,depth:number)=>Phaser.GameObjects.Image;
export interface CarrotFrame {x:number;y:number;angle:number;scaleX:number;scaleY:number}
export function carrotPoint(frame:CarrotFrame,px:number,py:number){
 const x=(px-art.grip[0])*frame.scaleX,y=(py-art.grip[1])*frame.scaleY,c=Math.cos(frame.angle),s=Math.sin(frame.angle);
 return {x:frame.x+c*x-s*y,y:frame.y+s*x+c*y};
}
export function drawCarrotMaterials(g:Graphics,run:BladeRun,sprite:Sprite,frame:CarrotFrame,clock:number,reduced:boolean,prefix=''){
 const elements=carrotElements(run.state.economy?.gear,run.state.evolution);
 const layer=(name:string,depth:number,alpha=1)=>sprite(prefix+name,'carrot-'+name,frame.x,frame.y,art.width*frame.scaleX,depth)
  .setOrigin(art.grip[0]/art.width,art.grip[1]/art.height).setDisplaySize(art.width*frame.scaleX,art.height*frame.scaleY).setRotation(frame.angle).setAlpha(alpha);
 if(elements.poison){layer('poison-body',26.06,elements.poison===2?1:.84);if(!elements.frost&&!elements.electric)layer('poison-leaves',26.08,elements.poison===2?1:.84);}
 if(elements.fire)layer('fire-tip',26.10,elements.fire===2?1:.88);
 if(elements.frost)layer('frost-grip',27.10,elements.frost===2?1:.88);
 if(elements.electric){
  if(!elements.frost)layer('electric-grip',26.12,elements.electric===2?1:.85);
  // Keep the registered lightning charm readable where the hand overlaps the hero.
  layer('electric-grip-front',27.15,elements.electric===2?1:.85);
 }
 const scale=Math.max(.8,Math.min(1.8,frame.scaleX/.034));
 if(elements.poison){
  const p=carrotPoint(frame,...art.poisonDrop),rank=elements.poison;
  const pulse=reduced?0:Math.sin(clock*3)*.45,radius=(rank===2?3.2:2.2)*scale;
  g.fillStyle(0x29475d,.9).fillEllipse(p.x,p.y+pulse,radius*1.6+1,radius*2.4+1);
  g.fillStyle(0x8be929,1).fillEllipse(p.x,p.y+pulse,radius*1.6,radius*2.4);
  g.fillStyle(0xf0ffbd,.95).fillCircle(p.x-radius*.25,p.y-radius*.3+pulse,radius*.3);
 }
 if(elements.fire){
  const p=carrotPoint(frame,...art.fireTip),rank=elements.fire,pulse=reduced?1:.88+.12*Math.sin(clock*7),reach=(rank===2?9:6.8)*scale*pulse;
  const local=(x:number,y:number)=>({x:p.x+Math.cos(frame.angle)*x-Math.sin(frame.angle)*y,y:p.y+Math.sin(frame.angle)*x+Math.cos(frame.angle)*y});
  const points=[local(-2,2),local(reach,-reach*.65),local(reach*.65,.2),local(reach*1.3,reach*.25),local(1,reach*.5)];
  g.fillStyle(0xf46b2d,.95).fillPoints(points,true).lineStyle(.8,0x29475d,.9).strokePoints(points,true);
  g.fillStyle(0xffdf73,1).fillCircle(p.x+Math.cos(frame.angle)*reach*.4,p.y+Math.sin(frame.angle)*reach*.4,2*scale);
 }
 if(elements.electric){
  const rank=elements.electric,phase=reduced?0:Math.sin(clock*4)*.6;
  const points=art.electricArc.map(([x,y])=>carrotPoint(frame,x,y));
  g.lineStyle(2.8+(rank===2?1:0),0x29475d,.8).strokePoints(points,false).lineStyle(1.5+(rank===2 ? .5:0),0x75d9ff,1).strokePoints(points,false).lineStyle(.7,0xffef9b,1).strokePoints(points,false);
  const p=carrotPoint(frame,...art.electricSpark);g.fillStyle(0xffec86,.85).fillCircle(p.x,p.y+phase,(rank===2?2.3:1.6)*scale);
 }
 return elements;
}
export function drawCarrotTrails(g:Graphics,kind:CarrotTrail,marks:DragMark[]){
 for(let i=0;i<marks.length;i++){
  const m=marks[i],alpha=Math.max(0,1-m.age/m.life)*m.strength,width=m.width;
  if(kind==='poison'){
   g.lineStyle(width,0x72cd31,alpha*.8).lineBetween(m.from.x,m.from.y,m.to.x,m.to.y).fillStyle(0x8fe849,alpha*.8).fillCircle(m.to.x,m.to.y,width*.65);
   if(i%3===0)g.lineStyle(.7,0xdbffb6,alpha).strokeCircle(m.to.x+width,m.to.y-width,width*.55);
  }else if(kind==='fire'){
   g.lineStyle(width*.55,0xc4522b,alpha*.45).lineBetween(m.from.x,m.from.y,m.to.x,m.to.y);
   g.fillStyle(i%2?0xff9d36:0xffdd70,alpha).fillCircle(m.to.x,m.to.y,width*.6);
  }else if(kind==='frost'){
   g.lineStyle(width+1.5,0xd5f5ff,alpha*.22).lineBetween(m.from.x,m.from.y,m.to.x,m.to.y).lineStyle(width*.65,0xb3e6fa,alpha*.8).lineBetween(m.from.x,m.from.y,m.to.x,m.to.y);
   if(i%3===0)g.lineStyle(.7,0xffffff,alpha).lineBetween(m.to.x-2,m.to.y,m.to.x+2,m.to.y).lineBetween(m.to.x,m.to.y-2,m.to.x,m.to.y+2);
  }else{
   g.lineStyle(width*.7,0x7ddfff,alpha*.7).lineBetween(m.from.x,m.from.y,m.to.x,m.to.y);
   if(i%3===0)g.fillStyle(0xffed8b,alpha).fillCircle(m.to.x,m.to.y,1.1);
  }
 }
}
export function drawCarrotHit(g:Graphics,elements:CarrotElements,x:number,y:number,age:number,reduced:boolean){
 const alpha=Math.max(0,1-age/.32),travel=reduced?0:age*32;
 if(elements.poison)for(let i=0;i<(elements.poison===2?4:2);i++){
  const a=.8+i*2.3,px=x+Math.cos(a)*(4+travel),py=y+Math.sin(a)*(4+travel),size=elements.poison===2?2.6:1.8;
  g.fillStyle(0x78d52f,alpha).fillEllipse(px,py,size*1.5,size*2).lineStyle(.6,0x29475d,alpha*.8).strokeEllipse(px,py,size*1.5,size*2);
 }
 if(elements.frost)for(let i=0;i<(elements.frost===2?5:3);i++){
  const a=i*2.4,px=x+Math.cos(a)*(6+travel),py=y+Math.sin(a)*(6+travel),size=elements.frost===2?3.3:2.4;
  const points=[{x:px,y:py-size},{x:px+size*.55,y:py},{x:px,y:py+size},{x:px-size*.55,y:py}];
  g.fillStyle(0xd9f7ff,alpha).fillPoints(points,true).lineStyle(.8,0x70b5dc,alpha).strokePoints(points,true);
 }
 if(elements.fire)for(let i=0;i<3;i++){const a=i*2.1;g.fillStyle(i===1?0xffed9f:0xff8b39,alpha).fillCircle(x+Math.cos(a)*(4+travel*.7),y+Math.sin(a)*(4+travel*.7),1.5);}
}
