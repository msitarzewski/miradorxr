import { layoutGallery, viewingSpot } from '../../../src/xr/lib/galleryLayout';

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
