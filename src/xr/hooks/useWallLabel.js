import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  getCanvasLabel,
  getCanvasMetadata,
  getManifestProviderName,
  getManifestTitle,
  getRequiredStatement,
  getRights,
} from '../../state/selectors';
import { wallLabelLines } from '../lib/wallLabel';

/** Wall label lines for a window's canvas, from the same selectors as Mirador's info panels */
export function useWallLabel(windowId, canvasId) {
  const props = { canvasId, windowId };
  const canvasLabel = useSelector((state) => canvasId && getCanvasLabel(state, props));
  const canvasMetadata = useSelector((state) => canvasId && getCanvasMetadata(state, props));
  const manifestTitle = useSelector((state) => windowId && getManifestTitle(state, props));
  const provider = useSelector((state) => windowId && getManifestProviderName(state, props));
  const requiredStatement = useSelector((state) => windowId && getRequiredStatement(state, props));
  const rights = useSelector((state) => windowId && getRights(state, props));

  return useMemo(
    () => wallLabelLines({ canvasLabel, canvasMetadata, manifestTitle, provider, requiredStatement, rights }),
    [canvasLabel, canvasMetadata, manifestTitle, provider, requiredStatement, rights],
  );
}
