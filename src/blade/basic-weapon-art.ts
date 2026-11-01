import type Phaser from 'phaser';
import { bladePresentation } from './feedback';
import type { EquipmentStats, SwingTiming } from './equipment';
import type { BladeRun } from './simulation';

// Cards, the held sprite and the 3D object share these fruit silhouettes.
export const CARROT_BODY_PATH='M146 62 C213 43 285 55 350 74 L582 118 Q614 128 582 141 L350 182 Q218 213 146 194 Q112 177 118 126 Q110 85 146 62 Z';
export const CARROT_LEAF_PATH='M133 127 C89 106 44 94 18 60 Q65 48 105 89 L129 114 C99 77 76 36 87 17 Q128 36 142 105 L144 127 C122 169 73 202 27 193 Q49 157 104 134 Z';
export const BASIC_DESIGNS={
 15:{body:CARROT_BODY_PATH,hilt:CARROT_LEAF_PATH,light:'#f49a43',grip:'#6fba57'},
} as const;
export const BASIC_BOW_PATH='M181 52 C284 73 377 154 377 256 C377 362 280 443 181 460 L160 426 C238 387 290 323 290 256 C290 186 237 125 160 86 Z';
const fruitDefs='<defs><linearGradient id="carrot" x1="0" y1="0" x2=".25" y2="1"><stop stop-color="#ffd28a"/><stop offset=".42" stop-color="#f69a41"/><stop offset="1" stop-color="#da7135"/></linearGradient><linearGradient id="leaf" x2=".3" y2="1"><stop stop-color="#a2dc6b"/><stop offset="1" stop-color="#4a9c53"/></linearGradient><linearGradient id="banana" x2=".65" y2=".9"><stop stop-color="#fff6b2"/><stop offset=".4" stop-color="#f9d45c"/><stop offset="1" stop-color="#e6b447"/></linearGradient></defs>';
const svg=(body:string,width=640,height=256)=>'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'">'+fruitDefs+body+'</svg>');
const outlined=(path:string,fill:string)=>'<path d="'+path+'" fill="'+fill+'" stroke="#29475d" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>';
export const CARROT_DETAILS='<path d="M139 116Q205 66 313 93L458 123Q292 101 189 136Z" fill="#ffe1a5" opacity=".65"/><path d="M155 80Q217 62 285 78" fill="none" stroke="#fff4d1" stroke-width="9" stroke-linecap="round"/><path d="M192 168l30-7m47-54 28 4m35 55 27-7m37-28 25 4m38 15 24-5" fill="none" stroke="#bd6534" stroke-width="5" stroke-linecap="round"/><path d="M60 82l68 43M95 48l37 70m-66 58 63-42" fill="none" stroke="#3c8350" stroke-width="5" stroke-linecap="round"/><path d="M185 190q9 7 16 0m157-30 17-3" fill="none" stroke="#f5b45c" stroke-width="3" stroke-linecap="round"/>';
export const BANANA_DETAILS='<path d="M203 84C286 121 352 190 352 257C352 327 289 397 204 430" fill="none" stroke="#fff3aa" stroke-width="14" stroke-linecap="round"/><path d="M187 99C259 144 309 201 312 257C310 319 259 377 187 413" fill="none" stroke="#cd9738" stroke-width="4" stroke-linecap="round"/><path d="M161 54l22-11 22 27-25 18-19-19zM159 426l24 10 18 29-25 9-20-26z" fill="#7d6650" stroke="#29475d" stroke-width="6" stroke-linejoin="round"/><path d="M295 231q24-9 49 0l1 50q-25 9-50 0z" fill="#7db66b" stroke="#29475d" stroke-width="5"/><path d="M302 244l35 9m-35 5 35 9" fill="none" stroke="#b7d990" stroke-width="4" stroke-linecap="round"/><path d="M333 148l2 3m-1 211-2 3" fill="none" stroke="#a98541" stroke-width="5" stroke-linecap="round"/>';
const carrot=outlined(CARROT_LEAF_PATH,'url(#leaf)')+outlined(CARROT_BODY_PATH,'url(#carrot)')+CARROT_DETAILS;
const banana=outlined(BASIC_BOW_PATH,'url(#banana)')+BANANA_DETAILS;
export const SEED_DRAWING='<path d="M4 12Q18 3 42 7L61 12L42 17Q18 21 4 12Z" fill="#657374" stroke="#29475d" stroke-width="2.5" stroke-linejoin="round"/><path d="M12 11Q29 8 51 12Q30 14 12 13Z" fill="#fff0c8"/><path d="M18 8l13-1" fill="none" stroke="#d4dcd1" stroke-width="1.5" stroke-linecap="round"/>';
export const BASIC_WEAPON_ART:Record<string,string>={
 'blade-16':svg(carrot),
 'blade-18':svg(banana+'<path d="M181 68V444" fill="none" stroke="#29475d" stroke-width="5"/><path d="M181 68V444" fill="none" stroke="#f5efd6" stroke-width="2"/>',512,512),
 'bow-limbs-18':svg(banana,512,512),
 'fruit-arrow':svg(SEED_DRAWING,64,24),
};

export function basicMeleePose(_index:number,swing:(SwingTiming&{angle:number})|null,aim:number,stats:EquipmentStats){
 const rest=aim+.9;
 const pose=swing?bladePresentation(swing,aim,stats.arc*Math.PI/180,stats.mass,rest):{angle:rest,opacity:0};
 return {...pose,hand:12,reach:stats.range};
}
export function drawBasicMelee(g:Phaser.GameObjects.Graphics,run:BladeRun,sprite:(id:string,texture:string,x:number,y:number,size:number,depth:number)=>Phaser.GameObjects.Image){
 const s=run.state,stats=run.stats,pose=basicMeleePose(run.tier,s.swing,s.aim,stats);
 const a=pose.angle,dx=Math.cos(a),dy=Math.sin(a),x=s.player.x+dx*pose.hand,y=s.player.y+dy*pose.hand;
 const length=(stats.range-12)*640/544;
 sprite('basic-weapon','blade-16',x,y,length,28).setOrigin(56/640,.5).setRotation(a).setDisplaySize(length,length*.4*Math.min(2.5,Math.sqrt(stats.widthScale)));
 if(s.swing&&pose.opacity>0){
  const arc=stats.arc*Math.PI/180,start=s.swing.angle-arc/2;
  g.lineStyle(15*Math.sqrt(stats.widthScale),0xf2a04f,pose.opacity*.18).beginPath().arc(s.player.x,s.player.y,stats.range*.97,start,a).strokePath();
  g.lineStyle(2.5,0xffe2a4,pose.opacity*.9).beginPath().arc(s.player.x,s.player.y,stats.range,start,a).strokePath();
  for(let i=0;i<3;i++){
   const leaf=a-.12-i*.1,r=stats.range*(.72+i*.07);
   g.fillStyle(i===1?0xffc16b:0x79b65c,pose.opacity*.7).fillEllipse(s.player.x+Math.cos(leaf)*r,s.player.y+Math.sin(leaf)*r,4.5,2.5);
  }
 }
}
