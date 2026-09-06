"""Build original CODED human costumes/animations from pinned CC0 anatomy.

Blender 4.3 CLI: --background --python scripts/build-xrpman.py --
  --source-dir <private MakeHuman graphical data> --master <private .blend>
  --output <runtime .glb> --render <private review.png>
No source/reference files are copied to the runtime repository.
"""
import argparse
import json
import math
import pathlib
import sys
import bpy
import bmesh
from mathutils import Vector, Quaternion
from mathutils.bvhtree import BVHTree

p = argparse.ArgumentParser()
p.add_argument('--source-dir', required=True)
p.add_argument('--master', required=True)
p.add_argument('--output', required=True)
p.add_argument('--render', required=True)
p.add_argument('--skip-bake', action='store_true')
p.add_argument('--character', choices=['xrpman', 'mr_zamn'], default='xrpman')
args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
crew = args.character == 'mr_zamn'
character = 'MrZamn' if crew else 'XRPMan'
target_height = 1.96 if crew else 1.9304
source, master, output, render = map(pathlib.Path, [args.source_dir, args.master, args.output, args.render])
for path in [master, output, render]:
    path.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.render.resolution_x = 1000
scene.render.resolution_y = 1200
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'Medium High Contrast'
scene.world = bpy.data.worlds.new('Studio World')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.065, .085, .12, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .45

def obj_data(path):
    vertices, uvs, faces, group = [], [], [], ''
    for line in path.read_text().splitlines():
        a = line.split()
        if not a: continue
        if a[0] == 'v': vertices.append(Vector(tuple(map(float, a[1:4]))))
        elif a[0] == 'vt': uvs.append(tuple(map(float, a[1:3])))
        elif a[0] == 'g': group = a[1]
        elif a[0] == 'f': faces.append((group, [tuple(int(v)-1 if v else -1 for v in item.split('/')) for item in a[1:]]))
    return vertices, uvs, faces

verts, uv, faces = obj_data(source/'base.obj')
for filename, weight in [('african-male-young.target' if crew else 'caucasian-male-young.target', 1), ('universal-male-young-maxmuscle-averageweight.target', 1 if crew else .72)]:
    for line in (source/filename).read_text().splitlines():
        a = line.split()
        if len(a) == 4 and a[0].isdigit(): verts[int(a[0])] += Vector(tuple(map(float, a[1:]))) * weight
body_faces = [face for group, face in faces if group == 'body']
used = sorted({item[0] for face in body_faces for item in face})
floor = min(verts[i].y for i in used)
scale = 1.88 / (max(verts[i].y for i in used) - floor)
points = [Vector((v.x, -v.z, v.y-floor)) * scale for v in verts]
remap = {old: new for new, old in enumerate(used)}

