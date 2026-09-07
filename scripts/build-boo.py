"""Original limbless spectral scout, constrained by the written character audit.

Private support is an original interpretation, not a recovered source sheet.
One real continuous body, a deformable tail and expressive floating animation.
"""
import argparse,json,math,pathlib,sys
import bpy
from mathutils import Vector
p=argparse.ArgumentParser()
for key in ['master','output','render']:p.add_argument('--'+key,required=True)
p.add_argument('--texture')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
for file in [a.master,a.output,a.render]:pathlib.Path(file).parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
scene.render.fps=30;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
def material(name,color,rough=.4,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=rough
    if emission:b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=emission
    return m
bodymat=material('Boo pearlescent spectral body',(.83,.9,.97),.42,.09)
body_shader=bodymat.node_tree.nodes.get('Principled BSDF');body_shader.inputs['Subsurface Weight'].default_value=.13;body_shader.inputs['Transmission Weight'].default_value=.16;body_shader.inputs['IOR'].default_value=1.18
if a.texture:
    # Resize/encode the original generated albedo; preserve its private master.
    img=bpy.data.images.load(a.texture);img.scale(512,512);img.filepath_raw=str(pathlib.Path(a.master).parent/'boo_vapor_512.jpg');img.file_format='JPEG';img.save();img.pack()
    tex=bodymat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=img;bodymat.node_tree.links.new(tex.outputs['Color'],body_shader.inputs['Base Color'])
dark=material('Boo deep expressive eyes',(.002,.006,.016),.13)
iris=material('Boo pale blue iris',(.075,.23,.32),.25)
mouth=material('Boo smile cavity',(.012,.019,.031),.65)
rim=material('Boo spectral rim',(.30,.69,.92),.38,.5)
glint=material('Boo eye catchlight',(.82,.95,1),.2,.25)
objects=[]
def finish(o,name,mat,group):
    o.name=name;o.data.materials.append(mat)
    if o.type=='MESH':
        for face in o.data.polygons:face.use_smooth=True
    objects.append((o,group));return o
def ellipsoid(name,pos,scale,mat,group,segments=16,rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=pos);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,mat,group)
# Ring surface from the taper to the rounded crown. The front points -Y.
profile=[(.28,.004,.004,.12,.035),(.38,.035,.032,.11,.03),(.5,.065,.058,.03,.025),(.63,.105,.085,-.07,.025),(.78,.17,.13,-.08,.02),(.98,.235,.19,-.025,.015),(1.18,.295,.24,0,0),(1.4,.325,.265,0,0),(1.59,.30,.25,0,0),(1.73,.225,.195,0,0),(1.82,.12,.115,0,0),(1.855,.003,.003,0,0)]
def shape(z):
    for index,(left,right) in enumerate(zip(profile,profile[1:])):
        if z<=right[0]:
            span=right[0]-left[0];t=max(0,(z-left[0])/span)
            def slope(point,channel):
                if point==0:return (profile[1][channel]-profile[0][channel])/(profile[1][0]-profile[0][0])
                if point==len(profile)-1:return (profile[-1][channel]-profile[-2][channel])/(profile[-1][0]-profile[-2][0])
                a=(profile[point][channel]-profile[point-1][channel])/(profile[point][0]-profile[point-1][0]);b=(profile[point+1][channel]-profile[point][channel])/(profile[point+1][0]-profile[point][0])
                return 2*a*b/(a+b) if a*b>0 else 0
            return tuple((2*t**3-3*t*t+1)*left[i]+(t**3-2*t*t+t)*span*slope(index,i)+(-2*t**3+3*t*t)*right[i]+(t**3-t*t)*span*slope(index+1,i) for i in range(1,5))
    return profile[-1][1:]
vertices=[];faces=[];levels=[a[0]+(b[0]-a[0])*i/6 for a,b in zip(profile,profile[1:]) for i in range(6)]+[profile[-1][0]];rings=len(levels);sectors=40
for i,z in enumerate(levels):
    rx,ry,cx,cy=shape(z)
    for j in range(sectors):
        angle=2*math.pi*j/sectors;wave=1+.008*math.sin(angle*5+z*7)*(1 if z<1.1 else .15)
        vertices.append((cx+rx*math.cos(angle)*wave,cy+ry*math.sin(angle)*wave,z))
