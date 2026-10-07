import { searchHits } from '../../../src/xr/lib/gallerySearch';

const pageOf = (canvasId, label) => ({ canvasHeight: 1000, canvasId, canvasWidth: 800, label });
const books = [
  { pages: [pageOf('a1', 'p. 1')], spreads: [[0]], title: 'Atlas' },
  {
    pages: [pageOf('b1', 'Cover'), pageOf('b2', 'p. 2'), pageOf('b3', 'p. 3')],
    spreads: [[0], [1, 2]],
    title: 'Biology',
  },
];
const annotation = (id, targetId, xywh, chars = '') => ({ chars, fragmentSelector: xywh, id, targetId });

describe('searchHits', () => {
  const annotations = [
    annotation('h1', 'b3', [80, 100, 160, 50]),
    annotation('h2', 'b2', [0, 0, 400, 500]),
    annotation('h3', 'elsewhere', [0, 0, 1, 1]),
  ];
  const responses = [
    {
      isFetching: false,
      json: {
        hits: [
          { after: ' beats', annotations: ['h1'], before: 'the', match: 'heart' },
          { after: '', annotations: ['h2'], before: '', match: 'heart' },
          { annotations: ['h3'], match: 'heart' },
        ],
      },
    },
  ];

  it('places each hit on its book, page and spread, in reading order', () => {
    expect(searchHits(books, responses, annotations).map(({ book, id, page, spread }) => [id, book, page, spread])).toEqual([
      ['h2', 1, 1, 1],
      ['h1', 1, 2, 1],
    ]);
  });

  it('gives each a region on its page, a label and the match in context', () => {
    const [, hit] = searchHits(books, responses, annotations);
    expect(hit.region).toEqual({ h: 0.05, w: 0.2, x: 0.1, y: 0.1 });
    expect(hit.label).toEqual('Biology — p. 3');
    expect(hit.text).toEqual('the “heart” beats');
  });

  it('falls back to the annotations when a response has no hits, and skips searches still running', () => {
    const plain = [{ isFetching: false, json: { resources: [{ '@id': 'h1' }] } }, { isFetching: true }];
    const [hit] = searchHits(books, plain, [annotation('h1', 'a1', [0, 0, 8, 10], 'mountains')]);
    expect(hit).toMatchObject({ book: 0, label: 'Atlas — p. 1', text: 'mountains' });
  });
});
