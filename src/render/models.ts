import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { random, type NodeKind, type StructureKind } from '../game/content';

const materials=new Map<string,THREE.MeshLambertMaterial>();
export function mat(color:string) { if(!materials.has(color))materials.set(color,new THREE.MeshLambertMaterial({color}));return materials.get(color)!; }
const sphere=new THREE.IcosahedronGeometry(1,1),box=new THREE.BoxGeometry(1,1,1);
export function mesh(geo:THREE.BufferGeometry,color:string,x=0,y=0,z=0,sx=1,sy=sx,sz=sx){const m=new THREE.Mesh(geo,mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;return m;}
export function pole(a:THREE.Vector3,b:THREE.Vector3,r=.06,color='#97774c') {
  const direction=b.clone().sub(a),m=mesh(new THREE.CylinderGeometry(r*.85,r,direction.length(),7),color);
  m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return m;
}
const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
function colored(geo:THREE.BufferGeometry,color:string){const c=new THREE.Color(color),data=new Float32Array(geo.getAttribute('position').count*3);for(let i=0;i<data.length;i+=3)c.toArray(data,i);geo.setAttribute('color',new THREE.BufferAttribute(data,3));return geo;}
const vertexMaterial=new THREE.MeshLambertMaterial({vertexColors:true});
function merged(parts:THREE.BufferGeometry[]) {const geometry=mergeGeometries(parts.map(p=>p.index?p.toNonIndexed():p));parts.forEach(p=>p.dispose());return new THREE.Mesh(geometry,vertexMaterial);}

export function palmGeometry() {
  const positions:number[]=[],colors:number[]=[],dark=new THREE.Color('#32663f'),light=new THREE.Color('#8caa50');
  for(let leaf=0;leaf<9;leaf++){
    const a=leaf/9*Math.PI*2,len=2.15+(leaf%3)*.2;
    for(let j=0;j<9;j++){
      const t=j/9,t2=(j+1)/9;
      const center=(u:number)=>new THREE.Vector3(Math.cos(a)*len*u,.25+Math.sin(u*Math.PI)*.3-u*u*.75,Math.sin(a)*len*u);
      const left=(u:number,side:number)=>{const p=center(u),w=Math.sin(u*Math.PI)*.33*side;return p.add(v(-Math.sin(a)*w,-Math.abs(w)*.22,Math.cos(a)*w));};
      for(const side of [-1,1]){
        const verts=[center(t),left(t,side),left(t2,side),center(t),left(t2,side),center(t2)];
        const c=dark.clone().lerp(light,t*.65+(side>0?.15:0));
        for(const p of verts){positions.push(p.x,p.y,p.z);colors.push(c.r,c.g,c.b);}
      }
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();return geo;
}
export const foliageMaterial=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
export function palmInstance(scene:THREE.Scene,points:{x:number;y:number;z:number;scale:number;rotation:number}[]) {
  const trunkGeo=new THREE.CylinderGeometry(.12,.23,5.6,7,15),tp=trunkGeo.getAttribute('position'),tc=new Float32Array(tp.count*3);
  for(let i=0;i<tp.count;i++){const t=(tp.getY(i)+2.8)/5.6;tp.setX(i,tp.getX(i)+Math.sin(t*Math.PI)*.16);new THREE.Color(Math.round(t*15)%3===0?'#88724d':'#b59e6e').toArray(tc,i*3);}trunkGeo.setAttribute('color',new THREE.BufferAttribute(tc,3));trunkGeo.computeVertexNormals();
  const trunks=new THREE.InstancedMesh(trunkGeo,vertexMaterial,points.length);
  const tops=new THREE.InstancedMesh(palmGeometry(),foliageMaterial,points.length);
  const fruit=new THREE.InstancedMesh(sphere,mat('#9d8951'),points.length*3);
  const m=new THREE.Object3D();
  points.forEach((p,i)=>{
    m.position.set(p.x,p.y+2.8*p.scale,p.z);m.rotation.set(0,p.rotation,.055*Math.sin(p.rotation));m.scale.setScalar(p.scale);m.updateMatrix();trunks.setMatrixAt(i,m.matrix);
    m.position.set(p.x+Math.sin(p.rotation)*.15,p.y+5.55*p.scale,p.z);m.rotation.set(0,p.rotation,0);m.updateMatrix();tops.setMatrixAt(i,m.matrix);
    for(let j=0;j<3;j++){const a=j*2.1;m.position.set(p.x+Math.cos(a)*.24,p.y+5.35*p.scale,p.z+Math.sin(a)*.24);m.scale.set(.14,.18,.14);m.updateMatrix();fruit.setMatrixAt(i*3+j,m.matrix);}
  });
  trunks.castShadow=true;tops.castShadow=true;trunks.receiveShadow=true;tops.receiveShadow=true;scene.add(trunks,tops,fruit);
  return {tops,fruit};
}
function bushGeometry() {
  const rng=random(313),parts:THREE.BufferGeometry[]=[];
  for(let i=0;i<15;i++){
    const g=sphere.clone().scale(.22+rng()*.13,.25+rng()*.15,.22+rng()*.13).translate((rng()-.5)*.7,.25+rng()*.3,(rng()-.5)*.7);parts.push(colored(g,i%3?'#4d7645':'#759347'));
  }
  for(let i=0;i<17;i++)parts.push(colored(sphere.clone().scale(.035,.04,.035).translate((rng()-.5)*.85,.32+rng()*.4,(rng()-.5)*.85),'#c9775d'));
  return merged(parts).geometry;
}
const bushGeo=bushGeometry();
function woodGeometry(){
  const parts:THREE.BufferGeometry[]=[];
  for(let i=0;i<4;i++){
    const g=new THREE.CylinderGeometry(.07+i*.01,.1,1.1+i*.13,7);g.rotateZ(Math.PI/2);g.rotateY(i*.8-.8);g.translate((i%2-.5)*.3,.12+i*.05,(i-1.5)*.12);parts.push(colored(g,i%2?'#b39b70':'#8d7654'));
    const end=new THREE.CylinderGeometry(.071,.071,.02,7);end.rotateZ(Math.PI/2);end.rotateY(i*.8-.8);end.translate(Math.cos(i*.8-.8)*(.55+i*.065)+(i%2-.5)*.3,.12+i*.05,-Math.sin(i*.8-.8)*(.55+i*.065)+(i-1.5)*.12);parts.push(colored(end,'#dfc795'));
  }return merged(parts).geometry;
}
const woodGeo=woodGeometry();
const stoneGeo=(()=>{const parts=[];for(let i=0;i<4;i++)parts.push(colored(sphere.clone().scale(.2+i*.06,.12+i*.045,.19+i*.05).translate((i%2-.5)*.53,.12,(Math.floor(i/2)-.5)*.32),i%2?'#a5aa97':'#859788'));return merged(parts).geometry;})();
function fiberGeometry(){
  const rng=random(181),parts:THREE.BufferGeometry[]=[];
  for(let i=0;i<12;i++){
    const x=(rng()-.5)*.35,z=(rng()-.5)*.35,h=.45+rng()*.4;
    const g=new THREE.CylinderGeometry(.007,.015,h,3);g.translate(x,h/2,z);parts.push(colored(g,i%2?'#a1ac69':'#7e9851'));
    for(let j=0;j<3;j++)parts.push(colored(new THREE.SphereGeometry(.035,4,3).scale(1,.35,1).translate(x+Math.cos(j*2)*.028,h,z+Math.sin(j*2)*.028),i%3?'#e0dfc0':'#aebca4'));
  }return merged(parts).geometry;
}
const fiberGeo=fiberGeometry();

export function nodeModel(kind:NodeKind):THREE.Group {
  const g=new THREE.Group();
  if(kind==='wood')g.add(new THREE.Mesh(woodGeo,vertexMaterial));
  if(kind==='stone')g.add(new THREE.Mesh(stoneGeo,vertexMaterial));
  if(kind==='fiber')g.add(new THREE.Mesh(fiberGeo,vertexMaterial));
  if(kind==='berries')g.add(new THREE.Mesh(bushGeo,vertexMaterial));
  if(kind==='fishing'){
    for(let i=0;i<4;i++){const fish=mesh(sphere,'#60958f',(i-1.5)*.38,.025,Math.sin(i)*.25,.18,.04,.055);fish.rotation.y=i*.4;g.add(fish);const tail=mesh(new THREE.ConeGeometry(.065,.15,3),'#799f92',(i-1.5)*.38-.2,.025,Math.sin(i)*.25,.8,.8,.5);tail.rotation.z=Math.PI/2;g.add(tail);}
  }
  if(kind==='relic'){
    g.add(mesh(sphere,'#899b85',0,.8,0,.54,.95,.22));
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#50695a';ctx.textAlign='center';ctx.font='22px serif';['别数失去的日子','去数新生的叶子','— 一位漂流者'].forEach((text,i)=>ctx.fillText(text,128,75+i*45));
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(.8,.8),new THREE.MeshLambertMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false}));panel.position.set(0,.9,.24);g.add(panel);
    g.add(mesh(new THREE.CylinderGeometry(.08,.07,.25,7),'#8ea7a0',.4,.13,.25));
  }
  if(kind==='wreck'){
    const parts:THREE.BufferGeometry[]=[];
    for(const side of [-1,1])for(let i=0;i<6;i++){
      const a=-1.2+i*.48,x=Math.sin(a)*2.5,z=side*Math.cos(a)*.8;
      const board=box.clone().scale(.95,.68,.1).rotateY(side*a*.45).translate(x,.48,z);parts.push(colored(board,i%2?'#977d53':'#806b49'));
      const rib=new THREE.CylinderGeometry(.05,.07,1,6).rotateZ(side*.1).translate(x,.5,z*.8);parts.push(colored(rib,'#c0a36c'));
    }
    for(let i=0;i<7;i++)parts.push(colored(box.clone().scale(.12,.12,1.5).translate(-1.6+i*.5,.15,0),'#b29b6b'));
    g.add(merged(parts));g.add(pole(v(-.4,.15,0),v(-.7,5,0),.08,'#b39869'));
    const sailGeo=new THREE.BufferGeometry().setFromPoints([v(-.65,4.8,0),v(-.6,2.7,0),v(1.1,3,0),v(.45,3.3,0),v(.8,3.6,0),v(-.65,4.8,0)]);sailGeo.setIndex([0,1,2,3,4,5]);sailGeo.computeVertexNormals();
    g.add(new THREE.Mesh(sailGeo,new THREE.MeshLambertMaterial({color:'#d7cbaa',side:THREE.DoubleSide})));
    g.add(pole(v(-2.1,.8,.7),v(2,.7,.7),.045,'#baa16e'));
    g.rotation.y=.35;
  }
  g.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});return g;
}

