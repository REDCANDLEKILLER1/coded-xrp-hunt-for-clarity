"""Original provisional Corn model using the private CC0-derived anatomy rig.
Written identity + private generated study; not a recovered canon turnaround.
Never overwrites the input master. New head, leaves, eyewear and field hardware.
"""
import argparse,json,math,pathlib,sys
import bpy,bmesh
from mathutils import Vector

p=argparse.ArgumentParser()
for name in ['base','master','output','render']:p.add_argument('--'+name,required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
base,master,output,render=[pathlib.Path(getattr(a,n)) for n in ['base','master','output','render']]
if base.resolve() in [master.resolve(),output.resolve()]:raise RuntimeError('Preserve the existing master')
for path in [master,output,render]:path.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(base));scene=bpy.context.scene
rig=bpy.data.objects['XRPMan_Rig'];rig.name='Corn_Rig';body=bpy.data.objects['XRPMan_Surface'];body.name='Corn_Surface'
rig.animation_data.action=None
for bone in rig.pose.bones:bone.rotation_quaternion=(1,0,0,0);bone.location=(0,0,0);bone.scale=(1,1,1)
scene.frame_set(0)
remove=('Fitted scalp','Quiff lock','Eye white','Iris','Pupil','Eyebrow','High collar','Chest insignia','Belt insignia','Back insignia','Pectoral armor','Abdominal plate')
for obj in list(scene.objects):
    if obj.name.startswith(remove):bpy.data.objects.remove(obj,do_unlink=True)
# Retain skin weights/UVs on the working body while removing the human head.
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z>1.60],context='VERTS');bm.to_mesh(body.data);bm.free()

def material(name,color,rough=.5,metal=0,emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
    if emission:bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emission
    return m
gold=material('Corn golden kernels',(.52,.28,.025),.5,.01)
goldlight=material('Corn kernel variation',(.67,.36,.045),.49,.01)
leaf=material('Corn fibrous husk',(.065,.15,.012),.7)
leaflight=material('Corn leaf rib',(.14,.24,.026),.62)
black=material('Corn sunglasses',(.006,.009,.01),.13,.28)
rubber=material('Corn tool hardware',(.018,.023,.02),.75,.1)
steel=material('Corn fasteners',(.17,.19,.16),.33,.7)
green=bpy.data.materials.get('Liquidity #00FF00') or material('Liquidity #00FF00',(0,1,0),.3,.1,1)
for name in ['Graphite armor - satin metal','Armor edges - brushed steel']:
    mat=bpy.data.materials.get(name)
    if mat:
        mat.name='Corn field armor' if name.startswith('Graphite') else 'Corn worn armor edges';color=(.36,.23,.045) if name.startswith('Graphite') else (.19,.14,.055)
        mat.diffuse_color=(*color,1);bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.57;bs.inputs['Metallic'].default_value=.35

def attach(obj,mat,bone='head'):
    obj.data.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    for poly in obj.data.polygons:poly.use_smooth=True
    obj.parent=rig;group=obj.vertex_groups.new(name=bone);group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    mod=obj.modifiers.new('Corn deformation','ARMATURE');mod.object=rig
    return obj
def sphere(name,pos,size,mat,bone='head',segments=12,rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=pos);obj=bpy.context.object;obj.name=name;obj.scale=size;return attach(obj,mat,bone)
def tube(name,coords,radius,mat,bone='head'):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.bevel_depth=radius;data.bevel_resolution=1;data.resolution_u=4
    spline=data.splines.new('BEZIER');spline.bezier_points.add(len(coords)-1)
    for point,co in zip(spline.bezier_points,coords):point.co=co;point.handle_left_type='AUTO';point.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH');return attach(obj,mat,bone)
def plate(name,pos,size,mat,bone):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);obj=bpy.context.object;obj.name=name;obj.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);bevel=obj.modifiers.new('Rounded machined edges','BEVEL');bevel.width=.007;bevel.segments=3;bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=bevel.name)
    return attach(obj,mat,bone)

