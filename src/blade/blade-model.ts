import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { BLADE_ART, BLADE_DESIGNS } from './blade-art';
import { BASIC_BOW_PATH } from './basic-weapon-art';
import { isBow } from './bows';
import { BOW_LIMB_PATH } from './assets/bows/bow-shapes';

// The inspected object shares the combat silhouette; no external model or texture downloads.
function extrude(path: string, depth: number) {
  const parsed = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${path}"/></svg>`);
  const shapes = parsed.paths.flatMap(p => SVGLoader.createShapes(p));
  const geometry = new THREE.ExtrudeGeometry(shapes, { depth, steps: 1, curveSegments: 20, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1, bevelSegments: 3 });
  geometry.scale(1, -1, 1); geometry.translate(-292, 128, -depth / 2); return geometry;
}
export async function createBladeModel(index: number) {
  if(isBow(index))return createBowModel(index);
  const design = BLADE_DESIGNS[index], group = new THREE.Group(); group.name = `blade-${index}`;
  const side = new THREE.MeshStandardMaterial({color:index===15?'#bd7038':'#263a50',metalness:0,roughness:.72});
  const face = new THREE.MeshStandardMaterial({color:design.light,metalness:0,roughness:.55});
  const depth = index===15?12:index === 5 ? 9 : 5;
  group.add(new THREE.Mesh(extrude(design.body,depth),[face,side]));
  const leaf=index===15?new THREE.MeshStandardMaterial({color:design.grip,roughness:.65}):face;
  const leafSide=index===15?new THREE.MeshStandardMaterial({color:'#3f7850',roughness:.72}):side;
  group.add(new THREE.Mesh(extrude(design.hilt,depth+2),[leaf,leafSide]));
  try {
    const map = await new THREE.TextureLoader().loadAsync(BLADE_ART[`blade-${index+1}`]);
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    const painted = new THREE.MeshBasicMaterial({map,transparent:true,alphaTest:.03,depthWrite:false,side:THREE.DoubleSide});
    for (const z of [-1,1]) { const plane = new THREE.Mesh(new THREE.PlaneGeometry(640,256),painted); plane.position.set(28,0,z*((depth+2)/2+(index===15?1.4:.12))); group.add(plane); }
    return group;
  } catch(error) { disposeBladeModel(group); throw error; }
}
async function createBowModel(index:number){
  const group=new THREE.Group();group.name=`bow-${index}`;
  const parsed=new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${index === 17 ? BASIC_BOW_PATH : BOW_LIMB_PATH}"/></svg>`);
  const depth=index===17?10:6;
  const geometry=new THREE.ExtrudeGeometry(parsed.paths.flatMap(p=>SVGLoader.createShapes(p)),{depth,bevelEnabled:true,bevelSize:1.2,bevelThickness:1,bevelSegments:3,curveSegments:24});
  geometry.scale(.5,-.5,1);geometry.translate(-128,128,-depth/2);
  const side=new THREE.MeshStandardMaterial({color:'#263d54',roughness:.65});
  const face=new THREE.MeshStandardMaterial({color:index === 17 ? '#f4cb5b' : ['#74e0bf','#bdefff','#ffd277'][index-12],roughness:.55});
  group.add(new THREE.Mesh(geometry,[face,side]));
  const grip=new THREE.Mesh(new THREE.BoxGeometry(index===17?25:17.5,31,depth+2),new THREE.MeshStandardMaterial({color:index===17?'#7db66b':'#f1cd7d',roughness:.6}));grip.position.x=31.75;group.add(grip);
  const string=new THREE.Mesh(new THREE.CylinderGeometry(.65,.65,188,8),new THREE.MeshStandardMaterial({color:index===17?'#f5efd6':'#dfedf3'}));string.position.x=index===17?-37.5:-31.5;group.add(string);
  try{
    const map=await new THREE.TextureLoader().loadAsync(BLADE_ART[`blade-${index+1}`]);map.colorSpace=THREE.SRGBColorSpace;
    const painted=new THREE.MeshBasicMaterial({map,transparent:true,alphaTest:.03,depthWrite:false,side:THREE.DoubleSide});
    for(const z of [-1,1]){const plane=new THREE.Mesh(new THREE.PlaneGeometry(256,256),painted);plane.position.z=z*(depth/2+1.2);group.add(plane);}
    group.scale.setScalar(1.75);return group;
  }catch(error){disposeBladeModel(group);throw error;}
}
export function disposeBladeModel(group: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  group.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); geometries.forEach(g => g.dispose());
}
