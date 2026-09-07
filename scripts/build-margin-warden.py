"""Original Margin Warden excavation carrier from the private generated study.

Runtime +Z is the front, Y is up, 1 unit is 1 metre. Private editable master,
support sheet and studio render never belong in the public repository.
"""
import argparse,json,math,pathlib,sys
import bpy
from mathutils import Vector
p=argparse.ArgumentParser()
for key in ['master','output','render','material-master']:p.add_argument('--'+key,required=True)
p.add_argument('--armor-texture')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
for file in [a.master,a.output,a.render]:pathlib.Path(file).parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
def xyz(p):return(p[0],-p[2],p[1])
def material(name,color,rough=.6,metal=.4,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal
    if emission:b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=emission
    return m
steel=material('Warden graphite steel',(.07,.085,.09),.52,.72)
edge=material('Warden worn machined edges',(.23,.24,.22),.42,.7)
rubber=material('Warden track recess',(.012,.015,.014),.88,.1)
red=material('Warden hostile #FF2200',(1,.014,0),.4,0,2)
green=material('Captive public liquidity #00FF00',(0,1,0),.3,0,1)
copper=material('Warden hydraulic copper',(.19,.065,.025),.55,.64)
with bpy.data.libraries.load(a.material_master,link=False) as (src,dst):dst.materials=['Deck manufactured plate']
armor=bpy.data.materials['Deck manufactured plate'];armor.name='Warden oxidized armor'
copies={}
for node in armor.node_tree.nodes:
    if node.type!='TEX_IMAGE' or not node.image:continue
    original=node.image
    if original.name not in copies:
        im=original.copy();im.scale(512,512)
        if im.colorspace_settings.name=='sRGB':
            pixels=list(im.pixels)
            for i in range(0,len(pixels),4):pixels[i]*=.62;pixels[i+1]*=.19;pixels[i+2]*=.13
            im.pixels[:]=pixels
        im.pack();copies[original.name]=im
    node.image=copies[original.name]
if a.armor_texture:
    albedo=bpy.data.images.load(a.armor_texture);albedo.scale(1024,1024);albedo.filepath_raw=str(pathlib.Path(a.master).parent/'warden_armor_runtime.jpg');albedo.file_format='JPEG';albedo.save();albedo.pack()
    for node in armor.node_tree.nodes:
        if node.type=='TEX_IMAGE' and node.image and node.image.colorspace_settings.name=='sRGB':node.image=albedo
        if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.32
def attach(o,name,mat,parent=None,smooth=False):
    o.name=name;o.data.materials.append(mat)
    for poly in o.data.polygons:poly.use_smooth=smooth
    if parent:bpy.context.view_layer.update();matrix=o.matrix_world.copy();o.parent=parent;o.matrix_world=matrix
    return o
def cube(name,pos,size,mat,bevel=.05,parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(pos));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:m=o.modifiers.new('Machined bevel','BEVEL');m.width=bevel;m.segments=1;bpy.ops.object.modifier_apply(modifier=m.name)
    return attach(o,name,mat,parent)
def cyl(name,pos,r,depth,mat,axis='y',vertices=16,parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=xyz(pos));o=bpy.context.object
    if axis=='z':o.rotation_euler.x=math.pi/2
    elif axis=='x':o.rotation_euler.y=math.pi/2
    attach(o,name,mat,parent)
    for poly in o.data.polygons:poly.use_smooth=abs(poly.normal.z)<.5
    return o
def tube(name,points,r,mat,parent=None):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.bevel_depth=r;data.bevel_resolution=1
    spline=data.splines.new('POLY');spline.points.add(len(points)-1)
    for p,co in zip(spline.points,points):p.co=(*xyz(co),1)
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');return attach(o,name,mat,parent,True)
def node(name,pos):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location=xyz(pos);return o
def hull(name,sections,mat):
    # Each transverse section is (z, half-width, bottom, shoulder, roof).
    vertices=[]
    for z,w,b,s,t in sections:
        vertices.extend([xyz((-w,b,z)),xyz((w,b,z)),xyz((w,s,z)),xyz((w*.64,t,z)),xyz((-w*.64,t,z)),xyz((-w,s,z))])
    faces=[tuple(range(5,-1,-1))]
    for j in range(len(sections)-1):
        for i in range(6):faces.append((j*6+i,j*6+(i+1)%6,(j+1)*6+(i+1)%6,(j+1)*6+i))
    faces.append(tuple((len(sections)-1)*6+i for i in range(6)))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);attach(o,name,mat)
    bpy.context.view_layer.objects.active=o;m=o.modifiers.new('Heavy hull edge','BEVEL');m.width=.09;m.segments=2;bpy.ops.object.modifier_apply(modifier=m.name);return o