# Continuous cob core under individually rounded kernels. Head construction
# is actual geometry, including side/rear rows, not a camera-facing image.
sphere('Corn cob core',(0,0,1.84),(.104,.095,.26),gold,segments=24,rings=16)
for row in range(18):
    z=1.60+row*.027
    radius=.099*(.78+.22*math.sin(math.pi*(row/20)))
    if row>12:radius*=1-(row-12)*.095
    for col in range(18):
        angle=math.tau*(col+(row%2)*.15)/18
        obj=sphere('Corn kernel %02d %02d'%(row,col),(math.cos(angle)*radius,math.sin(angle)*radius*.90,z),(.016,.013,.014),goldlight if (row+col)%5==0 else gold,segments=8,rings=6)
        # Sphere vertex positions have been baked; turn its kernel shape around
        # the radial axis in the actual mesh rather than moving the rig node.
        center=Vector((math.cos(angle)*radius,math.sin(angle)*radius*.90,z))
        from mathutils import Matrix
        rotation=Matrix.Rotation(angle,4,'Z')
        for v in obj.data.vertices:v.co=center+rotation.to_3x3()@(v.co-center)

def husk(name,angle,start_z,length,outward,mat,width_scale=.055):
    vertices=[];faces=[]
    for i in range(13):
        t=i/12;r=.075+math.sin(t*math.pi*.75)*outward;z=start_z+length*t-.075*math.sin(t*math.pi)
        width=width_scale*math.sin(math.pi*t)**.6+.002
        for side in [-1,0,1]:vertices.append((math.cos(angle)*r-math.sin(angle)*width*side,math.sin(angle)*r+math.cos(angle)*width*side,z+.017*(1-side*side)*math.sin(math.pi*t)))
    for i in range(12):
        for j in range(2):faces.append((i*3+j,i*3+j+1,(i+1)*3+j+1,(i+1)*3+j))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);attach(obj,mat)
    solid=obj.modifiers.new('Leaf thickness','SOLIDIFY');solid.thickness=.002;bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_move_up(modifier=solid.name);bpy.ops.object.modifier_apply(modifier=solid.name)
    coords=[vertices[i*3+1] for i in range(13)];tube(name+' rib',coords,.0015,leaflight)
for i in range(9):husk('Corn collar husk %d'%i,math.tau*i/9,1.565,.12,.21,leaf)
for i in range(5):husk('Corn crown leaf %d'%i,math.tau*i/5,2.015,.10+(i%2)*.03,.016,leaf,.018)
for side in [-1,1]:
    sphere('Corn sunglass lens',(side*.046,-.095,1.902),(.05,.011,.024),black,segments=20,rings=12)
    tube('Corn glasses temple',[(side*.083,-.082,1.904),(side*.111,-.01,1.902),(side*.095,.064,1.893)],.004,black)
tube('Corn glasses bridge',[(-.014,-.106,1.906),(0,-.114,1.913),(.014,-.106,1.906)],.004,black)
tube('Corn smile',[(-.035,-.099,1.791),(0,-.108,1.784),(.035,-.099,1.791)],.0035,rubber)
paint=bpy.data.materials['Corn field armor']
for side in [-1,1]:
    plate('Corn breastplate',(side*.075,-.143,1.445),(.135,.037,.145),paint,'spine01')
    for dx,dz in [(-.042,-.049),(.042,-.049),(-.042,.049),(.042,.049)]:sphere('Corn plate rivet',(side*.075+dx,-.166,1.445+dz),(.004,.0025,.004),steel,'spine01',8,6)
for z in [1.22,1.295]:plate('Corn abdomen guard',(0,-.127,z),(.17,.028,.056),paint,'spine02')
plate('Corn relief badge',(0,-.174,1.448),(.062,.012,.027),rubber,'spine01')
plate('Corn friendly badge light',(0,-.184,1.449),(.039,.004,.008),green,'spine01')
for side in [-1,1]:
    plate('Corn field pouch',(side*.138,-.133,1.049),(.074,.042,.088),rubber,'spine04')
    plate('Corn pouch clasp',(side*.138,-.159,1.063),(.025,.008,.022),steel,'spine04')
plate('Corn repair unit',(.202,-.02,1.04),(.047,.055,.16),steel,'spine04')
plate('Corn repair charge',(.225,-.05,1.04),(.006,.01,.105),green,'spine04')

# Real UV maps carry the material detail into GLB; procedural Blender shaders
# alone would disappear during export. The existing anatomical maps stay intact.
for mat in [paint,gold,goldlight,leaf,leaflight,rubber]:
    nodes=mat.node_tree.nodes;links=mat.node_tree.links;bs=nodes.get('Principled BSDF');color=tuple(bs.inputs['Base Color'].default_value)
    noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=160 if mat==paint else 95;noise.inputs['Detail'].default_value=3
    ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.24;ramp.color_ramp.elements[0].color=tuple(c*.4 for c in color[:3])+(1,);ramp.color_ramp.elements[1].position=.76;ramp.color_ramp.elements[1].color=color
    links.new(noise.outputs['Fac'],ramp.inputs['Fac']);links.new(ramp.outputs['Color'],bs.inputs['Base Color'])
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.16;bump.inputs['Distance'].default_value=.002 if mat==paint else .0007;links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],bs.inputs['Normal'])
    rough=nodes.new('ShaderNodeMapRange');rough.inputs['To Min'].default_value=.44;rough.inputs['To Max'].default_value=.8;links.new(noise.outputs['Fac'],rough.inputs['Value']);links.new(rough.outputs['Result'],bs.inputs['Roughness'])
