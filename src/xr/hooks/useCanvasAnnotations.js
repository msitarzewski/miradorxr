import { useEffect, useMemo } from 'react';
import { shallowEqual, useDispatch, useSelector, useStore } from 'react-redux';
import { receiveAnnotation, requestAnnotation, requestCanvasAnnotations } from '../../state/actions';
import {
  getAnnotationResourcesByMotivationForCanvas,
  getAnnotations,
  getCanvas,
  getMiradorCanvasWrapper,
} from '../../state/selectors';
import { noteLines } from '../lib/wallLabel';

const NO_RESOURCES = [];

/**
 * A canvas's annotations, as notes that can be pinned to it: each with its
 * region as fractions of the canvas (x, y from the top left) and its text
 * as note-card lines. Only annotations with a rectangular region (an xywh
 * fragment, which SVG-shaped ones also carry as their default) are pinned.
 *
 * While `active`, the canvas's annotation lists are fetched through
 * Mirador: its own saga for the XR window's canvases, and the same two
 * steps here for a canvas from another manifest, which that saga can't
 * find through a window.
 *
 * @param {object} lookup - `{ windowId }` or `{ manifestId }`, as from useGalleryContents
 * @returns {Array<{id, lines, region: {x, y, w, h}}>}
 */
export function useCanvasAnnotations({ active, canvasId, lookup }) {
  const dispatch = useDispatch();
  const store = useStore();
  const { manifestId, windowId } = lookup;
  const props = useMemo(() => ({ canvasId, manifestId, windowId }), [canvasId, manifestId, windowId]);

  useEffect(() => {
    if (!active || !canvasId) return;
    if (windowId) {
      dispatch(requestCanvasAnnotations(windowId, canvasId));
      return;
    }

    const state = store.getState();
    const canvas = getCanvas(state, props);
    if (!canvas) return;
    const miradorCanvas = getMiradorCanvasWrapper(state)(canvas);
    const known = getAnnotations(state)[canvas.id] || {};
    miradorCanvas.annotationListUris.filter((uri) => !known[uri]).forEach((uri) => dispatch(requestAnnotation(canvas.id, uri)));
    miradorCanvas.canvasAnnotationPages
      .filter((page) => !known[page.id])
      .forEach((page) =>
        dispatch(page.items ? receiveAnnotation(canvas.id, page.id, page) : requestAnnotation(canvas.id, page.id)),
      );
  }, [active, canvasId, dispatch, props, store, windowId]);

  const resources = useSelector((state) =>
    active && canvasId ? getAnnotationResourcesByMotivationForCanvas(state, props) : NO_RESOURCES,
  );
  const size = useSelector((state) => {
    const canvas = canvasId && getCanvas(state, props);
    return canvas ? [canvas.getWidth(), canvas.getHeight()] : null;
  }, shallowEqual);

  return useMemo(() => {
    if (!size || !(size[0] > 0 && size[1] > 0)) return [];
    const [width, height] = size;
    return resources.flatMap((resource) => {
      const region = resource.fragmentSelector;
      const lines = noteLines(resource.chars);
      if (!region || region.length < 4 || lines.length === 0) return [];
      const [x, y, w, h] = region;
      return [{ id: resource.id, lines, region: { h: h / height, w: w / width, x: x / width, y: y / height } }];
    });
  }, [resources, size]);
}
