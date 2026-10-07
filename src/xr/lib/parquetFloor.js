import { RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three';

// Metres of floor the parquet scan covers before it repeats
export const PARQUET_TILE = 3.4;

const MAPS = {
  map: new URL('../assets/herringbone-parquet/colour.jpg', import.meta.url).href,
  normalMap: new URL('../assets/herringbone-parquet/normal.jpg', import.meta.url).href,
  roughnessMap: new URL('../assets/herringbone-parquet/roughness.jpg', import.meta.url).href,
};

/**
 * Loads the oak herringbone parquet, a scanned CC0 material, as standard
 * material maps that repeat every PARQUET_TILE metres of a floor whose
 * texture coordinates are in tiles.
 *
 * @param {number} options.anisotropy - from renderer.capabilities.getMaxAnisotropy()
 * @returns {Promise<{map, normalMap, roughnessMap}>} textures for meshStandardMaterial
 */
export async function loadParquet({ anisotropy = 1 } = {}) {
  const loader = new TextureLoader();
  const maps = await Promise.all(
    Object.entries(MAPS).map(async ([slot, url]) => {
      const texture = await loader.loadAsync(url);
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.anisotropy = anisotropy;
      if (slot === 'map') texture.colorSpace = SRGBColorSpace;
      return [slot, texture];
    }),
  );
  return Object.fromEntries(maps);
}
