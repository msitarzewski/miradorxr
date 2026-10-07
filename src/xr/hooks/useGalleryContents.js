import { useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import CanvasGroupings from '../../lib/CanvasGroupings';
import { fetchManifest } from '../../state/actions';
import {
  getCanvases,
  getCatalog,
  getManifestoInstance,
  getManifestProviderName,
  getManifests,
  getManifestSearchService,
  getManifestTitle,
  getMiradorCanvasWrapper,
  getSequenceViewingDirection,
  getThumbnailFactory,
  getWindow,
  getWindowViewType,
} from '../../state/selectors';

// Preview images for paintings you aren't at: about one display pixel per
// texel from a couple of metres away
const PREVIEW_SIZE = 1024;
// The window's manifest hangs on the walls unless it's a paged book or has more images than this
const MAX_HUNG = 40;
// Other catalogue manifests with up to this many images are single works, hung with the rest
const MAX_HUNG_FROM_CATALOGUE = 3;

/** A canvas's image, proportions and preview, or null if it has no IIIF image */
function imageOf(canvas, getMiradorCanvas, thumbnails) {
  const miradorCanvas = getMiradorCanvas(canvas);
  const resources = miradorCanvas.iiifImageResources;
  // Alternatives from a IIIF Choice (natural light, X-ray, infrared...) are marked preferred or not
  const layers = resources.filter(({ preferred }) => preferred !== undefined);
  const imageResource = layers.find(({ preferred }) => preferred) || resources[0];
  // From the image itself, not the canvas: a canvas's own thumbnail is often a
  // plain image without CORS, which WebGL can't use, while the image's IIIF
  // service serves one sized to ask
  const preview = imageResource && thumbnails.get(imageResource);
  if (!preview?.url || !(miradorCanvas.aspectRatio > 0)) return null;

  return {
    aspect: miradorCanvas.aspectRatio,
    canvasHeight: miradorCanvas.getHeight(),
    canvasId: canvas.id,
    canvasWidth: miradorCanvas.getWidth(),
    imageResource,
    label: miradorCanvas.getLabel(),
    layers: layers.length > 1 ? layers : [],
    preview: preview.url,
  };
}

/**
 * What the XR gallery shows, from the XR window's manifest and Mirador's
 * catalogue:
 * - `works`, hung on the gallery walls: the window's manifest, unless it's a
 *   book, and any catalogue manifest of just a few images.
 * - `books`, one per lectern in the reading room: every other manifest, as
 *   two-page spreads if it's paged and one image at a time if not. A
 *   collection stands for its first manifest.
 *
 * Catalogue manifests are fetched through Mirador as needed. `settled` is
 * true once each has loaded or failed.
 *
 * Each work and book carries `lookup`, the selector props that find it:
 * `{ windowId }` for the window's own manifest, `{ manifestId }` otherwise.
 */
export function useGalleryContents(windowId) {
  const dispatch = useDispatch();
  const store = useStore();
  const requested = useRef(new Set());
  const windowManifestId = useSelector((state) => getWindow(state, { windowId })?.manifestId);
  const catalog = useSelector(getCatalog);
  const manifests = useSelector(getManifests);
  const getMiradorCanvas = useSelector(getMiradorCanvasWrapper);
  const thumbnails = useSelector((state) => getThumbnailFactory(state, PREVIEW_SIZE, PREVIEW_SIZE));

  // Catalogue manifests other than the window's, each collection replaced by its first manifest
  const catalogIds = useMemo(() => {
    const state = store.getState();
    const ids = (Array.isArray(catalog) ? catalog : []).map(({ manifestId }) => manifestId);
    return [
      ...new Set(
        ids.map((manifestId) => {
          const manifesto = manifests[manifestId]?.json && getManifestoInstance(state, { manifestId });
          return manifesto?.isCollection() ? manifesto.getManifests()[0]?.id || manifestId : manifestId;
        }),
      ),
    ].filter((manifestId) => manifestId && manifestId !== windowManifestId);
  }, [catalog, manifests, store, windowManifestId]);

  useEffect(() => {
    catalogIds.forEach((manifestId) => {
      if (manifests[manifestId] || requested.current.has(manifestId)) return;
      requested.current.add(manifestId);
      dispatch(fetchManifest(manifestId));
    });
  }, [catalogIds, dispatch, manifests]);

  return useMemo(() => {
    const state = store.getState();
    const books = [];
    const works = [];

    /** Sorts one manifest's images onto the walls or a lectern */
    const visit = (manifestId, fromWindow) => {
      if (!manifests[manifestId]?.json) return;
      const lookup = fromWindow ? { windowId } : { manifestId };
      const manifesto = getManifestoInstance(state, lookup);
      if (!manifesto || manifesto.isCollection()) return;

      const pages = getCanvases(state, lookup)
        .map((canvas) => imageOf(canvas, getMiradorCanvas, thumbnails))
        .filter(Boolean);
      if (pages.length === 0) return;

      const paged = getWindowViewType(state, { manifestId }) === 'book';
      if (!paged && pages.length <= (fromWindow ? MAX_HUNG : MAX_HUNG_FROM_CATALOGUE)) {
        works.push(...pages.map((page) => ({ ...page, lookup, manifestId })));
        return;
      }

      const indices = pages.map((_page, index) => index);
      books.push({
        direction: getSequenceViewingDirection(state, { manifestId }) || 'left-to-right',
        lookup,
        manifestId,
        pages,
        paged,
        provider:
          getManifestProviderName(state, { manifestId }) ||
          (Array.isArray(catalog) ? catalog : []).find((entry) => entry.manifestId === manifestId)?.provider,
        searchService: getManifestSearchService(state, { manifestId })?.id,
        spreads: new CanvasGroupings(indices, paged ? 'book' : 'single').groupings(),
        title: getManifestTitle(state, { manifestId }),
      });
    };

    visit(windowManifestId, true);
    catalogIds.forEach((manifestId) => visit(manifestId, false));

    const settled = catalogIds.every((manifestId) => manifests[manifestId] && !manifests[manifestId].isFetching);
    return { books, settled, works };
  }, [catalog, catalogIds, getMiradorCanvas, manifests, store, thumbnails, windowId, windowManifestId]);
}
