"""CC0 town, unarmed residents and rigged wolf. Blender 4.5 LTS background."""
import bpy,runpy,sys,json,hashlib,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
# Load the shared import/export helpers without rebuilding existing characters.
sys.argv=['build-scene-assets.py','--','scene']
api=runpy.run_path(str(ROOT/'scripts/build-models.py'))
reset,export,choose=api['reset'],api['export'],api['choose_actions']
report=api['report']

reset();bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/sources/animals/Wolf.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
print('WOLF_BONES',[(b.name,tuple(b.head_local),tuple(b.tail_local))for b in rig.data.bones],flush=True)
for o in bpy.data.objects:
    if o.type=='MESH':
        for p in o.data.polygons:p.use_smooth=True
        for m in o.data.materials:
            color=tuple(m.diffuse_color[:3]);m.use_nodes=True
            m.node_tree.nodes.clear();bs=m.node_tree.nodes.new('ShaderNodeBsdfPrincipled');out=m.node_tree.nodes.new('ShaderNodeOutputMaterial');m.node_tree.links.new(bs.outputs['BSDF'],out.inputs['Surface']);bs.inputs['Base Color'].default_value=(.27,.30,.28,1);bs.inputs['Roughness'].default_value=.82
            belly=api['material']('Wolf pale chest',(.52,.53,.45));o.data.materials.append(belly)
            for poly in o.data.polygons:
                if (o.matrix_world@poly.center).z<2.1:poly.material_index=len(o.data.materials)-1
# Eyes, nose, fangs and a layered neck ruff remain weighted to the head/spine.
head='Bone.003';dark=api['material']('Wolf nose and eyelids',(.035,.045,.035));amber=api['material']('Wolf amber eyes',(.84,.53,.08));ivory=api['material']('Wolf teeth',(.88,.83,.68));fur=api['material']('Wolf neck fur',(.21,.25,.21))
def wolf_sphere(name,p,size,mat,bone):
    p=rig.matrix_world@Vector(p);size=tuple(s*rig.scale.x for s in size)
    api['bind'](api['sphere'](name,p,size,mat),rig,bone)
def wolf_cone(name,p,r,depth,mat,bone,flip=False):
    p=rig.matrix_world@Vector(p);obj=api['cone'](name,p,r*rig.scale.x,depth*rig.scale.x,mat)
    if flip:obj.rotation_euler.x=math.pi
    api['bind'](obj,rig,bone)
for side in [-1,1]:
    wolf_sphere('Wolf eye socket',(2.78,side*.38,2.97),(.12,.06,.11),dark,head)
    wolf_sphere('Wolf amber eye',(2.8,side*.433,2.98),(.066,.026,.06),amber,head)
    wolf_cone('Wolf fang',(3.15,side*.19,2.53),.065,.27,ivory,head,True)
