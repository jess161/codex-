import type Phaser from 'phaser';
import type {BladeRun,RunEvent} from './simulation';
export function drawBuildBody(g:Phaser.GameObjects.Graphics,run:BladeRun) {
  const s=run.state,b=s.build,gear=s.economy?.gear;
  if (!b||!gear) return;
  if (gear.emberPlate) {
    const r=88+8*gear.emberPlate;
    g.fillStyle(0xffbc76,.035).fillCircle(s.player.x,s.player.y,r).lineStyle(1.5,0xdf9958,.35).strokeCircle(s.player.x,s.player.y,r);
  }
  if (gear.chainLightning) {
    const full=b.chainCharge===100;
    g.lineStyle(2,0x29475d,.2).strokeCircle(s.player.x,s.player.y,24);
    if(b.chainCharge)g.lineStyle(full?3:2,full?0xb5edff:0x6cb9ed,.9).beginPath().arc(s.player.x,s.player.y,24,-Math.PI/2,-Math.PI/2+Math.PI*2*b.chainCharge/100).strokePath();
  }
  if (b.shield>0) g.fillStyle(0x8cd7ed,.12).fillCircle(s.player.x,s.player.y,31).lineStyle(2.5,0x6fc3da,.85).strokeCircle(s.player.x,s.player.y,31);
  if (b.bloodShield>0) g.fillStyle(0xc9617b,.08).fillCircle(s.player.x,s.player.y,34).lineStyle(2.5,0xc96a83,.8).strokeCircle(s.player.x,s.player.y,34);
  if (b.empowered>0) g.lineStyle(2,0xffce72,.85).strokeCircle(s.player.x,s.player.y,27);
}
export function drawBuildProc(g:Phaser.GameObjects.Graphics,e:RunEvent,age:number) {
  const x=e.x??0,y=e.y??0,alpha=Math.max(0,1-age/.32),radius=e.radius??25;
  if (e.procKind==='lightning') {
    const tx=e.toX??x,ty=e.toY??y,dx=tx-x,dy=ty-y;
    const energized=e.gearId==='chainLightning';
    g.lineStyle(energized?7:5,0x29475d,alpha*.55).lineBetween(x,y,tx,ty).lineStyle(energized?3.5:2,energized?0x72ceff:0xb5dffb,alpha);
    g.beginPath().moveTo(x,y).lineTo(x+dx*.35-dy*.05,y+dy*.35+dx*.05).lineTo(x+dx*.65+dy*.05,y+dy*.65-dx*.05).lineTo(tx,ty).strokePath();
    if(energized)g.lineStyle(1,0xf3ffff,alpha).lineBetween(x,y,tx,ty).fillStyle(0xe4fcff,alpha*.8).fillCircle(tx,ty,3+alpha*3);
  } else if(e.procKind==='cleave') {
    const reach=radius*(1-alpha*.35);
    g.lineStyle(4,0x29475d,alpha*.25).strokeCircle(x,y,reach).lineStyle(2,0x9dbaa9,alpha*.9).strokeCircle(x,y,reach);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;g.lineStyle(2,0xc5a16b,alpha).lineBetween(x+Math.cos(a)*reach*.65,y+Math.sin(a)*reach*.65,x+Math.cos(a)*reach,y+Math.sin(a)*reach);}
  } else {
    const color=e.procKind==='blood-shield'?0xc96a83:e.procKind==='leech'?0xe48ca9:e.procKind==='reflect'?0x9dbca1:e.procKind==='shield'?0x8ccde7:0xf0b66d;
    g.lineStyle(e.procKind==='aura'?2:3,color,alpha*.65).strokeCircle(x,y,radius*(.85+.15*(1-alpha)));
    if (e.procKind==='reflect') for (let i=0;i<8;i++) {const a=i*Math.PI/4;g.lineBetween(x+Math.cos(a)*radius*.7,y+Math.sin(a)*radius*.7,x+Math.cos(a)*radius,y+Math.sin(a)*radius);}
  }
}
