import bpy,json,os
from pathlib import Path
root=Path(__file__).resolve().parents[1]
for path in [root/'art/sources/adventurers/Knight.glb',root/'art/sources/quaternius/Big_Orc.blend']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if path.suffix=='.glb':bpy.ops.import_scene.gltf(filepath=str(path))
    else:bpy.ops.wm.open_mainfile(filepath=str(path))
    print('ASSET_INSPECTION',json.dumps({'file':str(path),'objects':[{'name':o.name,'type':o.type,'parent':o.parent.name if o.parent else None,'dimensions':list(o.dimensions),'vertices':len(o.data.vertices) if o.type=='MESH' else 0}for o in bpy.data.objects][:60],'actions':[{'name':a.name,'frames':list(a.frame_range)}for a in bpy.data.actions],'images':[{'name':i.name,'path':i.filepath,'packed':bool(i.packed_file)}for i in bpy.data.images],'bones':[b.name for o in bpy.data.objects if o.type=='ARMATURE' for b in o.data.bones][:55]},ensure_ascii=True))
