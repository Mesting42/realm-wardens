"""Reproducible Blender asset pipeline: CC0 character adaptations and original wardens.
Run with Blender 4.5 LTS --background --factory-startup --disable-autoexec --python.
"""
import bpy,math,json,hashlib,random,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/models';OUT.mkdir(parents=True,exist_ok=True)
BLENDS=ROOT/'art/blender';BLENDS.mkdir(parents=True,exist_ok=True)
report=[]

def reset():bpy.ops.wm.read_factory_settings(use_empty=True)
def material(name,color,metal=0,rough=.65):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
    return m
def mesh_finish(obj,mat):obj.data.materials.clear();obj.data.materials.append(mat);return obj
def sphere(name,p,size,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=p);o=bpy.context.object;o.name=name;o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for f in o.data.polygons:f.use_smooth=True
    return mesh_finish(o,mat)
def cylinder_between(name,a,b,r,mat):
    a,b=Vector(a),Vector(b);delta=b-a;bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=delta.length,location=(a+b)*.5)
    o=bpy.context.object;o.name=name;o.rotation_euler=delta.to_track_quat('Z','Y').to_euler();return mesh_finish(o,mat)
def cone(name,p,r,depth,mat):
    bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=r,radius2=0,depth=depth,location=p);o=bpy.context.object;o.name=name;return mesh_finish(o,mat)
def bind(obj,rig,bone):
    world=obj.matrix_world.copy();obj.parent=rig;obj.matrix_world=world
    vg=obj.vertex_groups.new(name=bone);vg.add(list(range(len(obj.data.vertices))),1,'REPLACE');mod=obj.modifiers.new('Follow guardian skeleton','ARMATURE');mod.object=rig
def bounds(objects):
    points=[o.matrix_world@Vector(p) for o in objects if o.type=='MESH' for p in o.bound_box]
    return Vector(tuple(min(p[i]for p in points)for i in range(3))),Vector(tuple(max(p[i]for p in points)for i in range(3)))
def addons(kind,rig):
    gold=material('Warden engraved gold',(.7,.48,.18),.65,.33);green=material('Living leaves',(.19,.46,.2),0,.85);ice=material('Frost crystal',(.32,.75,.92),.2,.35);wood=material('Ancient bark',(.25,.14,.08),0,.87)
    bone='head' if 'head'in rig.data.bones else 'Head'
    if bone not in rig.data.bones:return
    center=rig.matrix_world@rig.data.bones[bone].head_local
    # The accessories are weighted to the original skeleton, so they follow all clips.
    if kind=='druid':
        head=[o for o in bpy.data.objects if o.type=='MESH' and 'Head'in o.name][0];low,high=bounds([head]);z=high.z-.1
        for side in [-1,1]:
            a=(center.x+side*.25,center.y,z-.1);b=(center.x+side*.62,center.y,z+.38)
            bind(cylinder_between('Forest antler',a,b,.045,wood),rig,bone)
            for i in range(3):
                x=center.x+side*(.35+i*.11);p=(x,center.y,z+.06+i*.14)
                bind(cylinder_between('Antler twig',p,(x+side*.11,center.y,z+.28+i*.14),.025,wood),rig,bone)
                bind(sphere('Crown leaf',(x,center.y-.07,z-.12),(.13,.06,.055),green),rig,bone)
    if kind in ['iceking','ashlord','shield','frostguard']:
        meshes=[o for o in bpy.data.objects if o.type=='MESH'];low,high=bounds(meshes);z=high.z-.1
        for i in range(7 if kind in ['iceking','ashlord']else 4):
            a=i*math.tau/(7 if kind in ['iceking','ashlord']else 4);p=(center.x+math.sin(a)*.44,center.y+math.cos(a)*.33,z+.13)
            bind(cone('Runic crown',p,.095,.48,ice if kind in ['iceking','frostguard','shield']else gold),rig,bone)
    if kind=='siege':
        bone='Torso' if 'Torso'in rig.data.bones else 'Body';center=rig.matrix_world@rig.data.bones[bone].head_local
        for side in [-1,1]:
            for i in range(4):bind(cone('Siege backplate spike',(center.x+side*.56,center.y+(i-1.5)*.3,center.z+.85),.105,.37,gold),rig,bone)

def choose_actions(rig,mapping):
    old=list(bpy.data.actions);selected={}
    for target,preferred in mapping.items():
        match=next((a for name in preferred for a in old if a.name==name),None)
        if match:selected[target]=match
    for o in bpy.data.objects:
        if o.animation_data:
            o.animation_data.action=None
            for t in list(o.animation_data.nla_tracks):o.animation_data.nla_tracks.remove(t)
    for a in old:
        if a not in selected.values():bpy.data.actions.remove(a)
    for name,a in selected.items():a.name=name;a.use_fake_user=True
    rig.animation_data_create();idle=selected.get('Idle')
    if idle:rig.animation_data.action=idle
    bpy.context.scene.frame_set(0);return list(selected)

