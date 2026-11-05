import Phaser from 'phaser';
import { ASSETS } from '../assets';
import { carrotAppearance } from '../carrot-appearance';
import { bladePresentation } from '../feedback';
import { swingPhase } from '../equipment';
import type { FormId } from '../evolution/types';
import { RENDITION_LAYOUT } from '../assets/carrot-sword/rendition-layout';
import { WeaponVFX, type WeaponVFXPose } from './WeaponVFX';
import { WEAPON_VFX_PROFILES, previewElements, type VFXPreviewPreset } from './profiles';
import { WEAPON_VFX_CONFIG as C } from './config';
import './preview.css';

export const WEAPON_VFX_PREVIEW_KEY = 'weapon-vfx-preview';
type PreviewForm = 'base' | FormId;

/** Isolated art bench: no BladeRun, enemy simulation, rewards or save changes. */
export class WeaponVFXPreviewScene extends Phaser.Scene {
  private vfx?: WeaponVFX;
  private grid?: Phaser.GameObjects.Graphics;
  private marker?: Phaser.GameObjects.Graphics;
  private panel?: HTMLDivElement;
  private metrics?: HTMLElement;
  private listeners?: AbortController;
  private exit?: () => void;
  private form: PreviewForm = 'base';
  private element: VFXPreviewPreset = 'none';
  private angle = C.preview.defaultAngle;
  private size = 1;
  private attackAge = -1;
  private attackSerial = 0;
  private metricAge = 0;
  private motion = true;
  private simplified = false;
  private baseArt = false;
  private pose?: WeaponVFXPose;
  constructor() { super(WEAPON_VFX_PREVIEW_KEY); }

  init(data: { onExit?: () => void; reducedMotion?: boolean; simplified?: boolean }) {
    this.exit = data.onExit; this.motion = !data.reducedMotion; this.simplified = !!data.simplified;
    this.form = 'base'; this.element = 'none'; this.angle = C.preview.defaultAngle; this.size = 1;
    this.attackAge = -1; this.attackSerial = 0; this.metricAge = 0; this.pose = undefined;
    this.baseArt = false;
  }

