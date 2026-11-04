import type Phaser from 'phaser';
import type {DragMark} from './blade-drag';
import type {CarrotElements,CarrotTrail} from './carrot-elements';
import {RENDITION_FX as art} from './assets/carrot-sword/rendition-layout';

const images=import.meta.glob('./assets/carrot-sword/renditions/*.webp',{eager:true,query:'?inline',import:'default'}) as Record<string,string>;
export const CARROT_ELEMENT_ART=Object.fromEntries(Object.entries(images).map(([path,url])=>['carrot-rendition-'+path.split('/').at(-1)!.replace('.webp',''),url]));
type Graphics=Phaser.GameObjects.Graphics;
export interface CarrotFrame {x:number;y:number;angle:number;scaleX:number;scaleY:number}
export function carrotPoint(frame:CarrotFrame,px:number,py:number){
 const x=(px-art.grip[0])*frame.scaleX,y=(py-art.grip[1])*frame.scaleY,c=Math.cos(frame.angle),s=Math.sin(frame.angle);
 return {x:frame.x+c*x-s*y,y:frame.y+s*x+c*y};
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
   g.lineStyle(width*.7,0xffdb6b,alpha*.7).lineBetween(m.from.x,m.from.y,m.to.x,m.to.y);
   if(i%3===0)g.fillStyle(0xfff0ad,alpha).fillCircle(m.to.x,m.to.y,1.1);
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