hull('Continuous armored chassis',[(-13,4.8,2.5,3.6,4.2),(-7,7.1,2.3,4.5,5.8),(3,6.6,2,4.6,5.4),(10,4.5,1.5,3.3,4.3),(13,2.4,1.2,3.0,3.7)],armor)
cube('Lower service spine',(0,2.0,-1),(7.8,1.1,23),steel,.12)
for side in [-1,1]:
    for z in [-8,8]:
        x=side*8.2
        cube('Track inner belt',(x,1.35,z),(3.0,2.7,8.8),rubber,.45)
        cube('Bogie armor roof',(x,3,z),(3.8,.45,9.1),armor,.15)
        for i in range(5):
            wz=z-3.1+i*1.55
            cyl('Road wheel',(x,1.4,wz),1.07,3.25,steel,'x',16)
            for edge_side in [-1,1]:cyl('Wheel hub',(x+edge_side*1.67,1.4,wz),.42,.12,edge,'x',12)
        # Two straight runs and rounded end turns; no disconnected wheel blobs.
        for track in range(38):
            radius=1.28;straight=6.2;arc=math.pi*radius;distance=track/38*(2*straight+2*arc)
            if distance<straight:local_z=-3.1+distance;wy=2.64;angle=0
            elif distance<straight+arc:
                theta=math.pi/2-(distance-straight)/radius;local_z=3.1+math.cos(theta)*radius;wy=1.36+math.sin(theta)*radius;angle=math.pi/2-theta
            elif distance<2*straight+arc:local_z=3.1-(distance-straight-arc);wy=.08;angle=math.pi
            else:
                theta=-math.pi/2-(distance-2*straight-arc)/radius;local_z=-3.1+math.cos(theta)*radius;wy=1.36+math.sin(theta)*radius;angle=math.pi/2-theta
            o=cube('Steel track shoe',(x,wy,z+local_z),(3.44,.16,.50),edge,.015);o.rotation_euler.x=angle
            ridge=cube('Track traction ridge',(x,wy+math.cos(angle)*.12,z+local_z+math.sin(angle)*.12),(3.25,.12,.14),steel,.012);ridge.rotation_euler.x=angle
        for dz in [-3,0,3]:
            cube('Bogie access cover',(x,3.25,z+dz),(2.8,.13,2.3),steel)
            for dx in [-1.1,1.1]:cyl('Bogie bolt',(x+dx,3.35,z+dz),.07,.07,edge,vertices=8)
    for i in range(6):
        z=-9+i*3.1;x=side*(5.5 if z<5 else 4.7);y=5.15 if z<5 else 4.5
        plate=cube('Segmented shoulder armor',(x,y,z),(2.9,.16,2.8),armor,.04);plate.rotation_euler.y=side*.38
        cube('Panel latch',(side*6.6,4.9,z),(.2,.16,.55),edge,.018)
        if i%2==0:cube('Armor red guide',(side*6.65,4.5,z),(.08,.1,1.2),red,.01)
    tube('Side hydraulic line',[(side*5.9,3.6,-10),(side*7.1,3.6,-6),(side*7.1,3.6,4),(side*4.6,2.6,11)],.13,copper)
    tube('Catwalk handrail',[(side*3,6.0,-11),(side*3,6.0,-3),(side*2,5.6,1)],.055,edge)
    for z in [-11,-8,-5,-3]:tube('Railing stanchion',[(side*3,5.3,z),(side*3,6,z)],.045,edge)
    # Two independently targetable supply towers. Lights retain their own nodes.
    x=side*5.8;z=6;label='Left' if side<0 else 'Right'
    cyl('Pylon swivel base',(x,4.7,z),1.15,.8,steel,vertices=20)
    cube('Pylon armored tower',(x,7,z),(1.1,4.6,1.2),armor,.1)
    target=node('Pylon_'+label,(x,6.4,z))
    light=node('Pylon_'+label+'_Lights',(x,6.4,z))
    for dz in [-.64,.64]:cube('Pylon hot strip',(x,6.8,z+dz),(.3,3.1,.07),red,.01,light)
    for height in [5,6.5,8.7]:cube('Pylon collar',(x,height,z),(1.4,.23,1.5),steel,.06)
    tube('Pylon feed cable',[(x+side*.75,8.2,z),(x+side*1.1,7.6,z),(x+side*1.3,5,z),(x,4.2,z-1.5)],.13,copper)