  preload() {
    for (const [key, url] of Object.entries(ASSETS)) {
      if (key.startsWith('carrot-rendition-') && !this.textures.exists(key)) this.load.image(key, url);
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#142434');
    this.grid = this.add.graphics().setDepth(0);
    this.marker = this.add.graphics().setDepth(1);
    this.vfx = new WeaponVFX(this, 10);
    this.vfx.reducedMotion = !this.motion; this.vfx.simplified = this.simplified;
    this.listeners = new AbortController();
    const signal = this.listeners.signal;
    const panel = this.panel = document.createElement('div');
    panel.className = 'weapon-vfx-preview'; panel.setAttribute('aria-label', '武器特效预览');
    panel.innerHTML = `<header><div><small>WEAPON VFX PREVIEW</small><h1>胡萝卜剑 · 动态光晕</h1></div><button data-vfx="exit">返回游戏</button></header>
      <div class="vfx-hint">待机、拖尾、命中与战斗共用。火 ${WEAPON_VFX_PROFILES.fire.timing.breath} 秒 · 冰 ${WEAPON_VFX_PROFILES.ice.timing.breath} 秒 · 毒 ${WEAPON_VFX_PROFILES.poison.timing.breath} 秒，电弧 ${C.lightning.duration[0]}～${C.lightning.duration[1]} 秒。</div>
      <output class="vfx-metrics" aria-live="off"></output>
      <section class="vfx-controls" aria-label="预览控制">
        <div class="vfx-selects"><label>武器形态<select data-vfx="form"><option value="base">基础剑</option><option value="greatsword">巨剑</option><option value="dual">双刃</option><option value="wave">剑气</option></select></label>
        <label>元素效果<select data-vfx="element">${Object.entries(WEAPON_VFX_PROFILES).map(([key, p]) => `<option value="${key}">${p.name}</option>`).join('')}<option value="calamity">火＋冰＋毒</option><option value="stormFirePoison">雷＋火＋毒</option></select></label></div>
        <div class="vfx-sliders"><label>尺寸 <input data-vfx="size" aria-label="武器尺寸" type="range" min="0.5" max="1.65" step="0.05" value="1"></label><label>旋转 <input data-vfx="angle" aria-label="武器旋转" type="range" min="-180" max="180" step="1" value="-20"></label></div>
        <div class="vfx-buttons"><button data-vfx="attack">挥砍</button><button data-vfx="hit">测试命中</button><button data-vfx="reaction">融合特效</button><button data-vfx="clear">清空特效</button></div>
        <div class="vfx-checks"><label><input type="checkbox" data-vfx="motion" ${this.motion ? 'checked' : ''}>动态效果</label><label><input type="checkbox" data-vfx="quality" ${this.simplified ? 'checked' : ''}>简化特效</label><label><input type="checkbox" data-vfx="base-art">基础剑对照</label></div>
        <p>空格：挥砍 · H：命中 · R：融合 · Esc：返回</p>
      </section>`;
    document.body.append(panel);
    this.metrics = panel.querySelector<HTMLElement>('.vfx-metrics')!;
    panel.addEventListener('click', e => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-vfx]');
      if (button) this.action(button.dataset.vfx!);
    }, { signal });
    panel.addEventListener('input', e => {
      const input = e.target as HTMLInputElement;
      switch (input.dataset.vfx) {
        case 'form': this.form = input.value as PreviewForm; this.clear(); break;
        case 'element': this.element = input.value as VFXPreviewPreset; this.clear(); break;
        case 'size': this.size = Number(input.value); this.vfx?.reset(); break;
        case 'angle': this.angle = Number(input.value) * Math.PI / 180; this.vfx?.reset(); break;
        case 'motion': this.motion = input.checked; this.vfx!.reducedMotion = !input.checked; break;
        case 'quality': this.vfx!.simplified = input.checked; this.vfx!.reset(); break;
        case 'base-art': this.baseArt=input.checked; break;
      }
    }, { signal });
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); this.close(); return; }
      if (event.repeat || event.target instanceof HTMLElement && event.target.closest('input,select,textarea')) return;
      if (event.key === ' ' && event.target instanceof HTMLElement && event.target.closest('button')) return;
      const action = ({ ' ': 'attack', h: 'hit', r: 'reaction' } as Record<string, string>)[event.key.toLowerCase()];
      if (action) { event.preventDefault(); this.action(action); }
    }, { signal });
    panel.querySelector<HTMLButtonElement>('[data-vfx="attack"]')?.focus({ preventScroll: true });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
  }

  private action(action: string) {
    if (action === 'exit') { this.close(); return; }
    if (action === 'attack') { this.attackAge = 0; this.attackSerial++; return; }
    if (action === 'clear') { this.clear(); return; }
    if (!this.pose || !this.vfx) return;
    const length = this.pose.scaleX * (RENDITION_LAYOUT.tip[0] - RENDITION_LAYOUT.grip[0]);
    const x = this.pose.x + Math.cos(this.pose.angle) * length, y = this.pose.y + Math.sin(this.pose.angle) * length;
    if (action === 'hit') this.vfx.hit(x, y);
    if (action === 'reaction') this.vfx.reaction(x, y);
  }

  private clear() { this.attackAge = -1; this.vfx?.reset(); }
  private close() { if (this.exit) this.exit(); else this.scene.stop(); }
  private cleanup() {
    this.listeners?.abort(); this.listeners = undefined;
    this.panel?.remove(); this.panel = undefined; this.metrics = undefined;
    this.vfx?.destroy(); this.vfx = undefined; this.pose = undefined;
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
  }

  update(_time: number, deltaMs: number) {
    if (!this.vfx) return;
    const dt = Math.min(.05, deltaMs / 1000);
    const ratio = this.scale.width / Math.max(1, this.game.canvas.clientWidth);
    const width = this.scale.width / ratio, height = this.scale.height / ratio;
    this.cameras.main.setZoom(ratio).centerOn(width / 2, height / 2);
    const grid = this.grid!.clear().lineStyle(1, 0x65849b, .1);
    for (let x = 0; x < width; x += 36) grid.lineBetween(x, 0, x, height);
    for (let y = 0; y < height; y += 36) grid.lineBetween(0, y, width, y);
    const controls = this.panel!.querySelector('.vfx-controls')!.getBoundingClientRect();
    const landscape = height <= 520 && width >= 620;
    const areaWidth = landscape ? controls.left - 12 : width;
    const areaTop = Math.min(160, height * .3), areaBottom = landscape ? height - 18 : Math.max(areaTop + 60, controls.top - 24);
    const cy = (areaTop + areaBottom) / 2;
    const length = Math.min(areaWidth * .4, Math.max(60, areaBottom - areaTop) * .55, 210) * this.size * (this.form === 'greatsword' ? 1.25 : this.form === 'dual' ? .82 : 1);
    const x = areaWidth * .32, y = cy;
    const timing = { age: this.attackAge, windup: C.preview.windup, strike: C.preview.strike, recovery: C.preview.recovery, angle: this.angle };
    const swing = this.attackAge >= 0 ? timing : null;
    const angle = swing ? bladePresentation(swing, this.angle, Math.PI / 2, 1, this.angle).angle : this.angle;
    const elements=previewElements(this.element);
    this.pose = { x, y, angle, scaleX: length / (RENDITION_LAYOUT.tip[0] - RENDITION_LAYOUT.grip[0]),
      scaleY: length / (RENDITION_LAYOUT.tip[0] - RENDITION_LAYOUT.grip[0]),
      texture: carrotAppearance(this.form === 'base' ? null : this.form, this.baseArt?previewElements('none'):elements),
      attackId: swing ? this.attackSerial : undefined, striking: !!swing && swingPhase(swing).phase === 'strike' };
    this.vfx.setElements(elements); this.vfx.setPose(this.pose); this.vfx.update(dt);
    const marker = this.marker!.clear();
    marker.lineStyle(1, 0x90adc4, .4).strokeCircle(x, y, 5).lineBetween(x - 10, y, x + 10, y).lineBetween(x, y - 10, x, y + 10);
    if (this.attackAge >= 0 && (this.attackAge += dt) > timing.windup+timing.strike+timing.recovery) this.attackAge = -1;
    this.metricAge += dt;
    if (this.metricAge > C.preview.metricInterval && this.metrics) {
      this.metricAge = 0; const count = this.vfx.counts;
      const state={idle:'待机',attack:'攻击',hit:'命中'}[this.vfx.diagnostics.state];
      this.metrics.textContent = `${state} · FPS ${Math.round(this.game.loop.actualFps)} · 活跃特效 ${count.total}\n光晕 ${count.auras} / 电弧 ${count.electricArcs} / 粒子 ${count.particles} / 拖尾段 ${count.trail}\n火 ${count.elemental.fire} / 冰 ${count.elemental.ice} / 毒 ${count.elemental.poison} / 命中 ${count.hits}\n光晕透明度 ${count.auraAlpha.toFixed(2)}`;
    }
  }
}
