"""Original mesh continuations of CODED's five enemy silhouettes.

Fast Scout retains the multi-prong source silhouette. Whale receives a distinct
broad, blunt missile-gunboat identity under the definitive campaign brief.
All masters, source studies and renders remain private.
"""
import argparse,json,math,pathlib,sys
import bpy,bmesh
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--material-master',required=True);p.add_argument('--directory',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);folder=pathlib.Path(a.directory);folder.mkdir(parents=True,exist_ok=True)
reports=[]
for key in ['regulator_drone','fast_scout','fog_raider','rug_fighter','whale_scout']:
    target=folder/key;target.mkdir(parents=True,exist_ok=True);master=target/(key+'_master.blend')
    if master.exists():raise RuntimeError('Use a new private version; preserve existing masters')
    bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;objects=[]
    with bpy.data.libraries.load(a.material_master,link=False) as (src,dst):dst.materials=['Armor_Plane']
    armor=bpy.data.materials.get('Armor_Plane');armor.name='Enemy manufactured armor'
    def mat(name,color,metal=.5,rough=.45,glow=0):
        m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough
        if glow:b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=glow
        return m
    dark=mat('Enemy graphite',(.018,.026,.032),.64,.5);trim=mat('Enemy titanium',(.16,.2,.22),.8,.37);red=mat('Hostile red',(1,.009,.002),.1,.4,1);glass=mat('Sensor glass',(.035,.005,.005),.45,.2)
    def mesh(name,v,f,material,bevel=.045):
        data=bpy.data.meshes.new(name);data.from_pydata(v,[],f);data.materials.append(material);data.update();bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(data);bm.free()
        obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj
        if bevel:
            mod=obj.modifiers.new('Armor edge','BEVEL');mod.width=bevel;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
        objects.append(obj);return obj
    def loft(name,sections,material=armor):
        v=[];n=8
        for y,x,w,lo,hi in sections:
            mid=(lo+hi)/2
            v.extend([(x-w*.7,y,lo),(x+w*.7,y,lo),(x+w,y,mid-.1),(x+w*.82,y,hi-.1),(x+w*.4,y,hi),(x-w*.4,y,hi),(x-w*.82,y,hi-.1),(x-w,y,mid-.1)])
        f=[tuple(reversed(range(n)))]
        for j in range(len(sections)-1):
            for i in range(n):f.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
        f.append(tuple(range((len(sections)-1)*n,len(sections)*n)));return mesh(name,v,f,material)
    def blade(name,points,lo,hi,material=armor):
        n=len(points);return mesh(name,[(x,y,z) for z in [lo,hi] for x,y in points],[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],material)
    def box(name,x,y,z,w,d,h,material=armor):
        return mesh(name,[(x+sx*w/2,y+sy*d/2,z+sz*h/2) for sz in [-1,1] for sy in [-1,1] for sx in [-1,1]],[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)],material)
    def tube(name,x,z,rings,material=trim):
        v=[];n=24
        for y,r in rings:
            for i in range(n):angle=i*math.tau/n;v.append((x+r*math.cos(angle),y,z+r*math.sin(angle)))
        f=[tuple(reversed(range(n)))]
        for j in range(len(rings)-1):
            for i in range(n):f.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
        f.append(tuple(range((len(rings)-1)*n,len(rings)*n)));return mesh(name,v,f,material,.015)
    def sphere(name,position,scale,material):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=position);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(material);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        for poly in o.data.polygons:poly.use_smooth=True
        objects.append(o);return o
    if key=='regulator_drone':
        sphere('Rounded armored drone core',(0,0,0),(3.9,4.4,1.6),armor)
        loft('Short pointed keel',[(-7,0,.18,-.6,.4),(-3,0,1.7,-1.4,1.4),(3,0,1.6,-1.2,1.5),(5,0,.6,-.4,.6)],dark)
        sphere('Circular red targeting core',(0,-1,1.35),(1.25,1.25,.48),red)
        for s in [-1,1]:
            box('Blocky side pylon',s*4.7,.2,0,2,6.3,1.6)
            tube('Outer pulse tube',s*5.1,-.1,[(-4.9,.18),(2.8,.32)],dark)
        engx,engy,gunx,guny=2.4,4.7,5.1,-5
    elif key=='fast_scout':
        loft('Needle centre',[(-15,0,.08,-.25,.25),(-8,0,1.2,-1,1.1),(2,0,2.1,-1.7,2.1),(11,0,.8,-.8,1.1)],armor)
        for s in [-1,1]:
            blade('Forked attack wing',[(s*.9,-5),(s*6.5,-9),(s*6.9,5),(s*4.3,9),(s*2.4,3)],-.65,.75)
            loft('Outer needle',[(-10,s*6.3,.12,-.3,.2),(-1,s*5.2,.65,-.6,1.2),(10,s*4.6,.75,-.55,1.2)],dark)
            loft('Inner needle',[(-6,s*2.9,.14,.3,.55),(4,s*2.7,.55,.4,1.4),(11.5,s*2.4,.38,.45,1)],armor)
        engx,engy,gunx,guny=4.6,11,6.3,-10.1
    elif key=='fog_raider':
        loft('Long narrow central hull',[(-16,0,.05,-.2,.25),(-6,0,1.2,-1.2,1.6),(4,0,1.7,-1.5,2.1),(13,0,.5,-.4,.7)],armor)
        for s in [-1,1]:
            blade('Slender swept fin',[(s*.8,-8),(s*4.1,1),(s*3.2,9),(s*1.1,5)],-.5,.55,dark)
            tube('Forward lance emitter',s*1.1,.2,[(-9,.12),(-4,.32)],trim)
        engx,engy,gunx,guny=1.25,12.8,1.1,-9.1
    elif key=='rug_fighter':
        loft('Heavy plated core',[(-12,0,.18,-.4,.5),(-5,0,3.5,-1.8,2.5),(6,0,4.2,-2.1,2.7),(12,0,2,-1,1)],armor)
        for s in [-1,1]:
            blade('Forward armored claw',[(s*2,-3),(s*6,-16),(s*8.7,-13),(s*11,2),(s*8,10),(s*4,7)],-1.2,1.9)
            blade('Inset claw rib',[(s*5,-4),(s*7,-12),(s*9,1),(s*7.4,7)],1.93,2.12,dark)
            loft('Claw brow',[(-13,s*7.4,.25,.5,1.7),(-3,s*8,.8,1.7,2.8),(7,s*6.6,.45,1.5,2)],armor)
        engx,engy,gunx,guny=3.4,12.1,6.2,-15.8
    else:
        # New canon support: broad blunt carrier, four pods and visible missile banks.
        loft('Broad pressure hull',[(-20,0,8,-2,2),(-15,0,13,-3.8,3.6),(2,0,15,-4.2,4),(16,0,11,-3,3),(21,0,5,-1.5,1.5)],armor)
        loft('Raised command spine',[(-11,0,3.2,3.5,4.8),(2,0,4.5,3.8,6),(13,0,2.5,2.8,4.5)],dark)
        for s in [-1,1]:
            loft('Outer armored pod',[(-14,s*16,2,-2.5,2.3),(-7,s*17,2.2,-2.8,2.7),(14,s*16,2,-2.5,2.1)],armor)
            for y in [-8,0,8]:
                box('Broadside missile rack',s*11,y,4.3,4.5,4.8,1.5,dark)
                for dx in [-1.1,1.1]:tube('Visible red missile cell',s*11+dx,4.65,[(y-2.44,.42),(y-2.50,.31)],red)
            tube('Secondary engine pod',s*16,0,[(14,1.5),(18,1.4),(18.3,1)],trim);tube('Secondary red throat',s*16,0,[(18.32,.95),(18.4,.95)],red)
        engx,engy,gunx,guny=7,21,10.2,-20.1
    # Functional hardpoints, recessed engines and sparse armored service details.
    for s in [-1,1]:
        tube('Primary engine housing',s*engx,0,[(engy-1.6,.85),(engy,.95),(engy+.45,.7)],trim)
        tube('Recessed engine throat',s*engx,0,[(engy+.47,.61),(engy+.50,.61)],red)
        tube('Gun barrel',s*gunx,.2,[(guny+.9,.26),(guny,.18)],trim)
        for j in range(4):box('Dorsal thermal slit',s*.9,2+j*.55,2.2,.7,.16,.08,dark)
    sphere('Forward sensor',(0,-2,2),( .65,1.4,.35),glass)
    root=bpy.data.objects.new('Enemy_Origin',None);scene.collection.objects.link(root)
    for name,pos in [('Engine_L',(engx,engy+.55,0)),('Engine_R',(-engx,engy+.55,0)),('Muzzle_L',(gunx,guny-.08,.2)),('Muzzle_R',(-gunx,guny-.08,.2))]:
        obj=bpy.data.objects.new(name,None);scene.collection.objects.link(obj);obj.location=pos;obj.parent=root
    for obj in objects:
        uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='Manufacturing UV')
        for poly in obj.data.polygons:
            axis=max(range(3),key=lambda i:abs(poly.normal[i]))
            for index in poly.loop_indices:
                v=obj.matrix_world@obj.data.vertices[obj.data.loops[index].vertex_index].co
                uv.data[index].uv=((v.y,v.z) if axis==0 else (v.x,v.z) if axis==1 else (v.x,v.y));uv.data[index].uv/=5
        obj.parent=root
    # Preserve an editable master before joining the runtime material surfaces.
    bpy.ops.wm.save_as_mainfile(filepath=str(master));groups={}
    for obj in objects:groups.setdefault(obj.data.materials[0].name,[]).append(obj)
    for i,group in enumerate(groups.values()):
        bpy.ops.object.select_all(action='DESELECT')
        for obj in group:obj.select_set(True)
        bpy.context.view_layer.objects.active=group[0]
        if len(group)>1:bpy.ops.object.join()
        bpy.context.object.name=f'{key}_surface_{i}'
    output=target/(key+'.glb');bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
    tris=0
    for o in scene.objects:
        if o.type=='MESH':o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
    reports.append({'key':key,'triangles':tris,'bytes':output.stat().st_size,'surfaces':len(groups)})
    print('ENEMY_BUILT '+json.dumps(reports[-1]))
(folder/'BUILD_REPORT.json').write_text(json.dumps(reports,indent=2))
