import { TIERS } from './config';

// Original vector interpretations, not reproductions of the works' official artwork.
// All forms use a 640 × 256 frame, grip pivot (56,128), furthest blade x = 566.
export const BLADE_DESIGNS = [
  { body: 'M132 110 505 109 566 128 490 153 132 148Z', ridge: 'M143 125 528 126 490 141 143 137', guard: 'M122 101h15v56h-15Z', detail: '<path d="m218 115 20 10-17 7m153-16-10 12 18 7" fill="none" stroke="#53687b" stroke-width="3" opacity=".5"/>', grip: '#687477', light: '#d9e2e5', dark: '#8a9b9e' },
  { body: 'M132 119 440 91 566 128 440 165 132 137Z', ridge: 'M146 127 438 111 535 128 438 144 146 133', guard: 'M121 104 137 111 142 145 126 153 116 143Z', detail: '<path d="m184 123 35 5-35 5m62-10 35 5-35 5m62-10 35 5-35 5" fill="none" stroke="#8bb4bd" stroke-width="2.5"/>', grip: '#233b48', light: '#a0b7c5', dark: '#344959' },
  { body: 'M132 117Q340 111 566 56Q554 123 478 148Q313 173 132 141Z', ridge: 'M143 130Q339 147 514 112Q481 139 427 145L148 139', guard: 'M125 103Q148 128 125 153L116 146Q130 128 116 110Z', detail: '<path d="M158 123Q353 124 530 79" fill="none" stroke="#fff2b5" stroke-width="4"/><circle cx="159" cy="132" r="6" fill="#d6ae50"/>', grip: '#7b573e', light: '#ffe4a0', dark: '#b58d43' },
  { body: 'M132 109 444 103Q509 99 566 64Q565 119 507 143L447 150 132 146Z', ridge: 'M147 126 447 124Q507 118 544 96L508 130 446 141 147 140', guard: 'M120 99 139 108 139 147 119 158 109 147 117 128 109 110Z', detail: '<path d="m175 118 11 10-11 10m15-10h53m167-10 14 10-14 10" fill="none" stroke="#c5f5d7" stroke-width="3"/>', grip: '#226c61', light: '#bde4d2', dark: '#43a88f' },
  { body: 'M132 109Q322 147 501 91L566 39Q565 126 497 164Q314 221 132 144Z', ridge: 'M148 135Q331 186 497 147Q528 128 544 99Q500 156 332 161Q237 160 148 135', guard: 'M130 100Q155 128 130 157L117 149Q135 129 117 108Z', detail: '<path d="M195 138Q349 167 481 121" fill="none" stroke="#f2dcff" stroke-width="3"/><path d="m486 106 8 10-13 9" fill="none" stroke="#f2dcff" stroke-width="3"/>', grip: '#65517b', light: '#e9ddf4', dark: '#9281b0' },
  { body: 'M132 91 424 88 444 69 520 72 566 117 526 161 447 165 132 154Z', ridge: 'M148 132 499 135 541 119 510 149 148 144', guard: 'M118 82 141 93 144 154 120 176 108 162 116 127 106 100Z', detail: '<path d="m175 109 27-9 25 11-20 12 30 11m22-22 17 14 37-14m-10-9 22 9-3 23" fill="none" stroke="#d9b366" stroke-width="5"/><circle cx="471" cy="117" r="14" fill="none" stroke="#c8a05d" stroke-width="4"/>', grip: '#4a3b35', light: '#737d84', dark: '#293844' },
  { body: 'M132 106 441 101Q521 94 566 56L560 110 524 145 442 151 132 146Z', ridge: 'M148 130 445 128 527 113 551 92 517 137 446 143 148 139', guard: 'M119 102 137 97 147 128 136 158 119 154 124 128Z', detail: '<path d="m220 115 19 13-18 11m19-11h75m99-13 16 13-17 11" fill="none" stroke="#d8ffff" stroke-width="3"/><path d="m469 67 9-16 8 16-8 13Zm52 101 9-12 6 12-7 12Z" fill="#b5eaf1" stroke="#5db1ca" stroke-width="2"/>', grip: '#779ead', light: '#efffff', dark: '#75bfd8' },
  { body: 'M132 118Q348 124 566 86Q558 122 524 139Q330 165 132 139Z', ridge: 'M145 130Q344 151 527 126L544 113Q349 142 145 130', guard: 'M126 101a11 27 0 1 1 0 54 11 27 0 1 1 0-54Z', detail: '<path d="M162 124Q350 134 535 105" fill="none" stroke="#ffffff" stroke-width="4"/><path d="m421 80 23 3-28 7m26 78 31-8-21 14" fill="none" stroke="#8cb9a3" stroke-width="2.5"/>', grip: '#f1e4c6', light: '#fbffff', dark: '#b7cace' },
  { body: 'M132 117Q343 120 566 75Q563 125 521 145Q331 177 132 144Z', ridge: 'M145 136Q337 155 525 129L544 110Q341 146 145 136', guard: 'M121 101 137 100 144 110 140 120 145 130 139 141 140 154 122 158 114 147 119 136 113 122 119 112Z', detail: '<path d="M158 130Q200 114 240 132T322 130T404 125T493 115" fill="none" stroke="#97b6d5" stroke-width="3"/><path d="m443 64 29-8-18 17m36 99 32-12-19 20" fill="none" stroke="#657fa9" stroke-width="3"/>', grip: '#5d4558', light: '#63758e', dark: '#222e43' },
  { body: 'M132 117Q337 118 566 63Q562 111 522 140Q329 169 132 142Z', ridge: 'M145 132Q339 146 532 115L547 94Q342 136 145 132', guard: 'M125 100Q147 104 137 121Q157 130 135 138Q142 157 123 158Q105 148 119 134Q101 126 119 117Q109 103 125 100Z', detail: '<path d="M163 126Q257 124 321 130T518 103" fill="none" stroke="#ba8fe1" stroke-width="4"/><path d="m307 84 30-17-12 23 27-7m142 82 15 11-5-20 22 4" fill="none" stroke="#b087df" stroke-width="3"/>', grip: '#725190', light: '#d6b4ed', dark: '#6b5297' },
  { body: 'M132 117Q349 120 566 64L553 100 524 134Q334 163 132 140Z', ridge: 'M147 132Q344 146 536 109L547 89Q345 135 147 132', guard: 'M126 101 139 110 139 146 123 157 114 147 116 111Z', detail: '<path d="M158 125Q326 140 537 94" fill="none" stroke="#fff0ab" stroke-width="5"/><path d="m264 107 19-29 2 22 22-33 3 30m120 55 23 28-2-22 20 10-3-23m37-62 17-30 1 21 18-28-2 31" fill="none" stroke="#f2b854" stroke-width="5" stroke-linecap="round"/>', grip: '#813f31', light: '#ffd093', dark: '#d06b34' },
  { body: 'M132 118Q347 122 566 63L553 106 522 135Q334 165 132 140Z', ridge: 'M148 133Q342 150 532 113L545 92Q348 139 148 133', guard: 'M120 97 137 97 137 111 149 111 149 127 137 127 137 158 120 158 120 144 108 144 108 128 120 128Z', detail: '<path d="M155 125Q338 139 541 87" fill="none" stroke="#e87e9c" stroke-width="5"/><path d="m251 91 27-20-8 24-17 5Zm157 77 24 12-23 7-13-12Zm147-17 25-15-11 26-20 4Z" fill="#57354f" stroke="#df779b" stroke-width="2.5"/><path d="m24 136-9 12 13 9-8 12" fill="none" stroke="#a8849d" stroke-width="4"/>', grip: '#352c42', light: '#63506e', dark: '#242535' },
];

