import { useRef } from 'react';
import PropTypes from 'prop-types';
import { useFrame } from '@react-three/fiber';

// A load quicker than this shows no cue at all
const SHOW_AFTER_SECONDS = 0.3;
const FADE_RATE = 5;
const FILL_RATE = 6;
const HEIGHT = 0.004;
const COLOUR = '#2d2a26';
const TRACK_OPACITY = 0.15;
const FILL_OPACITY = 0.7;

/**
 * A thin bar under a painting while sharper detail streams in. It fades in
 * once loading has gone on for a moment, fills as tiles arrive, and fades
 * away when the view is complete. Reads `progressRef.current`, a
 * `{ ready, total }` count of tiles, every frame.
 */
export function LoadingCue({ progressRef, width, ...groupProps }) {
  const group = useRef();
  const fill = useRef();
  const trackMaterial = useRef();
  const fillMaterial = useRef();
  const cue = useRef({ filled: 0, opacity: 0, waited: 0 });

  useFrame((_state, delta) => {
    if (!group.current) return;
    const { ready = 0, total = 0 } = progressRef.current ?? {};
    const state = cue.current;
    const loading = ready < total;

    state.waited = loading ? state.waited + delta : 0;
    // Once showing, it stays up through follow-on loads instead of flickering
    const target = loading && (state.waited > SHOW_AFTER_SECONDS || state.opacity > 0.05) ? 1 : 0;
    state.opacity += (target - state.opacity) * Math.min(1, delta * FADE_RATE);
    state.filled += ((total > 0 ? ready / total : 1) - state.filled) * Math.min(1, delta * FILL_RATE);

    group.current.visible = state.opacity > 0.01;
    fill.current.scale.x = Math.max(state.filled, 0.001) * width;
    fill.current.position.x = ((state.filled - 1) * width) / 2;
    trackMaterial.current.opacity = TRACK_OPACITY * state.opacity;
    fillMaterial.current.opacity = FILL_OPACITY * state.opacity;
  });

  return (
    <group ref={group} visible={false} {...groupProps}>
      <mesh scale={[width, HEIGHT, 1]}>
        <planeGeometry />
        <meshBasicMaterial ref={trackMaterial} color={COLOUR} depthWrite={false} toneMapped={false} transparent />
      </mesh>
      <mesh ref={fill} position-z={0.0005} scale={[0.001, HEIGHT, 1]}>
        <planeGeometry />
        <meshBasicMaterial ref={fillMaterial} color={COLOUR} depthWrite={false} toneMapped={false} transparent />
      </mesh>
    </group>
  );
}

LoadingCue.propTypes = {
  progressRef: PropTypes.shape({ current: PropTypes.object }).isRequired,
  width: PropTypes.number.isRequired,
};
