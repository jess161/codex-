import carrotImage from './assets/carrot-sword/renditions/base.webp?inline';
import carrotBack from './assets/carrot-sword/renditions/base-back.webp?inline';
import bananaPng from './assets/produce/a-banana-limbs.png?inline';
import { A_GROUP_LAYOUT as ORIGINAL_A_GROUP_LAYOUT } from './assets/produce/a-group-layout';
import {RENDITION_LAYOUT as CARROT_SWORD_LAYOUT} from './assets/carrot-sword/rendition-layout';

// Keep the shared API: the carrot now follows the user's sword reference;
// the banana keeps its approved A-group image, frame and string anchors.
export const A_GROUP_LAYOUT={carrot:CARROT_SWORD_LAYOUT,banana:ORIGINAL_A_GROUP_LAYOUT.banana} as const;
type Layout=typeof A_GROUP_LAYOUT.carrot|typeof A_GROUP_LAYOUT.banana;

// Every combat/menu/model surface uses the same registered reference artwork.
function framed(source:string,layout:Layout,includeString=false){
  const s=layout.source;
  let rope='';
  if(includeString&&'anchors' in layout){
    const [[ax,ay],[bx,by]]=layout.anchors;
    const line=`x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke-linecap="round"`;
    rope=`<g fill="none"><line ${line} stroke="#29475d" stroke-width="14"/><line ${line} stroke="#ecd19a" stroke-width="10"/><line ${line} stroke="#fff1c5" stroke-width="3" stroke-dasharray="18 13"/></g>`;
  }
  return 'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">${rope}<image x="${-s.x}" y="${-s.y}" width="${s.width}" height="${s.height}" href="${source}"/></svg>`);
}
export const A_GROUP_ART={
  carrot:framed(carrotImage,A_GROUP_LAYOUT.carrot),
  carrotBack:framed(carrotBack,A_GROUP_LAYOUT.carrot),
  banana:framed(bananaPng,A_GROUP_LAYOUT.banana,true),
  bananaLimbs:framed(bananaPng,A_GROUP_LAYOUT.banana),
};
