import { ACESFilmicToneMapping, AmbientLight, AnimationMixer, Box3, Color, DirectionalLight, GridHelper, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Scene, SphereGeometry, SRGBColorSpace, Vector3, WebGLRenderer, PMREMGenerator, PCFSoftShadowMap } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { disposeObject, loadModel, loadModels } from './ModelAssets';
import { SceneController, type ManagedScene } from './SceneController';
import { BoardingScene } from './BoardingScene';
import { LandingScene } from './LandingScene';
import { SpaceScene } from './SpaceScene';
import { SPACE_MODELS, startTransit } from './SpaceProgress';
import { fighterModel } from './LandingPlan';
import { BoardingQuest } from './BoardingQuest';
import type { CampaignSave } from './CampaignSave';

export const WARSHIP_ATTACHMENTS = ['Ship_Origin', 'Muzzle_FL', 'Muzzle_FR', 'Muzzle_L', 'Muzzle_R', 'Engine_L', 'Engine_R', 'Camera_Chase', 'Camera_Cockpit_Forward'] as const;

/** A single renderer/context survives scene changes inside the definitive 3D runtime. */
export class MeshRuntime {
  private readonly root = document.createElement('section');
  private readonly renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  private readonly controller = new SceneController();
  private readonly hud = document.createElement('div');
  private readonly status = document.createElement('p');
  private readonly controls = document.createElement('div');
  private frameId = 0;
  private previousTime = 0;
  private readonly environment;

  constructor(parent: HTMLElement) {
    this.root.className = 'mesh-runtime';
    this.root.hidden = true;
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled=true; this.renderer.shadowMap.type=PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    const generator = new PMREMGenerator(this.renderer);
    const studio = new RoomEnvironment();
    this.environment = generator.fromScene(studio, .04);
    studio.dispose();
    generator.dispose();
    this.hud.className = 'mesh-hud';
    this.controls.className = 'mesh-controls';
    this.hud.append(this.status, this.controls);
    this.root.append(this.renderer.domElement, this.hud);
    parent.appendChild(this.root);
    window.addEventListener('resize', this.resize);
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    this.resize();
  }

