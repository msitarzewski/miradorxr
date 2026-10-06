import { useRef } from 'react';
import PropTypes from 'prop-types';
import { Vector3 } from 'three';
import { angleBetween, headingOf } from '../lib/teleport';

const WALL_HEIGHT = 3.4;
// A slightly different tint per wall helps keep your bearings after a teleport
const WALL_COLOURS = ['#5a5650', '#545a56', '#5a5458', '#56565c'];
const SNAP_TURN = Math.PI / 4;
// How far the pinch ray has to swing sideways to count as a flick
const FLICK_ANGLE = (8 * Math.PI) / 180;
const rayDirection = new Vector3();

/** Heading of the pointer's ray, from its world orientation */
const rayHeading = (event) => {
  rayDirection.set(0, 0, -1).applyQuaternion(event.pointerQuaternion);
  return headingOf(rayDirection.x, rayDirection.z);
};

/**
 * Floor, ceiling and four inward-facing walls around the hung works. Pinch
 * a bare wall or the ceiling and flick sideways to snap-turn 45 degrees
 * that way.
 */
export function GalleryRoom({ depth, onTurn, width }) {
  const flick = useRef(null);
  const walls = [
    { length: width, position: [0, WALL_HEIGHT / 2, -depth / 2], rotation: 0 },
    { length: depth, position: [width / 2, WALL_HEIGHT / 2, 0], rotation: -Math.PI / 2 },
    { length: width, position: [0, WALL_HEIGHT / 2, depth / 2], rotation: Math.PI },
    { length: depth, position: [-width / 2, WALL_HEIGHT / 2, 0], rotation: Math.PI / 2 },
  ];

  /** */
  const handlePointerDown = (event) => {
    event.stopPropagation();
    event.object.setPointerCapture(event.pointerId);
    flick.current = { heading: rayHeading(event), pointerId: event.pointerId };
  };

  /** */
  const handlePointerUp = (event) => {
    const start = flick.current;
    if (!start || start.pointerId !== event.pointerId) return;
    flick.current = null;
    event.object.releasePointerCapture(event.pointerId);

    const swing = angleBetween(start.heading, rayHeading(event));
    if (Math.abs(swing) > FLICK_ANGLE) onTurn(Math.sign(swing) * SNAP_TURN);
  };

  const flickHandlers = { onPointerDown: handlePointerDown, onPointerUp: handlePointerUp };

  return (
    <>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#2b2a28" />
      </mesh>
      <mesh position={[0, WALL_HEIGHT, 0]} rotation-x={Math.PI / 2} {...flickHandlers}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#1e1e20" />
      </mesh>
      {walls.map(({ length, position, rotation }, index) => (
        <mesh key={WALL_COLOURS[index]} position={position} rotation-y={rotation} {...flickHandlers}>
          <planeGeometry args={[length, WALL_HEIGHT]} />
          <meshStandardMaterial color={WALL_COLOURS[index]} />
        </mesh>
      ))}
    </>
  );
}

GalleryRoom.propTypes = {
  depth: PropTypes.number.isRequired,
  onTurn: PropTypes.func.isRequired,
  width: PropTypes.number.isRequired,
};
