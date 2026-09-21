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

floor=mat('Civic navy deck',(0.018,.035,.07),.72,.34);wall=mat('Civic pearl armor',(.045,.06,.075),.72,.54);trim=mat('Civic gold trim',(.16,.105,.065),.7,.55)
green=mat('Captured route green',(.015,.22,.085),.12,.4,1.4);cyan=mat('Market cyan',(.025,.13,.22),.1,.4,1.8);amber=mat('Trade amber',(.3,.09,.015),.15,.4,1.6)
violet=mat('Medical violet',(.055,.23,.19),.1,.4,1.8);blue=mat('Bank blue',(.035,.09,.25),.14,.4,1.6);red=mat('Restricted red',(.4,.012,.006),.15,.4,2.2)
cream=mat('Residential warm light',(.22,.19,.15),.1,.7,.4);dark=mat('Inset charcoal',(.012,.016,.026),.3,.72)
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

# Shared layout drives both collision and architecture: no invisible shop walls.
layout=json.loads((pathlib.Path(__file__).resolve().parents[1]/'src/game/definitive/civic-layout.json').read_text())
box('Continuous civic pressure deck',0,0,-.18,64,52,.22,floor,.02)
for x in range(-30,31,4):
    for z in range(-24,25,4):box('Deck plate',x,z,-.055,3.91,3.91,.09,wall,0)
for x in [-31.6,31.6]:
    box('Pressure hull',x,0,1,.4,52,2,wall)
    for z in range(-22,23,8):
        box('Hull rib',x,z,1.6,.7,.65,3.2,trim)
        box('Hull light',x-.25*(1 if x>0 else -1),z,1.5,.05,3,.16,red,0)
for z in [-25.6,25.6]:box('End bulkhead',0,z,.65,64,.4,1.3,wall)
for o in layout['obstacles']:
    material=trim if o['name'] in ['Service counter','Bunk frame'] else dark if o['name'] in ['Stock wall','Lift backing'] else wall
    box(o['name'],o['x'],o['z'],o['h']/2,o['w'],o['d'],o['h'],material)
    if o['name']=='Shop frontage':box('Frontage inset',o['x'],o['z'],.78,.46,o['d']-.4,.12,cyan,0)
    if o['name']=='Promenade planter':
        box('Hydroponic bed',o['x'],o['z'],.76,1.1,3.6,.14,dark)
        for dz in [-1.2,0,1.2]:box('Living foliage',o['x'],o['z']+dz,1.05,.8,.8,.55,green,.16)
# Open central avenue with lanes, inset floor panels and a view down the ship.
for z in range(-22,23,3):
    for x in [-7,7]:box('Promenade guide',x,z,.015,.12,2.2,.035,green,0)
for x,z,color,label in [(-20,8,violet,'MEDICAL'),(-20,-12,cyan,'ARMORY'),(20,-12,blue,'BANK'),(20,8,cream,'QUARTERS')]:
    box('Shop inset floor',x,z,-.002,20,15,.035,floor,0)
    box('Door threshold',-9 if x<0 else 9,z,.025,1.4,4.6,.05,color,0)
    box('Counter edge',x,z-2.2,.94,10,.08,.13,color,0)
    for dx in [-5,0,5]:
        box('Display case',x+dx,z-6.05,1.2,3,.15,1.3,color)
        box('Display inset',x+dx,z-5.94,1.2,2.6,.08,.9,dark,0)
    for dx in [-3,0,3]:
        box('Counter merchandise',x+dx,z-3,.0+1.28,1.1,.7,.4,color,.07)
    # Flat floor typography stays readable with the cutaway camera.
    curve=bpy.data.curves.new(label,'FONT');curve.body=label;curve.align_x='CENTER';curve.size=1.1;curve.extrude=0;curve.resolution_u=2
    obj=bpy.data.objects.new(label,curve);scene.collection.objects.link(obj);obj.location=(x,-(z+4),.035);curve.materials.append(color)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH');objects.append(bpy.context.object)
# Medical and armory work surfaces: reusable palette, no extra draw materials.
for z,color in [(8,violet),(-12,cyan)]:
    for x in [-24,-16]:
        for shelf_y in [.5,1.1,1.7]:
            box('Supply shelf',x,z-6.0,shelf_y,3,.7,.08,trim,.015)
            for dx in [-.9,0,.9]:
                box('Supply container',x+dx,z-6.0,shelf_y+.18,.5,.45,.28,wall,.03)
                box('Container label',x+dx,z-5.76,shelf_y+.2,.25,.015,.08,color,0)
    box('Checkout terminal',-16.5,z-3,1.28,.8,.55,.42,dark,.04)
    box('Terminal screen',-16.5,z-2.71,1.35,.62,.025,.25,color,0)
    box('Counter work mat',-20,z-3,1.087,4,1,.035,dark,0)
# First aid cases and a readable medical cross on the back wall.
for x in [-22,-20,-18]:
    box('Medical supply case',x,5,1.28,.7,.6,.36,cream,.055)
    box('Medical cross upright',x,5.31,1.28,.08,.025,.24,violet,0)
    box('Medical cross horizontal',x,5.31,1.28,.24,.025,.08,violet,0)
# Original weapon silhouettes secured to the armory stock wall.
for x in [-24,-20,-16]:
    box('Rifle receiver',x,-18.0,1.25,1.35,.22,.23,dark,.025)
    box('Rifle barrel',x+.9,-18.0,1.29,.75,.13,.10,trim,.012)
    box('Rifle grip',x-.1,-18.0,1.02,.18,.18,.4,dark,.025)
    box('Rifle stock',x-.9,-18.0,1.2,.5,.25,.36,trim,.035)

# Residential furnishings, visibly separated from commercial counters.
for x in [16,20,24]:
    box('Mattress',x,13,.68,2.15,2.8,.2,cream)
    box('Pillow',x,12.1,.84,1.7,.65,.15,wall)
# A recessed docking lift and four future district entrances.
for x in [-3,3]:box('Lift jamb',x,24,1.5,.4,.9,3,trim)
box('Lift lamp',0,23.6,2.8,5.5,.1,.18,green,0)
for x,color in [(-24,amber),(-8,red),(8,cream),(24,cyan)]:
    box('Sealed district door',x,-24,1.3,5,.4,2.6,dark)
    box('District status',x,-23.75,1.6,3,.05,.18,color,0)
for name,label,x,z in layout['services']:anchor(name,x,z)

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
