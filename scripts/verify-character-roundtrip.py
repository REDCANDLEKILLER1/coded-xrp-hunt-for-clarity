"""Read a runtime GLB through Blender, re-export privately and compare contracts."""
import argparse,json,pathlib,struct,sys
import bpy
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);source=pathlib.Path(a.source);target=pathlib.Path(a.output)
if source.resolve()==target.resolve():raise RuntimeError('Roundtrip must not overwrite runtime source')
def document(path):
    b=path.read_bytes();return json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]])
original=document(source)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source))
before={n:list(bpy.data.objects[n].matrix_world.translation) for n in ['Hero_Origin','Hand_R','Hand_L']}
target.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS')
restored=document(target)
assert {a['name'] for a in original['animations']}=={a['name'] for a in restored['animations']}
assert len(restored['images'])==3 and len(restored['skins'])==1
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(target))
for name,xyz in before.items():
    assert all(abs(bpy.data.objects[name].matrix_world.translation[i]-xyz[i])<.0001 for i in range(3)),name
print('CHARACTER_ROUNDTRIP_VERIFIED '+json.dumps({'clips':len(restored['animations']),'images':len(restored['images']),'attachments':len(before),'source_bytes':source.stat().st_size,'roundtrip_bytes':target.stat().st_size}))