for i in range(rings-1):
    for j in range(sectors):k=i*sectors+j;n=i*sectors+(j+1)%sectors;faces.append((k,n,n+sectors,k+sectors))
faces.append(tuple(range(sectors-1,-1,-1)));faces.append(tuple((rings-1)*sectors+j for j in range(sectors)))
mesh=bpy.data.meshes.new('Continuous ghost surface');mesh.from_pydata(vertices,[],faces);mesh.update();body=bpy.data.objects.new('Boo_Body',mesh);scene.collection.objects.link(body);finish(body,'Boo_Body',bodymat,'skin')
uv=body.data.uv_layers.new(name='SpectralUV')
for poly in body.data.polygons:
    for index in poly.loop_indices:
        v=body.data.loops[index].vertex_index;i,j=divmod(v,sectors);u=j/sectors
        if j==0 and any(body.data.loops[k].vertex_index%sectors==sectors-1 for k in poly.loop_indices):u=1
        uv.data[index].uv=(u,i/(rings-1))
# Inset, physically curved eyes. No floating billboard face or painted poster.
for side in [-1,1]:
    x=side*.139;ellipsoid('Eye socket', (x,-.213,1.478),(.113,.027,.135),bodymat,'Eyes')
    ellipsoid('Dark eye', (x,-.239,1.478),(.085,.022,.108),dark,'Eyes')
    ellipsoid('Iris',(x,-.258,1.468),(.059,.008,.075),iris,'Eyes',16,10)
    ellipsoid('Pupil',(x,-.264,1.476),(.047,.006,.064),dark,'Eyes',16,10)
    ellipsoid('Eye light',(x-.024,-.271,1.519),(.014,.005,.018),glint,'Eyes',12,8)
ellipsoid('Subtle face ridge',(0,-.267,1.348),(.035,.014,.025),bodymat,'Face',16,10)
def front(x,z,offset=.003):
    rx,ry,cx,cy=shape(z);return cy-ry*math.sqrt(max(.02,1-((x-cx)/rx)**2))-offset
def smile(name,mat,lower):
    verts=[];sides=30
    for i in range(sides+1):
        t=i/sides;x=(t*2-1)*.142;upper=1.294-.061*math.sin(math.pi*t);bottom=1.294-lower*math.sin(math.pi*t)
        verts.extend([(x,front(x,upper,.009),upper),(x,front(x,bottom,.01),bottom)])
    faces=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(sides)];m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update();o=bpy.data.objects.new(name,m);scene.collection.objects.link(o);finish(o,name,mat,'Mouth')
smile('Smiling mouth',mouth,.118)
# Fine flowing surface ridges are integrated with the body, not arm-like curls.
for index in range(3):
    curve=bpy.data.curves.new('Spectral flow','CURVE');curve.dimensions='3D';curve.resolution_u=2;curve.bevel_depth=.0012;curve.bevel_resolution=1;s=curve.splines.new('POLY');s.points.add(20)
    for j,point in enumerate(s.points):
        z=.30+j*.019;rx,ry,cx,cy=shape(z);angle=2*math.pi*index/3+.25*math.sin(z*5);point.co=(cx+rx*math.cos(angle)*1.003,cy+ry*math.sin(angle)*1.003,z,1)
    o=bpy.data.objects.new('Spectral flow',curve);scene.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o=bpy.context.object;finish(o,'Spectral flow',rim,'skin');o.select_set(False)
# A deliberately non-humanoid skeleton: body, face, eyes, mouth and taper only.
bpy.ops.object.select_all(action='DESELECT');bpy.ops.object.armature_add();rig=bpy.context.object;rig.name='Boo_Rig';bpy.ops.object.mode_set(mode='EDIT');rig.data.edit_bones.remove(rig.data.edit_bones[0]);bones={}
for name,head,tail,parent in [('Root',(0,0,0),(0,0,.2),None),('Body',(0,0,.9),(0,0,1.3),'Root'),('Face',(0,0,1.3),(0,0,1.7),'Body'),('Eyes',(0,-.25,1.48),(0,-.25,1.58),'Face'),('Mouth',(0,-.24,1.26),(0,-.24,1.31),'Face'),('Tail_Base',(0,0,.9),(0,0,.6),'Body'),('Tail_Tip',(0,0,.6),(0,0,.3),'Tail_Base')]:
    b=rig.data.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=bones[parent]
    bones[name]=b
