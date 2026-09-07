"""Original mining service bridge and carrier apron, metre-scale navigation.

The physical traversable footprint matches excavationClear. Red control rails
turn green after the Warden is defeated; the route pressure gate moves in 3D.
"""
import argparse,json,math,pathlib,random,sys
import bpy
from mathutils import Vector,noise
p=argparse.ArgumentParser()
for key in ['texture','master','output','render']:p.add_argument('--'+key,required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);random.seed(194)
for file in [a.master,a.output,a.render]:pathlib.Path(file).parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
def xyz(x,y,z):return(x,-z,y)
def material(name,color,rough=.7,metal=.2,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal
    if emission:b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=emission
    return m
ground=material('Excavation regolith',(.3,.08,.025),.96,0)
image=bpy.data.images.load(a.texture);image.scale(1024,1024);image.filepath_raw=str(pathlib.Path(a.master).parent/'regolith.jpg');image.file_format='JPEG';image.save();image.pack()
node=ground.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;ground.node_tree.links.new(node.outputs['Color'],ground.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
steel=material('Excavation steel',(.08,.11,.11),.63,.66)
edge=material('Excavation worn rail',(.25,.24,.21),.56,.6)
red=material('Excavation hostile #FF2200',(1,.014,0),.4,0,1)
green=material('Excavation safe #00FF00',(0,1,0),.4,0,1)
def finish(o,name,mat,smooth=False):
    o.name=name;o.data.materials.append(mat)
    for poly in o.data.polygons:poly.use_smooth=smooth
    return o
def box(name,x,y,z,w,h,d,mat,bevel=.03):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(x,y,z));o=bpy.context.object;o.scale=(w,d,h);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:m=o.modifiers.new('Manufactured rim','BEVEL');m.width=bevel;m.segments=1;bpy.ops.object.modifier_apply(modifier=m.name)
    return finish(o,name,mat)
def anchor(name,pos):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location=xyz(*pos);return o
# Broad genuine excavation below the walkable service structures.
bpy.ops.mesh.primitive_grid_add(x_subdivisions=62,y_subdivisions=76,size=2);o=bpy.context.object;o.scale=(260,320,1);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for v in o.data.vertices:v.co.z=-8+noise.noise(v.co*.045)*2.1
for uv in o.data.uv_layers.active.data:uv.uv*=20
finish(o,'Excavation pit',ground,True)
for x,z,w,d in [(0,-20,36,60),(0,16,18,12),(0,28,10,12)]:
    box('Service foundation',x,-2,z,w,4,d,ground,.08)
    box('Walkable apron',x,-.08,z,w,.16,d,steel,.025)
    # Physical aggregate panels break up the metal rather than a huge plain lid.
    for px in range(-int(w/2)+2,int(w/2),4):
        for pz in range(int(z-d/2)+2,int(z+d/2),4):box('Regolith grip panel',px,.012,pz,3.72,.02,3.72,ground,.015)
    for side in [-1,1]:
        box('Service boundary curb',side*(w/2+.13),.25,z,.26,.5,d,edge)
        box('Excavation_Service',side*(w/2-.12),.27,z,.035,.045,d-.5,red,.005)
        for pz in range(int(z-d/2)+1,int(z+d/2),3):
            box('Safety rail upright',side*(w/2+.13),.9,pz,.1,1.3,.1,steel,.02)
        box('Safety top rail',side*(w/2+.13),1.55,z,.11,.11,d,edge,.025)
# The boss machine zone is visibly separated from the hero's walking apron.
box('Machine clearance curb',0,.3,-19.4,35.6,.6,.28,edge,.05)
for x in [-15,-10,-5,0,5,10,15]:box('Clearance red warning',x,.63,-19.4,1.9,.035,.12,red,.01)
for side in [-1,1]:
    for z in [-46,-36,-26]:
        box('Carrier foundation pier',side*11,-.5,z,4,2,6,steel,.12)
        box('Carrier service cabinet',side*15,1.1,z,2.1,2.2,1.2,edge,.08)
        for k in range(5):box('Cooling intake',side*15,.7+k*.18,z+.62,1.65,.07,.05,steel,.01)
# Raised service gate; moving slab and indicators have stable runtime nodes.
frame=anchor('Gate_Frame',(0,0,0))
for x in [-8.4,8.4]:box('Gate jamb',x,4.6,8.3,1,9.2,1.2,steel,.12).parent=frame
box('Gate crosshead',0,9.1,8.3,18,.8,1.2,edge,.08).parent=frame
gate=anchor('Route_Gate',(0,2.2,8.3))
for name,y,h,mat in [('Pressure slab',2.2,4.4,steel),('Pressure rib',2.4,.18,edge),('Pressure control',3.6,.08,red)]:
    child=box(name,0,y,8.3,15.7,h,.35,mat,.035);bpy.context.view_layer.update();matrix=child.matrix_world.copy();child.parent=gate;child.matrix_world=matrix
anchor('Entry',(0,0,30));anchor('RouteCheckpoint',(0,0,9));anchor('BossAnchor',(0,0,-35))
for z in [25,29,33]:
    for x in [-3.8,3.8]:box('Return guidance',x,.05,z,.14,.06,1.7,green,.01)
box('Gate control pedestal',0,.7,11.2,.6,1.4,.6,steel,.07)
box('Gate control light',0,1.42,11.2,.44,.05,.44,red,.015)
# Outlying excavated rock strata supply physical depth around the raised route.
for i in range(55):
    x=random.choice([-1,1])*random.uniform(27,58);z=random.uniform(-62,44)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=xyz(x,-4,z));o=bpy.context.object;o.scale=(random.uniform(2,7),random.uniform(3,8),random.uniform(2,8));bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for v in o.data.vertices:v.co+=noise.noise_vector(v.co*.4)*.5
    finish(o,'Excavated basalt',ground,True)
