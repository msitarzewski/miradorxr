import { LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, Texture } from 'three';

/**
 * Returns a TileCache loader: fetches a IIIF tile with CORS (WebGL cannot
 * sample cross-origin images without it) and decodes it with
 * createImageBitmap. ImageBitmaps ignore WebGL's flipY, so the tile geometry
 * flips its UVs instead. The bitmap is closed once uploaded to the GPU, so
 * each tile is held in GPU memory only.
 *
 * @param {number} options.anisotropy - from renderer.capabilities.getMaxAnisotropy()
 */
export function createTileLoader({ anisotropy = 1 } = {}) {
  return async (url, signal) => {
    const response = await fetch(url, { mode: 'cors', signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const bitmap = await createImageBitmap(await response.blob());
    const texture = new Texture(bitmap);
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.anisotropy = anisotropy;
    texture.onUpdate = () => bitmap.close();
    texture.needsUpdate = true;

    // RGBA8 plus a full mip chain
    return { bytes: Math.round(bitmap.width * bitmap.height * 4 * (4 / 3)), texture };
  };
}
