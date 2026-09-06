import type { BoardingRoom } from './BoardingQuest';

export interface DeckRoom { id: BoardingRoom; title: string; x: number; z: number; width: number; depth: number; terminal: [number, number]; enemies: readonly [number, number][] }
/** Metres in the Warship GLB frame: +Y up, +Z bow. A continuous 108 m deck. */
export const DECK: readonly DeckRoom[] = [
  { id: 'hangar', title: '01 · ARRIVAL BAY', x: 0, z: -39, width: 24, depth: 24, terminal: [4, -33], enemies: [] },
  { id: 'security', title: '02 · SECURITY RELAY', x: 0, z: -19, width: 16, depth: 16, terminal: [-4, -14], enemies: [[-4,-20],[4,-18],[0,-14]] },
  { id: 'rescue', title: '03 · CREW JUNCTION', x: 0, z: 0, width: 22, depth: 22, terminal: [5, 2], enemies: [] },
  { id: 'engineering', title: '04 · ENGINEERING', x: -20, z: 0, width: 18, depth: 18, terminal: [-25, 1], enemies: [[-17,-4],[-24,-4],[-22,4],[-16,4]] },
  { id: 'cache', title: '05 · SHIELD CACHE', x: 20, z: 0, width: 18, depth: 14, terminal: [25, 0], enemies: [] },
  { id: 'command', title: '06 · COMMAND ACCESS', x: 0, z: 20, width: 20, depth: 18, terminal: [-4, 23], enemies: [] },
  { id: 'core', title: '07 · LEDGER DEFENSE CORE', x: 0, z: 38, width: 22, depth: 18, terminal: [0, 44], enemies: [] },
  { id: 'bridge', title: '08 · CAPTURED BRIDGE', x: 0, z: 52, width: 18, depth: 10, terminal: [0, 54], enemies: [] },
];
export interface DeckDoor { a: BoardingRoom; b: BoardingRoom; x: number; z: number; axis: 'x' | 'z'; width: number }
export const DECK_DOORS: readonly DeckDoor[] = [
  { a:'hangar',b:'security',x:0,z:-27,axis:'z',width:3.6 },
  { a:'security',b:'rescue',x:0,z:-11,axis:'z',width:3.6 },
  { a:'rescue',b:'engineering',x:-11,z:0,axis:'x',width:3.6 },
  { a:'rescue',b:'cache',x:11,z:0,axis:'x',width:3.6 },
  { a:'rescue',b:'command',x:0,z:11,axis:'z',width:3.6 },
  { a:'command',b:'core',x:0,z:29,axis:'z',width:3.6 },
  { a:'core',b:'bridge',x:0,z:47,axis:'z',width:3.6 },
];
export const deckRoom = (id: BoardingRoom): DeckRoom => DECK.find(room => room.id === id)!;
export function roomAt(x: number, z: number): DeckRoom | undefined {
  return DECK.find(room => Math.abs(x-room.x)<=room.width/2+.001 && Math.abs(z-room.z)<=room.depth/2+.001);
}
export function canCross(from: BoardingRoom, to: BoardingRoom, x: number, z: number, radius=.32): boolean {
  if (from === to) return true;
  const door = DECK_DOORS.find(d => (d.a === from && d.b === to) || (d.a === to && d.b === from));
  return !!door && Math.abs(door.axis === 'z' ? x-door.x : z-door.z) < door.width/2-radius;
}
export function insideWallMargin(room: DeckRoom, x: number, z: number, radius=.32): boolean {
  const inX=Math.abs(x-room.x)<room.width/2-radius, inZ=Math.abs(z-room.z)<room.depth/2-radius;
  if(inX && inZ) return true;
  return DECK_DOORS.some(d => (d.a===room.id || d.b===room.id) && Math.hypot(x-d.x,z-d.z)<d.width/2-radius);
}
