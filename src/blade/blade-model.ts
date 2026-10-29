import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BLADE_ART, BLADE_DESIGNS } from './blade-art';

// The inspected object shares the combat silhouette; no external model or texture downloads.
function extrude(path: string, depth: number) {
  const parsed = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${path}"/></svg>`);
  const shapes = parsed.paths.flatMap(p => SVGLoader.createShapes(p));
  const geometry = new THREE.ExtrudeGeometry(shapes, { depth, steps: 1, curveSegments: 20, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1, bevelSegments: 3 });
  geometry.scale(1, -1, 1); geometry.translate(-292, 128, -depth / 2); return geometry;
}
function brushedMetal() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!; context.fillStyle = '#999'; context.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 180; i++) {
    context.strokeStyle = `rgba(${i % 2 ? '230,230,230' : '40,40,40'},${.025 + i % 5 * .008})`;
    context.beginPath(); context.moveTo(0, i * 1.43); context.lineTo(256, i * 1.43 + 2); context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(.018, .035); return texture;
}
export async function createBladeModel(index: number) {
  const design = BLADE_DESIGNS[index], group = new THREE.Group(); group.name = `blade-${index}`;
  const grain = brushedMetal();
  const metal = new THREE.MeshPhysicalMaterial({ color: design.light, metalness: .78, roughness: .32, roughnessMap: grain, clearcoat: .22, clearcoatRoughness: .25 });
  const edge = new THREE.MeshStandardMaterial({ color: design.dark, metalness: .86, roughness: .25 });
  const gold = new THREE.MeshStandardMaterial({ color: index < 2 ? design.dark : '#d1b373', metalness: .82, roughness: .28 });
  const leather = new THREE.MeshStandardMaterial({ color: design.grip, metalness: .06, roughness: .82 });
  const thread = new THREE.MeshStandardMaterial({ color: design.light, metalness: .28, roughness: .65 });
  const depth = index === 5 ? 10 : index === 8 ? 8 : 5;
  group.add(new THREE.Mesh(extrude(design.body, depth), [metal, edge]));
  group.add(new THREE.Mesh(extrude(design.guard, 13), gold));
  const gripGeometry = new THREE.CylinderGeometry(8, 8.5, 97, 20); gripGeometry.rotateZ(Math.PI / 2); gripGeometry.translate(76 - 292, 0, 0);
  group.add(new THREE.Mesh(gripGeometry, leather));
  const wraps: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 11; i++) {
    const ring = new THREE.TorusGeometry(8.3, .6, 4, 20); ring.rotateY(Math.PI / 2); ring.rotateZ(i % 2 ? .19 : -.19); ring.translate(31 + i * 7.8 - 292, 0, 0); wraps.push(ring);
  }
  const wrapped = mergeGeometries(wraps); if (wrapped) group.add(new THREE.Mesh(wrapped, thread)); wraps.forEach(g => g.dispose());
  const caps: THREE.BufferGeometry[] = [];
  for (const x of [24, 112]) { const cap = new THREE.CylinderGeometry(9, 9, 4, 12); cap.rotateZ(Math.PI / 2); cap.translate(x - 292, 0, 0); caps.push(cap); }
  const joined = mergeGeometries(caps); if (joined) group.add(new THREE.Mesh(joined, gold)); caps.forEach(g => g.dispose());
  const pin = new THREE.Mesh(new THREE.OctahedronGeometry(3, 0), gold); pin.position.set(125 - 292, 0, 9); group.add(pin);
  if (index === 11) {
    const links: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) { const link = new THREE.TorusGeometry(3.3, .8, 5, 14); link.rotateY(i % 2 ? Math.PI / 2 : .35); link.translate(-276 - i * 4.6, -i * 3.2, 0); links.push(link); }
    const chain = mergeGeometries(links); if (chain) group.add(new THREE.Mesh(chain, edge)); links.forEach(g => g.dispose());
  }
  try {
    const map = await new THREE.TextureLoader().loadAsync(BLADE_ART[`blade-${index + 1}-body`]); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 2;
    const painted = new THREE.MeshStandardMaterial({ map, metalness: .48, roughness: .36, transparent: true, alphaTest: .025, depthWrite: false, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      const inlay = new THREE.Mesh(new THREE.PlaneGeometry(640, 256), painted); inlay.position.set(28, 0, side * (depth / 2 + .08)); group.add(inlay);
    }
    return group;
  } catch (error) { disposeBladeModel(group); throw error; }
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
