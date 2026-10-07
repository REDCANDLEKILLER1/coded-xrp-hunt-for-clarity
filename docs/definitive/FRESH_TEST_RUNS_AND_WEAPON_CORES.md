# Fresh test runs and weapon cores — October 7, 2026

Weapon-core progression below is superseded by [WEAPON_POINTS_MILESTONES.md](WEAPON_POINTS_MILESTONES.md). The fresh-page save policy remains active.

Public testing now starts a new campaign on every page opening. The boot helper removes known campaign v1/v2/v3 and definitive campaign/section records, preserves unrelated sound/settings records, and uses an in-memory CampaignSave. Storage failures cannot restore old weapons. Checkpoints support retries and chapter travel within the open page; reload or the hamburger restart starts from the beginning. Manual persistent save/load is deferred.

Fresh fighter state is weapon level 1, basic single beam, rapid fire 0. Pilot rank no longer automatically advances the campaign gun. Dedicated WPN cores drop every six enemy kills while weapon level is below 20. Collection directly advances the weapon; it does not spend a general upgrade choice or add rapid fire. General upgrade caps do not suppress these drops. Arcade crates retain their upgrade-choice behavior.

| Weapon core level | Family | Stages |
| --- | --- | --- |
| 1–4 | Liquidity Beam | I–IV |
| 5–8 | Pulse Lance | I–IV |
| 9–12 | Liquidity Rocket | I–IV |
| 13–16 | Plasma Hammer | I–IV |
| 17–20 | Ledger Arc | I–IV |

Each core equips the corresponding new stage. Unlocked families can be selected through Weapons during active flight. Combat, inputs and elapsed difficulty pressure pause while the panel is open. Existing retained firepower, boss DPS accounting and capped twin-seeker budget remain in use; new cores do not increase seeker cadence.

Verification adds actual runtime tests for all 19 core collections, independent pilot/rapid progression, core drops after general caps, collision collection and failed-write retry, live-flight panel access, unlock gates, input/combat/pressure pause, legacy-save purge, fresh reopening and unavailable storage. Automated combat tests cover both phone-shaped viewports; manual phone balance testing remains necessary.

Baseline rollback: b8bf1528596019d60befd1f2a8a08e8c57df04bb. A revert restores previous save behavior but cannot reconstruct records deliberately removed from players' browsers. No external save service exists to erase; the updated page clears local game records as each player opens it.
