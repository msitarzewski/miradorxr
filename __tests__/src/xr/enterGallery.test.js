import { enterXRGallery, galleryReady, galleryWindowId } from '../../../src/xr/enterGallery';
import { enterXR, exitXR } from '../../../src/xr/state';
import { xrStore } from '../../../src/xr/xrStore';

// A real store would try to set up WebXR in the test DOM
vi.mock('../../../src/xr/xrStore', () => ({ xrStore: { enterVR: vi.fn() } }));

/** Mirador state with two windows, the second focused, and whether its manifest has loaded */
const miradorState = ({ focused = 'w2', loaded = true } = {}) => ({
  manifests: { 'https://example.org/m2': loaded ? { json: { '@id': 'https://example.org/m2' } } : { isFetching: true } },
  windows: { w1: { id: 'w1', manifestId: 'https://example.org/m1' }, w2: { id: 'w2', manifestId: 'https://example.org/m2' } },
  workspace: { focusedWindowId: focused, windowIds: ['w1', 'w2'] },
});

const storeOf = (state) => ({ dispatch: vi.fn(), getState: () => state });

describe('galleryWindowId', () => {
  it('opens on the focused window, else the first', () => {
    expect(galleryWindowId(miradorState())).toEqual('w2');
    expect(galleryWindowId(miradorState({ focused: null }))).toEqual('w1');
  });
});

describe('galleryReady', () => {
  it('waits for that window’s manifest', () => {
    expect(galleryReady(miradorState())).toBe(true);
    expect(galleryReady(miradorState({ loaded: false }))).toBe(false);
  });
});

describe('enterXRGallery', () => {
  afterEach(() => vi.clearAllMocks());

  it('records the window, then requests the session', async () => {
    xrStore.enterVR.mockResolvedValue(undefined);
    const store = storeOf(miradorState());
    await enterXRGallery(store);
    expect(store.dispatch).toHaveBeenCalledWith(enterXR('w2'));
    expect(store.dispatch.mock.invocationCallOrder[0]).toBeLessThan(xrStore.enterVR.mock.invocationCallOrder[0]);
  });

  it('clears the XR window again when the session cannot start', async () => {
    xrStore.enterVR.mockRejectedValue(new Error('WebXR not supported'));
    const store = storeOf(miradorState());
    await expect(enterXRGallery(store)).rejects.toThrow('WebXR not supported');
    expect(store.dispatch).toHaveBeenLastCalledWith(exitXR());
  });
});
