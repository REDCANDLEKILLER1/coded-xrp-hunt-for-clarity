# Mars excavation encounter — implementation design

Approved scope: Master Plan section13, following the internally verified Earth-to-Mars opening and relief site. Working title Margin Warden remains the new Mars boss. This is a plan for the next reversible implementation, not a completion claim.

The relief site opens its north exit after Corn's three-pump quest. XRPMan follows a short mining service route on foot, defeats a finite seizure patrol, reaches a saved safe boundary and confronts a physical excavation carrier. One existing WebGL renderer owns both locations. Loading failure retains the relief scene/save; entering the route saves only after construction succeeds. The player can return to Corn. The selected fighter remains at the relief site.

The carrier is approximately26m long,20m wide,9m high with four tracked bogies, angular red/charcoal armor, a cutting boom, mining laser and a green public-energy core held behind red control hardware. This is an original asset; its generated support sheet is private and is not presented as recovered canon. Runtime derives from a Blender master and has explicit pylon/core/muzzle/cutter nodes.

Fight: two red supply pylons feed an otherwise protected central control ring. Disable both within12seconds to expose the control for7.5seconds. Each pylon has180HP; central control960HP. The inherited12-damage/.22second hero blast makes the fight approximately three exposure cycles before movement/avoidance. A single pylon restarts after its window expires; both reset when the exposure closes. Timings are tuning seeds and will be replaced by measured normal-input results.

Mining laser lanes and drill-impact circles mark fixed target positions before firing. Laser warning>=1.25seconds, slam>=1.5seconds; attacks never chase after the tell locks. Hazards are limited, pause with dialogue/blur and do not spawn outside the arena. Movement remains the existing independent move/fire pointer contract. The inherited Ledger Shield and Corn's real field repair remain available. The fight must be defeatable without injected health, invincibility or debug hits.

Save/retry: the cleared approach has an atomic safe checkpoint. Death reloads there, without repeating the relief quest or multiplying rewards. Boss victory, fictional salvage, Mars restoration and the next-route discovery commit once. A failed save holds the defeated encounter with a visible retry, not a silent transition. Revisit shows restored machinery and allows return to the relief site.

Reward: Liquidity Dash, a short collision-respecting on-foot burst with a cooldown. It has an actual consumer in the excavation and relief scenes immediately after acquisition, and becomes reusable traversal/combat support for later worlds. Corn's earlier repair remains separate from fighter/capital upgrades. No real token transaction is involved.

Delivery gates: actual GLB nodes and maps; runtime input/hazard/collision tests with targeted controls; failure/duplicate/reload checks; ordinary-input relief-to-route journey and boss defeat; portrait/landscape evidence; current scene encoded/decoded asset cost and rendering measurements; all build gates. Keep incomplete later worlds labeled accurately. No merge/release or private-reference upload.
