"""Verify exact static runtime geometry, embedded maps and named world nodes.

Both outputs are private verification derivatives. Runtime input is never
overwritten. Blender's coordinate conversion is checked across re-import.
"""
import argparse,json,pathlib,struct,sys
import bpy
from mathutils import Vector
p=argparse.ArgumentParser()
for key in ['source','output','nodes']:p.add_argument('--'+key,required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);source=pathlib.Path(a.source);target=pathlib.Path(a.output)
if source.resolve()==target.resolve():raise RuntimeError('Preserve the runtime input')
def document(path):
    data=path.read_bytes();return json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])
def metrics():
    bpy.context.view_layer.update();triangles=0;minimum=Vector((float('inf'),)*3);maximum=-minimum
    for o in bpy.context.scene.objects:
        if o.type!='MESH':continue
        o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
        for v in o.data.vertices:
            p=o.matrix_world@v.co
            for i in range(3):minimum[i]=min(minimum[i],p[i]);maximum[i]=max(maximum[i],p[i])
    return {'triangles':triangles,'min':list(minimum),'max':list(maximum),'nodes':{name:list(bpy.data.objects[name].matrix_world.translation) for name in a.nodes.split(',')}}
original=document(source);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source));before=metrics()
target.parent.mkdir(parents=True,exist_ok=True);bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_animations=False,export_cameras=False,export_lights=False)
restored=document(target);assert len(restored['images'])==len(original['images']);assert not restored.get('skins');assert all(not image.get('uri') for image in restored['images'])
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(target));after=metrics();assert before['triangles']==after['triangles']
for key in ['min','max']:assert all(abs(x-y)<.0002 for x,y in zip(before[key],after[key])),key
for name,point in before['nodes'].items():assert all(abs(x-y)<.0002 for x,y in zip(point,after['nodes'][name])),name
print('STATIC_ROUNDTRIP_VERIFIED '+json.dumps({'source_bytes':source.stat().st_size,'roundtrip_bytes':target.stat().st_size,'images':len(restored['images']),**after}))
