import { useSelector } from 'react-redux';
import { getCanvasLabel, getCurrentCanvas, getManifestTitle, getWindowIds, selectInfoResponse } from '../../state/selectors';

/**
 * The image the first Mirador window is showing. Mirador's window saga has
 * already fetched its info.json for the 2D viewer, so XR reuses it.
 *
 * @returns {{canvasLabel, infoJson, manifestTitle}}
 */
export function useCurrentImage() {
  const windowId = useSelector((state) => getWindowIds(state)[0]);
  const canvasId = useSelector((state) => windowId && getCurrentCanvas(state, { windowId })?.id);
  const infoResponse = useSelector((state) => canvasId && selectInfoResponse(state, { canvasId, windowId }));
  const canvasLabel = useSelector((state) => canvasId && getCanvasLabel(state, { canvasId, windowId }));
  const manifestTitle = useSelector((state) => windowId && getManifestTitle(state, { windowId }));

  return { canvasLabel, infoJson: infoResponse?.json, manifestTitle };
}
