import * as THREE from 'three';
import { WORLD, SPRING, coastline, random, isLand } from '../game/content';
import { UNIT } from './firstPerson';

export function coastDistance(x:number,y:number) {
  const nx=(x-WORLD.cx)/WORLD.rx,ny=(y-WORLD.cy)/WORLD.ry;
  const a=Math.atan2(ny,nx),radius=1+.075*Math.sin(a*3+.5)+.038*Math.cos(a*7)+.018*Math.sin(a*11);
  return Math.hypot(nx,ny)/radius;
}
export function groundHeight(x:number,y:number) {
  const d=coastDistance(x,y);
  if(d>1.015)return -.4-(d-1.015)*4;
  if(d>.94)return .05+(1-d)*3;
  const pond=((x-SPRING.x)/120)**2+((y-(SPRING.y-45))/85)**2;
  if(pond<1)return -.22;
  const shore=.23+Math.min(.5,(.94-d)*2.1);
  const ridge=Math.exp(-(((x-1360)/460)**2+((y-690)/230)**2))*3.8;
  return shore+ridge+(Math.sin(x*.011)*Math.cos(y*.009)*.13+Math.sin((x+y)*.02)*.035)*Math.min(1,(.95-d)*8);
}
export function createTerrain() {
  const geo=new THREE.PlaneGeometry(WORLD.width*UNIT,WORLD.height*UNIT,160,126);geo.rotateX(-Math.PI/2);
  const pos=geo.getAttribute('position'),colors=new Float32Array(pos.count*3);
  const sand=new THREE.Color('#d9c493'),wet=new THREE.Color('#a8b89d'),grass=new THREE.Color('#7a9060'),jungle=new THREE.Color('#4c7351'),stone=new THREE.Color('#8d927b');
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i)/UNIT+WORLD.width/2,y=pos.getZ(i)/UNIT+WORLD.height/2,d=coastDistance(x,y),h=groundHeight(x,y);
    pos.setY(i,h);
    const noise=Math.sin(x*.053+y*.009)*Math.cos(y*.061)*.045;
    const c=d>.97?wet.clone().lerp(sand,Math.max(0,(1-d)/.03)):d>.8?sand.clone():grass.clone().lerp(jungle,Math.max(0,Math.min(.68,(.8-d)*1.1)));
    if(h>1.8)c.lerp(stone,Math.min(.7,(h-1.8)*.4));
    c.multiplyScalar(1+noise);c.toArray(colors,i*3);
  }
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.computeVertexNormals();
  const terrain=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true}));
  terrain.position.set(WORLD.width*UNIT/2,0,WORLD.height*UNIT/2);terrain.receiveShadow=true;terrain.name='Island terrain';
  return terrain;
}
export function createOcean() {
  const material=new THREE.ShaderMaterial({
    uniforms:{time:{value:0},night:{value:0},rain:{value:0},...THREE.UniformsUtils.clone(THREE.UniformsLib.fog)},
    vertexShader:`uniform float time; varying vec3 vWorld; #include <fog_pars_vertex>
      void main(){vec3 p=position;p.z+=sin(p.x*.28+time*.7)*.035+sin(p.y*.35-time*.5)*.022;vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;vec4 mvPosition=viewMatrix*world;gl_Position=projectionMatrix*mvPosition; #include <fog_vertex> }`,
    fragmentShader:`uniform float time;uniform float night;uniform float rain;varying vec3 vWorld;
      #include <fog_pars_fragment>
      void main(){vec2 p=(vWorld.xz-vec2(${WORLD.cx*UNIT},${WORLD.cy*UNIT}))/vec2(${WORLD.rx*UNIT},${WORLD.ry*UNIT});float a=atan(p.y,p.x);float r=1.+.075*sin(a*3.+.5)+.038*cos(a*7.)+.018*sin(a*11.);float d=length(p)/r;float shallow=1.-smoothstep(1.,1.3,d);
      vec3 color=mix(vec3(.055,.29,.35),vec3(.34,.67,.60),shallow);float wave=sin(vWorld.x*.9+vWorld.z*.3+time*.8)*sin(vWorld.z*.85-vWorld.x*.25-time*.6);color+=wave*.016;
      float foam=pow(max(0.,sin(d*190.-time*1.4)),18.)*(1.-smoothstep(1.01,1.09,d))*.35;color+=foam*vec3(.65,.73,.59);color=mix(color,vec3(.004,.015,.027),night*.97);color=mix(color,color*.7,rain*.3);gl_FragColor=vec4(color,1.); #include <tonemapping_fragment> #include <colorspace_fragment> #include <fog_fragment> }`,
    fog:true,
  });
  // Shader chunks must begin on their own line for the GLSL preprocessor.
  material.vertexShader=material.vertexShader.replaceAll(' #include','\n#include').replaceAll('> }','>\n}');
  material.fragmentShader=material.fragmentShader.replaceAll(' #include','\n#include').replaceAll('> }','>\n}');
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(1400,1400,40,40),material);
  ocean.rotation.x=-Math.PI/2;ocean.position.set(WORLD.cx*UNIT,-.005,WORLD.cy*UNIT);ocean.name='Tidal ocean';return ocean;
}
export function createMap() {
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=780;
  const ctx=canvas.getContext('2d')!,sx=canvas.width/WORLD.width,sy=canvas.height/WORLD.height;
  ctx.fillStyle='#275f62';ctx.fillRect(0,0,canvas.width,canvas.height);
  const shape=(scale:number,color:string)=>{ctx.beginPath();coastline(scale).forEach((p,i)=>i?ctx.lineTo(p.x*sx,p.y*sy):ctx.moveTo(p.x*sx,p.y*sy));ctx.closePath();ctx.fillStyle=color;ctx.fill();};
  shape(1.1,'#387c79');shape(1.05,'#71a596');shape(1,'#dfcda1');shape(.8,'#7d9267');shape(.73,'#69845c');
  const rng=random(62);
  for(let i=0;i<1400;i++){const x=600+rng()*1950,y=450+rng()*1450;if(!isLand(x,y)||coastDistance(x,y)>.78)continue;ctx.fillStyle=i%3?'#365d4433':'#b3b77e44';ctx.beginPath();ctx.ellipse(x*sx,y*sy,2+rng()*5,2+rng()*4,0,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#4b9890';ctx.beginPath();ctx.ellipse(SPRING.x*sx,(SPRING.y-45)*sy,119*sx,83*sy,0,0,Math.PI*2);ctx.fill();
  return canvas;
}
