import { toMiradorViewport, viewOnImage } from '../../../src/xr/lib/viewOnImage';

// A 0.8 m x 1 m image, viewed with a 90 degree horizontal field of view
const image = { height: 1, tanHalfFov: 1, width: 0.8 };
const forward = { x: 0, y: 0, z: -1 };

describe('viewOnImage', () => {
  it('finds the centre of the image when looking straight at it', () => {
    const view = viewOnImage({ ...image, direction: forward, origin: { x: 0, y: 0, z: 2 } });
    expect(view.x).toBeCloseTo(0.5);
    expect(view.y).toBeCloseTo(0.5);
    // 2 m away, a 90 degree view spans 4 m: five image widths
    expect(view.span).toBeCloseTo(5);
  });

  it('measures x from the left and y from the top', () => {
    const view = viewOnImage({ ...image, direction: forward, origin: { x: -0.2, y: 0.25, z: 0.2 } });
    expect(view.x).toBeCloseTo(0.25);
    expect(view.y).toBeCloseTo(0.25);
    expect(view.span).toBeCloseTo(0.5);
  });

  it('follows an angled gaze to where it meets the image', () => {
    const direction = { x: Math.SQRT1_2, y: 0, z: -Math.SQRT1_2 };
    const view = viewOnImage({ ...image, direction, origin: { x: -0.2, y: 0, z: 0.2 } });
    expect(view.x).toBeCloseTo(0.5);
  });

  it('is null when looking away from the image or past its edge', () => {
    expect(viewOnImage({ ...image, direction: { x: 0, y: 0, z: 1 }, origin: { x: 0, y: 0, z: 1 } })).toBeNull();
    expect(viewOnImage({ ...image, direction: forward, origin: { x: 1, y: 0, z: 1 } })).toBeNull();
    expect(viewOnImage({ ...image, direction: forward, origin: { x: 0, y: 0, z: -1 } })).toBeNull();
  });
});

describe('toMiradorViewport', () => {
  it("centres the 2D viewer on the same spot of the image's world rect", () => {
    const viewport = toMiradorViewport({ span: 0.5, x: 0.25, y: 0.75 }, [100, 0, 400, 500]);
    expect(viewport).toEqual({ x: 200, y: 375, zoom: 1 / 200 });
  });
});
