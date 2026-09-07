"""Refine idle/locomotion/gesture clips in a new private character master.

Uses the actual shoulder, elbow and wrist chain to lower the original bent
A-pose. Existing geometry, maps, sockets and combat clips are preserved.
Export is an animation source; splice-glb-animations.py retains runtime geometry.
"""
import argparse, json, math, pathlib, sys
import bpy
from mathutils import Vector, Quaternion

p=argparse.ArgumentParser()
for key in ['base','master','output']:p.add_argument('--'+key,required=True)
p.add_argument('--render')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
if pathlib.Path(a.base).resolve()==pathlib.Path(a.master).resolve():raise RuntimeError('Preserve the input master')
for file in [a.master,a.output,a.render]:
    if file:pathlib.Path(file).parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=a.base);scene=bpy.context.scene
rig=next(o for o in scene.objects if o.type=='ARMATURE');rig.data.pose_position='POSE'
selected=[name for name in ['Idle','Walk','Run','Interact'] if name in bpy.data.actions]
rig.animation_data.action=None
for track in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(track)
for action in list(bpy.data.actions):
    if action.name in selected:bpy.data.actions.remove(action)
for pb in rig.pose.bones:pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion();pb.location=(0,0,0);pb.scale=(1,1,1)
bpy.context.view_layer.update()

def aim_chain(name,end,direction):
    bone=rig.pose.bones[name];basis=bone.matrix.to_quaternion()
    current=(rig.pose.bones[end].head-bone.head).normalized()
    delta=current.rotation_difference(Vector(direction).normalized())
    bone.rotation_quaternion=bone.rotation_quaternion @ basis.inverted() @ delta @ basis
    bpy.context.view_layer.update()

relaxed={}
for side,sign in [('.L',1),('.R',-1)]:
    aim_chain('upperarm01'+side,'lowerarm01'+side,(sign*.19,-.015,-.98))
    aim_chain('lowerarm01'+side,'wrist'+side,(sign*.08,-.13,-.985))
    for name in ['upperarm01','lowerarm01']:relaxed[name+side]=rig.pose.bones[name+side].rotation_quaternion.copy()
print('RELAXED_WRISTS '+json.dumps({s:list(rig.pose.bones['wrist'+s].head) for s in ['.L','.R']}))

def world_rotation(name,axis,angle):
    basis=rig.data.bones[name].matrix_local.to_quaternion()
    return basis.inverted() @ Quaternion(Vector(axis),angle) @ basis

animated=['root','spine01','spine03','head']+[n+s for s in ['.L','.R'] for n in ['upperarm01','lowerarm01','upperleg01','lowerleg01','foot','wrist']]
for name in selected:
    duration={'Idle':3.6,'Walk':1.1,'Run':.7,'Interact':3.2}[name];frames=round(duration*30)
    action=bpy.data.actions.new(name);rig.animation_data.action=action;action.use_fake_user=True
    for f in sorted(set(range(0,frames+1,2))|{frames}):
        t=f/frames;phase=t*math.tau
        for pb in rig.pose.bones:pb.rotation_quaternion=relaxed.get(pb.name,Quaternion());pb.location=(0,0,0)
        def rotate(bone,axis,angle):rig.pose.bones[bone].rotation_quaternion=world_rotation(bone,axis,angle)
        rotate('spine01',(1,0,0),.009*math.sin(phase));rotate('head',(0,0,1),.04*math.sin(phase))
        if name in ['Walk','Run']:
            amp=.44 if name=='Walk' else .76
            for side,sign in [('.L',1),('.R',-1)]:
                stride=math.sin(phase)*sign
                rotate('upperleg01'+side,(1,0,0),stride*amp)
                rotate('lowerleg01'+side,(1,0,0),-max(0,-stride)*amp*1.5)
                rotate('foot'+side,(1,0,0),max(0,-stride)*amp*.3)
                rig.pose.bones['upperarm01'+side].rotation_quaternion=world_rotation('upperarm01'+side,(1,0,0),-stride*amp*.65) @ relaxed['upperarm01'+side]
            rig.pose.bones['root'].location.z=abs(math.sin(phase))*(.012 if name=='Walk' else .023)
        elif name=='Interact':
            envelope=math.sin(math.pi*t)**2
            bpy.context.view_layer.update()
            aim_chain('upperarm01.R','lowerarm01.R',(-.18,-.52*envelope,-.98+.3*envelope))
            aim_chain('lowerarm01.R','wrist.R',(-.08,-.13-.83*envelope,-.985+.7*envelope))
            rotate('head',(1,0,0),.06*envelope)
        for bone in animated:
            pb=rig.pose.bones[bone];pb.keyframe_insert('rotation_quaternion',frame=f,group=bone)
            if bone=='root':pb.keyframe_insert('location',frame=f,group=bone)
    for curve in action.fcurves:
        for key in curve.keyframe_points:key.interpolation='LINEAR'
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=a.master)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for obj in scene.objects:
    if obj.parent==rig:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=a.output,export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_def_bones=True,export_skins=True,export_all_influences=False,export_extras=False,export_cameras=False,export_lights=False)
if a.render:
    scene.cycles.samples=20;scene.render.filepath=a.render;bpy.ops.render.render(write_still=True)
print('MOTION_REFINED '+json.dumps({'master':a.master,'clips':selected}))
