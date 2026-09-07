import type {DialogueScene} from '../definitive/Dialogue';

export interface FlightStoryPort {
  setActive(value:boolean):void;
  update(dt:number,act:string|null,restorationSafe?:boolean):boolean;
  readonly districtRestored?:boolean;
}

export const CITY_RESTORATION:DialogueScene={id:'story.earth.city_restore',lines:[
  {speaker:'CORN XRPL · COMMS',text:'There! Pumps are back. You just bought a whole district another day.'},
  {speaker:'XRPMAN',text:"Keep them moving. I'm going after the switchboard."},
]};

/** Authored comms at safe act boundaries. Corn is still remote on Earth. */
export const EARTH_STORY:Record<string,DialogueScene>={
  orbital_approach:{id:'story.earth.distress',lines:[
    {speaker:'STONE · COMMS',text:'Ledger City is going dark. The reserves are still there. Someone closed every route.'},
    {speaker:'XRPMAN',text:'Then we open them. Send me the signal.'},
    {speaker:'STONE · COMMS',text:'Blockade above the city. Civilian lanes below it. Keep them clear.'},
  ]},
  fog_belt:{id:'story.earth.fog',lines:[
    {speaker:'STONE · COMMS',text:"That interference isn't weather. Every missing shipment disappears inside the same signal."},
    {speaker:'XRPMAN',text:'Somebody wants us looking the other way.'},
  ]},
  regulatory_behemoth:{id:'story.earth.behemoth',lines:[
    {speaker:'REGULATORY BEHEMOTH',allegiance:'hostile',text:'Unauthorized traffic will be returned to origin.'},
    {speaker:'XRPMAN',text:'Earth is my origin.'},
    {speaker:'STONE · COMMS',text:"Then make sure there's still an Earth to return to. Watch the shield cycle."},
  ]},
  ledger_city:{id:'story.earth.field_report',lines:[
    {speaker:'CORN XRPL · COMMS',text:"Pumps stopped. Freight stopped. Their collector ships sure didn't."},
    {speaker:'XRPMAN',text:'How long can the shelters hold?'},
    {speaker:'CORN XRPL · COMMS',text:'Longer if you stop asking and start shooting.'},
    {speaker:'STONE · COMMS',text:"He's marked the evacuation lanes. Green signals are ours."},
  ]},
  clarity_destroyer:{id:'story.earth.destroyer',lines:[
    {speaker:'CLARITY DESTROYER',allegiance:'hostile',text:'All lanes are open to authorized assets.'},
    {speaker:'STONE · COMMS',text:'Their ships are the only authorized assets.'},
    {speaker:'XRPMAN',text:'Time for an exception.'},
  ]},
  gary_fog:{id:'story.earth.gary',lines:[
    {speaker:'GARY FOG',allegiance:'hostile',text:'Your request for clarity is pending review.'},
    {speaker:'XRPMAN',text:"Keep the paperwork. I'm here for the people."},
    {speaker:'GARY FOG',allegiance:'hostile',text:'Without us, there would be chaos.'},
    {speaker:'STONE · COMMS',text:"He's broadcasting three signatures. Watch what actually fires."},
  ]},
  regulatory_warship:{id:'story.earth.warship_target',lines:[
    {speaker:'STONE · COMMS',text:"The drain runs through that Warship. Don't destroy it. Its route ledger leads beyond Earth."},
    {speaker:'XRPMAN',text:'Guns. Relay. Engines. We take it intact.'},
  ]},
};

export function earthStoryFor(act:string|null,seen:readonly string[]):DialogueScene|null {
  const scene=act?EARTH_STORY[act]:undefined;
  return scene&&!seen.includes(scene.id)?scene:null;
}
