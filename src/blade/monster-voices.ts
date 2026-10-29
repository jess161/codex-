import type { EnemyKind } from './config';

export type VoiceFamily = 'soft' | 'swift' | 'shell' | 'breath' | 'horn' | 'spirit' | 'thorn' | 'giant';
export interface MonsterVoice { family: VoiceFamily; start: number; end: number; duration: number; formant: number; noise: number; type: OscillatorType }
const voices: Record<VoiceFamily, MonsterVoice> = {
  soft: { family: 'soft', start: 310, end: 125, duration: .16, formant: 880, noise: .07, type: 'triangle' },
  swift: { family: 'swift', start: 480, end: 190, duration: .12, formant: 1450, noise: .06, type: 'sine' },
  shell: { family: 'shell', start: 230, end: 105, duration: .18, formant: 1700, noise: .12, type: 'triangle' },
  breath: { family: 'breath', start: 250, end: 110, duration: .17, formant: 750, noise: .12, type: 'triangle' },
  horn: { family: 'horn', start: 175, end: 85, duration: .22, formant: 550, noise: .15, type: 'sawtooth' },
  spirit: { family: 'spirit', start: 660, end: 310, duration: .25, formant: 2100, noise: .08, type: 'sine' },
  thorn: { family: 'thorn', start: 375, end: 150, duration: .16, formant: 2450, noise: .14, type: 'triangle' },
  giant: { family: 'giant', start: 140, end: 65, duration: .26, formant: 600, noise: .17, type: 'sawtooth' },
};
const families: Record<EnemyKind, VoiceFamily> = { blob: 'soft', swift: 'swift', armor: 'shell', shooter: 'breath', charger: 'horn', wisp: 'spirit', splitter: 'soft', brood: 'swift', spiker: 'thorn', elite: 'giant', boss: 'giant' };
export function monsterVoice(kind: EnemyKind, lethal = false): MonsterVoice {
  const voice = voices[families[kind]];
  return { ...voice, start: voice.start * (lethal ? .85 : 1), end: voice.end * (lethal ? .72 : 1), duration: voice.duration * (lethal ? 1.25 : 1) };
}

// Noise is local to audio and consumes no combat randomness.
export function voiceNoise(context: BaseAudioContext) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * .4), context.sampleRate), data = buffer.getChannelData(0);
  let seed = 0x51c3f01;
  for (let i = 0; i < data.length; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; data[i] = (seed >>> 0) / 2147483648 - 1; }
  return buffer;
}

export function playMonsterVoice(context: BaseAudioContext, destination: AudioNode, noise: AudioBuffer, voice: MonsterVoice) {
  const start = context.currentTime, stop = start + voice.duration;
  const osc = context.createOscillator(), mod = context.createOscillator(), modulation = context.createGain();
  const filter = context.createBiquadFilter(), envelope = context.createGain(), air = context.createBufferSource(), airGain = context.createGain();
  osc.type = voice.type; osc.frequency.setValueAtTime(voice.start, start); osc.frequency.exponentialRampToValueAtTime(voice.end, stop);
  mod.type = 'sine'; mod.frequency.setValueAtTime(42, start); modulation.gain.setValueAtTime(voice.start * .12, start);
  mod.connect(modulation); modulation.connect(osc.frequency);
  filter.type = 'lowpass'; filter.frequency.setValueAtTime(voice.formant, start); filter.frequency.exponentialRampToValueAtTime(Math.max(300, voice.formant * .45), stop); filter.Q.value = 1.2;
  envelope.gain.setValueAtTime(.001, start); envelope.gain.linearRampToValueAtTime(.3, start + .006); envelope.gain.exponentialRampToValueAtTime(.001, stop);
  air.buffer = noise; airGain.gain.value = voice.noise;
  air.connect(airGain); airGain.connect(filter); osc.connect(filter); filter.connect(envelope); envelope.connect(destination);
  osc.start(start); mod.start(start); air.start(start); osc.stop(stop); mod.stop(stop); air.stop(stop);
  osc.onended = () => { for (const node of [osc, mod, modulation, filter, envelope, air, airGain]) node.disconnect(); };
}
