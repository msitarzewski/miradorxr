import info from '../../fixtures/version-2/nga-106382-info.json';
import { createTileGrid } from '../../../src/xr/lib/tileGrid';

const SERVICE = 'https://api.nga.gov/iiif/public/objects/1/0/6/3/8/2/106382-primary-0-nativeres.ptif';

describe('createTileGrid', () => {
  const grid = createTileGrid(info);

  it('reads the image pyramid from info.json', () => {
    expect(grid).toMatchObject({ height: 28273, id: SERVICE, maxLevel: 8, minLevel: 0, width: 21687 });
    expect(grid.aspectRatio).toBeCloseTo(28273 / 21687);
  });

  it('counts 256px tiles per level', () => {
    expect(grid.numTiles(0)).toEqual({ x: 1, y: 1 });
    expect(grid.numTiles(3)).toEqual({ x: 3, y: 4 });
    expect(grid.numTiles(8)).toEqual({ x: 85, y: 111 });
  });

  it('builds IIIF Image API tile URLs', () => {
    expect(grid.url(8, 0, 0)).toEqual(`${SERVICE}/0,0,256,256/256,/0/default.jpg`);
    expect(grid.url(3, 0, 0)).toEqual(`${SERVICE}/0,0,8192,8192/256,/0/default.jpg`);
    expect(grid.url(8, 84, 110)).toEqual(`${SERVICE}/21504,28160,183,113/183,/0/default.jpg`);
  });

  it('normalizes bounds to the image width', () => {
    const last = grid.bounds(8, 84, 110);
    expect(last.x + last.w).toBeCloseTo(1);
    expect(last.y + last.h).toBeCloseTo(grid.aspectRatio);
  });

  it('finds the next-level tiles covering a tile', () => {
    expect(grid.children(3, 1, 1)).toEqual([
      [2, 2],
      [3, 2],
      [2, 3],
      [3, 3],
    ]);
    expect(grid.children(7, 42, 55)).toEqual([[84, 110]]);
    expect(grid.children(8, 0, 0)).toEqual([]);
  });

  it("finds each child's parent", () => {
    grid.children(5, 4, 9).forEach(([x, y]) => expect(grid.parent(6, x, y)).toEqual({ level: 5, x: 4, y: 9 }));
    expect(grid.parent(0, 0, 0)).toBeNull();
  });

  it('keys tiles uniquely across images', () => {
    expect(grid.key(8, 1, 2)).toEqual(`${SERVICE}|8/1/2`);
  });
});
