import xrPlugins from '../../../src/xr';
import { validatePlugin } from '../../../src/extend/pluginValidation';

// A real store would try to inject the WebXR emulator into the test DOM
vi.mock('../../../src/xr/xrStore', () => ({ xrStore: {} }));

describe('Mirador XR plugins', () => {
  it('are all valid Mirador plugins', () => {
    xrPlugins.forEach((plugin) => expect(validatePlugin(plugin)).toBe(true));
  });

  it('add the Enter XR button to the workspace control panel', () => {
    const button = xrPlugins.find((plugin) => plugin.name === 'MiradorXREnterButton');
    expect(button).toMatchObject({ mode: 'add', target: 'WorkspaceControlPanelButtons' });
  });

  it('mount the XR stage in the background plugin area', () => {
    const stage = xrPlugins.find((plugin) => plugin.name === 'MiradorXRStage');
    expect(stage).toMatchObject({ mode: 'add', target: 'BackgroundPluginArea' });
  });

  it('ship an English label for the Enter XR button', () => {
    const button = xrPlugins.find((plugin) => plugin.name === 'MiradorXREnterButton');
    expect(button.config.translations.en.enterXR).toEqual('Enter XR gallery');
  });
});
