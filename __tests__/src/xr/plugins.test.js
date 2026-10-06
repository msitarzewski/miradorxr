import xrPlugins from '../../../src/xr';
import { validatePlugin } from '../../../src/extend/pluginValidation';
import { xrReducer } from '../../../src/xr/state';

// A real store would try to set up WebXR in the test DOM
vi.mock('../../../src/xr/xrStore', () => ({ xrStore: {} }));

const plugin = (name) => xrPlugins.find((candidate) => candidate.name === name);

describe('Mirador XR plugins', () => {
  it('are all valid Mirador plugins', () => {
    xrPlugins.forEach((candidate) => expect(validatePlugin(candidate)).toBe(true));
  });

  it('add an Enter XR button to the workspace control panel', () => {
    expect(plugin('MiradorXREnterButton')).toMatchObject({ mode: 'add', target: 'WorkspaceControlPanelButtons' });
  });

  it('add a View in XR button to each window top bar', () => {
    expect(plugin('MiradorXRWindowButton')).toMatchObject({ mode: 'add', target: 'WindowTopBarPluginArea' });
  });

  it('mount the XR stage in the background plugin area', () => {
    expect(plugin('MiradorXRStage')).toMatchObject({ mode: 'add', target: 'BackgroundPluginArea' });
  });

  it('register the xr reducer', () => {
    expect(plugin('MiradorXREnterButton').reducers).toEqual({ xr: xrReducer });
  });

  it('hide the workspace button when there is no window to show', () => {
    const state = { workspace: { focusedWindowId: undefined, windowIds: [] } };
    expect(plugin('MiradorXREnterButton').mapStateToProps(state)).toEqual({ labelKey: 'enterXR', windowId: undefined });
  });

  it('ship English labels for both buttons', () => {
    expect(plugin('MiradorXREnterButton').config.translations.en).toEqual({
      enterXR: 'Enter XR gallery',
      viewInXR: 'View in XR',
    });
  });
});
