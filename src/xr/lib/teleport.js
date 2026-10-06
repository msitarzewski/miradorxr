/** Heading (yaw 0 looks down -z, positive turns left) of a horizontal direction */
export const headingOf = (dx, dz) => Math.atan2(-dx, -dz);

/** Smallest signed difference between two angles, in (-PI, PI] */
export function angleBetween(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/**
 * The XR origin transform that puts the viewer's head at a spot and turns
 * them to a heading. The head sits somewhere inside the origin's space
 * (wherever the person is sitting or standing), so the origin is solved
 * from the head's current offset and heading within it.
 *
 * Headings follow three.js: yaw 0 looks down -z, positive yaw turns left.
 *
 * @param {{x, z, yaw}} head - head position and heading in origin space
 * @param {{x, z, yaw}} spot - where the head should end up, in world space
 * @returns {{x, z, yaw}} origin position (on the floor) and rotation
 */
export function originForSpot(head, spot) {
  const yaw = spot.yaw - head.yaw;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);

  return {
    x: spot.x - (cos * head.x + sin * head.z),
    yaw,
    z: spot.z - (-sin * head.x + cos * head.z),
  };
}
