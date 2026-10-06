import { createXRStore } from '@react-three/xr';

/**
 * Shared WebXR session store. The Enter XR button and the XR stage must use
 * the same store: Safari only grants an immersive session from inside a user
 * activation, so the button's click handler is what requests the session.
 *
 * The built-in emulator stays off: its dev UI bundles three 0.165, whose
 * renderer throws on this project's three materials every frame.
 */
export const xrStore = createXRStore({ emulate: false });
