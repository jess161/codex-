import {mkdir,writeFile} from 'node:fs/promises';
const root=new URL('../src/blade/assets/bows/',import.meta.url);await mkdir(root,{recursive:true});
const limb='M200 52 C224 98 372 117 345 224 Q330 244 330 256 Q330 268 345 288 C372 395 224 414 200 460 L180 445 C217 384 300 371 298 294 L292 276 Q284 256 292 236 L298 218 C300 141 217 128 180 67 Z';
const palette=[['#74e0bf','#30aa8a','#e0fff5'],['#bdefff','#5bafe0','#ffffff'],['#ffd277','#ee754b','#fff3b0']];
const names=['疾风短弓','霜月长弓','焰星重弓'];
function svg(i,full){
 const [light,dark,shine]=palette[i];
 const ornament=i===0?'<path d="M208 65 Q161 60 153 100 Q185 102 208 65Z M208 447 Q161 452 153 412 Q185 410 208 447Z" fill="#b5f4d9"/>':i===1?'<path d="M323 225 A32 32 0 1 0 323 287 A24 24 0 0 1 323 225Z" fill="#f3fcff"/>':'<path d="m320 224 10 20 22 4-16 16 4 23-20-11-20 11 4-23-16-16 22-4Z" fill="#ffd777"/>';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><linearGradient id="limb" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient><linearGradient id="gold" x2="0" y2="1"><stop stop-color="#fff1b5"/><stop offset="1" stop-color="#e6af48"/></linearGradient></defs><g stroke="#263d54" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"><path d="${limb}" fill="url(#limb)"/><path d="M205 82 Q315 137 325 210 M205 430 Q294 393 322 310" fill="none" stroke="${shine}" stroke-width="5"/><path d="m190 63 18-8 12 24-19 10Z M190 449l18 8 12-24-19-10Z" fill="url(#gold)"/><rect x="302" y="225" width="35" height="62" rx="12" fill="url(#gold)"/><path d="m307 238 25 8m-25 5 25 8m-25 5 25 8" stroke="#be873f" stroke-width="3"/>${ornament}${full?'<path d="M193 69 182 256 193 443" fill="none" stroke="#263d54" stroke-width="6"/><path d="M193 69 182 256 193 443" fill="none" stroke="#e5f5fa" stroke-width="2.5"/><path d="M139 256h300" stroke-width="8"/><path d="M139 255h300" stroke="#fff2c2" stroke-width="3.5"/><path d="m462 256-32-15 7 15-7 15Z" fill="'+light+'"/><path d="m142 256-29-16v14l20 9m9-7-29 16v-14l20-9" fill="'+dark+'"/>':''}</g></svg>`;
}
for(let i=0;i<3;i++){
 await writeFile(new URL(`blade-${13+i}.svg`,root),svg(i,true));
 await writeFile(new URL(`bow-limbs-${13+i}.svg`,root),svg(i,false));
}
await writeFile(new URL('bow-shapes.ts',root),`// Authored vector silhouettes; regenerate with node scripts/create-bow-assets.mjs.\nexport const BOW_LIMB_PATH=${JSON.stringify(limb)};\n`);
await writeFile(new URL('manifest.json',root),JSON.stringify({source:'Original vector artwork authored in scripts/create-bow-assets.mjs; no external image dependencies.',dimensions:[512,512],transparent:true,palette:'Candy colors, navy outlines, gold grips and crisp white highlights.',weapons:names,files:['blade-13.svg','blade-14.svg','blade-15.svg','bow-limbs-13.svg','bow-limbs-14.svg','bow-limbs-15.svg'],runtime_pivot:[320,256]},null,2)+'\n');
console.log('Created three transparent 512px bow icons and three matching limb textures.');
