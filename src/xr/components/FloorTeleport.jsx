import { useRef } from 'react';
import PropTypes from 'prop-types';
import { useFrame, useThree } from '@react-three/fiber';
import { Shape, Vector3 } from 'three';
import { usePinchHand } from '../hooks/usePinchHand';
import { floorHit, handHeading, insideFloors } from '../lib/floorTarget';

// Looking more than about 20 degrees below level shows where your head is aimed
const LOOKING_DOWN = -0.35;
// Raising the pinching hand this far (metres) arms a cancel
const LIFT_TO_CANCEL = 0.12;
const TARGET_COLOUR = '#3ec46d';
const CANCEL_COLOUR = '#8a8a8a';
const headPosition = new Vector3();
const headForward = new Vector3();
const movement = new Vector3();

/** A flat arrow pointing down -z, laid on the floor, for the heading you'll face */
const arrowShape = new Shape();
arrowShape.moveTo(0, 0.34);
arrowShape.lineTo(0.14, 0.08);
arrowShape.lineTo(0.05, 0.08);
arrowShape.lineTo(0.05, -0.16);
arrowShape.lineTo(-0.05, -0.16);
arrowShape.lineTo(-0.05, 0.08);
arrowShape.lineTo(-0.14, 0.08);
arrowShape.closePath();

/**
 * Teleporting to any point on the floor. Look down and a ring shows where
 * your head is aimed. Pinch and hold where you're looking: that spot is the
 * green target. Then move your pinching hand the way you want to face: left
 * to face left, away to face on, back towards yourself to turn round. Release
 * to go; raise your hand to cancel (the target greys out).
 *
 * The hand is followed by usePinchHand, from the pinching fingers rather
 * than the pinch's ray.
 */
export function FloorTeleport({ floors, headInWorld, onTeleport }) {
  const gl = useThree((state) => state.gl);
  const grab = usePinchHand();
  const ring = useRef();
  const target = useRef();
  const targetMaterial = useRef();
  const arrow = useRef();
  const press = useRef(null);

  useFrame(() => {
    if (!gl.xr.isPresenting || !ring.current) return;

    // matrixWorld is the head between the eyes, including the XR origin
    const camera = gl.xr.getCamera();
    headPosition.setFromMatrixPosition(camera.matrixWorld);
    headForward.set(0, 0, -1).transformDirection(camera.matrixWorld);
    const hit = !press.current && headForward.y < LOOKING_DOWN && floorHit(headPosition, headForward);
    ring.current.visible = Boolean(hit);
    if (hit) {
      const { x, z } = insideFloors(hit, floors);
      ring.current.position.set(x, 0.004, z);
    }
  });

  /** */
  const handlePointerDown = (event) => {
    event.stopPropagation();
    const spot = insideFloors(event.point, floors);
    const pinch = { cancelled: false, spot, yaw: headInWorld().yaw };
    press.current = pinch;

    target.current.visible = true;
    target.current.position.set(spot.x, 0.006, spot.z);
    arrow.current.rotation.y = pinch.yaw;
    targetMaterial.current.color.set(TARGET_COLOUR);

    grab({
      /** Steer by the hand's movement across the floor; a raised hand cancels */
      onMove: (hand, start) => {
        movement.set(hand.x - start.x, 0, hand.z - start.z);
        pinch.yaw = handHeading(movement, pinch.yaw);
        pinch.cancelled = hand.y - start.y > LIFT_TO_CANCEL;
        arrow.current.rotation.y = pinch.yaw;
        targetMaterial.current.color.set(pinch.cancelled ? CANCEL_COLOUR : TARGET_COLOUR);
      },
      /** Release to go */
      onRelease: () => {
        press.current = null;
        target.current.visible = false;
        if (!pinch.cancelled) onTeleport(spot.x, spot.z, pinch.yaw);
      },
    });
  };

  return (
    <>
      {floors.map(({ depth, width, x = 0, z = 0 }) => (
        <mesh key={`${x},${z}`} position={[x, 0.002, z]} rotation-x={-Math.PI / 2} onPointerDown={handlePointerDown}>
          <planeGeometry args={[width, depth]} />
          <meshBasicMaterial depthWrite={false} opacity={0} transparent />
        </mesh>
      ))}
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.2, 0.24, 48]} />
        <meshBasicMaterial color="#ffffff" depthWrite={false} opacity={0.7} toneMapped={false} transparent />
      </mesh>
      <group ref={target} visible={false}>
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.32, 48]} />
          <meshBasicMaterial
            ref={targetMaterial}
            color={TARGET_COLOUR}
            depthWrite={false}
            opacity={0.5}
            toneMapped={false}
            transparent
          />
        </mesh>
        <group ref={arrow}>
          {/* Drawn with the see-through disc, after it: as an opaque mesh that doesn't
              write depth, it could be drawn before the floor and lost under it */}
          <mesh position={[0, 0.002, 0]} renderOrder={1} rotation-x={-Math.PI / 2}>
            <shapeGeometry args={[arrowShape]} />
            <meshBasicMaterial color="#ffffff" depthWrite={false} toneMapped={false} transparent />
          </mesh>
        </group>
      </group>
    </>
  );
}

FloorTeleport.propTypes = {
  floors: PropTypes.arrayOf(
    PropTypes.shape({ depth: PropTypes.number, width: PropTypes.number, x: PropTypes.number, z: PropTypes.number }),
  ).isRequired,
  headInWorld: PropTypes.func.isRequired,
  onTeleport: PropTypes.func.isRequired,
};
