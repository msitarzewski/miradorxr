import { useState } from 'react';

/**
 * Phase 0 smoke test: a cube at eye height that changes colour when
 * selected, which on visionOS means a gaze + pinch (transient-pointer).
 */
export function HelloScene() {
  const [selected, setSelected] = useState(false);

  return (
    <>
      <color attach="background" args={['#1c1c20']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[1, 3, 2]} intensity={1.5} />
      <mesh position={[0, 1.4, -1.2]} rotation={[0.4, 0.6, 0]} onClick={() => setSelected((value) => !value)}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color={selected ? '#d4a017' : '#6b8cce'} />
      </mesh>
    </>
  );
}
