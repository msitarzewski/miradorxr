import { angleBetween, headingOf, originForSpot, stationInFront } from '../../../src/xr/lib/teleport';

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

describe('stationInFront', () => {
  // A painting on the front wall facing +z, and a lectern behind you facing -z
  const stations = [
    { view: 1.5, x: 0, yaw: 0, z: -4 },
    { view: 0.75, x: 0, yaw: Math.PI, z: 4 },
  ];

  it('finds the station you are standing in front of and facing', () => {
    expect(stationInFront({ x: 0.3, yaw: 0, z: -2.4 }, stations)).toEqual(0);
    expect(stationInFront({ x: 0, yaw: Math.PI, z: 3.2 }, stations)).toEqual(1);
  });

  it('finds none when you are too far away, behind it, or looking elsewhere', () => {
    expect(stationInFront({ x: 0, yaw: 0, z: 0 }, stations)).toEqual(-1);
    expect(stationInFront({ x: 0, yaw: Math.PI, z: -4.5 }, stations)).toEqual(-1);
    expect(stationInFront({ x: 0, yaw: Math.PI / 2, z: -2.4 }, stations)).toEqual(-1);
  });
});