export const BLADE_FINISHES = [
  { title: '锤痕钢面 · 手缠布柄', note: '保留朴拙的锻打痕，刃口经过反复研磨，铆钉与旧缠布写下使用的痕迹。' },
  { title: '玄青折钢 · 暗纹藏锋', note: '深色钢面压入细密折纹，冷蓝刃线与小巧铜饰让短锋利落而克制。' },
  { title: '鎏金月纹 · 暖铜刀装', note: '月弧上铺开浅金波纹，铜色刀装与细小月印衬出温润、锋利的层次。' },
  { title: '碧玉嵌线 · 回纹护手', note: '碧青刀面点缀象牙色回纹，玉质嵌饰与细金边沿着刀势延伸。' },
  { title: '紫银弦光 · 环月刻纹', note: '圆弧内外采用不同银紫反光，细环刻纹与月牙线条呼应弯刀的轮廓。' },
  { title: '玄钢重脊 · 云雷金刻', note: '厚重玄钢保留宽阔斜面，金色云雷纹与刀脊铆饰增强沉稳分量。' },
  { title: '冰青刃线 · 霜晶细刻', note: '银青刀面以六瓣霜晶点缀，刃线仿佛凝了一层薄霜，刀装保持清透。' },
  { title: '素白刀装 · 清刃直纹', note: '以留白突出细长刃形，浅金细部、规整缠柄与轻细刃纹保持安静的美感。' },
  { title: '墨钢浪纹 · 黑金刀装', note: '墨色钢面叠入起伏的暗浪，研磨刃线在转动时显出银蓝反光。' },
  { title: '紫钢流纹 · 花形护手', note: '紫色流纹沿锋芒收束，花形护手以暖金包边，握柄细线与刀面呼应。' },
  { title: '赤金火脉 · 焦铜刀装', note: '暖铜色刀身刻入层叠火脉，细亮金线连接赤色刀面与焦褐握柄。' },
  { title: '漆黑月脊 · 绛红细线', note: '近黑钢面只留下克制的绛红刃线，暗纹、方形刀装与链饰增强识别度。' },
] as const;

