import type { CarrotElements } from '../carrot-elements';
export { ELEMENT_VFX_CONFIG as WEAPON_VFX_PROFILES } from './config';

export type VFXElement = 'none' | 'fire' | 'ice' | 'poison' | 'lightning';
export type VFXPreviewPreset = VFXElement | 'calamity' | 'stormFirePoison';

const ELEMENT_PROFILES: [keyof CarrotElements, VFXElement][] = [
  ['electric', 'lightning'], ['fire', 'fire'], ['frost', 'ice'], ['poison', 'poison'],
];
export function carrotVFXElement(elements: CarrotElements): VFXElement {
  return ELEMENT_PROFILES.find(([key]) => elements[key] > 0)?.[1] ?? 'none';
}

export function activeVFXElements(elements: CarrotElements): VFXElement[] {
  const active = ELEMENT_PROFILES.filter(([key]) => elements[key] > 0).map(([, element]) => element);
  return active.length ? active : ['none'];
}

export function previewElements(element: VFXPreviewPreset): CarrotElements {
  return { electric: element === 'lightning' || element === 'stormFirePoison' ? 1 : 0,
    fire: element === 'fire' || element === 'calamity' || element === 'stormFirePoison' ? 1 : 0,
    frost: element === 'ice' || element === 'calamity' ? 1 : 0,
    poison: element === 'poison' || element === 'calamity' || element === 'stormFirePoison' ? 1 : 0 };
}
