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

/** Keeps a landing spot inside the room's walls */
export function insideRoom({ x, z }, { depth, width }) {
  const halfWidth = width / 2 - WALL_MARGIN;
  const halfDepth = depth / 2 - WALL_MARGIN;
  return { x: Math.min(halfWidth, Math.max(-halfWidth, x)), z: Math.min(halfDepth, Math.max(-halfDepth, z)) };
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
