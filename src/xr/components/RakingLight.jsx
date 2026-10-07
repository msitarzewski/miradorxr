import { useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, CanvasTexture, Matrix4, Ray, SRGBColorSpace } from 'three';
import { dragLight, lightSpot, onWorkPlane } from '../lib/rakingLight';
import { LabelButton } from './LabelButton';

const LAMP_RADIUS = 0.022;
const GLOW_SIZE = 0.16;
const LAMP_COLOUR = '#fff3dc';
const toLocal = new Matrix4();
// The glow is only light; sprites can't be raycast without a camera anyway
const noRaycast = () => {};
const localRay = new Ray();

/** A soft round glow, drawn once */
function glowTexture() {
  const size = 128;
  const canvas = Object.assign(document.createElement('canvas'), { height: size, width: size });
  const context = canvas.getContext('2d');
  const glow = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  glow.addColorStop(0, 'rgba(255, 240, 210, 0.9)');
  glow.addColorStop(0.25, 'rgba(255, 230, 190, 0.35)');
  glow.addColorStop(1, 'rgba(255, 220, 170, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * The raking light's lamp, hovering by the work you're at where the light
 * comes from; shown while Relief or Gloss is on. Pinch it and move your hand to
 * swing the light round the work, the way a conservator rakes a lamp
 * across a canvas: out to the side to throw the brushwork into relief,
 * over the middle to flatten it. The lamp sits `radius` metres from the
 * work's centre, which is its parent group's origin (+z out of the work).
 */
export function RakingLight({ paint, radius }) {
  const lamp = useRef();
  const drag = useRef(null);
  const glow = useMemo(glowTexture, []);

  useEffect(() => () => glow.dispose(), [glow]);

  // The light is shared, so follow it rather than keep a position of our own
  useFrame(() => {
    if (!lamp.current) return;
    lamp.current.position.copy(paint.light.value).multiplyScalar(radius);
  });

  /** Where the pinch's ray meets the work's plane, in the work's own space */
  const pinchOnWork = (event) => {
    const space = lamp.current.parent;
    space.updateWorldMatrix(true, false);
    localRay.copy(event.ray).applyMatrix4(toLocal.copy(space.matrixWorld).invert());
    return onWorkPlane(localRay);
  };

  const handlers = {
    /** */
    onPointerDown: (event) => {
      event.stopPropagation();
      event.object.setPointerCapture(event.pointerId);
      drag.current = {
        from: pinchOnWork(event),
        pointerId: event.pointerId,
        startSpot: lightSpot(paint.light.value, radius),
      };
    },
    /** */
    onPointerMove: (event) => {
      const { current } = drag;
      if (current?.pointerId !== event.pointerId) return;
      event.stopPropagation();
      const to = pinchOnWork(event);
      if (!current.from) current.from = to;
      if (to) dragLight(current.startSpot, current.from, to, radius, paint.light.value);
    },
    /** */
    onPointerUp: (event) => {
      if (drag.current?.pointerId !== event.pointerId) return;
      event.stopPropagation();
      event.object.releasePointerCapture(event.pointerId);
      drag.current = null;
    },
  };

  return (
    <group ref={lamp} {...handlers}>
      <mesh>
        <sphereGeometry args={[LAMP_RADIUS, 24, 16]} />
        <meshBasicMaterial color={LAMP_COLOUR} toneMapped={false} />
      </mesh>
      <sprite raycast={noRaycast} scale={[GLOW_SIZE, GLOW_SIZE, 1]}>
        <spriteMaterial blending={AdditiveBlending} depthWrite={false} map={glow} toneMapped={false} transparent />
      </sprite>
      <LabelButton onClick={(event) => event.stopPropagation()} position={[0, -0.06, 0]} text="Light" />
    </group>
  );
}

RakingLight.propTypes = {
  paint: PropTypes.objectOf(PropTypes.shape({ value: PropTypes.any })).isRequired,
  radius: PropTypes.number.isRequired,
};