def export(name,origin,mode='ACTIONS',save_blend=False):
    bpy.context.scene.render.fps=30
    for o in list(bpy.data.objects):
        if o.type in ['CAMERA','LIGHT']:bpy.data.objects.remove(o,do_unlink=True)
    for image in bpy.data.images:
        if image.name in ['Render Result','Viewer Node']:continue
        if image.has_data:
            if max(image.size)>512:image.scale(512,512)
            image.pack()
    bpy.ops.object.select_all(action='SELECT')
    dest=OUT/f'{name}.glb'
    bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_animations=mode!='NONE',export_animation_mode=mode if mode!='NONE'else 'ACTIONS',export_frame_range=False,export_force_sampling=True,export_anim_slide_to_zero=True,export_optimize_animation_size=True,export_materials='EXPORT',export_yup=True,export_apply=False)
    if save_blend:bpy.ops.wm.save_as_mainfile(filepath=str(BLENDS/f'{name}.blend'),compress=True)
    # Inspect the exported GLB itself, not just the Blender scene.
    b=dest.read_bytes();j=json.loads(b[20:20+int.from_bytes(b[12:16],'little')]);triangles=sum(p['count']//3 for p in j.get('accessors',[])if p.get('type')=='SCALAR' and p.get('componentType')in [5123,5125])
    record={'file':f'models/{name}.glb','source':origin,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'animations':[a['name']for a in j.get('animations',[])],'skins':len(j.get('skins',[])),'meshes':len(j.get('meshes',[])),'triangles':triangles}
    report.append(record);print('MODEL_BUILT',json.dumps(record),flush=True)

def kay(kind,file,folder,keep):
    reset();path=ROOT/f'art/sources/{folder}/{file}.glb';bpy.ops.import_scene.gltf(filepath=str(path));rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
    for o in list(bpy.data.objects):
        if o.type=='MESH' and not (o.name.startswith(file.split('_')[0]+'_') or o.name in keep):bpy.data.objects.remove(o,do_unlink=True)
        elif o.type=='MESH' and (('Shield'in o.name or 'Axe'in o.name or 'Sword'in o.name or 'Crossbow'in o.name or 'Spellbook'in o.name or 'Staff'in o.name or 'Wand'in o.name)and o.name not in keep):bpy.data.objects.remove(o,do_unlink=True)
    if kind=='druid':
        for o in list(bpy.data.objects):
            if o.type=='MESH' and o.name=='Mage_Hat':bpy.data.objects.remove(o,do_unlink=True)
        # Assign forest cloth to the purple parts of the atlas; preserve skin and trim.
        leaves=material('Druid woven forest cloth',(.16,.38,.23),0,.82)
        for o in bpy.data.objects:
            if o.type!='MESH' or o.name=='Mage_Head':continue
            o.data.materials.append(leaves);uv=o.data.uv_layers.active
            base=o.data.materials[0];images=[n.image for n in base.node_tree.nodes if n.type=='TEX_IMAGE' and n.image];image=images[0]if images else None
            if uv and image:
                px=list(image.pixels);w,h=image.size
                for poly in o.data.polygons:
                    u,v=uv.data[poly.loop_indices[0]].uv;x=max(0,min(w-1,int(u*w)));y=max(0,min(h-1,int(v*h)));r,g,b=px[(y*w+x)*4:(y*w+x)*4+3]
                    if b>g*1.15 and r>g*1.05:poly.material_index=len(o.data.materials)-1
    addons(kind,rig)
    melee=kind in ['knight','guard','armor'];ranged=kind in ['ranger','scout']
    choose_actions(rig,{'Idle':['Idle'],'Walk':['Walking_A','Walking_B'],'Attack':['1H_Melee_Attack_Slice_Horizontal'if melee else '1H_Ranged_Shoot'if ranged else 'Spellcast_Shoot'],'Cast':['Spellcast_Raise','Spellcast_Long'],'Hit':['Hit_A'],'Death':['Death_A'],'Victory':['Cheer']})
    export(('hero-'if kind in ['knight','ranger','mage','druid']else 'enemy-')+kind,f'KayKit {folder}: {file}; Warden equipment and material adaptation',save_blend=kind in ['knight','ranger','mage','druid'])

def monster(kind,file):
    reset();path=ROOT/f'art/sources/quaternius/{file}.blend';bpy.ops.wm.open_mainfile(filepath=str(path));rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
    atlas=ROOT/'art/sources/quaternius/Atlas_Monsters.png'
    for image in bpy.data.images:
        if 'Atlas_Monsters'in image.name:image.filepath=str(atlas);image.reload();image.pack()
    for o in bpy.data.objects:
        if o.type=='MESH':
            for p in o.data.polygons:p.use_smooth=True
            for mat in o.data.materials:
                if mat and mat.use_nodes:
                    bs=mat.node_tree.nodes.get('Principled BSDF')
                    if bs:bs.inputs['Roughness'].default_value=.72
    addons(kind,rig);choose_actions(rig,{'Idle':['Idle'],'Walk':['Walk','Run','Flying'],'Attack':['Weapon','Punch','Attack'],'Hit':['HitReact'],'Death':['Death']})
    export('enemy-'+kind,f'Quaternius Ultimate Monsters: {file}; Warden proportions and accessories',save_blend=kind in ['iceking','ashlord','siege'])

def surface_textures():
    # Blender-made albedo surfaces add stone grain, wood and gilded wear to our towers.
    for mat in bpy.data.materials:
        if not mat.use_nodes:continue
        bs=mat.node_tree.nodes.get('Principled BSDF')
        if not bs:continue
        color=tuple(bs.inputs['Base Color'].default_value[:3]);bright=sum(color)/3;image=bpy.data.images.new('Warden surface '+mat.name,width=96,height=96,alpha=True);rng=random.Random(mat.name)
        pixels=[]
        for y in range(96):
            for x in range(96):
                grain=.92+rng.random()*.13+.025*math.sin(x*.5+y*.07);pixels.extend([min(1,c*grain)for c in color]+[1])
        image.pixels.foreach_set(pixels);image.pack();tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
        if color[0]>color[1]*1.1 and color[1]>color[2]*1.15 and bright>.2:bs.inputs['Metallic'].default_value=.3;bs.inputs['Roughness'].default_value=.47
        else:bs.inputs['Roughness'].default_value=.76

def original(file):
    reset();bpy.ops.import_scene.gltf(filepath=str(ROOT/f'art/sources/originals/{file}.glb'))
    for o in list(bpy.data.objects):
        if o.type!='MESH':continue
        bpy.context.view_layer.objects.active=o;o.select_set(True)
        # Weld duplicate primitive vertices before a small two-segment bevel.
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.00001);bpy.ops.object.mode_set(mode='OBJECT')
        mod=o.modifiers.new('Fine masonry bevel','BEVEL');mod.width=.012;mod.segments=2;mod.limit_method='ANGLE';mod.angle_limit=.75
        bpy.ops.object.modifier_apply(modifier=mod.name);o.select_set(False)
    surface_textures()
    mode='NONE'
    if file.startswith('enemy-'):
        mode='NLA_TRACKS'
        for o in bpy.data.objects:
            if not(o.name.startswith('Arm')or o.name.startswith('Leg')or o.name=='Body'):continue
            original_rotation=o.rotation_euler.copy();original_position=o.location.copy();o.animation_data_create()
            for clip,frames in [('Idle',40),('Walk',24),('Attack',18)]:
                action=bpy.data.actions.new(o.name+'_'+clip);o.animation_data.action=action
                for f in range(0,frames+1,3):
                    o.rotation_euler=original_rotation;o.location=original_position;phase=f/frames*math.tau
                    if clip=='Walk' and o.name!='Body':o.rotation_euler.x+=math.sin(phase+(math.pi if o.name.endswith('1')else 0))*.3
                    elif clip=='Attack' and o.name.startswith('Arm'):o.rotation_euler.x-=math.sin(f/frames*math.pi)*.9
                    elif o.name=='Body':o.location.z+=math.sin(phase)*.022
                    o.keyframe_insert(data_path='rotation_euler',frame=f);o.keyframe_insert(data_path='location',frame=f)
                track=o.animation_data.nla_tracks.new();track.name=clip;track.strips.new(clip,0,action);o.animation_data.action=None
            o.rotation_euler=original_rotation;o.location=original_position
    export(file,'Original Realm Wardens model; Blender bevel, materials and animation',mode=mode,save_blend=file.endswith('1-base')or file.startswith('enemy-'))

