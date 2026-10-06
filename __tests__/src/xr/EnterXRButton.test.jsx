import { render, screen } from '@tests/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { EnterXRButton } from '../../../src/xr/components/EnterXRButton';
import { xrStore } from '../../../src/xr/xrStore';

// A real store would try to set up WebXR in the test DOM
vi.mock('../../../src/xr/xrStore', () => ({ xrStore: { enterVR: vi.fn() } }));

describe('EnterXRButton', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders a button with the given class', () => {
    render(<EnterXRButton className="xyz" enterXR={vi.fn()} exitXR={vi.fn()} windowId="window-1" />);
    expect(screen.getByRole('button')).toHaveClass('xyz');
  });

  it('renders nothing without a window to show', () => {
    render(<EnterXRButton enterXR={vi.fn()} exitXR={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('records the window, then requests an immersive-vr session from the click', async () => {
    const enterXR = vi.fn();
    xrStore.enterVR.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<EnterXRButton enterXR={enterXR} exitXR={vi.fn()} windowId="window-1" />);

    await user.click(screen.getByRole('button'));

    expect(enterXR).toHaveBeenCalledWith('window-1');
    expect(xrStore.enterVR).toHaveBeenCalledTimes(1);
    expect(enterXR.mock.invocationCallOrder[0]).toBeLessThan(xrStore.enterVR.mock.invocationCallOrder[0]);
  });

  it('warns and clears the XR window when the session cannot start', async () => {
    const error = new Error('WebXR not supported');
    const exitXR = vi.fn();
    xrStore.enterVR.mockRejectedValue(error);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<EnterXRButton enterXR={vi.fn()} exitXR={exitXR} windowId="window-1" />);

    await user.click(screen.getByRole('button'));

    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith('[Mirador XR: could not start session]', error));
    expect(exitXR).toHaveBeenCalled();
  });
});