function craftDetail(index: number, color: string) {
  const strokes: string[] = [];
  for (let i = 0; i < 24; i++) {
    const x = 148 + i * 16, y = 108 + (i * 7 % 29);
    strokes.push(`<path d="m${x} ${y} ${10 + i % 7} ${-1 - i % 2}" stroke="#fff" opacity="${.035 + i % 3 * .018}"/>`);
  }
  if (index === 0) for (let i = 0; i < 9; i++) strokes.push(`<path d="m${170 + i * 38} ${119 + i % 3 * 6} 10-2-6 5" stroke="#5f7480" opacity=".26"/>`);
  if ([1, 2, 8, 9].includes(index)) for (let i = 0; i < 5; i++) strokes.push(`<path d="M146 ${115 + i * 6}Q226 ${99 + i * 7} 300 ${122 + i * 4}T550 ${77 + i * 10}" stroke="${index === 8 ? '#8eb4d0' : '#fff2cd'}" opacity="${index === 1 ? .15 : .22}"/>`);
  if ([3, 5].includes(index)) for (let i = 0; i < 8; i++) strokes.push(`<path d="m${161 + i * 44} 114h12v8h-6v-4h-5m-1 11h13v9h-6v-4h-6" stroke="${color}" opacity=".45"/>`);
  if (index === 4) for (let i = 0; i < 6; i++) strokes.push(`<circle cx="${200 + i * 53}" cy="${150 - i * 4}" r="${11 + i % 2 * 5}" stroke="#fff6ff" opacity=".3"/>`);
  if (index === 6) for (let i = 0; i < 6; i++) {
    const x = 180 + i * 59, y = 125 - i * 3;
    strokes.push(`<path d="M${x - 8} ${y}h16m-12-7 8 14m-8 0 8-14m-9 2 3 1 1-3m3 14-1-3 3-1" stroke="#e9ffff" opacity=".8"/>`);
  }
  if (index === 7) strokes.push('<path d="M146 136Q280 151 420 130T551 105" stroke="#d4cfae" opacity=".55"/><path d="M146 132Q310 143 547 100" stroke="#fff" opacity=".9"/>');
  if (index === 10) for (let i = 0; i < 7; i++) strokes.push(`<path d="m${175 + i * 48} ${130 - i * 4} 8-12 2 10 14-22-4 19" stroke="#fff0b0" opacity=".5"/>`);
  if (index === 11) for (let i = 0; i < 12; i++) strokes.push(`<path d="m${155 + i * 30} ${126 - i} 14-8-7 11" stroke="#cc7795" opacity=".22"/>`);
  return `<g clip-path="url(#blade-clip)" fill="none" stroke-width="1.1">${strokes.join('')}</g>`;
}

export const BLADE_ART: Record<string, string> = Object.fromEntries(BLADE_DESIGNS.flatMap((design, i) => {
  const color = TIERS[i].color;
  const defs = `<defs><linearGradient id="metal" x1="0" y1="0" x2=".2" y2="1"><stop stop-color="${design.light}"/><stop offset=".27" stop-color="${design.light}"/><stop offset=".45" stop-color="${design.dark}"/><stop offset=".51" stop-color="${design.light}"/><stop offset=".58" stop-color="${design.dark}"/><stop offset="1" stop-color="${design.light}"/></linearGradient><linearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".96"/><stop offset="1" stop-color="${color}"/></linearGradient><linearGradient id="gold" x2=".1" y2="1"><stop stop-color="#fff0c4"/><stop offset=".45" stop-color="#c8a15f"/><stop offset=".65" stop-color="#f4d89b"/><stop offset="1" stop-color="#9a7544"/></linearGradient><clipPath id="blade-clip"><path d="${design.body}"/></clipPath></defs>`;
  const wrap = (content: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="256" viewBox="0 0 640 256">${defs}<g stroke="#30485b" stroke-width="3" stroke-linejoin="round">${content}</g></svg>`;
  const bindings = Array.from({ length: 7 }, (_, j) => `<path d="m${33 + j * 12} 116 10 24m-10 0 10-24" fill="none" stroke="${design.light}" stroke-width="2" opacity=".44"/>`).join('');
  const hilt = `<path d="M28 116 126 112 133 142 28 140 18 128Z" fill="${design.grip}"/>${bindings}<path d="M25 118v20m83-24v28" stroke="${design.light}" stroke-width="4" opacity=".7"/><path d="${design.guard}" fill="${i < 2 ? design.dark : 'url(#gold)'}"/><path d="${design.guard}" fill="none" stroke="#fff0c4" stroke-width="1" opacity=".48"/><circle cx="32" cy="128" r="4" fill="${color}" stroke="#ffe7ae" stroke-width="1.5"/><circle cx="32" cy="127" r="1.4" fill="#fff" stroke="none"/>`;
  const body = `<path d="${design.body}" fill="url(#metal)"/><path d="${design.ridge}" fill="url(#edge)" stroke="none" opacity=".75"/>${craftDetail(i, color)}${design.detail}`;
  return [[`blade-${i + 1}`, wrap(`${body}${hilt}`)], [`blade-${i + 1}-body`, wrap(body)], [`blade-${i + 1}-hilt`, wrap(hilt)]].map(([key, source]) => [key, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`]);
}));
