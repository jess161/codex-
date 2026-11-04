import type Phaser from 'phaser';
import type {BladeRun,RunEvent} from './simulation';
import {lightningProfile} from './gear';
export function drawBuildBody(g:Phaser.GameObjects.Graphics,run:BladeRun){
 const s=run.state,b=s.build;if(!b||!s.economy)return;
 const profile=s.evolution?run.lightning:lightningProfile(s.economy.gear,s.level);
 if(profile.enabled)for(let i=0;i<profile.attacks;i++){
  const a=-Math.PI/2+i*Math.PI*2/profile.attacks;
  g.fillStyle(i<b.lightning?0xffd56d:0x9cbbc9,i<b.lightning ? .9:.35).fillCircle(s.player.x+Math.cos(a)*26,s.player.y+Math.sin(a)*26,2.4);
 }
}
export function drawBuildProc(g:Phaser.GameObjects.Graphics,e:RunEvent,age:number){
 const x=e.x??0,y=e.y??0,alpha=Math.max(0,1-age/.32),radius=e.radius??25;
 if(e.procKind==='lightning'){
  const tx=e.toX??x,ty=e.toY??y,dx=tx-x,dy=ty-y,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
  const points=Array.from({length:6},(_,i)=>{const t=i/5,offset=i===0||i===5?0:(i%2?1:-1)*Math.min(8,length*.08);return {x:x+dx*t+nx*offset,y:y+dy*t+ny*offset};});
  g.lineStyle(6,0x29475d,alpha*.7).strokePoints(points,false).lineStyle(3.2,0xffd84f,alpha).strokePoints(points,false).lineStyle(1.2,0xffffbd,alpha).strokePoints(points,false);
  g.fillStyle(0xffffbd,alpha*.8).fillCircle(tx,ty,4);
 }else if(e.procKind==='fire-burst'){
  const reach=radius*(.5+.5*(1-alpha));
  g.fillStyle(0xf07538,alpha*.18).fillCircle(x,y,reach).lineStyle(3,0x29475d,alpha*.45).strokeCircle(x,y,reach).lineStyle(2,0xffbc57,alpha).strokeCircle(x,y,reach*.9);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;g.fillStyle(i%2?0xffcd6b:0xf5823c,alpha).fillCircle(x+Math.cos(a)*reach*.8,y+Math.sin(a)*reach*.8,3*alpha+1);}
 }else if(e.procKind==='reaction'){
  const reach=radius*(.45+.55*(1-alpha)),triple=e.reaction==='calamity';
  const colors=triple?[0xf58c49,0xa9e5ff,0x92d749]:e.reaction==='steam'?[0xffd3ab,0xa9e5ff]:e.reaction==='brittle'?[0xa9e5ff,0x92d749]:[0xb5b8ff,0xf5ba75];
  g.fillStyle(colors[0],alpha*.12).fillCircle(x,y,reach);
  colors.forEach((color,i)=>g.lineStyle(2.5-i*.4,color,alpha).strokeCircle(x,y,Math.max(1,reach-i*6)));
  if(triple)for(let i=0;i<6;i++){
   const angle=i*Math.PI/3;g.fillStyle(0x92d749,alpha*.32).fillCircle(x+Math.cos(angle)*reach*.65,y+Math.sin(angle)*reach*.65,7);
  }
 }
}
