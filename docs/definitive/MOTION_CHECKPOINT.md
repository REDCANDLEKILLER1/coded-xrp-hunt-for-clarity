# Conversation and character motion checkpoint

Follow-up to Mars relief commit24417d0. All three characters now use a relaxed anatomical arm pose and a deliberate interaction gesture. XRPMan's walking/running arm swing uses that stance. Existing firing, damage, dodge and knockdown clips remain unchanged.

The motion builder opens an existing private master and saves a new version. `refine-character-motion.py` targets the actual shoulder/elbow/wrist chains; `splice-glb-animations.py` transfers only the selected clips and removes unused animation buffers. An independent semantic comparison verified unchanged node/socket transforms, every geometry/skin buffer, every embedded image and every retained combat clip before the runtime files were replaced. Evidence: parent definitive-authorization/motion-preservation-report.json.

| Runtime | Bytes | Triangles | Private master |
|---|---:|---:|---|
| XRPMan | 3,062,212 | 46,725 | xrpman_master_v06.blend |
| Corn | 4,724,576 | 43,681 | corn_master_v03.blend; runtime v04 |
| Mr Zamn | 3,237,384 | 43,654 | mr_zamn_master_v04.blend |
| Mars relief | 2,219,192 | 31,264 | worlds/mars/relief_v03 |

Character geometry/maps are unchanged; removing unreferenced animation data saves930,368bytes across the three characters. Mars machinery now uses split normals on flat cylinder caps, and restored crop trays have actual leaf/stem geometry with green service rails. All earlier private masters remain available. No raw source or private review image is published.

Corn remains a provisional original interpretation of the approved written identity, not a recovered canon sheet. TruFi and Blue Umbrella remain allies: preserve recognizable blue/blue-gold uniforms, with #00FF00 energy/friendly cues. Red marks hostile controls and fire. These models remain subject to further art refinement; this checkpoint is not a claim of final photorealism.

Mars conversations fit the two physical actors into the visible space above portrait dialogue or beside landscape dialogue. Actor positions remain unchanged. Combat, projectiles, repair cooldown and movement hold while conversation is open. The gameplay camera and fresh controls restore after a normal close or after a blur/pause. Nearby actors turn toward each other; Corn plays the new gesture. Remote COMMS retains the ordinary camera when the physical actors are far apart.

Verification:

- All50 validators pass; the hero validator checks actual idle palms at thigh height as well as firing-hand contact and all skin/clip deformation. Mars adds20 aspect/approach framing combinations, projectile/enemy/cooldown holds and blurred-close restoration. Its four targeted contract mutations still fail as expected.
- Exact runtime files pass Blender import/export/re-import: hero8clips/3maps/3sockets, Corn3/6/3, Mr Zamn3/3/3. Roundtrip logs are local.
- Actual browser scene tested at390x844,844x390,360x740,1024x768 with held keys, orientation, fresh movement and blurred-close/resume. No page errors or injected campaign grants. Evidence: mars-conversation-report.json and own-game images.
- Production build passes: initial292.85kB/86.65gzip; deferred3D770.07kB/203.44gzip. Mars model set11,082,856bytes plus900,000 reserved renderer bytes stays below12MiB. Existing large deferred-chunk advisory remains.
- Clean npm ci passed immediately before the Mars checkpoint; package/dependency/lock files have not changed during this follow-up. No new dependency installation.
- The earlier600.47second soak applies to the preceding rendering workload. This follow-up changes pose tracks and adds2,736 terrain triangles; it received fresh runtime/rig/framing checks, not another claimed ten-minute soak. Physical handset acceptance remains outstanding.

Next: finish Mars's excavation-route and Margin Warden encounter, connect its restoration payoff and forward route, then proceed through the approved campaign. No merge or release.