stage=sys.argv[sys.argv.index('--')+1]if '--'in sys.argv else 'all'
if stage in ['all','characters']:
    for kind,file,folder,keep in [
        ('knight','Knight','adventurers',['1H_Sword','Badge_Shield']),('ranger','Rogue_Hooded','adventurers',['1H_Crossbow']),('mage','Mage','adventurers',['2H_Staff']),('druid','Mage','adventurers',['2H_Staff']),
        ('guard','Knight','adventurers',['1H_Sword','Round_Shield']),('scout','Rogue_Hooded','adventurers',['1H_Crossbow']),('armor','Skeleton_Warrior','skeletons',[]),('shield','Skeleton_Mage','skeletons',[])]:kay(kind,file,folder,keep)
    for kind,file in [('imp','Big_Orc'),('raider','Big_Tribal'),('shaman','Big_Orc_Skull'),('siege','Big_Dino'),('elite','Big_BlueDemon'),('frostguard','Big_Yeti'),('iceking','Big_Yeti'),('ashlord','Big_Demon'),('brood','Blob_Mushnub_Evolved'),('grub','Blob_Mushnub'),('warlock','Blob_Wizard'),('wisp','Flying_Ghost'),('bat','Flying_Demon'),('harpy','Flying_Pigeon')]:monster(kind,file)
if stage in ['all','originals']:
    for path in sorted((ROOT/'art/sources/originals').glob('*.glb')):original(path.stem)
dest=ROOT/f'art/model-report-{stage}.json';dest.write_text(json.dumps(report,indent=2),encoding='utf8')
print('BLENDER_PIPELINE_COMPLETE',len(report),flush=True)
