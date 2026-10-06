import { useEffect, useRef } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { useFrame, useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { Quaternion, Vector3 } from 'three';
import { updateViewport } from '../../state/actions';
import { getCurrentCanvasWorld } from '../../state/selectors';
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
 * Tracks where the head is pointed on the image during the session. When the
 * session ends, it moves the window's 2D viewer to that spot and clears the
 * XR window, so leaving XR picks up where the viewer was looking.
 *
 * @param {object} imageGroup - ref to the group the image is centred in
 */
export function useViewportHandoff({ height, imageGroup, infoId, width, windowId }) {
  const gl = useThree((state) => state.gl);
  const session = useXR((state) => state.session);
  const dispatch = useDispatch();
  const store = useStore();
  const lastView = useRef(null);
  const frameCount = useRef(0);
  const hadSession = useRef(false);

  useFrame(() => {
    frameCount.current += 1;
    if (!gl.xr.isPresenting || !imageGroup.current || frameCount.current % SAMPLE_EVERY_N_FRAMES !== 0) return;

    const camera = gl.xr.getCamera();
    const group = imageGroup.current;
    group.updateWorldMatrix(true, false);
    camera.getWorldPosition(headPosition);
    camera.getWorldDirection(headForward);
    group.worldToLocal(headPosition);
    headForward.applyQuaternion(group.getWorldQuaternion(groupRotation).invert());

    const view = viewOnImage({
      direction: headForward,
      height,
      origin: headPosition,
      tanHalfFov: FOCUS_TAN_HALF_ANGLE,
      width,
    });
    if (view) lastView.current = view;
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
    const canvasWorld = windowId && getCurrentCanvasWorld(store.getState(), { windowId });
    const resource = canvasWorld && infoId && canvasWorld.contentResource(infoId);
    if (view && resource) {
      dispatch(updateViewport(windowId, toMiradorViewport(view, canvasWorld.contentResourceToWorldCoordinates(resource))));
    }
    dispatch(exitXR());
  }, [dispatch, infoId, session, store, windowId]);
}
