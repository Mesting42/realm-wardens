import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'art/sources/animals/Wolf.blend'))
print('WOLF_SOURCE',json.dumps({'objects':[(o.name,o.type,list(o.location),list(o.scale),list(o.rotation_euler),[list(p)for p in o.bound_box]if o.type=='MESH'else [])for o in bpy.data.objects],'actions':[a.name for a in bpy.data.actions],'head':[(b.name,list(b.head_local),list(b.tail_local))for o in bpy.data.objects if o.type=='ARMATURE'for b in o.data.bones if b.name in ['Bone.002','Bone.003']]}),flush=True)
for o in bpy.data.objects:
    if o.type=='MESH':print('HEAD_VERTICES',[(tuple(v.co),tuple(o.matrix_world@v.co))for v in o.data.vertices if v.co.x>2.7][:25],flush=True)
