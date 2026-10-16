import {synthesizeSound,SOUND_RATE} from './sounds.js';

export class AudioSystem {
  constructor(settings){this.settings=settings;this.context=null;this.paused=false;this.musicTimer=0;this.note=0;this.nodes=new Set();this.voices=new Map();this.buffers=new Map();this.lastSounds=new Map();}
  async unlock(){
    try{
      if(!this.context){this.context=new(window.AudioContext||window.webkitAudioContext)();this.musicGain=this.context.createGain();this.sfxGain=this.context.createGain();this.compressor=this.context.createDynamicsCompressor();this.compressor.threshold.value=-18;this.compressor.knee.value=18;this.compressor.ratio.value=4;this.compressor.attack.value=.003;this.compressor.release.value=.16;this.musicGain.connect(this.context.destination);this.sfxGain.connect(this.compressor);this.compressor.connect(this.context.destination);this.apply(this.settings);}
      if(this.context.state==='suspended')await this.context.resume();
    }catch{ /* Audio being unavailable does not block playing. */ }
  }
  apply(s){
    this.settings=s;if(!this.context)return;const t=this.context.currentTime;
    for(const [param,value,fade] of [[this.musicGain.gain,this.paused?0:s.music*.18,.05],[this.sfxGain.gain,this.paused?0:s.sfx*.2,.02]]){
      // Muting must also cancel an older target ramp that is already running,
      // including pause/resume/mute commands within the same audio quantum.
      if(value===0){param.cancelScheduledValues(0);param.value=0;param.setValueAtTime(0,t);}
      else{if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(t);else param.cancelScheduledValues(t);param.setTargetAtTime(value,t,fade);}
    }
  }
  stopAll(){for(const n of this.nodes){try{n.stop();}catch{}}this.nodes.clear();this.voices.clear();this.lastSounds.clear();}
  pause(value){this.paused=value;this.apply(this.settings);if(value)this.stopAll();}
  limited(key,interval){const t=this.context?.currentTime||0,last=this.lastSounds.get(key)??-Infinity;if(t-last<interval)return true;this.lastSounds.set(key,t);return false;}
  play(key,event={},gain=.7,category='attack'){
    if(!this.context||this.context.state!=='running'||this.paused||this.settings.sfx===0)return false;
    const roars=[...this.voices].filter(([,v])=>v==='roar');
    if(category==='citizen'&&[...this.voices.values()].filter(v=>v==='citizen').length>=2)return false;
    if(category==='roar'&&roars.length>=3){if(!event.boss)return false;const source=roars[0][0];source.stop();this.nodes.delete(source);this.voices.delete(source);}
    if(this.voices.size>=20){if(!event.boss&&category!=='citizen')return false;const source=[...this.voices].find(([,v])=>v==='attack'||v==='impact')?.[0];if(!source)return false;source.stop();this.nodes.delete(source);this.voices.delete(source);}
    const c=this.context;let buffer=this.buffers.get(key);
    if(!buffer){const pcm=synthesizeSound(key);buffer=c.createBuffer(1,pcm.length,SOUND_RATE);buffer.copyToChannel(pcm,0);this.buffers.set(key,buffer);}
    const source=c.createBufferSource(),volume=c.createGain(),pan=c.createStereoPanner();source.buffer=buffer;source.playbackRate.value=.96+((event.id||0)%7)*.013;
    volume.gain.value=gain;pan.pan.value=Math.max(-.65,Math.min(.65,(event.x||0)/24));source.connect(volume);volume.connect(pan);pan.connect(this.sfxGain);
    this.nodes.add(source);this.voices.set(source,category);source.onended=()=>{source.disconnect();volume.disconnect();pan.disconnect();this.nodes.delete(source);this.voices.delete(source);};source.start();return true;
  }
  tone(freq,duration=.18,type='sine',gain=.5,channel='sfx',delay=0,end=null){
    if(!this.context||this.context.state!=='running'||this.paused||this.nodes.size>=48)return;
    if(channel==='sfx'&&this.settings.sfx===0||channel==='music'&&this.settings.music===0)return;
    const c=this.context,o=c.createOscillator(),g=c.createGain(),t=c.currentTime+delay;o.type=type;o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.018);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(channel==='music'?this.musicGain:this.sfxGain);o.start(t);o.stop(t+duration+.01);this.nodes.add(o);o.onended=()=>{o.disconnect();g.disconnect();this.nodes.delete(o);};
  }
  sound(e){
    const name=e.type;
    if(name==='start'||name==='leave'){this.cinematic=false;this.stopAll();return;}
    if(name==='defeat'){this.cinematic=true;this.stopAll();}
    if(name==='defeat-ready'){this.cinematic=false;this.stopAll();}
    if(!this.context||this.context.state!=='running'||this.paused||this.settings.sfx===0)return;
    if(name==='spawn'&&e.portal){if(e.boss||!this.limited(`portal:${e.route??0}`, .22))this.play(`roar:${e.kind}`,e,e.boss?.82:.7,'roar');}
    if(name==='citizen-panic'&&!this.limited('citizen-panic',.12))this.play(`scream:${e.kind}`,e,.62,'citizen');
    if(name==='build'){this.tone(330,.18,'triangle');this.tone(495,.25,'triangle',.45,'sfx',.08);}
    if(name==='upgrade'){for(const [i,n]of [392,494,587].entries())this.tone(n,.3,'triangle',.4,'sfx',i*.07);}
    if(name==='sell')this.tone(520,.16,'sine',.4,'sfx',0,230);
    if(name==='attack'||name==='lightning'){
      const kind=name==='lightning'?'thunder':e.kind;
      if(!this.limited(`attack:${kind}`,kind==='cannon'?.12:.055))this.play(kind,e,kind==='melee'?.43:kind==='cannon'?.78:.62);
    }
    if(name==='explosion'&&!this.limited('impact:boom',.12))this.play('boom',e,.62,'impact');
    if(name==='impact'&&e.kind!=='thunder'&&!this.limited(`impact:${e.kind}`, .11))this.play(['arrow','ballista'].includes(e.kind)?'woodHit':e.kind==='frost'?'iceHit':'magicHit',e,e.kind==='melee'?.12:.22,'impact');
    if(name==='skill')for(const [i,n]of [392,523,784].entries())this.tone(n,.42,'sine',.24,'sfx',i*.07);
    if(name==='boss-warning')for(let i=0;i<3;i++)this.tone(196,.22,'sawtooth',.32,'sfx',i*.35,165);
    if(name==='victory'){this.stopAll();for(const [i,n]of [261.63,329.63,392,523.25].entries())this.tone(n,.8,'triangle',.5,'sfx',i*.16);}
    if(name==='city-invasion'&&!this.limited('city-invasion',.22))this.play(`roar:${e.kind}`,e,.5,'roar');
    if(name==='city-attack'&&!this.limited('city-attack',.12))this.play('woodHit',e,.48,'impact');
    if(name==='city-collapse'&&!this.limited('city-collapse',.16))this.play('crumble',e,e.castle?.7:.52,'impact');
    if(name==='city-fire'&&!this.limited('city-fire',.8))this.play('crackle',e,.26,'impact');
    if(name==='defeat-ready')for(const [i,n]of [293.66,261.63,196,146.83].entries())this.tone(n,.65,'triangle',.4,'sfx',i*.18);
    if(name==='wave')this.tone(220,.27,'triangle',.3,'sfx',0,330);
  }
  update(dt,battle){
    if(this.paused||this.cinematic||!this.context)return;this.musicTimer-=dt;if(this.musicTimer>0)return;this.musicTimer+=.42;
    // An original Dorian theme: a soft plucked melody with a slow fifth drone.
    const melody=[0,7,12,10,7,3,5,7,0,3,7,14,12,10,7,5],base=battle?146.83:130.81,note=melody[this.note%melody.length];
    this.tone(base*Math.pow(2,note/12),.7,'triangle',.3,'music');
    if(this.note%4===0){this.tone(base/2,1.5,'sine',.4,'music');this.tone(base*.75,1.4,'sine',.16,'music');}
    this.note++;
  }
}
