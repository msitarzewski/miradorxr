import { createXRStore } from '@react-three/xr';

/**
 * Shared WebXR session store. The Enter XR button and the XR stage must use
 * the same store: Safari only grants an immersive session from inside a user
 * activation, so the button's click handler is what requests the session.
 *
 * On localhost in a browser with no navigator.xr, @react-three/xr injects
 * Meta's IWER emulator (Quest 3 profile). Desktop Chrome already exposes
 * navigator.xr, so IWER skips itself there; use the visionOS Simulator.
 */
export const xrStore = createXRStore();
