// Metres: just enough that the head never ends up inside a wall
const WALL_MARGIN = 0.15;

/**
 * Where a ray from the head meets the floor (y = 0), or null if it doesn't
 * within `maxDistance` metres.
 */
export function floorHit(origin, direction, maxDistance = 20) {
  if (direction.y >= -1e-3) return null;
  const distance = -origin.y / direction.y;
  if (distance <= 0 || distance > maxDistance) return null;
  return { x: origin.x + direction.x * distance, z: origin.z + direction.z * distance };
}

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * Keeps a landing spot on the floor: where it is, if that's on one of the
 * floor areas (rooms, or a doorway between them), clear of their walls;
 * otherwise the nearest such spot.
 *
 * @param {Array<{x, z, width, depth, margin}>} floors - areas centred on (x, z);
 *   `margin` ({x, z} or one number, default 15 cm) is kept clear of their edges
 */
export function insideFloors(spot, floors) {
  let nearest = null;
  floors.forEach(({ depth, margin = WALL_MARGIN, width, x = 0, z = 0 }) => {
    const { x: marginX, z: marginZ } = typeof margin === 'number' ? { x: margin, z: margin } : margin;
    const candidate = {
      x: clamp(spot.x, x - width / 2 + marginX, x + width / 2 - marginX),
      z: clamp(spot.z, z - depth / 2 + marginZ, z + depth / 2 - marginZ),
    };
    const distance = Math.hypot(candidate.x - spot.x, candidate.z - spot.z);
    if (!nearest || distance < nearest.distance) nearest = { distance, ...candidate };
  });
  return { x: nearest.x, z: nearest.z };
}

/**
 * The facing chosen by moving the pinching hand: the direction the hand has
 * moved across the floor plane since the pinch began, once it's moved more
 * than `deadZone` metres; until then, the heading you had. Pulling the hand
 * back towards you points the arrow back at you, so you land turned round.
 *
 * @param {{x, z}} movement - the hand's horizontal movement, in world space
 */
export function handHeading(movement, currentHeading, deadZone = 0.03) {
  return Math.hypot(movement.x, movement.z) > deadZone ? Math.atan2(-movement.x, -movement.z) : currentHeading;
}
