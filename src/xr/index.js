import { getCurrentCanvas, getFocusedWindowId, getMiradorCanvasWrapper, getWindowIds } from '../state/selectors';
import { EnterXRButton } from './components/EnterXRButton';
import { XRStage } from './components/XRStage';
import { enterXR, xrReducer } from './state';
import translations from './translations';

/** Whether the window's current canvas has a IIIF image the XR scene can stream */
const hasIiifImage = (state, windowId) => {
  const canvas = getCurrentCanvas(state, { windowId });
  return getMiradorCanvasWrapper(state)(canvas)?.iiifImageResources.length > 0;
};

/**
 * Mirador XR plugins. Kept plugin-shaped so this directory can later ship as
 * a standalone plugin for stock Mirador.
 */
export default [
  {
    component: EnterXRButton,
    config: { translations },
    mapDispatchToProps: { enterXR },
    // The workspace button shows the focused window's work, else the first window's
    mapStateToProps: (state) => {
      const windowId = getFocusedWindowId(state) || getWindowIds(state)[0];
      return { labelKey: 'enterXR', windowId: windowId && hasIiifImage(state, windowId) ? windowId : undefined };
    },
    mode: 'add',
    name: 'MiradorXREnterButton',
    reducers: { xr: xrReducer },
    target: 'WorkspaceControlPanelButtons',
  },
  {
    component: EnterXRButton,
    mapDispatchToProps: { enterXR },
    mapStateToProps: (state, { windowId }) => ({
      labelKey: 'viewInXR',
      windowId: hasIiifImage(state, windowId) ? windowId : undefined,
    }),
    mode: 'add',
    name: 'MiradorXRWindowButton',
    target: 'WindowTopBarPluginArea',
  },
  {
    component: XRStage,
    mode: 'add',
    name: 'MiradorXRStage',
    target: 'BackgroundPluginArea',
  },
];