# Consistent triplanar-style box UVs, baked into actual mesh coordinates.
for o in scene.objects:
    if o.type!='MESH' or ground not in list(o.data.materials):continue
    uv=o.data.uv_layers.active or o.data.uv_layers.new()
    for poly in o.data.polygons:
        axis=max(range(3),key=lambda j:abs(poly.normal[j]))
        for index in poly.loop_indices:
            co=o.matrix_world@o.data.vertices[o.data.loops[index].vertex_index].co;uv.data[index].uv=((co.y,co.z) if axis==0 else (co.x,co.z) if axis==1 else (co.x,co.y));uv.data[index].uv/=6
bpy.ops.wm.save_as_mainfile(filepath=a.master)
groups={}
for o in list(scene.objects):
    if o.type=='MESH':groups.setdefault(('Excavation_Service' if o.name.startswith('Excavation_Service') else o.data.materials[0].name,o.parent.name if o.parent else None),[]).append(o)
for (name,parent),objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=(parent+'_' if parent else '')+name
bpy.ops.export_scene.gltf(filepath=a.output,export_format='GLB',export_animations=False,export_cameras=False,export_lights=False)
scene.world=bpy.data.worlds.new('Mars dusk');scene.world.color=(.08,.06,.045);scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True
bpy.ops.object.light_add(type='SUN',location=(-20,-20,45));bpy.context.object.rotation_euler=(.4,-.5,-.3);bpy.context.object.data.energy=3
bpy.ops.object.camera_add(location=(-66,-60,83));camera=bpy.context.object;camera.rotation_euler=(Vector((0,10,-1))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=118;scene.camera=camera
scene.render.resolution_x=1200;scene.render.resolution_y=1200;scene.render.resolution_percentage=100;scene.render.filepath=a.render;bpy.ops.render.render(write_still=True)
triangles=0
for o in scene.objects:
    if o.type=='MESH':o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
print('EXCAVATION_BUILT '+json.dumps({'bytes':pathlib.Path(a.output).stat().st_size,'triangles':triangles}))
