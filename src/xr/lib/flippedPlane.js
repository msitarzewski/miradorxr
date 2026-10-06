import { PlaneGeometry } from 'three';

/**
 * A unit quad with V flipped, shared by every ImageBitmap-textured mesh.
 * ImageBitmaps ignore WebGL's flipY, so the geometry flips instead.
 */
export const flippedPlane = new PlaneGeometry(1, 1);

const { uv } = flippedPlane.attributes;
for (let i = 0; i < uv.count; i += 1) uv.setY(i, 1 - uv.getY(i));