def material(name, color, rough=.5, metal=0, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emission:
        b.inputs['Emission Color'].default_value = (*color, 1)
        b.inputs['Emission Strength'].default_value = emission
    return m

skin = material('Warm skin - pores', (.105, .045, .026) if crew else (.35, .18, .105), .58)
cloth = material('Black woven undersuit', (.013, .019, .026), .82)
gloves = material('Reinforced glove leather', (.012, .014, .018), .6)
armor = material('Graphite armor - satin metal', (.026, .033, .042), .57 if crew else .45, .3 if crew else .42)
edge = material('Armor edges - brushed steel', (.085, .105, .125), .29, .72)
green = material('TruFi blue' if crew else 'Liquidity #00FF00', (.005,.16,1) if crew else (0, 1, 0), .32, .15, .65)
darkgreen = material('Recessed faction panels', (.002,.015,.08) if crew else (.003, .11, .008), .4, .3)
hairmat = material('Cropped black hair' if crew else 'Chestnut hair', (.008,.006,.005) if crew else (.058, .019, .008), .76 if crew else .52)
hairlight = material('Hair highlights', (.017,.011,.008) if crew else (.095, .035, .012), .65 if crew else .48)
white = material('Eye sclera', (.65, .68, .64), .2)
iris = material('Brown iris' if crew else 'Green iris', (.055,.025,.01) if crew else (.015, .3, .035), .25)
pupil = material('Eye pupil', (.001, .002, .001), .18)
lip = material('Natural lips', (.1,.032,.024) if crew else (.32, .12, .08), .53)

def microtexture(mat, amount, frequency):
    n = mat.node_tree.nodes
    b = n.get('Principled BSDF')
    noise = n.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = frequency
    noise.inputs['Detail'].default_value = 2
    bump = n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = amount
    bump.inputs['Distance'].default_value = .00025 if mat==skin else .0006
    mat.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    mat.node_tree.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    ramp = n.new('ShaderNodeValToRGB')
    c = mat.diffuse_color
    ramp.color_ramp.elements[0].position = .1
    low=.95 if mat==skin else .86
    high=1.03 if mat==skin else 1.08
    ramp.color_ramp.elements[0].color = (c[0]*low,c[1]*low,c[2]*low,1)
    ramp.color_ramp.elements[1].position = .9
    ramp.color_ramp.elements[1].color = (c[0]*high,c[1]*high,c[2]*high,1)
    mat.node_tree.links.new(noise.outputs['Fac'],ramp.inputs[0])
    mat.node_tree.links.new(ramp.outputs[0],b.inputs['Base Color'])
microtexture(skin, .12, 700)
microtexture(cloth, .27, 470)
microtexture(gloves, .2, 380)

data = bpy.data.meshes.new(character+' anatomical surface')
data.from_pydata([points[i] for i in used], [], [[remap[item[0]] for item in face] for face in body_faces])
data.update()
body = bpy.data.objects.new(character+'_Surface', data)
scene.collection.objects.link(body)
for mat in [skin, cloth, gloves, lip]: data.materials.append(mat)
uvlayer = data.uv_layers.new(name='AnatomyUV')
for poly, face in zip(data.polygons, body_faces):
    center = sum((data.vertices[i].co for i in poly.vertices), Vector()) / len(poly.vertices)
    poly.material_index = 0 if center.z > 1.615 else (2 if abs(center.x) > .36 or center.z < .18 else 1)
    if 1.67 < center.z < 1.69 and center.y < -.17 and abs(center.x) < .026: poly.material_index = 3
    poly.use_smooth = True
    for loop, item in zip(poly.loop_indices, face): uvlayer.data[loop].uv = uv[item[1]]

rig_data = json.loads((source/'default.mhskel').read_text())
joint = {name: sum((points[i] for i in indices), Vector())/len(indices) for name, indices in rig_data['joints'].items()}
armdata = bpy.data.armatures.new(character+' skeleton')
rig = bpy.data.objects.new(character+'_Rig', armdata)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name, desc in rig_data['bones'].items():
    bone = armdata.edit_bones.new(name)
    bone.head, bone.tail = joint[desc['head']], joint[desc['tail']]
    if (bone.head-bone.tail).length < .00001: bone.tail.z += .001
    plane = rig_data['planes'].get(desc['rotation_plane'])
    if plane:
        normal = (joint[plane[1]]-joint[plane[0]]).cross(joint[plane[2]]-joint[plane[0]])
        if normal.length > .00001: bone.align_roll(normal.normalized())
for name, desc in rig_data['bones'].items():
    if desc['parent']: armdata.edit_bones[name].parent = armdata.edit_bones[desc['parent']]
bpy.ops.object.mode_set(mode='OBJECT')
rig.select_set(False)
all_weights = json.loads((source/'default_weights.mhw').read_text())['weights']
weights = [[] for _ in verts]
for name, values in all_weights.items():
    if name not in armdata.bones: continue
    for index, weight in values:
        if weight > .0001: weights[index].append((name, weight))
for index, values in enumerate(weights):
    top = sorted(values, key=lambda x: -x[1])[:4]
    total = sum(w for _, w in top)
    weights[index] = [(n, w/total) for n, w in top] if total else [('root', 1)]

objects = [body]
def attach(obj, old_indices=None, bone=None):
    obj.parent = rig
    mod = obj.modifiers.new('XRPMan deformation', 'ARMATURE')
    mod.object = rig
    groups = {}
    for i in range(len(obj.data.vertices)):
        values = [(bone, 1)] if bone else weights[old_indices[i]]
        for name, w in values:
            if name not in groups: groups[name] = obj.vertex_groups.new(name=name)
            groups[name].add([i], w, 'REPLACE')
    if obj not in objects: objects.append(obj)
attach(body, used)

def surface(name, predicate, mat, offset=.008, bevel=.003, thickness=.004):
    if crew and mat in [armor,edge]: offset*=1.65; thickness*=1.7
    chosen = [poly for poly in data.polygons if predicate(sum((data.vertices[i].co for i in poly.vertices), Vector())/len(poly.vertices))]
    indices = sorted({i for poly in chosen for i in poly.vertices})
    if not indices: raise RuntimeError('Empty surface '+name)
    lookup = {old:new for new,old in enumerate(indices)}
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([data.vertices[i].co + data.vertices[i].normal*offset for i in indices],[],[[lookup[i] for i in poly.vertices] for poly in chosen])
    # Smooth the cut boundary so anatomical quad selection does not leave stairs.
    bm=bmesh.new(); bm.from_mesh(mesh)
    boundary=[v for v in bm.verts if v.is_boundary]
    for _ in range(5):
        updates={}
        for v in boundary:
            neighbors=[e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(neighbors)==2: updates[v]=v.co.lerp((neighbors[0].co+neighbors[1].co)*.5,.6)
        for v,co in updates.items(): v.co=co
    bm.to_mesh(mesh); bm.free(); mesh.update()
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    for poly in mesh.polygons: poly.use_smooth = True
    attach(obj,[used[i] for i in indices])
    # Apply thickness before skinning, preserving the copied anatomical weights.
    solid = obj.modifiers.new('Armor thickness','SOLIDIFY'); solid.thickness=thickness
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_move_up(modifier=solid.name)
    bpy.ops.object.modifier_apply(modifier=solid.name)
    if bevel:
        bevelmod=obj.modifiers.new('Soft machined edge','BEVEL'); bevelmod.width=bevel; bevelmod.segments=2
        bevelmod.limit_method='ANGLE'; bevelmod.angle_limit=.8
        bpy.ops.object.modifier_move_up(modifier=bevelmod.name)
        bpy.ops.object.modifier_apply(modifier=bevelmod.name)
    mesh.validate(clean_customdata=True)
    mesh.update()
    return obj

surface('Pectoral armor',lambda c: 1.335<c.z<1.51 and abs(c.x)<.184 and c.y<-.075,armor)
surface('Back harness',lambda c: 1.23<c.z<1.51 and abs(c.x)<.18 and c.y>.07,armor)
for side in [-1,1]:
    surface('Shoulder shell '+str(side),lambda c,s=side: .173<c.x*s<.27 and 1.425<c.z<1.55,armor,.012,.003,.006)
    surface('Forearm guard '+str(side),lambda c,s=side: .31<c.x*s<.4 and 1.08<c.z<1.3,armor,.009,.002,.005)
    surface('Thigh guard '+str(side),lambda c,s=side: .055<c.x*s<.206 and .65<c.z<.965 and c.y<.017,armor,.008,.002,.004)
    surface('Shin and boot shell '+str(side),lambda c,s=side: .055<c.x*s<.3 and .035<c.z<.485 and (c.y<.028 or c.z<.18),armor,.009,.002,.006)
    surface('Knee plate '+str(side),lambda c,s=side: .07<c.x*s<.22 and .49<c.z<.595 and c.y<-.014,edge,.011,.002,.005)
surface('Belt panels',lambda c: .995<c.z<1.065 and abs(c.x)<.175,armor,.012,.002,.006)
for z in [1.135,1.205,1.275]:
    surface('Abdominal plate '+str(z),lambda c,h=z: h-.024<c.z<h+.024 and abs(c.x)<.112 and c.y<-.075,armor,.009,.002,.003)
surface('High collar',lambda c: 1.56<c.z<1.647 and abs(c.x)<.092,armor,.009,.002,.004)

def curve(name, coords, radius, mat, bone, cyclic=False):
    d=bpy.data.curves.new(name,'CURVE'); d.dimensions='3D'; d.resolution_u=8
    spline=d.splines.new('BEZIER'); spline.bezier_points.add(len(coords)-1)
    for point,co in zip(spline.bezier_points,coords):
        point.co=co; point.handle_left_type='AUTO'; point.handle_right_type='AUTO'
    spline.use_cyclic_u=cyclic; d.bevel_depth=radius; d.bevel_resolution=1; d.resolution_u=1 if cyclic else 6
    obj=bpy.data.objects.new(name,d); scene.collection.objects.link(obj); d.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj; bpy.ops.object.convert(target='MESH')
    attach(obj,bone=bone)
    return obj

def sphere(name, pos, size, mat, bone, segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=pos)
    obj=bpy.context.object; obj.name=name; obj.scale=size
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    obj.data.materials.append(mat)
    for poly in obj.data.polygons: poly.use_smooth=True
    attach(obj,bone=bone)
    return obj

def emblem(name,center,radius,bone,reverse=False):
    x,y,z=center
    sphere(name+' inset',center,(radius*1.05,.006,radius*1.05),darkgreen,bone,24,12)
    yy=y+(.009 if reverse else -.009)
    curve(name+' ring',[(x+radius*math.cos(a*math.tau/32),yy,z+radius*math.sin(a*math.tau/32)) for a in range(32)],radius*.065,green,bone,True)
    if crew:
        for label,path in [('top',[(-.34,.15),(0,.72),(.34,.15)]),('lower left',[(-.4,-.02),(-.69,-.56),(-.07,-.56),(-.07,-.02)]),('lower right',[(.07,-.02),(.07,-.56),(.69,-.56),(.4,-.02)])]:
            curve(name+' TruFi '+label,[(x+u*radius,yy,z+v*radius) for u,v in path],radius*.028,green,bone,True)
    else:
        for sign in [-1,1]:
            curve(name+' X',[(x-radius*.51,yy,z-sign*radius*.56),(x,yy-.001,z),(x+radius*.51,yy,z+sign*radius*.56)],radius*.10,green,bone)
emblem('Chest insignia',(0,-.188 if crew else -.169,1.427),.08 if crew else .068,'spine01')
emblem('Belt insignia',(0,-.155 if crew else -.145,1.032),.028,'spine04')
emblem('Back insignia',(0,.145 if crew else .128,1.412),.054,'spine01',True)
for s in [-1,1]:
    curve('Chest piping',[(s*.028,-.134,1.554),(s*.1,-.157,1.529),(s*.168,-.126,1.485)],.0035,green,'spine01')
    curve('Abdominal piping',[(s*.125,-.099,1.32),(s*.117,-.113,1.23),(s*.09,-.118,1.125)],.0028,green,'spine02')
    curve('Gauntlet energy',[(s*.334,-.027,1.255),(s*.362,-.034,1.17)],.0035,green,'lowerarm02.'+('L' if s>0 else 'R'))
    curve('Boot piping',[(s*.165,-.072,.435),(s*.187,-.074,.32),(s*.202,-.069,.185)],.0035,green,'lowerleg02.'+('L' if s>0 else 'R'))

# Structured boots cover the individual anatomical toes.
for side in [-1,1]:
    foot_vertices=[v.co for v in data.vertices if v.co.x*side>0 and v.co.z<.14]
    xmin=min(v.x for v in foot_vertices)-.006; xmax=max(v.x for v in foot_vertices)+.006
    ymin=min(v.y for v in foot_vertices)-.011; ymax=max(v.y for v in foot_vertices)+.008
    centerx=(xmin+xmax)/2
    vertices=[]; polys=[]
    for z,rx,ry,cy in [(.002,(xmax-xmin)*.51,(ymax-ymin)*.52,(ymin+ymax)/2),(.025,(xmax-xmin)*.53,(ymax-ymin)*.53,(ymin+ymax)/2),(.073,(xmax-xmin)*.5,(ymax-ymin)*.48,(ymin+ymax)/2),(.115,(xmax-xmin)*.36,.051,-.008),(.19,(xmax-xmin)*.34,.045,.004)]:
        for i in range(20):
            a=math.tau*i/20; vertices.append((centerx+math.cos(a)*rx,cy+math.sin(a)*ry,z))
    for ring in range(4):
        for i in range(20): polys.append((ring*20+i,ring*20+(i+1)%20,(ring+1)*20+(i+1)%20,(ring+1)*20+i))
    polys.append(tuple(reversed(range(20)))); polys.append(tuple(range(80,100)))
    mesh=bpy.data.meshes.new('Boot structure'); mesh.from_pydata(vertices,[],polys); mesh.materials.append(armor)
    obj=bpy.data.objects.new('Sealed armored boot',mesh); scene.collection.objects.link(obj)
    for poly in mesh.polygons: poly.use_smooth=True
    attach(obj,bone='foot.'+('L' if side>0 else 'R'))

# Hair is a fitted scalp; XRPMan's swept locks and Mr Zamn's beard are distinct.
surface('Fitted scalp',lambda c: c.z>1.821 or (c.z>1.765 and c.y>-.047) or (c.z>1.777 and abs(c.x)>.068 and c.y>-.11),hairmat,.002 if crew else .004,0,.002)
if crew:
    surface('Sculpted close beard',lambda c: 1.63<c.z<1.735 and c.y<-.048 and abs(c.x)<.082 and not (c.z>1.682 and abs(c.x)<.031 and c.y<-.13),hairmat,.003,0,.003)
    surface('Trimmed moustache',lambda c: 1.7<c.z<1.721 and abs(c.x)<.03 and c.y<-.12,hairmat,.002,0,.001)
tree=BVHTree.FromPolygons([v.co for v in data.vertices],[list(p.vertices) for p in data.polygons])
for i in range(0 if crew else 13):
    x=-.071+i*.0115
    rise=.01+.012*math.exp(-((x+.012)/.05)**2)
    start=Vector((x,-.135+abs(x)*.15,1.826))
    end=Vector((x*.79+.01,.062,1.833-abs(x)*.21))
    vertices=[]; faceslock=[]
    for j in range(11):
        t=j/10; c=start.lerp(end,t)
        c.x+=math.sin(t*math.pi)*.012
        hit=tree.ray_cast(Vector((c.x,c.y,3)),Vector((0,0,-1)))[0]
        if hit is None or hit.z<1.77:
            nearest=min((v.co for v in data.vertices if v.co.z>1.79),key=lambda v:(v.x-c.x)**2+(v.y-c.y)**2)
            c.x,c.y,c.z=nearest.x,nearest.y,nearest.z
        else: c.z=hit.z
        c.z+=.006+math.sin(t*math.pi)*rise
        width=(.002+.008*math.sin(math.pi*t)**.55)*(1-.4*t)
        for k in range(8):
            a=math.tau*k/8; vertices.append(c+Vector((math.cos(a)*width,0,math.sin(a)*width*.5)))
    for j in range(10):
        for k in range(8): faceslock.append((j*8+k,j*8+(k+1)%8,(j+1)*8+(k+1)%8,(j+1)*8+k))
    mesh=bpy.data.meshes.new('Swept lock'); mesh.from_pydata(vertices,[],faceslock); mesh.materials.append(hairlight if i%4==0 else hairmat)
    obj=bpy.data.objects.new('Quiff lock %02d'%i,mesh); scene.collection.objects.link(obj)
    for poly in mesh.polygons: poly.use_smooth=True
    attach(obj,bone='head')
for s in [-1,1]:
    bone='eye.'+('L' if s>0 else 'R')
    center=joint[rig_data['bones'][bone]['head']]
    sphere('Eye white',center,(.019,.016,.013),white,bone,20,12)
    sphere('Iris',(center.x,center.y-.015,center.z),(.007,.0027,.007),iris,bone,16,8)
    sphere('Pupil',(center.x,center.y-.0173,center.z),(.0032,.001,.0035),pupil,bone,12,8)
    brow=[]
    for x,z in [(s*.012,1.786),(s*.033,1.792),(s*.052,1.783)]:
        hit=tree.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))[0]
        brow.append((x,hit.y-.003 if hit else -.17,z))
    curve('Eyebrow',brow,.0028,hairmat,'head')

