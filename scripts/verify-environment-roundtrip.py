"""Verify real Blender re-import of static runtime hull/architecture derivatives."""
import argparse,json,pathlib,struct,sys
import bpy
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--output-directory',required=True);p.add_argument('sources',nargs='+')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);folder=pathlib.Path(a.output_directory);folder.mkdir(parents=True,exist_ok=True)
def doc(path):
    b=path.read_bytes();return json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]])
def capture():
    points=[o.matrix_world@Vector(c) for o in bpy.context.scene.objects if o.type=='MESH' for c in o.bound_box]
    bounds=[min(p[i] for p in points) for i in range(3)]+[max(p[i] for p in points) for i in range(3)]
    nodes={o.name:list(o.matrix_world.translation) for o in bpy.context.scene.objects if o.type=='EMPTY'}
    count=0
    for o in bpy.context.scene.objects:
        if o.type=='MESH':o.data.calc_loop_triangles();count+=len(o.data.loop_triangles)
    return bounds,nodes,count
reports=[]
for filename in a.sources:
    source=pathlib.Path(filename).resolve();target=folder/(source.stem+'_roundtrip.glb')
    if target.exists() or target==source:raise RuntimeError('Roundtrip must preserve existing files')
    original=doc(source);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source));before=capture()
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
    restored=doc(target);assert len(restored.get('images',[]))==len(original.get('images',[]))
    assert all(not image.get('uri') and 'bufferView' in image for image in restored.get('images',[]))
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(target));after=capture()
    assert all(abs(x-y)<.0001 for x,y in zip(before[0],after[0])),source.name
    assert before[2]==after[2],source.name
    for name,xyz in before[1].items():assert name in after[1] and all(abs(x-y)<.0001 for x,y in zip(xyz,after[1][name])),name
    reports.append({'source':source.name,'triangles':before[2],'nodes':len(before[1]),'images':len(original.get('images',[])),'bytes':source.stat().st_size})
(folder/'verification.json').write_text(json.dumps(reports,indent=2))
print('ENVIRONMENT_ROUNDTRIP_VERIFIED '+json.dumps(reports))
