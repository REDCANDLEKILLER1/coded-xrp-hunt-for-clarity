import type { MissionDef } from './types';

/**
 * Minimal proving-ground mission for the Phase 0B mission framework.
 *
 * This is NOT the real Moon mission -- it exists so the framework can prove
 * that deploying to a non-Earth planet runs authored acts instead of hitting
 * the old empty-stub path in `deployFromMap`. Two flight acts, one encounter
 * group each, no bosses, no checkpoints.
 *
 * The real Moon mission (Phase 2) will replace this file's registration, not
 * this file -- `test_moon` stays as the framework's regression fixture.
 */
export const TEST_MOON_MISSION: MissionDef = {
  key: 'test_moon_mission',
  planetKey: 'test_moon',
  label: 'TEST // MOON PROVING GROUND',
  acts: [
    { key: 'test_approach', label: 'TEST APPROACH', objective: 'SURVIVE THE TEST APPROACH', mode: 'flight' },
    { key: 'test_assault', label: 'TEST ASSAULT', objective: 'CLEAR THE TEST ASSAULT', mode: 'flight' },
  ],
  checkpoints: [],
  encounters: {
    test_approach: {
      actKey: 'test_approach',
      stageKey: 'deep_space_lane',
      groups: [
        { label: 'TEST CONTACT', restBefore: 0.5, spawns: [{ kind: 'enemy', enemyKey: 'regulator_drone', x: 0.5 }] },
      ],
    },
    test_assault: {
      actKey: 'test_assault',
      stageKey: 'deep_space_lane',
      groups: [
        {
          label: 'TEST WEDGE',
          restBefore: 0.5,
          spawns: [
            { kind: 'enemy', enemyKey: 'regulator_drone', x: 0.3 },
            { kind: 'enemy', enemyKey: 'regulator_drone', x: 0.7 },
          ],
        },
      ],
    },
  },
  unlocks: [],
};