wolf_sphere('Wolf black nose',(3.33,0,2.75),(.14,.22,.115),dark,head)
for i in range(5):wolf_cone('Layered neck ruff',(1.15+i*.17,0,2.28+i*.12),.19,.5,fur,'Bone.002')
# Walking contains four independent IK feet, a flexing spine and tail motion.
choose(rig,{'Idle':['Idle'],'Walk':['Walking']})
idle=bpy.data.actions.get('Idle')
for name,frames in [('Attack',22),('Hit',12),('Death',38)]:
    rig.animation_data.action=bpy.data.actions.new(name)
    for f in [0,frames//3,frames*2//3,frames]:
        for pb in rig.pose.bones:pb.rotation_mode='XYZ';pb.rotation_euler=(0,0,0)
        phase=math.sin(f/frames*math.pi)
        # Root lunge, neck recoil and tail; animations act on the real skeleton.
        for bn in ['Bone','Bone.001','Bone.002']:
            pb=rig.pose.bones.get(bn)
            if pb:
                pb.rotation_euler.x=(-.22 if name=='Attack'else .12 if name=='Hit'else -.12)*phase
                if name=='Death':pb.rotation_euler.z=f/frames*1.25
                pb.keyframe_insert(data_path='rotation_euler',frame=f)
    rig.animation_data.action.use_fake_user=True
rig.animation_data.action=idle;bpy.context.scene.frame_set(0)
turn=bpy.data.objects.new('Wolf forward along +Z in glTF',None);bpy.context.collection.objects.link(turn)
for o in list(bpy.data.objects):
    if o!=turn and not o.parent:o.parent=turn
turn.rotation_euler.z=-math.pi/2
export('enemy-wolf','Quaternius Animated Animals Vol.2 (CC0); smooth fur, skeletal bite/hit/death adaptations',save_blend=True)

for name,stem in [('home-a','home_A'),('home-b','home_B'),('tavern','tavern'),('market','market'),('blacksmith','blacksmith'),('windmill','windmill'),('well','well')]:
    reset();bpy.ops.import_scene.gltf(filepath=str(ROOT/f'art/sources/town/kaykit/building_{stem}_blue.gltf'))
    export('town-'+name,'KayKit Medieval Hexagon Pack (CC0): building_'+stem+'_blue',mode='NONE',save_blend=True)
for name in ['cart','lantern']:
    reset();bpy.ops.import_scene.gltf(filepath=str(ROOT/f'art/sources/town/kenney/Models/GLB format/{name}.glb'))
    export('town-'+name,'Kenney Fantasy Town Kit 2.0 (CC0): '+name,mode='NONE')

for name,file in [('farmer','Barbarian'),('merchant','Mage'),('child','Rogue_Hooded')]:
    reset();bpy.ops.import_scene.gltf(filepath=str(ROOT/f'art/sources/adventurers/{file}.glb'));rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
    for o in list(bpy.data.objects):
        if o.type=='MESH' and (not o.name.startswith(file.split('_')[0]+'_')or any(k in o.name for k in ['Sword','Shield','Axe','Crossbow','Staff','Wand','Spellbook','Hat','Hood','Cape'])):bpy.data.objects.remove(o,do_unlink=True)
    # Residents have the source's full skin weights; their hands are unarmed.
    choose(rig,{'Idle':['Idle'],'Walk':['Walking_A','Walking_B'],'Panic':['Running_A','Running_B','Walking_A']})
    if name=='farmer':
        bone=next((b.name for b in rig.data.bones if b.name.lower()=='head'),None)
        if bone:
            p=rig.matrix_world@rig.data.bones[bone].head_local
            hat=api['material']('Citizen straw hat',(.66,.47,.21),0,.88)
            api['bind'](api['sphere']('Straw hat brim',(p.x,p.y,p.z+.34),(.5,.4,.055),hat),rig,bone)
            api['bind'](api['sphere']('Straw hat crown',(p.x,p.y,p.z+.44),(.29,.25,.17),hat),rig,bone)
    export('citizen-'+name,'KayKit Adventurers (CC0): unarmed '+file+' resident',save_blend=True)

all_path=ROOT/'art/model-report-all.json'
old=json.loads(all_path.read_text(encoding='utf8'));replacements={r['file']:r for r in report}
combined=[replacements.pop(r['file'],r)for r in old]+list(replacements.values())
all_path.write_text(json.dumps(combined,indent=2),encoding='utf8')
(ROOT/'art/model-report-scene.json').write_text(json.dumps(report,indent=2),encoding='utf8')
animal=ROOT/'art/sources/animals/animals-vol2.zip'
(ROOT/'art/sources/animals/manifest.json').write_text(json.dumps({'acquired':'2026-10-06','records':[{'file':str(animal.relative_to(ROOT)).replace('\\','/'),'bytes':animal.stat().st_size,'sha256':hashlib.sha256(animal.read_bytes()).hexdigest(),'author':'Quaternius','license':'CC0-1.0','url':'https://opengameart.org/content/animated-animales-low-poly'}]},indent=2),encoding='utf8')
print('SCENE_ASSETS_COMPLETE',len(combined),flush=True)
