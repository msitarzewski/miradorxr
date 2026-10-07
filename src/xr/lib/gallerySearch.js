import { plainText } from './wallLabel';

// Characters of context either side of a match, on its result card
const CONTEXT = 48;

/** Where each canvas is among the books: its book, page and spread */
function canvasIndex(books) {
  const where = new Map();
  books.forEach(({ pages, spreads }, book) =>
    spreads.forEach((indices, spread) => indices.forEach((page) => where.set(pages[page].canvasId, { book, page, spread }))),
  );
  return where;
}

/** A hit's text in context, trimmed to a few words either side of the match */
function snippet({ after = '', before = '', match = '' }) {
  const lead = plainText(before);
  const tail = plainText(after);
  return [
    lead.length > CONTEXT ? `…${lead.slice(-CONTEXT)}` : lead,
    `“${plainText(match)}”`,
    tail.length > CONTEXT ? `${tail.slice(0, CONTEXT)}…` : tail,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Search hits across the gallery's books, from IIIF Content Search
 * responses (as kept in Mirador's state) and their annotations: one per hit
 * on a page of a book in the gallery, in book and page order, with its
 * region on the page (fractions of the canvas, from its top left), the
 * spread to open, and a label and snippet for its result card. A response
 * without `hits` gives one per annotation, its text as the snippet.
 *
 * @param {Array} responses - Mirador search data entries: `{ isFetching, json }`
 * @param {Array} annotations - search annotation resources, with targetId and fragmentSelector
 */
export function searchHits(books, responses, annotations) {
  const where = canvasIndex(books);
  const byId = new Map(annotations.map((annotation) => [annotation.id, annotation]));
  const found = responses.flatMap(({ isFetching, json }) => {
    if (isFetching || !json) return [];
    if (json.hits?.length) {
      return json.hits.map((hit) => ({ annotation: byId.get(hit.annotations?.[0]), text: snippet(hit) }));
    }
    return (json.resources || []).map(({ '@id': id }) => {
      const annotation = byId.get(id);
      return { annotation, text: plainText(annotation?.chars) };
    });
  });

  return found
    .flatMap(({ annotation, text }) => {
      const place = annotation && where.get(annotation.targetId);
      if (!place) return [];
      const { book, page, spread } = place;
      const { canvasId, label } = books[book].pages[page];
      return [
        {
          book,
          canvasId,
          id: annotation.id,
          label: [plainText(books[book].title), plainText(label)].filter(Boolean).join(' — '),
          page,
          region: regionOf(annotation.fragmentSelector, books[book].pages[page]),
          spread,
          text,
        },
      ];
    })
    .sort((a, b) => a.book - b.book || a.page - b.page);
}

/** A hit's xywh region as fractions of its canvas, if the canvas size is known */
function regionOf(xywh, { canvasHeight, canvasWidth }) {
  if (!xywh || xywh.length < 4 || !(canvasWidth > 0 && canvasHeight > 0)) return null;
  const [x, y, w, h] = xywh;
  return { h: h / canvasHeight, w: w / canvasWidth, x: x / canvasWidth, y: y / canvasHeight };
}
