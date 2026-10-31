import type Phaser from 'phaser';
import { TIERS } from './config';
import type { BladeRun, RunEvent } from './simulation';
type Graphics=Phaser.GameObjects.Graphics;
type Sprite=(id:string,texture:string,x:number,y:number,size:number,depth:number)=>Phaser.GameObjects.Image;
const navy=0x29475d;
function ring(g:Graphics,x:number,y:number,r:number,color:number,alpha:number) {
  g.lineStyle(5,navy,alpha*.65).strokeCircle(x,y,r).lineStyle(2.4,color,alpha).strokeCircle(x,y,r);
  g.lineStyle(1.5,0xffffff,alpha*.8).beginPath().arc(x,y,r-4,-2.8,-1.8).strokePath();
}
export function drawActiveFields(g:Graphics,run:BladeRun,reduced:boolean,lite:boolean,sprite:Sprite) {
  const s=run.state;
  for(const f of run.active.fields){
    const fade=Math.min(1,f.life/.3),age=f.duration-f.life;
    if(f.kind==='mirror'){
      const phase=reduced?0:age*3;
      for(const [i,p]of run.mirrorPositions(f).entries()){
        sprite(`active-mirror-${i}`,'hero',p.x,p.y,35,26).setAlpha(.6).setTint(0xa6eafa);
        const radius=f.radius*.65,angle=phase+i*Math.PI;
        g.lineStyle(5,navy,.35*fade).beginPath().arc(p.x,p.y,radius,angle,angle+Math.PI*.7).strokePath();
        g.lineStyle(2.5,0xb7f0ff,.9*fade).beginPath().arc(p.x,p.y,radius,angle,angle+Math.PI*.7).strokePath();
      }
      continue;
    }
    const p=f.kind==='spin'?s.player:f,color=f.kind==='fire'?0xffc46b:f.kind==='vortex'?0xffdc83:0xc8b475;
    g.fillStyle(color,.065*fade).fillCircle(p.x,p.y,f.radius);ring(g,p.x,p.y,f.radius,color,.6*fade);
    if(f.kind==='spin')for(let i=0;i<3;i++){
      const angle=(reduced?0:age*9)+i*Math.PI*2/3;
      g.lineStyle(8,navy,.6*fade).beginPath().arc(p.x,p.y,f.radius*.8,angle,angle+1.2).strokePath();
      g.lineStyle(4,0xffe5a1,.95*fade).beginPath().arc(p.x,p.y,f.radius*.8,angle,angle+1.2).strokePath();
    }
    if(f.kind==='vortex')for(let i=0;i<3;i++){
      const radius=f.radius*(.18+i*.25),angle=(reduced?0:-age*3)+i;
      g.lineStyle(2,0xffd477,.75*fade).beginPath().arc(p.x,p.y,radius,angle,angle+Math.PI*1.3).strokePath();
    }
    if(f.kind==='fire')for(let i=0;i<(lite?5:8);i++){
      const angle=i*Math.PI*2/(lite?5:8),r=f.radius*.68,x=p.x+Math.cos(angle)*r,y=p.y+Math.sin(angle)*r;
      const height=reduced?14:14+Math.sin(age*6+i)*4;
      g.fillStyle(0xffb15e,.75*fade).fillTriangle(x-6,y+4,x+6,y+4,x,y-height);
      g.fillStyle(0xfff1b5,.9*fade).fillTriangle(x-3,y+3,x+3,y+3,x,y-height*.5);
    }
  }
  if(run.active.buff>0){
    const color=run.bladeId==='tensa'?0xb8aff1:0xffe5a7;
    ring(g,s.player.x,s.player.y,31,color,.65);
    if(run.bladeId==='tensa')for(let i=0;i<4;i++){
      const a=i*Math.PI/2;g.lineStyle(2,color,.8).lineBetween(s.player.x+Math.cos(a)*36,s.player.y+Math.sin(a)*36,s.player.x+Math.cos(a)*43,s.player.y+Math.sin(a)*43);
    }
  }
}
export function drawActiveBurst(g:Graphics,e:RunEvent,age:number,reduced:boolean,sprite:Sprite) {
  const x=e.x??0,y=e.y??0,color=TIERS[e.tier??0].hex,alpha=Math.max(0,1-age/.42);
  const r=e.radius??100,a=e.angle??0,arc=(e.arc??360)*Math.PI/180;
  if(e.pulseKind==='execution'){
    const length=Math.max(140,Math.min(360,r*1.45));
    const blade=sprite('active-falling-blade','blade-9',x,y-length*.4-(reduced||e.activePhase==='pulse'?0:Math.max(0,.16-age)*600),length,30);
    blade.setFrame('__BASE').setDisplaySize(length,length*.4).setRotation(Math.PI/2).setAlpha(alpha);
    ring(g,x,y,r,color,alpha*(e.activePhase==='cast'?.3:.8));return;
  }
  if(e.activePhase==='cast'){ring(g,x,y,26+(reduced?0:age*35),color,alpha);return;}
  if(e.pulseKind==='hunt'){
    g.lineStyle(6,navy,.5*alpha).lineBetween(e.toX??x,e.toY??y,x,y);
    g.lineStyle(2,0x8ee3bb,.9*alpha).lineBetween(e.toX??x,e.toY??y,x,y);
    ring(g,x,y,20,color,alpha);return;
  }
  if(e.pulseKind==='thrust'){
    const tx=x+Math.cos(a)*r,ty=y+Math.sin(a)*r,nx=Math.cos(a+Math.PI/2)*8,ny=Math.sin(a+Math.PI/2)*8;
    g.fillStyle(color,.7*alpha).fillTriangle(x+nx,y+ny,x-nx,y-ny,tx,ty);
    g.lineStyle(2,0xffffff,alpha).lineBetween(x,y,tx,ty);return;
  }
  if(arc<Math.PI*2){
    g.lineStyle(8,navy,.55*alpha).beginPath().arc(x,y,r,a-arc/2,a+arc/2).strokePath();
    g.lineStyle(4,e.pulseKind==='soul'?0xd5b1ee:0xffedbd,alpha).beginPath().arc(x,y,r,a-arc/2,a+arc/2).strokePath();
    g.lineStyle(1.5,color,.5*alpha).lineBetween(x,y,x+Math.cos(a-arc/2)*r,y+Math.sin(a-arc/2)*r).lineBetween(x,y,x+Math.cos(a+arc/2)*r,y+Math.sin(a+arc/2)*r);
  }else ring(g,x,y,r,color,alpha);
}
