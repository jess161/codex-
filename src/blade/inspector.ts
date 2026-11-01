import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TIERS, BLADE_CATALOGUE, BASIC_WEAPON_INDICES, isBasicWeapon } from './config';
import { BLADE_ART, BLADE_FINISHES } from './blade-art';
import { createBladeModel, disposeBladeModel } from './blade-model';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export class BladeInspector {
  readonly root = document.createElement('aside');
  private surface: HTMLElement;
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.OrthographicCamera;
  private model?: THREE.Group;
  private environment?: THREE.WebGLRenderTarget;
  private observer?: ResizeObserver;
  private pointers = new Map<number, { x: number; y: number }>();
  private rotation = new THREE.Quaternion();
  private zoom = 1;
  private auto = false;
  private frame = 0;
  private lastFrame = 0;
  private generation = 0;
  private index = 0;
  private flatAngle = -8;
  private opener?: HTMLElement;
  get active() { return !this.root.hidden; }
  constructor() {
    this.root.className = 'blade-inspector'; this.root.hidden = true;
    this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-modal', 'true'); this.root.setAttribute('aria-labelledby', 'inspector-title');
    this.root.innerHTML = `<section class="inspector-panel"><header class="inspector-header"><div><span class="eyebrow">THE BLADE ATELIER</span><h2 id="inspector-title"></h2><small id="inspector-source"></small></div><button data-inspect="close" class="inspector-close" aria-label="关闭武器鉴赏">✕</button></header><div class="inspector-layout"><div class="inspector-display"><div class="inspector-surface" tabindex="0" role="application" aria-label="武器鉴赏区域，拖动旋转，滚轮或双指缩放，方向键旋转，R 复位"><div class="inspector-orbit"></div><img class="inspector-flat" alt=""><span id="inspector-mode">正在展开果蔬武器</span></div><div class="inspector-controls"><button data-inspect="auto" aria-pressed="false">⟳ 自动转台</button><button data-inspect="reset">↺ 复位</button><span></span><button data-inspect="out" aria-label="缩小武器">−</button><output id="inspector-zoom">100%</output><button data-inspect="in" aria-label="放大武器">＋</button></div><p class="inspector-hint">拖动任意旋转 · 滚轮 / 双指缩放 · 双击复位</p></div><article class="inspector-notes"><span class="eyebrow">CRAFT & DETAIL</span><h3 id="inspector-finish"></h3><p id="inspector-craft"></p><div class="inspector-materials"><span>鲜亮高光</span><span>果蔬本色</span><span>深蓝轮廓</span></div><p id="inspector-lore"></p><small>造型与工艺为本作艺术演绎</small><nav class="inspector-switch"><button data-inspect="prev" aria-label="鉴赏上一把武器">←</button><select id="inspector-choice" aria-label="选择鉴赏的武器">${BLADE_CATALOGUE.map(({blade:t, index:i}) => `<option value="${i}">${t.name}</option>`).join('')}</select><button data-inspect="next" aria-label="鉴赏下一把武器">→</button></nav></article></div></section>`;
    document.body.append(this.root); this.surface = this.root.querySelector('.inspector-surface')!;
    this.root.addEventListener('click', event => {
      if (event.target === this.root) { this.close(); return; }
      const command = (event.target as HTMLElement).closest<HTMLElement>('[data-inspect]')?.dataset.inspect;
      if (command === 'close') this.close();
      if (command === 'auto') { this.auto = !this.auto; this.updateControls(); this.requestFrame(); }
      if (command === 'reset') this.reset();
      if (command === 'in' || command === 'out') this.setZoom(this.zoom * (command === 'in' ? 1.2 : 1 / 1.2));
      if (command === 'prev' || command === 'next') void this.load(BASIC_WEAPON_INDICES[(BASIC_WEAPON_INDICES.findIndex(i => i === this.index) + (command === 'next' ? 1 : -1) + BASIC_WEAPON_INDICES.length) % BASIC_WEAPON_INDICES.length]);
    });
    this.root.querySelector('select')!.addEventListener('change', event => void this.load(Number((event.target as HTMLSelectElement).value)));
    window.addEventListener('keydown', event => { if (this.active) this.key(event); }, { capture: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stopFrames(); else if (this.active) this.requestFrame(); });
    this.surface.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault(); this.surface.focus({ preventScroll: true }); this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); this.surface.setPointerCapture(event.pointerId);
      this.auto = false; this.updateControls();
    });
    this.surface.addEventListener('pointermove', event => {
      const before = this.pointers.get(event.pointerId); if (!before) return;
      event.preventDefault();
      if (this.pointers.size === 1) {
        const a = this.trackball(before.x, before.y), b = this.trackball(event.clientX, event.clientY);
        this.rotation.premultiply(new THREE.Quaternion().setFromUnitVectors(a, b)); this.flatAngle += (event.clientX - before.x) * .6 + (event.clientY - before.y) * .2;
      } else {
        const other = [...this.pointers.entries()].find(([id]) => id !== event.pointerId)![1];
        const distance = Math.hypot(before.x - other.x, before.y - other.y);
        if (distance > 10) this.zoom = clamp(this.zoom * Math.hypot(event.clientX - other.x, event.clientY - other.y) / distance, .55, 2.1);
      }
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); this.updateControls(); this.requestFrame();
    });
    const release = (event: PointerEvent) => { this.pointers.delete(event.pointerId); if (this.surface.hasPointerCapture(event.pointerId)) this.surface.releasePointerCapture(event.pointerId); };
    this.surface.addEventListener('pointerup', release); this.surface.addEventListener('pointercancel', release); this.surface.addEventListener('lostpointercapture', event => this.pointers.delete(event.pointerId));
    this.surface.addEventListener('wheel', event => { event.preventDefault(); this.setZoom(this.zoom * Math.exp(-event.deltaY * .001)); }, { passive: false });
    this.surface.addEventListener('dblclick', () => this.reset());
  }
  async open(index: number) {
    if (!Number.isInteger(index) || !isBasicWeapon(index)) return;
    if (this.active) { await this.load(index); return; }
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.root.hidden = false; document.querySelector<HTMLElement>('#app')!.inert = true;
    this.observer = new ResizeObserver(() => { this.pointers.clear(); this.resize(); }); this.observer.observe(this.surface);
    try {
      const canvas = document.createElement('canvas'), context = canvas.getContext('webgl2', { alpha: true, antialias: true });
      if (context) {
        this.renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true }); this.renderer.setPixelRatio(Math.min(1.6, devicePixelRatio));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.15;
        this.scene = new THREE.Scene(); this.camera = new THREE.OrthographicCamera(-400, 400, 200, -200, .1, 2000); this.camera.position.z = 900;
        const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(this.renderer); this.environment = pmrem.fromScene(room, .04); this.scene.environment = this.environment.texture; room.dispose(); pmrem.dispose();
        this.scene.add(new THREE.HemisphereLight(0xe3f5ff, 0x60513d, 1.8));
        const key = new THREE.DirectionalLight(0xfff0d8, 3.5); key.position.set(-180, 260, 500); this.scene.add(key);
        const rim = new THREE.DirectionalLight(0xb8deff, 2); rim.position.set(160, -100, -350); this.scene.add(rim);
        canvas.setAttribute('aria-hidden', 'true'); this.surface.append(canvas);
        const renderer = this.renderer;
        canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); if (this.active && this.renderer === renderer) this.fallback(); });
        this.root.dataset.mode = 'webgl';
      } else this.root.dataset.mode = 'flat';
    } catch { this.fallback(); }
    this.surface.focus({ preventScroll: true }); await this.load(index);
  }
  private async load(index: number) {
    const revision = ++this.generation; this.index = index;
    const t = TIERS[index], finish = BLADE_FINISHES[index];
    this.root.style.setProperty('--tier', t.color);
    this.root.querySelector('#inspector-title')!.textContent = t.name; this.root.querySelector('#inspector-source')!.textContent = `${t.source} · ${t.bearer}`;
    this.root.querySelector('.inspector-materials span')?.replaceChildren(document.createTextNode(index===17?'香蕉果皮':'胡萝卜根纹'));
    this.root.querySelector('#inspector-finish')!.textContent = finish.title; this.root.querySelector('#inspector-craft')!.textContent = finish.note; this.root.querySelector('#inspector-lore')!.textContent = t.lore;
    (this.root.querySelector('#inspector-choice') as HTMLSelectElement).value = String(index);
    const image = this.root.querySelector<HTMLImageElement>('.inspector-flat')!; image.src = BLADE_ART[`blade-${index + 1}`]; image.alt = t.name;
    if (this.model) { this.scene?.remove(this.model); disposeBladeModel(this.model); this.model = undefined; }
    this.root.dataset.ready = 'false'; this.reset();
    if (this.renderer) {
      try {
        const model = await createBladeModel(index);
        if (!this.active || revision !== this.generation) { disposeBladeModel(model); return; }
        this.model = model; this.scene!.add(model);
      } catch { if (revision === this.generation && this.active) this.fallback(); }
    }
    if (!this.active || revision !== this.generation) return;
    this.root.dataset.ready = 'true'; this.root.querySelector('#inspector-mode')!.textContent = this.renderer ? '立体鉴赏 · 任意旋转' : '平面鉴赏 · 旋转与缩放';
    this.resize(); this.requestFrame();
  }
  private trackball(x: number, y: number) {
    const r = this.surface.getBoundingClientRect(), radius = Math.min(r.width, r.height) * .8;
    const point = new THREE.Vector3((x - r.left - r.width / 2) / radius, (r.top + r.height / 2 - y) / radius, 0), length = point.lengthSq();
    point.z = length <= .5 ? Math.sqrt(1 - length) : .5 / Math.sqrt(length); return point.normalize();
  }
  private reset() { this.rotation.setFromEuler(new THREE.Euler(-.28, .28, -.12)); this.zoom = 1; this.flatAngle = -8; this.auto = false; this.pointers.clear(); this.updateControls(); this.requestFrame(); }
  private setZoom(zoom: number) { this.zoom = clamp(zoom, .55, 2.1); this.updateControls(); this.requestFrame(); }
  private updateControls() {
    this.root.querySelector('#inspector-zoom')!.textContent = `${Math.round(this.zoom * 100)}%`;
    this.root.querySelector('[data-inspect="auto"]')!.setAttribute('aria-pressed', String(this.auto));
    this.surface.dataset.rotation = this.rotation.toArray().map(n => n.toFixed(4)).join(','); this.surface.dataset.zoom = this.zoom.toFixed(3);
  }
  private key(event: KeyboardEvent) {
    event.stopImmediatePropagation();
    if (event.key === 'Escape') { event.preventDefault(); this.close(); return; }
    if (event.key === 'Tab') {
      const focusable = [...this.root.querySelectorAll<HTMLElement>('button,select,[tabindex="0"]')];
      const at = focusable.indexOf(document.activeElement as HTMLElement), next = (at + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
      event.preventDefault(); focusable[next].focus(); return;
    }
    if (document.activeElement instanceof HTMLSelectElement) return;
    const key = event.key.toLowerCase();
    if (key.startsWith('arrow')) {
      event.preventDefault(); this.auto = false;
      const axis = event.shiftKey ? new THREE.Vector3(0, 0, 1) : key === 'arrowleft' || key === 'arrowright' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      this.rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, key === 'arrowleft' || key === 'arrowdown' ? -.16 : .16)); this.flatAngle += key === 'arrowleft' || key === 'arrowdown' ? -8 : 8;
    } else if (key === 'r') this.reset();
    else if (key === 'a' || key === ' ') { event.preventDefault(); this.auto = !this.auto; }
    else if (key === '+' || key === '=') this.setZoom(this.zoom * 1.2);
    else if (key === '-') this.setZoom(this.zoom / 1.2);
    this.updateControls(); this.requestFrame();
  }
  private resize() {
    if (!this.active) return;
    const width = this.surface.clientWidth, height = this.surface.clientHeight;
    if (this.renderer && this.camera && width && height) {
      this.renderer.setSize(width, height);
      const worldWidth = Math.max(650, 340 * width / height), worldHeight = worldWidth * height / width;
      this.camera.left = -worldWidth / 2; this.camera.right = worldWidth / 2; this.camera.top = worldHeight / 2; this.camera.bottom = -worldHeight / 2; this.camera.updateProjectionMatrix();
    }
    this.requestFrame();
  }
  private requestFrame() { if (!this.frame && this.active && !document.hidden) this.frame = requestAnimationFrame(time => this.render(time)); }
  private render(time: number) {
    this.frame = 0;
    const dt = this.lastFrame ? Math.min(.05, (time - this.lastFrame) / 1000) : 0; this.lastFrame = time;
    if (this.auto) { this.rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dt * .55)); this.flatAngle += dt * 18; this.updateControls(); }
    if (this.model) this.model.quaternion.copy(this.rotation);
    if (this.renderer && this.scene && this.camera) { this.camera.zoom = this.zoom; this.camera.updateProjectionMatrix(); this.renderer.render(this.scene, this.camera); }
    this.root.querySelector<HTMLImageElement>('.inspector-flat')!.style.transform = `rotate(${this.flatAngle}deg) scale(${this.zoom})`;
    if (this.auto) this.requestFrame();
  }
  private stopFrames() { cancelAnimationFrame(this.frame); this.frame = 0; this.lastFrame = 0; }
  private fallback() {
    this.stopFrames();
    if (this.model) { disposeBladeModel(this.model); this.model = undefined; }
    const renderer = this.renderer; this.renderer = undefined;
    if (renderer) { renderer.domElement.remove(); renderer.dispose(); if (!renderer.getContext().isContextLost()) renderer.forceContextLoss(); }
    this.environment?.dispose(); this.environment = undefined; this.scene = undefined; this.camera = undefined; this.root.dataset.mode = 'flat';
    this.root.querySelector('#inspector-mode')!.textContent = '平面鉴赏 · 旋转与缩放'; this.requestFrame();
  }
  close() {
    if (!this.active) return;
    this.root.hidden = true; this.generation++; this.auto = false;
    for (const id of this.pointers.keys()) if (this.surface.hasPointerCapture(id)) this.surface.releasePointerCapture(id);
    this.pointers.clear(); this.stopFrames(); this.observer?.disconnect();
    this.fallback(); document.querySelector<HTMLElement>('#app')!.inert = false;
    if (this.opener?.isConnected) this.opener.focus({ preventScroll: true });
  }
}
