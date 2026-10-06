// Metres
const MIN_GAP = 0.9;
const WALL_INSET = 0.05;
const ROOM_ASPECT = 1.5;

/**
 * Walls in viewing order: a visitor starting at the centre facing the front
 * wall and turning right sees every wall's paintings left to right, so the
 * sequence runs clockwise around the room, as in the manifest.
 * `along` is the unit direction of left-to-right on the wall; `normal`
 * points into the room.
 */
const WALLS = [
  { along: [1, 0], normal: [0, 1], side: 'width', start: ([w, d]) => [-w / 2, -d / 2] },
  { along: [0, 1], normal: [-1, 0], side: 'depth', start: ([w, d]) => [w / 2, -d / 2] },
  { along: [-1, 0], normal: [0, -1], side: 'width', start: ([w, d]) => [w / 2, d / 2] },
  { along: [0, -1], normal: [1, 0], side: 'depth', start: ([w, d]) => [-w / 2, d / 2] },
];

/** Fills walls in order; returns the paintings per wall, or null if they don't fit */
function fillWalls(widths, [roomWidth, roomDepth]) {
  const walls = WALLS.map(() => []);
  let wall = 0;
  let used = MIN_GAP;

  for (let index = 0; index < widths.length; index += 1) {
    const length = WALLS[wall].side === 'width' ? roomWidth : roomDepth;
    if (used + widths[index] + MIN_GAP > length) {
      wall += 1;
      used = MIN_GAP;
      if (wall >= WALLS.length) return null;
      index -= 1;
    } else {
      walls[wall].push(index);
      used += widths[index] + MIN_GAP;
    }
  }

  return walls;
}

/**
 * Hangs works around a rectangular room centred on the origin, in order,
 * with each wall's paintings evenly spaced.
 *
 * @param {number[]} aspectRatios - width / height of each work, in order
 * @param {number} options.paintingHeight - display height of every work
 * @returns {{room: {width, depth}, placements: Array<{x, z, yaw, width, height}>}}
 * where (x, z) is the painting's centre on the wall and yaw turns a
 * painting facing +z to face into the room
 */
export function layoutGallery(aspectRatios, { paintingHeight = 1 } = {}) {
  const widths = aspectRatios.map((aspect) => paintingHeight * aspect);
  const total = widths.reduce((sum, width) => sum + width + MIN_GAP, MIN_GAP);

  // Start from a room whose perimeter just fits, and grow until every wall fits
  let perimeter = Math.max(total, 8);
  let size;
  let walls;
  do {
    const depth = perimeter / (2 * (1 + ROOM_ASPECT));
    size = [depth * ROOM_ASPECT, depth];
    walls = fillWalls(widths, size);
    perimeter *= 1.05;
  } while (!walls);

  const placements = new Array(widths.length);
  walls.forEach((indices, wallIndex) => {
    const wall = WALLS[wallIndex];
    const length = wall.side === 'width' ? size[0] : size[1];
    const gap = (length - indices.reduce((sum, index) => sum + widths[index], 0)) / (indices.length + 1);
    const [startX, startZ] = wall.start(size);
    let offset = gap;

    indices.forEach((index) => {
      const along = offset + widths[index] / 2;
      placements[index] = {
        height: paintingHeight,
        width: widths[index],
        x: startX + wall.along[0] * along + wall.normal[0] * WALL_INSET,
        yaw: Math.atan2(wall.normal[0], wall.normal[1]),
        z: startZ + wall.along[1] * along + wall.normal[1] * WALL_INSET,
      };
      offset += widths[index] + gap;
    });
  });

  return { placements, room: { depth: size[1], width: size[0] } };
}

/**
 * Where to stand to look at a placed work: `distance` metres out from its
 * centre along the wall normal, facing it.
 *
 * @returns {{x, z, yaw}} yaw is the heading of a viewer looking down -z when 0
 */
export function viewingSpot({ x, yaw, z }, distance) {
  return { x: x + Math.sin(yaw) * distance, yaw, z: z + Math.cos(yaw) * distance };
}

/**
 * Square skylights in an even grid over the room, about `spacing` metres
 * apart, each centred in its share of the ceiling and never more than
 * `coverage` of that share across, so a small room still keeps ceiling
 * round its skylights.
 *
 * @returns {Array<{x, z, size}>} centres on the ceiling and side length, in metres
 */
export function layoutSkylights({ depth, width }, { coverage = 0.6, size = 1.4, spacing = 3.6 } = {}) {
  const across = Math.max(1, Math.round(width / spacing));
  const deep = Math.max(1, Math.round(depth / spacing));
  const side = Math.min(size, (width / across) * coverage, (depth / deep) * coverage);
  const skylights = [];

  for (let row = 0; row < deep; row += 1) {
    for (let column = 0; column < across; column += 1) {
      skylights.push({
        size: side,
        x: -width / 2 + (width * (column + 0.5)) / across,
        z: -depth / 2 + (depth * (row + 0.5)) / deep,
      });
    }
  }

  return skylights;
}
