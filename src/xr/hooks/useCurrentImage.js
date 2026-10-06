import { useSelector } from 'react-redux';
import { getCurrentCanvas, selectInfoResponse } from '../../state/selectors';

/**
 * The image a Mirador window is showing. Mirador's window saga has already
 * fetched its info.json for the 2D viewer, so XR reuses it.
 *
 * @returns {{canvasId, infoId, infoJson}} infoId is Mirador's key for the
 * image service, which can differ from the id inside info.json
 */
export function useCurrentImage(windowId) {
  const canvasId = useSelector((state) => (windowId ? getCurrentCanvas(state, { windowId })?.id : undefined));
  const infoResponse = useSelector((state) => canvasId && selectInfoResponse(state, { canvasId, windowId }));

  return { canvasId, infoId: infoResponse?.id, infoJson: infoResponse?.json };
}
