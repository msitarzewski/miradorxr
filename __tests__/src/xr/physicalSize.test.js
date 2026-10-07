import { DEFAULT_HEIGHT, parseDimensions, physicalSize, sizeLine } from '../../../src/xr/lib/physicalSize';

describe('parseDimensions', () => {
  it('reads pairs in any unit, with decimals and fractions', () => {
    expect(parseDimensions('445 x 280 mm')).toEqual([{ first: 0.445, second: 0.28, text: '445 x 280 mm' }]);
    const [metric, imperial] = parseDimensions('overall: 41 × 32,5 cm (16 1/8 x 12 13/16 in.)');
    expect(metric.first).toBeCloseTo(0.41);
    expect(metric.second).toBeCloseTo(0.325);
    expect(imperial.first).toBeCloseTo(16.125 * 0.0254);
    expect(imperial.second).toBeCloseTo((12 + 13 / 16) * 0.0254);
  });

  it('ignores a depth, and reads a library record’s single height', () => {
    const [box] = parseDimensions('Dimensions: 30 x 20 x 5 cm');
    expect([box.first, box.second]).toEqual([0.3, 0.2]);
    expect(parseDimensions('xvii, 520 pages : illustrations ; 26 cm')).toEqual([{ first: 0.26, second: null, text: '26 cm' }]);
  });

  it('leaves out measurements of a frame, mount or written area', () => {
    const candidates = parseDimensions('Extent: ff. 48. Size of page: 324 x 245 mm. Size of written area: 291 x 226 mm.');
    expect(candidates.map(({ text }) => text)).toEqual(['324 x 245 mm']);
    expect(parseDimensions('framed: 80 x 60 cm')).toEqual([]);
  });

  it('finds nothing in text without measurements', () => {
    expect(parseDimensions('Waterbased colour on machine made paper')).toEqual([]);
    expect(parseDimensions(undefined)).toEqual([]);
  });
});

describe('physicalSize', () => {
  it('prefers a IIIF Physical Dimensions service', () => {
    const size = physicalSize(
      {
        measured: { height: 2, width: 1 },
        physdim: { canvasHeight: 4000, canvasWidth: 3000, scale: 0.01, units: 'cm' },
      },
      0.75,
    );
    expect(size).toMatchObject({ approximate: false, label: '40 × 30 cm', source: 'physdim' });
    expect(size.height).toBeCloseTo(0.4);
    expect(size.width).toBeCloseTo(0.3);
  });

  it('then the institution’s measurements, keeping the image’s proportions', () => {
    const size = physicalSize({ measured: { height: 0.578, width: 0.445 }, statements: ['26 cm'] }, 0.77);
    expect(size).toMatchObject({ label: '57.8 × 44.5 cm', source: 'measured' });
    expect(size.width).toBeCloseTo(0.578 * 0.77);
  });

  it('reads a statement height by width, or the other way round when that fits the image', () => {
    const portrait = physicalSize({ statements: ['Extent', '445 x 280 mm'] }, 280 / 445);
    expect(portrait.height).toBeCloseTo(0.445);
    const landscape = physicalSize({ statements: ['21.6 x 37 cm (Fragm. 1), 21.7 x 20 cm (Fragm. 2)'] }, 37 / 21.6);
    expect(landscape.height).toBeCloseTo(0.216);
  });

  it('picks the statement that fits the image', () => {
    const fragment = physicalSize({ statements: ['21.6 x 37 cm (Fragm. 1), 21.7 x 20 cm (Fragm. 2)'] }, 20 / 21.7);
    expect(fragment).toMatchObject({ label: '21.7 x 20 cm' });
    expect(fragment.height).toBeCloseTo(0.217);
  });

  it('takes a single length as the height, when no pair fits', () => {
    const book = physicalSize({ statements: ['volumes : illustrations ; 26 cm'] }, 0.66);
    expect(book).toMatchObject({ approximate: false, label: '26 cm tall' });
    expect(book.height).toBeCloseTo(0.26);
  });

  it('hangs a work 1 m tall when nothing fits, and says so', () => {
    const unknown = physicalSize({ statements: ['445 x 280 mm'] }, 2.5);
    expect(unknown).toMatchObject({ approximate: true, height: DEFAULT_HEIGHT, width: 2.5 });
    expect(physicalSize(undefined, 1).approximate).toBe(true);
  });
});

describe('sizeLine', () => {
  it('gives the recorded size, or how big a work without one is shown', () => {
    expect(sizeLine(physicalSize({ measured: { height: 0.578, width: 0.445 } }, 0.77))).toEqual(
      '57.8 × 44.5 cm · shown at actual size',
    );
    expect(sizeLine(physicalSize({}, 1.5))).toEqual('Size not recorded · shown 100 cm tall');
  });
});
