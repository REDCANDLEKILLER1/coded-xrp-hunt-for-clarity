import { ACESFilmicToneMapping, AmbientLight, AnimationMixer, Box3, Color, DirectionalLight, GridHelper, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Scene, SphereGeometry, SRGBColorSpace, Vector3, WebGLRenderer, PMREMGenerator, PCFSoftShadowMap } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { disposeObject, loadModel, loadModels } from './ModelAssets';
import { SceneController, type ManagedScene } from './SceneController';
import { BoardingScene } from './BoardingScene';
import { LandingScene } from './LandingScene';
import {loadSpaceBackdrop,disposeSpaceBackdrop} from './SpaceBackdrop';
import { SpaceScene } from './SpaceScene';
import {MarsSurfaceScene} from './MarsSurfaceScene';
import {beginMarsRelief} from './MarsRelief';
import {MarsExcavationScene} from './MarsExcavationScene';
import {beginMarsExcavation,excavationCheckpoint,returnMarsRelief} from './MarsExcavation';
import type {GroundPosition} from './MarginWarden';
import {spaceModels,startTransit,fogVoyageCheckpoint,beginFogVoyage,bullionVoyageCheckpoint,beginBullionVoyage} from './SpaceProgress';
import {BullionReachScene} from './BullionReachScene';
import {beginBullionLanding} from './BullionLanding';
import {FogMoonScene} from './FogMoonScene';
import {beginFogLanding} from './FogMoon';
import {initialSpaceCheckpoint} from './SpaceCheckpoint';
import {beginRevisit,revisitCheckpoint} from './RevisitTravel';
import type {RevisitWorld} from './CampaignNavigation';
import { fighterModel } from './LandingPlan';
import { BoardingQuest } from './BoardingQuest';
import type { CampaignSave } from './CampaignSave';
import {applyGraphicsQuality,GRAPHICS_QUALITY_KEY,type GraphicsQuality} from './GraphicsQuality';

export const WARSHIP_ATTACHMENTS = ['Ship_Origin', 'Muzzle_FL', 'Muzzle_FR', 'Muzzle_L', 'Muzzle_R', 'Engine_L', 'Engine_R', 'Camera_Chase', 'Camera_Cockpit_Forward'] as const;

