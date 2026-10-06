import { floorHit, handHeading, insideRoom } from '../../../src/xr/lib/floorTarget';

describe('floorHit', () => {
  it('finds where a downward gaze meets the floor', () => {
    const hit = floorHit({ x: 0, y: 1.2, z: 0 }, { x: 0, y: -Math.SQRT1_2, z: -Math.SQRT1_2 });
    expect(hit.x).toBeCloseTo(0);
    expect(hit.z).toBeCloseTo(-1.2);
  });

  it('is null looking level or up, or too far away', () => {
    expect(floorHit({ x: 0, y: 1.2, z: 0 }, { x: 0, y: 0, z: -1 })).toBeNull();
    expect(floorHit({ x: 0, y: 1.2, z: 0 }, { x: 0, y: 0.5, z: -0.8 })).toBeNull();
    expect(floorHit({ x: 0, y: 1.2, z: 0 }, { x: 0, y: -0.05, z: -0.99 }, 20)).toBeNull();
  });
});

describe('insideRoom', () => {
  const room = { depth: 8, width: 12 };

  it('leaves spots inside the room alone, right up to near the walls', () => {
    expect(insideRoom({ x: 5.8, z: -3.8 }, room)).toEqual({ x: 5.8, z: -3.8 });
  });

  it('keeps spots 15 cm clear of the walls', () => {
    const spot = insideRoom({ x: 6.5, z: -4.2 }, room);
    expect(spot.x).toBeCloseTo(5.85);
    expect(spot.z).toBeCloseTo(-3.85);
  });
});

describe('handHeading', () => {
  it('keeps the current heading until the hand has moved 3 cm', () => {
    expect(handHeading({ x: 0.02, z: 0 }, 0.3)).toEqual(0.3);
  });

  it('faces the way the hand moved: left, forward, or back towards you', () => {
    expect(handHeading({ x: -0.1, z: 0 }, 0)).toBeCloseTo(Math.PI / 2);
    expect(handHeading({ x: 0, z: -0.1 }, 1)).toBeCloseTo(0);
    expect(Math.abs(handHeading({ x: 0, z: 0.1 }, 0))).toBeCloseTo(Math.PI);
  });
});
