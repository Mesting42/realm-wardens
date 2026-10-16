// Small, shared navigation grid for residents inside the existing town walls.
// Rectangular building footprints prevent fleeing through houses or the well.
export function townNavigation(plan,buildings){
  const step=.38,minX=15.7,maxX=plan.maxX-.35,minZ=plan.minZ+.35,maxZ=plan.maxZ-.35;
  const width=Math.floor((maxX-minX)/step)+1,height=Math.floor((maxZ-minZ)/step)+1;
  const points=Array.from({length:width*height},(_,i)=>({x:minX+i%width*step,z:minZ+Math.floor(i/width)*step}));
  const blocked=p=>p.x<minX||p.x>maxX||p.z<minZ||p.z>maxZ||buildings.some(b=>p.x>b.minX-.14&&p.x<b.maxX+.14&&p.z>b.minZ-.14&&p.z<b.maxZ+.14);
  const walkable=points.map(p=>!blocked(p));
  const clear=(a,b)=>{const count=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.14));for(let i=1;i<=count;i++){const t=i/count;if(blocked({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t}))return false;}return true;};
  const nearestIndex=p=>{let best=-1,distance=Infinity;for(let i=0;i<points.length;i++)if(walkable[i]){const d=(p.x-points[i].x)**2+(p.z-points[i].z)**2;if(d<distance){distance=d;best=i;}}return best;};
  const nearest=p=>points[nearestIndex(p)];
  function path(from,to){
    if(!to)return null;if(clear(from,to))return [{...to}];
    const start=nearestIndex(from),end=nearestIndex(to);if(start<0||end<0)return null;
    const open=[start],cost=new Map([[start,0]]),previous=new Map(),closed=new Set();
    const heuristic=i=>Math.hypot(points[i].x-points[end].x,points[i].z-points[end].z);
    let found=false;
    while(open.length){
      open.sort((a,b)=>(cost.get(a)+heuristic(a))-(cost.get(b)+heuristic(b)));const current=open.shift();if(closed.has(current))continue;if(current===end){found=true;break;}closed.add(current);
      const x=current%width,z=Math.floor(current/width);
      for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
        const nx=x+dx,nz=z+dz,index=nz*width+nx;if(nx<0||nx>=width||nz<0||nz>=height||!walkable[index]||closed.has(index))continue;
        if(dx&&dz&&(!walkable[z*width+nx]||!walkable[nz*width+x]))continue;
        const nextCost=cost.get(current)+Math.hypot(dx,dz)*step;if(nextCost>=(cost.get(index)??Infinity))continue;
        cost.set(index,nextCost);previous.set(index,current);open.push(index);
      }
    }
    if(!found)return null;const route=[points[end]];let index=end;while(index!==start){index=previous.get(index);route.unshift(points[index]);}
    if(clear(points[end],to))route.push(to);
    const smooth=[];let anchor=from;for(let i=0;i<route.length;){let j=route.length-1;while(j>i&&!clear(anchor,route[j]))j--;smooth.push({...route[j]});anchor=route[j];i=j+1;}return smooth;
  }
  const goals=[];for(const x of [16.25,18.8,20.9,23.6,25.2])for(const offset of [-6.5,-2.15,-.46,.46,2.15,5.7]){const p=nearest({x,z:plan.center.z+offset});if(p&&!goals.some(g=>Math.hypot(g.x-p.x,g.z-p.z)<.55))goals.push(p);}
  return {path,nearest,clear,blocked,goals,bounds:{minX,maxX,minZ,maxZ}};
}