/** A single renderer/context survives scene changes inside the definitive 3D runtime. */
export class MeshRuntime {
  private readonly root = document.createElement('section');
  private readonly renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  private readonly controller = new SceneController();
  private readonly hud = document.createElement('div');
  private readonly status = document.createElement('p');
  private readonly controls = document.createElement('div');
  private readonly qualityButton=document.createElement('button');
  private quality:GraphicsQuality='full';
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
    try{if(localStorage.getItem(GRAPHICS_QUALITY_KEY)==='low')this.quality='low';}catch{/* A display preference must not block play. */}
    this.qualityButton.type='button';this.qualityButton.className='mesh-quality';this.qualityButton.title='Low detail reduces shadows and pixel density for smoother play';
    this.qualityButton.addEventListener('click',()=>{this.quality=this.quality==='full'?'low':'full';try{localStorage.setItem(GRAPHICS_QUALITY_KEY,this.quality);}catch{/* Session preference remains usable. */}this.applyQuality();this.resize();});this.applyQuality();
    const generator = new PMREMGenerator(this.renderer);
    const studio = new RoomEnvironment();
    this.environment = generator.fromScene(studio, .04);
    studio.dispose();
    generator.dispose();
    this.hud.className = 'mesh-hud';
    this.controls.className = 'mesh-controls';
    this.hud.append(this.status, this.controls);
    this.root.append(this.renderer.domElement, this.hud,this.qualityButton);
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
      this.hud.dataset.recovery="true";
      this.status.textContent = `The model could not load. Try again.`;
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
    else if(this.controller.lastError){this.hud.dataset.recovery="true";
      this.status.textContent=`Arrival could not load: Your checkpoint is retained. Try again.`;
      const retry=document.createElement('button');retry.textContent='Retry arrival';retry.addEventListener('click',()=>void this.showLanding(save));this.controls.replaceChildren(retry);
    }
  }

  async showBoarding(save: CampaignSave): Promise<void> {
    this.root.dataset.review = 'boarding'; this.root.hidden = false; this.hud.hidden = false;
    this.status.textContent = 'Entering the Warship…'; this.controls.replaceChildren(); this.resize(); this.startLoop();
    const quest = new BoardingQuest(save);
    const loaded = await this.controller.change(async signal => {
      const before=save.snapshot;
      const entryRoom=before.location.mode==='boarding'||before.location.mode==='hub'?quest.checkpoint:before.warshipOwned?'bridge':'hangar';
      const [hero,crew,fighter,deck] = await loadModels(['xrpman','mr_zamn',fighterModel(save.snapshot.fighterShipKey),'boarding_deck'], signal);
      let scene:BoardingScene|undefined;
      try {
        scene=new BoardingScene({ renderer: this.renderer, environment: this.environment.texture, root: this.root, hud: this.hud, quest, hero, crew, fighter, deck, entryRoom, onDeparture: () => void this.showSpace(save) });
        if(signal.aborted)throw new DOMException('Scene load cancelled','AbortError');
        if(save.snapshot.revision!==before.revision)throw new Error('The saved route changed while the bridge was loading');
        if(!quest.begin(before.fighterShipKey).ok)throw new Error('The boarding checkpoint could not be saved');
        return scene;
      }
      catch (error) { if(scene)scene.dispose();else{disposeObject(hero.scene);disposeObject(crew.scene);disposeObject(fighter.scene);disposeObject(deck.scene);}throw error; }
    });
    if (loaded) this.hud.hidden = true;
    else if (this.controller.lastError) {
      this.hud.dataset.recovery="true";
      this.status.textContent = `Boarding could not load: Your checkpoint is retained. Try again.`;
      const retry=document.createElement('button');retry.textContent='Retry boarding';retry.addEventListener('click',()=>void this.showBoarding(save));this.controls.replaceChildren(retry);
    }
  }

  async showSpace(save:CampaignSave,fogVoyage=false,revisit?:RevisitWorld,bullionVoyage=false):Promise<void>{
    this.root.dataset.review='space';this.root.hidden=false;this.hud.hidden=false;this.status.textContent=revisit?`Returning to ${revisit.replace(/_/g,' ')} orbit…`:'Preparing captured Warship departure…';this.controls.replaceChildren();this.resize();this.startLoop();
    const loaded=await this.controller.change(async signal=>{
      const revision=save.snapshot.revision;
      const checkpoint=revisit?revisitCheckpoint(save,revisit):bullionVoyage?bullionVoyageCheckpoint(save):fogVoyage?fogVoyageCheckpoint(save):save.snapshot.transit??initialSpaceCheckpoint();if(!checkpoint)throw new Error(revisit?'Return travel requires a previously reached orbit and a safe owned Warship':'Restore the departure world and return to its orbit before plotting the next route');
      const models=await loadModels(spaceModels(checkpoint),signal);
      let backdrop:import('three').Texture;
      try{backdrop=await loadSpaceBackdrop(checkpoint.route==='fog_bullion_reach',signal);}catch(error){for(const model of models)disposeObject(model.scene);throw error;}
      let scene:SpaceScene|undefined;
      try{
        scene=new SpaceScene({renderer:this.renderer,environment:this.environment.texture,root:this.root,save,models,backdrop,checkpoint,onHub:()=>void this.showBoarding(save),onRetry:()=>void this.showSpace(save),onSurface:()=>void (save.snapshot.transit?.route==='fog_bullion_reach'?this.showBullionReach(save):save.snapshot.transit?.route==='mars_fog_moon'?this.showFogMoon(save):this.showMars(save)),onFogVoyage:()=>void this.showSpace(save,true),onBullionVoyage:()=>void this.showSpace(save,false,undefined,true)});
        if(signal.aborted)throw new DOMException('Scene load cancelled','AbortError');
        if(save.snapshot.revision!==revision)throw new Error('The saved route changed during loading');
        const started=revisit?beginRevisit(save,revisit,revision):bullionVoyage?beginBullionVoyage(save):fogVoyage?beginFogVoyage(save):startTransit(save);if(!started.ok)throw new Error('Departure requires the saved owned-ship route checkpoint');
        return scene;
      }catch(error){if(scene)scene.dispose();else {for(const model of models)disposeObject(model.scene);disposeSpaceBackdrop(backdrop);}throw error;}
    });
    if(loaded)this.hud.hidden=true;
    else if(this.controller.lastError){this.hud.dataset.recovery="true";this.status.textContent=`Departure could not load: Your checkpoint is retained. Try again.`;const retry=document.createElement('button');retry.textContent='Retry departure';retry.addEventListener('click',()=>void this.showSpace(save,fogVoyage,revisit,bullionVoyage));this.controls.replaceChildren(retry);}
  }

  async showBullionReach(save:CampaignSave):Promise<void>{
    this.root.dataset.review='bullion';this.root.hidden=false;this.hud.hidden=false;this.status.textContent='Approaching the Bullion Reach freight apron…';this.controls.replaceChildren();this.resize();this.startLoop();
    const loaded=await this.controller.change(async signal=>{
      const revision=save.snapshot.revision,models=await loadModels(['xrpman','lex',fighterModel(save.snapshot.fighterShipKey),'bullion_freight_yard','market_siege_engine','relief_hauler','space_regulator_drone'],signal);let scene:BullionReachScene|undefined;
      try{scene=new BullionReachScene({renderer:this.renderer,environment:this.environment.texture,root:this.root,save,models,arrival:!save.snapshot.quests.includes('bullion_reach.landed'),onOrbit:()=>void this.showSpace(save),onRetry:()=>void this.showBullionReach(save)});if(signal.aborted)throw new DOMException('Scene load cancelled','AbortError');if(save.snapshot.revision!==revision)throw new Error('The saved route changed during loading');if(!beginBullionLanding(save).ok)throw new Error('Follow the public freight beacon and descend within 480 m');return scene;}
      catch(error){if(scene)scene.dispose();else for(const m of models)disposeObject(m.scene);throw error;}
    });
    if(loaded)this.hud.hidden=true;else if(this.controller.lastError){this.hud.dataset.recovery='true';this.status.textContent='Bullion Reach could not load. Your checkpoint is retained. Try again.';const retry=document.createElement('button');retry.textContent='Retry Bullion Reach';retry.addEventListener('click',()=>void this.showBullionReach(save));this.controls.replaceChildren(retry);}
  }

  async showFogMoon(save:CampaignSave):Promise<void>{
    this.root.dataset.review='fog';this.root.hidden=false;this.hud.hidden=false;this.status.textContent='Approaching the Fog Moon scout shelter…';this.controls.replaceChildren();this.resize();this.startLoop();
    const loaded=await this.controller.change(async signal=>{
      const models=await loadModels(['xrpman','boo',fighterModel(save.snapshot.fighterShipKey),'fog_canyon','fog_citadel','space_regulator_drone'],signal);let scene:FogMoonScene|undefined;
      try{scene=new FogMoonScene({renderer:this.renderer,environment:this.environment.texture,root:this.root,save,models,arrival:!save.snapshot.quests.includes('fog_moon.landed'),onOrbit:()=>void this.showSpace(save),onRetry:()=>void this.showFogMoon(save)});if(signal.aborted)throw new DOMException('Scene load cancelled','AbortError');if(!beginFogLanding(save).ok)throw new Error('Follow the scout shelter beacon and descend within 480 m');return scene;}
      catch(error){if(scene)scene.dispose();else for(const m of models)disposeObject(m.scene);throw error;}
    });
    if(loaded)this.hud.hidden=true;else if(this.controller.lastError){this.hud.dataset.recovery="true";this.status.textContent=`Fog Moon could not load: Your checkpoint is retained. Try again.`;const retry=document.createElement('button');retry.textContent='Retry Fog Moon';retry.addEventListener('click',()=>void this.showFogMoon(save));this.controls.replaceChildren(retry);}
  }

  async showMars(save:CampaignSave,returning?:GroundPosition):Promise<void>{
    if(!returning&&excavationCheckpoint(save.snapshot.location.checkpoint)){await this.showExcavation(save);return;}
    this.root.dataset.review='mars';this.root.hidden=false;this.hud.hidden=false;this.status.textContent='Preparing the Mars relief landing…';this.controls.replaceChildren();this.resize();this.startLoop();
    const loaded=await this.controller.change(async signal=>{
      const models=await loadModels(['xrpman','corn',fighterModel(save.snapshot.fighterShipKey),'mars_relief','space_regulator_drone'],signal);
      let scene:MarsSurfaceScene|undefined;
      try{
        scene=new MarsSurfaceScene({renderer:this.renderer,environment:this.environment.texture,root:this.root,save,models,arrival:!save.snapshot.quests.includes('mars.relief_landed'),checkpoint:returning?'mars.north_exit':undefined,onOrbit:()=>void this.showSpace(save),onRetry:()=>void this.showMars(save),onExcavation:at=>void this.showExcavation(save,at)});
        if(signal.aborted)throw new DOMException('Scene load cancelled','AbortError');
        const started=returning?returnMarsRelief(save,returning):beginMarsRelief(save);if(!started.ok)throw new Error('The relief landing requires a saved approach checkpoint. Return near the Mars beacon or the excavation exit and retry.');
        return scene;
      }catch(error){if(scene)scene.dispose();else {for(const model of models)disposeObject(model.scene);}throw error;}
    });
    if(loaded)this.hud.hidden=true;
    else if(this.controller.lastError){this.hud.dataset.recovery="true";this.status.textContent=`Relief site could not load: Your checkpoint is retained. Try again.`;const retry=document.createElement('button');retry.textContent='Retry relief site';retry.addEventListener('click',()=>void this.showMars(save,returning));this.controls.replaceChildren(retry);}
  }
  async showExcavation(save:CampaignSave,at?:GroundPosition):Promise<void>{
    this.root.dataset.review='excavation';this.root.hidden=false;this.hud.hidden=false;this.status.textContent='Preparing the extraction route…';this.controls.replaceChildren();this.resize();this.startLoop();
    const loaded=await this.controller.change(async signal=>{
      const models=await loadModels(['xrpman','margin_warden','mars_excavation','space_regulator_drone'],signal);let scene:MarsExcavationScene|undefined;
      try{
        scene=new MarsExcavationScene({renderer:this.renderer,environment:this.environment.texture,root:this.root,save,models,onRelief:from=>void this.showMars(save,from),onRetry:()=>void this.showExcavation(save)});
        if(signal.aborted)throw new DOMException('Scene load cancelled','AbortError');const entered=beginMarsExcavation(save,at);if(!entered.ok)throw new Error('Restore Corn\'s relief site and enter through its north gate.');return scene;
      }catch(error){if(scene)scene.dispose();else {for(const model of models)disposeObject(model.scene);}throw error;}
    });
    if(loaded)this.hud.hidden=true;else if(this.controller.lastError){this.hud.dataset.recovery="true";this.status.textContent=`Extraction route could not load: Your checkpoint is retained. Try again.`;const retry=document.createElement('button');retry.textContent='Retry extraction route';retry.addEventListener('click',()=>void this.showExcavation(save,at));this.controls.replaceChildren(retry);}
  }

  hide(): boolean { if(!this.controller.saveBeforeLeave())return false;this.controller.clear(); this.root.hidden = true; cancelAnimationFrame(this.frameId); this.frameId = 0;return true; }
  dispose(): boolean {
    if (!this.hide()) return false;
    window.removeEventListener('resize', this.resize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    this.environment.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.root.remove();
    return true;
  }
  private readonly contextLost = (event: Event): void => { event.preventDefault(); this.controller.clear(); this.hud.hidden=false; this.status.textContent = 'Graphics were interrupted. Reload to continue from your checkpoint.'; };
  private readonly resize = (): void => { this.renderer.setSize(this.root.clientWidth || innerWidth, this.root.clientHeight || innerHeight, false); };
  private applyQuality():void{applyGraphicsQuality(this.renderer,this.quality,devicePixelRatio||1);this.root.dataset.quality=this.quality;this.qualityButton.textContent=this.quality==='low'?'DETAIL: LOW':'DETAIL: FULL';this.qualityButton.setAttribute('aria-pressed',String(this.quality==='low'));}
  private startLoop(): void {
    this.hud.dataset.recovery="false";
    if (this.frameId) return;
    this.previousTime = performance.now();
    const frame = (time: number): void => {
      this.controller.frame((time - this.previousTime) / 1000); this.previousTime = time;
      this.frameId = requestAnimationFrame(frame);
    };
    this.frameId = requestAnimationFrame(frame);
  }
}
