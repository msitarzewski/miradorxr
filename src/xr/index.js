import { EnterXRButton } from './components/EnterXRButton';
import { XRStage } from './components/XRStage';
import translations from './translations';

/**
 * Mirador XR plugins. Kept plugin-shaped so this directory can later ship as
 * a standalone plugin for stock Mirador.
 */
export default [
  {
    component: EnterXRButton,
    config: { translations },
    mode: 'add',
    name: 'MiradorXREnterButton',
    target: 'WorkspaceControlPanelButtons',
  },
  {
    component: XRStage,
    mode: 'add',
    name: 'MiradorXRStage',
    target: 'BackgroundPluginArea',
  },
];