for z in [-9,-5,-1,3,7]:
    cube('Top service hatch',(0,5.75 if z<4 else 4.9,z),(3.3,.17,2.6),steel,.08)
    for x in [-1.3,1.3]:cube('Hatch handles',(x,5.95 if z<4 else 5.1,z),(.1,.12,.55),edge,.02)

# Captive green flow is behind red containment. The red central lock is the
# actual weak point; the player does not shoot a friendly green character.
core=node('Core_Target',(0,2.6,13))
cyl('Core dark recess',(0,2.6,12.7),1.85,.55,rubber,'z',32)
cyl('Captive green core',(0,2.6,13.02),1.34,.08,green,'z',32)
for radius,mat in [(1.72,edge),(1.57,red),(1.39,steel)]:
    bpy.ops.mesh.primitive_torus_add(major_radius=radius,minor_radius=.09,major_segments=32,minor_segments=8,location=xyz((0,2.6,13.12)),rotation=(math.pi/2,0,0));attach(bpy.context.object,'Containment rim',mat)
containment=node('Core_Containment',(0,2.6,13))
for x in [-.9,-.45,0,.45,.9]:cube('Containment bars',(x,2.6,13.2),(.07,2.6,.11),red,.01,containment)
for y in [1.9,2.6,3.3]:cube('Containment cross brace',(0,y,13.23),(2.6,.07,.1),steel,.01,containment)
cube('Central red control',(0,2.6,13.33),(.45,.45,.2),red,.06)

# Opposed tools have explicit physical rotation/muzzle anchors.
drill=node('Cutter_Axis',(-11,3.3,7))
tube('Drill boom',[(-7,3.1,3),(-10,3.3,5),(-13.2,3.3,7)],.54,steel)
cyl('Cutting drum',(-13.5,3.3,7),1.2,3.3,steel,'x',20,drill)
for ring in range(5):
    for tooth in range(9):
        angle=tooth*math.tau/9+ring*.35
        o=cube('Replaceable cutting tooth',(-12.2-ring*.62,3.3+math.cos(angle)*1.25,7+math.sin(angle)*1.25),(.4,.38,.42),edge,.03,drill);o.rotation_euler.x=angle
tube('Laser hydraulic mount',[(7,3.1,3),(10,3.3,5),(12.4,3.3,7)],.44,steel)
laser=cube('Mining laser housing',(12.4,3.1,8),(2.0,1.6,6),armor,.16)
for x in [11.6,13.2]:cube('Laser cooling rail',(x,3.9,8),(.16,.16,5),edge,.03)
node('Laser_Muzzle',(12.4,3.1,11.1));cyl('Laser emitter',(12.4,3.1,11.13),.45,.10,red,'z',20)

# Box projection in physical units, so large panels and narrow armor share the
# authored manufactured material without stretching one contact-sheet image.
for o in list(scene.objects):
    if o.type!='MESH' or armor not in list(o.data.materials):continue
    uv=o.data.uv_layers.active or o.data.uv_layers.new()
    for poly in o.data.polygons:
        axis=max(range(3),key=lambda j:abs(poly.normal[j]))
        for index in poly.loop_indices:
            co=o.matrix_world@o.data.vertices[o.data.loops[index].vertex_index].co;uv.data[index].uv=((co.y,co.z) if axis==0 else (co.x,co.z) if axis==1 else (co.x,co.y));uv.data[index].uv/=3
bpy.ops.wm.save_as_mainfile(filepath=a.master)
groups={}
for o in list(scene.objects):
    if o.type=='MESH':groups.setdefault((o.data.materials[0].name,o.parent.name if o.parent else None),[]).append(o)
for (mat,parent),objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name='Warden_'+(parent+'_' if parent else '')+mat
bpy.ops.export_scene.gltf(filepath=a.output,export_format='GLB',export_animations=False,export_cameras=False,export_lights=False)
scene.world=bpy.data.worlds.new('Review studio');scene.world.color=(.08,.10,.12);scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
for position,power,size in [((-20,-25,35),24000,20),((25,-10,20),17000,18),((0,25,25),20000,16)]:
    bpy.ops.object.light_add(type='AREA',location=position);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,3))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(-37,-44,28));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,3.5))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=43;scene.camera=camera
scene.render.resolution_x=1500;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.render.filepath=a.render;bpy.ops.render.render(write_still=True)
triangles=0
for o in scene.objects:
    if o.type=='MESH':o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
print('WARDEN_BUILT '+json.dumps({'bytes':pathlib.Path(a.output).stat().st_size,'triangles':triangles,'nodes':['Pylon_Left','Pylon_Right','Core_Target','Core_Containment','Laser_Muzzle','Cutter_Axis']}))
