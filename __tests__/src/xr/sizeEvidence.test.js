import { dimensionStatements, measuredDimensions, physdimService, sizeEvidence } from '../../../src/xr/lib/sizeEvidence';

describe('measuredDimensions', () => {
  it('finds the National Gallery’s measurements from an image service id', () => {
    const size = measuredDimensions('https://media.nga.gov/iiif/public/objects/1/0/6/3/8/2/106382-primary-0-nativeres.ptif');
    expect(size.height).toBeCloseTo(0.5779);
    expect(size.width).toBeCloseTo(0.445);
  });

  it('has nothing for other images', () => {
    expect(measuredDimensions('https://iiif.bodleian.ox.ac.uk/iiif/image/9e8020d0')).toBeNull();
    expect(measuredDimensions(undefined)).toBeNull();
  });
});

describe('physdimService', () => {
  it('finds a Physical Dimensions service on a canvas or its image service', () => {
    const physdim = {
      '@context': 'http://iiif.io/api/annex/services/physdim/1/context.json',
      physicalScale: 0.0025,
      physicalUnits: 'in',
      profile: 'http://iiif.io/api/annex/services/physdim',
    };
    expect(physdimService({ service: physdim })).toEqual({ scale: 0.0025, units: 'in' });
    expect(physdimService({}, { service: [{ profile: 'level2' }, physdim] })).toEqual({ scale: 0.0025, units: 'in' });
    expect(physdimService({ service: { physicalScale: 0.1, physicalUnits: 'cm', type: 'PhysicalDimensions' } })).toEqual({
      scale: 0.1,
      units: 'cm',
    });
  });

  it('is null without one', () => {
    expect(physdimService({ service: { profile: 'http://iiif.io/api/image/2/level2.json' } }, undefined)).toBeNull();
  });
});

describe('sizeEvidence', () => {
  it('gathers the canvas’s statements before the manifest’s, as plain text', () => {
    const canvas = { __jsonld: {}, getHeight: () => 100, getWidth: () => 80 };
    const evidence = sizeEvidence({
      canvas,
      canvasMetadata: [{ label: 'Dimensions', values: ['<b>21.7 x 20 cm</b>'] }],
      imageService: { __jsonld: {}, id: 'https://example.org/iiif/image' },
      manifestMetadata: [{ label: 'Physical description', values: ['xvii, 520 pages ; 26 cm'] }],
    });
    expect(evidence).toEqual({
      measured: null,
      physdim: null,
      statements: ['Dimensions: 21.7 x 20 cm', 'Physical description: xvii, 520 pages ; 26 cm'],
    });
    expect(dimensionStatements(null)).toEqual([]);
  });
});
