import { clamp } from './routes.js';
export const SAVE_KEY = 'realm-wardens.save.v1';
export const SETTINGS_KEY = 'realm-wardens.settings.v1';
export const DEFAULT_SETTINGS = Object.freeze({ quality: 'balanced', effects: 'standard', shake: .3, sensitivity: 1, music: .35, sfx: .65, numbers: true });
export const blankProgress = () => ({ version: 1, stars: Array(12).fill(0), endless: { e1: { wave: 0, score: 0 }, e2: { wave: 0, score: 0 }, e3: { wave: 0, score: 0 } }, tips: [] });
export function sanitizeSettings(value = {}) {
  const result = { ...DEFAULT_SETTINGS };
  for (const [key, choices] of [['quality',['high','balanced','fast']],['effects',['minimal','standard','rich']]]) if (choices.includes(value?.[key])) result[key]=value[key];
  for (const key of ['shake','music','sfx','sensitivity']) if (typeof value?.[key] === 'number' && Number.isFinite(value[key])) result[key] = clamp(value[key],key==='sensitivity'?.5:0,key==='sensitivity'?2:1);
  if (typeof value?.numbers==='boolean') result.numbers=value.numbers;
  return result;
}
export function sanitizeProgress(value) {
  const p=blankProgress();
  if (!value || value.version!==1) return p;
  if (Array.isArray(value.stars)) p.stars=p.stars.map((_,i)=>Number.isFinite(value.stars[i])?Math.round(clamp(value.stars[i],0,3)):0);
  // A damaged save cannot create gaps in the campaign unlock chain.
  let gap=false; p.stars=p.stars.map(s=>{ if(gap)return 0; if(!s)gap=true; return s; });
  for (const id of ['e1','e2','e3']) for (const key of ['wave','score']) { const n=value.endless?.[id]?.[key]; p.endless[id][key]=typeof n==='number'&&Number.isFinite(n)?Math.floor(clamp(n,0,1e9)):0; }
  if(Array.isArray(value.tips))p.tips=value.tips.filter(n=>typeof n==='string').slice(0,30);
  return p;
}
export class Store {
  constructor(storage) { try { this.storage=storage??globalThis.localStorage; } catch { this.storage=null; } this.available=true; this.settings=this.read(SETTINGS_KEY,sanitizeSettings); this.progress=this.read(SAVE_KEY,sanitizeProgress); }
  read(key,sanitize) { try { return sanitize(JSON.parse(this.storage?.getItem(key)||'null')); } catch { this.available=false; return sanitize(); } }
  write(key,value) { try { if(!this.storage)throw Error('unavailable'); this.storage.setItem(key,JSON.stringify(value)); } catch { this.available=false; } }
  saveSettings(v) { this.settings=sanitizeSettings(v); this.write(SETTINGS_KEY,this.settings); }
  completed() { return this.progress.stars.filter(Boolean).length; }
  unlocked(level) { return level===1 || this.progress.stars[level-2]>0; }
  victory(id,stars) { this.progress.stars[id-1]=Math.max(this.progress.stars[id-1],stars); this.write(SAVE_KEY,this.progress); }
  record(id,wave,score) { const old=this.progress.endless[id]; this.progress.endless[id]={ wave:Math.max(old.wave,wave), score:Math.max(old.score,Math.round(score)) }; this.write(SAVE_KEY,this.progress); }
  seenTip(id) { if(!this.progress.tips.includes(id)) {this.progress.tips.push(id);this.write(SAVE_KEY,this.progress);} }
  reset() { this.progress=blankProgress();this.write(SAVE_KEY,this.progress); }
}
