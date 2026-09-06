import type { BoardingRoom } from './BoardingQuest';
import layout from './boarding-deck.json';

export interface DeckRoom { id: BoardingRoom; title: string; x: number; z: number; width: number; depth: number; terminal: [number, number]; enemies: readonly [number, number][] }
/** Shared by Blender and the game. Interior floor is 4.5 m below Ship_Origin. */
export const DECK: readonly DeckRoom[] = layout.rooms.map(room=>({ ...room, id:room.id as BoardingRoom, terminal:[room.terminal[0],room.terminal[1]], enemies:room.enemies.map(([x,z])=>[x,z] as [number,number]) }));
export const DECK_LAYOUT = layout;
export interface DeckDoor { a: BoardingRoom; b: BoardingRoom; x: number; z: number; axis: 'x' | 'z'; width: number }
export const DECK_DOORS: readonly DeckDoor[] = layout.doors as DeckDoor[];
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
