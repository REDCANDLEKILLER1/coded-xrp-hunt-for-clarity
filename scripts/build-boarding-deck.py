"""Authored cutaway deck from the same metre layout as navigation/collision.

Only architecture is exported: gameplay terminals, moving doors and encounters
remain interactive runtime consumers. Private master is retained separately.
"""
import argparse,json,math,pathlib,sys
import bpy,bmesh
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--layout',required=True);p.add_argument('--material-master',required=True);p.add_argument('--directory',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);layout=json.loads(pathlib.Path(a.layout).read_text(encoding='utf-8-sig'));folder=pathlib.Path(a.directory);folder.mkdir(parents=True,exist_ok=True)
master=folder/'boarding_deck_master.blend'
if master.exists():raise RuntimeError('Use a new version directory; preserve existing masters')
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
with bpy.data.libraries.load(a.material_master,link=False) as (src,dst):dst.materials=['Armor_Plane']
plate=bpy.data.materials.get('Armor_Plane');plate.name='Deck manufactured plate'
def mat(name,color,metal=.6,rough=.5,glow=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough
    if glow:b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=glow
    return m
wall=mat('Deck carbon ceramic',(.025,.037,.049),.35,.62)
trim=mat('Deck brushed rib',(.12,.16,.19),.8,.43)
light=mat('Deck warm working light',(.42,.57,.65),.0,.7,1.2)
objects=[]
def box(name,x,z,y,w,d,h,material,bevel=.025):
    # Function arguments use runtime X,Z ground plane; Blender Y=-runtime Z.
    v=[(x+sx*w/2,-z+sy*d/2,y+sz*h/2) for sz in [-1,1] for sy in [-1,1] for sx in [-1,1]]
    data=bpy.data.meshes.new(name);data.from_pydata(v,[],[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)]);data.materials.append(material)
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(data);bm.free()
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj
    if bevel:
        mod=obj.modifiers.new('Manufactured edge','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
    uv=data.uv_layers.new(name='Metre surface') if not obj.data.uv_layers else obj.data.uv_layers.active
    # Modifier application may replace the mesh datablock.
    if len(uv.data)!=len(obj.data.loops):uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='Metre surface')
    for poly in obj.data.polygons:
        axis=max(range(3),key=lambda i:abs(poly.normal[i]))
        for index in poly.loop_indices:
            co=obj.data.vertices[obj.data.loops[index].vertex_index].co
            uv.data[index].uv=((co.y,co.z) if axis==0 else (co.x,co.z) if axis==1 else (co.x,co.y));uv.data[index].uv/=4
    objects.append(obj);return obj
for room in layout['rooms']:
    objects=[];x,z,w,d=room['x'],room['z'],room['width'],room['depth']
    root=bpy.data.objects.new('Deck_'+room['id'],None);scene.collection.objects.link(root)
    box('Continuous pressure deck',x,z,-.15,w,d,.18,wall,0)
    for i in range(int(w/2)):
        for j in range(int(d/2)):box('Deck plate',x-w/2+1+i*2,z-d/2+1+j*2,-.09,1.985,1.985,.18,plate,.018)
    for axis in ['x','z']:
        for sign in [-1,1]:
            length=d if axis=='x' else w;fixed=(x if axis=='x' else z)+sign*(w if axis=='x' else d)/2
            for i in range(int(length/2)):
                along=-length/2+1+i*2;px=fixed if axis=='x' else x+along;pz=fixed if axis=='z' else z+along
                if any((door['a']==room['id'] or door['b']==room['id']) and math.hypot(px-door['x'],pz-door['z'])<door['width']*.7 for door in layout['doors']):continue
                box('Pressure wall',px,pz,.59,.28 if axis=='x' else 1.98,.28 if axis=='z' else 1.98,1.18,wall,.035)
                ix=px-sign*.16 if axis=='x' else px;iz=pz-sign*.16 if axis=='z' else pz
                box('Inset armor',ix,iz,.65,.06 if axis=='x' else 1.65,.06 if axis=='z' else 1.65,.68,plate,.018)
                box('Structural rib',px,pz,1.18,.42 if axis=='x' else 1.99,.42 if axis=='z' else 1.99,.09,trim,.018)
                box('Wall service light',ix,iz,.20,.03 if axis=='x' else .72,.03 if axis=='z' else .72,.045,light,.0)
    # Raised service channels and ribbed edge grilles make spaces read as machinery.
    for s in [-1,1]:
        px=x+s*(w/2-.55)
        box('Cable race',px,z,.055,.28,d-1.2,.11,trim,.025)
        for i in range(int((d-1.5)/.6)):box('Service grate',px,z-d/2+.85+i*.6,.117,.27,.08,.018,wall,0)
    if room['id']=='hangar':
        for px in [-4.33,4.33]:box('Recovery platform surround',px,-28,.018,.08,12.1,.036,trim,.008)
        for pz in [-34.04,-21.96]:box('Recovery platform end',0,pz,.018,8.74,.08,.036,trim,.008)
    groups={}
    for obj in objects:obj.parent=root;groups.setdefault(obj.data.materials[0].name,[]).append(obj)
    for index,group in enumerate(groups.values()):
        bpy.ops.object.select_all(action='DESELECT')
        for obj in group:obj.select_set(True)
        bpy.context.view_layer.objects.active=group[0]
        if len(group)>1:bpy.ops.object.join()
        bpy.context.object.name=f'{room["id"]}_architecture_{index}'
bpy.ops.wm.save_as_mainfile(filepath=str(master))
target=folder/'boarding_deck.glb';bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
triangles=0
for obj in scene.objects:
    if obj.type=='MESH':obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
print('BOARDING_DECK_BUILT '+json.dumps({'bytes':target.stat().st_size,'triangles':triangles,'rooms':len(layout['rooms'])}))