if crew:
    # Layered load-bearing plates and shield make a defense silhouette, not a hero recolor.
    def plate(name,location,size,mat,bone,bevel=.008,direction=None):
        bpy.ops.mesh.primitive_cube_add(size=1,location=location)
        obj=bpy.context.object; obj.name=name; obj.scale=size
        if direction is not None: obj.rotation_euler=Vector(direction).to_track_quat('Z','Y').to_euler()
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        obj.data.materials.append(mat)
        mod=obj.modifiers.new('Machined corners','BEVEL'); mod.width=bevel; mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        attach(obj,bone=bone)
        return obj
    for s in [-1,1]:
        suffix='.L' if s>0 else '.R'
        for level in range(3):
            plate('Layered pauldron',(s*(.245+level*.025),-.015,1.48-level*.043),(.13,.20,.067),armor,'upperarm01'+suffix,.016)
        plate('Shoulder light',(s*.27,-.124,1.486),(.086,.007,.017),green,'upperarm01'+suffix,.004)
        arm=armdata.bones['lowerarm02'+suffix]
        center=(arm.head_local+arm.tail_local)*.5+Vector((0,-.035,0))
        plate('Heavy gauntlet',center,(.105,.085,.15),armor,'lowerarm02'+suffix,.012,arm.tail_local-arm.head_local)
        plate('Gauntlet inset',center+Vector((0,-.049,.02)),(.055,.014,.036),green,'lowerarm02'+suffix,.004)
        plate('Thigh utility plate',(s*.152,-.094,.82),(.11,.07,.20),armor,'upperleg02'+suffix,.012)
        for z in [.84,.77]: plate('Strapped pouch',(s*.176,-.133,z),(.075,.037,.052),edge,'upperleg02'+suffix,.006)
        for x in [.055,.125]: plate('Belt pouch',(s*x,-.134,1.04),(.052,.064,.066),armor,'spine04',.007)
    plate('Armored upper backpack',(0,.135,1.38),(.25,.09,.24),armor,'spine01',.018)
    for s in [-1,1]: plate('Power cell',(s*.071,.191,1.39),(.025,.02,.12),green,'spine01',.005)
    shield_center=(.46,-.12,1.05); radius=.39
    sphere('Round shield titanium back',shield_center,(radius,.037,radius),armor,'wrist.L',32,16)
    emblem('Defense shield',(.46,-.161,1.05),radius*.88,'wrist.L')
    for i in range(16):
        a=i*math.tau/16
        sphere('Shield rim fastener',(.46+math.cos(a)*radius*.94,-.151,1.05+math.sin(a)*radius*.94),(.009,.009,.009),edge,'wrist.L',8,6)
    font=bpy.data.curves.new('Shield TruFi lettering','FONT');font.body='TruFi';font.align_x='CENTER';font.size=.105; font.extrude=.0005
    obj=bpy.data.objects.new('Shield TruFi lettering',font);scene.collection.objects.link(obj);obj.location=(.46,-.177,.785);obj.rotation_euler=(math.pi/2,0,0);font.materials.append(green)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);attach(obj,bone='wrist.L')
    shield_offset=armdata.bones['wrist.L'].head_local+Vector((0,-.26,-.02))-Vector(shield_center)
    for obj in objects:
        if obj.name.startswith(('Round shield','Defense shield','Shield rim','Shield TruFi')):
            for v in obj.data.vertices: v.co+=shield_offset

