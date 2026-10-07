import { getFocusedWindowId, getManifestStatus, getWindow, getWindowIds } from '../state/selectors';
import { enterXR, exitXR } from './state';
import { xrStore } from './xrStore';

let resolveStageReady;

/**
 * Resolves once the XR stage's renderer exists. A session can't start
 * before then, so a page's own Enter XR button waits for it.
 */
export const stageReady = new Promise((resolve) => {
  resolveStageReady = resolve;
});

/** Called by the XR stage once its renderer exists */
export const markStageReady = () => resolveStageReady();

/** The window whose work the gallery opens on: the focused one, else the first */
export function galleryWindowId(state) {
  return getFocusedWindowId(state) || getWindowIds(state)[0] || null;
}

/** Whether that window's manifest has loaded, so the gallery has something to hang */
export function galleryReady(state) {
  const windowId = galleryWindowId(state);
  const manifestId = windowId && getWindow(state, { windowId })?.manifestId;
  return Boolean(manifestId && getManifestStatus(state, { manifestId })?.json);
}

/**
 * Enters the XR gallery from a page that hosts Mirador, such as a landing
 * page with its own Enter XR button: records the window to show, then
 * requests the immersive session. Call it synchronously inside the click,
 * since Safari only grants a session from a user activation. If the session
 * can't start, the XR window is cleared again and the promise rejects.
 *
 * @param {object} store - a Mirador viewer's Redux store
 */
export function enterXRGallery(store) {
  const windowId = galleryWindowId(store.getState());
  if (!windowId) return Promise.reject(new Error('No Mirador window to show in XR'));

  store.dispatch(enterXR(windowId));
  return xrStore.enterVR().catch((error) => {
    store.dispatch(exitXR());
    throw error;
  });
}
