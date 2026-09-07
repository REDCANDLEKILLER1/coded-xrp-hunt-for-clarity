"""Create a private material master and closed/open runtime exports from v03 LOD0.

Generated armor albedo is an explicitly supplied material input. Micro-surface
roughness and normal maps are original periodic manufacturing fields, not a
claim that generated color alone creates a physically complete material.
"""
import argparse,json,math,pathlib,sys
import bpy,bmesh,numpy as np
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--albedo',required=True);p.add_argument('--directory',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);folder=pathlib.Path(a.directory);folder.mkdir(parents=True,exist_ok=True)
master=folder/'warship_material_master_v04.blend'
if master.exists():raise RuntimeError('Use a new version directory; preserve existing masters')
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(pathlib.Path(a.source).resolve()))
scene=bpy.context.scene
albedo=bpy.data.images.load(str(pathlib.Path(a.albedo).resolve()));albedo.name='Armor albedo';albedo.scale(1024,1024)
albedo.filepath_raw=str(folder/'armor_albedo.jpg');albedo.file_format='JPEG';albedo.save();albedo.pack()
n=512;y,x=np.mgrid[0:n,0:n].astype(np.float32)/n
# Small periodic tooling marks vary reflection without changing the silhouette.
grain=(np.sin(x*math.tau*71+y*math.tau*3)*.45+np.sin(y*math.tau*163+x*math.tau*7)*.18+np.sin(x*math.tau*13)*.15)
rough=np.clip(.53+grain*.065,.39,.64)
height=(np.sin(y*math.tau*163+x*math.tau*7)*.002+np.sin(x*math.tau*71+y*math.tau*3)*.001)
dx=(np.roll(height,-1,1)-np.roll(height,1,1))*.7;dy=(np.roll(height,-1,0)-np.roll(height,1,0))*.7
normal=np.stack([-dx,-dy,np.ones_like(dx)],axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True);normal=normal*.5+.5
def texture(name,rgb):
    im=bpy.data.images.new(name,width=n,height=n,alpha=False);im.colorspace_settings.name='Non-Color'
    rgba=np.concatenate([rgb,np.ones((n,n,1),np.float32)],axis=-1).astype(np.float32);im.pixels.foreach_set(rgba.ravel())
    im.filepath_raw=str(folder/(name+'.png'));im.file_format='PNG';im.save();im.pack();return im
normal_map=texture('Armor micro normal',normal)
orm=texture('Armor roughness metal',np.stack([np.ones_like(rough),rough,np.full_like(rough,.82)],axis=-1))
materials={}
for m in list(bpy.data.materials):
    original=m.name;m.use_nodes=True;nodes=m.node_tree.nodes;nodes.clear();links=m.node_tree.links
    out=nodes.new('ShaderNodeOutputMaterial');bs=nodes.new('ShaderNodeBsdfPrincipled');links.new(bs.outputs['BSDF'],out.inputs['Surface'])
    m.name=original.replace('_PROXY','')
    if original.startswith('Armor') or original.startswith('Door') or original.startswith('Weapon'):
        color=nodes.new('ShaderNodeTexImage');color.image=albedo;links.new(color.outputs['Color'],bs.inputs['Base Color'])
        data=nodes.new('ShaderNodeTexImage');data.image=orm;sep=nodes.new('ShaderNodeSeparateColor');links.new(data.outputs['Color'],sep.inputs[0]);links.new(sep.outputs['Green'],bs.inputs['Roughness']);links.new(sep.outputs['Blue'],bs.inputs['Metallic'])
        tex=nodes.new('ShaderNodeTexImage');tex.image=normal_map;nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.6;links.new(tex.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    else:
        c=(.22,.009,.002,1) if original.startswith('Hostile') else (.3,.065,.008,1)
        bs.inputs['Base Color'].default_value=c;bs.inputs['Metallic'].default_value=.35;bs.inputs['Roughness'].default_value=.43
        bs.inputs['Emission Color'].default_value=(1,.038,.004,1);bs.inputs['Emission Strength'].default_value=1.2
    materials[m.name]=m
meshes=[o for o in scene.objects if o.type=='MESH']
for obj in meshes:
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
    # Keep exported world geometry and all attachment transforms intact.
    world=obj.matrix_world.copy();obj.parent=None;obj.matrix_world=world;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='Manufactured metre UV')
    for poly in obj.data.polygons:
        axis=max(range(3),key=lambda i:abs(poly.normal[i]))
        for index in poly.loop_indices:
            v=obj.data.vertices[obj.data.loops[index].vertex_index].co
            uv.data[index].uv=((v.y,v.z) if axis==0 else (v.x,v.z) if axis==1 else (v.x,v.y))
            uv.data[index].uv/=8
    # v03 hard-surface bevels keep flat major faces and smoothly rounded edges.
    for poly in obj.data.polygons:poly.use_smooth=True
    mod=obj.modifiers.new('Weighted armor normals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=50
    bpy.ops.object.modifier_apply(modifier=mod.name)
groups={}
for obj in meshes:groups.setdefault(obj.data.materials[0].name,[]).append(obj)
for i,group in enumerate(groups.values()):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in group:obj.select_set(True)
    bpy.context.view_layer.objects.active=group[0]
    if len(group)>1:bpy.ops.object.join()
    bpy.context.object.name=f'Warship_PBR_{i:02d}'
bpy.ops.wm.save_as_mainfile(filepath=str(master))
def export(filename):
    target=folder/filename;bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False,export_image_format='AUTO',export_keep_originals=False)
    count=0
    for o in scene.objects:
        if o.type=='MESH':o.data.calc_loop_triangles();count+=len(o.data.loop_triangles)
    print('WARSHIP_MATERIAL_EXPORT '+json.dumps({'file':filename,'bytes':target.stat().st_size,'triangles':count}))
export('regulatory_warship.glb')
# The landing derivative retains the full hull except for the measured open bay.
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,28,-10.4));cutter=bpy.context.object;cutter.scale=(8.8,12,19.2);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for obj in [o for o in scene.objects if o.type=='MESH' and o!=cutter]:
    if not any(m.name.startswith(('Armor','Door')) for m in obj.data.materials):continue
    bpy.context.view_layer.objects.active=obj;mod=obj.modifiers.new('Recovery bay','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter;bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter,do_unlink=True)
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'warship_material_open_v04.blend'))
export('regulatory_warship_open.glb')
