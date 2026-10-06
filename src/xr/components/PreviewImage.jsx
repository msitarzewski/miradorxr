import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useThree } from '@react-three/fiber';
import { MeshBasicMaterial } from 'three';
import { createTileLoader } from '../lib/loadTileTexture';
import { flippedPlane } from '../lib/flippedPlane';
import { applyPaintRelief } from '../lib/paintRelief';

/**
 * A single preview image of a work, shown while you aren't at it and kept
 * behind the deep-zoom tiles when you are. Loaded with the same CORS
 * ImageBitmap loader as the tiles, and fitted inside the width x height box
 * at its own proportions, so it never stretches. Shares the gallery's paint
 * relief lighting.
 */
export function PreviewImage({ height, paint, url, width, ...meshProps }) {
  const gl = useThree((state) => state.gl);
  const load = useMemo(() => createTileLoader({ anisotropy: gl.capabilities.getMaxAnisotropy() }), [gl]);
  const [image, setImage] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let loaded;
    load(url, controller.signal)
      .then((result) => {
        loaded = result.texture;
        setImage(result);
      })
      .catch((error) => {
        if (!controller.signal.aborted) console.warn('[Mirador XR: preview failed to load]', url, error);
      });

    return () => {
      controller.abort();
      loaded?.dispose();
    };
  }, [load, url]);

  // Metres per texel of the preview, once fitted into the box
  const scale = image ? Math.min(width / image.width, height / image.height) : 1;
  const material = useMemo(() => {
    if (!image) return null;
    const basic = new MeshBasicMaterial({ map: image.texture, toneMapped: false });
    applyPaintRelief(basic, { texelSize: scale, uniforms: paint });
    return basic;
  }, [image, paint, scale]);

  useEffect(() => () => material?.dispose(), [material]);

  if (!image) return null;

  return (
    <mesh geometry={flippedPlane} material={material} scale={[image.width * scale, image.height * scale, 1]} {...meshProps} />
  );
}

PreviewImage.propTypes = {
  height: PropTypes.number.isRequired,
  paint: PropTypes.objectOf(PropTypes.shape({ value: PropTypes.any })).isRequired,
  url: PropTypes.string.isRequired,
  width: PropTypes.number.isRequired,
};
