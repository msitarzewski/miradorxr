/**
 * Where the viewer's head is pointed on an image, in the image's local space:
 * metres, image centred on the origin in the z = 0 plane, facing +z.
 *
 * @param {{x, y, z}} options.origin - head position
 * @param {{x, y, z}} options.direction - unit forward vector
 * @param {number} options.tanHalfFov - tan of half the horizontal field of view
 * @returns {{x, y, span}|null} x and y as fractions of the image's width and
 * height from its top-left; span as the fraction of the image's width in view.
 * Null when the head isn't pointed at the image.
 */
export function viewOnImage({ direction, height, origin, tanHalfFov, width }) {
  if (origin.z <= 0 || direction.z >= 0) return null;

  const distance = -origin.z / direction.z;
  const hitX = origin.x + direction.x * distance;
  const hitY = origin.y + direction.y * distance;
  if (Math.abs(hitX) > width / 2 || Math.abs(hitY) > height / 2) return null;

  return {
    span: (2 * distance * tanHalfFov) / width,
    x: hitX / width + 0.5,
    y: 0.5 - hitY / height,
  };
}

/**
 * The Mirador (OpenSeadragon) viewport that shows the same view of the image:
 * its centre in world coordinates, and a zoom where 1 / zoom is the viewport
 * width in world units.
 *
 * @param {{x, y, span}} view - from viewOnImage
 * @param {number[]} worldRect - the image's [x, y, width, height] in Mirador's world
 */
export function toMiradorViewport(view, [worldX, worldY, worldWidth, worldHeight]) {
  return {
    x: worldX + view.x * worldWidth,
    y: worldY + view.y * worldHeight,
    zoom: 1 / (view.span * worldWidth),
  };
}
