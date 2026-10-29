import * as THREE from 'three';
import { WORLD, SPAWN, SPRING, NODE_INFO, STRUCTURE_INFO, random, isLand, distance, coastline, type Point, type RecipeId, type StructureKind } from '../game/content';
import type { Session, Nearby } from '../game/session';
import type { Survival } from '../game/simulation';
import { UNIT, EYE_HEIGHT, DEFAULT_VIEW, clampPitch, relativeMovement, viewDot, forwardPoint } from './firstPerson';
import { createTerrain, createOcean, groundHeight, coastDistance, createMap } from './terrain';
import { mat, mesh, palmInstance, nodeModel, structureModel, boarModel, grassGeometry, foliageMaterial, handModel, fireTexture, pole, disposeModel } from './models';

export class IslandWorld {
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.045,700);
  readonly renderer:THREE.WebGLRenderer;
  yaw=DEFAULT_VIEW.yaw;
  pitch=DEFAULT_VIEW.pitch;
  fps=60;
  private session:Session;
  private model!:Survival;
  private terrain:THREE.Mesh;
  private ocean:ReturnType<typeof createOcean>;
  private sky:THREE.Mesh;
  private sun:THREE.DirectionalLight;
  private ambient:THREE.HemisphereLight;
  private entities=new Map<string,THREE.Group>();
  private buildings=new Map<string,THREE.Group>();
  private boars=new Map<string,THREE.Group>();
  private fires=new Map<string,{group:THREE.Group;light:THREE.PointLight;flames:THREE.Sprite[]}>();
  private leaves:THREE.InstancedMesh;
  private hands=handModel();
  private keys=new Set<string>();
  private touchMove:Point={x:0,y:0};
  private drag:{id:number;x:number;y:number}|null=null;
  private gatherTarget:Nearby|null=null;
  private gatherTime=0;
  private time=0;
  private previous=0;
  private savedAt=0;
  private movementPhase=0;
  private wasLocked=false;
  private lost=false;
  private running=true;
  private lastTarget=0;
  private lastWeather=-1;
  private ghost:THREE.Group|null=null;
  private ghostKind:RecipeId|null=null;
  private buildPoint:Point={...SPAWN};
  private mapCanvas=createMap();
  private rain:THREE.LineSegments;
  private rainPositions:Float32Array;
  private birds:THREE.Group[]=[];
  private clouds:THREE.Mesh[]=[];
  private ship:THREE.Group;
  private reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  private staticObstacles:{x:number;y:number;radius:number}[]=[];
  private software=false;
  private animationId=0;
  constructor(session:Session,onReady:()=>void){
    this.session=session;
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});
    const gl=this.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
    this.software=debug?/swiftshader|llvmpipe|software/i.test(String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))):false;
    this.renderer.setPixelRatio(this.software?.7:Math.min(devicePixelRatio,1.35));
    this.renderer.setSize(innerWidth,innerHeight);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.renderer.shadowMap.enabled=!this.software;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label','第一人称荒岛世界，WASD 移动，鼠标或右侧触屏环顾，E 互动');
    this.renderer.domElement.tabIndex=0;
    document.getElementById('game')!.append(this.renderer.domElement);
    this.scene.fog=new THREE.FogExp2('#b4c9b0',.012);
    this.ambient=new THREE.HemisphereLight('#dfe9e2','#8c8e6a',1.8);this.scene.add(this.ambient);
    this.sun=new THREE.DirectionalLight('#fff1d5',2.3);this.sun.position.set(-25,65,45);this.sun.target.position.set(WORLD.cx*UNIT,0,WORLD.cy*UNIT);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(1536,1536);this.sun.shadow.camera.left=-45;this.sun.shadow.camera.right=45;this.sun.shadow.camera.top=45;this.sun.shadow.camera.bottom=-45;this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=150;this.sun.shadow.bias=-.001;this.sun.shadow.normalBias=.03;this.scene.add(this.sun,this.sun.target);
    this.terrain=createTerrain();this.scene.add(this.terrain);this.ocean=createOcean();this.scene.add(this.ocean);
    const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{night:{value:0},rain:{value:0}},vertexShader:'varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vDirection;uniform float night;uniform float rain;void main(){float t=clamp(normalize(vDirection).y*1.8,0.,1.);vec3 c=mix(vec3(.87,.86,.69),vec3(.36,.65,.71),pow(t,.55));c=mix(c,vec3(.035,.075,.13),night*.94);c=mix(c,vec3(.39,.49,.48),rain*.6);gl_FragColor=vec4(c,1.);}'});
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(340,24,14),skyMaterial);this.sky.position.set(WORLD.cx*UNIT,0,WORLD.cy*UNIT);this.scene.add(this.sky);
    const sunDisc=new THREE.Mesh(new THREE.SphereGeometry(3.8,20,12),new THREE.MeshBasicMaterial({color:'#fff0bb',fog:false,toneMapped:false}));sunDisc.position.set(-115,54,150);sunDisc.name='sun-disc';this.scene.add(sunDisc);
    const moon=new THREE.Mesh(new THREE.SphereGeometry(2,14,10),new THREE.MeshBasicMaterial({color:'#d6e2d9',fog:false,toneMapped:false}));moon.position.set(-80,75,120);moon.name='moon';moon.visible=false;this.scene.add(moon);
    this.leaves=this.createEnvironment();
    this.scene.add(this.camera);this.camera.add(this.hands.group);this.hands.group.visible=false;
    this.rainPositions=new Float32Array(170*6);const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(this.rainPositions,3));this.rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:'#d4e0cc',transparent:true,opacity:.3,depthWrite:false}));this.rain.frustumCulled=false;this.scene.add(this.rain);
    this.ship=this.createShip();this.ship.visible=false;this.scene.add(this.ship);
    this.bindInput();
    session.interact=()=>this.interact();session.capture=()=>this.capture();session.map=(canvas,full)=>this.renderMap(canvas,full);
    session.isTouch=matchMedia('(pointer: coarse)').matches;
    session.onChange(()=>{if(session.paused){this.release();this.resetInput();}this.syncModel();});
    session.on(event=>{
      if(event.type==='hurt'){document.body.classList.remove('hurt');void document.body.offsetWidth;document.body.classList.add('hurt');setTimeout(()=>document.body.classList.remove('hurt'),450);}
      if(event.type==='sleep'){this.resetInput();this.pitch=.1;}
      if(event.type==='end'){this.release();this.resetInput();}
    });
    this.syncModel();this.resize();
    this.renderer.compile(this.scene,this.camera);
    this.animationId=requestAnimationFrame(this.frame);
    onReady();
  }
  private createEnvironment(){
    const rng=random(641),palmPoints=this.session.model.state.nodes.filter(n=>n.kind==='palm').map(n=>({x:n.x*UNIT,y:groundHeight(n.x,n.y),z:n.y*UNIT,scale:.85+(n.variant*.11),rotation:n.variant*1.73}));
    const palms=palmInstance(this.scene,palmPoints);
    const shadeCanvas=document.createElement('canvas');shadeCanvas.width=64;shadeCanvas.height=64;const shadeCtx=shadeCanvas.getContext('2d')!,gradient=shadeCtx.createRadialGradient(32,32,2,32,32,31);gradient.addColorStop(0,'#1e342a77');gradient.addColorStop(.5,'#1e342a30');gradient.addColorStop(1,'#1e342a00');shadeCtx.fillStyle=gradient;shadeCtx.fillRect(0,0,64,64);
    const shadowNodes=this.session.model.state.nodes.filter(n=>!['spring','fishing'].includes(n.kind));
    const shadows=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadeCanvas),transparent:true,depthWrite:false,opacity:.7}),shadowNodes.length),shadowMatrix=new THREE.Object3D();
    shadowNodes.forEach((n,i)=>{const size=n.kind==='palm'?1.9:n.kind==='wreck'?3:1.1;shadowMatrix.position.set(n.x*UNIT+.15,groundHeight(n.x,n.y)+.018,n.y*UNIT);shadowMatrix.rotation.x=-Math.PI/2;shadowMatrix.scale.set(size*1.4,size*.75,1);shadowMatrix.updateMatrix();shadows.setMatrixAt(i,shadowMatrix.matrix);});this.scene.add(shadows);
    const grass=new THREE.InstancedMesh(grassGeometry(),foliageMaterial,1800),m=new THREE.Object3D();let count=0;
    for(let i=0;i<4000&&count<1800;i++){
      const x=600+rng()*2000,y=450+rng()*1480;
      if(!isLand(x,y)||coastDistance(x,y)>.79||Math.hypot(x-SPRING.x,y-SPRING.y)<150)continue;
      m.position.set(x*UNIT,groundHeight(x,y)-.02,y*UNIT);m.rotation.y=rng()*Math.PI*2;m.scale.setScalar(.5+rng());m.updateMatrix();grass.setMatrixAt(count++,m.matrix);
    }grass.count=count;this.scene.add(grass);
    const stones=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),mat('#8a9782'),37);
    for(let i=0;i<37;i++){
      const x=1010+rng()*720,y=560+rng()*240,s=.35+rng()*.65;
      m.position.set(x*UNIT,groundHeight(x,y)+s*.34,y*UNIT);m.rotation.set(rng(),rng()*3,rng());m.scale.set(s*1.4,s*.7,s);m.updateMatrix();stones.setMatrixAt(i,m.matrix);
      this.staticObstacles.push({x,y,radius:s*.9/UNIT});
    }stones.castShadow=true;stones.receiveShadow=true;this.scene.add(stones);
    const spring=new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.MeshLambertMaterial({color:'#448f85',side:THREE.DoubleSide}));spring.rotation.x=-Math.PI/2;spring.scale.set(115*UNIT,80*UNIT,1);spring.position.set(SPRING.x*UNIT,.045,(SPRING.y-45)*UNIT);this.scene.add(spring);
    const rim=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),mat('#b7b89a'),30);
    for(let i=0;i<30;i++){const a=i/30*Math.PI*2,x=SPRING.x+Math.cos(a)*127,y=SPRING.y-45+Math.sin(a)*89;m.position.set(x*UNIT,Math.max(.12,groundHeight(x,y)),y*UNIT);m.rotation.set(rng(),rng()*3,rng());m.scale.set(.2+rng()*.15,.16+rng()*.1,.22+rng()*.15);m.updateMatrix();rim.setMatrixAt(i,m.matrix);}this.scene.add(rim);
    // Distant clouds and birds use small shared meshes, with no streamed assets.
    const cloudGeometry=new THREE.SphereGeometry(1,7,5),cloudMaterial=new THREE.MeshBasicMaterial({color:'#f0edd7',transparent:true,opacity:.63,depthWrite:false,fog:false});
    for(let i=0;i<9;i++){
      const cloud=new THREE.Mesh(cloudGeometry,cloudMaterial);cloud.position.set(-85+i*28,24+(i%3)*6,-60+(i%4)*50);cloud.scale.set(13+i%3*3,2.2,4);this.scene.add(cloud);this.clouds.push(cloud);
    }
    const birdGeometry=new THREE.BufferGeometry();birdGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.24,.02,0,0,0,.055,-.1,.05,.06,0,0,.055,.24,.02,0,.1,.05,.06],3));birdGeometry.computeVertexNormals();
    for(let i=0;i<6;i++){const bird=new THREE.Group();bird.add(new THREE.Mesh(birdGeometry,new THREE.MeshBasicMaterial({color:'#364c43',side:THREE.DoubleSide})));this.birds.push(bird);this.scene.add(bird);}
    return palms.tops;
  }
  private bindInput(){
    const canvas=this.renderer.domElement;
    window.addEventListener('resize',()=>this.resize());
    window.addEventListener('blur',()=>{this.resetInput();if(this.session.started&&!this.session.paused)this.session.open('pause');});
    window.addEventListener('keydown',event=>{
      if((event.target as HTMLElement)?.closest('input,textarea,select'))return;
      if(!this.session.paused){this.keys.add(event.code);if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code))event.preventDefault();if(!event.repeat&&(event.code==='KeyE'||event.code==='Space'))this.interact();}
    });
    window.addEventListener('keyup',event=>this.keys.delete(event.code));
    window.addEventListener('castaway-joystick',((event:CustomEvent<Point>)=>{this.touchMove=event.detail;}) as EventListener);
    document.addEventListener('pointerlockchange',()=>{
      const locked=document.pointerLockElement===canvas;this.session.lookLocked=locked;
      if(this.wasLocked&&!locked&&!this.session.paused)this.session.open('pause');this.wasLocked=locked;
    });
    document.addEventListener('mousemove',event=>{if(document.pointerLockElement===canvas&&!this.session.paused)this.look(event.movementX,event.movementY,.0022);});
    canvas.addEventListener('pointerdown',event=>{
      if(this.session.paused)return;
      if(event.pointerType==='touch'||document.pointerLockElement!==canvas){this.drag={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);if(event.pointerType!=='touch')this.capture();return;}
      if(event.button===0)this.interact();
    });
    canvas.addEventListener('pointermove',event=>{
      if(this.session.paused||!this.drag||this.drag.id!==event.pointerId||document.pointerLockElement===canvas)return;
      this.look(event.clientX-this.drag.x,event.clientY-this.drag.y,event.pointerType==='touch'?.005:.0035);this.drag.x=event.clientX;this.drag.y=event.clientY;
    });
    const stop=(event:PointerEvent)=>{if(this.drag?.id===event.pointerId)this.drag=null;};canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);
    canvas.addEventListener('contextmenu',event=>event.preventDefault());
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.lost=true;this.session.model.save();this.resetInput();this.release();if(this.session.started&&!this.session.panel)this.session.open('pause');this.session.hidden=true;const el=document.getElementById('graphics-status')!;el.classList.remove('hidden');el.textContent='画面正在恢复，旅程已保存…';});
    canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.session.hidden=document.hidden;document.getElementById('graphics-status')!.classList.add('hidden');});
  }
  capture(){
    if(this.session.paused||this.session.isTouch||document.pointerLockElement===this.renderer.domElement)return;
    try{const result=this.renderer.domElement.requestPointerLock();if(result)void result.catch(()=>{this.session.lookLocked=false;});}catch{this.session.lookLocked=false;}
  }
  private release(){if(document.pointerLockElement===this.renderer.domElement)document.exitPointerLock();this.session.lookLocked=false;}
  private look(dx:number,dy:number,sensitivity:number){this.yaw+=dx*sensitivity;this.pitch=clampPitch(this.pitch+dy*sensitivity);}
  private resetInput(){this.keys.clear();this.touchMove={x:0,y:0};this.drag=null;this.gatherTarget=null;this.gatherTime=0;this.session.gathering=0;}
  lookAtPoint(point:Point){const p=this.session.model.state.player;this.yaw=Math.atan2(point.x-p.x,-(point.y-p.y));this.pitch=clampPitch(Math.atan2(EYE_HEIGHT+groundHeight(p.x,p.y)-groundHeight(point.x,point.y)-.3,distance(point,p)*UNIT));this.updateCamera(false,0);this.updateNearby();}
  private syncModel(){
    if(this.model===this.session.model)return;
    this.model=this.session.model;this.resetInput();this.model.obstacles=this.staticObstacles;
    this.yaw=Number.isFinite(this.model.state.view?.yaw)?this.model.state.view!.yaw:DEFAULT_VIEW.yaw;
    this.pitch=clampPitch(Number.isFinite(this.model.state.view?.pitch)?this.model.state.view!.pitch:DEFAULT_VIEW.pitch);
    this.entities.forEach(g=>{this.scene.remove(g);disposeModel(g);});this.entities.clear();this.buildings.forEach(g=>{this.scene.remove(g);disposeModel(g);});this.buildings.clear();this.fires.forEach(f=>{this.scene.remove(f.group);disposeModel(f.group);});this.fires.clear();this.boars.forEach(g=>{this.scene.remove(g);disposeModel(g);});this.boars.clear();
    for(const node of this.model.state.nodes){
      if(['palm','spring'].includes(node.kind))continue;
      const group=nodeModel(node.kind);group.position.set(node.x*UNIT,groundHeight(node.x,node.y),node.y*UNIT);group.userData.target=node.id;group.name=NODE_INFO[node.kind].name;this.entities.set(node.id,group);this.scene.add(group);
      if(node.kind==='fishing'){const shore=coastline(1.025).sort((a,b)=>distance(a,node)-distance(b,node))[0];group.position.set(shore.x*UNIT,0,shore.y*UNIT);}
    }
    for(const boar of this.model.state.boars){const group=boarModel();this.boars.set(boar.id,group);this.scene.add(group);}
    this.savedAt=0;
  }
  private allTargets():Nearby[]{
    return [...this.model.state.nodes.filter(n=>n.remaining>0).map(n=>({id:n.id,kind:'node' as const,name:NODE_INFO[n.kind].name,verb:NODE_INFO[n.kind].verb,hint:NODE_INFO[n.kind].hint,point:n})),...this.model.state.structures.map(s=>({id:s.id,kind:'structure' as const,name:STRUCTURE_INFO[s.kind].name,verb:STRUCTURE_INFO[s.kind].verb,hint:s.kind==='catcher'?`已积存 ${s.stored}/5 份淡水`:STRUCTURE_INFO[s.kind].hint,point:s}))];
  }
  private updateNearby(){
    const p=this.model.state.player;
    this.session.nearby=this.allTargets().filter(t=>distance(t.point,p)<114&&viewDot(p,t.point,this.yaw)>.5).sort((a,b)=>{const score=(t:Nearby)=>distance(p,t.point)/150+(1-viewDot(p,t.point,this.yaw))*1.8;return score(a)-score(b);})[0]??null;
  }
  private interact(){
    if(this.session.paused)return;
    if(this.session.placement){this.updatePlacement();if(this.model.craft(this.session.placement,this.buildPoint)){this.session.placement=null;this.session.changed();}return;}
    if(this.gatherTarget)return;
    this.updateNearby();const target=this.session.nearby;
    if(!target){this.model.toast('靠近并面向你想采集的东西','用鼠标或右侧触屏环顾，WASD 或左侧摇杆移动。','eye');return;}
    if(target.kind==='structure'){if(this.model.interactStructure(target.id)==='sleep')this.session.open('sleep');return;}
    const node=this.model.state.nodes.find(n=>n.id===target.id)!;
    if(node.kind==='palm'&&!this.model.state.tools.includes('axe')||node.kind==='fishing'&&!this.model.state.tools.includes('spear')||this.model.state.energy<4){this.model.gather(node.id);return;}
    this.gatherTarget=target;this.gatherTime=0;
  }
  private updateCamera(moving:boolean,dt:number){
    const p=this.model.state.player;
    if(!this.session.started){const t=this.time*.025;this.camera.position.set(SPAWN.x*UNIT+9+Math.sin(t),5.2,SPAWN.y*UNIT+6);this.camera.lookAt(WORLD.cx*UNIT+1,1.8,WORLD.cy*UNIT+1);this.camera.updateMatrixWorld();return;}
    this.camera.rotation.order='YXZ';this.camera.rotation.set(-this.pitch,-this.yaw,0,'YXZ');
    const h=groundHeight(p.x,p.y)+EYE_HEIGHT;
    this.movementPhase+=moving?dt*(this.keys.has('ShiftLeft')?13:9):0;
    const bob=this.reduceMotion||!moving?0:Math.sin(this.movementPhase)*.018;
    this.camera.position.set(p.x*UNIT,h+bob,p.y*UNIT);
    const swing=this.session.gathering>0?Math.sin(this.session.gathering*Math.PI*3):0;
    this.hands.right.rotation.x=swing*.65;this.hands.right.position.y=-.36-(moving?Math.sin(this.movementPhase)*.015:Math.sin(this.time*1.7)*.006);
    this.hands.left.rotation.x=swing*.1;this.hands.axe.visible=this.model.state.tools.includes('axe')&&!this.keys.has('KeyQ');this.hands.spear.visible=this.model.state.tools.includes('spear')&&this.keys.has('KeyQ');
    this.hands.group.visible=this.session.started&&this.model.state.status==='playing'&&!this.session.panel;
    this.model.state.view={yaw:this.yaw,pitch:this.pitch};
    this.camera.updateMatrixWorld();
  }
  private updatePlacement(){
    const kind=this.session.placement;
    if(kind!==this.ghostKind){if(this.ghost){this.scene.remove(this.ghost);disposeModel(this.ghost,true);this.ghost=null;}this.ghostKind=kind;if(kind){this.ghost=structureModel(kind as StructureKind);this.ghost.traverse(o=>{if(o instanceof THREE.Mesh){o.material=(o.material as THREE.Material).clone();const m=o.material as THREE.MeshLambertMaterial;m.transparent=true;m.opacity=.35;m.depthWrite=false;o.castShadow=false;}});this.scene.add(this.ghost);}}
    if(!kind||!this.ghost)return;
    // Ground intersections keep the blueprint attached to the place the player is looking at.
    const raycaster=new THREE.Raycaster();raycaster.setFromCamera(new THREE.Vector2(0,0),this.camera);raycaster.far=7.3;
    const hit=raycaster.intersectObject(this.terrain)[0];
    this.buildPoint=hit?{x:hit.point.x/UNIT,y:hit.point.z/UNIT}:forwardPoint(this.model.state.player,this.yaw,110);
    if(distance(this.buildPoint,this.model.state.player)<60)this.buildPoint=forwardPoint(this.model.state.player,this.yaw,85);
    const p=this.buildPoint,good=isLand(p.x,p.y)&&distance(p,this.model.state.player)<300&&!this.model.state.structures.some(s=>distance(s,p)<110)&&!this.model.state.nodes.some(n=>['palm','wreck','relic'].includes(n.kind)&&distance(n,p)<65)&&!this.model.obstacles.some(o=>distance(o,p)<o.radius+25);
    this.ghost.position.set(p.x*UNIT,groundHeight(p.x,p.y)+.02,p.y*UNIT);
    this.ghost.traverse(o=>{if(o instanceof THREE.Mesh)(o.material as THREE.MeshLambertMaterial).color.set(good?'#bed5a6':'#d77c64');});
    this.session.buildValid=good;
  }
  private updateStructures(){
    for(const structure of this.model.state.structures){
      if(!this.buildings.has(structure.id)){
        const group=structureModel(structure.kind);group.position.set(structure.x*UNIT,groundHeight(structure.x,structure.y),structure.y*UNIT);group.name=STRUCTURE_INFO[structure.kind].name;this.buildings.set(structure.id,group);this.scene.add(group);
      }
      if(structure.kind==='catcher')this.buildings.get(structure.id)!.getObjectByName('stored-water')!.visible=structure.stored>0;
      const active=structure.kind==='campfire'||structure.kind==='signal'&&this.model.state.rescueTimer>0;
      if(active&&!this.fires.has(structure.id)){
        const group=new THREE.Group(),light=new THREE.PointLight('#ffb969',22,9,1.7);light.position.y=.9;group.add(light);
        const texture=fireTexture(),flames:THREE.Sprite[]=[];
        for(let i=0;i<3;i++){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:'#ffdaaa',transparent:true,opacity:.85,depthWrite:false,toneMapped:false}));sprite.position.set((i-1)*.11,.45+i*.04,0);sprite.scale.set(.58,.95,1);group.add(sprite);flames.push(sprite);}
        group.position.set(structure.x*UNIT,groundHeight(structure.x,structure.y)+.15,structure.y*UNIT);if(structure.kind==='signal')group.scale.setScalar(1.8);this.scene.add(group);this.fires.set(structure.id,{group,light,flames});
      }
    }
    this.fires.forEach((fire,id)=>{fire.light.intensity=(this.model.night?15:6)+Math.sin(this.time*9+id.length)*1.5;fire.flames.forEach((sprite,j)=>{sprite.scale.y=.85+Math.sin(this.time*10+j)*.12;sprite.position.x=Math.sin(this.time*7+j)*.08;});});
  }
  private updateWeather(){
    const s=this.model.state;
    const night=s.minute>1080?Math.min(.9,(s.minute-1080)/100):s.minute<360?.9:s.minute<420?(420-s.minute)/60*.9:0;
    const rain=this.model.weather==='rain'?1:0;
    const mood=Math.round(night*20)+rain*100;
    if(mood!==this.lastWeather){
      this.lastWeather=mood;
      (this.sky.material as THREE.ShaderMaterial).uniforms.night.value=night;(this.sky.material as THREE.ShaderMaterial).uniforms.rain.value=rain;
      this.ocean.material.uniforms.night.value=night;this.ocean.material.uniforms.rain.value=rain;
      const fog=this.scene.fog as THREE.FogExp2;fog.color.set('#bdd0b5').lerp(new THREE.Color('#102b40'),night).lerp(new THREE.Color('#889d91'),rain*.4);fog.density=.012+rain*.01+night*.003;
      this.ambient.intensity=1.8-night;this.sun.intensity=(2.3-night*2)*(rain?.65:1);this.sun.color.set(night>.5?'#aac4dd':'#fff1d5');
      this.scene.getObjectByName('sun-disc')!.visible=night<.3;this.scene.getObjectByName('moon')!.visible=night>=.3;
      (this.clouds[0].material as THREE.MeshBasicMaterial).color.set('#f0edd7').lerp(new THREE.Color('#3b4c57'),night*.9);
    }
    this.ocean.material.uniforms.time.value=this.time;
    this.rain.visible=!!rain&&this.session.started;
    if(this.rain.visible){const p=this.camera.position;for(let i=0;i<170;i++){const x=p.x+((i*3.91+this.time*.6)%18)-9,z=p.z+((i*7.17)%18)-9,y=p.y+7-((this.time*10+i*.27)%10);this.rainPositions.set([x,y,z,x-.055,y-.45,z],i*6);}this.rain.geometry.getAttribute('position').needsUpdate=true;}
  }
  private createShip(){
    const ship=new THREE.Group();ship.add(mesh(new THREE.ConeGeometry(1.2,5,4),'#544c38',0,.35,0,1,.35,1));ship.add(pole(new THREE.Vector3(0,0,0),new THREE.Vector3(0,5,0),.045,'#c9b17d'));
    const sail=new THREE.Mesh(new THREE.PlaneGeometry(2.2,3.4),new THREE.MeshLambertMaterial({color:'#e1d8b8',side:THREE.DoubleSide}));sail.position.set(.9,3,0);ship.add(sail);ship.rotation.y=.5;return ship;
  }
  private frame=(stamp:number)=>{
    if(!this.running)return;this.animationId=requestAnimationFrame(this.frame);
    if(this.lost)return;
    const raw=this.previous?(stamp-this.previous)/1000:1/60;this.previous=stamp;const dt=Math.min(raw,.1);this.time+=dt;this.fps=this.fps*.97+Math.min(120,1/Math.max(raw,.001))*.03;
    this.syncModel();const s=this.model.state;
    let moving=false;
    if(!this.session.paused){
      const right=Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'))+this.touchMove.x;
      const forward=Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'))-Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-this.touchMove.y;
      moving=Math.hypot(right,forward)>.1;
      if(moving){this.gatherTarget=null;this.session.gathering=0;const d=relativeMovement(right,forward,this.yaw);this.model.move(d.x,d.y,dt,this.keys.has('ShiftLeft')||this.keys.has('ShiftRight'));}
      if(this.gatherTarget){
        if(distance(this.gatherTarget.point,s.player)>114||viewDot(s.player,this.gatherTarget.point,this.yaw)<.2){this.gatherTarget=null;this.session.gathering=0;}
        else {const node=s.nodes.find(n=>n.id===this.gatherTarget!.id)!;this.gatherTime+=dt;this.session.gathering=this.gatherTime/NODE_INFO[node.kind].duration;if(this.session.gathering>=1){this.model.gather(node.id);this.gatherTarget=null;this.session.gathering=0;}}
      }
      this.model.tick(dt,moving);if(s.elapsed-this.savedAt>12){this.model.save();this.savedAt=s.elapsed;}
    }else{this.gatherTarget=null;this.session.gathering=0;}
    this.updateCamera(moving,dt);
    if(this.time-this.lastTarget>.09){this.updateNearby();this.lastTarget=this.time;}
    this.updatePlacement();this.updateStructures();this.updateWeather();
    for(const node of s.nodes){const entity=this.entities.get(node.id);if(entity)entity.visible=node.remaining>0||node.kind==='wreck'||node.kind==='relic';}
    for(const boar of s.boars){const group=this.boars.get(boar.id)!;group.position.set(boar.x*UNIT,groundHeight(boar.x,boar.y),boar.y*UNIT);group.rotation.y=-boar.phase;}
    this.leaves.rotation.y=Math.sin(this.time*.7)*.00025;
    for(let i=0;i<this.birds.length;i++){const t=this.time*.06+i;this.birds[i].position.set(40+Math.cos(t)*27,11+Math.sin(t)*2,43+Math.sin(t*.8)*24);this.birds[i].rotation.set(Math.sin(this.time*2+i)*.05,-t,Math.sin(this.time*3+i)*.1);}
    for(const cloud of this.clouds){cloud.position.x+=dt*.08;if(cloud.position.x>170)cloud.position.x=-100;}
    this.ship.visible=s.rescueTimer>0;this.ship.position.set(WORLD.cx*UNIT+14-s.rescueTimer*.12,.1,WORLD.cy*UNIT+30);
    this.renderer.render(this.scene,this.camera);
  };
  renderMap(canvas:HTMLCanvasElement,full:boolean){
    const ctx=canvas.getContext('2d');if(!ctx)return;const w=canvas.width,h=canvas.height,s=this.model.state,sx=w/WORLD.width,sy=h/WORLD.height;
    ctx.drawImage(this.mapCanvas,0,0,w,h);
    ctx.strokeStyle='#e0ce9a22';ctx.lineWidth=.6;for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(i*w/8,0);ctx.lineTo(i*w/8,h);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*h/8);ctx.lineTo(w,i*h/8);ctx.stroke();}
    for(const structure of s.structures){ctx.fillStyle='#eaca92';ctx.fillRect(structure.x*sx-3,structure.y*sy-3,6,6);}
    if(full){for(const [name,x,y] of [['初醒海滩',1640,1970],['沉船海岸',2450,1550],['翡翠泉',1770,1020],['低语密林',1250,760],['落日岬',780,1400]] as const){ctx.font='13px "Noto Serif CJK SC",serif';ctx.textAlign='center';ctx.fillStyle=s.discoveries.includes(name)?'#fff0bd':'#e1d6b580';ctx.shadowBlur=4;ctx.shadowColor='#284c3e';ctx.fillText(s.discoveries.includes(name)?name:'未知之地',x*sx,y*sy);ctx.shadowBlur=0;}}
    const x=s.player.x*sx,y=s.player.y*sy;ctx.fillStyle='#fff0c1';ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff0c1';ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x+Math.sin(this.yaw)*12,y-Math.cos(this.yaw)*12);ctx.lineTo(x+Math.sin(this.yaw+2.4)*4,y-Math.cos(this.yaw+2.4)*4);ctx.lineTo(x+Math.sin(this.yaw-2.4)*4,y-Math.cos(this.yaw-2.4)*4);ctx.closePath();ctx.fill();
  }
  private resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);}
  dispose(){this.running=false;cancelAnimationFrame(this.animationId);this.release();const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();this.scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.renderer.dispose();this.renderer.domElement.remove();}
}
