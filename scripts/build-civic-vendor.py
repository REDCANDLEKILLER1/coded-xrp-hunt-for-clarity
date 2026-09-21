"""Proof-of-budget vendor NPC: original stylised geometry on the cast's own rig.

Adapted from Claude f3baab9. Original compact civilian mesh; runtime clones
share geometry while using independent skeletons and vendor uniform colours.

Rig compatibility is *derived*, not asserted. Matching bone names is not enough:
the cast's animated bones are separated by intermediates (pelvis, upperleg02,
clavicle, neck01-03), and a local rotation applied over a different hierarchy or
rest pose lands somewhere else. So this imports the shipped xrpman.glb, throws
away its mesh, prunes the armature to the bones Idle/Walk/Run actually drive plus
every ancestor needed to compose them, and skins original geometry to what is
left. The rest pose, hierarchy and axes are therefore identical by construction.

The vendor carries no animation of its own. Idle/Walk/Run are borrowed from the
already-loaded cast at runtime, which is why this stays small.

  blender --background --python scripts/build-vendor-npc.py -- --directory out/

Original geometry, built from primitives here. No third-party art.
"""
import argparse, json, pathlib, sys
import bpy
from mathutils import Vector

p = argparse.ArgumentParser()
p.add_argument('--directory', required=True)
p.add_argument('--source', default='public/assets/models/xrpman.glb')
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
folder = pathlib.Path(a.directory); folder.mkdir(parents=True, exist_ok=True)
master = folder / 'vendor_npc_master.blend'
if master.exists(): raise RuntimeError('Use a new version directory; preserve existing masters')

# Bones Idle/Walk/Run drive. Ancestors are added automatically below.
DRIVEN = {'root','spine01','spine03','head','upperarm01.L','upperarm01.R','lowerarm01.L','lowerarm01.R',
          'wrist.L','wrist.R','upperleg01.L','upperleg01.R','lowerleg01.L','lowerleg01.R','foot.L','foot.R'}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.source)

armature = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    bpy.data.objects.remove(o, do_unlink=True)

# Keep every driven bone and every ancestor, so local rotations compose identically.
keep = set()
for name in DRIVEN:
    bone = armature.data.bones.get(name)
    if bone is None: raise RuntimeError(f'source rig has no bone {name}')
    while bone is not None:
        keep.add(bone.name); bone = bone.parent
print(f'VENDOR_RIG keeping {len(keep)} of {len(armature.data.bones)} bones')

bpy.context.view_layer.objects.active = armature
bpy.ops.object.mode_set(mode='EDIT')
for eb in [b for b in armature.data.edit_bones if b.name not in keep]:
    armature.data.edit_bones.remove(eb)
rest = {b.name: (b.head.copy(), b.tail.copy()) for b in armature.data.edit_bones}
bpy.ops.object.mode_set(mode='OBJECT')
armature.name = 'Vendor_Rig'; armature.data.name = 'Vendor_Rig'
armature.animation_data_clear()
for pb in armature.pose.bones:
    pb.location=(0,0,0);pb.rotation_mode="QUATERNION";pb.rotation_quaternion=(1,0,0,0);pb.scale=(1,1,1)
bpy.context.view_layer.update()
for action in list(bpy.data.actions): bpy.data.actions.remove(action)

