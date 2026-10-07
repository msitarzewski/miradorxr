import ngaDimensions from '../data/ngaDimensions.json';
import { plainText } from './wallLabel';

// An NGA image service id carries the work's object id: .../objects/1/0/6/3/8/2/106382-primary-0-...
const NGA_OBJECT = /media\.nga\.gov\/iiif\/.*\/objects\/(?:\d\/)+(\d+)-/;

/**
 * Measured dimensions the institution publishes for the work behind an
 * image service, where we have them: so far the National Gallery of Art's
 * open data, extracted by scripts/nga-dimensions.js.
 *
 * @returns {{height, width, units}|null} height and width in metres
 */
export function measuredDimensions(serviceId) {
  const work = ngaDimensions.objects[String(serviceId ?? '').match(NGA_OBJECT)?.[1]];
  return work ? { height: work.height / 100, units: ngaDimensions.units, width: work.width / 100 } : null;
}

/** Whether a service is a IIIF Physical Dimensions service */
const isPhysdim = (service) =>
  String(service?.profile ?? '').includes('physdim') || [service?.type, service?.['@type']].includes('PhysicalDimensions');

/**
 * A IIIF Physical Dimensions service on a canvas or on its image service:
 * its scale, physical units per canvas pixel.
 *
 * @returns {{scale, units}|null}
 */
export function physdimService(...owners) {
  const service = owners
    .flatMap((owner) => [owner?.service].flat())
    .filter(Boolean)
    .find(isPhysdim);
  return service?.physicalScale > 0 ? { scale: Number(service.physicalScale), units: service.physicalUnits } : null;
}

/** Metadata entries (as Mirador destructures them) as plain-text statements, label first */
export function dimensionStatements(metadata = []) {
  return (metadata || []).map(({ label, values = [] }) => plainText([label, ...values].filter(Boolean).join(': ')));
}

/**
 * Everything known about how big an image's subject is, for physicalSize:
 * a Physical Dimensions service, the institution's measurements, and the
 * statements in the canvas's metadata and then the manifest's.
 *
 * @param {object} canvas - a manifesto canvas
 * @param {object} imageService - the image's IIIF service, as Mirador finds it
 */
export function sizeEvidence({ canvas, canvasMetadata, imageService, manifestMetadata }) {
  const physdim = physdimService(canvas?.__jsonld, imageService?.__jsonld);
  return {
    measured: measuredDimensions(imageService?.id),
    physdim: physdim && { ...physdim, canvasHeight: canvas.getHeight(), canvasWidth: canvas.getWidth() },
    statements: [...dimensionStatements(canvasMetadata), ...dimensionStatements(manifestMetadata)],
  };
}
