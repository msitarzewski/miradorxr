import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useFrame, useThree } from '@react-three/fiber';
import { XROrigin } from '@react-three/xr';
import { fetchInfoResponse } from '../../state/actions';
import { getCurrentCanvas, selectInfoResponse } from '../../state/selectors';
import { useGalleryNavigation } from '../hooks/useGalleryNavigation';
import { useGalleryWorks } from '../hooks/useGalleryWorks';
import { useViewportHandoff } from '../hooks/useViewportHandoff';
import { layoutGallery } from '../lib/galleryLayout';
import { createTileLoader } from '../lib/loadTileTexture';
import { createPaintUniforms } from '../lib/paintRelief';
import { TileCache } from '../lib/TileCache';
import { FadeCurtain } from './FadeCurtain';
import { FloorTeleport } from './FloorTeleport';
import { GalleryPainting } from './GalleryPainting';
import { GalleryRoom } from './GalleryRoom';
import { XRStatsPanel } from './XRStatsPanel';

// Until the headset reports eye height
const DEFAULT_EYE_HEIGHT = 1.2;
// Stop waiting for slow or failing info.json responses and hang the rest by the manifest
const INFO_TIMEOUT_MS = 8000;
const STATS_POSITION = [-0.7, 0.9, -1];
// Per-frame easing of the paint relief and gloss as they come and go
const PAINT_EASING = 0.08;

/** The hung room, with navigation around it */
function HungGallery({ infoResponses, layout, works, windowId }) {
  const gl = useThree((state) => state.gl);
  const startCanvasId = useSelector((state) => getCurrentCanvas(state, { windowId })?.id);
  const { placements, room } = layout;
  const cache = useMemo(
    () => new TileCache({ load: createTileLoader({ anisotropy: gl.capabilities.getMaxAnisotropy() }) }),
    [gl],
  );
  const origin = useRef();
  const curtain = useRef();
  const activeGroup = useRef();
  const statsRef = useRef({});
  const paint = useMemo(createPaintUniforms, []);
  const [paintOn, setPaintOn] = useState(false);
  const [glossOn, setGlossOn] = useState(false);

  const { activeIndex, eyeHeight, headInWorld, select, step, teleportTo, turn } = useGalleryNavigation({
    curtain,
    origin,
    placements,
    startIndex: Math.max(
      0,
      works.findIndex(({ canvasId }) => canvasId === startCanvasId),
    ),
  });

  useEffect(() => () => cache.dispose(), [cache]);
  useFrame(() => {
    paint.amount.value += ((paintOn ? 1 : 0) - paint.amount.value) * PAINT_EASING;
    paint.glossAmount.value += ((glossOn ? 1 : 0) - paint.glossAmount.value) * PAINT_EASING;
  });

  useViewportHandoff({
    canvasId: works[activeIndex].canvasId,
    height: placements[activeIndex].height,
    imageGroup: activeGroup,
    infoId: infoResponses[activeIndex]?.id,
    width: placements[activeIndex].width,
    windowId,
  });

  return (
    <>
      <GalleryRoom depth={room.depth} onTurn={turn} width={room.width} />
      <FloorTeleport depth={room.depth} headInWorld={headInWorld} onTeleport={teleportTo} width={room.width} />
      {works.map((work, index) => (
        <GalleryPainting
          key={work.canvasId}
          ref={index === activeIndex ? activeGroup : undefined}
          active={index === activeIndex}
          cache={cache}
          canvasId={work.canvasId}
          centreHeight={eyeHeight ?? DEFAULT_EYE_HEIGHT}
          glossOn={glossOn}
          infoJson={infoResponses[index]?.json}
          onGloss={() => setGlossOn((on) => !on)}
          onNext={() => step(1)}
          onPaint={() => setPaintOn((on) => !on)}
          onPrevious={() => step(-1)}
          onSelect={() => select(index)}
          paint={paint}
          paintOn={paintOn}
          preview={work.preview}
          statsRef={statsRef}
          windowId={windowId}
          {...placements[index]}
        />
      ))}
      <XROrigin ref={origin}>
        <XRStatsPanel position={STATS_POSITION} rotation-y={0.6} statsRef={statsRef} />
      </XROrigin>
      <FadeCurtain ref={curtain} />
    </>
  );
}

HungGallery.propTypes = {
  infoResponses: PropTypes.arrayOf(PropTypes.object).isRequired,
  layout: PropTypes.shape({ placements: PropTypes.array, room: PropTypes.object }).isRequired,
  works: PropTypes.arrayOf(PropTypes.object).isRequired,
  windowId: PropTypes.string.isRequired,
};

/**
 * Fetches every work's info.json through Mirador's saga (so IIIF auth
 * applies), then hangs the room from the images' own proportions. Manifest
 * canvas and resource sizes can be wrong, so they're only the fallback for
 * an info.json that fails or doesn't arrive in time. The layout is fixed
 * once hung, so nothing moves while you're in the room.
 */
function Gallery({ works, windowId }) {
  const dispatch = useDispatch();
  const requested = useRef(new Set());
  const infoResponses = useSelector(
    (state) => works.map(({ canvasId }) => selectInfoResponse(state, { canvasId, windowId })),
    shallowEqual,
  );
  const [timedOut, setTimedOut] = useState(false);
  const [layout, setLayout] = useState(null);
  const waitingStats = useRef({});

  useEffect(() => {
    works.forEach(({ canvasId, imageResource }, index) => {
      if (infoResponses[index] || requested.current.has(canvasId)) return;
      requested.current.add(canvasId);
      dispatch(fetchInfoResponse({ imageResource, windowId }));
    });
  }, [dispatch, infoResponses, windowId, works]);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), INFO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (layout || !(timedOut || infoResponses.every(Boolean))) return;
    const aspects = works.map(({ aspect }, index) => {
      const json = infoResponses[index]?.json;
      return json?.width > 0 && json?.height > 0 ? json.width / json.height : aspect;
    });
    setLayout(layoutGallery(aspects));
  }, [infoResponses, layout, timedOut, works]);

  return (
    <>
      <color attach="background" args={['#141416']} />
      {layout ? (
        <HungGallery infoResponses={infoResponses} layout={layout} works={works} windowId={windowId} />
      ) : (
        <XROrigin>
          <XRStatsPanel label="Hanging the gallery…" position={STATS_POSITION} rotation-y={0.6} statsRef={waitingStats} />
        </XROrigin>
      )}
    </>
  );
}

Gallery.propTypes = {
  works: PropTypes.arrayOf(PropTypes.object).isRequired,
  windowId: PropTypes.string.isRequired,
};

/**
 * The XR gallery for a Mirador window: every image in its manifest hung
 * around a room, starting at the painting the window was showing.
 */
export function GalleryScene({ windowId }) {
  const works = useGalleryWorks(windowId);
  if (works.length === 0) return null;

  return <Gallery works={works} windowId={windowId} />;
}

GalleryScene.propTypes = {
  windowId: PropTypes.string.isRequired,
};
