# Chapter One Combat Motion and Warship City Plan

## Campaign boundary

Chapter One begins with the existing 2D Earth-orbit campaign, carries the starter fighter into the mothership, and continues through boarding, capture, and establishing the captured warship as a home. The starter fighter remains owned, keeps its separate health and upgrade track, and launches from the warship during later travel. Arrival at the next planet begins Chapter Two; each later planet is its own chapter.

## Existing motion inventory

The project and local Blender libraries contain useful locomotion, aiming, firing, hit, dodge, interaction, and recovery clips. They do not contain a credible martial-arts set: there is no authored kick, block, parry, sweep, grapple, throw, or multi-hit combo chain. The current `Interact` fallback should be replaced as combat clips are retargeted.

Use existing licensed work before authoring motion from scratch:

- Quaternius Universal Animation Library: 120+ animations, engine exports, Blender source in the Source tier, humanoid retargeting, combat and gun actions, and a CC0 license. Use no-root-motion clips for responsive player attacks and root-motion variants only for bounded finishers.
- Quaternius Universal Animation Library 2: CC0 parkour and combat-combo expansion. Audit the actual clip list after download before assigning actions.
- Adobe Mixamo: free with an Adobe ID and royalty-free for video games under Adobe's published FAQ. It supports bipedal humanoids. Use it to fill precise gaps after the CC0 packs are evaluated; keep downloaded motion embedded in the game rather than redistributing it as an asset library.

First retarget set: guarded idle, jab, cross, front kick, roundhouse, low sweep, high block, parry, grapple entry, throw, knockdown, recovery, and two short combo finishers. Every animation needs a gameplay window, hit volume, cancel window, stamina or cooldown cost, and readable enemy response; animation alone must not determine damage.

Sources:

- https://quaternius.itch.io/universal-animation-library
- https://quaternius.itch.io/universal-animation-library-2
- https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
- https://helpx.adobe.com/creative-cloud/help/animate-characters-mixamo.html

## Captured warship city

The warship is a persistent city-sized hub rather than one bridge menu. Its districts share the campaign credit balance and cargo inventory.

1. **Civic Deck and market:** buy and sell consumables, weapons, armor, fighter parts, warship modules, and crafting salvage. Resale is lower than purchase price, making loadout decisions meaningful.
2. **Crew quarters:** save, heal, change active crew, review relationships, and hear story scenes.
3. **Medbay:** stronger healing, injury treatment, revival supplies, and permanent vitality upgrades. Characters, the starter fighter, escorts, enemies, bosses, and warship systems all expose bounded health.
4. **Hangar:** view the starter fighter, repair its hull, install its own weapons and defenses, and launch it. Fighter upgrades never silently modify hero or capital-ship combat.
5. **Bank:** protected deposits, mission escrow, and later faction contracts with visible terms.
6. **Casino:** optional in-world games using earned campaign credits, with disclosed odds and hard loss limits. Rewards support side content and cosmetics rather than blocking the main story.
7. **Brig:** captured officers, interrogations, prisoner exchanges, recruit-or-release choices, and consequences that alter later encounters.
8. **Training deck:** martial-arts tutorials, sparring, combo trials, and safe evaluation of newly installed techniques.
9. **Residential and service ring:** vendors, crew stories, allies, repairs, rumors, and an evolving population after each planetary chapter.

The first implemented foundation is persistent cargo, repeatable med-pack buying and selling, combat use, a melee-capacitor upgrade, and crew-quarter save/heal. Physical districts can use the same transactions without inventing incompatible currencies or duplicate save systems.
