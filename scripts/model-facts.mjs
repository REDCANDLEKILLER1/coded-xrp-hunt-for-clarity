// Structural facts about a runtime GLB, read straight from the container.
//
// Shared by the provenance recorder and the provenance gate so that the numbers
// written into the baseline and the numbers checked against it can never be
// computed two slightly different ways.
//
// "anchors" are the named nodes the runtime resolves by name -- muzzles, seats,
// room origins, boss targets. Skin joints are excluded deliberately: a rigged
// character carries 163 of them, and they are skeleton, not contract. What is
// left is exactly the set `getObjectByName` is called with.

import { createHash } from 'node:crypto';

/** The JSON chunk of a binary glTF, with the container itself checked. */
export function readDocument(bytes, label = 'model') {
  if (bytes.length < 20) throw new Error(`${label}: too short to be a GLB`);
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error(`${label}: missing glTF magic`);
  if (bytes.readUInt32LE(4) !== 2) throw new Error(`${label}: not glTF 2.0`);
  if (bytes.readUInt32LE(8) !== bytes.length) throw new Error(`${label}: declared length ${bytes.readUInt32LE(8)} but file holds ${bytes.length}`);
  const jsonLength = bytes.readUInt32LE(12);
  if (20 + jsonLength > bytes.length) throw new Error(`${label}: JSON chunk overruns the file`);
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
}

/** Triangles actually drawn: indexed primitives count their indices, the rest their positions. */
function triangles(doc) {
  let total = 0;
  for (const mesh of doc.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if ((primitive.mode ?? 4) !== 4) continue;
      const accessor = doc.accessors[primitive.indices ?? primitive.attributes.POSITION];
      total += Math.floor(accessor.count / 3);
    }
  }
  return total;
}

export function modelFacts(bytes, label = 'model') {
  const doc = readDocument(bytes, label);
  const joints = new Set((doc.skins ?? []).flatMap((skin) => skin.joints ?? []));
  const nodes = doc.nodes ?? [];
  return {
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    triangles: triangles(doc),
    // The ledger calls this materialGroups: one draw group per primitive.
    materialGroups: (doc.meshes ?? []).reduce((sum, mesh) => sum + (mesh.primitives?.length ?? 0), 0),
    materials: (doc.materials ?? []).length,
    images: (doc.images ?? []).length,
    bones: joints.size,
    animations: (doc.animations ?? []).map((clip) => clip.name).sort(),
    anchors: nodes
      .map((node, index) => ({ node, index }))
      .filter(({ node, index }) => node.name && node.mesh === undefined && !joints.has(index))
      .map(({ node }) => node.name)
      .sort(),
    externalBuffers: (doc.buffers ?? []).filter((buffer) => buffer.uri).length,
    externalImages: (doc.images ?? []).filter((image) => image.uri).length,
  };
}
