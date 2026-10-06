import { TileCache } from '../../../src/xr/lib/TileCache';

/** A loader whose loads resolve or reject when the test says so */
function createControlledLoader() {
  const pending = new Map();
  const load = vi.fn(
    (url, signal) =>
      new Promise((resolve, reject) => {
        pending.set(url, { reject, resolve, signal });
      }),
  );
  /** Resolves a load and lets the cache's promise handlers run */
  const finish = async (url, bytes = 100) => {
    const texture = { dispose: vi.fn() };
    pending.get(url).resolve({ bytes, texture });
    await Promise.resolve();
    await Promise.resolve();
    return texture;
  };
  /** */
  const fail = async (url) => {
    pending.get(url).reject(new Error('HTTP 404'));
    await Promise.resolve();
    await Promise.resolve();
  };
  return { fail, finish, load, pending };
}

const tile = (key, priority = 0) => ({ key, priority, url: `https://example.org/${key}` });

describe('TileCache', () => {
  let clock;
  let loader;

  beforeEach(() => {
    clock = 0;
    loader = createControlledLoader();
  });

  /** */
  const createCache = (options = {}) => new TileCache({ load: loader.load, now: () => clock, ...options });

  it('loads at most maxInFlight tiles at once, lowest priority first', () => {
    const cache = createCache({ maxInFlight: 2 });
    cache.want([tile('c', 3), tile('a', 1), tile('b', 2)]);

    expect(loader.load.mock.calls.map(([url]) => url)).toEqual(['https://example.org/a', 'https://example.org/b']);
  });

  it('marks finished tiles as loaded', async () => {
    const cache = createCache();
    cache.want([tile('a')]);
    const texture = await loader.finish('https://example.org/a', 250);

    expect(cache.isLoaded('a')).toBe(true);
    expect(cache.texture('a')).toBe(texture);
    expect(cache.bytes).toEqual(250);
  });

  it('aborts loads that are no longer wanted', () => {
    const cache = createCache();
    cache.want([tile('a'), tile('b')]);
    cache.want([tile('b')]);

    expect(loader.pending.get('https://example.org/a').signal.aborted).toBe(true);
    expect(cache.inFlight.has('a')).toBe(false);
    expect(cache.inFlight.has('b')).toBe(true);
  });

  it('evicts the least recently wanted tiles once over budget, never wanted ones', async () => {
    const cache = createCache({ budgetBytes: 250 });
    cache.want([tile('old'), tile('newer'), tile('kept')]);
    const old = await loader.finish('https://example.org/old');
    clock = 1;
    await loader.finish('https://example.org/newer');
    await loader.finish('https://example.org/kept');

    clock = 2;
    cache.want([tile('kept'), tile('next')]);
    await loader.finish('https://example.org/next');
    clock = 3;
    cache.want([tile('kept'), tile('next')]);

    expect(old.dispose).toHaveBeenCalled();
    expect(cache.isLoaded('old')).toBe(false);
    expect(cache.isLoaded('newer')).toBe(false);
    expect(cache.isLoaded('kept')).toBe(true);
    expect(cache.isLoaded('next')).toBe(true);
    expect(cache.bytes).toEqual(200);
  });

  it("keeps tiles another owner still wants, and lets them go once it's released", async () => {
    const cache = createCache({ budgetBytes: 100 });
    cache.want([tile('a')], 'first');
    cache.want([tile('b')], 'second');
    await loader.finish('https://example.org/a');
    await loader.finish('https://example.org/b');

    cache.want([tile('a')], 'first');
    expect(cache.isLoaded('b')).toBe(true);

    cache.release('second');
    cache.want([tile('a')], 'first');
    expect(cache.isLoaded('a')).toBe(true);
    expect(cache.isLoaded('b')).toBe(false);
  });

  it('does not abort a load another owner still wants', () => {
    const cache = createCache();
    cache.want([tile('shared')], 'first');
    cache.want([tile('shared')], 'second');
    cache.want([], 'first');

    expect(loader.pending.get('https://example.org/shared').signal.aborted).toBe(false);
  });

  it('does not retry a tile that failed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cache = createCache();
    cache.want([tile('a')]);
    await loader.fail('https://example.org/a');
    cache.want([tile('a')]);

    expect(loader.load).toHaveBeenCalledTimes(1);
    expect(cache.failed.has('a')).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('frees textures and aborts loads on dispose', async () => {
    const cache = createCache();
    cache.want([tile('a'), tile('b')]);
    const texture = await loader.finish('https://example.org/a');
    cache.dispose();

    expect(texture.dispose).toHaveBeenCalled();
    expect(loader.pending.get('https://example.org/b').signal.aborted).toBe(true);
    expect(cache.bytes).toEqual(0);
  });
});
