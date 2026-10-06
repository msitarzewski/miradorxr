import { miradorSlice } from '../state/selectors/utils';

export const XR_ENTER = 'mirador-xr/ENTER';
export const XR_EXIT = 'mirador-xr/EXIT';

/** The window whose current work is shown in the XR session */
export const enterXR = (windowId) => ({ type: XR_ENTER, windowId });

/** */
export const exitXR = () => ({ type: XR_EXIT });

/** Plugin reducer, mounted at state.xr */
export function xrReducer(state = { windowId: null }, action = {}) {
  switch (action.type) {
    case XR_ENTER:
      return { ...state, windowId: action.windowId };
    case XR_EXIT:
      return { ...state, windowId: null };
    default:
      return state;
  }
}

/** */
export const getXRWindowId = (state) => miradorSlice(state).xr?.windowId ?? null;
