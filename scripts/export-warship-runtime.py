"""Blender CLI: --background --python this.py -- --source <LOD.glb> --output <runtime.glb>."""
import argparse
import bpy
import json
import pathlib
import sys

args = argparse.ArgumentParser()
args.add_argument('--source', required=True)
args.add_argument('--output', required=True)
options = args.parse_args(sys.argv[sys.argv.index('--') + 1:])
source = pathlib.Path(options.source).resolve()
target = pathlib.Path(options.output).resolve()
if source == target:
    raise RuntimeError('Runtime export must not overwrite its source')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
names = ['Ship_Origin', 'Muzzle_FL', 'Muzzle_FR', 'Muzzle_L', 'Muzzle_R', 'Engine_L', 'Engine_R', 'Camera_Chase', 'Camera_Cockpit_Forward']
before = {name: list(bpy.data.objects[name].matrix_world.translation) for name in names}
groups = {}
for obj in list(bpy.context.scene.objects):
    if obj.type == 'MESH':
        key = tuple(slot.material.name if slot.material else '' for slot in obj.material_slots)
        groups.setdefault(key, []).append(obj)
for index, objects in enumerate(groups.values()):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    bpy.context.object.name = f'Warship_Surface_{index:02d}'
bpy.ops.object.select_all(action='SELECT')
target.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True, export_extras=False, export_animations=False, export_yup=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(target))
for name, xyz in before.items():
    restored = bpy.data.objects.get(name)
    if not restored or any(abs(restored.matrix_world.translation[i] - xyz[i]) > .0001 for i in range(3)):
        raise RuntimeError(f'Attachment changed after roundtrip: {name}')
triangles = 0
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
print('RUNTIME_EXPORT_VERIFIED ' + json.dumps({'triangles': triangles, 'mesh_objects': sum(obj.type == 'MESH' for obj in bpy.context.scene.objects), 'bytes': target.stat().st_size, 'attachment_count': len(names)}))
