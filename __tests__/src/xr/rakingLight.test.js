import { Vector3 } from 'three';
import { lampLight, MIN_LIFT, onWorkPlane } from '../../../src/xr/lib/rakingLight';

describe('onWorkPlane', () => {
  it('finds where a ray from in front meets the work', () => {
    const point = onWorkPlane({ direction: new Vector3(-0.6, 0, -0.8), origin: new Vector3(0, 0.2, 2) });
    expect(point.x).toBeCloseTo(-1.5);
    expect(point.y).toBeCloseTo(0.2);
  });

  it('is null for a ray pointing away from the work', () => {
    expect(onWorkPlane({ direction: new Vector3(0, 0, 1), origin: new Vector3(0, 0, 2) })).toBeNull();
  });
});

describe('lampLight', () => {
  it('shines from the work towards wherever the lamp is held', () => {
    const light = new Vector3();
    const distance = lampLight(new Vector3(-0.3, 0.4, 0.5), light);
    expect(light.toArray().map((value) => Number(value.toFixed(3)))).toEqual([-0.424, 0.566, 0.707]);
    expect(distance).toBeCloseTo(Math.hypot(0.3, 0.4, 0.5));
  });

  it('follows the lamp right round to the side, but never behind or flush with the surface', () => {
    const light = new Vector3();
    lampLight(new Vector3(0.6, 0, -0.2), light);
    expect(light.z).toBeCloseTo(MIN_LIFT);
    expect(light.x).toBeGreaterThan(0.95);
    expect(light.length()).toBeCloseTo(1);
  });

  it('keeps the lamp within reach of the work', () => {
    const light = new Vector3();
    expect(lampLight(new Vector3(0, 0, 0.05), light)).toEqual(0.25);
    expect(lampLight(new Vector3(0, 0, 9), light)).toEqual(2.5);
    expect(lampLight(new Vector3(0, 0, 0), light)).toEqual(0.25);
    expect(light.toArray()).toEqual([0, 0, 1]);
  });
});
