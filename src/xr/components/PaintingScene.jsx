import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useCurrentImage } from '../hooks/useCurrentImage';
import { useViewportHandoff } from '../hooks/useViewportHandoff';
import { useWallLabel } from '../hooks/useWallLabel';
import { getXRWindowId } from '../state';
import { DeepZoomImage } from './DeepZoomImage';
import { WallLabel } from './WallLabel';
import { XRStatsPanel } from './XRStatsPanel';

// Metres. A fixed height until true-to-scale sizing lands in Phase 3.
const PAINTING_HEIGHT = 1;
const FRAME_BORDER = 0.04;
const CENTRE_HEIGHT = 1.4;
const WALL_DISTANCE = 1.9;
const NEAR_DISTANCE = 0.6;
const LABEL_GAP = 0.15;

/**
 * The XR window's current work hung on a gallery wall and streamed at full
 * resolution, with its wall label beside it. Pinch the painting to bring it
 * close, and again to send it back. Leaving XR moves the 2D viewer to where
 * the viewer was looking.
 */
export function PaintingScene() {
  const windowId = useSelector(getXRWindowId);
  const { canvasId, infoId, infoJson } = useCurrentImage(windowId);
  const labelLines = useWallLabel(windowId, canvasId);
  const [near, setNear] = useState(false);
  const paintingGroup = useRef();
  const statsRef = useRef({});
  const width = infoJson ? PAINTING_HEIGHT * (infoJson.width / infoJson.height) : 0;

  useViewportHandoff({ height: PAINTING_HEIGHT, imageGroup: paintingGroup, infoId, width, windowId });

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
        <group
          ref={paintingGroup}
          position={[0, CENTRE_HEIGHT, -(near ? NEAR_DISTANCE : WALL_DISTANCE)]}
          onClick={() => setNear((value) => !value)}
        >
          <mesh position={[0, 0, -0.025]}>
            <boxGeometry args={[width + FRAME_BORDER * 2, PAINTING_HEIGHT + FRAME_BORDER * 2, 0.04]} />
            <meshStandardMaterial color="#3b2f22" />
          </mesh>
          <DeepZoomImage infoJson={infoJson} statsRef={statsRef} width={width} />
          <WallLabel lines={labelLines} position={[width / 2 + FRAME_BORDER + LABEL_GAP, -0.1, 0]} />
        </group>
      )}
      <XRStatsPanel
        label={infoJson ? labelLines[0]?.text : 'Waiting for image info…'}
        position={[-0.9, 1.1, -1.3]}
        rotation-y={0.5}
        statsRef={statsRef}
      />
    </>
  );
}
