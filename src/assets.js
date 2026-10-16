import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

const cache=new Map(),loader=new GLTFLoader();
// This CC0 bird has attack/hit/death clips only. Supply a genuine looping
// flight action on its existing wing joints, keeping attack clips independent.
function birdFlight(model,amplitude,name){
  const tracks=[],duration=.8,axis=new THREE.Vector3(0,0,1);
  model.traverse(bone=>{
    if(!bone.isBone||!/^Wing[12][._]?[LR]$/i.test(bone.name))return;
    const rest=bone.quaternion.clone(),side=/L$/i.test(bone.name)?1:-1,secondary=/Wing2/i.test(bone.name),times=[],values=[];
    for(let i=0;i<=12;i++){const t=i/12,angle=Math.sin(t*Math.PI*2)*amplitude*side*(secondary?.42:1),q=rest.clone().multiply(new THREE.Quaternion().setFromAxisAngle(axis,angle));times.push(t*duration);values.push(...q.toArray());}
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.uuid}.quaternion`,times,values));
  });
  return new THREE.AnimationClip(name,duration,tracks);
}
const heroes=['knight','ranger','mage','druid'];
const creatures=['imp','wolf','raider','armor','wisp','bat','harpy','shaman','shield','brood','grub','siege','elite','warlock','frostguard','treant','iceking','ashlord','guard','scout','tree'];
const towers=['arrow','ballista','cannon','arcane','frost','thunder','nature','barracks'];
const variants=[[1,null],[2,null],[3,null],[3,0],[3,1]];
export const scenery=['home-a','home-b','tavern','market','blacksmith','windmill','well','cart','lantern'];
export const assetFiles=[...heroes.map(k=>`hero-${k}`),...creatures.map(k=>`enemy-${k}`),...towers.flatMap(k=>variants.map(([lv,sp])=>`tower-${k}-${lv}-${sp??'base'}`)),...scenery.map(k=>`town-${k}`),...['farmer','merchant','child'].map(k=>`citizen-${k}`)];
export async function loadAssets(progress=()=>{}){
  let cursor=0,done=0;const failures=[];
  await Promise.all(Array.from({length:5},async()=>{while(cursor<assetFiles.length){const name=assetFiles[cursor++];try{const gltf=await loader.loadAsync(`/models/${name}.glb`);gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});cache.set(name,gltf);}catch(error){failures.push({name,message:error.message});}progress(++done,assetFiles.length);}}));
  if(failures.length)throw Error(`模型资源无法载入：${failures.map(f=>f.name).join('、')}`);
  return cache.size;
}
export function assetUnit(kind,hero=false){
  const data=cache.get(`${hero?'hero':'enemy'}-${kind}`);if(!data)return null;
  const root=new THREE.Group(),model=clone(data.scene);root.add(model);model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model),height=box.max.y-box.min.y;
  const target=hero?2.45:({treant:4.4,iceking:4.3,ashlord:4.65,siege:2.45,brood:1.7,grub:.95,wolf:1.25,tree:2.7,bat:1.3,harpy:1.25,wisp:1.35,guard:1.7,scout:1.65,frostguard:2.2,elite:2.1}[kind]||1.7);
  model.position.y=-box.min.y;root.scale.setScalar(target/Math.max(.1,height));
  const mixer=new THREE.AnimationMixer(model),actions={};
  for(const clip of data.animations){const name=clip.name.replace(/\.\d+$/,'');actions[name]=mixer.clipAction(clip);}
  if(kind==='harpy'&&!actions.Walk){actions.Walk=mixer.clipAction(birdFlight(model,.65,'Walk'));actions.Idle=mixer.clipAction(birdFlight(model,.38,'Idle'));}
  (actions.Idle||Object.values(actions)[0])?.play();mixer.update(.016);
  root.name=`${hero?'hero':'enemy'}-${kind}`;root.userData.asset=true;root.userData.mixer=mixer;root.userData.actions=actions;root.userData.animation='Idle';root.userData.targetHeight=target;
  return root;
}
export function animateAsset(root,entity,type,time,dt){
  const data=root.userData;if(!data.mixer)return false;
  const attacking=time-(entity.attackAt??-99)<.55,moving=entity.path?.length||type==='enemy'&&!entity.blocker&&!(entity.stunUntil>time);
  const next=entity.alive===false?'Death':entity.castUntil>time?'Cast':attacking?'Attack':moving?'Walk':'Idle';
  if(next!==data.animation){const old=data.actions[data.animation],action=data.actions[next]||data.actions.Idle;if(action){old?.fadeOut(.12);action.reset().fadeIn(.12).play();if(['Attack','Death','Cast'].includes(next)){action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;}else action.setLoop(THREE.LoopRepeat,Infinity);}data.animation=next;}
  if(entity.stunUntil>time){data.mixer.timeScale=0;}else data.mixer.timeScale=moving?1.15:1;
  data.mixer.update(dt);return true;
}
export function assetTower(kind,level,spec){
  const data=cache.get(`tower-${kind}-${level}-${spec??'base'}`);if(!data)return null;
  const root=data.scene.clone(true);root.userData.asset=true;root.userData.head=root.getObjectByName('Turret');return root;
}
export function assetScenery(kind,width=3){
  const data=cache.get(`town-${kind}`);if(!data)return new THREE.Group();
  const root=new THREE.Group(),model=data.scene.clone(true);root.add(model);model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  model.position.set(-center.x,-box.min.y,-center.z);root.scale.setScalar(width/Math.max(size.x,size.z,.1));root.userData.asset=true;return root;
}
export function assetCitizen(kind){
  const data=cache.get(`citizen-${kind}`);if(!data)return new THREE.Group();
  const root=new THREE.Group(),model=clone(data.scene);root.add(model);model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model);model.position.y=-box.min.y;root.scale.setScalar((kind==='child'?1.05:1.65)/Math.max(.1,box.max.y-box.min.y));
  const mixer=new THREE.AnimationMixer(model),actions={};for(const clip of data.animations)actions[clip.name.replace(/\.\d+$/,'')]=mixer.clipAction(clip);
  actions.Walk?.play();root.userData.mixer=mixer;root.userData.actions=actions;root.userData.animation='Walk';return root;
}
export const assetStatus=()=>({loaded:cache.size,expected:assetFiles.length,files:[...cache.keys()]});
