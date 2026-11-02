import type Phaser from 'phaser';
import type {BladeRun,RunEvent} from './simulation';
import {lightningProfile} from './gear';
export function drawBuildBody(g:Phaser.GameObjects.Graphics,run:BladeRun){
 const s=run.state,b=s.build;if(!b||!s.economy)return;
 const profile=lightningProfile(s.economy.gear,s.level);
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
  g.lineStyle(6,0x29475d,alpha*.7).strokePoints(points,false).lineStyle(3.2,0x71caf7,alpha).strokePoints(points,false).lineStyle(1.2,0xfff3b3,alpha).strokePoints(points,false);
  g.fillStyle(0xfff3b3,alpha*.8).fillCircle(tx,ty,4);
 }else if(e.procKind==='fire-burst'){
  const reach=radius*(.5+.5*(1-alpha));
  g.fillStyle(0xf07538,alpha*.18).fillCircle(x,y,reach).lineStyle(3,0x29475d,alpha*.45).strokeCircle(x,y,reach).lineStyle(2,0xffbc57,alpha).strokeCircle(x,y,reach*.9);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;g.fillStyle(i%2?0xffcd6b:0xf5823c,alpha).fillCircle(x+Math.cos(a)*reach*.8,y+Math.sin(a)*reach*.8,3*alpha+1);}
 }
}
