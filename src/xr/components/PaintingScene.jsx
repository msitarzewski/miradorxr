import { useRef, useState } from 'react';
import { useCurrentImage } from '../hooks/useCurrentImage';
import { DeepZoomImage } from './DeepZoomImage';
import { XRStatsPanel } from './XRStatsPanel';

// Metres. A fixed height until true-to-scale sizing lands in Phase 3.
const PAINTING_HEIGHT = 1;
const FRAME_BORDER = 0.04;
const CENTRE_HEIGHT = 1.4;
const WALL_DISTANCE = 1.9;
const NEAR_DISTANCE = 0.6;

/**
 * Phase 1 scene: the first window's current image hung on a gallery wall and
 * streamed at full resolution, with a readout of what it costs. Pinch the
 * painting to bring it close, and again to send it back.
 */
export function PaintingScene() {
  const { canvasLabel, infoJson, manifestTitle } = useCurrentImage();
  const [near, setNear] = useState(false);
  const statsRef = useRef({});
  const width = infoJson ? PAINTING_HEIGHT * (infoJson.width / infoJson.height) : 0;
  const label = infoJson ? [canvasLabel, manifestTitle].filter(Boolean).join(' · ') : 'Waiting for image info…';

  return (
    <>
      <color attach="background" args={['#141416']} />
      <ambientLight intensity={0.5} />
      <directionalLight intensity={1.2} position={[1, 3, 1]} />
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#2b2a28" />
      </mesh>
      <mesh position={[0, 2, -WALL_DISTANCE - 0.06]}>
        <planeGeometry args={[8, 4]} />
        <meshStandardMaterial color="#5a5650" />
      </mesh>
      {infoJson && (
        <group position={[0, CENTRE_HEIGHT, -(near ? NEAR_DISTANCE : WALL_DISTANCE)]} onClick={() => setNear((value) => !value)}>
          <mesh position={[0, 0, -0.025]}>
            <boxGeometry args={[width + FRAME_BORDER * 2, PAINTING_HEIGHT + FRAME_BORDER * 2, 0.04]} />
            <meshStandardMaterial color="#3b2f22" />
          </mesh>
          <DeepZoomImage infoJson={infoJson} statsRef={statsRef} width={width} />
        </group>
      )}
      <XRStatsPanel label={label} position={[-0.9, 1.1, -1.3]} rotation-y={0.5} statsRef={statsRef} />
    </>
  );
}