atlas_objects=[o for o in scene.objects if o.type=='MESH' and o.parent==rig and o!=body and green not in list(o.data.materials)]
bpy.ops.object.select_all(action='DESELECT')
for obj in atlas_objects:obj.select_set(True)
bpy.context.view_layer.objects.active=atlas_objects[0];bpy.ops.object.join();atlas=bpy.context.object;atlas.name='Corn field materials atlas'
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.004);bpy.ops.object.mode_set(mode='OBJECT')
scene.render.bake.margin=4;scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=True
maps={}
for kind,label in [('DIFFUSE','Albedo'),('NORMAL','Normal'),('ROUGHNESS','Roughness')]:
    img=bpy.data.images.new('Corn field '+label,width=1024,height=1024,alpha=False);img.colorspace_settings.name='sRGB' if kind=='DIFFUSE' else 'Non-Color';maps[label]=img
    for mat in atlas.data.materials:
        for node in mat.node_tree.nodes:node.select=False
        node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=img;node.select=True;mat.node_tree.nodes.active=node
    bpy.ops.object.bake(type=kind);img.pack()
for mat in atlas.data.materials:
    nodes=mat.node_tree.nodes;links=mat.node_tree.links;bs=nodes.get('Principled BSDF')
    for label,socket in [('Albedo','Base Color'),('Roughness','Roughness')]:
        node=nodes.new('ShaderNodeTexImage');node.image=maps[label];links.new(node.outputs['Color'],bs.inputs[socket])
    tex=nodes.new('ShaderNodeTexImage');tex.image=maps['Normal'];normal=nodes.new('ShaderNodeNormalMap');links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bs.inputs['Normal'])

objects=[o for o in scene.objects if o.type=='MESH' and o.parent==rig]
height=max(v.co.z for o in objects for v in o.data.vertices);normalization=1.95/height
for obj in objects:
    for v in obj.data.vertices:v.co*=normalization
bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for bone in rig.data.edit_bones:bone.head*=normalization;bone.tail*=normalization
bpy.ops.object.mode_set(mode='OBJECT')
for name in ['Hand_R','Hand_L','Hero_Origin']:
    obj=bpy.data.objects[name];bone=rig.data.bones[obj.parent_bone];obj.matrix_world.translation=bone.tail_local+Vector((0,-.015,0)) if name.startswith('Hand_') else Vector((0,0,0))
for action in list(bpy.data.actions):
    if action.name not in ['Idle','Interact','Hit']:bpy.data.actions.remove(action)
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(0)
scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=1000;scene.render.resolution_y=1200
bpy.ops.wm.save_as_mainfile(filepath=str(master))
# Merge material groups for bounded draw calls; keep one shared skeleton.
groups={}
for obj in objects:groups.setdefault(tuple(m.name for m in obj.data.materials),[]).append(obj)
runtime=[]
for index,items in enumerate(groups.values()):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in items:obj.select_set(True)
    bpy.context.view_layer.objects.active=items[0]
    if len(items)>1:bpy.ops.object.join()
    obj=bpy.context.object;obj.name='Corn_Runtime_%02d'%index
    if len(obj.data.polygons)>1500:
        mod=obj.modifiers.new('Corn runtime reduction','DECIMATE');mod.ratio=.58;bpy.ops.object.modifier_move_up(modifier=mod.name);bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.validate(clean_customdata=True);runtime.append(obj)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for obj in scene.objects:
    if obj.parent==rig:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_def_bones=True,export_skins=True,export_all_influences=False,export_extras=False,export_cameras=False,export_lights=False)
scene.render.filepath=str(render);bpy.ops.render.render(write_still=True)
triangles=0
for obj in runtime:obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
print('CORN_BUILT '+json.dumps({'bytes':output.stat().st_size,'triangles':triangles,'meshes':len(runtime),'height':1.95,'clips':[a.name for a in bpy.data.actions]}))
