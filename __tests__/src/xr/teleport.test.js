import { angleBetween, headingOf, originForSpot } from '../../../src/xr/lib/teleport';

/** Where the head ends up in the world once the origin transform is applied */
function headInWorld(origin, head) {
  const cos = Math.cos(origin.yaw);
  const sin = Math.sin(origin.yaw);
  return {
    x: origin.x + cos * head.x + sin * head.z,
    yaw: origin.yaw + head.yaw,
    z: origin.z - sin * head.x + cos * head.z,
  };
}

describe('originForSpot', () => {
  it('moves a head at the origin straight to the spot', () => {
    expect(originForSpot({ x: 0, yaw: 0, z: 0 }, { x: 2, yaw: 0, z: -3 })).toEqual({ x: 2, yaw: 0, z: -3 });
  });

  it('lands an offset, turned head exactly on the spot and heading', () => {
    const head = { x: 0.3, yaw: 0.5, z: -0.2 };
    const spot = { x: 4, yaw: -Math.PI / 2, z: 1.5 };
    const landed = headInWorld(originForSpot(head, spot), head);

    expect(landed.x).toBeCloseTo(spot.x);
    expect(landed.z).toBeCloseTo(spot.z);
    expect(landed.yaw).toBeCloseTo(spot.yaw);
  });
});

describe('headings', () => {
  it('follows three.js: 0 looks down -z, positive turns left', () => {
    expect(headingOf(0, -1)).toBeCloseTo(0);
    expect(headingOf(-1, 0)).toBeCloseTo(Math.PI / 2);
  });

  it('measures the short way round', () => {
    expect(angleBetween(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(angleBetween(0.2, 0.5)).toBeCloseTo(0.3);
  });
});
