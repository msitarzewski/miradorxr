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

// The doorway to the reading room is in the middle of the back wall, the one
// you face when you turn round from the start
const DOOR_WALL = 2;

const totalWidth = (widths) => widths.reduce((sum, width) => sum + width, 0);
const fitsRun = (widths, length) => totalWidth(widths) + (widths.length + 1) * MIN_GAP <= length;

/** The stretches of a wall that can be hung: all of it, or either side of a central doorway */
const runsOf = (length, doorway) => (doorway ? [(length - doorway) / 2, (length - doorway) / 2] : [length]);

/**
 * How many of a wall's paintings, in order, hang on each of its runs: the
 * split that fits with the two sides of a doorway most evenly filled, or
 * null if they don't fit
 */
function splitAcrossRuns(widths, runs) {
  if (runs.length === 1) return fitsRun(widths, runs[0]) ? [widths.length] : null;

  let best = null;
  for (let split = 0; split <= widths.length; split += 1) {
    const [first, second] = [widths.slice(0, split), widths.slice(split)];
    const imbalance = Math.abs(totalWidth(first) - totalWidth(second));
    if (fitsRun(first, runs[0]) && fitsRun(second, runs[1]) && !(best && best.imbalance <= imbalance)) {
      best = { counts: [split, widths.length - split], imbalance };
    }
  }
  return best && best.counts;
}

const wallLength = (wall, [roomWidth, roomDepth]) => (WALLS[wall].side === 'width' ? roomWidth : roomDepth);

/** Fills walls in order; returns the paintings per wall, or null if they don't fit */
function fillWalls(widths, size, doorway) {
  const walls = WALLS.map(() => []);
  let wall = 0;

  for (let index = 0; index < widths.length;) {
    if (wall >= WALLS.length) return null;
    const runs = runsOf(wallLength(wall, size), wall === DOOR_WALL ? doorway : 0);
    if (
      splitAcrossRuns(
        [...walls[wall], index].map((i) => widths[i]),
        runs,
      )
    ) {
      walls[wall].push(index);
      index += 1;
    } else {
      wall += 1;
    }
  }

  return walls;
}

/**
 * Hangs works around a rectangular room centred on the origin, in order,
 * with each wall's paintings evenly spaced. With a `doorway` (metres wide),
 * the middle of the back wall is left clear for it.
 *
 * @param {number[]} aspectRatios - width / height of each work, in order
 * @param {number} options.paintingHeight - display height of every work
 * @param {number} options.doorway - width to keep clear for a doorway, if any
 * @returns {{room: {width, depth}, placements: Array<{x, z, yaw, width, height}>, doorway: {x, z, width}|null}}
 * where (x, z) is the painting's centre on the wall and yaw turns a
 * painting facing +z to face into the room; the doorway's (x, z) is the
 * middle of its opening on the floor
 */
export function layoutGallery(aspectRatios, { doorway = 0, paintingHeight = 1 } = {}) {
  const widths = aspectRatios.map((aspect) => paintingHeight * aspect);
  const total = widths.reduce((sum, width) => sum + width + MIN_GAP, MIN_GAP) + doorway;

  // Start from a room whose perimeter just fits, and grow until every wall fits
  let perimeter = Math.max(total, 8);
  let size;
  let walls;
  do {
    const depth = perimeter / (2 * (1 + ROOM_ASPECT));
    size = [depth * ROOM_ASPECT, depth];
    walls = fillWalls(widths, size, doorway);
    perimeter *= 1.05;
  } while (!walls);

  const placements = new Array(widths.length);
  walls.forEach((indices, wallIndex) => {
    const wall = WALLS[wallIndex];
    const runs = runsOf(wallLength(wallIndex, size), wallIndex === DOOR_WALL ? doorway : 0);
    const counts = splitAcrossRuns(
      indices.map((index) => widths[index]),
      runs,
    );
    const [startX, startZ] = wall.start(size);
    let first = 0;

    runs.forEach((run, runIndex) => {
      const hung = indices.slice(first, first + counts[runIndex]);
      const gap = (run - totalWidth(hung.map((index) => widths[index]))) / (hung.length + 1);
      let offset = (runIndex === 0 ? 0 : runs[0] + doorway) + gap;
      first += counts[runIndex];

      hung.forEach((index) => {
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
  });

  return {
    doorway: doorway ? { width: doorway, x: 0, z: size[1] / 2 } : null,
    placements,
    room: { depth: size[1], width: size[0] },
  };
}

// Metres between lecterns, and from the reading room's door wall to the first row
const LECTERN_SPACING = 2.6;
const FIRST_ROW = 2.2;
const BEHIND_LAST_ROW = 1.8;

/**
 * The reading room: lecterns in rows facing its door wall, so you walk in,
 * stand in front of one and read. They go in order left to right, front
 * row first, as you look in from the door. Its door wall is at z = `front` (the far
 * side of the gallery's back wall), or the room is centred on the origin
 * when it's the only room.
 *
 * @returns {{room: {x, z, width, depth}, lecterns: Array<{x, z, yaw}>}} yaw
 * turns a lectern whose reading side faces +z to face the door wall
 */
export function layoutReadingRoom(count, { front = null } = {}) {
  const columns = Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count * 1.5))));
  const rows = Math.max(1, Math.ceil(count / columns));
  const width = Math.max(columns * LECTERN_SPACING + 1.4, 6);
  const depth = FIRST_ROW + (rows - 1) * LECTERN_SPACING + BEHIND_LAST_ROW;
  const doorWall = front ?? -depth / 2;

  const lecterns = Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const inRow = row < rows - 1 ? columns : count - columns * (rows - 1);
    return {
      // Walking in from the door you face +z, so left to right runs from +x to -x
      x: ((inRow - 1) / 2 - (index % columns)) * LECTERN_SPACING,
      yaw: Math.PI,
      z: doorWall + FIRST_ROW + row * LECTERN_SPACING,
    };
  });

  return { lecterns, room: { depth, width, x: 0, z: doorWall + depth / 2 } };
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

