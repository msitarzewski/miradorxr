/**
 * Holds tile textures under one byte budget, shared by every image in the
 * scene. Missing tiles load in priority order, a few at a time; loads for
 * tiles no longer wanted are aborted; and when over budget, the least
 * recently wanted tiles are evicted. Each image wants tiles as its own
 * owner, and a tile any owner still wants is never evicted, so each owner
 * includes everything it draws in its want() call.
 *
 * @param {function} options.load - (url, signal) => Promise<{texture, bytes}>
 */
export class TileCache {
  /** */
  constructor({ load, budgetBytes = 192 * 1024 * 1024, maxInFlight = 6, now = () => performance.now() }) {
    this.load = load;
    this.budgetBytes = budgetBytes;
    this.maxInFlight = maxInFlight;
    this.now = now;
    this.entries = new Map();
    this.inFlight = new Map();
    this.failed = new Set();
    this.wantedBy = new Map();
    this.bytes = 0;
  }

  /** */
  isLoaded(key) {
    return this.entries.has(key);
  }

  /** */
  texture(key) {
    return this.entries.get(key)?.texture;
  }

  /**
   * @param {Array<{key, url, priority}>} tiles - everything this owner
   * currently needs; a lower priority loads first
   * @param {string} owner - which image is asking
   */
  want(tiles, owner = 'default') {
    const time = this.now();
    this.wantedBy.set(owner, new Set(tiles.map(({ key }) => key)));
    const wanted = this.allWanted();

    tiles.forEach(({ key }) => {
      const entry = this.entries.get(key);
      if (entry) entry.lastWanted = time;
    });

    this.inFlight.forEach((controller, key) => {
      if (wanted.has(key)) return;
      controller.abort();
      this.inFlight.delete(key);
    });

    tiles
      .filter(({ key }) => !this.entries.has(key) && !this.inFlight.has(key) && !this.failed.has(key))
      .sort((a, b) => a.priority - b.priority)
      .slice(0, Math.max(0, this.maxInFlight - this.inFlight.size))
      .forEach((tile) => this.start(tile));

    this.evict(wanted);
  }

  /** Forgets an owner's wants, e.g. when its image leaves the scene */
  release(owner) {
    this.wantedBy.delete(owner);
  }

  /** @private */
  allWanted() {
    const wanted = new Set();
    this.wantedBy.forEach((keys) => keys.forEach((key) => wanted.add(key)));
    return wanted;
  }

  /** @private */
  start({ key, url }) {
    const controller = new AbortController();
    this.inFlight.set(key, controller);

    this.load(url, controller.signal)
      .then(({ texture, bytes }) => {
        if (this.inFlight.get(key) !== controller) {
          texture.dispose();
          return;
        }
        this.inFlight.delete(key);
        this.entries.set(key, { bytes, lastWanted: this.now(), texture });
        this.bytes += bytes;
      })
      .catch((error) => {
        if (this.inFlight.get(key) !== controller) return;
        this.inFlight.delete(key);
        this.failed.add(key);
        console.warn('[Mirador XR: tile failed to load]', url, error);
      });
  }

  /** @private */
  evict(wanted) {
    if (this.bytes <= this.budgetBytes) return;

    const candidates = [...this.entries.entries()]
      .filter(([key]) => !wanted.has(key))
      .sort(([, a], [, b]) => a.lastWanted - b.lastWanted);

    for (const [key, entry] of candidates) {
      if (this.bytes <= this.budgetBytes) break;
      entry.texture.dispose();
      this.entries.delete(key);
      this.bytes -= entry.bytes;
    }
  }

  /** Aborts pending loads and frees every texture */
  dispose() {
    this.inFlight.forEach((controller) => controller.abort());
    this.inFlight.clear();
    this.entries.forEach(({ texture }) => texture.dispose());
    this.entries.clear();
    this.wantedBy.clear();
    this.bytes = 0;
  }
}
