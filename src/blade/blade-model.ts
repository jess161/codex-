import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { BLADE_ART, BLADE_DESIGNS } from './blade-art';

// The inspected object shares the combat silhouette; no external model or texture downloads.
function extrude(path: string, depth: number) {
  const parsed = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${path}"/></svg>`);
  const shapes = parsed.paths.flatMap(p => SVGLoader.createShapes(p));
  const geometry = new THREE.ExtrudeGeometry(shapes, { depth, steps: 1, curveSegments: 20, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1, bevelSegments: 3 });
  geometry.scale(1, -1, 1); geometry.translate(-292, 128, -depth / 2); return geometry;
}
export async function createBladeModel(index: number) {
  const design = BLADE_DESIGNS[index], group = new THREE.Group(); group.name = `blade-${index}`;
  const side = new THREE.MeshStandardMaterial({color:'#263a50',metalness:0,roughness:.72});
  const face = new THREE.MeshStandardMaterial({color:design.light,metalness:0,roughness:.55});
  const depth = index === 5 ? 9 : 5;
  group.add(new THREE.Mesh(extrude(design.body,depth),[face,side]));
  group.add(new THREE.Mesh(extrude(design.hilt,depth+2),[face,side]));
  try {
    const map = await new THREE.TextureLoader().loadAsync(BLADE_ART[`blade-${index+1}`]);
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    const painted = new THREE.MeshBasicMaterial({map,transparent:true,alphaTest:.03,depthWrite:false,side:THREE.DoubleSide});
    for (const z of [-1,1]) { const plane = new THREE.Mesh(new THREE.PlaneGeometry(640,256),painted); plane.position.set(28,0,z*((depth+2)/2+.12)); group.add(plane); }
    return group;
  } catch(error) { disposeBladeModel(group); throw error; }
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
