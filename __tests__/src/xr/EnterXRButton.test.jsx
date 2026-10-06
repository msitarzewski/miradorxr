import { render, screen } from '@tests/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { EnterXRButton } from '../../../src/xr/components/EnterXRButton';
import { xrStore } from '../../../src/xr/xrStore';

// A real store would try to inject the WebXR emulator into the test DOM
vi.mock('../../../src/xr/xrStore', () => ({ xrStore: { enterVR: vi.fn() } }));

describe('EnterXRButton', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders a button with the given class', () => {
    render(<EnterXRButton className="xyz" />);
    expect(screen.getByRole('button')).toHaveClass('xyz');
  });

  it('requests an immersive-vr session from the click', async () => {
    xrStore.enterVR.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<EnterXRButton />);

    await user.click(screen.getByRole('button'));

    expect(xrStore.enterVR).toHaveBeenCalledTimes(1);
  });

  it('warns instead of throwing when the session cannot start', async () => {
    const error = new Error('WebXR not supported');
    xrStore.enterVR.mockRejectedValue(error);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<EnterXRButton />);

    await user.click(screen.getByRole('button'));

    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith('[Mirador XR: could not start session]', error));
  });
});
