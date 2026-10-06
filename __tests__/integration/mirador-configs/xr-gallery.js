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
    ],
    id: 'mirador',
    windows: [{ manifestId: NGA_HIGHLIGHTS }],
  },
  plugins: xrPlugins,
};
