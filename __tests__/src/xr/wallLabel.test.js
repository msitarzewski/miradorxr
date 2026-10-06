import { plainText, wallLabelLines, wrapText } from '../../../src/xr/lib/wallLabel';

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
