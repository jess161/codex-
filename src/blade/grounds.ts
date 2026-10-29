export const GROUNDS = [
  { id: 'grid', name: '几何训练场', description: '细网格与刻度，移动方向最清楚', base: '#eaf0f5', dark: false },
  { id: 'meadow', name: '微风草原', description: '低饱和草簇与卵石，轻松自然', base: '#e5eddf', dark: false },
  { id: 'dunes', name: '暮金沙海', description: '柔和沙纹与碎石，温暖开阔', base: '#f4ebd8', dark: false },
  { id: 'ruins', name: '青石遗迹', description: '错缝石板与残纹，经过之处可辨', base: '#e7eae4', dark: false },
  { id: 'night', name: '星夜幻境', description: '深蓝星点与星轨，突出华丽刀光', base: '#263b50', dark: true },
  { id: 'classic', name: '经典点阵', description: '保留原来的极简浅色战场', base: '#f3f6f9', dark: false },
] as const;
export type GroundId = typeof GROUNDS[number]['id'];
export const isGroundId = (id: unknown): id is GroundId => GROUNDS.some(ground => ground.id === id);
export const groundInfo = (id: GroundId) => GROUNDS.find(ground => ground.id === id)!;
const patterns = new Map<GroundId, HTMLCanvasElement>();
const previews = new Map<GroundId, string>();

// Rendering uses its own stable seed. Changing scenery never consumes combat RNG.
function randomSource(seed: number) {
  return () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
}
function pebble(c: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, size, size * .65, -.4, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#ffffff55'; c.lineWidth = .8; c.beginPath(); c.moveTo(x - size * .55, y - size * .2); c.lineTo(x + size * .1, y - size * .45); c.stroke();
}

