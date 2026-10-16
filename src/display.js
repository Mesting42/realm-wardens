// Native fullscreen/orientation are optional browser capabilities. Never rotate
// the canvas with CSS: its projection and touch coordinates stay in the viewport.
export function isMobileDevice(nav=navigator,media=matchMedia,deviceScreen=screen){
  return /Android|iPhone|iPad|iPod/i.test(nav.userAgent)||
    nav.userAgentData?.mobile===true||
    (nav.platform==='MacIntel'&&nav.maxTouchPoints>1)||
    (nav.maxTouchPoints>0&&media('(pointer: coarse)').matches&&Math.min(deviceScreen.width,deviceScreen.height)<=1024);
}

const deviceIcon=`<svg viewBox="0 0 100 76" aria-hidden="true"><rect x="17" y="20" width="66" height="40" rx="6" fill="#294b3c" stroke="#b5d4b9" stroke-width="3"/><rect x="25" y="26" width="50" height="28" rx="2" fill="#152f29"/><path d="M41 35h18v10H41zM46 30h8v20h-8" fill="#dcc287"/><path d="M21 10h44l-7-6m7 6-7 6M79 69H35l7-6m-7 6 7 6" fill="none" stroke="#7da68a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export class DisplayMode {
  constructor(game,ui,input,audio){
    this.game=game;this.ui=ui;this.input=input;this.audio=audio;
    this.mobile=isMobileDevice();this.entered=!this.mobile;
    this.blocked=false;this.busy=false;this.orientationStatus='idle';this.fullscreenStatus='idle';
    this.root=document.getElementById('display-root');this.renderKey='';
    document.body.classList.toggle('mobile-device',this.mobile);
    this.root.addEventListener('click',e=>{if(e.target.closest('[data-display-enter]'))this.enter();});
    this.root.addEventListener('keydown',e=>{
      if(e.key==='Tab'){e.preventDefault();this.root.querySelector('button')?.focus();}
      if(e.key==='Escape')e.stopPropagation();
    });
    window.addEventListener('resize',()=>this.sync());
    window.visualViewport?.addEventListener('resize',()=>this.sync());
    screen.orientation?.addEventListener('change',()=>this.sync());
    for(const event of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(event,()=>{
      if(!this.fullscreen)this.unlockOrientation();
      this.sync();this.updateControls();
    });
    game.on(e=>{if(['start','leave','victory','defeat'].includes(e.type))this.sync();});
    this.sync();this.updateControls();
  }
  get fullscreen(){return !!(document.fullscreenElement||document.webkitFullscreenElement);}
  get standalone(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;}
  get fullscreenSupported(){
    return !!(document.documentElement.requestFullscreen&&document.fullscreenEnabled!==false||
      document.documentElement.webkitRequestFullscreen&&document.webkitFullscreenEnabled!==false);
  }
  get portrait(){return this.mobile&&innerHeight>innerWidth;}
  unlockOrientation(){try{screen.orientation?.unlock?.();}catch{}this.orientationStatus='unlocked';}
  async lockOrientation(){
    if(!this.mobile)return;
    if(!screen.orientation?.lock){this.orientationStatus='unsupported';return;}
    try{await screen.orientation.lock('landscape');this.orientationStatus='locked';}
    catch{this.orientationStatus='unsupported';}
  }
  async requestFullscreen(){
    if(this.fullscreen)return true;
    if(this.standalone){this.fullscreenStatus='standalone';return true;}
    if(!this.fullscreenSupported){this.fullscreenStatus='unsupported';return false;}
    try{
      const el=document.documentElement;
      if(el.requestFullscreen)await el.requestFullscreen();else await el.webkitRequestFullscreen();
      this.fullscreenStatus='active';return true;
    }catch{this.fullscreenStatus='denied';return false;}
  }
  async enter(){
    if(this.busy)return;
    this.busy=true;this.sync();
    // Start the privileged call in the original click, before awaiting audio.
    const fullscreen=this.requestFullscreen();
    this.audio.unlock();
    const success=await fullscreen;await this.lockOrientation();
    this.entered=true;this.busy=false;this.sync();this.updateControls();
    if(!success&&!this.blocked)this.ui.toast('浏览器未允许页面全屏，已进入横屏窗口模式。可在游戏设置中重试。',5200);
  }
  async exit(){
    if(this.busy)return;
    this.busy=true;
    try{
      this.unlockOrientation();
      if(document.fullscreenElement)await document.exitFullscreen();
      else if(document.webkitFullscreenElement)await document.webkitExitFullscreen();
    }catch{this.ui.toast('暂时无法退出全屏，请使用浏览器的退出全屏操作。');}
    finally{this.busy=false;this.sync();this.updateControls();}
  }
  toggle(){return this.fullscreen?this.exit():this.enter();}
  sync(){
    const compact=this.mobile||(innerHeight<=550&&innerWidth<=1180),wasCompact=document.body.classList.contains('compact-battle');
    document.body.classList.toggle('mobile-device',this.mobile);
    document.body.classList.toggle('compact-battle',compact);
    if(compact!==wasCompact)this.ui.renderer.fitCamera();
    const blocked=!this.entered||this.portrait,changed=blocked!==this.blocked;
    if(blocked&&changed)this.focusBefore=document.activeElement;
    this.blocked=blocked;
    for(const id of ['ui','world','modal-root'])document.getElementById(id).inert=blocked;
    document.body.classList.toggle('display-blocked',blocked);
    this.root.hidden=!blocked;
    if(blocked){
      this.input.clear();
      if(this.game.mode==='battle'&&!this.game.paused)this.game.setPaused(true);
      this.audio.pause(true);
      this.renderGate();
    }else if(changed){
      this.root.replaceChildren();this.renderKey='';
      if(this.game.mode==='battle'&&this.game.paused&&!this.ui.modal)this.ui.showPause();
      this.audio.pause(this.game.mode==='battle'&&this.game.paused);
      if(!this.ui.modal&&this.focusBefore?.isConnected&&!this.focusBefore.closest('[inert]'))this.focusBefore.focus?.();
      this.ui.schedulePreviews();
    }
  }
  renderGate(){
    const first=!this.entered;
    const title=first?'横屏展开你的王国':'请将设备转为横屏';
    const description=first?(this.fullscreenSupported||this.standalone?'进入游戏后开启全屏。手机和平板将尝试自动转向横屏，让战场与指挥栏完整展开。':'请横持设备进入游戏。此浏览器不支持页面全屏，将以横屏窗口模式展开战场。'):
      this.ui.screen==='defeat-cinematic'?'失守演出已暂停，横屏后继续播放。':
      this.game.mode==='battle'?'战斗已暂停。横屏后点击“继续战斗”，接着守护城镇。':'横屏后即可进入王国，查看地图与指挥防线。';
    const help=this.orientationStatus==='unsupported'?'此浏览器无法自动转向，请手动旋转设备；若仍未转向，请关闭设备的竖屏锁定。':
      this.fullscreenStatus==='unsupported'?'此浏览器不支持页面全屏。请横持设备，游戏将以横屏窗口模式运行。':
      this.fullscreenStatus==='denied'?'浏览器未允许全屏，请重试；也可横持设备继续游玩。':'可在游戏设置中退出全屏。设备无法自动旋转时，请手动横持。';
    const key=JSON.stringify([first,title,description,help,this.busy]);if(key===this.renderKey)return;this.renderKey=key;
    this.root.innerHTML=`<section class="display-gate" role="dialog" aria-modal="true" aria-labelledby="display-title" aria-describedby="display-description display-help" tabindex="-1"><div class="display-device">${deviceIcon}</div><h1 id="display-title">${title}</h1><p id="display-description">${description}</p><button type="button" class="primary" data-display-enter ${this.busy?'disabled aria-busy="true"':''}>${this.busy?'正在展开战场…':first?'进入游戏':'重试横屏与全屏'}</button><p class="display-help" id="display-help" role="status">${help}</p></section>`;
    if(this.busy)this.root.querySelector('section').focus();else this.root.querySelector('button').focus();
  }
  updateControls(){
    const state=document.getElementById('display-state'),button=document.getElementById('settings-fullscreen');
    if(state)state.textContent=this.fullscreen?'全屏游玩':this.standalone?'独立窗口游玩':this.fullscreenSupported?'窗口游玩':'当前浏览器不支持页面全屏';
    if(button){button.textContent=this.fullscreen?'退出全屏':'进入全屏';button.disabled=!this.fullscreenSupported||this.busy;button.setAttribute('aria-pressed',String(this.fullscreen));}
    const view=this.ui.root.querySelector('[data-action="fullscreen"]');if(view){view.setAttribute('aria-label',this.fullscreen?'退出全屏':'进入全屏');view.setAttribute('aria-pressed',String(this.fullscreen));}
  }
  snapshot(){return {mobile:this.mobile,entered:this.entered,portrait:this.portrait,blocked:this.blocked,fullscreen:this.fullscreen,fullscreenSupported:this.fullscreenSupported,orientation:this.orientationStatus};}
}
