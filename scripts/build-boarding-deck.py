"""Authored cutaway deck from the same metre layout as navigation/collision.

Only architecture is exported: gameplay terminals, moving doors and encounters
remain interactive runtime consumers. Private master is retained separately.
"""
import argparse,json,math,pathlib,sys
import bpy,bmesh
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--layout',required=True);p.add_argument('--material-master',required=True);p.add_argument('--directory',required=True);p.add_argument('--module-source')
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
warning=mat('Deck regulatory warning',(.72,.018,.008),.48,.34,.25)
screen=mat('Deck security display',(.01,.19,.42),.18,.24,2.4)
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
def module(parent,name,x,z,y,scale=1,rotation=0):
    if not a.module_source:return
    source=pathlib.Path(a.module_source)/(name+'.glb')
    if not source.exists():raise RuntimeError('Missing licensed module '+str(source))
    before=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(source));imported=[obj for obj in scene.objects if obj not in before]
    root=bpy.data.objects.new('CC0_'+name,None);scene.collection.objects.link(root);root.parent=parent;root.location=(x,-z,y);root.rotation_euler[2]=-rotation;root.scale=(scale,scale,scale)
    for obj in imported:
        if obj.parent is None:obj.parent=root
        if obj.type!='MESH':continue
        for slot in obj.material_slots:
            color=slot.material.diffuse_color if slot.material else (0,0,0,1)
            slot.material=warning if color[0]>color[1]*1.2 else screen if color[2]>color[0]*1.2 else trim if sum(color[:3])>1.35 else wall
    # Bake module transforms into the room and feed them through the same
    # material batching pass as authored plates. The source kit stays modular;
    # the browser receives a small number of room-level drawables.
    scene.view_layers[0].update()
    meshes=[obj for obj in imported if obj.type=='MESH']
    for obj in meshes:
        world=obj.matrix_world.copy();obj.parent=parent;obj.matrix_world=world;objects.append(obj)
    for obj in [root,*imported]:
        if obj.type!='MESH' and obj.users_collection:bpy.data.objects.remove(obj,do_unlink=True)
    return meshes
for room in layout['rooms']:
    objects=[];x,z,w,d=room['x'],room['z'],room['width'],room['depth']
    root=bpy.data.objects.new('Deck_'+room['id'],None);scene.collection.objects.link(root)
    box('Continuous pressure deck',x,z,-.15,w,d,.18,wall,0)
    # Four-metre plates retain readable floor seams over the continuous deck while
    # keeping the expanded interior inside the mobile scene budget.
    for i in range(int(w/4)):
        for j in range(int(d/4)):box('Deck plate',x-w/2+2+i*4,z-d/2+2+j*4,-.09,3.985,3.985,.18,plate,.018)
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
    if room['id']=='rescue' and a.module_source:
        # A licensed modular kit supplies reusable secondary forms. CODED materials,
        # placement and silhouette treatment keep the Atrium visually coherent.
        for px in [-9,9]:
            for pz in [-5,0,5]:module(root,'balcony-floor',px,pz,1.42,1.18,math.pi/2)
            for pz in [-5,0,5]:module(root,'balcony-rail',px-(1.3 if px>0 else -1.3),pz,2.22,1.18,math.pi/2)
        for px in [-8.6,8.6]:module(root,'stairs-ramp',px,-5.8,.02,1.05,math.pi if px>0 else 0)
        for px in [-7,0,7]:module(root,'wall-window',px,8.15,.08,1.35,math.pi)
        module(root,'display-wall-wide',7.5,2,.15,1.18,-math.pi/2)
        module(root,'computer-wide',5.1,-3,.02,1.1,0)
        module(root,'computer-wide',-5.1,3,.02,1.1,math.pi)
        for pz in [-5.6,5.6]:module(root,'structure-barrier-high',0,pz,.02,.9,math.pi/2)
        for pz in [-5,5]:module(root,'pipe',-11.35,pz,.45,1.3,0)
        module(root,'pipe-bend',-11.35,7,.45,1.3,0)
    if room['id']=='engineering' and a.module_source:
        # Engineering is a denser power-control sector rather than another flat
        # corridor. Keep the east doorway clear for the Atrium return route.
        for px in [-22,-18,-14]:module(root,'wall-window',px,5.15,.08,1.05,math.pi)
        for pz in [-3.6,0,3.6]:module(root,'pipe',-24.35,pz,.42,1.2,0)
        module(root,'pipe-bend',-24.35,-5,.42,1.2,0)
        module(root,'display-wall-wide',-22,4.55,.12,1.02,math.pi)
        module(root,'computer-wide',-20.4,1.3,.02,.92,math.pi/2)
        module(root,'wall-switch',-23.55,2.2,.15,1.08,-math.pi/2)
        for pz in [-3.4,3.4]:module(root,'structure-barrier-high',-16.2,pz,.02,.82,math.pi/2)
        # Twin energized bus bars create an unmistakable power-room silhouette.
        for px in [-20.5,-15.5]:
            box('Engineering power bus',px,0,.13,.3,7.2,.22,warning,.04)
            for pz in [-2.7,0,2.7]:box('Engineering bus node',px,pz,.32,.72,.72,.42,screen,.08)
    if room['id']=='command' and a.module_source:
        # Command Access is a surveillance deck wrapped around the holographic
        # table. Side hardware preserves the north/south assault lane.
        for px in [-6,0,6]:module(root,'wall-window',px,18.15,.08,1.12,math.pi)
        module(root,'display-wall-wide',5.8,17.75,.12,1.08,math.pi)
        module(root,'computer-wide',-6.2,11.1,.02,1.02,0)
        module(root,'computer-wide',6.2,11.1,.02,1.02,0)
        module(root,'wall-switch',-8.35,16,.15,1.08,math.pi/2)
        for px in [-6.7,6.7]:module(root,'structure-barrier-high',px,15.8,.02,.86,0)
        for pz in [11.2,16.8]:module(root,'pipe',8.35,pz,.42,1.18,0)
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
