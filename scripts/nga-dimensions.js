// Writes src/xr/data/ngaDimensions.json: the measured height and width of
// every National Gallery of Art work in the given IIIF manifests, from the
// NGA's open data (CC0), so the XR gallery can hang them at their real size.
// The full dimensions table is ~10 MB, too big to fetch in the browser.
//
//   node scripts/nga-dimensions.js [manifest-url ...]
//
// With no URLs, the NGA manifests in the XR gallery demo's catalogue.
import fs from 'fs';

const DIMENSIONS_CSV = 'https://github.com/NationalGalleryOfArt/opendata/raw/main/data/objects_dimensions.csv';
const DEFAULT_MANIFESTS = ['https://media.nga.gov/public/manifests/nga_highlights.json'];
const OUTPUT = 'src/xr/data/ngaDimensions.json';
// The measurement of the work itself, rather than its frame, mount or the like, by preference
const ELEMENTS = ['overall', 'painted surface', 'image', 'sheet', 'support'];
const OBJECT_ID = /\/objects\/(?:\d\/)+(\d+)-/;

const { log } = console;

/** Every NGA object id behind a manifest's images */
async function objectIds(manifestUrl) {
  const manifest = await (await fetch(manifestUrl)).json();
  const services = JSON.stringify(manifest).match(/https:\/\/media\.nga\.gov\/iiif\/[^"]+/g) || [];
  return services.map((service) => service.match(OBJECT_ID)?.[1]).filter(Boolean);
}

/** The rows of a simple CSV with a header row and no quoted commas */
function parseCsv(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const columns = header.split(',');
  return lines.map((line) => Object.fromEntries(line.split(',').map((value, index) => [columns[index], value])));
}

const manifests = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_MANIFESTS;
const wanted = new Set((await Promise.all(manifests.map(objectIds))).flat());
log(`${wanted.size} NGA objects in ${manifests.length} manifest(s)`);

const rows = parseCsv(await (await fetch(DIMENSIONS_CSV)).text()).filter(
  (row) => wanted.has(row.objectid) && row.unitname === 'centimeters',
);

const objects = {};
[...wanted]
  .sort((a, b) => Number(a) - Number(b))
  .forEach((id) => {
    const measured = rows.filter((row) => row.objectid === id);
    const element = ELEMENTS.find((name) => measured.some((row) => row.element === name));
    const value = (type) => Number(measured.find((row) => row.element === element && row.dimensiontype === type)?.dimension);
    if (element && value('height') > 0 && value('width') > 0) {
      objects[id] = { element, height: Math.round(value('height') * 100) / 100, width: Math.round(value('width') * 100) / 100 };
    }
  });

const missing = [...wanted].filter((id) => !objects[id]);
fs.writeFileSync(
  OUTPUT,
  `${JSON.stringify(
    {
      license: 'CC0-1.0',
      objects,
      source: 'National Gallery of Art open data, https://github.com/NationalGalleryOfArt/opendata (objects_dimensions.csv)',
      units: 'cm',
    },
    null,
    2,
  )}\n`,
);
log(
  `Wrote ${Object.keys(objects).length} works to ${OUTPUT}${missing.length ? `; no dimensions for ${missing.join(', ')}` : ''}`,
);
