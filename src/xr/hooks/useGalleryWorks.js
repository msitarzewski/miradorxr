import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { getCanvases, getMiradorCanvasWrapper, getThumbnailFactory } from '../../state/selectors';

// Preview images for paintings you aren't at: about one display pixel per
// texel from a couple of metres away
const PREVIEW_SIZE = 1024;

/**
 * The works to hang: every canvas in the XR window's manifest that has a
 * IIIF image, with its proportions and a preview image from Mirador's
 * thumbnail service.
 *
 * @returns {Array<{aspect, canvasId, imageResource, preview}>}
 */
export function useGalleryWorks(windowId) {
  const canvases = useSelector((state) => (windowId ? getCanvases(state, { windowId }) : undefined));
  const getMiradorCanvas = useSelector(getMiradorCanvasWrapper);
  const thumbnails = useSelector((state) => getThumbnailFactory(state, PREVIEW_SIZE, PREVIEW_SIZE));

  return useMemo(
    () =>
      (canvases || []).flatMap((canvas) => {
        const miradorCanvas = getMiradorCanvas(canvas);
        const [imageResource] = miradorCanvas.iiifImageResources;
        const preview = imageResource && thumbnails.get(canvas);
        if (!preview?.url || !(miradorCanvas.aspectRatio > 0)) return [];

        return [{ aspect: miradorCanvas.aspectRatio, canvasId: canvas.id, imageResource, preview: preview.url }];
      }),
    [canvases, getMiradorCanvas, thumbnails],
  );
}
