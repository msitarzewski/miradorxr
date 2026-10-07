// Metres per unit, as units appear in dimension statements
const UNITS = { cm: 0.01, in: 0.0254, inch: 0.0254, inches: 0.0254, m: 1, mm: 0.001 };
// How far a statement's proportions may stray from the image's and still be taken to describe it
const ASPECT_TOLERANCE = 1.3;
// Without a recorded size, works hang this tall
export const DEFAULT_HEIGHT = 1;

// A number, with an optional fraction: 41, 32.5, 32,5, 16 1/8, 13/16
const NUMBER = String.raw`\d+(?:[.,]\d+)?(?:\s+\d+\s*\/\s*\d+)?|\d+\s*\/\s*\d+`;
const UNIT = String.raw`(mm|cm|m|in(?:ch(?:es)?)?\.?)(?![a-z])`;
const BY = String.raw`\s*(?:x|×|by)\s*`;
const PAIR = new RegExp(String.raw`(${NUMBER})${BY}(${NUMBER})(?:${BY}(?:${NUMBER}))?\s*${UNIT}`, 'gi');
const SINGLE = new RegExp(String.raw`(${NUMBER})\s*${UNIT}`, 'gi');
// Measurements of something other than the whole object: its text, frame, mount or box
const NOT_THE_OBJECT =
  /\b(written|text\s*(?:area|block)|ruled|frame[ds]?|mount(?:ed)?|mat|box|binding|case|plate\s*mark)(?:\W+\w+){0,2}\W*$/i;

/** A number as written, fractions included: "16 1/8" is 16.125 */
function readNumber(text) {
  const [whole, fraction] = text.replace(',', '.').split(/\s+(?=\d+\s*\/)/);
  const value = whole.includes('/') ? 0 : Number(whole);
  const part = (fraction ?? (whole.includes('/') ? whole : '')).split('/').map(Number);
  return value + (part.length === 2 && part[1] ? part[0] / part[1] : 0);
}

const unitOf = (text) => UNITS[text.toLowerCase().replace(/\.$/, '')];

/** Whether the words just before a measurement say it's of something other than the object */
const aboutSomethingElse = (statement, index) => NOT_THE_OBJECT.test(statement.slice(Math.max(0, index - 30), index));

/**
 * The measurements in a dimension statement, in order: pairs such as
 * "445 x 280 mm" or "16 1/8 x 12 13/16 in." (a third, depth, is ignored),
 * then single lengths such as the "26 cm" of a library record, which give a
 * book's height. Measurements of a frame, mount, written area and the like
 * are left out.
 *
 * @returns {Array<{first, second, text}>} lengths in metres; `second` is null for a single length
 */
export function parseDimensions(statement) {
  const text = String(statement ?? '');
  const allPairs = [...text.matchAll(PAIR)];
  const pairs = allPairs
    .filter((match) => !aboutSomethingElse(text, match.index))
    .map((match) => ({
      first: readNumber(match[1]) * unitOf(match[3]),
      second: readNumber(match[2]) * unitOf(match[3]),
      text: match[0].trim(),
    }));
  // A single length mustn't be a number from a pair, even one that was left out
  const insidePair = (index) => allPairs.some((pair) => index >= pair.index && index < pair.index + pair[0].length);
  const singles = [...text.matchAll(SINGLE)]
    .filter((match) => !insidePair(match.index) && !aboutSomethingElse(text, match.index))
    .map((match) => ({ first: readNumber(match[1]) * unitOf(match[2]), second: null, text: match[0].trim() }));

  return [...pairs, ...singles]
    .filter(({ first, second }) => first > 0 && (second === null || second > 0))
    .map(({ first, second, text: written }) => ({ first, second, text: written }));
}

/** How far apart two proportions are, as a ratio of at least 1 */
const mismatch = (a, b) => Math.max(a, b) / Math.min(a, b);

/**
 * A work's height and width in metres, and how it was found, from whatever
 * evidence there is, best first:
 * 1. A IIIF Physical Dimensions service: physical units per canvas pixel.
 * 2. Measured dimensions from the institution's own data.
 * 3. Dimension statements from the manifest's metadata. A pair is read
 *    height by width, as museums write them, or the other way round if
 *    that matches the image's proportions; a single length is a height.
 *    A statement whose proportions don't fit the image is passed over.
 * 4. Otherwise DEFAULT_HEIGHT, marked approximate.
 *
 * The image always keeps its own proportions: the height comes from the
 * evidence, and the width from the image.
 *
 * @param {object} evidence - `{ physdim, measured, statements }`, any of them missing
 * @param {number} aspect - the image's width over its height
 * @returns {{height, width, approximate, source, label}} `label` gives the size as recorded, for a wall label
 */
export function physicalSize({ measured = null, physdim = null, statements = [] } = {}, aspect = 1) {
  const sized = (height, source, label) => ({ approximate: false, height, label, source, width: height * aspect });

  const metresPerPixel = physdim && unitOf(physdim.units) * physdim.scale;
  if (metresPerPixel > 0 && physdim.canvasHeight > 0) {
    const height = physdim.canvasHeight * metresPerPixel;
    return sized(height, 'physdim', describe(height, physdim.canvasWidth * metresPerPixel, physdim.units));
  }

  if (measured?.height > 0) {
    return sized(measured.height, 'measured', describe(measured.height, measured.width, measured.units ?? 'cm'));
  }

  const candidates = statements.flatMap((statement) => parseDimensions(statement));
  const pair = candidates
    .filter(({ second }) => second !== null)
    .flatMap(({ first, second, text }) => [
      { height: first, mismatch: mismatch(second / first, aspect), text },
      { height: second, mismatch: mismatch(first / second, aspect), text },
    ])
    .filter((reading) => reading.mismatch <= ASPECT_TOLERANCE)
    // In statement order; the closest fit decides between a pair's two readings
    .reduce(
      (best, reading) => (!best || (reading.text === best.text && reading.mismatch < best.mismatch) ? reading : best),
      null,
    );
  if (pair) return sized(pair.height, 'metadata', pair.text);

  const single = candidates.find(({ second }) => second === null);
  if (single) return sized(single.first, 'metadata', `${single.text} tall`);

  return { approximate: true, height: DEFAULT_HEIGHT, label: null, source: null, width: DEFAULT_HEIGHT * aspect };
}

/** A recorded height and width, in the units they were recorded in */
function describe(height, width, units = 'cm') {
  const unit = units.toLowerCase().startsWith('in') ? 'in' : units.toLowerCase();
  const scale = UNITS[unit] ?? UNITS.cm;
  const shown = (metres) => {
    const value = metres / scale;
    return unit === 'mm' ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
  };
  return width > 0 ? `${shown(height)} × ${shown(width)} ${unit}` : `${shown(height)} ${unit} tall`;
}

/**
 * The line a wall label gives a work's size: as recorded, or, when it isn't
 * known, how big it's shown instead.
 */
export function sizeLine({ approximate, height, label }) {
  if (approximate) return `Size not recorded · shown ${Math.round(height * 100)} cm tall`;
  return `${label} · shown at actual size`;
}