  async showModel(assetId: 'regulatory_warship' | 'xrpman' | 'mr_zamn' = 'regulatory_warship'): Promise<void> {
    this.hud.hidden = false;
    const character = assetId !== 'regulatory_warship';
    const characterName=assetId==='mr_zamn'?'MR ZAMN':'XRPMAN';
    this.root.dataset.review = character ? 'character' : 'warship';
    this.root.hidden = false;
    this.resize();
    this.status.textContent = character ? `Loading ${characterName}…` : 'Loading Warship model…';
    this.controls.replaceChildren();
    this.startLoop();
    const loaded = await this.controller.change(async (signal) => {
      const gltf = await loadModel(assetId, signal);
      const ship = gltf.scene;
      const attachments = character ? ['Hero_Origin', 'Hand_R', 'Hand_L'] : WARSHIP_ATTACHMENTS;
      for (const name of attachments) if (!ship.getObjectByName(name)) { disposeObject(ship); throw new Error(`Missing attachment: ${name}`); }
      if (character && !gltf.animations.length) { disposeObject(ship); throw new Error('XRPMan has no animation clips'); }
      const scene = new Scene();
      scene.background = new Color('#050b12');
      scene.environment = this.environment.texture;
      scene.environmentIntensity = .7;
      scene.add(ship, new AmbientLight(0x68839f, .3));
      const key = new DirectionalLight(0xc2d8ff, 3.2);
      key.position.set(-80, 110, 80);
      const rim = new DirectionalLight(0xff6535, 2.5);
      rim.position.set(100, 40, -80);
      scene.add(key, rim);
      const grid = new GridHelper(character ? 6 : 240, 24, 0x294456, 0x101e2c);
      grid.position.y = character ? -.015 : -15;
      scene.add(grid);
      const markers = new Group();
      const markerGeometry = new SphereGeometry(1.2, 10, 8);
      const markerMaterial = new MeshBasicMaterial({ color: '#00FF00', toneMapped: false });
      for (const name of attachments.filter((name) => name.startsWith('Muzzle_'))) {
        const marker = new Mesh(markerGeometry, markerMaterial);
        ship.getObjectByName(name)!.getWorldPosition(marker.position);
        markers.add(marker);
      }
      markers.visible = false;
      scene.add(markers);
      const camera = new PerspectiveCamera(42, 1, .1, 2000);
      camera.position.set(character ? 1.1 : 125, character ? 1.5 : 100, character ? 4 : 155);
      const orbit = new OrbitControls(camera, this.renderer.domElement);
      orbit.enableDamping = true;
      orbit.minDistance = character ? .4 : 45;
      orbit.maxDistance = character ? 12 : 1000;
      orbit.target.set(0, character ? .98 : 0, 0);
      orbit.update();
      let active = false;
      let clock = 0;
      const box = new Box3().setFromObject(ship).getSize(new Vector3());
      let previousAspect = 0;
      const fitCamera = (): void => {
        const aspect = this.root.clientWidth / Math.max(1, this.root.clientHeight);
        const verticalHalfAngle = camera.fov * Math.PI / 360;
        const halfAngle = Math.min(verticalHalfAngle, Math.atan(Math.tan(verticalHalfAngle) * aspect));
        const distance = character
          ? Math.max(box.y * .5 / Math.tan(verticalHalfAngle) * this.root.clientHeight / Math.max(150, this.root.clientHeight - (aspect > 1 ? 90 : 260)), box.x * .65 / (Math.tan(verticalHalfAngle) * aspect)) * 1.08
          : box.length() * .5 / Math.sin(halfAngle) * 1.12;
        camera.position.sub(orbit.target).normalize().multiplyScalar(distance).add(orbit.target);
        orbit.update();
      };
      const buttons = document.createElement('div');
      const action = (label: string, run: () => void) => {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = label; button.addEventListener('click', run); buttons.appendChild(button);
        return button;
      };
      action('Front', () => { orbit.target.set(0, character ? .98 : 0, 0); camera.position.set(0, character ? 1.05 : 40, character ? 4 : 190); fitCamera(); });
      action('Rear', () => { orbit.target.set(0, character ? .98 : 0, 0); camera.position.set(0, character ? 1.05 : 45, character ? -4 : -190); fitCamera(); });
      action(character ? 'Face' : 'Top', () => {
        if (character) { orbit.target.set(0, 1.75, 0); camera.position.set(.12, 1.79, 1.1); orbit.update(); }
        else { camera.position.set(0, 230, .1); fitCamera(); }
      });
      const nodes = action('Show muzzles', () => { markers.visible = !markers.visible; nodes.textContent = markers.visible ? 'Hide muzzles' : 'Show muzzles'; });
      nodes.hidden = character;
      let captured = false;
      const hostileMaterials: { material: MeshStandardMaterial; color: Color; emissive: Color; intensity: number; toneMapped: boolean }[] = [];
      ship.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (material instanceof MeshStandardMaterial && /Hostile|Engine/.test(material.name) && !hostileMaterials.some((entry) => entry.material === material)) hostileMaterials.push({ material, color: material.color.clone(), emissive: material.emissive.clone(), intensity: material.emissiveIntensity, toneMapped: material.toneMapped });
        }
      });
      const faction = action('Captured lights', () => {
        captured = !captured;
        for (const { material, color, emissive, intensity, toneMapped } of hostileMaterials) {
          material.color.copy(captured ? new Color('#002800') : color);
          material.emissive.copy(captured ? new Color('#00FF00') : emissive);
          material.emissiveIntensity = captured ? 1 : intensity;
          material.toneMapped = captured ? false : toneMapped;
          material.needsUpdate = true;
        }
        faction.textContent = captured ? 'Hostile lights' : 'Captured lights';
      });
      faction.hidden = character;
      const mixer = character ? new AnimationMixer(ship) : null;
      let playing = true;
      let clipName = '';
      const play = (name: string): void => {
        const clip = gltf.animations.find((entry) => entry.name === name);
        if (!clip || !mixer) return;
        mixer.stopAllAction(); mixer.clipAction(clip).reset().play(); clipName = name;
      };
      if (character) {
        ship.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            if (material instanceof MeshStandardMaterial && /^(Liquidity|TruFi blue)/.test(material.name)) {
              material.toneMapped = false; material.needsUpdate = true;
            }
          }
        });
        const selector = document.createElement('select'); selector.setAttribute('aria-label', 'Animation');
        for (const clip of gltf.animations) { const option = document.createElement('option'); option.value = clip.name; option.textContent = clip.name; selector.appendChild(option); }
        selector.value = gltf.animations.some((clip) => clip.name === 'Idle') ? 'Idle' : gltf.animations[0].name;
        selector.addEventListener('change', () => play(selector.value)); buttons.appendChild(selector);
        play(selector.value);
        const pause = action('Pause animation', () => { playing = !playing; pause.textContent = playing ? 'Pause animation' : 'Play animation'; });
      }
      const managed: ManagedScene = {
        setActive: (value) => { active = value; orbit.enabled = value; if (value) this.controls.replaceChildren(buttons); },
        update: (dt) => { if (active) { clock += dt; orbit.update(); if (playing) mixer?.update(dt); } },
        render: () => {
          camera.aspect = this.root.clientWidth / Math.max(1, this.root.clientHeight);
          if (camera.aspect !== previousAspect) { fitCamera(); previousAspect = camera.aspect; }
          camera.updateProjectionMatrix();
          this.renderer.render(scene, camera);
          if (clock > .3) {
            const info = this.renderer.info.render;
            this.status.textContent = character
              ? `${characterName} · CHARACTER REVIEW · ${clipName}\n${box.y.toFixed(3)} m · ${gltf.animations.length} animations\n${info.triangles.toLocaleString()} visible triangles · ${info.calls} draw calls`
              : `WARSHIP · MATERIAL REVIEW\n${box.z.toFixed(1)} m long · ${box.x.toFixed(1)} m span · ${box.y.toFixed(1)} m high\n${info.triangles.toLocaleString()} visible triangles · ${info.calls} draw calls · 9 attachments`;
            clock = 0;
          }
        },
        dispose: () => { active = false; mixer?.stopAllAction(); mixer?.uncacheRoot(ship); orbit.dispose(); disposeObject(scene); buttons.remove(); },
      };
      return managed;
    });
    if (!loaded && this.controller.lastError) {
      this.status.textContent = `Unable to load model: ${this.controller.lastError}`;
      const retry = document.createElement('button'); retry.textContent = 'Retry'; retry.addEventListener('click', () => void this.showModel(assetId)); this.controls.replaceChildren(retry);
    }
  }

  async showLanding(save: CampaignSave): Promise<void> {
    if(save.snapshot.location.mode==='space'&&save.snapshot.transit)return this.showSpace(save);
    if(save.snapshot.warshipOwned||save.snapshot.quests.includes('boarding.landed'))return this.showBoarding(save);
    this.root.dataset.review='landing';this.root.hidden=false;this.hud.hidden=false;
    this.status.textContent='Approaching the disabled Warship…';this.controls.replaceChildren();this.resize();this.startLoop();
    const loaded=await this.controller.change(async signal=>{
      const [warship,fighter]=await loadModels(['regulatory_warship_open',fighterModel(save.snapshot.fighterShipKey)],signal);
      try{return new LandingScene({renderer:this.renderer,environment:this.environment.texture,root:this.root,save,warship,fighter,onDock:()=>void this.showBoarding(save)});}
      catch(error){disposeObject(warship.scene);disposeObject(fighter.scene);throw error;}
    });
    if(loaded)this.hud.hidden=true;
    else if(this.controller.lastError){
      this.status.textContent=`Arrival could not load: ${this.controller.lastError}. Your checkpoint is retained.`;
      const retry=document.createElement('button');retry.textContent='Retry arrival';retry.addEventListener('click',()=>void this.showLanding(save));this.controls.replaceChildren(retry);
    }
  }

  async showBoarding(save: CampaignSave): Promise<void> {
    this.root.dataset.review = 'boarding'; this.root.hidden = false; this.hud.hidden = false;
    this.status.textContent = 'Entering the Warship…'; this.controls.replaceChildren(); this.resize(); this.startLoop();
    const quest = new BoardingQuest(save);
    const begin = quest.begin(save.snapshot.fighterShipKey);
    if (!begin.ok) { this.status.textContent = 'The boarding checkpoint could not be saved. Return to the map and retry.'; return; }
    const loaded = await this.controller.change(async signal => {
      const [hero,crew,fighter,deck] = await loadModels(['xrpman','mr_zamn',fighterModel(save.snapshot.fighterShipKey),'boarding_deck'], signal);
      try { return new BoardingScene({ renderer: this.renderer, environment: this.environment.texture, root: this.root, hud: this.hud, quest, hero, crew, fighter, deck, onDeparture: () => void this.showSpace(save) }); }
      catch (error) { disposeObject(hero.scene); disposeObject(crew.scene); disposeObject(fighter.scene); disposeObject(deck.scene); throw error; }
    });
    if (loaded) this.hud.hidden = true;
    else if (this.controller.lastError) {
      this.status.textContent = `Boarding could not load: ${this.controller.lastError}. Your checkpoint is retained.`;
      const retry=document.createElement('button');retry.textContent='Retry boarding';retry.addEventListener('click',()=>void this.showBoarding(save));this.controls.replaceChildren(retry);
    }
  }

  async showSpace(save:CampaignSave):Promise<void>{
    this.root.dataset.review='space';this.root.hidden=false;this.hud.hidden=false;this.status.textContent='Preparing captured Warship departure…';this.controls.replaceChildren();this.resize();this.startLoop();
    const loaded=await this.controller.change(async signal=>{
      const models=await loadModels(SPACE_MODELS,signal);
      try{
        const started=startTransit(save);if(!started.ok)throw new Error('Departure requires a captured bridge and saved departure briefing');
        return new SpaceScene({renderer:this.renderer,environment:this.environment.texture,root:this.root,save,models,onHub:()=>void this.showBoarding(save),onRetry:()=>void this.showSpace(save)});
      }catch(error){for(const model of models)disposeObject(model.scene);throw error;}
    });
    if(loaded)this.hud.hidden=true;
    else if(this.controller.lastError){this.status.textContent=`Departure could not load: ${this.controller.lastError}. Your checkpoint is retained.`;const retry=document.createElement('button');retry.textContent='Retry departure';retry.addEventListener('click',()=>void this.showSpace(save));this.controls.replaceChildren(retry);}
  }

  hide(): boolean { if(!this.controller.saveBeforeLeave())return false;this.controller.clear(); this.root.hidden = true; cancelAnimationFrame(this.frameId); this.frameId = 0;return true; }
  dispose(): void {
    this.hide(); window.removeEventListener('resize', this.resize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    this.environment.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.root.remove();
  }
  private readonly contextLost = (event: Event): void => { event.preventDefault(); this.controller.clear(); this.hud.hidden=false; this.status.textContent = 'Graphics were interrupted. Reload to continue from your checkpoint.'; };
  private readonly resize = (): void => { this.renderer.setSize(this.root.clientWidth || innerWidth, this.root.clientHeight || innerHeight, false); };
  private startLoop(): void {
    if (this.frameId) return;
    this.previousTime = performance.now();
    const frame = (time: number): void => {
      this.controller.frame((time - this.previousTime) / 1000); this.previousTime = time;
      this.frameId = requestAnimationFrame(frame);
    };
    this.frameId = requestAnimationFrame(frame);
  }
}
