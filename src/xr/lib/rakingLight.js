// The light stays at least this far out of the work's surface (as z of its
// unit direction): low enough to rake, never behind or flush with it
export const MIN_LIFT = 0.15;

/**
 * Where a ray meets the work's plane (z = 0 in the work's own space, x
 * across, y up, z out of the surface), or null if it points away from it.
 *
 * @param {{origin, direction}} ray - in the work's space
 */
export function onWorkPlane({ direction, origin }) {
  if (direction.z >= -1e-6) return null;
  const distance = -origin.z / direction.z;
  return { x: origin.x + direction.x * distance, y: origin.y + direction.y * distance };
}

/**
 * The raking light from where its lamp is held, in the work's own space (x
 * across, y up, z out of the surface): the light shines from the work's
 * centre towards the lamp, kept out in front of the surface by MIN_LIFT,
 * and the lamp stays within reach of the work.
 *
 * @param {Vector3} lamp - where the lamp is held, relative to the work's centre
 * @param {Vector3} target - receives the unit light direction
 * @returns {number} the lamp's distance from the work's centre
 */
export function lampLight(lamp, target, { maxDistance = 2.5, minDistance = 0.25 } = {}) {
  if (lamp.lengthSq() < 1e-8) {
    target.set(0, 0, 1);
    return minDistance;
  }
  target.copy(lamp).normalize();

  if (target.z < MIN_LIFT) {
    const across = Math.hypot(target.x, target.y) || 1;
    const spread = Math.sqrt(1 - MIN_LIFT * MIN_LIFT) / across;
    target.set(target.x * spread, target.y * spread, MIN_LIFT);
  }
  return Math.min(maxDistance, Math.max(minDistance, lamp.length()));
}