export const DOORWAY = { height: 2.6, width: 1.8 };
// Metres of wall between the gallery and the reading room, seen as the doorway's reveal
export const WALL_THICKNESS = 0.25;
const WALL_CLEARANCE = 0.15;

/**
 * The whole visit: the gallery hung with `aspectRatios.length` works and,
 * when there are books, a reading room of lecterns beyond a doorway in its
 * back wall. Either room can be missing: a manifest that's all books opens
 * straight into the reading room.
 *
 * Rooms are `{x, z, width, depth, door}` boxes, `door` naming the wall (as
 * GalleryRoom numbers them: 0 front, 1 right, 2 back, 3 left) with the
 * doorway at its middle. `floors` are where you can land: the rooms, clear
 * of their walls, and the doorway between them.
 */
export function planGallery(aspectRatios, bookCount) {
  const hall = aspectRatios.length > 0 ? layoutGallery(aspectRatios, { doorway: bookCount > 0 ? DOORWAY.width : 0 }) : null;
  const reading =
    bookCount > 0 ? layoutReadingRoom(bookCount, { front: hall ? hall.room.depth / 2 + WALL_THICKNESS : null }) : null;
  const doorway = hall?.doorway && reading ? { ...DOORWAY, thickness: WALL_THICKNESS, x: 0, z: hall.doorway.z } : null;

  const rooms = [
    hall && { ...hall.room, door: doorway ? 2 : null, name: 'gallery', x: 0, z: 0 },
    reading && { ...reading.room, door: doorway ? 0 : null, name: 'reading' },
  ].filter(Boolean);
  const floors = [
    ...rooms,
    // Overlapping both rooms' floors, so you can land anywhere through the doorway
    doorway && {
      depth: WALL_THICKNESS + 2 * WALL_CLEARANCE,
      margin: { x: WALL_CLEARANCE, z: 0 },
      width: DOORWAY.width,
      x: 0,
      z: doorway.z + WALL_THICKNESS / 2,
    },
  ].filter(Boolean);

  return { doorway, floors, lecterns: reading?.lecterns ?? [], placements: hall?.placements ?? [], rooms };
}

/**
 * Where two works float to be compared: side by side in front of a viewer
 * at `head` ({x, z, yaw}), `distance` metres out at eye `height`, the first
 * on the left, each turned to face the viewer, and scaled down together if
 * need be so the pair spans no more than `maxWidth` metres.
 *
 * @param {number[]} widths - the two works' widths, metres
 * @returns {Array<{x, y, z, yaw, scale}>} yaw turns a work facing +z to face the viewer
 */
export function compareSpots(head, widths, { distance = 1.15, gap = 0.25, height, maxWidth = 1.7 }) {
  const scale = Math.min(1, maxWidth / (widths[0] + widths[1] + gap));
  // A heading of 0 looks down -z
  const centre = { x: head.x - Math.sin(head.yaw) * distance, z: head.z - Math.cos(head.yaw) * distance };
  const right = { x: Math.cos(head.yaw), z: -Math.sin(head.yaw) };
  const offsets = [-(widths[0] * scale + gap) / 2, (widths[1] * scale + gap) / 2];

  return offsets.map((offset) => {
    const x = centre.x + right.x * offset;
    const z = centre.z + right.z * offset;
    return { scale, x, y: height, yaw: Math.atan2(head.x - x, head.z - z), z };
  });
}
