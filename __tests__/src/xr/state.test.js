import { enterXR, exitXR, getXRWindowId, xrReducer } from '../../../src/xr/state';

describe('xrReducer', () => {
  it('starts with no window in XR', () => {
    expect(xrReducer(undefined, {})).toEqual({ windowId: null });
  });

  it('records the window entering XR, and clears it on exit', () => {
    const entered = xrReducer(undefined, enterXR('window-1'));
    expect(entered).toEqual({ windowId: 'window-1' });
    expect(xrReducer(entered, exitXR())).toEqual({ windowId: null });
  });
});

describe('getXRWindowId', () => {
  it('reads the XR window from state', () => {
    expect(getXRWindowId({ xr: { windowId: 'window-1' } })).toEqual('window-1');
  });

  it('is null before the plugin reducer has run', () => {
    expect(getXRWindowId({})).toBeNull();
  });
});
