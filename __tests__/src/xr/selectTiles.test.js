import info from '../../fixtures/version-2/nga-106382-info.json';
import { createTileGrid } from '../../../src/xr/lib/tileGrid';
import { baseLevel, resolveDrawList, selectTiles, tilesAtLevel } from '../../../src/xr/lib/selectTiles';

const grid = createTileGrid(info);
const everywhere = () => true;

/** Display pixels for a tile when the whole image spans `across` display pixels */
const imageSpans = (across) => (rect) => rect.w * across;

/** Whether a rect overlaps the region [x0, x1] x [y0, y1] */
const overlaps =
  ([x0, y0, x1, y1]) =>
  (rect) =>
    rect.x < x1 && rect.x + rect.w > x0 && rect.y < y1 && rect.y + rect.h > y0;

describe('baseLevel', () => {
  it('is the deepest level with at most 16 tiles', () => {
    expect(baseLevel(grid)).toEqual(3);
    expect(tilesAtLevel(grid, 3)).toHaveLength(12);
  });
});

describe('selectTiles', () => {
  it('stops at the first level with enough pixels for a distant view', () => {
    // 500 display px across needs 677 px (level 3), not 338 px (level 2)
    const tiles = selectTiles(grid, { displayPixels: imageSpans(500), isVisible: everywhere });
    expect(new Set(tiles.map(({ level }) => level))).toEqual(new Set([3]));
    expect(tiles).toHaveLength(12);
  });

  it('refines to full resolution only where a close view is looking', () => {
    const region = [0.4, 0.5, 0.42, 0.52];
    const tiles = selectTiles(grid, { displayPixels: imageSpans(1e6), isVisible: overlaps(region) });

    expect(tiles.length).toBeGreaterThan(0);
    tiles.forEach((tile) => {
      expect(tile.level).toEqual(grid.maxLevel);
      expect(overlaps(region)(grid.bounds(tile.level, tile.x, tile.y))).toBe(true);
    });
  });

  it('never refines past full resolution', () => {
    const tiles = selectTiles(grid, { displayPixels: () => Infinity, isVisible: overlaps([0, 0, 0.01, 0.01]) });
    expect(Math.max(...tiles.map(({ level }) => level))).toEqual(grid.maxLevel);
  });

  it('selects nothing out of view', () => {
    expect(selectTiles(grid, { displayPixels: imageSpans(500), isVisible: () => false })).toEqual([]);
  });
});

describe('resolveDrawList', () => {
  it('draws a loaded tile as itself', () => {
    const tile = { key: grid.key(8, 10, 10), level: 8, x: 10, y: 10 };
    expect(resolveDrawList(grid, [tile], () => true)).toEqual([tile]);
  });

  it('falls back to the nearest loaded ancestor, once per ancestor', () => {
    const parent = { level: 5, x: 4, y: 9 };
    const children = grid.children(5, 4, 9).map(([x, y]) => ({ key: grid.key(6, x, y), level: 6, x, y }));
    const loaded = new Set([grid.key(parent.level, parent.x, parent.y)]);

    expect(resolveDrawList(grid, children, (key) => loaded.has(key))).toEqual([{ key: grid.key(5, 4, 9), ...parent }]);
  });

  it('draws nothing until some ancestor is loaded', () => {
    expect(resolveDrawList(grid, [{ level: 8, x: 1, y: 1 }], () => false)).toEqual([]);
  });
});
