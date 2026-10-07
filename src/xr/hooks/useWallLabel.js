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

/**
 * Wall label lines for a canvas, from the same selectors as Mirador's info
 * panels. `lookup` finds its manifest: `{ windowId }` or `{ manifestId }`.
 */
export function useWallLabel(lookup, canvasId) {
  const { manifestId, windowId } = lookup;
  const props = { canvasId, manifestId, windowId };
  const known = Boolean(manifestId || windowId);
  const canvasLabel = useSelector((state) => canvasId && getCanvasLabel(state, props));
  const canvasMetadata = useSelector((state) => canvasId && getCanvasMetadata(state, props));
  const manifestTitle = useSelector((state) => known && getManifestTitle(state, props));
  const provider = useSelector((state) => known && getManifestProviderName(state, props));
  const requiredStatement = useSelector((state) => known && getRequiredStatement(state, props));
  const rights = useSelector((state) => known && getRights(state, props));

  return useMemo(
    () => wallLabelLines({ canvasLabel, canvasMetadata, manifestTitle, provider, requiredStatement, rights }),
    [canvasLabel, canvasMetadata, manifestTitle, provider, requiredStatement, rights],
  );
}
