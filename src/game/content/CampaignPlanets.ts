export interface PlanetDef {
  key: string;
  label: string;
  sector: string;
  guardian: string;
  surfaceBoss: string;
  briefing: string;
  accent: string;
  ring: string;
  x: number;
  y: number;
  unlocks: string[];
}

/** Phase U campaign spine. Names are data so later story passes do not require engine rewrites. */
export const PLANETS: PlanetDef[] = [
  { key: 'ledger_prime', label: 'LEDGER PRIME', sector: 'SECTOR 01', guardian: 'GARY FOG', surfaceBoss: 'LEDGER DEFENSE CORE', briefing: 'Break the fog blockade and reopen the first clarity gate.', accent: '#00ff88', ring: '#36a3ff', x: 10, y: 68, unlocks: ['fog_moon'] },
  { key: 'fog_moon', label: 'FOG MOON', sector: 'SECTOR 02', guardian: 'REGULATORY BEHEMOTH', surfaceBoss: 'FOG RELAY CITADEL', briefing: 'Cross a sensor-dead moon controlled by cloaked raiders.', accent: '#a86cff', ring: '#36a3ff', x: 23, y: 46, unlocks: ['bullion_reach'] },
  { key: 'bullion_reach', label: 'BULLION REACH', sector: 'SECTOR 03', guardian: 'CLARITY DESTROYER', surfaceBoss: 'MARKET SIEGE ENGINE', briefing: 'Survive bomber lanes around a fractured golden world.', accent: '#ffd24a', ring: '#ff8a3d', x: 37, y: 68, unlocks: ['rugfall', 'sec_outpost'] },
  { key: 'rugfall', label: 'RUGFALL', sector: 'SECTOR 04A', guardian: 'REGULATORY WARSHIP', surfaceBoss: 'RUG PULLER ARRAY', briefing: 'Take the unstable route through collapsing orbital debris.', accent: '#ff5b3d', ring: '#ffd24a', x: 50, y: 35, unlocks: ['whale_haven'] },
  { key: 'sec_outpost', label: 'SEC OUTPOST', sector: 'SECTOR 04B', guardian: 'CYBER BATTLESHIP', surfaceBoss: 'ENFORCEMENT TOWER', briefing: 'Assault the fortified route and disable its surface guns.', accent: '#ff3355', ring: '#36a3ff', x: 51, y: 78, unlocks: ['whale_haven'] },
  { key: 'whale_haven', label: 'WHALE HAVEN', sector: 'SECTOR 05', guardian: 'ARMORED DREADNOUGHT', surfaceBoss: 'ABYSSAL VAULT', briefing: 'Follow heavy signatures into a blue deep-space sanctuary.', accent: '#36a3ff', ring: '#00ff88', x: 64, y: 57, unlocks: ['liquidity_depths'] },
  { key: 'liquidity_depths', label: 'LIQUIDITY DEPTHS', sector: 'SECTOR 06', guardian: 'SIEGE CARRIER', surfaceBoss: 'DRAIN CORE', briefing: 'Fight through leech swarms protecting a buried energy core.', accent: '#00d9ff', ring: '#a86cff', x: 75, y: 30, unlocks: ['court_nexus', 'regulatory_crown'] },
  { key: 'court_nexus', label: 'COURT NEXUS', sector: 'SECTOR 07A', guardian: 'GOTHIC MECH VESSEL', surfaceBoss: 'JUDGMENT ENGINE', briefing: 'Navigate blade formations above the judicial machine-world.', accent: '#c96cff', ring: '#ff3355', x: 83, y: 55, unlocks: ['clarity_zero'] },
  { key: 'regulatory_crown', label: 'REGULATORY CROWN', sector: 'SECTOR 07B', guardian: 'COURT CRUISER PRIME', surfaceBoss: 'CROWN FORTRESS', briefing: 'Crack the final regulatory fortress and expose its command core.', accent: '#ff8a3d', ring: '#ffd24a', x: 75, y: 83, unlocks: ['clarity_zero'] },
  { key: 'clarity_zero', label: 'CLARITY ZERO', sector: 'FINAL SECTOR', guardian: 'FINAL CLARITY', surfaceBoss: 'THE ZERO POINT', briefing: 'Enter the origin world and restore clarity to the entire system.', accent: '#00ff00', ring: '#ffffff', x: 93, y: 69, unlocks: [] },
];

export const PLANET_BY_KEY = Object.fromEntries(PLANETS.map((planet) => [planet.key, planet])) as Record<string, PlanetDef>;

export const CAMPAIGN_ROUTES = PLANETS.flatMap((planet) =>
  planet.unlocks.map((target) => ({ from: planet.key, to: target })),
);

export function validateCampaignPlanets(): string[] {
  const errors: string[] = [];
  if (PLANETS.length !== 10) errors.push(`campaign: expected 10 planets, found ${PLANETS.length}`);
  const keys = new Set<string>();
  for (const planet of PLANETS) {
    if (keys.has(planet.key)) errors.push(`campaign.${planet.key}: duplicate key`);
    keys.add(planet.key);
    if (!planet.label || !planet.guardian || !planet.surfaceBoss) errors.push(`campaign.${planet.key}: labels are required`);
    if (planet.x < 0 || planet.x > 100 || planet.y < 0 || planet.y > 100) errors.push(`campaign.${planet.key}: map position must be within 0..100`);
  }
  for (const planet of PLANETS) {
    for (const target of planet.unlocks) if (!keys.has(target)) errors.push(`campaign.${planet.key}: unknown route target "${target}"`);
  }
  return errors;
}
