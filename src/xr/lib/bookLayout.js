// Metres, on the lectern's book board: each page of an open book fits PAGE,
// and an image that isn't part of a paged book fits the wider SINGLE box
export const PAGE = { height: 0.56, width: 0.44 };
export const SINGLE = { height: 0.56, width: 0.9 };
export const SPINE_GAP = 0.01;

/** The largest size with the given aspect ratio (width / height) that fits a box */
export const fitBox = (aspect, box) =>
  aspect > box.width / box.height
    ? { height: box.width / aspect, width: box.width }
    : { height: box.height, width: box.height * aspect };

const isRightToLeft = (book) => book.direction === 'right-to-left';

/**
 * Where each page of a spread lies on the board, centred across it: an open
 * book's two pages either side of the spine, in reading order (right to left
 * for books that read that way), each fitted to its own proportions and set
 * against the spine. A lone page on the first spread is the front cover, a
 * recto; any other lone page is a verso. An image that isn't part of a paged
 * book lies alone in the middle.
 *
 * @param {object} book - from useGalleryContents: `pages`, `spreads`, `paged`, `direction`
 * @returns {Array<{page, side: 'left'|'right'|'single', x, width, height}>}
 */
export function spreadLayout(book, spreadIndex) {
  const pages = (book.spreads[spreadIndex] || []).map((index) => book.pages[index]);
  if (!book.paged) return pages.map((page) => ({ ...fitBox(page.aspect, SINGLE), page, side: 'single', x: 0 }));

  const rightToLeft = isRightToLeft(book);
  const readingOrder = rightToLeft ? ['right', 'left'] : ['left', 'right'];
  const sides = pages.length === 2 ? readingOrder : [(spreadIndex === 0) !== rightToLeft ? 'right' : 'left'];

  return pages.map((page, index) => {
    const size = fitBox(page.aspect, PAGE);
    const side = sides[index];
    return { ...size, page, side, x: (side === 'left' ? -1 : 1) * (SPINE_GAP / 2 + size.width / 2) };
  });
}

/**
 * Which way pinching the board at `x` (metres from its middle) turns the
 * pages: +1 to read on, -1 to go back. Reading on is the right-hand side,
 * or the left in a right-to-left book.
 */
export function turnFromPinch(book, x) {
  return x >= 0 !== isRightToLeft(book) ? 1 : -1;
}

/**
 * The side of the spine the turning leaf starts from when turning the
 * page by `direction` (+1 reading on, -1 back): reading on lifts the
 * right-hand page over to the left, except in right-to-left books.
 */
export function leafSide(book, direction) {
  return direction > 0 !== isRightToLeft(book) ? 'right' : 'left';
}
