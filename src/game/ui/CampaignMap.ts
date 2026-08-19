import { CAMPAIGN_ROUTES, PLANET_BY_KEY, PLANETS, type PlanetDef } from '../content/CampaignPlanets';
import { loadCampaignProgress, recordPlanetSelection, saveCampaignProgress, type CampaignProgress } from '../content/CampaignProgress';

type PlanetState = 'locked' | 'available' | 'cleared';

export class CampaignMap {
  private progress: CampaignProgress = loadCampaignProgress();
  private selectedKey = this.progress.currentPlanet;

  constructor(
    private readonly root: HTMLElement,
    private readonly onLaunch: (planet: PlanetDef) => void,
    private readonly onTestMode: () => void,
  ) {
    if (!this.isAvailable(this.selectedKey)) this.selectedKey = PLANETS[0].key;
    this.render();
  }

  show(): void {
    this.progress = loadCampaignProgress();
    if (!this.isAvailable(this.selectedKey)) this.selectedKey = PLANETS[0].key;
    this.render();
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  private render(): void {
    const selected = PLANET_BY_KEY[this.selectedKey] ?? PLANETS[0];
    const selectedState = this.stateFor(selected.key);
    const guardianDown = this.progress.defeatedGuardians.includes(selected.key);
    const surfaceDown = this.progress.defeatedSurfaceBosses.includes(selected.key);
    const routeLines = CAMPAIGN_ROUTES.map((route) => {
      const from = PLANET_BY_KEY[route.from];
      const to = PLANET_BY_KEY[route.to];
      const active = this.isAvailable(from.key) && this.isAvailable(to.key);
      return `<line class="map-route ${active ? 'is-open' : ''}" x1="${from.x}%" y1="${from.y}%" x2="${to.x}%" y2="${to.y}%" />`;
    }).join('');

    this.root.innerHTML = `
      <header class="campaign-header">
        <div>
          <p class="eyebrow">XRPMan // CLARITY SYSTEM</p>
          <h1>THE HUNT FOR CLARITY</h1>
          <p class="campaign-subtitle">Choose a route. Break the orbital guardian. Take the surface.</p>
        </div>
        <div class="campaign-record" aria-label="Campaign record">
          <span>BEST <strong>${this.progress.highScore.toLocaleString()}</strong></span>
          <span>UPGRADES <strong>${this.progress.upgradePoints}</strong></span>
          <span>CLEARED <strong>${this.progress.clearedPlanets.length}/10</strong></span>
        </div>
      </header>
      <main class="campaign-layout">
        <section class="star-map-panel" aria-label="Clarity System planetary map">
          <div class="map-scroll">
            <div class="star-map">
              <div class="map-nebula nebula-one"></div>
              <div class="map-nebula nebula-two"></div>
              <svg class="route-layer" aria-hidden="true">${routeLines}</svg>
              ${PLANETS.map((planet, index) => this.planetButton(planet, index)).join('')}
              <div class="map-legend" aria-label="Map legend">
                <span><i class="legend-dot available"></i>AVAILABLE</span>
                <span><i class="legend-dot cleared"></i>CLEARED</span>
                <span><i class="legend-dot locked"></i>FOG</span>
              </div>
            </div>
          </div>
        </section>
        <aside class="mission-panel" style="--mission-accent:${selected.accent}">
          <p class="mission-sector">${selectedState === 'locked' ? 'SIGNAL BLOCKED' : selected.sector}</p>
          <h2>${selectedState === 'locked' ? 'UNKNOWN WORLD' : selected.label}</h2>
          <div class="mission-status ${selectedState}">${selectedState.toUpperCase()}</div>
          <p class="mission-briefing">${selectedState === 'locked' ? 'Clear the connected world to reveal this destination.' : selected.briefing}</p>
          <dl class="mission-targets">
            <div><dt>ORBITAL GUARDIAN</dt><dd>${selectedState === 'locked' ? 'CLASSIFIED' : selected.guardian}<b>${guardianDown ? 'CLEARED' : 'ACTIVE'}</b></dd></div>
            <div><dt>SURFACE BOSS</dt><dd>${selectedState === 'locked' ? 'CLASSIFIED' : selected.surfaceBoss}<b>${surfaceDown ? 'CLEARED' : 'ACTIVE'}</b></dd></div>
            <div><dt>CHECKPOINT</dt><dd>${this.progress.checkpoints[selected.key]?.toUpperCase() ?? 'NONE'}</dd></div>
          </dl>
          <button class="deploy-button" type="button" data-action="deploy" ${selectedState === 'locked' ? 'disabled' : ''}>${selectedState === 'cleared' ? 'REPLAY PLANET' : 'BEGIN APPROACH'}</button>
          <button class="test-button" type="button" data-action="test">ARCADE TEST RUN</button>
          <p class="phase-note">PHASE U MAP FOUNDATION // PLANET 1 MISSION FOLLOWS</p>
        </aside>
      </main>`;

    this.root.querySelectorAll<HTMLButtonElement>('[data-planet]').forEach((button) => {
      button.addEventListener('click', () => {
        this.selectedKey = button.dataset.planet ?? PLANETS[0].key;
        this.render();
      });
    });
    this.root.querySelector<HTMLButtonElement>('[data-action="deploy"]')?.addEventListener('click', () => {
      const planet = PLANET_BY_KEY[this.selectedKey];
      if (!planet || !this.isAvailable(planet.key)) return;
      this.progress = recordPlanetSelection(this.progress, planet.key);
      saveCampaignProgress(this.progress);
      this.onLaunch(planet);
    });
    this.root.querySelector<HTMLButtonElement>('[data-action="test"]')?.addEventListener('click', this.onTestMode);
  }

  private planetButton(planet: PlanetDef, index: number): string {
    const state = this.stateFor(planet.key);
    const selected = this.selectedKey === planet.key;
    const label = state === 'locked' ? `Unknown world ${index + 1}` : `${planet.label}, ${state}`;
    return `<button
      class="planet-node ${state} ${selected ? 'selected' : ''}"
      style="--x:${planet.x}%;--y:${planet.y}%;--planet:${planet.accent};--ring:${planet.ring};--scale:${0.82 + (index % 4) * 0.08}"
      type="button"
      data-planet="${planet.key}"
      aria-label="${label}"
      aria-pressed="${selected}">
        <span class="planet-orbit"></span>
        <span class="planet-body"><i></i></span>
        <span class="planet-index">${state === 'locked' ? '?' : index + 1}</span>
        <span class="planet-label">${state === 'locked' ? 'UNKNOWN' : planet.label}</span>
      </button>`;
  }

  private stateFor(key: string): PlanetState {
    if (this.progress.clearedPlanets.includes(key)) return 'cleared';
    return this.isAvailable(key) ? 'available' : 'locked';
  }

  private isAvailable(key: string): boolean {
    return this.progress.discoveredPlanets.includes(key) || this.progress.clearedPlanets.includes(key);
  }
}
