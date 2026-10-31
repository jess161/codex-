import { BLADE_SHAPES } from './assets/candy/blade-shapes';
export const BLADE_ATLAS = { density: 2, grip: [112,256], body: { x:264,y:0,width:868,height:512 }, hilt: { x:36,y:0,width:228,height:512 } } as const;
export const BLADE_COLORS = [0x64b8ef,0x4278bd,0xf2c54d,0x35c8a2,0xae8fe7,0x476eac,0x76d8f3,0xd7e9ef,0x7184d4,0xa681de,0xffbd53,0xd47aab];
export const BLADE_DESIGNS = BLADE_SHAPES.map((s,i)=>({...s, light:'#'+BLADE_COLORS[i].toString(16).padStart(6,'0'),dark:'#263a50',grip:'#ffd268'}));
const files = import.meta.glob('./assets/candy/*.webp', { eager:true, query:'?inline', import:'default' }) as Record<string,string>;
export const BLADE_ART: Record<string,string> = Object.fromEntries(Object.entries(files).map(([p,url])=>[p.split('/').pop()!.replace('.webp',''),url]));
export const BLADE_FINISHES = ['晴蓝短锋','深蓝短刃','金色弯月','碧玉长锋','紫色月牙','藏蓝重刃','冰青清光','素白长锋','靛蓝流光','紫晶长锋','琥珀火纹','暗夜玫边'].map(title=>({title:title+' · 糖果刀装',note:'圆润色块、清晰高光与深蓝轮廓延续球形角色的美术风格。刀面和窄侧面共用同一轮廓，握柄保持短小利落。'}));
