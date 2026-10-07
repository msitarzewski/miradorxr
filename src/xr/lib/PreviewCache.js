/**
 * Preview images shared by URL: each loads once however many meshes show
 * it, and is freed a moment after the last one lets go. The delay lets a
 * page handed from one mesh to another (a turning leaf landing on the book)
 * keep its texture instead of loading it again, and lets a lectern hold its
 * neighbouring spreads ready so pages turn without a wait.
 *
 * @param {function} options.load - (url, signal) => Promise<{texture, width, height}>
 */
export class PreviewCache {
  /** */
  constructor({ load, keepMs = 2000, schedule = (fn, ms) => setTimeout(fn, ms) }) {
    this.load = load;
    this.keepMs = keepMs;
    this.schedule = schedule;
    this.entries = new Map();
  }

  /** The preview, if it has already loaded */
  peek(url) {
    return this.entries.get(url)?.image ?? null;
  }

  /** Holds a preview until release(url); resolves with it once loaded */
  acquire(url) {
    let entry = this.entries.get(url);
    if (!entry) {
      entry = { controller: new AbortController(), holders: 0, image: null };
      entry.promise = this.load(url, entry.controller.signal).then((image) => {
        if (this.entries.get(url) === entry) entry.image = image;
        else image.texture.dispose();
        return image;
      });
      // Failures reach whoever awaits; an unawaited one isn't an unhandled rejection
      entry.promise.catch(() => {});
      this.entries.set(url, entry);
    }
    entry.holders += 1;
    return entry.promise;
  }

  /** Lets go of a preview; it's freed if nothing holds it again soon */
  release(url) {
    const entry = this.entries.get(url);
    if (!entry) return;
    entry.holders -= 1;
    if (entry.holders > 0) return;

    this.schedule(() => {
      if (entry.holders > 0 || this.entries.get(url) !== entry) return;
      this.entries.delete(url);
      entry.controller.abort();
      entry.image?.texture.dispose();
    }, this.keepMs);
  }

  /** Aborts every load and frees every texture */
  dispose() {
    this.entries.forEach((entry) => {
      entry.controller.abort();
      entry.image?.texture.dispose();
    });
    this.entries.clear();
  }
}