# Fit arm trim to the anatomical surface and inherit local blended skin weights.
for obj in objects:
    if not obj.name.startswith('Gauntlet energy'): continue
    for v in obj.data.vertices:
        nearby=min(range(len(data.vertices)),key=lambda i:(data.vertices[i].co-v.co).length_squared)
        v.co=data.vertices[nearby].co+data.vertices[nearby].normal*.014
        for group in list(obj.vertex_groups): group.remove([v.index])
        for name,w in weights[used[nearby]]:
            group=obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
            group.add([v.index],w,'REPLACE')

# Bake original skin and suit microdetail into embedded, UV-addressed maps.
if not args.skip_bake:
    bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active=body
    scene.render.bake.margin=8
    scene.render.bake.use_pass_direct=False
    scene.render.bake.use_pass_indirect=False
    scene.render.bake.use_pass_color=True
    for kind,label in [('DIFFUSE','Albedo'),('NORMAL','Normal'),('ROUGHNESS','Roughness')]:
        size=1024 if kind!='ROUGHNESS' else 512
        img=bpy.data.images.new(character+' '+label,width=size,height=size,alpha=False)
        img.colorspace_settings.name='sRGB' if kind=='DIFFUSE' else 'Non-Color'
        for mat in data.materials:
            for node in mat.node_tree.nodes: node.select=False
            node=mat.node_tree.nodes.new('ShaderNodeTexImage'); node.image=img; node.select=True; mat.node_tree.nodes.active=node
        bpy.ops.object.bake(type=kind)
        img.pack()
    baked=material(character+' skin and woven suit - baked', (1,1,1),.6)
    n=baked.node_tree.nodes; links=baked.node_tree.links; bs=n.get('Principled BSDF')
    for label,socket in [('Albedo','Base Color'),('Roughness','Roughness')]:
        node=n.new('ShaderNodeTexImage'); node.image=bpy.data.images[character+' '+label]; links.new(node.outputs['Color'],bs.inputs[socket])
    tex=n.new('ShaderNodeTexImage'); tex.image=bpy.data.images[character+' Normal']; normal=n.new('ShaderNodeNormalMap'); links.new(tex.outputs['Color'],normal.inputs['Color']); links.new(normal.outputs['Normal'],bs.inputs['Normal'])
    data.materials.clear(); data.materials.append(baked)
    for poly in data.polygons: poly.material_index=0

