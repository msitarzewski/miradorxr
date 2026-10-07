import { useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, CanvasTexture, SRGBColorSpace, Vector3 } from 'three';
import { handGain, usePinchHand } from '../hooks/usePinchHand';
import { lampLight } from '../lib/rakingLight';

const LAMP_RADIUS = 0.022;
const GLOW_SIZE = 0.16;
const LAMP_COLOUR = '#fff3dc';
// Metres round the bulb that a pinch takes hold of it
const GRAB_RADIUS = 0.06;
// The glow breathes by this much, this fast, and swells while held
const BREATH = 0.08;
const BREATH_RATE = 2.4;
const HELD_GLOW = 1.3;
const lampAt = new Vector3();
// The glow is only light; sprites can't be raycast without a camera anyway
const noRaycast = () => {};

/** A soft round glow, drawn once */
function drawGlow() {
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
 * comes from; shown while Relief or Gloss is on. Its glow breathes slowly,
 * to show it can be taken hold of: pinch it and it moves with your hand,
 * the way a conservator rakes a lamp across a canvas. Out to the side
 * throws the brushwork into relief; over the middle flattens it. The
 * work's centre is the parent group's origin (+z out of the work); the
 * lamp starts `radius` metres from it.
 */
export function RakingLight({ paint, radius }) {
  const lamp = useRef();
  const glow = useRef();
  const distance = useRef(radius);
  const held = useRef(false);
  const grab = usePinchHand();
  const glowTexture = useMemo(drawGlow, []);

  useEffect(() => () => glowTexture.dispose(), [glowTexture]);

  // The light is shared between works, so the lamp follows it
  useFrame((state) => {
    if (!lamp.current) return;
    lamp.current.position.copy(paint.light.value).multiplyScalar(distance.current);
    const breath = held.current ? HELD_GLOW : 1 + BREATH * Math.sin(state.clock.elapsedTime * BREATH_RATE);
    glow.current.scale.set(GLOW_SIZE * breath, GLOW_SIZE * breath, 1);
  });

  /** Takes hold of the lamp: from here it moves with the pinching hand */
  const handlePointerDown = (event) => {
    event.stopPropagation();
    const work = lamp.current.parent;
    const from = lamp.current.getWorldPosition(new Vector3());
    let gain = null;
    held.current = true;

    grab({
      /** Moves the lamp as far as the hand has moved, scaled to stay under the fingers */
      onMove: (hand, start, head) => {
        gain ??= handGain(head, start, from);
        work.updateWorldMatrix(true, false);
        lampAt.copy(hand).sub(start).multiplyScalar(gain).add(from);
        distance.current = lampLight(work.worldToLocal(lampAt), paint.light.value);
      },
      /** */
      onRelease: () => {
        held.current = false;
      },
    });
  };

  return (
    <group ref={lamp} onPointerDown={handlePointerDown}>
      <mesh>
        <sphereGeometry args={[LAMP_RADIUS, 24, 16]} />
        <meshBasicMaterial color={LAMP_COLOUR} toneMapped={false} />
      </mesh>
      {/* An easier thing to pinch than the small bulb */}
      <mesh>
        <sphereGeometry args={[GRAB_RADIUS, 16, 12]} />
        <meshBasicMaterial depthWrite={false} opacity={0} transparent />
      </mesh>
      <sprite ref={glow} raycast={noRaycast} scale={[GLOW_SIZE, GLOW_SIZE, 1]}>
        <spriteMaterial blending={AdditiveBlending} depthWrite={false} map={glowTexture} toneMapped={false} transparent />
      </sprite>
    </group>
  );
}

RakingLight.propTypes = {
  paint: PropTypes.objectOf(PropTypes.shape({ value: PropTypes.any })).isRequired,
  radius: PropTypes.number.isRequired,
};
