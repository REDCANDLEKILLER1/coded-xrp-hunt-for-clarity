"""Remove exported animation channels that exactly restate the node's rest transform.

Only redundant rest tracks are removed: constant posed tracks must remain. Binary
geometry, skin weights and embedded images are preserved byte for byte.
"""
import argparse
import json
import pathlib
import struct

p=argparse.ArgumentParser()
p.add_argument('--source',required=True)
p.add_argument('--output',required=True)
args=p.parse_args()
source=pathlib.Path(args.source); target=pathlib.Path(args.output)
if source.resolve()==target.resolve(): raise RuntimeError('Keep the source export intact')
b=source.read_bytes()
assert b[:4]==b'glTF' and struct.unpack_from('<I',b,4)[0]==2
size=struct.unpack_from('<I',b,12)[0]
doc=json.loads(b[20:20+size]); tail=b[20+size:]
assert tail[4:8]==b'BIN\0'
binary=tail[8:]
def values(index):
    acc=doc['accessors'][index]
    if acc['componentType']!=5126 or 'sparse' in acc: return []
    view=doc['bufferViews'][acc['bufferView']]
    width={'VEC3':3,'VEC4':4}[acc['type']]
    stride=view.get('byteStride',width*4)
    start=view.get('byteOffset',0)+acc.get('byteOffset',0)
    return [struct.unpack_from('<'+'f'*width,binary,start+i*stride) for i in range(acc['count'])]
removed=0
for animation in doc['animations']:
    kept=[]
    for channel in animation['channels']:
        target_node=channel['target']; path=target_node['path']
        if path not in ['translation','rotation','scale']:
            kept.append(channel); continue
        default={'translation':[0,0,0],'rotation':[0,0,0,1],'scale':[1,1,1]}[path]
        rest=doc['nodes'][target_node['node']].get(path,default)
        samples=values(animation['samplers'][channel['sampler']]['output'])
        def matches(v):
            direct=max(abs(a-c) for a,c in zip(v,rest))<.000001
            inverse=path=='rotation' and max(abs(a+c) for a,c in zip(v,rest))<.000001
            return direct or inverse
        if samples and all(matches(v) for v in samples): removed+=1
        else: kept.append(channel)
    used=sorted({c['sampler'] for c in kept}); remap={old:new for new,old in enumerate(used)}
    animation['samplers']=[animation['samplers'][i] for i in used]
    for c in kept: c['sampler']=remap[c['sampler']]
    animation['channels']=kept
encoded=json.dumps(doc,separators=(',',':')).encode(); encoded+=b' '*((-len(encoded))%4)
result=b'glTF'+struct.pack('<II',2,20+len(encoded)+len(tail))+struct.pack('<I',len(encoded))+b'JSON'+encoded+tail
target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(result)
print(json.dumps({'source_bytes':len(b),'runtime_bytes':len(result),'removed_rest_channels':removed,'clips':{a['name']:len(a['channels']) for a in doc['animations']}}))