export function groundPattern(id: GroundId): HTMLCanvasElement {
  const cached = patterns.get(id); if (cached) return cached;
  const canvas = document.createElement('canvas'), size = id === 'classic' ? 40 : 576;
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d')!;
  c.fillStyle = groundInfo(id).base; c.fillRect(0, 0, size, size);
  const random = randomSource(4381);
  if (id === 'classic') {
    c.fillStyle = 'rgba(160,185,203,.44)'; c.beginPath(); c.arc(20, 20, .8, 0, Math.PI * 2); c.fill();
  } else if (id === 'grid') {
    c.lineWidth = .9; c.strokeStyle = '#bdcddba6'; c.beginPath();
    for (let n = 0; n <= size; n += 48) { c.moveTo(n, 0); c.lineTo(n, size); c.moveTo(0, n); c.lineTo(size, n); }
    c.stroke();
    c.lineWidth = 1.1; c.strokeStyle = '#aebfd073'; c.beginPath();
    for (let n = 0; n <= size; n += 288) { c.moveTo(n, 0); c.lineTo(n, size); c.moveTo(0, n); c.lineTo(size, n); }
    c.stroke();
    for (const [x, y] of [[144, 144], [432, 432]]) {
      c.strokeStyle = '#8fa9bd88'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x + 6, y); c.moveTo(x, y - 6); c.lineTo(x, y + 6); c.stroke();
      c.strokeStyle = '#c9ac794d'; c.beginPath(); c.arc(x, y, 17, .2, 1.8); c.stroke();
    }
    c.strokeStyle = '#a1b6c475'; c.lineWidth = 1.5;
    for (const [x, y] of [[78, 260], [370, 74]]) {
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 9, y); c.moveTo(x, y + 5); c.lineTo(x + 5, y + 5); c.stroke();
    }
  } else if (id === 'meadow') {
    for (let i = 0; i < 24; i++) {
      const x = 35 + random() * 506, y = 35 + random() * 506;
      c.fillStyle = i % 2 ? '#d9e5d254' : '#ccdcbc45'; c.beginPath(); c.ellipse(x, y, 13 + random() * 23, 7 + random() * 11, random(), 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 32; i++) {
      const x = i === 0 ? 130 : 22 + random() * 532, y = i === 0 ? 87 : 22 + random() * 532;
      c.strokeStyle = i % 3 ? '#9cb48a91' : '#adbd9b99'; c.lineWidth = 1.2; c.lineCap = 'round'; c.beginPath();
      c.moveTo(x, y + 3); c.quadraticCurveTo(x - 1, y - 4, x - 5, y - 6);
      c.moveTo(x + 1, y + 3); c.quadraticCurveTo(x + 2, y - 5, x + 5, y - 9);
      c.moveTo(x, y + 3); c.lineTo(x, y - 7); c.stroke();
    }
    for (const [x, y] of [[246, 116], [87, 338], [416, 463]]) { pebble(c, x, y, 5, '#b8c4ae88'); pebble(c, x + 10, y + 4, 2.7, '#bac6af80'); }
    c.strokeStyle = '#b9caa246'; c.lineWidth = 2; c.beginPath(); c.ellipse(329, 305, 40, 27, -.5, .1, 2.5); c.stroke();
  } else if (id === 'dunes') {
    for (let row = -1; row <= 13; row++) {
      c.strokeStyle = row % 3 ? '#dcc89f7d' : '#d3bc9166'; c.lineWidth = row % 3 ? 1 : 1.4; c.beginPath();
      for (let x = 0; x <= size; x += 6) {
        const y = row * 48 + 16 + Math.sin(x / size * Math.PI * 4) * 10;
        if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
    for (const [x, y] of [[109, 102], [395, 351], [250, 484]]) {
      pebble(c, x, y, 5.5, '#c6af8b85'); pebble(c, x + 12, y + 2, 2.4, '#d0bb9a99');
      c.strokeStyle = '#baa27c60'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + 21, y + 8); c.lineTo(x + 30, y + 7); c.stroke();
    }
    for (let i = 0; i < 58; i++) { c.fillStyle = '#bda98240'; c.fillRect(5 + random() * 566, 5 + random() * 566, 1.3, 1); }
  } else if (id === 'ruins') {
    for (let row = 0; row < 8; row++) for (let col = -1; col < 7; col++) {
      const x = col * 96 + (row % 2) * 48, y = row * 72;
      c.fillStyle = ((col + row * 3 + 20) % 5) === 0 ? '#dce1d887' : '#eff0e82a'; c.fillRect(x + 2, y + 2, 92, 68);
      c.strokeStyle = '#bfc8bb8f'; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, 96, 72);
    }
    c.strokeStyle = '#aebba677'; c.lineWidth = 1.1;
    for (const [x, y] of [[99, 74], [386, 290], [195, 432]]) {
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 12, y + 9); c.lineTo(x + 9, y + 18); c.lineTo(x + 25, y + 26); c.moveTo(x + 12, y + 9); c.lineTo(x + 21, y + 7); c.stroke();
    }
    c.strokeStyle = '#acb8a25e'; c.lineWidth = 1.5; c.beginPath(); c.arc(264, 171, 21, .4, 2.3); c.stroke(); c.beginPath(); c.arc(264, 171, 14, 3.3, 5.6); c.stroke();
    pebble(c, 277, 194, 3, '#aebba864');
  } else {
    c.strokeStyle = '#809cb41c'; c.lineWidth = .8; c.beginPath();
    for (let n = 0; n <= size; n += 96) { c.moveTo(n, 0); c.lineTo(n, size); c.moveTo(0, n); c.lineTo(size, n); } c.stroke();
    for (let i = 0; i < 48; i++) {
      const x = 14 + random() * 548, y = 14 + random() * 548;
      c.fillStyle = i % 5 ? '#91abc152' : '#b1c7d468'; c.beginPath(); c.arc(x, y, i % 5 ? .9 : 1.4, 0, Math.PI * 2); c.fill();
    }
    c.lineWidth = .9; c.strokeStyle = '#87a9be38';
    for (const [x, y] of [[100, 78], [362, 357]]) {
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 31, y - 16); c.lineTo(x + 58, y + 11); c.lineTo(x + 42, y + 38); c.stroke();
      c.fillStyle = '#9fb9c46e'; for (const [dx, dy] of [[0, 0], [31, -16], [58, 11], [42, 38]]) { c.beginPath(); c.arc(x + dx, y + dy, 1.8, 0, Math.PI * 2); c.fill(); }
    }
    c.strokeStyle = '#8cb2c528'; c.lineWidth = 1; c.beginPath(); c.arc(285, 185, 42, .3, 2); c.stroke();
  }
  patterns.set(id, canvas); return canvas;
}

export function groundPreview(id: GroundId) {
  const cached = previews.get(id); if (cached) return cached;
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 120;
  const context = canvas.getContext('2d')!; context.scale(.75, .75); context.fillStyle = context.createPattern(groundPattern(id), 'repeat')!; context.fillRect(0, 0, 320, 160);
  const url = canvas.toDataURL('image/png'); previews.set(id, url); return url;
}
