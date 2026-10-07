import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { MeshBasicMaterial } from 'three';
import { flippedPlane } from '../lib/flippedPlane';
import { applyPaintRelief } from '../lib/paintRelief';

/** The scene's PreviewCache, which every preview image loads through */
export const PreviewCacheContext = createContext(null);

/**
 * A single preview image of a work, shown while you aren't at it and kept
 * behind the deep-zoom tiles when you are. Loaded through the scene's
 * PreviewCache (CORS ImageBitmaps, like the tiles), so meshes showing the
 * same image share one texture, and fitted inside the width x height box
 * at its own proportions, so it never stretches. Shares the gallery's paint
 * relief lighting. `onError` hears about an image that won't load, such as
 * one served without CORS.
 */
export function PreviewImage({ height, onError = undefined, paint, url, width, ...meshProps }) {
  const previews = useContext(PreviewCacheContext);
  const [image, setImage] = useState(() => previews.peek(url));
  // Read when a load fails, so a new callback on re-render doesn't reload the image
  const reportError = useRef(onError);
  reportError.current = onError;

  useEffect(() => {
    let current = true;
    setImage(previews.peek(url));
    previews
      .acquire(url)
      .then((result) => current && setImage(result))
      .catch((error) => {
        if (!current) return;
        console.warn('[Mirador XR: preview failed to load]', url, error);
        reportError.current?.(error);
      });

    return () => {
      current = false;
      previews.release(url);
    };
  }, [previews, url]);

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
  onError: PropTypes.func,
  paint: PropTypes.objectOf(PropTypes.shape({ value: PropTypes.any })).isRequired,
  url: PropTypes.string.isRequired,
  width: PropTypes.number.isRequired,
};
