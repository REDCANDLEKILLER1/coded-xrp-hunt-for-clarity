"""Original relief-site architecture, generated regolith texture, metre scale.

Blender Z-up -> runtime Y-up. Private master and review render stay local.
"""
import argparse,json,math,pathlib,random,sys
import bpy
from mathutils import Vector,noise
p=argparse.ArgumentParser()
for key in ['texture','master','output','render']:p.add_argument('--'+key,required=True)
p.add_argument('--material-master')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);random.seed(727)
for file in [a.master,a.output,a.render]:pathlib.Path(file).parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
def material(name,color,rough=.6,metal=0,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal
    if emission:b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=emission
    return m
ground=material('Mars regolith',(.4,.13,.05),.97)
image=bpy.data.images.load(a.texture);image.scale(1024,1024)
image.filepath_raw=str(pathlib.Path(a.master).parent/'regolith_runtime.jpg');image.file_format='JPEG';image.save();image.pack()
tex=ground.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.extension='REPEAT';ground.node_tree.links.new(tex.outputs['Color'],ground.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
metal=material('Relief graphite hardware',(.095,.12,.12),.42,.7)
paint=material('Relief weathered ivory',(.45,.43,.33),.72,.25)
if a.material_master:
    with bpy.data.libraries.load(a.material_master,link=False) as (src,dst):dst.materials=['Deck manufactured plate']
    authored=bpy.data.materials.get('Deck manufactured plate')
    if not authored:raise RuntimeError('The approved plate material is missing')
    paint=authored;paint.name='Relief manufactured alloy'
    # Share compact copies of the already-authored plate maps, preserving that
    # private master. The GLB carries real normal/roughness maps on machinery.
    copies={}
    for node in paint.node_tree.nodes:
        if node.type!='TEX_IMAGE' or not node.image:continue
        if node.image.name not in copies:
            copied=node.image.copy();copied.scale(512,512);copied.pack();copies[node.image.name]=copied
        node.image=copies[node.image.name]
rust=material('Relief oxide basalt',(.16,.055,.023),.9)
glass=material('Relief dark solar glass',(.018,.044,.045),.2,.5)
green=material('Relief friendly #00FF00',(0,1,0),.4,0,1)
red=material('Relief seized #FF2200',(1,.014,0),.5,0,1)
def finish(o,name,mat,smooth=True):
    o.name=name;o.data.materials.append(mat)
    for poly in o.data.polygons:poly.use_smooth=smooth
    return o
def cube(name,pos,size,mat,bevel=.05):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:mod=o.modifiers.new('Machined bevel','BEVEL');mod.width=bevel;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,mat,False)
def cylinder(name,pos,r,depth,mat,vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=pos);return finish(bpy.context.object,name,mat)
def pipe(name,points,r,mat):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=r;curve.bevel_resolution=2
    spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
    for p,co in zip(spline.points,points):p.co=(*co,1)
    o=bpy.data.objects.new(name,curve);scene.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return finish(o,name,mat)
def runtime(x,y,z):return(x,-z,y)
# Flat navigable site surrounded by genuine uneven landforms, not a backdrop.
bpy.ops.mesh.primitive_grid_add(x_subdivisions=50,y_subdivisions=60,size=2);o=bpy.context.object;o.scale=(76,85,1);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for v in o.data.vertices:
    edge=max(abs(v.co.x)-32,abs(v.co.y-5)-48,0)
    v.co.z=(math.sin(v.co.x*.12)*math.cos(v.co.y*.13)*.9+1.4)*min(edge/9,1) if edge else 0
for loop in o.data.uv_layers.active.data:loop.uv*=22
finish(o,'Relief terrain',ground)
for i in range(70):
    angle=random.random()*math.tau;x=math.cos(angle)*random.uniform(39,65);y=math.sin(angle)*random.uniform(56,79)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,random.uniform(-.1,.8)));o=bpy.context.object;o.scale=(random.uniform(1.5,4),random.uniform(2,5),random.uniform(1,5))
    for v in o.data.vertices:v.co+=noise.noise_vector(v.co*2.1)*.17
    finish(o,'Rim basalt',ground)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    uv=o.data.uv_layers.active or o.data.uv_layers.new()
    for poly in o.data.polygons:
        axis=max(range(3),key=lambda j:abs(poly.normal[j]))
        for index in poly.loop_indices:
            co=o.data.vertices[o.data.loops[index].vertex_index].co;uv.data[index].uv=((co.y,co.z) if axis==0 else (co.x,co.z) if axis==1 else (co.x,co.y));uv.data[index].uv/=3
