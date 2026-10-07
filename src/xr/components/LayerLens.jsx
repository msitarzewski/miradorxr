import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useFrame } from '@react-three/fiber';
import { Matrix4, Ray, Vector3 } from 'three';
import { getIiifResourceImageService } from '../../lib/iiif';
import { fetchInfoResponse } from '../../state/actions';
import { selectInfoResponses } from '../../state/selectors';
import { onWorkPlane } from '../lib/rakingLight';
import { TileCache } from '../lib/TileCache';
import { layerLabel } from '../lib/wallLabel';
import { DeepZoomImage } from './DeepZoomImage';

// Just in front of the work's own tiles
const LIFT = 0.0015;
const RING_WIDTH = 0.005;
const noRaycast = () => {};
// Metres across the lens
const LENS_RADIUS = 0.11;
const toLocal = new Matrix4();
const localRay = new Ray();

/** The next layer the lens shows: each in turn, then none */
const nextLayer = (layer, count) => {
  if (layer === null) return 0;
  return layer + 1 < count ? layer + 1 : null;
};

/**
 * The layer lens for a work with other layers: which one it shows (none
 * until you choose), where it sits on the image, the pointer handlers that
 * move it while it's out (pinch the image and drag), and the tool that
 * steps through the layers. The lens goes away when you leave the work.
 *
 * @param {object} image - ref to the group the image is centred in
 * @param {{width, height}} shown - the image's size there, in metres
 * @returns {{handlers, layer, lens, on, region, tool}} `tool` is null without other layers
 */
export function useLayerLens({ active, image, layers, shown }) {
  const [index, setIndex] = useState(null);
  const lens = useMemo(() => ({ centre: { value: new Vector3() }, radius: { value: LENS_RADIUS } }), []);
  const region = useRef({ radius: LENS_RADIUS, x: 0, y: 0 });
  const drag = useRef(null);
  const on = active && index !== null;

  useEffect(() => {
    if (!active) setIndex(null);
  }, [active]);

  /** Puts the lens where the pinch's ray meets the image, kept on it */
  const move = (event) => {
    image.current.updateWorldMatrix(true, false);
    localRay.copy(event.ray).applyMatrix4(toLocal.copy(image.current.matrixWorld).invert());
    const point = onWorkPlane(localRay);
    if (!point) return;
    region.current.x = Math.max(-shown.width / 2, Math.min(shown.width / 2, point.x));
    region.current.y = Math.max(-shown.height / 2, Math.min(shown.height / 2, point.y));
  };

  const handlers = on
    ? {
        /** */
        onPointerDown: (event) => {
          event.stopPropagation();
          event.object.setPointerCapture(event.pointerId);
          drag.current = event.pointerId;
          move(event);
        },
        /** */
        onPointerMove: (event) => {
          if (drag.current !== event.pointerId) return;
          event.stopPropagation();
          move(event);
        },
        /** */
        onPointerUp: (event) => {
          if (drag.current !== event.pointerId) return;
          event.object.releasePointerCapture(event.pointerId);
          drag.current = null;
        },
      }
    : {};

  const tool =
    layers.length > 0
      ? {
          active: on,
          key: 'lens',
          onClick: () => setIndex((layer) => nextLayer(layer, layers.length)),
          text: on ? `Lens: ${layerLabel(layers[index])}` : 'Lens: Off',
        }
      : null;

  return { handlers, layer: on ? layers[index] : null, lens, on, region, tool };
}

/**
 * Another layer of a work (an X-ray, infrared, a different light) seen
 * through a round lens over it: that layer's tiles, drawn only within the
 * lens and fetched only where it is, with a ring marking its edge. Drawn
 * in the work's image space; `region` (a ref to `{ x, y, radius }` there)
 * says where the lens is, and `lens` carries the same to the shader in
 * world space.
 */
export function LayerLens({ boxHeight, boxWidth, cache, layer, lens, paint, region, windowId = undefined }) {
  const dispatch = useDispatch();
  const ring = useRef();
  const infoId = getIiifResourceImageService(layer)?.id;
  const entry = useSelector((state) => infoId && selectInfoResponses(state)[infoId]);
  const infoJson = entry && !entry.isFetching ? entry.json : undefined;

  useEffect(() => {
    if (infoId && !entry) dispatch(fetchInfoResponse({ imageResource: layer, windowId }));
  }, [dispatch, entry, infoId, layer, windowId]);

  // Keep the shader's lens on the region, wherever the work is in the world
  useFrame(() => {
    const parent = ring.current?.parent;
    if (!parent) return;
    const { radius, x, y } = region.current;
    ring.current.position.set(x, y, LIFT * 2);
    parent.updateWorldMatrix(true, false);
    lens.centre.value.set(x, y, 0).applyMatrix4(parent.matrixWorld);
    Object.assign(lens.radius, { value: radius });
  });

  return (
    <>
      {infoJson && (
        <DeepZoomImage
          boxHeight={boxHeight}
          boxWidth={boxWidth}
          cache={cache}
          infoJson={infoJson}
          lens={lens}
          paint={paint}
          position-z={LIFT}
          region={region}
        />
      )}
      <mesh ref={ring} raycast={noRaycast}>
        <ringGeometry args={[region.current.radius - RING_WIDTH, region.current.radius, 64]} />
        <meshBasicMaterial color="#ffffff" depthWrite={false} opacity={0.85} toneMapped={false} transparent />
      </mesh>
    </>
  );
}

LayerLens.propTypes = {
  boxHeight: PropTypes.number.isRequired,
  boxWidth: PropTypes.number.isRequired,
  cache: PropTypes.instanceOf(TileCache).isRequired,
  layer: PropTypes.object.isRequired,
  lens: PropTypes.objectOf(PropTypes.shape({ value: PropTypes.any })).isRequired,
  paint: PropTypes.objectOf(PropTypes.shape({ value: PropTypes.any })).isRequired,
  region: PropTypes.shape({ current: PropTypes.object }).isRequired,
  windowId: PropTypes.string,
};
