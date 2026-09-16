"""Build the captured Warship's first walkable city district.

The runtime owns characters and interactions. This file owns the coloured,
cutaway architecture and named service anchors used by CivicScene.
"""
import argparse,json,pathlib,sys
import bpy,bmesh

p=argparse.ArgumentParser();p.add_argument('--directory',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);folder=pathlib.Path(a.directory);folder.mkdir(parents=True,exist_ok=True)
master=folder/'civic_deck_master.blend'
if master.exists():raise RuntimeError('Use a new version directory; preserve existing masters')
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene

def mat(name,color,metal=.35,rough=.48,glow=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=(*color,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough
    if glow:b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=glow
    return m

floor=mat('Civic navy deck',(0.018,.035,.07),.72,.34);wall=mat('Civic pearl armor',(.22,.3,.36),.56,.4);trim=mat('Civic gold trim',(.52,.29,.055),.8,.3)
green=mat('Captured route green',(0,.72,.2),.12,.25,5);cyan=mat('Market cyan',(0,.26,.62),.1,.23,4);amber=mat('Trade amber',(.95,.28,.015),.15,.28,4)
violet=mat('Medical violet',(.35,.04,.8),.1,.28,4);blue=mat('Bank blue',(.025,.18,.85),.14,.25,4);red=mat('Restricted red',(.9,.025,.01),.15,.28,4)
cream=mat('Residential warm light',(.86,.62,.31),.0,.7,2.2);dark=mat('Inset charcoal',(.012,.016,.026),.3,.72)
objects=[]
def box(name,x,z,y,w,d,h,material,bevel=.04,parent=None):
    v=[(x+sx*w/2,-z+sy*d/2,y+sz*h/2) for sz in [-1,1] for sy in [-1,1] for sx in [-1,1]]
    data=bpy.data.meshes.new(name);data.from_pydata(v,[],[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)]);data.materials.append(material)
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(data);bm.free();obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.parent=parent
    bpy.context.view_layer.objects.active=obj
    if bevel:
        mod=obj.modifiers.new('Soft manufactured edge','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
    objects.append(obj);return obj
def anchor(name,x,z,y=.02):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location=(x,-z,y);return o

# A broad promenade with readable neighbourhoods and no ceiling, designed for
# the game's high three-quarter camera. Repeated geometry is joined by material.
box('Continuous civic pressure deck',0,0,-.18,34,28,.22,floor,.02)
for x in range(-16,17,4):
    for z in range(-12,13,4):box('Civic floor plate',x,z,-.055,3.88,3.88,.09,wall,.025)
for x in [-16.8,16.8]:
    box('Outer pressure wall',x,0,.72,.36,28,1.5,wall)
    for z in range(-11,12,4):box('Wall light',x-(.2 if x>0 else -.2),z,.76,.05,2.25,.14,green if z<0 else cyan,.01)
for z in [-13.8,13.8]:
    box('Outer pressure wall',0,z,.72,34,.36,1.5,wall)
    for x in range(-14,15,4):box('Wall light',x,z-(.2 if z>0 else -.2),.76,2.25,.05,.14,green if x<0 else amber,.01)

# Central concourse and luminous captured-route spine.
for z in range(-11,12,2):box('Captured floor route',0,z,.015,1.15,1.65,.035,green,.008)
for x in [-5,5]:
    box('Concourse bench',x,0,.24,3.2,.75,.45,trim,.1);box('Bench cushion',x,0,.5,2.7,.62,.12,dark,.05)
box('Civic directory',0,2.7,.72,2.8,.35,1.45,cyan,.04);box('Directory frame',0,2.7,1.55,3.25,.42,.15,trim,.03)

# South arrival lift.
box('Lift arch',0,12.7,1.35,5.5,1.0,2.7,wall,.12);box('Lift door',0,13.18,1.05,3.4,.12,2.1,green,.02);box('Lift threshold',0,11.9,.06,5.4,1.15,.12,trim,.03)
anchor('Lift_Boarding',0,11.2)

# West market: individual counters, canopy, goods, and strong colour blocks.
box('Market canopy',-11,-3,2.35,9,7,.3,cyan,.1);box('Market counter',-11,-.5,.55,8,1.3,1.05,trim,.08)
for x,color in [(-14,violet),(-11,amber),(-8,cyan)]:
    box('Vendor tower',x,-4.4,1.05,2.25,2.5,2.1,dark,.12);box('Vendor sign',x,-3.08,1.55,1.75,.08,.7,color,.025)
for x in [-13,-11,-9]:box('Cargo display',x,.55,.86,1.15,.65,.55,amber,.07)
anchor('Market_Med',-11,1.55);anchor('Armory_Capacitor',-7.6,-1.15)

# East civic services: bank and quarters are deliberately different spaces.
box('Bank wall',11,-4,1.2,9,.7,2.4,blue,.08);box('Bank teller',11,-1.3,.6,7.4,1.05,1.2,trim,.07)
for x in [8.5,11,13.5]:box('Bank screen',x,-3.58,1.25,1.65,.08,.78,blue,.02)
anchor('Bank_Kiosk',11,-.15)
box('Quarters canopy',11,7.2,2.2,9,5.8,.25,cream,.1);box('Quarters desk',11,4.9,.55,7.2,1.0,1.05,wall,.08)
for x in [8.3,11,13.7]:box('Bunk alcove',x,8.0,.85,2.1,2.2,1.7,dark,.12)
for x in [8.3,11,13.7]:box('Bunk light',x,6.85,1.35,1.45,.08,.28,cream,.02)
anchor('Quarters_Save',11,3.75)

# Northern routes announce the future city without exposing unfinished rooms.
for x,label,color in [(-12,'Casino_Door',amber),(-4,'Brig_Door',red),(4,'Residential_Door',cream),(12,'Hangar_Door',cyan)]:
    box('District gate',x,-13.15,1.25,5.1,.45,2.5,wall,.09);box('District seal',x,-12.88,1.22,3.5,.08,1.25,color,.025);anchor(label,x,-11.9)

# Batch the many authored pieces into one drawable per material.
groups={}
for obj in objects:groups.setdefault(obj.data.materials[0].name,[]).append(obj)
for index,group in enumerate(groups.values()):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in group:obj.select_set(True)
    bpy.context.view_layer.objects.active=group[0]
    if len(group)>1:bpy.ops.object.join()
    bpy.context.object.name=f'Civic_architecture_{index}'

bpy.ops.wm.save_as_mainfile(filepath=str(master));target=folder/'civic_deck.glb'
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
triangles=0;surfaces=0
for obj in scene.objects:
    if obj.type=='MESH':obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles);surfaces+=1
print('CIVIC_DECK_BUILT '+json.dumps({'bytes':target.stat().st_size,'triangles':triangles,'surfaces':surfaces}))
