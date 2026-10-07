import { useCallback, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Quaternion, Vector3 } from 'three';
import { viewingSpot } from '../lib/galleryLayout';
import { originForSpot, stationInFront } from '../lib/teleport';

// Metres from the middle of a lectern's book to where you stand to read it
export const READING_DISTANCE = 0.75;
export const CLOSE_READING_DISTANCE = 0.45;
// Paintings hang at the viewer's eye height, seated or standing, within reason
const MIN_EYE_HEIGHT = 1;
const MAX_EYE_HEIGHT = 1.75;

const orientation = new Quaternion();
const forward = new Vector3();

/**
 * Moves the viewer around the gallery. Every move is a teleport through the
 * fade curtain: to a station (a painting or a lectern: pinch it, or the
 * arrows between paintings), to a spot on the floor, or a snap turn in
 * place, so seated viewers never turn their chair.
 *
 * Stations are `{x, z, yaw, view, close, kind}`: where the work is, which
 * way it faces, and the distances to stand at to look at it and to look
 * closely. The station you're at is the active one; landing on the floor in
 * front of a station makes it active too.
 *
 * The head's pose within the XR origin comes from the WebXR viewer pose in
 * three's reference space, which is the origin's own space.
 */
export function useGalleryNavigation({ curtain, origin, startIndex, stations }) {
  const gl = useThree((state) => state.gl);
  const head = useRef(null);
  const moving = useRef(false);
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [close, setClose] = useState(false);
  const [eyeHeight, setEyeHeight] = useState(null);

  /** Moves the origin so the head lands on a spot, facing its heading */
  const placeAt = useCallback(
    (spot) => {
      const target = originForSpot(head.current, spot);
      origin.current.position.set(target.x, 0, target.z);
      origin.current.rotation.set(0, target.yaw, 0);
    },
    [origin],
  );

  useFrame((_state, _delta, frame) => {
    const pose = frame && gl.xr.isPresenting && frame.getViewerPose(gl.xr.getReferenceSpace());
    if (!pose || !origin.current) return;

    const { orientation: o, position } = pose.transform;
    forward.set(0, 0, -1).applyQuaternion(orientation.set(o.x, o.y, o.z, o.w));
    head.current = { x: position.x, y: position.y, yaw: Math.atan2(-forward.x, -forward.z), z: position.z };

    // Once tracking, hang the paintings at eye height and start at the window's painting
    if (eyeHeight === null && position.y > 0.3) {
      setEyeHeight(Math.min(Math.max(position.y, MIN_EYE_HEIGHT), MAX_EYE_HEIGHT));
      placeAt(viewingSpot(stations[startIndex], stations[startIndex].view));
    }
  });

  /** The head's position and heading in the room */
  const headInWorld = useCallback(() => {
    const { position, rotation } = origin.current;
    const { x, yaw, z } = head.current;
    const cos = Math.cos(rotation.y);
    const sin = Math.sin(rotation.y);
    return { x: position.x + cos * x + sin * z, yaw: rotation.y + yaw, z: position.z - sin * x + cos * z };
  }, [origin]);

  /** Teleports through the curtain; ignores input while a move is under way */
  const moveTo = useCallback(
    async (spot, afterMove = () => {}) => {
      if (moving.current || !head.current) return;
      moving.current = true;
      await curtain.current.around(() => {
        placeAt(spot);
        afterMove();
      });
      moving.current = false;
    },
    [curtain, placeAt],
  );

  /** Goes to a station at one of its distances, making it the one you're at */
  const travel = useCallback(
    (index, distance) =>
      moveTo(viewingSpot(stations[index], distance), () => {
        setActiveIndex(index);
        setClose(distance === stations[index].close);
      }),
    [moveTo, stations],
  );

  /** Pinching a station: go to it, or step closer to / back from the one you're at */
  const select = useCallback(
    (index) => {
      const { close: closeDistance, view } = stations[index];
      if (index !== activeIndex) return travel(index, view);
      return travel(index, close ? view : closeDistance);
    },
    [activeIndex, close, stations, travel],
  );

  /** Goes straight to a station, at its viewing distance */
  const visit = useCallback((index) => travel(index, stations[index].view), [stations, travel]);

  /** The arrows: the next or previous painting along the walls, wrapping round */
  const step = useCallback(
    (offset) => {
      const paintings = stations.flatMap(({ kind }, index) => (kind === 'painting' ? [index] : []));
      const from = Math.max(0, paintings.indexOf(activeIndex));
      const next = paintings[(from + offset + paintings.length) % paintings.length];
      return next === undefined ? undefined : travel(next, stations[next].view);
    },
    [activeIndex, stations, travel],
  );

  /** A spot on the floor: stand there facing the chosen heading, at whatever station is in front */
  const teleportTo = useCallback(
    (x, z, yaw) =>
      moveTo({ x, yaw, z }, () => {
        const facing = stationInFront({ x, yaw, z }, stations);
        if (facing >= 0) setActiveIndex(facing);
        setClose(false);
      }),
    [moveTo, stations],
  );

  /** A snap turn in place, positive to the left */
  const turn = useCallback(
    (angle) => {
      if (!head.current) return undefined;
      const { x, yaw, z } = headInWorld();
      return moveTo({ x, yaw: yaw + angle, z });
    },
    [headInWorld, moveTo],
  );

  return { activeIndex, eyeHeight, headInWorld, select, step, teleportTo, turn, visit };
}
