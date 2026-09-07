"""Original lunar canyon, relay citadel and fictional moon. Metre-scale meshes.

Masters stay private. Only declared optimized exports become runtime assets.
"""
import argparse,json,math,pathlib,random,sys
import bpy
from mathutils import Vector,noise
p=argparse.ArgumentParser();p.add_argument('--directory',required=True);p.add_argument('--texture',required=True);p.add_argument('--armor')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);folder=pathlib.Path(a.directory);folder.mkdir(parents=True,exist_ok=True);reports=[]
def xyz(x,y,z):return(x,-z,y)
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.unit_settings.system='METRIC';s.unit_settings.scale_length=1;random.seed(351);return s
def mat(name,color,rough=.55,metal=.25,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal
    if emission:b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=emission
    return m
def finish(o,name,m,smooth=False):
    o.name=name;o.data.materials.append(m)
    for poly in o.data.polygons:poly.use_smooth=smooth
    return o
def box(name,x,y,z,w,h,d,m,bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(x,y,z));o=bpy.context.object;o.scale=(w,d,h);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:b=o.modifiers.new('Machined edges','BEVEL');b.width=bevel;b.segments=1;bpy.ops.object.modifier_apply(modifier=b.name)
    return finish(o,name,m)
def cylinder(name,x,y,z,radius,depth,m,vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=xyz(x,y,z));o=finish(bpy.context.object,name,m)
    for poly in o.data.polygons:poly.use_smooth=len(poly.vertices)==4
    return o
def anchor(name,pos):
    o=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(o);o.location=xyz(*pos);return o
def parent(o,root):
    bpy.context.view_layer.update();matrix=o.matrix_world.copy();o.parent=root;o.matrix_world=matrix;return o
def export(key,camera,target,scale):
    scene=bpy.context.scene;master=folder/(key+'.blend')
    if master.exists():raise RuntimeError('Keep earlier versions; choose a new directory')
    bpy.ops.wm.save_as_mainfile(filepath=str(master));groups={}
    for o in list(scene.objects):
        if o.type=='MESH':groups.setdefault((o.data.materials[0].name,o.parent.name if o.parent else None),[]).append(o)
    for (name,root),objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=(root+'_' if root else '')+name
    output=folder/(key+'.glb');bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_animations=False,export_cameras=False,export_lights=False)
    count=0
    for o in scene.objects:
        if o.type=='MESH':o.data.calc_loop_triangles();count+=len(o.data.loop_triangles)
    reports.append({'id':key,'bytes':output.stat().st_size,'triangles':count})
    scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True;scene.world=bpy.data.worlds.new('Lunar studio');scene.world.color=(.06,.055,.085)
    bpy.ops.object.light_add(type='SUN');bpy.context.object.rotation_euler=(.3,-.5,-.4);bpy.context.object.data.energy=3
    bpy.ops.object.camera_add(location=camera);c=bpy.context.object;c.rotation_euler=(Vector(target)-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=scale;scene.camera=c
    scene.render.resolution_x=1200;scene.render.resolution_y=1200;scene.render.resolution_percentage=100;scene.render.filepath=str(folder/(key+'.png'));bpy.ops.render.render(write_still=True)
scene=reset();rock=mat('Fog lunar basalt',(.16,.18,.22),.95,0)
im=bpy.data.images.load(a.texture);im.scale(1024,1024);im.filepath_raw=str(folder/'lunar_basalt.jpg');im.file_format='JPEG';im.save();im.pack();t=rock.node_tree.nodes.new('ShaderNodeTexImage');t.image=im;rock.node_tree.links.new(t.outputs['Color'],rock.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
steel=mat('Fog brushed titanium',(.13,.16,.19),.48,.75);rim=mat('Fog ceramic edge',(.37,.41,.46),.5,.25);dark=mat('Fog deep grilles',(.018,.027,.039),.65,.4);red=mat('Fog hostile #FF2200',(1,.012,0),.4,0,1);green=mat('Fog safe #00FF00',(0,1,0),.4,0,1)
bpy.ops.mesh.primitive_grid_add(x_subdivisions=54,y_subdivisions=64,size=2);o=bpy.context.object;o.scale=(240,280,1);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for v in o.data.vertices:v.co.z=-8+noise.noise(v.co*.07)*1.6
finish(o,'Canyon floor',rock,True)
# Disjoint shelves share exact edges; no coplanar overlap or intersecting tiles.
for x,z,w,d in [(0,32,16,12),(0,22,44,8),(-16,7,12,22),(16,7,12,22),(0,-10,44,12),(0,-30,36,28)]:
    box('Lunar shelf',x,-2,z,w,4,d,rock,.1);box('Ceramic walkway',x,-.07,z,w-.15,.14,d-.15,steel,.025)
    for px in range(int(x-w/2)+2,int(x+w/2),4):
        for pz in range(int(z-d/2)+2,int(z+d/2),4):box('Basalt grip panel',px,.005,pz,3.7,.012,3.7,rock,.005)
# Outer rails do not cross connected shelf seams.
for side in [-1,1]:
    for z in range(-12,28,3):
        box('Outer post',side*22,.6,z,.12,1.2,.12,rim);box('Guide strip',side*21.6,.025,z,.10,.03,1.5,green,.005)
    box('Outer rail',side*22,1.2,6,.1,.1,40,rim,.02)
    for z in range(-1,18,3):box('Chasm curb',side*9.9,.25,z,.2,.5,2.7,rim)
# Relays are distinct selectable physical feed banks and an adjacent terminal.
for name,x,z in [('west',-16,6),('east',16,-2)]:
    root=anchor('Relay_'+name,(0,0,0))
    parent(box('Relay base',x,.35,z,6,.7,1.5,steel,.1),root)
    for i in range(3):
        px=x+(i-1)*1.8;feed=anchor('Relay_'+name+'_Feed_'+str(i),(px,2,z));feed.parent=root
        parent(cylinder('Feed housing',px,1.35,z,.45,2,steel),root);parent(cylinder('Feed signal',px,2.47,z,.34,.24,red),feed)
        for j in range(i+1):parent(box('Feed identity tick',px-.25+j*.21,2.39,z,.11,.1,.11,rim,.01),root)
    parent(box('Relay console',x,.55,z+2.7,.85,1.1,.65,steel),root);parent(box('Relay display',x,1.12,z+2.7,.65,.05,.45,red),root)
anchor('Landing',(0,0,31));anchor('Boo_Anchor',(-3,0,23));anchor('Citadel_Anchor',(0,0,-48));anchor('ArenaCheckpoint',(0,0,-20))
for x in [-6,6]:
    for z in [28,31,34]:box('Landing beacon',x,.04,z,.15,.05,1.5,green,.01)
for i in range(50):
    x=random.choice([-1,1])*random.uniform(27,66);z=random.uniform(-68,50);bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=xyz(x,-2,z));o=bpy.context.object;o.scale=(random.uniform(2,6),random.uniform(3,9),random.uniform(3,12));bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for v in o.data.vertices:v.co+=noise.noise_vector(v.co*.45)*.65
    finish(o,'Fractured basalt wall',rock,True)
for o in scene.objects:
    if o.type!='MESH' or rock not in list(o.data.materials):continue
    uv=o.data.uv_layers.active or o.data.uv_layers.new()
    for poly in o.data.polygons:
        axis=max(range(3),key=lambda j:abs(poly.normal[j]))
        for i in poly.loop_indices:
            co=o.matrix_world@o.data.vertices[o.data.loops[i].vertex_index].co;uv.data[i].uv=((co.y,co.z) if axis==0 else (co.x,co.z) if axis==1 else (co.x,co.y));uv.data[i].uv/=5
export('fog_canyon',(-72,-70,95),(0,4,0),122)
scene=reset();steel=mat('Citadel armored titanium',(.075,.10,.13),.42,.8);rim=mat('Citadel reflector silver',(.48,.55,.6),.28,.88);dark=mat('Citadel cavity',(.01,.015,.025),.7,.3);red=mat('Citadel hostile #FF2200',(1,.014,0),.35,0,1.5)
if a.armor:
    im=bpy.data.images.load(a.armor);im.scale(512,512);im.filepath_raw=str(folder/'citadel_armor.jpg');im.file_format='JPEG';im.save();im.pack();t=steel.node_tree.nodes.new('ShaderNodeTexImage');t.image=im;steel.node_tree.links.new(t.outputs['Color'],steel.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
box('Citadel foundation',0,.45,0,22,.9,14,steel,.15)
for x in [-9,9]:
    support=box('Swept support',x,3.4,-1,2.4,6.8,9,steel,.2)
    for v in support.data.vertices:
        if v.co.z>0:v.co.y+=2;v.co.x*=.6
    for z in [-4,-2,0,2]:box('Heat exchanger',x,2.7,z,2.6,.12,.65,rim,.03)
    for z in [-4,-2,0,2]:
        box('Service armor panel',x,1.35,z,2.52,1.1,1.35,steel,.06)
        for side in [-1,1]:box('Panel fastener',x+side*1.27,1.3,z,.08,.12,.12,rim,.01)
    for y in [3.3,3.7,4.1,4.5]:box('Vented cooling face',x,y,2.7,1.6,.12,.18,dark,.02)
cylinder('Central transmitter',0,4,-2,2.1,8,steel,36);cylinder('Crown light',0,8.1,-2,1.5,.4,red,32)
for y in [1.5,2.1,6.2,6.8,7.4]:cylinder('Transmitter collar',0,y,-2,2.18,.12,rim,36)
for angle in range(0,360,45):
    rad=math.radians(angle);box('Transmitter channel',math.cos(rad)*2.12,4.1,-2+math.sin(rad)*2.12,.16,3.1,.16,dark,.02)
for i,x in enumerate([-6,0,6]):
    cylinder('Reflector stanchion',x,2,0,.7,4,steel);dish=anchor('Reflector_'+str(i),(x,5,0))
    verts=[];faces=[];segments=40;levels=8
    # Concave paraboloid tilted toward the approaching player.
    for j in range(levels+1):
        r=.05+j*2.45/levels
        for k in range(segments):
            theta=k*2*math.pi/segments;verts.append(xyz(x+r*math.cos(theta),5+r*math.sin(theta)*.8,-r*r*.14))
    for j in range(levels):
        for k in range(segments):q=j*segments+k;n=j*segments+(k+1)%segments;faces.append((q,n,n+segments,q+segments))
    mesh=bpy.data.meshes.new('Parabolic reflector');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Reflector dish',mesh);scene.collection.objects.link(o);finish(o,'Reflector dish',rim,True);solid=o.modifiers.new('Reflector thickness','SOLIDIFY');solid.thickness=.065;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=solid.name);parent(o,dish)
    for k in range(12):
        angle=k*math.pi/6;parent(box('Reflector rim cleat',x+2.45*math.cos(angle),5+2.45*math.sin(angle)*.8,-.85,.14,.14,.3,steel,.02),dish)
    feed=anchor('Feed_'+str(i),(x,3.5,4));parent(box('Feed armor',x,3.5,3.75,2.4,2.4,1,steel,.15),feed)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=.9,location=xyz(x,3.5,4.35));parent(finish(bpy.context.object,'Feed target',red,True),feed)
    for j in range(i+1):box('Feed identity',x-.5+j*.5,5,4,.2,.2,.2,rim,.03)
anchor('Citadel_Origin',(0,0,0));anchor('Seeker_Left',(-8,2,8));anchor('Seeker_Right',(8,2,8))
for o in scene.objects:
    if o.type!='MESH' or steel not in list(o.data.materials):continue
    uv=o.data.uv_layers.active or o.data.uv_layers.new()
    for poly in o.data.polygons:
        axis=max(range(3),key=lambda j:abs(poly.normal[j]))
        for i in poly.loop_indices:
            co=o.matrix_world@o.data.vertices[o.data.loops[i].vertex_index].co;uv.data[i].uv=((co.y,co.z) if axis==0 else (co.x,co.z) if axis==1 else (co.x,co.y));uv.data[i].uv/=3
export('fog_citadel',(-23,-31,19),(0,0,3),33)
# Fictional moon: actual procedural crater relief and vertex color, no NASA claim.
scene=reset();m=mat('Fog Moon basalt',(.35,.38,.43),.94,0);node=m.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='Basalt';m.node_tree.links.new(node.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
bpy.ops.mesh.primitive_uv_sphere_add(segments=192,ring_count=96,radius=1);o=finish(bpy.context.object,'Fog Moon globe',m,True);craters=[]
for i in range(26):v=Vector((random.uniform(-1,1),random.uniform(-1,1),random.uniform(-1,1))).normalized();craters.append((v,random.uniform(.045,.18)))
colors=o.data.color_attributes.new(name='Basalt',type='FLOAT_COLOR',domain='POINT')
for v in o.data.vertices:
    unit=v.co.normalized();n=noise.fractal(unit*7,.7,2,4);delta=0
    for center,size in craters:
        r=(unit-center).length/size
        if r<1.3:delta+=-.005*max(0,1-r*r)+.003*math.exp(-((r-1)/.22)**2)
    v.co*=1+delta+n*.001;c=.20+n*.035+delta*4;colors.data[v.index].color=(c*.93,c,c*1.12,1)
anchor('Planet_Origin',(0,0,0));export('planet_fog_moon',(2,-3,1.7),(0,0,0),2.7)
(folder/'BUILD_REPORT.json').write_text(json.dumps(reports,indent=2),encoding='utf8');print('FOG_MODELS_BUILT '+json.dumps(reports))
