import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { Canvas } from '@react-three/fiber';
import { XR } from '@react-three/xr';
import { NeutralToneMapping } from 'three';
import ns from '../../config/css-ns';
import { markStageReady } from '../enterGallery';
import { getXRWindowId } from '../state';
import { xrStore } from '../xrStore';
import { GalleryScene } from './GalleryScene';

// BackgroundPluginArea is display:none, and R3F only creates its renderer for
// a canvas with a non-zero size. <XR> needs that renderer before a session can
// start, so the stage is portaled to a 1px invisible box, and it reports when
// that renderer exists, for pages with their own Enter XR button. During a
// session the headset renders the scene; outside one, frameloop="demand"
// keeps it idle.
const stageStyle = {
  height: 1,
  left: 0,
  pointerEvents: 'none',
  position: 'fixed',
  top: 0,
  visibility: 'hidden',
  width: 1,
};
// Neutral tone mapping keeps the room's whites white and its colours true;
// the paintings, labels and buttons aren't tone mapped at all
const rendererOptions = { toneMapping: NeutralToneMapping };

/**
 * Hosts the three.js canvas that WebXR sessions render into. The gallery
 * mounts only once a window enters XR, so nothing loads until then.
 */
export function XRStage() {
  const windowId = useSelector(getXRWindowId);

  return createPortal(
    <div className={ns('xr-stage')} style={stageStyle} aria-hidden="true">
      <Canvas frameloop="demand" gl={rendererOptions} onCreated={markStageReady}>
        <XR store={xrStore}>{windowId && <GalleryScene windowId={windowId} />}</XR>
      </Canvas>
    </div>,
    document.body,
  );
}
