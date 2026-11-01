import type Phaser from 'phaser';
import type { BladeRun } from './simulation';
import { A_GROUP_LAYOUT } from './approved-fruit-art';
type Graphics=Phaser.GameObjects.Graphics;
type Sprite=(id:string,texture:string,x:number,y:number,size:number,depth:number)=>Phaser.GameObjects.Image;
export function drawArchery(g:Graphics,run:BladeRun,sprite:Sprite,reduced:boolean){
 const s=run.state,stats=run.stats,angle=s.aim;
 const size=64*Math.min(1.8,Math.sqrt(stats.lengthScale))*Math.min(1.2,stats.widthScale**.1);
 const drawing=s.swing&&s.swing.age<s.swing.windup?Math.min(1,s.swing.age/s.swing.windup):0;
 const recoil=s.swing&&s.swing.resolved?Math.max(0,1-(s.swing.age-s.swing.windup)/.14):0;
 const distance=23-(reduced?0:recoil*2),x=s.player.x+Math.cos(angle)*distance,y=s.player.y+Math.sin(angle)*distance;
 const squeeze=1-(reduced?0:drawing*.035);
 const point=(lx:number,ly:number)=>({x:x+Math.cos(angle)*lx*squeeze-Math.sin(angle)*ly,y:y+Math.sin(angle)*lx*squeeze+Math.cos(angle)*ly});
 const art=A_GROUP_LAYOUT.banana;
 const held=sprite('held-bow',`bow-limbs-${run.tier+1}`,x,y,size,28).setRotation(angle);
 if(run.tier===17)held.setOrigin(art.grip[0]/art.width,art.grip[1]/art.height).setDisplaySize(size*art.width/art.height*squeeze,size);
 else held.setOrigin(.625,.5).setDisplaySize(size*squeeze,size);
 const local=art.anchors.map(([ax,ay])=>({x:(ax-art.grip[0])/art.height*size,y:(ay-art.grip[1])/art.height*size}));
 const upper=run.tier===17?local[0]:{x:-.245*size,y:-.3671875*size};
 const lower=run.tier===17?local[1]:{x:-.245*size,y:.3671875*size};
 const top=point(upper.x,upper.y),bottom=point(lower.x,lower.y),nock=point((upper.x+lower.x)/2-drawing*.18*size,(upper.y+lower.y)/2);
 g.lineStyle(2.6,0x263d54,1).beginPath().moveTo(top.x,top.y).lineTo(nock.x,nock.y).lineTo(bottom.x,bottom.y).strokePath();
 g.lineStyle(1,0xffe8b9,1).beginPath().moveTo(top.x,top.y).lineTo(nock.x,nock.y).lineTo(bottom.x,bottom.y).strokePath();
 if(s.swing&&!s.swing.resolved){
  if(run.tier===17)sprite('nocked-seed','fruit-arrow',nock.x,nock.y,19,29).setOrigin(.25,.5).setRotation(angle).setDisplaySize(19,19*24/64);
  else{const tip=point(size*.31,0);g.lineStyle(3,0x263d54,.95).lineBetween(nock.x,nock.y,tip.x,tip.y).lineStyle(1.3,0xffedbb,1).lineBetween(nock.x,nock.y,tip.x,tip.y);if(run.tier===14)g.fillStyle(0xffd177,.2+drawing*.5).fillCircle(tip.x,tip.y,3+drawing*4);}
 }
 for(const a of run.archery.arrows){
  if(run.tier===17){
   const dx=Math.cos(a.angle),dy=Math.sin(a.angle),length=22+a.width*1.5;
   g.lineStyle(2,0xffdf80,.3).lineBetween(a.x-dx*(length+10),a.y-dy*(length+10),a.x-dx*length,a.y-dy*length);
   sprite('seed-'+a.id,'fruit-arrow',a.x,a.y,length,26).setOrigin(61/64,.5).setRotation(a.angle).setDisplaySize(length,length*24/64);
   continue;
  }
  const c=a.kind==='wind'?0x62d5b1:a.kind==='ice'?0x8ddcfa:a.kind==='arrow'?0xc9c2ad:0xffb15b;
  const dx=Math.cos(a.angle),dy=Math.sin(a.angle),width=a.width,length=19+width*2;
  const tx=a.x-dx*length,ty=a.y-dy*length;
  g.lineStyle(width*.9+2,0x263d54,.95).lineBetween(tx,ty,a.x,a.y).lineStyle(width*.6,c,1).lineBetween(tx,ty,a.x,a.y);
  g.lineStyle(1,0xffffff,.95).lineBetween(tx+dy,ty-dx,a.x,a.y);
  const bx=a.x-dx*(7+width),by=a.y-dy*(7+width);
  g.fillStyle(0x263d54,1).fillTriangle(a.x+dx*3,a.y+dy*3,bx-dy*(width+2),by+dx*(width+2),bx+dy*(width+2),by-dx*(width+2));
  g.fillStyle(c,1).fillTriangle(a.x+dx,a.y+dy,bx-dy*width,by+dx*width,bx+dy*width,by-dx*width);
  g.lineStyle(1.5,c,.25).lineBetween(tx-dx*14,ty-dy*14,tx,ty);
 }
 for(const f of run.archery.rains){
  g.fillStyle(0x8edcfa,.07).fillCircle(f.x,f.y,f.radius).lineStyle(3.5,0x304e68,.3).strokeCircle(f.x,f.y,f.radius).lineStyle(1.5,0x88cdec,.85).strokeCircle(f.x,f.y,f.radius);
  const age=2.4-f.life;
  for(let i=0;i<9;i++){const a=i*2.399,r=Math.sqrt((i+.5)/9)*f.radius*.86,px=f.x+Math.cos(a)*r,py=f.y+Math.sin(a)*r;const offset=reduced?0:((age*80+i*12)%30);g.lineStyle(3,0x406b87,.5).lineBetween(px-4,py-17+offset,px,py-3+offset).lineStyle(1.4,0xe9fbff,.95).lineBetween(px-4,py-17+offset,px,py-3+offset);}
 }
}
