/** Adjustable follow-camera distance for the 3D boarding scene (not gameplay world scale). */
export const BOARDING_MIN_CAMERA_SCALE = 0.55;
export const BOARDING_MAX_CAMERA_SCALE = 1.8;
export const clampBoardingCameraScale = (value: number): number =>
  Math.max(BOARDING_MIN_CAMERA_SCALE, Math.min(BOARDING_MAX_CAMERA_SCALE, value));

/** Spreading fingers brings the camera closer; pinching in reveals more of the room. */
export function scaleBoardingCameraByPinch(current: number, previousDistance: number, nextDistance: number): number {
  if (![current, previousDistance, nextDistance].every(Number.isFinite) || previousDistance < 12 || nextDistance < 12) return current;
  return clampBoardingCameraScale(current * previousDistance / nextDistance);
}

/** Mouse wheel parity; positive scroll moves the camera farther away. */
export function scaleBoardingCameraByWheel(current: number, deltaY: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(deltaY)) return current;
  return clampBoardingCameraScale(current * Math.exp(deltaY * 0.0015));
}
