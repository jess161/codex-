import type { EnemyKind } from './config';
import { monsterVoice, playMonsterVoice, voiceNoise } from './monster-voices';

export class BladeAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private lastHit = 0;
  private lastPickup = 0;
  private lastPassive = 0;
  private melody = 0;
  private noise?: AudioBuffer;
  private lastMonster = -Infinity;
  private familyTimes = new Map<string, number>();
  monsterEnabled = true;
  private audible = true;
  get enabled() { return this.audible; }
  set enabled(value: boolean) {
    this.audible = value;
    if (this.master && this.context) { this.master.gain.cancelScheduledValues(this.context.currentTime); this.master.gain.setTargetAtTime(value ? .23 : 0,this.context.currentTime,.008); }
  }
  unlock() {
    if (!this.context) {
      try {
        const Context = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; this.context = new Context(); this.master = this.context.createGain(); this.master.gain.value = this.enabled ? .23 : 0;
        const limiter = this.context.createDynamicsCompressor(); limiter.threshold.value = -18; limiter.knee.value = 12; limiter.ratio.value = 5; limiter.attack.value = .005; limiter.release.value = .12;
        this.master.connect(limiter); limiter.connect(this.context.destination); this.noise = voiceNoise(this.context);
      } catch { return; }
    }
    void this.context.resume().catch(() => {});
  }
  private tone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = .2, end?: number, delay = 0) {
    if (!this.enabled || !this.context || !this.master || this.context.state !== 'running') return;
    const now = this.context.currentTime + delay, osc = this.context.createOscillator(), gain = this.context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, now); if (end) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    gain.gain.setValueAtTime(.001, now); gain.gain.linearRampToValueAtTime(volume, now + .008); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(now); osc.stop(now + duration + .01);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  slash(tier: number, mass = 1) {
    const weight = Math.min(4, Math.max(0, mass - 1));
    this.tone((250 + tier * 110) / (1 + weight * .24), .12 + weight * .025, 'triangle', .12, 70 + tier * 16);
    if (weight > .7) this.tone(90 / (1 + weight * .12), .16, 'triangle', .08, 44);
  }
  hit(weight = 0) { const t = performance.now(); if (t - this.lastHit < 85) return; this.lastHit = t; this.tone(145 - weight * 15, .055 + weight * .015, 'triangle', .16, 55); if(weight > 1) this.tone(65,.1,'sine',.10,38); }
  enemyHurt(kind: EnemyKind, lethal = false, source = 'melee') {
    if (!this.enabled || !this.monsterEnabled || !this.context || !this.master || !this.noise || this.context.state !== 'running' || source === 'burn' && !lethal) return false;
    const now = performance.now(), voice = monsterVoice(kind, lethal);
    if (now - this.lastMonster < 85 || now - (this.familyTimes.get(voice.family) ?? -Infinity) < 150) return false;
    this.lastMonster = now; this.familyTimes.set(voice.family, now);
    playMonsterVoice(this.context, this.master, this.noise, voice); return true;
  }
  explode() { this.tone(90,.24,'triangle',.22,28); this.tone(170,.1,'sawtooth',.05,45); }
  pickup() { const t = performance.now(); if (t - this.lastPickup < 90) return; this.lastPickup = t; this.tone(780 + this.melody++ % 4 * 90, .07, 'sine', .10); }
  dash() { this.tone(470, .16, 'triangle', .13, 75); }
  hurt() { this.tone(110, .18, 'sawtooth', .10, 40); }
  evolve(tier: number) { [0, 4, 7, 12].forEach((note, i) => this.tone(330 * 2 ** ((note + tier * 2) / 12), .45, 'sine', .18, undefined, i * .07)); }
  boss() { [0, .16, .32].forEach(delay => this.tone(110, .4, 'triangle', .25, 55, delay)); }
  win() { [0, 4, 7, 12, 16, 19, 24].forEach((note, i) => this.tone(330 * 2 ** (note / 12), .55, 'sine', .2, undefined, i * .11)); }
  choose() { this.tone(660, .12, 'sine', .18, 990); }
  passive(tier: number) {
    const now = performance.now(); if (now - this.lastPassive < 180) return; this.lastPassive = now;
    const heavy = tier === 5 || tier === 10 || tier === 11;
    this.tone(heavy ? 145 : 460 + tier * 35, heavy ? .24 : .16, 'triangle', .13, heavy ? 55 : 780 + tier * 20);
  }
}
