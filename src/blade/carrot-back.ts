import type Phaser from 'phaser';
import { A_GROUP_LAYOUT } from './assets/produce/a-group-layout';

const art=A_GROUP_LAYOUT.carrot;
const values=(art.outline.match(/-?\d+(?:\.\d+)?/g)??[]).map(Number);
const outline=Array.from({length:values.length/2},(_,i)=>({x:values[i*2],y:values[i*2+1]}));
const start=art.grip[0]+40;
// Sample the approved carrot's silhouette once; the spine follows the painted root.
const sections=Array.from({length:25},(_,i)=>{
  const x=start+(art.tip[0]-start)*i/24;
  if(i===24)return {x,top:art.tip[1],bottom:art.tip[1]};
  const hits:number[]=[];
  for(let j=0;j<outline.length;j++){
    const a=outline[j],b=outline[(j+1)%outline.length];
    if(a.x<=x&&b.x>x||b.x<=x&&a.x>x)hits.push(a.y+(x-a.x)*(b.y-a.y)/(b.x-a.x));
  }
  return {x,top:hits.length?Math.min(...hits):art.grip[1],bottom:hits.length?Math.max(...hits):art.grip[1]};
});
interface BackPose{x:number;y:number;angle:number;width:number;fullHeight:number;faceScale:number}
export function carrotBackGeometry(pose:BackPose){
  const dx=Math.cos(pose.angle),dy=Math.sin(pose.angle);
  const edge=(fraction:number)=>sections.map(s=>{
    const x=(s.x-art.grip[0])*pose.width/art.width;
    const faceY=(s.bottom-art.grip[1])*pose.fullHeight/art.height*pose.faceScale;
    const thickness=(s.bottom-s.top)*pose.fullHeight/art.height*(1-pose.faceScale);
    const y=faceY+thickness*fraction;
    return {x:pose.x+dx*x-dy*y,y:pose.y+dy*x+dx*y};
  });
  const band=(from:number,to:number)=>[...edge(from),...edge(to).reverse()];
  return {outline:band(0,1),ridgeBand:band(0,.24),shadeBand:band(.76,1),ridge:edge(.12)};
}
export function drawCarrotBack(g:Phaser.GameObjects.Graphics,pose:BackPose){
  const alpha=Math.min(1,(1-pose.faceScale)*8);
  if(alpha<=.001)return;
  const shape=carrotBackGeometry(pose),stroke=Math.max(.7,Math.min(1.4,pose.fullHeight*.03));
  g.fillStyle(0xd18138,alpha).fillPoints(shape.outline,true);
  g.fillStyle(0xeca155,alpha).fillPoints(shape.ridgeBand,true);
  g.fillStyle(0xa85c2d,alpha).fillPoints(shape.shadeBand,true);
  g.lineStyle(stroke,0x29475d,alpha).strokePoints(shape.outline,true);
  g.lineStyle(Math.max(.45,stroke*.55),0xffc87c,alpha*.72).strokePoints(shape.ridge,false);
}
