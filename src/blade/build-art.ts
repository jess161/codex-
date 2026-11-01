import type Phaser from 'phaser';
import type {BladeRun,RunEvent} from './simulation';
export function drawBuildBody(g:Phaser.GameObjects.Graphics,run:BladeRun) {
  const s=run.state,b=s.build,gear=s.economy?.gear;
  if (!b||!gear) return;
  if (gear.emberPlate) {
    const r=88+8*gear.emberPlate;
    g.fillStyle(0xffbc76,.035).fillCircle(s.player.x,s.player.y,r).lineStyle(1.5,0xdf9958,.35).strokeCircle(s.player.x,s.player.y,r);
  }
  if (b.shield>0) g.fillStyle(0x8cd7ed,.12).fillCircle(s.player.x,s.player.y,31).lineStyle(2.5,0x6fc3da,.85).strokeCircle(s.player.x,s.player.y,31);
  if (b.empowered>0) g.lineStyle(2,0xffce72,.85).strokeCircle(s.player.x,s.player.y,27);
}
export function drawBuildProc(g:Phaser.GameObjects.Graphics,e:RunEvent,age:number) {
  const x=e.x??0,y=e.y??0,alpha=Math.max(0,1-age/.32),radius=e.radius??25;
  if (e.procKind==='lightning') {
    const tx=e.toX??x,ty=e.toY??y,dx=tx-x,dy=ty-y;
    g.lineStyle(5,0x29475d,alpha*.5).lineBetween(x,y,tx,ty).lineStyle(2,0xb5dffb,alpha);
    g.beginPath().moveTo(x,y).lineTo(x+dx*.35-dy*.05,y+dy*.35+dx*.05).lineTo(x+dx*.65+dy*.05,y+dy*.65-dx*.05).lineTo(tx,ty).strokePath();
  } else {
    const color=e.procKind==='leech'?0xe48ca9:e.procKind==='reflect'?0x9dbca1:e.procKind==='shield'?0x8ccde7:0xf0b66d;
    g.lineStyle(e.procKind==='aura'?2:3,color,alpha*.65).strokeCircle(x,y,radius*(.85+.15*(1-alpha)));
    if (e.procKind==='reflect') for (let i=0;i<8;i++) {const a=i*Math.PI/4;g.lineBetween(x+Math.cos(a)*radius*.7,y+Math.sin(a)*radius*.7,x+Math.cos(a)*radius,y+Math.sin(a)*radius);}
  }
}
