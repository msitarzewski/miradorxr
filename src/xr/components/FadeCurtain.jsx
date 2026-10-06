import { useImperativeHandle, useRef } from 'react';
import PropTypes from 'prop-types';
import { useFrame, useThree } from '@react-three/fiber';
import { BackSide, Vector3 } from 'three';

const FADE_SECONDS = 0.15;
const head = new Vector3();

/**
 * A dark sphere around the head for teleport transitions: fades to dark,
 * runs the move, and fades back in, so the jump never shows as motion.
 * Use the ref's `around(move)`.
 */
export function FadeCurtain({ ref = undefined }) {
  const gl = useThree((state) => state.gl);
  const mesh = useRef();
  const material = useRef();
  const fade = useRef({ resolve: null, target: 0 });

  /** Resolves once the curtain reaches the target opacity */
  const fadeTo = (target) =>
    new Promise((resolve) => {
      fade.current = { resolve, target };
    });

  useImperativeHandle(ref, () => ({
    async around(move) {
      await fadeTo(1);
      move();
      await fadeTo(0);
    },
  }));

  useFrame((_state, delta) => {
    const { resolve, target } = fade.current;
    if (!material.current) return;

    const step = delta / FADE_SECONDS;
    const { opacity } = material.current;
    material.current.opacity = target > opacity ? Math.min(target, opacity + step) : Math.max(target, opacity - step);
    mesh.current.visible = material.current.opacity > 0;
    // matrixWorld is the head between the eyes, including the XR origin
    mesh.current.position.copy(head.setFromMatrixPosition(gl.xr.getCamera().matrixWorld));

    if (resolve && material.current.opacity === target) {
      fade.current.resolve = null;
      resolve();
    }
  });

  return (
    <mesh ref={mesh} renderOrder={1000} visible={false}>
      <sphereGeometry args={[0.3, 16, 12]} />
      <meshBasicMaterial
        ref={material}
        color="#000000"
        depthTest={false}
        depthWrite={false}
        opacity={0}
        side={BackSide}
        transparent
      />
    </mesh>
  );
}

FadeCurtain.propTypes = {
  ref: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
};
