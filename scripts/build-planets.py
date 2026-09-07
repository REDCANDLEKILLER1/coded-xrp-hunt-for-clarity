"""Game-scaled spheres with attributed NASA surface maps; no logos or baked sky."""
import argparse,json,pathlib,sys
import bpy
p=argparse.ArgumentParser();p.add_argument('--earth',required=True);p.add_argument('--mars',required=True);p.add_argument('--directory',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);folder=pathlib.Path(a.directory);folder.mkdir(parents=True,exist_ok=True)
reports=[]
for key,source in [('earth',a.earth),('mars',a.mars)]:
    master=folder/(key+'_master.blend')
    if master.exists():raise RuntimeError('Preserve existing masters; use a new version directory')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    image=bpy.data.images.load(str(pathlib.Path(source).resolve()));image.name=key+'_NASA_surface';image.scale(1024,512);image.file_format='JPEG';image.filepath_raw=str(folder/(key+'_surface.jpg'));image.save();image.pack()
    m=bpy.data.materials.new(key+'_surface');m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Metallic'].default_value=0;b.inputs['Roughness'].default_value=.88
    tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;m.node_tree.links.new(tex.outputs['Color'],b.inputs['Base Color'])
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96,ring_count=48,radius=1);sphere=bpy.context.object;sphere.name=key+'_globe';sphere.data.materials.append(m)
    for poly in sphere.data.polygons:poly.use_smooth=True
    root=bpy.data.objects.new('Planet_Origin',None);bpy.context.scene.collection.objects.link(root);sphere.parent=root
    bpy.ops.wm.save_as_mainfile(filepath=str(master));output=folder/(key+'.glb');bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
    sphere.data.calc_loop_triangles();reports.append({'id':key,'triangles':len(sphere.data.loop_triangles),'bytes':output.stat().st_size,'texture':[1024,512]})
(folder/'BUILD_REPORT.json').write_text(json.dumps(reports,indent=2));print('PLANETS_BUILT '+json.dumps(reports))