# Normalize the finished anatomical/costume master to the canon's 6 ft 4 in.
height=max(v.co.z for obj in objects for v in obj.data.vertices)-min(v.co.z for obj in objects for v in obj.data.vertices)
normalization=target_height/height
for obj in objects:
    for v in obj.data.vertices: v.co*=normalization
bpy.context.view_layer.objects.active=rig; bpy.ops.object.mode_set(mode='EDIT')
for bone in armdata.edit_bones: bone.head*=normalization; bone.tail*=normalization
bpy.ops.object.mode_set(mode='OBJECT')
for name,bone in [('Hand_R','wrist.R'),('Hand_L','wrist.L'),('Hero_Origin','root')]:
    obj=bpy.data.objects.new(name,None); scene.collection.objects.link(obj)
    obj.parent=rig; obj.parent_type='BONE'; obj.parent_bone=bone
    obj.matrix_world.translation=armdata.bones[bone].tail_local+Vector((0,-.015,0)) if name.startswith('Hand_') else Vector((0,0,0))

def world_pose(bone,axis,angle):
    basis=armdata.bones[bone].matrix_local.to_quaternion()
    return basis.inverted() @ Quaternion(Vector(axis),angle) @ basis

def make_action(name,duration,kind):
    rig.animation_data_create(); action=bpy.data.actions.new(name); rig.animation_data.action=action
    frames=max(2,round(duration*30))
    animated=['root','spine01','spine03','head']+[n+s for s in ['.L','.R'] for n in ['upperarm01','upperarm02','lowerarm01','lowerarm02','upperleg01','upperleg02','lowerleg01','lowerleg02','foot','wrist']]
    for f in sorted(set(range(0,frames+1,2)) | {frames}):
        t=f/frames; phase=t*math.tau
        for pb in rig.pose.bones:
            pb.rotation_mode='QUATERNION'; pb.rotation_quaternion=Quaternion(); pb.location=(0,0,0)
        def rotate(n,axis,rad): rig.pose.bones[n].rotation_quaternion=world_pose(n,axis,rad)
        # A-pose to relaxed arms. Left/right are the character's, as in the source rig.
        for s,sign in [('.L',1),('.R',-1)]:
            rotate('upperarm01'+s,(0,1,0),sign*.27)
            rotate('lowerarm01'+s,(1,0,0),-.12)
        rotate('spine01',(1,0,0),.007*math.sin(phase))
        if kind in ['Walk','Run']:
            amplitude=.44 if kind=='Walk' else .76
            for s,sign in [('.L',1),('.R',-1)]:
                stride=math.sin(phase)*sign
                rotate('upperleg01'+s,(1,0,0),stride*amplitude)
                rotate('lowerleg01'+s,(1,0,0),-max(0,-stride)*amplitude*1.5)
                rotate('foot'+s,(1,0,0),max(0,-stride)*amplitude*.3)
                base=world_pose('upperarm01'+s,(0,1,0),sign*.27)
                rig.pose.bones['upperarm01'+s].rotation_quaternion=base @ world_pose('upperarm01'+s,(1,0,0),-stride*amplitude*.65)
                rotate('lowerarm01'+s,(1,0,0),-.35 if kind=='Run' else -.16)
            rig.pose.bones['root'].location.z=abs(math.sin(phase))* (.012 if kind=='Walk' else .023)
        elif kind in ['AimFire','Interact']:
            envelope=1 if kind=='AimFire' else math.sin(math.pi*t)
            rest=(armdata.bones['wrist.R'].head_local-armdata.bones['upperarm01.R'].head_local).normalized()
            aim=rest.rotation_difference(Vector((.025,-1,-.03)).normalized())
            basis=armdata.bones['upperarm01.R'].matrix_local.to_quaternion()
            rig.pose.bones['upperarm01.R'].rotation_quaternion=Quaternion().slerp(basis.inverted() @ aim @ basis,envelope)
            rotate('lowerarm01.R',(1,0,0),-.1*envelope)
            rotate('wrist.R',(1,0,0),.15*envelope)
            if kind=='AimFire': rotate('spine01',(1,0,0),.06*math.sin(phase)**6)
        elif kind=='Hit':
            e=math.sin(math.pi*t)**2; rotate('spine01',(1,0,0),-.22*e); rotate('head',(1,0,0),-.12*e)
        elif kind=='Dodge':
            e=math.sin(math.pi*t); rotate('spine03',(1,0,0),.52*e)
            for s in ['.L','.R']:
                rotate('upperleg01'+s,(1,0,0),.6*e); rotate('lowerleg01'+s,(1,0,0),-1.1*e)
        elif kind=='KnockdownRecover':
            e=math.sin(math.pi*t)**.8; rotate('spine03',(1,0,0),.85*e); rotate('head',(1,0,0),-.2*e)
            for s in ['.L','.R']:
                rotate('upperleg01'+s,(1,0,0),1.15*e); rotate('lowerleg01'+s,(1,0,0),-1.5*e)
        for bone_name in animated:
            pb=rig.pose.bones[bone_name]; pb.keyframe_insert('rotation_quaternion',frame=f,group=bone_name)
            if bone_name=='root': pb.keyframe_insert('location',frame=f,group=bone_name)
    action.use_fake_user=True
    track=rig.animation_data.nla_tracks.new(); track.name=name
    strip=track.strips.new(name,0,action); strip.name=name
    track.mute=True
    return action

