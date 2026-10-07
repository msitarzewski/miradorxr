import { useEffect, useRef } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { useFrame, useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { Quaternion, Vector3 } from 'three';
import { v4 as uuid } from 'uuid';
import { addWindow, focusWindow, setCanvas, setWindowViewType, updateViewport } from '../../state/actions';
import { getCurrentCanvas, getCurrentCanvasWorld, getWindow, getWindows, getWindowViewType } from '../../state/selectors';
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
 * The window to show `manifestId` in once XR ends: the XR window if it's
 * that window's manifest, else a window already showing it (brought to the
 * front), else a new one.
 */
function handoffWindow(state, dispatch, { manifestId, canvasId, viewType }, windowId) {
  if (!manifestId || getWindow(state, { windowId })?.manifestId === manifestId) return windowId;

  const existing = Object.values(getWindows(state)).find((window) => window.manifestId === manifestId);
  if (existing) {
    dispatch(focusWindow(existing.id, true));
    return existing.id;
  }

  const id = `window-${uuid()}`;
  dispatch(addWindow({ canvasId, id, manifestId, view: viewType }));
  dispatch(focusWindow(id, true));
  return id;
}

/**
 * Tracks where the head is pointed on whatever you're looking at: the
 * painting you're at, or a page of the book you're reading. When the
 * session ends, it shows that work in Mirador, zoomed to that spot, then
 * clears the XR window, so leaving XR picks up where the viewer was
 * looking. A work from another manifest opens in its own window (in book
 * view for a paged book), or in the window already showing it.
 *
 * @param {object} station - the work you're at: `{ key, manifestId, viewType }`,
 *   `key` telling one station from another
 * @param {object} targets - ref to the images you could be looking at, each
 *   `{ canvasId, group, width, height, infoId }` with `group` a ref to the
 *   group the image is centred in
 */
export function useViewportHandoff({ station, targets, windowId }) {
  const gl = useThree((state) => state.gl);
  const session = useXR((state) => state.session);
  const dispatch = useDispatch();
  const store = useStore();
  const active = useRef(station);
  const lastView = useRef(null);
  const frameCount = useRef(0);
  const hadSession = useRef(false);

  active.current = station;

  // A view of the last station you were at is no use once you've moved on
  useEffect(() => {
    lastView.current = null;
  }, [station.key]);

  useFrame(() => {
    frameCount.current += 1;
    if (!gl.xr.isPresenting || frameCount.current % SAMPLE_EVERY_N_FRAMES !== 0) return;

    // matrixWorld is the head between the eyes, including the XR origin
    const { matrixWorld } = gl.xr.getCamera();
    targets.current.some((target) => {
      const group = target.group.current;
      if (!group) return false;
      group.updateWorldMatrix(true, false);
      group.worldToLocal(headPosition.setFromMatrixPosition(matrixWorld));
      headForward.set(0, 0, -1).transformDirection(matrixWorld);
      headForward.applyQuaternion(group.getWorldQuaternion(groupRotation).invert());

      const view = viewOnImage({
        direction: headForward,
        height: target.height,
        origin: headPosition,
        tanHalfFov: FOCUS_TAN_HALF_ANGLE,
        width: target.width,
      });
      if (view) lastView.current = { ...view, ...active.current, canvasId: target.canvasId, infoId: target.infoId };
      return Boolean(view);
    });
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
    const end = view ?? { ...active.current, canvasId: targets.current[0]?.canvasId };
    const shownIn = handoffWindow(store.getState(), dispatch, end, windowId);

    if (end.viewType && getWindowViewType(store.getState(), { windowId: shownIn }) !== end.viewType) {
      dispatch(setWindowViewType(shownIn, end.viewType));
    }
    if (shownIn && end.canvasId && getCurrentCanvas(store.getState(), { windowId: shownIn })?.id !== end.canvasId) {
      dispatch(setCanvas(shownIn, end.canvasId));
    }

    const canvasWorld = shownIn && getCurrentCanvasWorld(store.getState(), { windowId: shownIn });
    const resource = view?.infoId && canvasWorld?.contentResource(view.infoId);
    if (resource) {
      dispatch(updateViewport(shownIn, toMiradorViewport(view, canvasWorld.contentResourceToWorldCoordinates(resource))));
    }
    dispatch(exitXR());
  }, [dispatch, session, store, targets, windowId]);
}
