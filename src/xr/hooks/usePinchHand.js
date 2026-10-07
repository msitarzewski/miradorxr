import { useCallback, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { Vector3 } from 'three';

// A selectstart this recent belongs to the pinch that's just begun
const SAME_PINCH_MS = 150;
const handPosition = new Vector3();
const headPosition = new Vector3();

/**
 * Follows the hand behind a pinch, for things you take hold of and move.
 *
 * On Vision Pro the pinch's ray pivots between the eyes, so moving the hand
 * only swings its angle: dragging by the ray makes things move along axes
 * that feel wrong. This reads the pinching fingers themselves instead, from
 * the input source's gripSpace, found from the session's selectstart (a
 * pointer event alone doesn't say which hand). That selectstart can arrive
 * just before the pointerdown or just after, so either is taken.
 *
 * Call the returned `grab` from a pointerdown handler with
 * `{ onMove, onRelease }`. Every frame until the pinch ends, onMove gets the
 * hand's world position, where it was when the pinch began, and the head's
 * world position (between the eyes); onRelease gets the same once it ends.
 */
export function usePinchHand() {
  const gl = useThree((state) => state.gl);
  const session = useXR((state) => state.session);
  const lastSelect = useRef(null);
  const held = useRef(null);

  useEffect(() => {
    if (!session) return undefined;

    /** */
    const handleSelectStart = ({ inputSource }) => {
      lastSelect.current = { at: performance.now(), source: inputSource };
      // A grab begun before its pinch's selectstart arrived takes this hand
      if (held.current && !held.current.source) held.current.source = inputSource;
    };
    /** */
    const handleSelectEnd = ({ inputSource }) => {
      const { current } = held;
      if (!current || current.source !== inputSource) return;
      held.current = null;
      current.onRelease?.(current.hand ?? current.start, current.start, current.head);
    };

    session.addEventListener('selectstart', handleSelectStart);
    session.addEventListener('selectend', handleSelectEnd);
    return () => {
      session.removeEventListener('selectstart', handleSelectStart);
      session.removeEventListener('selectend', handleSelectEnd);
    };
  }, [session]);

  useFrame((_state, _delta, frame) => {
    const { current } = held;
    const pose = current?.source && frame?.getPose(current.source.gripSpace, gl.xr.getReferenceSpace());
    if (!pose) return;

    // The reference space is the XR origin's own; the XR camera sits in the origin
    const camera = gl.xr.getCamera();
    const { position } = pose.transform;
    handPosition.set(position.x, position.y, position.z);
    if (camera.parent) handPosition.applyMatrix4(camera.parent.matrixWorld);
    headPosition.setFromMatrixPosition(camera.matrixWorld);

    if (!current.start) current.start = handPosition.clone();
    current.hand = handPosition.clone();
    current.head = headPosition.clone();
    current.onMove?.(current.hand, current.start, current.head);
  });

  return useCallback((handlers) => {
    // The pinch's own selectstart may come just before its pointerdown or just after
    const recent = lastSelect.current && performance.now() - lastSelect.current.at < SAME_PINCH_MS;
    held.current = { source: recent ? lastSelect.current.source : null, start: null, ...handlers };
  }, []);
}

/**
 * How much further a grabbed thing moves than the hand, so it stays under
 * the pinching fingers as seen from the eyes: its distance from the head
 * over the hand's, kept within `[1, max]`.
 */
export function handGain(head, hand, thing, max = 4) {
  const reach = head.distanceTo(hand);
  return reach > 0.05 ? Math.min(max, Math.max(1, head.distanceTo(thing) / reach)) : 1;
}