actions=[make_action(name,duration,name) for name,duration in ([('Idle',2.4),('Interact',1.2),('Hit',.5)] if crew else [('Idle',2.4),('Walk',1.1),('Run',.7),('AimFire',.5),('Interact',1.2),('Hit',.5),('Dodge',.7),('KnockdownRecover',2.0)])]
rig.animation_data.action=actions[0]
scene.frame_set(0)

def look(obj,target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
for name,pos,power,size,color in [('Key',(-3,-4,4),400,3,(.81,.89,1)),('Fill',(3,-2,2),210,2,(1,.84,.69)),('Rim',(1,3,3),500,2,(.42,.66,1))]:
    d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.shape='DISK'; d.size=size; d.color=color
    obj=bpy.data.objects.new(name,d); scene.collection.objects.link(obj); obj.location=pos; look(obj,(0,0,1))
camdata=bpy.data.cameras.new('Review camera'); cam=bpy.data.objects.new('Review camera',camdata); scene.collection.objects.link(cam)
cam.location=(2.65,-5.8,2.2); look(cam,(0,0,.99)); camdata.type='ORTHO'; camdata.ortho_scale=2.35; scene.camera=cam
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.018)); stage=bpy.context.object; stage.name='Review stage - not exported'; stage.data.materials.append(material('Stage',(.025,.035,.047),.8))
bpy.ops.wm.save_as_mainfile(filepath=str(master))
# Keep the editable master separated; runtime merges share one skeleton and material.
groups={}
for obj in objects:
    key=tuple(m.name for m in obj.data.materials)
    groups.setdefault(key,[]).append(obj)