# Walkable metal landing apron, selected fighter supplied by the runtime.
cylinder('Landing pad',runtime(0,-.08,26),8,.24,metal,48)
for i in range(12):
    angle=i*math.tau/12;x=math.cos(angle)*7.4;z=26+math.sin(angle)*7.4
    cube('Landing guide',runtime(x,.04,z),(.13,.65,.04),green,.01)
# Corn's relief canopy: curved industrial roof; open foreground and NPC space.
for x in [-4,4]:
    for z in [7,11]:cylinder('Canopy leg',runtime(x,1.7,z),.10,3.4,metal,12)
verts=[];faces=[]
for z in [6.5,11.5]:
    for i in range(17):x=-4.5+i*9/16;verts.append(runtime(x,3.3+.7*math.cos(x/4.5*math.pi/2),z))
for i in range(16):faces.append((i,i+1,18+i,17+i))
mesh=bpy.data.meshes.new('Canopy shell');mesh.from_pydata(verts,[],faces);o=bpy.data.objects.new('Relief canopy',mesh);scene.collection.objects.link(o);finish(o,'Relief canopy',paint)
mod=o.modifiers.new('Shell thickness','SOLIDIFY');mod.thickness=.06;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
for x in [-2.8,2.8]:
    cube('Relief crates',runtime(x,.55,8.6),(1.2,1.1,1.1),paint)
    cube('Medical supply light',runtime(x,1.12,8.6),(.6,.4,.04),green,.015)
for id,x,z in [('intake',-18,0),('filter',18,-12),('cistern',0,-35)]:
    cylinder('Pump '+id+' foundation',runtime(x,.1,z),2.9,.2,metal,32)
    cylinder('Pump '+id+' pressure vessel',runtime(x,1.45,z),1.35,2.7,paint,32)
    cylinder('Pump '+id+' cap',runtime(x,2.88,z),1.45,.22,metal,32)
    for height in [.37,1.8,2.5]:cylinder('Vessel pressure band',runtime(x,height,z),1.40,.075,metal,32)
    for side in [-1,1]:
        cube('Pump service panel',runtime(x+side*.68,1.6,z+1.25),(.58,.10,.78),metal,.04)
        for k in range(5):cube('Pump panel cooling slot',runtime(x+side*.68,1.4+k*.1,z+1.31),(.40,.025,.025),paint,.008)
    for angle in [i*math.tau/8 for i in range(8)]:
        cylinder('Pump brace',runtime(x+math.cos(angle)*1.35,1.5,z+math.sin(angle)*1.35),.085,2.5,metal,8)
    cylinder('Pump_'+id+'_Lights',runtime(x,2.7,z),1.37,.14,red,32)
    # Distinct upper silhouettes and functional visible plumbing.
    if id=='intake':
        for side in [-1,1]:pipe('Intake suction', [runtime(x+side*1.6,.2,z-2.5),runtime(x+side*1.6,1.3,z-2.5),runtime(x+side*1.6,1.3,z)],.18,metal)
    elif id=='filter':
        for side in [-1,1]:cylinder('Filter auxiliary tank',runtime(x+side*2,1.05,z),.42,1.9,metal,16)
    else:
        cylinder('Cistern accumulator',runtime(x,3.45,z),.78,1,metal,24)
        pipe('Cistern arch',[runtime(x-2,0,z),runtime(x-2,4,z),runtime(x+2,4,z),runtime(x+2,0,z)],.12,metal)
    cube('Valve '+id+' support',runtime(x,.7,z+3.25),(.65,.6,1.4),metal)
    screen=cube('Valve_'+id,runtime(x,1.43,z+3.25),(.8,.58,.08),red,.03)
    # A shared exposed conduit leads toward the crops. It changes allegiance only
    # after the matching valve transaction succeeds in the game.
    pipe('Conduit_'+id,[runtime(x,.07,z),runtime(x,.07,z+6),runtime(0,.07,z+6)],.045,red)
    pipe('Water delivery pipe',[runtime(x,.02,z),runtime(x,.02,z+6),runtime(0,.02,z+6)],.15,metal)
