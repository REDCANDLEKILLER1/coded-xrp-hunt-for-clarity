import { Vector3 } from 'three';

export interface FlightPlanet {
  center: readonly [number, number, number];
  radius: number;
}

// Keep enough room for the measured hull and its portrait chase camera.
export const PLANET_CLEARANCE = 320;
export const EARTH_FLIGHT: FlightPlanet = { center: [-600, -7900, 4800], radius: 6200 * 1.014 };
export const MARS_FLIGHT: FlightPlanet = { center: [0, -1800, -33500], radius: 4400 };
export const MARS_APPROACH = new Vector3(0, 1800, 9500).normalize()
  .multiplyScalar(MARS_FLIGHT.radius + 1100).add(new Vector3(...MARS_FLIGHT.center));

/** Sweep the whole step, then retain tangential travel at the atmosphere limit. */
export function constrainPlanetApproach(start: Vector3, end: Vector3, planet: FlightPlanet): { position: Vector3; limited: boolean } {
  const center = new Vector3(...planet.center);
  const radius = planet.radius + PLANET_CLEARANCE;
  const delta = end.clone().sub(start);
  const origin = start.clone();
  const relative = origin.clone().sub(center);
  let repaired = false;
  if (relative.lengthSq() < radius * radius) {
    // Recover an older saved pose that was inside the formerly unbounded sphere.
    if (relative.lengthSq() < 1e-12) relative.set(0, 1, 0);
    origin.copy(center).add(relative.normalize().multiplyScalar(radius + .01));
    repaired = true;
  }
  const offset = origin.clone().sub(center);
  const a = delta.lengthSq(), b = 2 * offset.dot(delta), c = offset.lengthSq() - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (a < 1e-12 || b >= 0 || discriminant < 0) return { position: origin.add(delta), limited: repaired };
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  if (t < 0 || t > 1) return { position: origin.add(delta), limited: repaired };
  const contact = origin.addScaledVector(delta, t);
  const normal = contact.clone().sub(center).normalize();
  const remaining = delta.multiplyScalar(1 - t);
  remaining.addScaledVector(normal, -Math.min(0, remaining.dot(normal)));
  return { position: contact.addScaledVector(normal, .01).add(remaining), limited: true };
}
