import {
  compareSpots,
  layoutGallery,
  layoutReadingRoom,
  layoutSkylights,
  planGallery,
  viewingSpot,
} from '../../../src/xr/lib/galleryLayout';
import { insideFloors } from '../../../src/xr/lib/floorTarget';

// 26 works with portrait, landscape and square proportions
const aspects = Array.from({ length: 26 }, (_, index) => [0.75, 1.35, 1, 0.8, 1.6][index % 5]);

describe('layoutGallery', () => {
  const { placements, room } = layoutGallery(aspects);

  it('hangs every work, sized from its aspect ratio', () => {
    expect(placements).toHaveLength(26);
    placements.forEach((placement, index) => {
      expect(placement.height).toEqual(1);
      expect(placement.width).toBeCloseTo(aspects[index]);
    });
  });

  it('keeps every work on a wall inside the room', () => {
    placements.forEach(({ x, z, width }) => {
      const onSideWall = Math.abs(Math.abs(x) - room.width / 2) < 0.1;
      const onEndWall = Math.abs(Math.abs(z) - room.depth / 2) < 0.1;
      expect(onSideWall || onEndWall).toBe(true);
      expect(Math.abs(x)).toBeLessThanOrEqual(room.width / 2);
      expect(Math.abs(z)).toBeLessThanOrEqual(room.depth / 2);
      expect(width).toBeGreaterThan(0);
    });
  });

  it('faces every work into the room', () => {
    placements.forEach(({ x, yaw, z }) => {
      // The painting's normal points from the wall towards the centre
      expect(Math.sin(yaw) * -x + Math.cos(yaw) * -z).toBeGreaterThan(0);
    });
  });

  it('leaves a gap between neighbours on the same wall', () => {
    for (let index = 1; index < placements.length; index += 1) {
      const a = placements[index - 1];
      const b = placements[index];
      if (a.yaw === b.yaw) {
        expect(Math.hypot(b.x - a.x, b.z - a.z) - (a.width + b.width) / 2).toBeGreaterThan(0.5);
      }
    }
  });

  it('starts on the front wall and runs clockwise', () => {
    expect(placements[0].z).toBeCloseTo(-room.depth / 2 + 0.05);
    expect(placements[1].x).toBeGreaterThan(placements[0].x);
    expect(placements[placements.length - 1].x).toBeCloseTo(-room.width / 2 + 0.05);
  });

  it('centres a single work on the front wall', () => {
    const single = layoutGallery([0.8]).placements[0];
    expect(single.x).toBeCloseTo(0);
    expect(single.yaw).toBeCloseTo(0);
  });
});

describe('viewingSpot', () => {
  it('stands out from the work along its normal, facing it', () => {
    const front = viewingSpot({ x: 1, yaw: 0, z: -4 }, 1.5);
    expect(front).toEqual({ x: 1, yaw: 0, z: -2.5 });

    const rightWall = viewingSpot({ x: 5, yaw: -Math.PI / 2, z: 0 }, 1.5);
    expect(rightWall.x).toBeCloseTo(3.5);
    expect(rightWall.z).toBeCloseTo(0);
  });
});

describe('layoutSkylights', () => {
  it('spreads skylights evenly over the ceiling, about 3.6 m apart', () => {
    const skylights = layoutSkylights({ depth: 11, width: 16.5 });
    expect(skylights).toHaveLength(15);
    expect(new Set(skylights.map(({ x }) => x.toFixed(3))).size).toEqual(5);
    expect(new Set(skylights.map(({ z }) => z.toFixed(3))).size).toEqual(3);
    expect(skylights[0]).toEqual({ size: 1.4, x: -6.6, z: expect.closeTo(-11 / 3) });
  });

  it('keeps every skylight clear of the walls and of each other', () => {
    const room = { depth: 11, width: 16.5 };
    const skylights = layoutSkylights(room);
    skylights.forEach(({ size, x, z }) => {
      expect(Math.abs(x) + size / 2).toBeLessThan(room.width / 2);
      expect(Math.abs(z) + size / 2).toBeLessThan(room.depth / 2);
    });
    expect(skylights[1].x - skylights[0].x).toBeGreaterThan(skylights[0].size);
  });

  it('shrinks the skylight to leave ceiling round it in a small room', () => {
    const skylights = layoutSkylights({ depth: 1.6, width: 2.4 });
    expect(skylights).toEqual([{ size: expect.closeTo(0.96), x: 0, z: 0 }]);
  });
});

