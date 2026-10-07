// Metres, on the lectern's book board. A page whose size is known lies at
// that size; otherwise each page of an open book fits PAGE, and an image
// that isn't part of a paged book fits the wider SINGLE box
export const PAGE = { height: 0.56, width: 0.44 };
export const SINGLE = { height: 0.56, width: 0.9 };
export const SPINE_GAP = 0.01;

/** The largest size with the given aspect ratio (width / height) that fits a box */
export const fitBox = (aspect, box) =>
  aspect > box.width / box.height
    ? { height: box.width / aspect, width: box.width }
    : { height: box.height, width: box.height * aspect };

const isRightToLeft = (book) => book.direction === 'right-to-left';

/** A page's size on the board: its own, if known, else fitted to the board */
export const pageSize = (page, paged) =>
  page.size && !page.size.approximate
    ? { height: page.size.height, width: page.size.width }
    : fitBox(page.aspect, paged ? PAGE : SINGLE);

// Metres of board round the book, and the smallest board a lectern has
const BOARD_MARGIN = 0.07;
const SMALLEST_BOARD = { depth: 0.68, width: 1 };

/**
 * The lectern board a book needs: big enough for its largest opening,
 * and never smaller than the usual board, so it stays the same size as
 * the pages turn. Also the size of the block of pages under an open book.
 *
 * @returns {{board: {width, depth}, block: {width, height}}}
 */
export function bookBoard(book) {
  const sizes = book.pages.map((page) => pageSize(page, book.paged));
  const width = Math.max(...sizes.map((size) => size.width));
  const height = Math.max(...sizes.map((size) => size.height));
  const block = { height, width: book.paged ? 2 * width + SPINE_GAP : width };
  return {
    block,
    board: {
      depth: Math.max(SMALLEST_BOARD.depth, block.height + 2 * BOARD_MARGIN),
      width: Math.max(SMALLEST_BOARD.width, block.width + 2 * BOARD_MARGIN),
    },
  };
}

/**
 * Where each page of a spread lies on the board, centred across it: an open
 * book's two pages either side of the spine, in reading order (right to left
 * for books that read that way), each fitted to its own proportions and set
 * against the spine. A lone page on the first spread is the front cover, a
 * recto; any other lone page is a verso. An image that isn't part of a paged
 * book lies alone in the middle. Pages lie at their real size where it's
 * known.
 *
 * @param {object} book - from useGalleryContents: `pages`, `spreads`, `paged`, `direction`
 * @returns {Array<{page, side: 'left'|'right'|'single', x, width, height}>}
 */
export function spreadLayout(book, spreadIndex) {
  const pages = (book.spreads[spreadIndex] || []).map((index) => book.pages[index]);
  if (!book.paged) return pages.map((page) => ({ ...pageSize(page, false), page, side: 'single', x: 0 }));

  const rightToLeft = isRightToLeft(book);
  const readingOrder = rightToLeft ? ['right', 'left'] : ['left', 'right'];
  const sides = pages.length === 2 ? readingOrder : [(spreadIndex === 0) !== rightToLeft ? 'right' : 'left'];

  return pages.map((page, index) => {
    const size = pageSize(page, true);
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

/**
 * How far over a leaf has turned (0 flat where it lay, 1 flat on the other
 * side) when its outer edge has been pulled `pulled` metres towards the
 * spine: the edge swings round the spine, so it's above the spine half way.
 * Pulling the other way leaves it where it lay.
 */
export function leafTurn(pulled, pageWidth) {
  const edge = Math.max(-1, Math.min(1, (pageWidth - Math.max(0, pulled)) / pageWidth));
  return Math.acos(edge) / Math.PI;
}
