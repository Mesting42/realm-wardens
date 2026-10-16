// Original, locally synthesized sound textures. PCM is generated once per sound,
// then shared by every voice; no downloads, microphone or media permissions.
export const SOUND_RATE=32000;
const TAU=Math.PI*2;
const ROARS={
  imp:[155,.58,520,1700,.4],wolf:[215,.95,650,1150,.16],raider:[105,.67,480,1350,.35],
  armor:[82,.72,360,1100,.4],wisp:[310,.75,900,1900,.12],bat:[510,.47,1550,3200,.3],
  harpy:[355,.7,1050,2300,.25],shaman:[135,.72,600,1450,.28],shield:[118,.68,550,1600,.22],
  brood:[96,.62,750,2200,.64],grub:[270,.42,1150,2700,.6],siege:[57,1.05,300,930,.45],
  elite:[92,.78,440,1300,.44],warlock:[115,.82,670,1750,.25],frostguard:[66,.9,380,1200,.35],
  treant:[45,1.2,280,800,.55],iceking:[53,1.2,390,1450,.35],ashlord:[48,1.3,340,1050,.5]
};
const CITIZENS={farmer:[245,.68,850,1450,.14],merchant:[350,.74,950,1900,.12],child:[525,.62,1250,2650,.1]};
function randomFor(key){let seed=2166136261;for(const c of key)seed=Math.imul(seed^c.charCodeAt(0),16777619);return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};}
function bandpass(data,f,q){
  const w=TAU*f/SOUND_RATE,a=Math.sin(w)/(2*q),b0=a/(1+a),b2=-b0,a1=-2*Math.cos(w)/(1+a),a2=(1-a)/(1+a),out=new Float32Array(data.length);
  let x1=0,x2=0,y1=0,y2=0;
  for(let i=0;i<data.length;i++){const x=data[i],y=b0*x+b2*x2-a1*y1-a2*y2;out[i]=y;x2=x1;x1=x;y2=y1;y1=y;}
  return out;
}
function normalize(data){
  let peak=0;for(const value of data)peak=Math.max(peak,Math.abs(value));
  if(peak)for(let i=0;i<data.length;i++)data[i]=Math.tanh(data[i]/peak*1.35)*.96;
  // Short fades remove clicks, including the beginning of percussion transients.
  const fade=Math.round(SOUND_RATE*.004);for(let i=0;i<fade&&i<data.length/2;i++){const amount=i/fade;data[i]*=amount;data[data.length-1-i]*=amount;}
  return data;
}
function roar(kind,citizen=false){
  const [base,duration,f1,f2,rough]=(citizen?CITIZENS:ROARS)[kind]||(citizen?CITIZENS.farmer:ROARS.imp),random=randomFor(kind),data=new Float32Array(Math.ceil(duration*SOUND_RATE));
  let phase=0,air=0;
  for(let i=0;i<data.length;i++){
    const t=i/SOUND_RATE,u=t/duration;
    const contour=citizen?1.1+.4*Math.sin(Math.PI*Math.min(1,u*1.5))-.25*u:kind==='wolf'?1+.38*Math.sin(Math.PI*u)-.13*u:1+.28*Math.sin(Math.PI*Math.min(1,u*1.8))-.32*u;
    const frequency=base*contour*(1+.034*Math.sin(t*TAU*6)+.018*Math.sin(t*TAU*19));phase+=frequency*TAU/SOUND_RATE;
    air=air*.64+random()*.36;
    // Harmonic glottal pulses plus breath, filtered into two vocal formants.
    let voice=0;for(let h=1;h<=10;h++)voice+=Math.sin(phase*h)/Math.pow(h,.87);
    const rasp=citizen?.94+.06*Math.sin(t*TAU*8):.73+.16*Math.sin(t*TAU*31)+.11*Math.sin(t*TAU*47);
    data[i]=(voice*.36*rasp+air*rough)*Math.min(1,t/(citizen?.025:.055))*Math.pow(Math.sin(Math.PI*u),citizen?.5:.7);
  }
  const vowel1=bandpass(data,f1,2.2),vowel2=bandpass(data,f2,3.1);
  for(let i=0;i<data.length;i++)data[i]=data[i]*.23+vowel1[i]*2.4+vowel2[i]*1.6;
  return normalize(data);
}
function attack(kind){
  const duration={arrow:.24,ballista:.34,cannon:.52,arcane:.42,frost:.4,thunder:.5,nature:.39,melee:.23,boom:.65,woodHit:.16,iceHit:.23,magicHit:.25,crumble:1.05,crackle:.85}[kind]||.2;
  const data=new Float32Array(Math.ceil(duration*SOUND_RATE)),random=randomFor(kind);let low=0,phase=0;
  for(let i=0;i<data.length;i++){
    const t=i/SOUND_RATE,u=t/duration,n=random();low+=.13*(n-low);const high=n-low;
    const sine=f=>Math.sin(TAU*f*t),decay=s=>Math.exp(-t/s);let v=0;
    switch(kind){
      case 'arrow':v=(sine(310)+.28*sine(620))*decay(.026)*.55+high*decay(.055)*.3+low*Math.sin(Math.PI*u)*decay(.08);break;
      case 'ballista':v=(sine(155)+.25*sine(470))*decay(.065)*.55+low*decay(.12)*1.5+high*decay(.02)*.38;break;
      case 'cannon':phase+=TAU*(48+110*decay(.025))/SOUND_RATE;v=Math.sin(phase)*decay(.105)*.8+low*decay(.14)*2.8+high*decay(.03)*.42;break;
      case 'arcane':phase+=TAU*(650+1100*u*u)/SOUND_RATE;v=(Math.sin(phase)+.33*Math.sin(phase*1.5))*Math.sin(Math.PI*u)*decay(.16)*.65+(sine(1568)+sine(2093))*.13*decay(.09);break;
      case 'frost':v=(sine(1480)*decay(.085)+.55*sine(2217)*decay(.12)+.32*sine(3511)*decay(.06))*.42+high*decay(.13)*.18;break;
      case 'thunder':v=high*(.22+.78*Math.pow(Math.max(0,sine(53)),6))*decay(.055)*1.1+low*decay(.16)*1.7+sine(62)*decay(.13)*.32;break;
      case 'nature':phase+=TAU*(360-180*u)/SOUND_RATE;v=Math.sin(phase)*decay(.065)*.25+low*Math.sin(Math.PI*u)*decay(.16)*2+.1*sine(790)*decay(.12);break;
      case 'melee':v=(sine(870)+.5*sine(1327)+.25*sine(2249))*decay(.035)*.42+high*decay(.018)*.38;break;
      case 'boom':v=low*decay(.18)*3+sine(52)*decay(.17)*.6+high*decay(.045)*.48;break;
      case 'woodHit':v=low*decay(.023)*2+sine(140)*decay(.025)*.5;break;
      case 'iceHit':v=(sine(1780)+.45*sine(2681))*decay(.07)*.3+high*decay(.03)*.6;break;
      case 'magicHit':v=(sine(587)+.42*sine(1174))*decay(.07)*.42+low*decay(.08)*.5;break;
      case 'crumble':v=low*(1.8+Math.pow(Math.max(0,sine(17)),8)*1.9)*decay(.34)+sine(46)*decay(.2)*.4+high*Math.pow(Math.max(0,sine(37)),20)*decay(.45)*.65;break;
      case 'crackle':v=low*.22+high*(.025+Math.pow(Math.max(0,sine(43)+.28*sine(71)-.3),16)*.18);v*=Math.sin(Math.PI*u);break;
    }
    data[i]=v;
  }
  return normalize(data);
}
export function synthesizeSound(key){return key.startsWith('scream:')?roar(key.slice(7),true):key.startsWith('roar:')?roar(key.slice(5)):attack(key);}
