import xrPlugins from '../../../src/xr';

const NGA_HIGHLIGHTS = 'https://media.nga.gov/public/manifests/nga_highlights.json';

export default {
  config: {
    catalog: [
      { manifestId: NGA_HIGHLIGHTS, provider: 'National Gallery of Art' },
      {
        manifestId: 'https://dms-data.stanford.edu/data/manifests/Parker/nb647fd0133/manifest.json',
        provider: 'Stanford University Libraries',
      },
      {
        manifestId: 'https://iiif.bodleian.ox.ac.uk/iiif/manifest/e32a277e-91e2-4a6d-8ba6-cc4bad230410.json',
        provider: 'Bodleian Libraries',
      },
      {
        manifestId: 'https://gallica.bnf.fr/iiif/ark:/12148/btv1b10022508f/manifest.json',
        provider: 'Bibliothèque nationale de France',
      },
      {
        manifestId: 'https://www.e-codices.unifr.ch/metadata/iiif/gau-Fragment/manifest.json',
        provider: 'e-codices - Virtual Manuscript Library of Switzerland',
      },
      { manifestId: 'https://wellcomelibrary.org/iiif/collection/b18031511', provider: 'Wellcome Library' },
      // Natural light and X-ray of the same painting, as a IIIF Choice: the XR layer lens
      { manifestId: 'https://iiif.io/api/cookbook/recipe/0033-choice/manifest.json', provider: 'IIIF Cookbook' },
      // A paged manuscript with annotations on most of its pages
      {
        manifestId: 'https://iiif.bodleian.ox.ac.uk/iiif/manifest/748a9d50-5a3a-440e-ab9d-567dd68b6abb.json',
        provider: 'Bodleian Libraries',
      },
    ],
    id: 'mirador',
    windows: [{ manifestId: NGA_HIGHLIGHTS }],
  },
  plugins: xrPlugins,
};
