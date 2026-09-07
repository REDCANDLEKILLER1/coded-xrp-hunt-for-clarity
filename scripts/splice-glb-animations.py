"""Copy named animation clips onto matching nodes without recompressing art.

The runtime geometry, skin, maps, socket transforms and existing combat clips
remain byte-identical. Unreferenced old animation buffers are removed.
"""
import argparse,copy,json,pathlib,struct
p=argparse.ArgumentParser()
for key in ['runtime','animations','output']:p.add_argument('--'+key,required=True)
p.add_argument('--clips',default='Idle,Walk,Run,Interact');a=p.parse_args()
def read(path):
    data=pathlib.Path(path).read_bytes();size=struct.unpack_from('<I',data,12)[0]
    return json.loads(data[20:20+size]),data[28+size:]
doc,binary=read(a.runtime);source,source_bin=read(a.animations);binary=bytearray(binary)
if pathlib.Path(a.runtime).resolve()==pathlib.Path(a.output).resolve():raise RuntimeError('Preserve input runtime')
nodes={node['name']:i for i,node in enumerate(doc['nodes']) if 'name' in node}
if len(nodes)!=len([n for n in doc['nodes'] if 'name' in n]):raise RuntimeError('Ambiguous runtime node names')
views={};accessors={}
def accessor(index):
    if index in accessors:return accessors[index]
    acc=copy.deepcopy(source['accessors'][index]);view_index=acc['bufferView']
    if acc.get('sparse'):raise RuntimeError('Sparse source requires explicit support')
    if view_index not in views:
        view=copy.deepcopy(source['bufferViews'][view_index]);start=view.get('byteOffset',0);chunk=source_bin[start:start+view['byteLength']]
        binary.extend(b'\0'*((-len(binary))%4));view['byteOffset']=len(binary);view['buffer']=0;binary.extend(chunk)
        views[view_index]=len(doc['bufferViews']);doc['bufferViews'].append(view)
    acc['bufferView']=views[view_index];accessors[index]=len(doc['accessors']);doc['accessors'].append(acc);return accessors[index]
selected=set(a.clips.split(','));updated=[]
for i,old in enumerate(doc['animations']):
    if old['name'] not in selected:continue
    clip=copy.deepcopy(next(c for c in source['animations'] if c['name']==old['name']))
    for channel in clip['channels']:
        name=source['nodes'][channel['target']['node']]['name'];channel['target']['node']=nodes[name]
    for sampler in clip['samplers']:
        for key in ['input','output']:sampler[key]=accessor(sampler[key])
    doc['animations'][i]=clip;updated.append(clip['name'])
used=set()
for mesh in doc['meshes']:
    for primitive in mesh['primitives']:
        used.update(primitive['attributes'].values())
        if 'indices' in primitive:used.add(primitive['indices'])
        for target in primitive.get('targets',[]):used.update(target.values())
for skin in doc['skins']:
    if 'inverseBindMatrices' in skin:used.add(skin['inverseBindMatrices'])
for clip in doc['animations']:
    for sampler in clip['samplers']:used.update([sampler['input'],sampler['output']])
if any(doc['accessors'][i].get('sparse') for i in used):raise RuntimeError('Sparse runtime requires explicit support')
acc_map={old:new for new,old in enumerate(sorted(used))}
for mesh in doc['meshes']:
    for primitive in mesh['primitives']:
        primitive['attributes']={k:acc_map[v] for k,v in primitive['attributes'].items()}
        if 'indices' in primitive:primitive['indices']=acc_map[primitive['indices']]
        for target in primitive.get('targets',[]):
            for k,v in target.items():target[k]=acc_map[v]
for skin in doc['skins']:
    if 'inverseBindMatrices' in skin:skin['inverseBindMatrices']=acc_map[skin['inverseBindMatrices']]
for clip in doc['animations']:
    for sampler in clip['samplers']:
        for k in ['input','output']:sampler[k]=acc_map[sampler[k]]
doc['accessors']=[doc['accessors'][i] for i in sorted(used)]
used_views={acc['bufferView'] for acc in doc['accessors']}|{image['bufferView'] for image in doc['images']}
view_map={old:new for new,old in enumerate(sorted(used_views))};packed=bytearray();new_views=[]
for index in sorted(used_views):
    view=copy.deepcopy(doc['bufferViews'][index]);start=view.get('byteOffset',0)
    packed.extend(b'\0'*((-len(packed))%4));view['byteOffset']=len(packed);packed.extend(binary[start:start+view['byteLength']]);new_views.append(view)
for acc in doc['accessors']:acc['bufferView']=view_map[acc['bufferView']]
for image in doc['images']:image['bufferView']=view_map[image['bufferView']]
doc['bufferViews']=new_views;binary=packed
doc['buffers']=[{'byteLength':len(binary)}];binary.extend(b'\0'*((-len(binary))%4))
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
result=b'glTF'+struct.pack('<II',2,28+len(encoded)+len(binary))+struct.pack('<I',len(encoded))+b'JSON'+encoded+struct.pack('<I',len(binary))+b'BIN\0'+binary
out=pathlib.Path(a.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(result)
print(json.dumps({'runtime_bytes':len(result),'clips':updated,'geometry_skin_maps_preserved':True}))
