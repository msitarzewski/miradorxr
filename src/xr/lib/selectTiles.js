/** @returns {Array<{key, level, x, y}>} every tile at a level */
export function tilesAtLevel(grid, level) {
  const { x: columns, y: rows } = grid.numTiles(level);
  const tiles = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) tiles.push({ key: grid.key(level, x, y), level, x, y });
  }
  return tiles;
}

/**
 * The deepest level that still has only a handful of tiles. It stays loaded
 * as a placeholder, so the image is never blank while finer tiles stream in.
 */
export function baseLevel(grid, maxTiles = 16) {
  let level = grid.minLevel;
  while (level < grid.maxLevel) {
    const { x, y } = grid.numTiles(level + 1);
    if (x * y > maxTiles) break;
    level += 1;
  }
  return level;
}

/**
 * Walks the pyramid from its coarsest level, refining a tile into the next
 * level only where it is visible and would be magnified, i.e. where it has
 * fewer pixels across than the display spends on it.
 *
 * @param {object} grid - from createTileGrid
 * @param {function} options.isVisible - (rect) => whether the tile is in view
 * @param {function} options.displayPixels - (rect) => display pixels across the tile
 * @returns {Array<{key, level, x, y}>} the tiles to draw
 */
export function selectTiles(grid, { isVisible, displayPixels }) {
  const selected = [];

  /** */
  const visit = (level, x, y) => {
    const rect = grid.bounds(level, x, y);
    if (!isVisible(rect)) return;

    if (level < grid.maxLevel && grid.pixelSize(level, x, y).w < displayPixels(rect)) {
      grid.children(level, x, y).forEach(([childX, childY]) => visit(level + 1, childX, childY));
      return;
    }

    selected.push({ key: grid.key(level, x, y), level, x, y });
  };

  tilesAtLevel(grid, grid.minLevel).forEach(({ level, x, y }) => visit(level, x, y));
  return selected;
}

/**
 * For each wanted tile, the tile itself if loaded, else its nearest loaded
 * ancestor, so coarser imagery fills in while finer tiles stream.
 *
 * @returns {Array<{key, level, x, y}>} tiles to draw, without duplicates
 */
export function resolveDrawList(grid, tiles, isLoaded) {
  const draw = new Map();

  tiles.forEach(({ level, x, y }) => {
    let tile = { level, x, y };
    while (tile && !isLoaded(grid.key(tile.level, tile.x, tile.y))) tile = grid.parent(tile.level, tile.x, tile.y);
    if (!tile) return;

    const key = grid.key(tile.level, tile.x, tile.y);
    draw.set(key, { key, ...tile });
  });

  return [...draw.values()];
}
