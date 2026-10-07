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
 * The spot on the work's plane that a light direction shines from, seen as
 * a lamp `radius` metres out: straight in front of the centre for a light
 * from the front, further out the lower it rakes.
 */
export function lightSpot(light, radius) {
  const lift = Math.max(light.z, MIN_LIFT);
  return { x: (light.x / lift) * radius, y: (light.y / lift) * radius };
}

/**
 * Drags the raking light: the spot it shines from moves across the work's
 * plane as far as the pinch has moved across it since the drag began, so
 * the light never jumps when you take hold of it. Pointing further out
 * from the work rakes it lower; it never goes behind or flush with the
 * surface.
 *
 * @param {{x, y}} startSpot - lightSpot of the light when the drag began
 * @param {{x, y}} from - where the pinch met the plane when the drag began
 * @param {{x, y}} to - where it meets the plane now
 * @param {Vector3} target - receives the unit light direction
 */
export function dragLight(startSpot, from, to, radius, target) {
  target.set(startSpot.x + to.x - from.x, startSpot.y + to.y - from.y, radius).normalize();

  if (target.z < MIN_LIFT) {
    const across = Math.hypot(target.x, target.y);
    const spread = Math.sqrt(1 - MIN_LIFT * MIN_LIFT) / across;
    target.set(target.x * spread, target.y * spread, MIN_LIFT);
  }
  return target;
}
