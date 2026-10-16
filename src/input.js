export class Input {
  constructor(canvas,game,renderer,ui,audio){
    this.canvas=canvas;this.game=game;this.renderer=renderer;this.ui=ui;this.audio=audio;this.pointers=new Map();this.gesture=false;this.drag=false;
    for(const [name,fn] of [['pointerdown',this.down],['pointermove',this.move],['pointerup',this.up],['pointercancel',this.cancel],['lostpointercapture',this.cancel]])canvas.addEventListener(name,e=>fn.call(this,e));
    canvas.addEventListener('wheel',e=>{if(game.mode==='battle'&&!ui.modal&&!this.display?.blocked){e.preventDefault();renderer.zoom(Math.exp(-e.deltaY*.001));}},{passive:false});
    canvas.addEventListener('contextmenu',e=>{e.preventDefault();if(game.canAct()&&!ui.modal){const p=this.point(e);game.targeting=null;renderer.showGrid=false;game.moveHero(renderer.ground(p.x,p.y));}});
    game.on(e=>{if(e.type==='pause'&&e.paused||['start','leave','victory','defeat'].includes(e.type))this.clear();});
    window.addEventListener('keydown',e=>this.key(e));window.addEventListener('blur',()=>this.blur());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.blur();});window.addEventListener('resize',()=>this.clear());
    const resumePresentation=()=>{if(!document.hidden&&renderer.defeat?.active&&!renderer.contextLost&&!this.display?.blocked)audio.pause(false);};
    window.addEventListener('focus',resumePresentation);document.addEventListener('visibilitychange',resumePresentation);
  }
  point(e){const r=this.canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  down(e){
    if(e.button===2||this.game.mode!=='battle'||this.ui.modal||this.game.paused||this.display?.blocked)return;
    this.audio.unlock();const p=this.point(e);this.pointers.set(e.pointerId,{...p,startX:p.x,startY:p.y,moved:false});
    this.canvas.setPointerCapture(e.pointerId);if(this.pointers.size>1){this.gesture=true;this.lastPinch=this.pinch();}
  }
  pinch(){const p=[...this.pointers.values()];return p.length>1?{distance:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2}:null;}
  move(e){
    const p=this.point(e),old=this.pointers.get(e.pointerId);this.renderer.targetPoint=this.renderer.ground(p.x,p.y);
    if(!old)return;
    const dx=p.x-old.x,dy=p.y-old.y;Object.assign(old,p);if(Math.hypot(p.x-old.startX,p.y-old.startY)>9)old.moved=true;
    if(this.pointers.size>1){const pinch=this.pinch();if(this.lastPinch&&pinch){this.renderer.zoom(pinch.distance/Math.max(1,this.lastPinch.distance));this.renderer.pan(pinch.x-this.lastPinch.x,pinch.y-this.lastPinch.y);}this.lastPinch=pinch;this.gesture=true;}
    else if(old.moved&&!this.gesture)this.renderer.pan(dx,dy);
  }
  up(e){
    const old=this.pointers.get(e.pointerId),p=this.point(e);this.pointers.delete(e.pointerId);
    if(old&&!old.moved&&!this.gesture&&!this.ui.modal&&!this.game.paused)this.tap(p);
    if(this.pointers.size===0){this.gesture=false;this.lastPinch=null;}
  }
  cancel(){this.clear();}
  clear(){this.pointers.clear();this.gesture=false;this.drag=false;this.lastPinch=null;}
  blur(){this.clear();if(this.game.mode==='battle'&&!this.game.paused){this.game.setPaused(true);this.ui.showPause();}this.audio.pause(true);}
  tap(p){
    const g=this.game;if(this.display?.blocked||!g.canAct())return;
    this.ui.closeViewTools();
    const ground=this.renderer.ground(p.x,p.y);
    if(g.targeting){if(g.targeting.type==='skill')g.skill(g.targeting.index,ground);else if(g.targeting.type==='rally'){if(g.rally(g.targeting.id,ground))g.targeting=null;}return;}
    // Movement is a ground command: tall scenery must not steal the destination.
    if(g.selected?.type==='hero'){g.moveHero(ground);return;}
    // In explicit construction mode the ground cell has priority over a tall
    // neighbouring model. This keeps every unoccupied cell reachable in 3D.
    const buildCell=g.cellAt(ground);
    if(this.renderer.showGrid&&g.selected?.type!=='hero'&&buildCell&&g.placement(buildCell).ok){g.selected={type:'site',id:buildCell.id};g.changed();return;}
    const hit=this.renderer.hit(p.x,p.y);
    if(hit){if(hit.type==='obstacle')g.focusObstacle(hit.id);else{if(hit.type==='hero')this.renderer.showGrid=false;g.selected=hit;g.changed();}return;}
    const cell=g.cellAt(ground);if(cell){const placement=g.placement(cell);if(placement.ok){g.selected={type:'site',id:cell.id};g.changed();return;}g.notify(placement.reason);}
    g.selected=null;g.targeting=null;g.changed();
  }
  key(e){
    if(this.display?.blocked)return;
    if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
    const g=this.game;
    if(e.code==='Escape'){e.preventDefault();this.clear();if(g.targeting){g.targeting=null;g.changed();}else if(this.ui.modal){this.ui.closeModal();}else if(g.mode==='battle'){g.setPaused(!g.paused);if(g.paused)this.ui.showPause();}return;}
    if(g.mode!=='battle'||this.ui.modal)return;
    if(e.code==='Space'){e.preventDefault();if(!g.waveActive)g.beginWave();else{g.setPaused(true);this.ui.showPause();}}
    if(e.code==='Digit1')g.skill(0);if(e.code==='Digit2')g.skill(1);
    if(e.code==='KeyH'){this.renderer.showGrid=false;g.selected={type:'hero',id:g.hero.id};g.changed();}
    if(e.code==='KeyF'){g.speed=g.speed===1?2:1;g.changed();}
    if(e.code==='KeyR')this.renderer.resetView();
  }
}
