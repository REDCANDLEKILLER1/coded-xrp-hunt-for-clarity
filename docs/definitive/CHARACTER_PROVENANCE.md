# XRPMan character foundation

The runtime hero combines MakeHuman's CC0 anatomical mesh, morph targets and rigging data with original XRPMan costume geometry, swept hair, green emblems, baked skin/fabric maps and eight prototype animation clips. The original reference and generated modeling study remain in the private production archive.

Graphical source revision: `a8bc2d54ff0ac92e78ff71431b1023eda42bf482` in [MakeHuman community](https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482). The graphical assets are released under CC0; see its [asset license](https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.ASSETS.md). No MakeHuman application code is bundled. This voluntary attribution distinguishes the reusable anatomy from the original CODED art.

Runtime consumer: `?review=character`, using the same lazy Three.js renderer as Warship review. The model contains 46,725 triangles, ten skinned surfaces, one 163-bone skeleton, three embedded maps (1024 albedo, 1024 normal, 512 roughness), three named attachment nodes and eight clips. Runtime file: 3,597,232 bytes. Redundant rest-transform animation channels were removed while preserving binary geometry, skin weights and image data.

Verified: actual GLTFLoader decoding, normalized four-influence weights, finite skin deformation across each clip, forward firing-hand travel, unique attachments, texture dimensions, canonical 1.9304 m height, and a Blender export/re-import roundtrip retaining all clips/maps/nodes. Browser review checks actual texture rendering and the animation selector. Automated Node texture checks use headers/dimensions, not a claimed full pixel decode.

This is a working character foundation. Animation posing and art can receive further refinement during playable boarding production. It is not evidence that the boarding quest, encounters or campaign are complete.

## Current character updates

XRPMan private master v05 corrects both palm sockets against the actual wrist rig. A validator checks the firing socket against posed skin vertices; geometry counts, maps and eight clips remain unchanged. The v05 runtime export/re-import retains all eight clips, three maps and three sockets.

Mr Zamn uses the same pinned CC0 anatomy/rig sources with the African male target, SHA256 `894abc1fbb3d28543a51fef16f89d5d4bdf9aa2e1534413339811a3d47818b7d`. Original costume work includes heavy blue armor, close-cropped black hair, beard and a blue TruFi shield. Source references and the generated support study remain private. The shared builder supports `--character mr_zamn`; private master v03 and its roundtrip retain three clips, three maps and three sockets. Runtime: 3,435,044 bytes, 43,654 triangles, nine skinned surfaces, one 163-bone skeleton, 1.96 m height. Consumers: `?review=crew` and the physical rescue/hub actor in `?review=boarding`. Conversation cameras were inspected in portrait and landscape. Neither character is claimed as final photorealistic art.
