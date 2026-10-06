import OpenSeadragon from 'openseadragon';

/**
 * Wraps OpenSeadragon's IIIFTileSource, used without a viewer, so the XR
 * renderer shares Mirador's IIIF level, tile and URL logic (v1/v2/v3).
 *
 * Rects are normalized like OpenSeadragon's: x and y are both in units of
 * the image width, so the image spans [0, 1] x [0, height / width].
 *
 * @param {object} infoJson - IIIF Image API info.json
 */
export function createTileGrid(infoJson) {
  const id = infoJson['@id'] || infoJson.id;
  // configure() mutates its input (it sets the IIIF version), so pass a copy
  const options = OpenSeadragon.IIIFTileSource.prototype.configure({ ...infoJson }, `${id}/info.json`);
  const source = new OpenSeadragon.IIIFTileSource(options);

  /** @returns {{x: number, y: number}} tile columns and rows at a level */
  const numTiles = (level) => {
    const { x, y } = source.getNumTiles(level);
    return { x, y };
  };

  /** @returns {{x, y, w, h}} normalized bounds of a tile */
  const bounds = (level, x, y) => {
    const rect = source.getTileBounds(level, x, y);
    return { h: rect.height, w: rect.width, x: rect.x, y: rect.y };
  };

  /** @returns {{w, h}} the tile's size in pixels at its level */
  const pixelSize = (level, x, y) => {
    const rect = source.getTileBounds(level, x, y, true);
    return { h: rect.height, w: rect.width };
  };

  /** @returns {Array<[number, number]>} the tiles at level + 1 that cover this tile */
  const children = (level, x, y) => {
    if (level >= source.maxLevel) return [];

    const parent = bounds(level, x, y);
    const next = level + 1;
    const { x: columns, y: rows } = numTiles(next);
    const first = bounds(next, 0, 0);
    const x0 = Math.floor(parent.x / first.w + 1e-9);
    const y0 = Math.floor(parent.y / first.h + 1e-9);
    const x1 = Math.min(columns - 1, Math.ceil((parent.x + parent.w) / first.w - 1e-9) - 1);
    const y1 = Math.min(rows - 1, Math.ceil((parent.y + parent.h) / first.h - 1e-9) - 1);

    const result = [];
    for (let cy = y0; cy <= y1; cy += 1) {
      for (let cx = x0; cx <= x1; cx += 1) result.push([cx, cy]);
    }
    return result;
  };

  /** @returns {{level, x, y}|null} the tile at level - 1 that contains this tile */
  const parent = (level, x, y) => {
    if (level <= source.minLevel) return null;

    const rect = bounds(level, x, y);
    const previous = level - 1;
    const first = bounds(previous, 0, 0);
    return {
      level: previous,
      x: Math.floor(rect.x / first.w + 1e-9),
      y: Math.floor(rect.y / first.h + 1e-9),
    };
  };

  return {
    aspectRatio: source.dimensions.y / source.dimensions.x,
    bounds,
    children,
    height: source.dimensions.y,
    id,
    /** Cache key, unique across images */
    key: (level, x, y) => `${id}|${level}/${x}/${y}`,
    maxLevel: source.maxLevel,
    minLevel: source.minLevel,
    numTiles,
    parent,
    pixelSize,
    url: (level, x, y) => source.getTileUrl(level, x, y),
    width: source.dimensions.x,
  };
}
