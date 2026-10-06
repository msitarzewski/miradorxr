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