def material(name, colour, rough=.72, metal=.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*colour, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m

# Three materials only: the district's draw-surface budget is the scarce resource.
cloth = material('Vendor trade cloth', (.16, .22, .30))
skin  = material('Vendor complexion', (.44, .32, .26))
trim  = material('Vendor ledger trim', (.62, .48, .16), .45, .6)

parts = []
def box(name, centre, size, mat, bone):
    """One rigidly-bound box. Rigid binding keeps weights at one per vertex."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=centre)
    o = bpy.context.active_object; o.name = name
    o.scale = Vector(size)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    bevel=o.modifiers.new('Tailored edges','BEVEL');bevel.width=.018;bevel.segments=2
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=bevel.name)
    parts.append((o, bone))
    return o

def limb(name, bone, thickness, mat):
    head, tail = rest[bone]
    successors={'upperarm01':'lowerarm01','lowerarm01':'wrist','upperleg01':'lowerleg01','lowerleg01':'foot'}
    stem,side=bone.split('.')
    if stem in successors:tail=rest[successors[stem]+'.'+side][0]
    centre = (head + tail) / 2
    length = (tail - head).length
    o = box(name, centre, (thickness, thickness, length), mat, bone)
    # Point the box down the bone so it deforms along it.
    direction = (tail - head).normalized()
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = direction.to_track_quat('Z', 'Y')
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
    return o

hip = rest['root'][0]
torso_top = rest['spine01'][1]
box('Vendor torso', (hip + torso_top) / 2, (.34, .21, (torso_top - hip).length * 1.02), cloth, 'spine01')
box('Vendor apron', ((hip + torso_top) / 2) - Vector((0, .12, .06)), (.31, .06, .30), trim, 'spine01')
head_head, head_tail = rest['head']
head_centre=(head_head+head_tail)/2
# Original rounded facial forms and workwear details.
def ellipsoid(name, centre, size, mat, bone):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=centre)
    o=bpy.context.object;o.name=name;o.scale=Vector(size)/2
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
    for f in o.data.polygons:f.use_smooth=True
    parts.append((o,bone));return o
ellipsoid('Vendor face',head_centre,(.19,.19,.24),skin,'head')
ellipsoid('Close cropped hair',head_centre+Vector((0,.012,.085)),(.197,.19,.09),cloth,'head')
box('Safety glasses',head_centre+Vector((0,-.092,.018)),(.17,.025,.033),trim,'head')
ellipsoid('Nose',head_centre+Vector((0,-.103,-.015)),(.04,.06,.055),skin,'head')
box('Utility belt',hip+Vector((0,0,.04)),(.34,.23,.05),trim,'root')
for side in 'LR':
    limb(f'Vendor upper arm {side}', f'upperarm01.{side}', .09, cloth)
    limb(f'Vendor forearm {side}', f'lowerarm01.{side}', .075, skin)
    limb(f'Vendor thigh {side}', f'upperleg01.{side}', .12, cloth)
    limb(f'Vendor shin {side}', f'lowerleg01.{side}', .10, cloth)
    limb(f'Vendor foot {side}', f'foot.{side}', .09, trim)

# Merge by material so the vendor costs three draw surfaces, not fifteen.
for o, bone in parts:
    group = o.vertex_groups.new(name=bone)
    group.add(range(len(o.data.vertices)), 1.0, 'REPLACE')
    modifier = o.modifiers.new('Armature', 'ARMATURE'); modifier.object = armature
    o.parent = armature

bpy.ops.object.select_all(action='DESELECT')
for o, _ in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0][0]
bpy.ops.object.join()
vendor = bpy.context.active_object; vendor.name = 'Vendor_Body'; vendor.data.name = 'Vendor_Body'

bpy.ops.object.select_all(action='DESELECT')
vendor.select_set(True); armature.select_set(True)
bpy.context.view_layer.objects.active = armature

target = folder / 'civic_vendor.glb'
bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True,
                          export_animations=False, export_cameras=False, export_lights=False,
                          export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=str(master))

data = target.read_bytes()
import struct as _s
doc = json.loads(data[20:20 + _s.unpack_from('<I', data, 12)[0]])
tris = sum(doc['accessors'][pr.get('indices', pr['attributes']['POSITION'])]['count'] // 3
           for m in doc.get('meshes', []) for pr in m.get('primitives', []) if pr.get('mode', 4) == 4)
print('VENDOR_NPC_BUILT ' + json.dumps({
    'bytes': len(data), 'triangles': tris,
    'primitives': sum(len(m.get('primitives', [])) for m in doc.get('meshes', [])),
    'materials': len(doc.get('materials', [])), 'images': len(doc.get('images', [])),
    'bones': sum(len(s.get('joints', [])) for s in doc.get('skins', [])),
    'animations': [c.get('name') for c in doc.get('animations', [])],
}))
