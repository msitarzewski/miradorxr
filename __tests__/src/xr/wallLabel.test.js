import { bookLabelLines, layerLabel, noteLines, plainText, wallLabelLines, wrapText } from '../../../src/xr/lib/wallLabel';

describe('plainText', () => {
  it('drops markup and collapses whitespace', () => {
    expect(plainText('<b>Oil</b> on\n  <i>canvas</i>')).toEqual('Oil on canvas');
  });

  it('keeps the text of links and drops scripts and images', () => {
    expect(plainText('<a href="https://www.nga.gov">NGA</a><img src="x" onerror="alert(1)">')).toEqual('NGA');
  });

  it('treats missing values as empty', () => {
    expect(plainText(undefined)).toEqual('');
  });
});

describe('wallLabelLines', () => {
  it('builds a museum label from IIIF fields', () => {
    expect(
      wallLabelLines({
        canvasLabel: 'Flower Beds in Holland',
        canvasMetadata: [{ label: 'Date', values: ['1883'] }],
        manifestTitle: 'National Gallery of Art Collection Highlights',
        requiredStatement: [{ label: 'Attribution', values: ['Courtesy National Gallery of Art'] }],
        rights: ['https://creativecommons.org/publicdomain/zero/1.0/'],
      }),
    ).toEqual([
      { style: 'title', text: 'Flower Beds in Holland' },
      { style: 'body', text: 'Date: 1883' },
      { style: 'body', text: 'National Gallery of Art Collection Highlights' },
      { style: 'small', text: 'Attribution: Courtesy National Gallery of Art' },
      { style: 'small', text: 'https://creativecommons.org/publicdomain/zero/1.0/' },
    ]);
  });

  it('skips empty fields and a manifest title that repeats the canvas label', () => {
    expect(wallLabelLines({ canvasLabel: 'Self-Portrait', manifestTitle: 'Self-Portrait', provider: '' })).toEqual([
      { style: 'title', text: 'Self-Portrait' },
    ]);
  });
});

describe('wrapText', () => {
  const measure = (text) => text.length;

  it('breaks between words to fit the width', () => {
    expect(wrapText('a museum wall label', 9, measure)).toEqual(['a museum', 'wall', 'label']);
  });

  it('gives an over-long word its own line', () => {
    expect(wrapText('see https://example.org/long', 9, measure)).toEqual(['see', 'https://example.org/long']);
  });
});

describe('bookLabelLines', () => {
  it('labels a book with its title, the open pages and where it is from', () => {
    expect(
      bookLabelLines({ pages: ['f. 12v', '<i>f. 13r</i>'], provider: 'Bodleian Libraries', title: 'Book of Hours' }),
    ).toEqual([
      { style: 'title', text: 'Book of Hours' },
      { style: 'body', text: 'f. 12v – f. 13r' },
      { style: 'body', text: 'Bodleian Libraries' },
    ]);
  });

  it('adds a note, and skips what it does not have', () => {
    expect(bookLabelLines({ note: "Can't be shown here", title: 'Fragments' })).toEqual([
      { style: 'title', text: 'Fragments' },
      { style: 'small', text: "Can't be shown here" },
    ]);
  });
});

describe('noteLines', () => {
  it('gives each paragraph and line break of an annotation a line of its own', () => {
    expect(noteLines('<p><strong>English</strong><br/>In the name of God.</p><p>Second paragraph</p>')).toEqual([
      { style: 'body', text: 'English' },
      { style: 'body', text: 'In the name of God.' },
      { style: 'body', text: 'Second paragraph' },
    ]);
  });

  it('drops stray fragments of markup, as in some Bodleian annotations', () => {
    const chars = '<p dir="ltr>ltr</p> <p dir="rtl>rtl</p> <p dir="ltr"><strong>English</strong> You have asked me</p>';
    expect(noteLines(chars).map(({ text }) => text)).toEqual(['English You have asked me']);
    expect(noteLines('<p><strong>English</strong><br/>Amongst the property</p>').map(({ text }) => text)).toEqual([
      'English',
      'Amongst the property',
    ]);
  });

  it('takes plain text as one paragraph and cuts long notes short', () => {
    expect(noteLines('A short note')).toEqual([{ style: 'body', text: 'A short note' }]);
    const [line] = noteLines('word '.repeat(200), 20);
    expect(line.text).toEqual('word word word word…');
  });

  it('keeps scripts and images inert', () => {
    expect(noteLines('<p>Safe<img src="x" onerror="alert(1)"><script>alert(2)</script></p>')).toEqual([
      { style: 'body', text: 'Safe' },
    ]);
  });
});

describe('layerLabel', () => {
  it("names a layer from its label's value, or falls back", () => {
    expect(layerLabel({ getLabel: () => ({ getValue: () => 'X-Ray' }) })).toEqual('X-Ray');
    expect(layerLabel({ getLabel: () => null })).toEqual('Layer');
    expect(layerLabel(undefined, 'Infrared')).toEqual('Infrared');
  });
});