# Relief agriculture: skeletal trays acquire green planted rows after restoration.
for x in [-10,10]:
    for z in [5,8,11]:
        cube('Hydroponic tray',runtime(x,.2,z),(5,1.6,.35),metal)
        cube('Hydroponic bed',runtime(x,.4,z),(4.7,1.3,.06),rust,.02)
        for offset in [-1.6,-.8,0,.8,1.6]:
            pipe('Crop growth', [runtime(x+offset,.42,z-.5),runtime(x+offset,.72,z),runtime(x+offset,.42,z+.5)],.055,green)
# Solar collectors outside the navigation rectangle.
for x in [-36,36]:
    for z in [-28,-17,-6]:
        cylinder('Solar mast',runtime(x,1.2,z),.12,2.4,metal,12)
        o=cube('Solar collector',runtime(x,2.5,z),(6,4,.12),glass);o.rotation_euler.x=.25
        for offset in [-2,-1,0,1,2]:cube('Solar bus rail',runtime(x+offset,2.6,z),(.025,3.8,.025),metal,.006)
# Physical-size box projection keeps the manufactured atlas consistent across
# broad canopy panels and small pump hatches, before material grouping.
if a.material_master:
    for o in scene.objects:
        if o.type!='MESH' or paint not in list(o.data.materials):continue
        uv=o.data.uv_layers.active or o.data.uv_layers.new()
        for poly in o.data.polygons:
            axis=max(range(3),key=lambda j:abs(poly.normal[j]))
            for index in poly.loop_indices:
                co=o.matrix_world@o.data.vertices[o.data.loops[index].vertex_index].co;uv.data[index].uv=((co.y,co.z) if axis==0 else (co.x,co.z) if axis==1 else (co.x,co.y));uv.data[index].uv/=3
# Merge shared static materials. Contract nodes retain individual transforms.
groups={}
for o in list(scene.objects):
    if o.type=='MESH' and not o.name.startswith(('Pump_','Valve_','Conduit_')):
        key='Relief_Growth' if o.name.startswith('Crop growth') else 'Relief_'+o.data.materials[0].name
        groups.setdefault(key,[]).append(o)
for name,items in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in items:o.select_set(True)
    bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();bpy.context.object.name=name
bpy.ops.wm.save_as_mainfile(filepath=a.master)
bpy.ops.export_scene.gltf(filepath=a.output,export_format='GLB',export_animations=False,export_cameras=False,export_lights=False)
scene.world=bpy.data.worlds.new('Mars atmosphere');scene.world.color=(.08,.05,.035);scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
bpy.ops.object.light_add(type='SUN',location=(-20,10,40));bpy.context.object.rotation_euler=(.4,-.5,-.3);bpy.context.object.data.energy=3
bpy.ops.object.camera_add(location=(64,-83,86));camera=bpy.context.object;camera.rotation_euler=(Vector((0,7,0))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=110;scene.camera=camera
scene.render.resolution_x=1200;scene.render.resolution_y=1200;scene.render.resolution_percentage=100;scene.render.filepath=a.render;bpy.ops.render.render(write_still=True)
triangles=0
for o in scene.objects:
    if o.type=='MESH':o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
print('MARS_RELIEF_BUILT '+json.dumps({'bytes':pathlib.Path(a.output).stat().st_size,'triangles':triangles}))
