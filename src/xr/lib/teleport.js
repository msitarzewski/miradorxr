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

/**
 * The station (a painting or lectern, `{x, z, yaw, view}`) that a visitor
 * standing at `spot` is in front of and facing: within its viewing distance
 * plus `reach`, on its front side, and no more than `maxAngle` from looking
 * straight at it. The nearest such station's index, or -1 if none.
 */
export function stationInFront(spot, stations, { maxAngle = Math.PI / 3, reach = 1 } = {}) {
  let best = -1;
  let bestDistance = Infinity;
  stations.forEach(({ view, x, yaw, z }, index) => {
    const dx = spot.x - x;
    const dz = spot.z - z;
    const distance = Math.hypot(dx, dz);
    const inFront = dx * Math.sin(yaw) + dz * Math.cos(yaw) > 0;
    const facing = Math.abs(angleBetween(spot.yaw, headingOf(-dx, -dz))) <= maxAngle;
    if (inFront && facing && distance <= view + reach && distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}
