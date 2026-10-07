import { PreviewCache } from '../../../src/xr/lib/PreviewCache';

/** A loader whose loads resolve when the test says, with textures that record disposal */
function fakeLoader() {
  const pending = new Map();
  const load = vi.fn(
    (url) =>
      new Promise((resolve, reject) => {
        pending.set(url, { reject, resolve: () => resolve({ height: 1, texture: { dispose: vi.fn() }, url, width: 1 }) });
      }),
  );
  return { load, pending };
}

/** Runs scheduled callbacks only when the test flushes them */
function manualSchedule() {
  const queue = [];
  return { flush: () => queue.splice(0).forEach((fn) => fn()), schedule: (fn) => queue.push(fn) };
}

describe('PreviewCache', () => {
  it('loads each URL once, however many hold it', async () => {
    const { load, pending } = fakeLoader();
    const cache = new PreviewCache({ load });
    const first = cache.acquire('a');
    const second = cache.acquire('a');
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.peek('a')).toBeNull();

    pending.get('a').resolve();
    expect(await first).toBe(await second);
    expect(cache.peek('a')).toBe(await first);
  });

  it('keeps a preview that is released and taken again before the delay is up', async () => {
    const { load, pending } = fakeLoader();
    const { flush, schedule } = manualSchedule();
    const cache = new PreviewCache({ load, schedule });
    const image = cache.acquire('a');
    pending.get('a').resolve();
    const { texture } = await image;

    cache.release('a');
    cache.acquire('a');
    flush();
    expect(texture.dispose).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('frees a preview once nothing has held it for the delay', async () => {
    const { load, pending } = fakeLoader();
    const { flush, schedule } = manualSchedule();
    const cache = new PreviewCache({ load, schedule });
    const image = cache.acquire('a');
    pending.get('a').resolve();
    const { texture } = await image;

    cache.release('a');
    flush();
    expect(texture.dispose).toHaveBeenCalled();
    expect(cache.peek('a')).toBeNull();
  });

  it('passes on a failed load to whoever is waiting', async () => {
    const { load, pending } = fakeLoader();
    const cache = new PreviewCache({ load });
    const image = cache.acquire('a');
    pending.get('a').reject(new Error('no CORS'));
    await expect(image).rejects.toThrow('no CORS');
  });
});
