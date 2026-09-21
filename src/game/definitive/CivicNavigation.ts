import layout from './civic-layout.json';

/** Matches the authored shop partitions, counters and planters. */
export function civicBlocked(x:number,z:number):boolean {
  const radius=.38;
  return Math.abs(x)>layout.bounds.x-radius||Math.abs(z)>layout.bounds.z-radius||
    layout.vendors.some(v=>Math.hypot(x-v.x,z-v.z)<v.radius+radius)||
    layout.obstacles.some(o=>Math.abs(x-o.x)<o.w/2+radius&&Math.abs(z-o.z)<o.d/2+radius);
}