bpy.ops.object.mode_set(mode='OBJECT')
for o,group in objects:
    bpy.context.view_layer.update();matrix=o.matrix_world.copy();o.parent=rig;o.matrix_world=matrix;mod=o.modifiers.new('Spectral deformation','ARMATURE');mod.object=rig
    if group=='skin':
        groups={name:o.vertex_groups.new(name=name) for name in ['Body','Face','Tail_Base','Tail_Tip']}
        for v in o.data.vertices:
            z=(o.matrix_world@v.co).z
            if z>=1.2:t=min(1,(z-1.2)/.25);weights={'Body':1-t,'Face':t}
            elif z>=.78:t=min(1,(z-.78)/.2);weights={'Body':t,'Tail_Base':1-t}
            else:t=max(0,min(1,(z-.38)/.4));weights={'Tail_Base':t,'Tail_Tip':1-t}
            for name,weight in weights.items():
                if weight>0:groups[name].add([v.index],weight,'REPLACE')
    else:g=o.vertex_groups.new(name=group);g.add(list(range(len(o.data.vertices))),1,'REPLACE')
def anchor(name,pos,bone):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location=pos;bpy.context.view_layer.update();matrix=o.matrix_world.copy();o.parent=rig;o.parent_type='BONE';o.parent_bone=bone;o.matrix_world=matrix;return o
anchor('Boo_Origin',(0,0,0),'Root');anchor('Face_Focus',(0,-.2,1.46),'Face');anchor('Pulse_Origin',(0,0,1.1),'Body');anchor('Tail_Anchor',(.12,.035,.28),'Tail_Tip')
rig.animation_data_create()
for name,length in [('Idle',4),('Glide',2),('Interact',3)]:
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for b in rig.pose.bones:b.rotation_mode='XYZ'
    for frame in range(0,length*30+1,5):
        t=frame/(length*30);wave=2*math.pi*t
        for b in rig.pose.bones:b.location=(0,0,0);b.rotation_euler=(0,0,0);b.scale=(1,1,1)
        rig.pose.bones['Body'].location.y=.035*math.sin(wave)
        rig.pose.bones['Body'].rotation_euler.x=.11 if name=='Glide' else .025*math.sin(wave)
        rig.pose.bones['Tail_Base'].rotation_euler.z=.10*math.sin(wave+.5);rig.pose.bones['Tail_Tip'].rotation_euler.z=.13*math.sin(wave+1)
        rig.pose.bones['Face'].rotation_euler.z=(.10 if name=='Interact' else .018)*math.sin(wave)
        # Local Y lies along the vertical eye bone; closing it makes a blink.
        blink=max(0,1-abs(t-.5)/.05);rig.pose.bones['Eyes'].scale.y=1-.9*blink
        for b in rig.pose.bones:
            b.keyframe_insert('location',frame=frame);b.keyframe_insert('rotation_euler',frame=frame);b.keyframe_insert('scale',frame=frame)
    for f in action.fcurves:
        for k in f.keyframe_points:k.interpolation='BEZIER'
    track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
rig.animation_data.action=None
for b in rig.pose.bones:b.location=(0,0,0);b.rotation_euler=(0,0,0);b.scale=(1,1,1)
scene.frame_set(0);bpy.ops.wm.save_as_mainfile(filepath=a.master)
bpy.ops.export_scene.gltf(filepath=a.output,export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_cameras=False,export_lights=False)
# Private neutral studio render with all authored anatomy visible.
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.world=bpy.data.worlds.new('Boo neutral studio');scene.world.color=(.06,.07,.09)
for pos,power,size in [((-2,-3,4),230,3),((2,1,3),320,2)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(2.15,-4.2,1.9));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.05))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.15;scene.camera=cam
scene.render.resolution_x=1000;scene.render.resolution_y=1200;scene.render.resolution_percentage=100;scene.render.filepath=a.render;bpy.ops.render.render(write_still=True)
triangles=0
for o in scene.objects:
    if o.type=='MESH':o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
print('BOO_BUILT '+json.dumps({'bytes':pathlib.Path(a.output).stat().st_size,'triangles':triangles,'bones':len(rig.data.bones),'animations':[a.name for a in bpy.data.actions]}))