export function structureModel(kind:StructureKind):THREE.Group {
  const g=new THREE.Group();
  if(kind==='campfire'||kind==='signal'){
    const radius=kind==='signal'?1:.66;
    for(let i=0;i<10;i++){const a=i/10*Math.PI*2;g.add(mesh(sphere,i%2?'#99a28a':'#b2b39b',Math.cos(a)*radius,.12,Math.sin(a)*radius,.19,.14,.17));}
    for(let i=0;i<(kind==='signal'?8:4);i++){
      const a=i*Math.PI/4,len=kind==='signal'?1.6:1;
      const log=new THREE.Mesh(new THREE.CylinderGeometry(.055,.09,len,7),mat(i%2?'#b18d58':'#795b3c'));log.rotation.set(Math.PI/2,0,a);log.position.y=.12+i*.032;g.add(log);
    }
  }
  if(kind==='shelter'){
    const roofMaterial=new THREE.MeshLambertMaterial({color:'#7d9252',side:THREE.DoubleSide});
    const roofGeo=new THREE.BufferGeometry();roofGeo.setAttribute('position',new THREE.Float32BufferAttribute([-1.3,.25,-1.15,-1.3,.25,1.15,0,2.15,1.15,0,2.15,-1.15,1.3,.25,-1.15,1.3,.25,1.15,0,2.15,1.15,0,2.15,-1.15],3));roofGeo.setIndex([0,1,2,0,2,3,4,6,5,4,7,6]);roofGeo.computeVertexNormals();const roof=new THREE.Mesh(roofGeo,roofMaterial);roof.castShadow=true;roof.receiveShadow=true;g.add(roof);
    for(const z of [-1,1]){g.add(pole(v(-1.25,.1,z),v(0,2.2,z),.055));g.add(pole(v(1.25,.1,z),v(0,2.2,z),.055));}
    g.add(pole(v(0,2.2,-1.25),v(0,2.2,1.25),.065,'#d3bd83'));
    const strips=[];
    for(const side of [-1,1])for(let i=1;i<10;i++){
      const t=i/10;const strip=box.clone().scale(.13,.024,2.38).rotateZ(side*-.96).translate(side*1.3*(1-t),.25+1.9*t+.014,0);strips.push(colored(strip,i%2?'#a0ae63':'#72894b'));
    }g.add(merged(strips));
    g.add(mesh(box,'#c5b17c',0,.09,0,1,.08,1.8));
  }
  if(kind==='catcher'){
    for(const x of [-.7,.7])for(const z of [-.6,.6])g.add(pole(v(x,0,z),v(x,1.95,z),.035,'#c6b178'));
    const fabric=new THREE.BufferGeometry();fabric.setAttribute('position',new THREE.Float32BufferAttribute([-.7,1.8,-.6,.7,1.8,-.6,.7,1.8,.6,-.7,1.8,.6,0,1.2,0],3));fabric.setIndex([0,4,1,1,4,2,2,4,3,3,4,0]);fabric.computeVertexNormals();g.add(new THREE.Mesh(fabric,new THREE.MeshLambertMaterial({color:'#c0c197',side:THREE.DoubleSide})));
    g.add(mesh(new THREE.CylinderGeometry(.38,.27,.45,10,1,true),'#947c51',0,.23,0));
    const water=mesh(new THREE.CircleGeometry(.32,14),'#73aca5',0,.35,0);water.rotation.x=-Math.PI/2;water.name='stored-water';g.add(water);
  }
  if(kind==='signal'){
    g.add(pole(v(-.9,0,.4),v(0,3.4,0),.065,'#b59c64'));g.add(pole(v(.9,0,.4),v(0,3.4,0),.065));g.add(pole(v(0,0,-.8),v(0,3.4,0),.065));
    const flag=mesh(new THREE.PlaneGeometry(1.2,.65,7,1),'#d6a170',.6,2.95,0);(flag.material as THREE.Material).side=THREE.DoubleSide;flag.name='signal-flag';g.add(flag);
  }
  return g;
}
export function boarModel(){
  const g=new THREE.Group();g.add(mesh(sphere,'#7e7054',0,.5,0,.55,.35,.3));g.add(mesh(sphere,'#76664c',.5,.4,0,.28,.23,.23));g.add(mesh(sphere,'#af9067',.71,.37,0,.1,.1,.14));
  for(const x of [-.32,.32])for(const z of [-.2,.2])g.add(mesh(new THREE.CylinderGeometry(.045,.055,.35,5),'#4b4536',x,.15,z));
  for(const z of [-.16,.16]){const ear=mesh(new THREE.ConeGeometry(.1,.25,3),'#5d513e',.36,.72,z);ear.rotation.z=-.35;g.add(ear);g.add(mesh(sphere,'#292f27',.61,.47,z,.025));}
  return g;
}
export function grassGeometry(){
  const positions:number[]=[],colors:number[]=[],base=new THREE.Color('#5e7e41'),tip=new THREE.Color('#a0b065');
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2,x=Math.cos(a)*.12,z=Math.sin(a)*.12,h=.2+(i%3)*.1;for(const [px,py,pz,t] of [[x-.027,0,z,0],[x+.03,0,z,0],[x+.09,h,z-.02,1]]){positions.push(px,py,pz);const c=base.clone().lerp(tip,t);colors.push(c.r,c.g,c.b);}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();return geo;
}
export function handModel(){
  const g=new THREE.Group(),right=new THREE.Group(),left=new THREE.Group();right.position.set(.25,-.36,-.48);left.position.set(-.31,-.42,-.42);
  for(const arm of [right,left]){
    const sleeve=mesh(new THREE.CapsuleGeometry(.067,.22,3,6),'#d6c6a1',0,-.05,.15);sleeve.rotation.x=-.85;arm.add(sleeve);
    const wrist=mesh(new THREE.CapsuleGeometry(.049,.12,3,6),'#be9368',0,.02,.02);wrist.rotation.x=-.4;arm.add(wrist);arm.add(mesh(sphere,'#d2aa7e',0,.1,-.035,.055,.08,.045));
    for(let i=0;i<3;i++)arm.add(mesh(sphere,'#cda274',-.032+i*.03,.12,-.07,.016,.035,.019));
    arm.add(mesh(sphere,'#d6ac7c',arm===right?-.052:.052,.08,-.05,.025,.04,.024));
  }
  const axe=new THREE.Group();axe.add(mesh(new THREE.CylinderGeometry(.018,.025,.55,7),'#9b7b4d',0,.28,-.035));
  const bladeShape=new THREE.Shape();bladeShape.moveTo(-.055,-.045);bladeShape.lineTo(.12,-.085);bladeShape.lineTo(.19,-.025);bladeShape.lineTo(.17,.075);bladeShape.lineTo(.015,.07);bladeShape.lineTo(-.055,.025);bladeShape.closePath();
  const blade=mesh(new THREE.ExtrudeGeometry(bladeShape,{depth:.04,bevelEnabled:true,bevelThickness:.007,bevelSize:.008,bevelSegments:1,steps:1}),'#aab09c',0,.53,-.055);axe.add(blade);axe.add(mesh(new THREE.CylinderGeometry(.028,.028,.07,7),'#8e8962',0,.49,-.035));axe.name='held-axe';axe.scale.setScalar(.8);right.add(axe);
  const spear=new THREE.Group();const shaft=mesh(new THREE.CylinderGeometry(.018,.025,1.2,7),'#b69c6b',0,.45,-.06);spear.add(shaft);spear.add(mesh(new THREE.ConeGeometry(.045,.2,4),'#adb49e',0,1.12,-.06));spear.rotation.x=-.55;spear.name='held-spear';right.add(spear);
  g.add(right,left);g.name='First-person hands';g.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=false;o.receiveShadow=false;}});return {group:g,right,left,axe,spear};
}
export function fireTexture(){
  const c=document.createElement('canvas');c.width=128;c.height=256;const ctx=c.getContext('2d')!;
  const gradient=ctx.createLinearGradient(0,240,0,15);gradient.addColorStop(0,'#fff4bf');gradient.addColorStop(.3,'#f8d18a');gradient.addColorStop(.7,'#ed9555');gradient.addColorStop(1,'#e9894400');ctx.fillStyle=gradient;
  ctx.beginPath();ctx.moveTo(15,232);ctx.bezierCurveTo(-7,169,65,120,64,10);ctx.bezierCurveTo(126,119,91,131,117,201);ctx.bezierCurveTo(130,253,25,267,15,232);ctx.fill();
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

const sharedGeometry=new Set([sphere,box,bushGeo,woodGeo,stoneGeo,fiberGeo]);
export function disposeModel(group:THREE.Object3D,disposeMaterials=false){
  const textures=new Set<THREE.Texture>();
  group.traverse(o=>{
    if(o instanceof THREE.Mesh){if(!sharedGeometry.has(o.geometry))o.geometry.dispose();if(disposeMaterials)for(const material of Array.isArray(o.material)?o.material:[o.material])material.dispose();}
    if(o instanceof THREE.Sprite){if(o.material.map)textures.add(o.material.map);o.material.dispose();}
  });textures.forEach(t=>t.dispose());
}
