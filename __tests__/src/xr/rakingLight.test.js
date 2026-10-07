import { Vector3 } from 'three';
import { dragLight, lightSpot, MIN_LIFT, onWorkPlane } from '../../../src/xr/lib/rakingLight';

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

describe('dragLight', () => {
  const radius = 0.6;
  const start = new Vector3(-0.6, 0.6, 0.45).normalize();

  it('leaves the light where it was until the pinch moves', () => {
    const light = dragLight(lightSpot(start, radius), { x: 1, y: 1 }, { x: 1, y: 1 }, radius, new Vector3());
    expect(light.x).toBeCloseTo(start.x);
    expect(light.y).toBeCloseTo(start.y);
    expect(light.z).toBeCloseTo(start.z);
  });

  it('rakes lower from the side the pinch moves towards', () => {
    const light = dragLight(lightSpot(start, radius), { x: 0, y: 0 }, { x: -1, y: 0 }, radius, new Vector3());
    expect(light.x).toBeLessThan(start.x);
    expect(light.z).toBeLessThan(start.z);
    expect(light.length()).toBeCloseTo(1);
  });

  it('brings the light round in front when the pinch moves back over the centre', () => {
    const spot = lightSpot(start, radius);
    const light = dragLight(spot, { x: 0, y: 0 }, { x: -spot.x, y: -spot.y }, radius, new Vector3());
    expect(light.toArray().map((value) => Math.round(value * 1e6) / 1e6)).toEqual([0, 0, 1]);
  });

  it('never goes behind or flush with the surface', () => {
    const light = dragLight({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 50, y: 0 }, radius, new Vector3());
    expect(light.z).toBeCloseTo(MIN_LIFT);
    expect(light.length()).toBeCloseTo(1);
  });
});
