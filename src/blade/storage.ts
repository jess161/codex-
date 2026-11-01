import { DEFAULT_WEAPON, SAVE_KEY, TIERS, TIER_LEVELS, isBasicWeapon } from './config';
import { restoreSnapshot, type RunState } from './simulation';
import { isGroundId, type GroundId } from './grounds';
import { BLADE_RELEASE, SAVE_VERSION } from './release';
export interface Settings { sound:boolean; monsterSound:boolean; simplified:boolean; motion:boolean; shake:boolean; hitPause:boolean; haptics:boolean; color:number; ground:GroundId; blade:number }
export interface Meta { maxTier:number; seenBlades:number[]; achievements:string[]; runs:number; wins:number; bestScore:number; bestKills:number; bestTime:number; lastFinishedId:string }
export interface SaveData { version:typeof SAVE_VERSION; revision:string; meta:Meta; settings:Settings; run:RunState|null }
export const freshMeta=():Meta=>({maxTier:0,seenBlades:[],achievements:[],runs:0,wins:0,bestScore:0,bestKills:0,bestTime:0,lastFinishedId:''});
export class BladeStorage {
  data:SaveData;
  warning='';
  constructor(){
    this.data={version:SAVE_VERSION,revision:BLADE_RELEASE,meta:freshMeta(),settings:{sound:true,monsterSound:true,simplified:false,motion:!matchMedia('(prefers-reduced-motion: reduce)').matches,shake:true,hitPause:true,haptics:false,color:0,ground:'grid',blade:DEFAULT_WEAPON},run:null};
    try{
      const raw=localStorage.getItem(SAVE_KEY);if(!raw)return;
      const saved=JSON.parse(raw);
      if(!saved||typeof saved!=='object'||saved.version!==SAVE_VERSION||saved.revision!==BLADE_RELEASE){
        localStorage.removeItem(SAVE_KEY);
        this.warning='游戏已更新，旧存档已清除，请重新开局。';
        return;
      }
      if(saved.meta&&typeof saved.meta==='object'){
        for(const key of ['maxTier','runs','wins','bestScore','bestKills','bestTime'] as const)
          if(Number.isFinite(saved.meta[key])&&saved.meta[key]>=0)this.data.meta[key]=saved.meta[key];
        this.data.meta.maxTier=Math.min(TIER_LEVELS.length-1,Math.floor(this.data.meta.maxTier));
        if(Array.isArray(saved.meta.seenBlades))this.data.meta.seenBlades=[...new Set<number>(saved.meta.seenBlades.filter((i:unknown)=>Number.isInteger(i)&&Number(i)>=0&&Number(i)<TIERS.length&&isBasicWeapon(Number(i))))];
        if(Array.isArray(saved.meta.achievements))this.data.meta.achievements=saved.meta.achievements.filter((a:unknown)=>typeof a==='string');
        if(typeof saved.meta.lastFinishedId==='string')this.data.meta.lastFinishedId=saved.meta.lastFinishedId;
      }
      if(saved.settings){
        for(const key of ['sound','monsterSound','simplified','motion','shake','hitPause','haptics'] as const)
          if(typeof saved.settings[key]==='boolean')this.data.settings[key]=saved.settings[key];
        if(Number.isInteger(saved.settings.color)&&saved.settings.color>=0&&saved.settings.color<3)this.data.settings.color=saved.settings.color;
        if(isGroundId(saved.settings.ground))this.data.settings.ground=saved.settings.ground;
        if(Number.isInteger(saved.settings.blade)&&isBasicWeapon(saved.settings.blade))this.data.settings.blade=saved.settings.blade;
      }
      if(saved.run){
        this.data.run=saved.run.version===SAVE_VERSION?restoreSnapshot(saved.run):null;
        if(!this.data.run)this.warning='上次对局无法恢复，请重新开局。';
      }
    }catch{
      try{localStorage.removeItem(SAVE_KEY);}catch{}
      this.warning='存档无法读取，请重新开局。';
    }
  }
  write(run?:RunState|null){
    if(run!==undefined)this.data.run=run?structuredClone(run):null;
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(this.data));return true;}
    catch{this.warning='当前浏览器无法保存进度，请保持游戏窗口。';return false;}
  }
}
