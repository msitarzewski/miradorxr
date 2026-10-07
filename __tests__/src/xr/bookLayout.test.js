import { fitBox, leafSide, PAGE, spreadLayout, turnFromPinch } from '../../../src/xr/lib/bookLayout';

const page = (label, aspect = 0.7) => ({ aspect, label });
const book = (overrides = {}) => ({
  direction: 'left-to-right',
  pages: [page('Cover'), page('f. 1v'), page('f. 2r'), page('f. 2v')],
  paged: true,
  spreads: [[0], [1, 2], [3]],
  ...overrides,
});

describe('fitBox', () => {
  it('fits by height or by width, keeping the proportions', () => {
    expect(fitBox(0.5, { height: 1, width: 1 })).toEqual({ height: 1, width: 0.5 });
    expect(fitBox(2, { height: 1, width: 1 })).toEqual({ height: 0.5, width: 1 });
  });
});

describe('spreadLayout', () => {
  it('opens a book with the cover alone on the right, as a recto', () => {
    const [cover] = spreadLayout(book(), 0);
    expect(cover.side).toEqual('right');
    expect(cover.x).toBeGreaterThan(0);
  });

  it('lays a spread either side of the spine, in reading order, against the spine', () => {
    const [left, right] = spreadLayout(book(), 1);
    expect([left.page.label, left.side, right.page.label, right.side]).toEqual(['f. 1v', 'left', 'f. 2r', 'right']);
    expect(left.height).toBeCloseTo(PAGE.height);
    expect(right.x - right.width / 2).toBeCloseTo(-(left.x + left.width / 2));
    expect(right.x - right.width / 2).toBeGreaterThan(0);
  });

  it('puts a lone page after the first spread on the left, as a verso', () => {
    expect(spreadLayout(book(), 2)[0].side).toEqual('left');
  });

  it('mirrors all of that for a book read right to left', () => {
    const rtl = book({ direction: 'right-to-left' });
    expect(spreadLayout(rtl, 0)[0].side).toEqual('left');
    expect(spreadLayout(rtl, 1).map(({ side }) => side)).toEqual(['right', 'left']);
  });

  it('shows images that are not part of a paged book one at a time, in the middle', () => {
    const [single] = spreadLayout(book({ paged: false, spreads: [[0], [1]] }), 1);
    expect(single).toMatchObject({ side: 'single', x: 0 });
    expect(single.height).toBeCloseTo(0.56);
  });
});

describe('page turning', () => {
  it('reads on from the right-hand side, and back from the left', () => {
    expect(turnFromPinch(book(), 0.2)).toEqual(1);
    expect(turnFromPinch(book(), -0.2)).toEqual(-1);
    expect(leafSide(book(), 1)).toEqual('right');
    expect(leafSide(book(), -1)).toEqual('left');
  });

  it('reads on from the left in a right-to-left book', () => {
    const rtl = book({ direction: 'right-to-left' });
    expect(turnFromPinch(rtl, -0.2)).toEqual(1);
    expect(leafSide(rtl, 1)).toEqual('left');
  });
});
