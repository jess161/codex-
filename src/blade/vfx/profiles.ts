export type VFXElement = 'none' | 'fire' | 'ice' | 'poison' | 'lightning';
export interface WeaponVFXProfile { name: string; color: number; light: number; particleRate: number }

// Element entries are presentation presets, never combat rules or status effects.
export const WEAPON_VFX_PROFILES: Record<VFXElement, WeaponVFXProfile> = {
  none: { name: '无元素基础剑', color: 0xffb75b, light: 0xffefd1, particleRate: 3 },
  fire: { name: '火 · 通用配色', color: 0xff713b, light: 0xffdf8e, particleRate: 9 },
  ice: { name: '冰 · 通用配色', color: 0x91dfff, light: 0xedfbff, particleRate: 6 },
  poison: { name: '毒 · 通用配色', color: 0x92dc59, light: 0xe1ffaf, particleRate: 7 },
  lightning: { name: '雷 · 通用配色', color: 0xffd65b, light: 0xfff6ba, particleRate: 8 },
};
