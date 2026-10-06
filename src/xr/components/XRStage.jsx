import { createPortal } from 'react-dom';
import { Canvas } from '@react-three/fiber';
import { XR } from '@react-three/xr';
import ns from '../../config/css-ns';
import { xrStore } from '../xrStore';
import { HelloScene } from './HelloScene';

// BackgroundPluginArea is display:none, and R3F only creates its renderer for
// a canvas with a non-zero size. <XR> needs that renderer before a session can
// start, so the stage is portaled to a 1px invisible box. During a session the
// headset renders the scene; outside one, frameloop="demand" keeps it idle.
const stageStyle = {
  height: 1,
  left: 0,
  pointerEvents: 'none',
  position: 'fixed',
  top: 0,
  visibility: 'hidden',
  width: 1,
};

/** Hosts the three.js canvas that WebXR sessions render into */
export function XRStage() {
  return createPortal(
    <div className={ns('xr-stage')} style={stageStyle} aria-hidden="true">
      <Canvas frameloop="demand">
        <XR store={xrStore}>
          <HelloScene />
        </XR>
      </Canvas>
    </div>,
    document.body,
  );
}