describe('layoutGallery with a doorway', () => {
  const { doorway, placements, room } = layoutGallery(aspects, { doorway: 1.8 });

  it('keeps the middle of the back wall clear for the doorway', () => {
    expect(doorway).toEqual({ width: 1.8, x: 0, z: room.depth / 2 });
    placements
      .filter(({ z }) => Math.abs(z - room.depth / 2) < 0.1)
      .forEach(({ width, x }) => expect(Math.abs(x) - width / 2).toBeGreaterThan(0.9 + 0.9 - 1e-9));
  });

  it('still hangs every work, in order, on both sides of it', () => {
    expect(placements).toHaveLength(26);
    const back = placements.filter(({ z }) => Math.abs(z - room.depth / 2) < 0.1);
    expect(back.some(({ x }) => x > 0) && back.some(({ x }) => x < 0)).toBe(true);
    // Left to right as you face the back wall is +x to -x
    back.slice(1).forEach((placement, index) => expect(placement.x).toBeLessThan(back[index].x));
  });
});

describe('layoutReadingRoom', () => {
  it('sets lecterns in rows facing the door wall, the middle one opposite the door', () => {
    const { lecterns, room } = layoutReadingRoom(6, { front: 5 });
    expect(lecterns).toHaveLength(6);
    expect(room.z - room.depth / 2).toBeCloseTo(5);
    // Left to right as you walk in facing +z
    expect(lecterns.slice(0, 3).map(({ x }) => x)).toEqual([2.6, 0, -2.6]);
    expect(lecterns[0].z).toBeCloseTo(7.2);
    expect(lecterns[3].z).toBeCloseTo(9.8);
    lecterns.forEach(({ x, yaw, z }) => {
      expect(yaw).toBeCloseTo(Math.PI);
      expect(Math.abs(x)).toBeLessThan(room.width / 2 - 0.5);
      expect(z).toBeLessThan(room.z + room.depth / 2 - 1);
    });
  });

  it('centres a lone reading room on the origin', () => {
    const { room } = layoutReadingRoom(2);
    expect(room.z).toBeCloseTo(0);
  });
});

describe('planGallery', () => {
  it('joins the gallery to the reading room through a doorway you can walk through', () => {
    const { doorway, floors, lecterns, placements, rooms } = planGallery(aspects, 6);
    expect(placements).toHaveLength(26);
    expect(lecterns).toHaveLength(6);
    expect(rooms.map(({ door, name }) => [name, door])).toEqual([
      ['gallery', 2],
      ['reading', 0],
    ]);
    expect(rooms[1].z - rooms[1].depth / 2).toBeCloseTo(doorway.z + doorway.thickness);

    // From the gallery, through the doorway, into the reading room
    const path = [rooms[0].z, doorway.z, doorway.z + doorway.thickness / 2, rooms[1].z].map((z) => ({ x: 0, z }));
    path.forEach((spot) => expect(insideFloors(spot, floors)).toEqual(spot));
  });

  it('has just the gallery without books, and just the reading room without paintings', () => {
    expect(planGallery(aspects, 0)).toMatchObject({ doorway: null, lecterns: [] });
    expect(planGallery(aspects, 0).rooms.map(({ door }) => door)).toEqual([null]);
    const books = planGallery([], 3);
    expect(books.rooms.map(({ name }) => name)).toEqual(['reading']);
    expect(books.placements).toEqual([]);
  });
});

describe('compareSpots', () => {
  const head = { x: 2, yaw: 0, z: 3 };

  it('floats the pair side by side in front of you, first on the left, facing you', () => {
    const [left, right] = compareSpots(head, [0.8, 0.6], { height: 1.4 });
    expect(left.x).toBeLessThan(head.x);
    expect(right.x).toBeGreaterThan(head.x);
    [left, right].forEach((spot) => {
      expect(spot.z).toBeCloseTo(head.z - 1.15);
      expect(spot.y).toEqual(1.4);
      // Facing back at you: the work's normal points from it to your head
      const normal = { x: Math.sin(spot.yaw), z: Math.cos(spot.yaw) };
      const toHead = { x: head.x - spot.x, z: head.z - spot.z };
      expect(normal.x * toHead.z - normal.z * toHead.x).toBeCloseTo(0);
    });
    expect(right.x - 0.3 - (left.x + 0.4)).toBeCloseTo(0.25);
  });

  it('scales a wide pair down to fit, and follows your heading', () => {
    const spots = compareSpots({ x: 0, yaw: Math.PI / 2, z: 0 }, [1.6, 1.6], { height: 1.2 });
    expect(spots[0].scale).toBeCloseTo(1.7 / 3.45);
    // Facing -x (yaw +90 degrees): in front is -x, and your left is +z
    spots.forEach(({ x }) => expect(x).toBeCloseTo(-1.15));
    expect(spots[0].z).toBeGreaterThan(spots[1].z);
  });
});
