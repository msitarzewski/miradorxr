/**
 * IIIF label and metadata values may contain HTML; the wall label is drawn
 * as plain text. DOMParser builds an inert document, so nothing in the
 * value runs or loads.
 */
export function plainText(value) {
  if (value == null) return '';
  const text = new DOMParser().parseFromString(String(value), 'text/html').body.textContent || '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Museum-style label lines for a work, from Mirador's selectors.
 *
 * @returns {Array<{style: 'title'|'body'|'small', text: string}>}
 */
export function wallLabelLines({
  canvasLabel = undefined,
  canvasMetadata = [],
  manifestTitle = undefined,
  provider = undefined,
  requiredStatement = [],
  rights = [],
}) {
  const lines = [];
  /** */
  const add = (style, text) => {
    const clean = plainText(text);
    if (clean) lines.push({ style, text: clean });
  };

  add('title', canvasLabel);
  (canvasMetadata || []).forEach(({ label, values }) => add('body', `${plainText(label)}: ${values.map(plainText).join(', ')}`));
  if (manifestTitle && manifestTitle !== canvasLabel) add('body', manifestTitle);
  add('body', provider);
  (requiredStatement || []).forEach(({ label, values }) =>
    add('small', [label && plainText(label), values.map(plainText).join(' ')].filter(Boolean).join(': ')),
  );
  (rights || []).forEach((right) => add('small', right));

  return lines;
}

/**
 * Label lines for a book on a lectern: its title, the pages it's open at,
 * where it's from, and an optional note (such as why it can't be shown).
 *
 * @param {string[]} options.pages - labels of the pages showing, in reading order
 */
export function bookLabelLines({ note = undefined, pages = [], provider = undefined, title = undefined }) {
  return [
    { style: 'title', text: plainText(title) },
    { style: 'body', text: pages.map(plainText).filter(Boolean).join(' – ') },
    { style: 'body', text: plainText(provider) },
    { style: 'small', text: plainText(note) },
  ].filter(({ text }) => text);
}

/** The name of an image layer (a IIIF Choice item), such as "X-Ray" */
export function layerLabel(resource, fallback = 'Layer') {
  const label = resource?.getLabel?.();
  const value = label && typeof label.getValue === 'function' ? label.getValue() : label;
  return plainText(typeof value === 'string' ? value : '') || fallback;
}

// Paragraphs shorter than this are taken to be stray markup rather than words
const MIN_PARAGRAPH = 4;

/**
 * Note-card lines for an annotation's text, which may be HTML: one body line
 * per paragraph or line break, dropping stray fragments (some annotations carry bits of
 * markup like a lone "ltr"), and cut short past `maxCharacters`. DOMParser
 * builds an inert document, so nothing in the value runs or loads.
 *
 * @returns {Array<{style: 'body', text: string}>}
 */
export function noteLines(html, maxCharacters = 700) {
  const { body } = new DOMParser().parseFromString(String(html ?? ''), 'text/html');
  body.querySelectorAll('script, style, template').forEach((element) => element.remove());
  // A line break within a paragraph starts a new line of the note
  body.querySelectorAll('br').forEach((element) => element.replaceWith('\n'));
  const blocks = [...body.querySelectorAll('p, li, h1, h2, h3, h4, div')].filter(
    (element) => !element.querySelector('p, li, h1, h2, h3, h4, div'),
  );
  const paragraphs = (blocks.length ? blocks.map((element) => element.textContent) : [body.textContent])
    .flatMap((text) => text.split('\n'))
    .map((text) => text.replace(/\s+/g, ' ').trim())
    .filter((text) => text.length >= MIN_PARAGRAPH);

  const lines = [];
  let budget = maxCharacters;
  paragraphs.forEach((text) => {
    if (budget <= 0) return;
    lines.push({ style: 'body', text: text.length > budget ? `${text.slice(0, budget).trimEnd()}…` : text });
    budget -= text.length;
  });
  return lines;
}

/**
 * Breaks text into lines no wider than maxWidth, as measured by measure(text).
 * A single word wider than maxWidth gets a line of its own.
 */
export function wrapText(text, maxWidth, measure) {
  const lines = [];
  let line = '';

  text.split(' ').forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });

  if (line) lines.push(line);
  return lines;
}
