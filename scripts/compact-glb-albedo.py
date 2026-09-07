"""Compress opaque base color and optionally bound packed roughness dimensions.

Geometry and normal maps remain verbatim. Run on a derivative, never over an
editable source. Requires Pillow.
"""
import argparse,io,json,pathlib,struct
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output',required=True);p.add_argument('--roughness-size',type=int,default=0)
a=p.parse_args();source=pathlib.Path(a.source);target=pathlib.Path(a.output)
if source.resolve()==target.resolve():raise RuntimeError('Preserve the source export')
b=source.read_bytes();size=struct.unpack_from('<I',b,12)[0];doc=json.loads(b[20:20+size]);binary=b[28+size:]
eligible=set();protected=set()
for mat in doc.get('materials',[]):
    base=mat.get('pbrMetallicRoughness',{}).get('baseColorTexture',{}).get('index')
    if base is not None:
        image=doc['textures'][base]['source']
        (eligible if mat.get('alphaMode','OPAQUE')=='OPAQUE' else protected).add(image)
    for entry in [mat.get('normalTexture'),mat.get('occlusionTexture'),mat.get('pbrMetallicRoughness',{}).get('metallicRoughnessTexture')]:
        if entry:protected.add(doc['textures'][entry['index']]['source'])
replacements={};albedo_count=0;roughness_count=0
for index in eligible-protected:
    im=doc['images'][index];v=doc['bufferViews'][im['bufferView']];raw=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
    pixels=Image.open(io.BytesIO(raw));out=io.BytesIO();pixels.convert('RGB').save(out,'JPEG',quality=92,subsampling=0,optimize=True)
    if len(out.getvalue())<len(raw):replacements[im['bufferView']]=out.getvalue();im['mimeType']='image/jpeg';albedo_count+=1
if a.roughness_size:
    if not 128<=a.roughness_size<=2048:raise RuntimeError('Roughness size must be 128..2048')
    data_images={doc['textures'][m['pbrMetallicRoughness']['metallicRoughnessTexture']['index']]['source'] for m in doc.get('materials',[]) if 'metallicRoughnessTexture' in m.get('pbrMetallicRoughness',{})}
    for index in data_images:
        im=doc['images'][index];v=doc['bufferViews'][im['bufferView']];raw=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']];pixels=Image.open(io.BytesIO(raw))
        if max(pixels.size)<=a.roughness_size:continue
        # Preserve the packed RGB channels. Data maps are not converted to JPEG
        # or grayscale; the smaller map bounds NPC transfer and texture memory.
        pixels.thumbnail((a.roughness_size,a.roughness_size),Image.Resampling.LANCZOS);out=io.BytesIO();pixels.save(out,'PNG',optimize=True);replacements[im['bufferView']]=out.getvalue();im['mimeType']='image/png';roughness_count+=1
chunks=bytearray()
for index,v in enumerate(doc['bufferViews']):
    raw=replacements.get(index,binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])
    chunks+=b'\0'*((-len(chunks))%4);v['byteOffset']=len(chunks);v['byteLength']=len(raw);chunks+=raw
doc['buffers'][0]['byteLength']=len(chunks);chunks+=b'\0'*((-len(chunks))%4)
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
result=b'glTF'+struct.pack('<II',2,28+len(j)+len(chunks))+struct.pack('<I',len(j))+b'JSON'+j+struct.pack('<I',len(chunks))+b'BIN\0'+chunks
target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(result)
print(json.dumps({'source_bytes':len(b),'runtime_bytes':len(result),'compressed_opaque_albedos':albedo_count,'smaller_packed_roughness_maps':roughness_count}))