runtime_objects=[]
for index,group in enumerate(groups.values()):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in group: obj.select_set(True)
    bpy.context.view_layer.objects.active=group[0]
    if len(group)>1: bpy.ops.object.join()
    obj=bpy.context.object; obj.name=character+'_Runtime_%02d'%index
    if (crew or group[0] is not body) and len(obj.data.polygons)>700:
        decimate=obj.modifiers.new('Runtime surface reduction','DECIMATE'); decimate.ratio=.66 if crew else .62
        bpy.ops.object.modifier_move_up(modifier=decimate.name)
        bpy.ops.object.modifier_apply(modifier=decimate.name)
    obj.data.validate(clean_customdata=True); obj.data.update()
    runtime_objects.append(obj)
bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True)
for obj in list(scene.objects):
    if obj.parent==rig: obj.select_set(True)
# Export actions independently rather than combining their identical frame spans.
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_def_bones=True,export_skins=True,export_all_influences=False,export_extras=False,export_cameras=False,export_lights=False)
scene.render.filepath=str(render); bpy.ops.render.render(write_still=True)
triangles=0
for obj in runtime_objects:
    obj.data.calc_loop_triangles(); triangles+=len(obj.data.loop_triangles)
print('CHARACTER_BUILT '+json.dumps({'character':args.character,'bytes':output.stat().st_size,'triangles':triangles,'animations':[a.name for a in actions],'height_m':target_height,'mesh_objects':len(runtime_objects),'bone_count':len(armdata.bones),'baked':not args.skip_bake}))
