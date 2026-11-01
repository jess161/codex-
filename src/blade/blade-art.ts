import { BASIC_DESIGNS, BASIC_WEAPON_ART } from './basic-weapon-art';
import { BLADE_SHAPES } from './assets/candy/blade-shapes';
export const BLADE_ATLAS = { density: 2, grip: [112,256], body: { x:264,y:0,width:868,height:512 }, hilt: { x:36,y:0,width:228,height:512 } } as const;
export const BLADE_COLORS = [0x64b8ef,0x4278bd,0xf2c54d,0x35c8a2,0xae8fe7,0x476eac,0x76d8f3,0xd7e9ef,0x7184d4,0xa681de,0xffbd53,0xd47aab,0x62d5b1,0x8ddcfa,0xffb15b,0x638ca9,0x59a79b,0xb48a50,0x9b7968];
export const BLADE_DESIGNS = BLADE_SHAPES.map((s,i)=>({...s, light:'#'+BLADE_COLORS[i].toString(16).padStart(6,'0'),dark:'#263a50',grip:'#ffd268'}));
const files = import.meta.glob(['./assets/candy/*.webp','./assets/bows/*.svg'], { eager:true, query:'?inline', import:'default' }) as Record<string,string>;
export const BLADE_ART: Record<string,string> = { ...Object.fromEntries(Object.entries(files).map(([p,url])=>[p.split('/').pop()!.replace(/\.(webp|svg)$/,''),url])), ...BASIC_WEAPON_ART };
export const BLADE_FINISHES = ['晴蓝短锋','深蓝短刃','金色弯月','碧玉长锋','紫色月牙','藏蓝重刃','冰青清光','素白长锋','靛蓝流光','紫晶长锋','琥珀火纹','暗夜玫边'].map(title=>({title:title+' · 糖果刀装',note:'圆润色块、清晰高光与深蓝轮廓延续球形角色的美术风格。刀面和窄侧面共用同一轮廓，握柄保持短小利落。'}));

BLADE_FINISHES.push(...['追风翠羽','凝霜月白','焰星流金'].map(title=>({title:title+' · 糖果弓装',note:'圆润弓臂、奶金握把、深蓝轮廓与清晰高光。张弦积蓄力量，松弦射出流光。'})));

for (const [index, design] of Object.entries(BASIC_DESIGNS)) BLADE_DESIGNS[Number(index)] = {...BLADE_DESIGNS[0], ...design};
BLADE_FINISHES.push(...['普通宽刃刀', '普通直剑', '普通木弓', '普通长矛'].map(title => ({title, note:'朴素钢刃与木柄；战斗、选择界面与鉴赏共用相同轮廓。'})));
