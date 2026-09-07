"""Blender boarding derivatives of the three existing player hull identities.

Meters, Z up / -Y nose in the master; +Y up / +Z nose in GLB.
Supplied top views constrain the hulls. Unseen surfaces are original support work.
Private .blend masters and review renders are saved separately from runtime GLBs.
"""
import argparse,json,math,pathlib,sys
import bpy,bmesh
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--directory',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);base=pathlib.Path(a.directory)
base.mkdir(parents=True,exist_ok=True)
for ship in ['player','xrpl_striker','ledger_warden']:
    folder=base/ship;folder.mkdir(parents=True,exist_ok=True)
    master=folder/(ship+'_master.blend')
    if master.exists():raise RuntimeError('Use a new version directory; preserve existing masters')
    bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.resolution_x=1100;scene.render.resolution_y=850;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='Standard'
    scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.04,.065,.10,1)
    objects=[];canopy=[]
    def mat(name,color,metal=0,rough=.5,glow=0):
        m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
        b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough
        if glow:b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=glow
        return m
    hull=mat('Fighter graphite',(.018,.028,.035),.62,.46)
    armor=mat('Fighter armor planes',(.047,.065,.071),.55,.41)
    trim=mat('Brushed titanium',(.16,.205,.22),.72,.39)
    glass=mat('Canopy blue glass',(.008,.055,.095),.64,.16)
    green=mat('Liquidity #00FF00',(0,1,0),.1,.4,.8)
    blue=mat('Canonical blue accents',(.005,.24,.8),.2,.4,.45)
    def mesh(name,vertices,faces,material,bevel=0,parent_list=None):
        data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.materials.append(material);data.update()
        bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(data);bm.free()
        obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj)
        if bevel:
            bpy.context.view_layer.objects.active=obj
            mod=obj.modifiers.new('Machined corners','BEVEL');mod.width=bevel;mod.segments=2
            bpy.ops.object.modifier_apply(modifier=mod.name)
        (objects if parent_list is None else parent_list).append(obj);return obj
    def loft(name,sections,material,bevel=.025,target=None):
        v=[]
        for y,x,w,lo,hi in sections:
            mid=(lo+hi)/2
            v.extend([(x-w*.62,y,lo),(x+w*.62,y,lo),(x+w,y,mid),(x+w*.72,y,hi),(x,y,hi+.03),(x-w*.72,y,hi),(x-w,y,mid)])
        n=7;f=[tuple(reversed(range(n)))]
        for j in range(len(sections)-1):
            for k in range(n):f.append((j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k))
        f.append(tuple(range((len(sections)-1)*n,len(sections)*n)))
        return mesh(name,v,f,material,bevel,target)
    def blade(name,points,lo,hi,material):
        n=len(points);v=[(x,y,z) for z in [lo,hi] for x,y in points]
        f=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        return mesh(name,v,f,material,.025)
    def cube(name,position,size,material,bevel=.02):
        x,y,z=position;w,d,h=[s/2 for s in size]
        return mesh(name,[(x+sx*w,y+sy*d,z+sz*h) for sz in [-1,1] for sy in [-1,1] for sx in [-1,1]],[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)],material,bevel)
    def tube(name,x,z,rings,material):
        v=[];n=20
        for y,r in rings:
            for i in range(n):a=i*math.tau/n;v.append((x+math.cos(a)*r,y,z+math.sin(a)*r))
        f=[tuple(reversed(range(n)))]
        for j in range(len(rings)-1):
            for i in range(n):f.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
        f.append(tuple(range((len(rings)-1)*n,len(rings)*n)));return mesh(name,v,f,material,.008)
    def node(name,position):
        obj=bpy.data.objects.new(name,None);scene.collection.objects.link(obj);obj.location=position;return obj
    breadth={'player':1,'xrpl_striker':.92,'ledger_warden':1.08}[ship]
    loft('Pointed central hull',[(-4.5,0,.025,.44,.5),(-3.35,0,.32,.25,.65),(-1.6,0,.65*breadth,.07,.87),(.4,0,.93*breadth,.0,.98),(2.65,0,.7*breadth,.08,.76),(3.8,0,.28,.2,.51)],hull)
    loft('Dorsal keel',[(-3.7,0,.035,.54,.68),(-2.1,0,.18,.77,.93),(.5,0,.18,.86,1.04),(3.25,0,.1,.65,.80)],armor)
    wing_shapes={
        'player':[(.55,-1.1),(1.75,.25),(3.2,2.55),(3.15,3.75),(1.3,2.15),(.6,2.5)],
        'xrpl_striker':[(.65,-1.5),(1.8,-.1),(1.65,1),(3.0,2.7),(2.85,3.5),(1.15,2.3),(.7,2.9)],
        'ledger_warden':[(.55,-1.1),(1.85,-.3),(2.0,1),(3.5,2.35),(3.4,3.55),(1.35,2.2),(.7,3)]}
    for s,label in [(-1,'R'),(1,'L')]:
        wing=[(s*x,y) for x,y in wing_shapes[ship]]
        blade('Swept wing '+label,wing,.17,.45,armor)
        inner=[(s*(.72+(x-.72)*.79),y+.07) for x,y in wing_shapes[ship]]
        blade('Wing inset '+label,inner,.455,.49,hull)
        path=wing_shapes[ship][1:4]
        for i in range(len(path)-1):
            (x1,y1),(x2,y2)=path[i:i+2]
            blade('Wing liquidity conduit '+label,[(s*x1,y1),(s*x2,y2),(s*(x2-.052),y2),(s*(x1-.052),y1)],.5,.53,blue if ship=='ledger_warden' else green)
        loft('Weapon boom '+label,[(-1.8,s*1.09,.07,.44,.6),(-.4,s*1.1,.16,.30,.74),(2.6,s*.9,.15,.30,.64)],hull)
        tube('Gun muzzle '+label,s*1.09,.53,[(-1.8,.07),(-2.15,.055)],trim)
        tube('Engine housing '+label,s*.74,.42,[(2.55,.29),(3.50,.39),(4.15,.30),(4.23,.23)],trim)
        tube('Engine recessed throat '+label,s*.74,.42,[(4.235,.224),(4.255,.224)],blue)
        tube('Engine liquidity core '+label,s*.74,.42,[(4.257,.12),(4.267,.12)],green)
        for j in range(4):cube('Heat vent '+label,(s*.79,1.0+j*.29,1.01),(.21,.1,.045),trim,.006)
        # Three feet support the parked craft, while the pilot exits ahead of the wings.
        cube('Aft landing strut '+label,(s*.85,2.5,-.14),(.13,.18,.55),trim)
        cube('Aft landing foot '+label,(s*.85,2.5,-.46),(.45,.55,.09),hull)
    cube('Forward landing strut',(0,-2.55,-.04),(.15,.18,.75),trim)
    cube('Forward landing foot',(0,-2.55,-.46),(.44,.6,.09),hull)
    # Recessed canopy and its opening pivot are independent runtime parts.
    loft('Canopy support',[(-2.7,0,.18,.77,.9),(-2.2,0,.42,.78,1.05),(-.7,0,.4,.91,1.15),(-.2,0,.18,.9,1.07)],trim,.018)
    loft('Pilot canopy',[(-2.68,0,.14,.92,.99),(-2.15,0,.34,1.0,1.40),(-.73,0,.32,1.08,1.47),(-.25,0,.1,1.06,1.14)],glass,.022,canopy)
    loft('Canopy center brace',[(-2.66,0,.025,.99,1.04),(-2.15,0,.035,1.40,1.45),(-.73,0,.035,1.47,1.51),(-.26,0,.025,1.14,1.18)],armor,.006,canopy)
    # Source-recognizable central green X core, authored geometry rather than a decal.
    for s in [-1,1]:
        blade('Central X',[(s*-.17,.54),(s*-.11,.5),(s*.2,1.12),(s*.13,1.16)],1.035,1.054,green)
    root=node('Fighter_Origin',(0,0,0))
    for name,position in [('Engine_L',(.74,4.28,.42)),('Engine_R',(-.74,4.28,.42)),('Pilot_Seat',(0,-1.25,.72)),('Pilot_Exit',(1.7,-2.5,-.5)),('Muzzle_L',(1.09,-2.16,.53)),('Muzzle_R',(-1.09,-2.16,.53))]:node(name,position).parent=root
    hinge=node('Canopy_Hinge',(0,-.15,1.02));hinge.parent=root
    for obj in objects:obj.parent=root
    for obj in canopy:
        obj.parent=hinge
        for v in obj.data.vertices:v.co-=hinge.location
    for name,location,power,size in [('Key',(-6,-8,11),1600,7),('Fill',(8,-2,6),900,5),('Rim',(2,8,8),1400,5)]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.size=size
        obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=location;obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
    camera_data=bpy.data.cameras.new('Review');camera=bpy.data.objects.new('Review',camera_data);scene.collection.objects.link(camera)
    camera.location=(8,-11,10);camera.rotation_euler=(Vector((0,0,.4))-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=12;scene.camera=camera
    bpy.ops.wm.save_as_mainfile(filepath=str(master))
    # Merge by material and transform parent; retain named pivots and sockets.
    groups={}
    for obj in objects+canopy:groups.setdefault((obj.parent.name,obj.data.materials[0].name),[]).append(obj)
    exported=[]
    for index,group in enumerate(groups.values()):
        bpy.ops.object.select_all(action='DESELECT')
        for obj in group:obj.select_set(True)
        bpy.context.view_layer.objects.active=group[0]
        if len(group)>1:bpy.ops.object.join()
        obj=bpy.context.object;obj.name=f'{ship}_surface_{index}';exported.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [root,*root.children_recursive]:obj.select_set(True)
    output=folder/(ship+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
    scene.render.filepath=str(folder/(ship+'_review.png'));bpy.ops.render.render(write_still=True)
    triangles=0
    for obj in exported:obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
    print('FIGHTER_BUILT '+json.dumps({'ship':ship,'bytes':output.stat().st_size,'triangles':triangles,'surfaces':len(exported)}))
