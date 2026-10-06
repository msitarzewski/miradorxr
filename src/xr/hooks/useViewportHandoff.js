import { useEffect, useRef } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { useFrame, useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { Quaternion, Vector3 } from 'three';
import { setCanvas, updateViewport } from '../../state/actions';
import { getCurrentCanvas, getCurrentCanvasWorld } from '../../state/selectors';
import { exitXR } from '../state';
import { toMiradorViewport, viewOnImage } from '../lib/viewOnImage';

const SAMPLE_EVERY_N_FRAMES = 15;
// The 2D viewer gets the central 50 degrees of view, roughly what the eyes
// attend to. The headset's full field includes peripheral vision and would
// zoom the 2D viewer out past what the viewer was looking at.
const FOCUS_TAN_HALF_ANGLE = Math.tan((25 * Math.PI) / 180);
const headPosition = new Vector3();
const headForward = new Vector3();
const groupRotation = new Quaternion();

/**
 * Tracks where the head is pointed on the painting you're at. When the
 * session ends, it shows that painting in the window and moves the 2D
 * viewer to that spot, then clears the XR window, so leaving XR picks up
 * where the viewer was looking.
 *
 * @param {object} imageGroup - ref to the group the active image is centred in
 */
export function useViewportHandoff({ canvasId, height, imageGroup, infoId, width, windowId }) {
  const gl = useThree((state) => state.gl);
  const session = useXR((state) => state.session);
  const dispatch = useDispatch();
  const store = useStore();
  const active = useRef({});
  const lastView = useRef(null);
  const frameCount = useRef(0);
  const hadSession = useRef(false);

  active.current = { canvasId, height, infoId, width };

  useFrame(() => {
    frameCount.current += 1;
    if (!gl.xr.isPresenting || !imageGroup.current || frameCount.current % SAMPLE_EVERY_N_FRAMES !== 0) return;

    // matrixWorld is the head between the eyes, including the XR origin
    const { matrixWorld } = gl.xr.getCamera();
    const group = imageGroup.current;
    group.updateWorldMatrix(true, false);
    group.worldToLocal(headPosition.setFromMatrixPosition(matrixWorld));
    headForward.set(0, 0, -1).transformDirection(matrixWorld);
    headForward.applyQuaternion(group.getWorldQuaternion(groupRotation).invert());

    const view = viewOnImage({
      direction: headForward,
      height: active.current.height,
      origin: headPosition,
      tanHalfFov: FOCUS_TAN_HALF_ANGLE,
      width: active.current.width,
    });
    if (view) lastView.current = { ...view, canvasId: active.current.canvasId, infoId: active.current.infoId };
  });

  useEffect(() => {
    if (session) {
      hadSession.current = true;
      lastView.current = null;
      return;
    }
    if (!hadSession.current) return;
    hadSession.current = false;

    const view = lastView.current;
    const endCanvasId = view?.canvasId ?? active.current.canvasId;
    if (windowId && endCanvasId && getCurrentCanvas(store.getState(), { windowId })?.id !== endCanvasId) {
      dispatch(setCanvas(windowId, endCanvasId));
    }

    const canvasWorld = windowId && getCurrentCanvasWorld(store.getState(), { windowId });
    const resource = view?.infoId && canvasWorld?.contentResource(view.infoId);
    if (resource) {
      dispatch(updateViewport(windowId, toMiradorViewport(view, canvasWorld.contentResourceToWorldCoordinates(resource))));
    }
    dispatch(exitXR());
  }, [dispatch, session, store, windowId]);
}
