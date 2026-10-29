import { Survival, freshState, type GameEvent } from './simulation';
import type { Point, RecipeId } from './content';

export interface Nearby { id: string; kind: 'node' | 'structure'; name: string; verb: string; hint: string; point: Point }
export class Session {
  model = new Survival();
  started = false;
  panel: 'inventory' | 'craft' | 'journal' | 'map' | 'pause' | 'sleep' | null = null;
  hidden = false;
  placement: RecipeId | null = null;
  nearby: Nearby | null = null;
  gathering = 0;
  sound = false;
  lookLocked = false;
  isTouch = false;
  buildValid = false;
  hasSave = !!Survival.load();
  listeners = new Set<(event: GameEvent) => void>();
  changes = new Set<() => void>();
  interact: () => void = () => {};
  map: (canvas: HTMLCanvasElement, full: boolean) => void = () => {};
  capture: () => void = () => {};
  constructor() { this.bind(); }
  bind() { this.model.on(e => { for (const listener of this.listeners) listener(e); if (this.started && e.type !== 'hurt') this.model.save(); }); }
  get paused() { return !this.started || this.panel !== null || this.hidden || this.model.state.status !== 'playing'; }
  on(listener: (event: GameEvent) => void) { this.listeners.add(listener); }
  onChange(listener: () => void) { this.changes.add(listener); }
  changed() { this.changes.forEach(f => f()); }
  start(restore = false) {
    this.model = new Survival(restore ? Survival.load() ?? freshState() : freshState()); this.bind();
    this.started = true; this.panel = null; this.placement = null; this.nearby = null; this.gathering = 0; this.model.save(); this.changed();
  }
  open(panel: Session['panel']) { if (!this.started || this.model.state.status !== 'playing') return; this.placement = null; this.panel = this.panel === panel ? null : panel; this.changed(); }
  close() { this.panel = null; this.placement = null; this.changed(); }
}
