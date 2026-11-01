import type Phaser from 'phaser';
import type {BladeRun,RunEvent} from './simulation';
export function drawBuildBody(g:Phaser.GameObjects.Graphics,run:BladeRun){
 const s=run.state,b=s.build;if(!b||!s.economy)return;
 if(b.bloodShield>0)g.fillStyle(0xc9617b,.08).fillCircle(s.player.x,s.player.y,34).lineStyle(2.5,0xc96a83,.8).strokeCircle(s.player.x,s.player.y,34);
}
export function drawBuildProc(g:Phaser.GameObjects.Graphics,e:RunEvent,age:number){
 const x=e.x??0,y=e.y??0,alpha=Math.max(0,1-age/.32),radius=e.radius??25;
 if(e.procKind==='cleave'){
  const reach=radius*(1-alpha*.35);
  g.lineStyle(4,0x29475d,alpha*.25).strokeCircle(x,y,reach).lineStyle(2,0x9dbaa9,alpha*.9).strokeCircle(x,y,reach);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;g.lineStyle(2,0xc5a16b,alpha).lineBetween(x+Math.cos(a)*reach*.65,y+Math.sin(a)*reach*.65,x+Math.cos(a)*reach,y+Math.sin(a)*reach);}
 }else g.lineStyle(3,e.procKind==='blood-shield'?0xc96a83:0xe48ca9,alpha*.65).strokeCircle(x,y,radius*(.85+.15*(1-alpha)));
}
