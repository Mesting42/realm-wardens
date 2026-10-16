// Browser automation buys and commands through the actual UI. All evaluations
// below only inspect state and calculate screen positions; they never mutate it.
export function uiBot(page){
  const click=async action=>{const b=page.locator(`[data-action="${action}"]`).last();if(['grid','zoom-in','zoom-out','reset-view','fullscreen'].includes(action)&&!await b.isVisible())await page.locator('[data-action="view-tools"]').click();await b.click();};
  const read=()=>page.evaluate(()=>window.__REALM_WARDENS__.snapshot());
  const world=async p=>{const box=await page.locator('#scene').boundingBox();await page.mouse.click(box.x+p.x,box.y+p.y);};
  async function site(id){
    if(await page.locator('[data-action="cancel"]').count())await click('cancel');
    const mode=await page.evaluate(id=>{const a=window.__REALM_WARDENS__;return {build:!a.game.towers.some(t=>t.site===id),grid:a.renderer.showGrid};},id);if(mode.build!==mode.grid)await click('grid');
    const p=await page.evaluate(id=>{const a=window.__REALM_WARDENS__,r=a.renderer,s=a.game.cells.find(s=>s.id===id),t=a.game.towers.find(t=>t.site===id),points=t?[.8,1.45,2.1,2.8,3.4].flatMap(y=>[[0,0],[.22,0],[-.22,0],[0,.22],[0,-.22]].map(([x,z])=>r.project(s.x+x,s.z+z,y))):[r.project(s.x,s.z,.17)];return points.find(p=>document.elementFromPoint(p.x,p.y)===r.canvas&&(!t||r.hit(p.x,p.y)?.id===t.id))||null;},id);
    if(!p)return false;await world(p);await page.waitForTimeout(180);return page.evaluate(id=>{const g=window.__REALM_WARDENS__.game,t=g.towers.find(t=>t.site===id);return t?g.selected?.type==='tower'&&g.selected.id===t.id:g.selected?.type==='site'&&g.selected.id===id;},id);
  }
  async function decision(){return page.evaluate(()=>{
    const a=window.__REALM_WARDENS__,g=a.game,T=a.content.TOWERS,stats=a.content.towerStats,dist=(p,q)=>Math.hypot(p.x-q.x,p.z-q.z);
    const ranked=g.cells.map(s=>{let score=0;for(const r of g.map.routes)for(let d=0;d<r.length;d+=.6)if(dist(s,r.at(d))<5.7)score+=.6*(.6+.6*d/r.length);return {...s,score};}).sort((a,b)=>b.score-a.score);
    const samples=[];for(const r of g.map.routes)for(let d=0;d<r.length-1.5;d+=.8){const p=r.at(d);let c=0;for(const t of g.towers)if(dist(p,t)<stats(t).range)c++;samples.push({...p,weight:(.5+.65*d/r.length)/(1+c*3)});}
    const next=g.cells.filter(s=>g.placement(s).ok).map(s=>({...s,value:samples.filter(p=>dist(p,s)<5.8).reduce((n,p)=>n+p.weight,0)})).sort((a,b)=>b.value-a.value)[0];
    const plan=['arcane','arrow','cannon','ballista','frost','nature','thunder','barracks','arrow'],filled=g.towers.length,k=plan[filled%plan.length];
    if(filled<4&&next&&g.gold>=T[k].cost)return {action:'build:'+k,site:next.id};
    const up=g.towers.filter(t=>t.level<3).sort((a,b)=>a.level-b.level||ranked.findIndex(s=>s.id===a.site)-ranked.findIndex(s=>s.id===b.site))[0];
    if(up&&g.gold>=T[up.kind].upgrades[up.level-1])return {action:'upgrade',site:up.site};
    const spec=g.towers.find(t=>t.level===3&&t.spec===null);if(spec&&g.gold>=T[spec.kind].specs[0].cost)return {action:'spec:0',site:spec.site};
    if(next&&g.gold>=T[k].cost)return {action:'build:'+k,site:next.id};return null;
  });}
  async function prepare(maxActions=55){
    if((await read()).mode!=='battle')return;
    try{
    if(await page.locator('[data-action="cancel"]').count())await click('cancel');
    for(let i=0;i<maxActions;i++){if((await read()).mode!=='battle')return;const d=await decision();if(!d||!await site(d.site))break;const button=page.locator(`[data-action="${d.action}"]`).last();if(!await button.count()||await button.isDisabled())break;await button.click({timeout:2500});await page.waitForTimeout(90);}
    if(await page.locator('[data-action="cancel"]').count())await click('cancel');
    const destination=await page.evaluate(()=>{const a=window.__REALM_WARDENS__,g=a.game;const ranked=g.cells.map(s=>{let score=0;for(const r of g.map.routes)for(let d=0;d<r.length;d+=.6){const p=r.at(d);if(Math.hypot(s.x-p.x,s.z-p.z)<5.7)score+=.6*(.6+.6*d/r.length);}return {...s,score};}).sort((a,b)=>b.score-a.score),p=g.nearestRoad(ranked[0]);return g.hero.alive&&Math.hypot(g.hero.x-p.x,g.hero.z-p.z)>2?{x:p.x,z:p.z}:null;});
    if(destination){await click('select-hero');await page.waitForTimeout(240);const p=await page.evaluate(p=>window.__REALM_WARDENS__.renderer.project(p.x,p.z,.12),destination);await world(p);await page.waitForTimeout(100);if(await page.locator('[data-action="cancel"]').count())await click('cancel');}
    }catch(error){if((await read()).mode!=='battle')return;throw error;}
  }
  async function skills(){
    const target=await page.evaluate(()=>{const a=window.__REALM_WARDENS__,g=a.game,h=g.hero;if(!h.alive||!g.canAct())return null;const skills=a.content.HEROES[h.kind].skills,e=[...g.enemies].filter(e=>e.alive&&g.legalGround(e)).sort((a,b)=>b.maxHp-a.maxHp)[0],near=g.enemies.some(e=>Math.hypot(e.x-h.x,e.z-h.z)<2.2);return {first:h.cooldowns[0]<=0&&(skills[0].target?!!e:near||h.hp<h.maxHp*.8),second:h.cooldowns[1]<=0&&(skills[1].target?!!e:near),targeted:skills.map(s=>!!s.target),point:e?{x:e.x,z:e.z}:null};});
    if(!target)return;
    for(const [i,ready]of [target.first,target.second].entries())if(ready){
      if(!await page.evaluate(()=>window.__REALM_WARDENS__.game.canAct()))return;
      const p=target.targeted[i]?await page.evaluate(p=>{const r=window.__REALM_WARDENS__.renderer,q=r.project(p.x,p.z,.12);return document.elementFromPoint(q.x,q.y)===r.canvas?q:null;},target.point):null;
      if(target.targeted[i]&&!p)continue;
      try{await page.locator('#skill-'+i).click({timeout:2500});if(p){await page.waitForTimeout(40);if(await page.evaluate(()=>window.__REALM_WARDENS__.game.canAct()))await world(p);}}
      catch(error){if((await read()).mode!=='battle')return;throw error;}
    }
  }
  return {click,read,world,site,prepare,skills};
}
