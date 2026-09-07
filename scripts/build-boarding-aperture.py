"""Private landing derivative: cut an actual recovery bay into v03's lower hull.

The closed flight derivative and original editable master remain unchanged.
Export coordinates are metres, +Y up, +Z bow. Blender coordinates are Z up.
"""
import argparse,json,pathlib,sys
import bpy
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--directory',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);folder=pathlib.Path(a.directory)
folder.mkdir(parents=True,exist_ok=True);master=folder/'warship_recovery_bay.blend'
if master.exists():raise RuntimeError('Preserve the existing master; select a new version directory')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(pathlib.Path(a.source).resolve()))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
# A 8.8 x 12 m opening surrounds all three fighters with clearance.
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,28,-10.4));cutter=bpy.context.object
cutter.name='Recovery aperture cutter';cutter.scale=(8.8,12,19.2)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
cut=[]
for obj in meshes:
    if not any(m and m.name in ['Armor_Gunmetal_PROXY','Armor_Plane_PROXY','Door_Neutral_PROXY'] for m in obj.data.materials):continue
    bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new('Ventral recovery opening','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name);cut.append(obj.name)
bpy.data.objects.remove(cutter,do_unlink=True)
bpy.ops.wm.save_as_mainfile(filepath=str(master))
output=folder/'regulatory_warship_open.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
print('RECOVERY_BAY_BUILT '+json.dumps({'bytes':output.stat().st_size,'cutMeshes':cut,'openingMetres':[8.8,12],'ceilingInShip':-.8}))
