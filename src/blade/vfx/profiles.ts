export type VFXElement = 'none' | 'fire' | 'ice' | 'poison' | 'lightning';
export type VFXPreviewPreset = VFXElement | 'calamity' | 'stormFirePoison';
export interface WeaponVFXProfile { name: string; color: number; light: number; particleRate: number }

// Element entries are presentation presets, never combat rules or status effects.
export const WEAPON_VFX_PROFILES: Record<VFXElement, WeaponVFXProfile> = {
  none: { name: '无元素基础剑', color: 0xffb75b, light: 0xffefd1, particleRate: 3 },
  fire: { name: '火 · 动态火焰', color: 0xff713b, light: 0xffdf8e, particleRate: 9 },
  ice: { name: '冰 · 动态冰晶', color: 0x91dfff, light: 0xedfbff, particleRate: 6 },
  poison: { name: '毒 · 流动毒液', color: 0x92dc59, light: 0xe1ffaf, particleRate: 7 },
  lightning: { name: '雷 · 动态电弧', color: 0xffd65b, light: 0xfff6ba, particleRate: 8 },
};
import type { CarrotElements } from '../carrot-elements';


const ELEMENT_PROFILES: [keyof CarrotElements, VFXElement][] = [
  ['electric', 'lightning'], ['fire', 'fire'], ['frost', 'ice'], ['poison', 'poison'],
];
export function carrotVFXElement(elements: CarrotElements): VFXElement {
  return ELEMENT_PROFILES.find(([key]) => elements[key] > 0)?.[1] ?? 'none';
}

export function previewElements(element: VFXPreviewPreset): CarrotElements {
  return { electric: element === 'lightning' || element === 'stormFirePoison' ? 1 : 0,
    fire: element === 'fire' || element === 'calamity' || element === 'stormFirePoison' ? 1 : 0,
    frost: element === 'ice' || element === 'calamity' ? 1 : 0,
    poison: element === 'poison' || element === 'calamity' || element === 'stormFirePoison' ? 1 : 0 };
}
