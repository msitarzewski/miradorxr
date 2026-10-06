import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useFrame, useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { Quaternion, Shape, Vector3 } from 'three';
import { floorHit, handHeading, insideRoom } from '../lib/floorTarget';

// Looking more than about 20 degrees below level shows where your head is aimed
const LOOKING_DOWN = -0.35;
// Raising the pinching hand this far (metres) arms a cancel
const LIFT_TO_CANCEL = 0.12;
const TARGET_COLOUR = '#3ec46d';
const CANCEL_COLOUR = '#8a8a8a';
const headPosition = new Vector3();
const headForward = new Vector3();
const movement = new Vector3();
const originRotation = new Quaternion();

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
 * The hand is read from the pinch's gripSpace, which Vision Pro tracks at the
 * pinching fingers. Its targetRaySpace isn't used for steering: that ray
 * pivots between the eyes, so hand movement only swings its angle.
 */
export function FloorTeleport({ depth, headInWorld, onTeleport, width }) {
  const gl = useThree((state) => state.gl);
  const session = useXR((state) => state.session);
  const room = { depth, width };
  const ring = useRef();
  const target = useRef();
  const targetMaterial = useRef();
  const arrow = useRef();
  const lastSelect = useRef(null);
  const press = useRef(null);
  const teleport = useRef(onTeleport);
  teleport.current = onTeleport;

  // The input source behind a pinch: a pointer event alone doesn't say which hand
  useEffect(() => {
    if (!session) return undefined;

    /** */
    const handleSelectStart = ({ inputSource }) => {
      lastSelect.current = inputSource;
    };
    /** */
    const handleSelectEnd = ({ inputSource }) => {
      const { current } = press;
      if (!current || current.source !== inputSource) return;
      press.current = null;
      target.current.visible = false;
      if (!current.cancelled) teleport.current(current.spot.x, current.spot.z, current.yaw);
    };

    session.addEventListener('selectstart', handleSelectStart);
    session.addEventListener('selectend', handleSelectEnd);
    return () => {
      session.removeEventListener('selectstart', handleSelectStart);
      session.removeEventListener('selectend', handleSelectEnd);
    };
  }, [session]);

  useFrame((_state, _delta, frame) => {
    if (!gl.xr.isPresenting || !ring.current) return;

    const camera = gl.xr.getCamera();
    const { current } = press;

    // matrixWorld is the head between the eyes, including the XR origin
    headPosition.setFromMatrixPosition(camera.matrixWorld);
    headForward.set(0, 0, -1).transformDirection(camera.matrixWorld);
    const hit = !current && headForward.y < LOOKING_DOWN && floorHit(headPosition, headForward);
    ring.current.visible = Boolean(hit);
    if (hit) {
      const { x, z } = insideRoom(hit, room);
      ring.current.position.set(x, 0.004, z);
    }

    const pose = current?.source && frame?.getPose(current.source.gripSpace, gl.xr.getReferenceSpace());
    if (!pose) return;

    // The hand's movement since the pinch began, turned from the origin's space into the room's
    const { position } = pose.transform;
    if (!current.start) current.start = { x: position.x, y: position.y, z: position.z };
    movement.set(position.x - current.start.x, 0, position.z - current.start.z);
    movement.applyQuaternion(camera.parent ? camera.parent.getWorldQuaternion(originRotation) : originRotation.identity());

    current.yaw = handHeading(movement, current.yaw);
    current.cancelled = position.y - current.start.y > LIFT_TO_CANCEL;
    arrow.current.rotation.y = current.yaw;
    targetMaterial.current.color.set(current.cancelled ? CANCEL_COLOUR : TARGET_COLOUR);
  });

  /** */
  const handlePointerDown = (event) => {
    event.stopPropagation();
    const spot = insideRoom(event.point, room);
    const { yaw } = headInWorld();
    press.current = { cancelled: false, source: lastSelect.current, spot, start: null, yaw };

    target.current.visible = true;
    target.current.position.set(spot.x, 0.006, spot.z);
    arrow.current.rotation.y = yaw;
    targetMaterial.current.color.set(TARGET_COLOUR);
  };

  return (
    <>
      <mesh position={[0, 0.002, 0]} rotation-x={-Math.PI / 2} onPointerDown={handlePointerDown}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial depthWrite={false} opacity={0} transparent />
      </mesh>
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
          <mesh position={[0, 0.002, 0]} rotation-x={-Math.PI / 2}>
            <shapeGeometry args={[arrowShape]} />
            <meshBasicMaterial color="#ffffff" depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </>
  );
}

FloorTeleport.propTypes = {
  depth: PropTypes.number.isRequired,
  headInWorld: PropTypes.func.isRequired,
  onTeleport: PropTypes.func.isRequired,
  width: PropTypes.number.isRequired,
};
