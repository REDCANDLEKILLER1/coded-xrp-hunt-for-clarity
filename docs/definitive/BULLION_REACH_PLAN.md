# Bullion Reach — production design for the next connected chapter

Under approved MASTER_PLAN section 13. Implemented and tested in the September 8 review candidate; this document preserves the design intent. Current evidence and limits are in CHAPTER_ONE_PLAYTEST_CHECKPOINT.md.

## Purpose and canon

The restored Fog relays trace seized freight to Bullion Reach. Its fractured gold industrial landscape supports an armored relief convoy; stopping extraction is not enough unless supplies reach the people. LEX / Stake N Bake is one character, a TruFi ally, bald and bearded with glasses, medallion and black/gunmetal segmented armor with cobalt TruFi details. Preserve these written constraints and inspect any actually available source before modeling; do not claim an unavailable PNG was recovered. Original provisional support art and masters remain private. Neon #00FF00 marks friendly systems, blue remains TruFi identity, red marks hostile force and incoming danger.

LEX should be a distinct command/logistics figure, not recolored Mr Zamn. Use the established anatomical/animation pipeline with original head, glasses, beard, posture and uniform. Minimum idle, walk and interact clips with stable hand/prop sockets. Surface originals: gold-bearing fractured rock, real freight infrastructure, two convoy vehicles and a mobile Market Siege Engine. Generated material images can be embedded in optimized runtime GLBs only when actually consumed.

## Route and travel

Expand route data, not a second SpaceScene. Fog Moon → Bullion Reach has a new globe, two finite bomber-lane interceptions and an armored convoy interception payoff. Keep all four muzzles, inherited ship damage/shields, swept shots/collision and the existing finger-drag controls. First arrival requires real travel, briefing and range-gated selected-fighter descent.

Add a guarded route table for implemented destinations. Before further world expansion, correct the map's action labels so selecting Mars cannot misleadingly say FLY TO MARS while it actually continues Fog Moon. First visits need the authored route; a discovered legacy map key cannot bypass a rebuilt chapter. Offer explicitly labeled return travel to previously reached rebuilt orbits from a safe owned-ship boundary. Construct the destination before committing; carry actual hull/shields, retain progress and grant no replay rewards. Do not replay a completed wave under an already-claimed receipt and strand the route. Revisited surfaces retain their rewards and offer the appropriate return point. Both later branches must remain selectable, without erasing the other branch.

## Surface strategy

Start at a freight apron with the selected fighter. A finite patrol pins LEX beside two relief haulers. Clear the approach and meet him physically. He explains that the haulers need a public freight corridor, while the siege engine stamps every route as seized.

The central mission is a convoy escort through two junctions. The player chooses a short exposed lane or a longer covered service lane at the first junction; the second decision redirects a moving bombardment scanner. Choices alter actual paths and threat positions. Convoy movement waits at signposted junctions, stops for a nearby active blockade and resumes when the player clears it. Vehicles have real collision and damage, no hidden untouchable escort bar. A knocked-out convoy has a short local retry, not an entire planet reset. Route checkpoints preserve completed junctions but do not magically award an undelivered convoy. On death/load recovery, reconstruct valid cover, guards, convoy position and cargo state together.

Earlier abilities remain useful: Reveal traces the actual bomber warning source; Dash crosses a threatened lane; Field Repair supports bounded nearby convoy recovery with a displayed cooldown. Shield protects the hero, without silently making the convoy invulnerable. Avoid an ever-growing wall of mobile buttons: show a nearby convoy repair choice through INTERACT while retaining the existing core action layout.

## Market Siege Engine

An armored moving siege machine blocks the freight exit. Its actual broadside mortar arrays and exposed rear routing control define counterplay; do not duplicate the stationary Citadel's three-feed puzzle or Warden's simultaneous tower mechanic. Telegraph a committed strip bombardment before it lands. Firing its broadside and repositioning exposes the rear control for a bounded window. Player movement, cover and the earlier Reveal ability help identify the safe flank. Actual model anchors own mortar starts and elevated weakpoint hits; ground XZ overlap alone cannot damage them. Keep finite hazard budgets and readable red tells in portrait.

Boss victory opens the exit. Completion requires the convoy physically reaching it, then an atomic restoration/recruitment/payoff. Failed storage holds the completed encounter safely for Retry. LEX joins as logistics support, unlocks a bounded repair/shop service on the owned ship, and points to both Rugfall and SEC Outpost. Keep fighter, hero and capital upgrades separate. Add at least one logistics upgrade with an actual consumer and a clear cost; no infinite currency or reward-on-revisit loop.

## Story anchors

- LEX: "The cargo is here. The people are waiting. Every route between them has a seizure stamp."
- XRPMan: "Then we take the route back with the cargo on it."
- LEX: "I can move these haulers. You keep their guns looking somewhere else."
- Siege Engine: "Unscheduled delivery detected. Public distribution is suspended."
- LEX after delivery: "There. Repairs, food, power cells. A balance sheet that actually reaches somebody."
- Boo: "Two more signatures. One is hiding evidence. The other is hiding the people who can broadcast it."

Author full short conversations and persistent replay receipts before calling the story complete. Conversation transitions clear all held controls and pause threats.

## Evidence and acceptance

Real original Blender assets, embedded material provenance, required clips/nodes, GLB roundtrips, manifest consumers and per-scene <=12MiB budget. Behavioral route/revisit, convoy/choice/repair/checkpoint, flank/height collision, modal/input, failure/retry and reward-deduplication tests with useful deliberate failure controls. Play the original earned save from Fog Moon through the entire route/convoy/boss/recruitment and return; no completion or HP injection. Separate fixtures cover optional choices, death and failure. Native multi-touch and four layouts; full/low render costs and lifecycle soak. Run clean build gates, secure the working branch, verify exact-head draft preview and continue the approved campaign. Further visual polish and physical-device acceptance stay explicit; no merge or release.
