import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useFrame, useThree } from '@react-three/fiber';
import { XROrigin } from '@react-three/xr';
import { fetchInfoResponse } from '../../state/actions';
import { getCurrentCanvas, selectInfoResponse } from '../../state/selectors';
import { useGalleryContents } from '../hooks/useGalleryContents';
import { useGallerySearch } from '../hooks/useGallerySearch';
import {
  CLOSE_DISTANCE,
  CLOSE_READING_DISTANCE,
  READING_DISTANCE,
  useGalleryNavigation,
  VIEW_DISTANCE,
} from '../hooks/useGalleryNavigation';
import { useViewportHandoff } from '../hooks/useViewportHandoff';
import { compareSpots, planGallery } from '../lib/galleryLayout';
import { createTileLoader } from '../lib/loadTileTexture';
import { createPaintUniforms } from '../lib/paintRelief';
import { PreviewCache } from '../lib/PreviewCache';
import { TileCache } from '../lib/TileCache';
import { FadeCurtain } from './FadeCurtain';
import { FloorTeleport } from './FloorTeleport';
import { GalleryPainting } from './GalleryPainting';
import { GalleryRooms } from './GalleryRooms';
import { Lectern } from './Lectern';
import { LabelButton } from './LabelButton';
import { PreviewCacheContext } from './PreviewImage';
import { SearchPanel } from './SearchPanel';
import { XRStatsPanel } from './XRStatsPanel';

// Until the headset reports eye height
const DEFAULT_EYE_HEIGHT = 1.2;
// Stop waiting for slow or failing manifests and info.json responses, and hang what's there
const INFO_TIMEOUT_MS = 8000;
const STATS_POSITION = [-0.7, 0.9, -1];
// Per-frame easing of the paint relief and gloss as they come and go
const PAINT_EASING = 0.08;
// Metres from the doorway's wall to where walking through it lands you
const THROUGH_DOORWAY = 1;
// The search button stays low on your right, out of the way of what you're looking at
const SEARCH_BUTTON = { below: 0.6, x: 0.5, z: -0.4 };
// The search panel opens this far in front of you and below your eyes, tilted up to face you
const SEARCH_PANEL = { below: 0.28, distance: 0.6, tilt: -0.35 };

/** The spread a book opens at: the window's page for the window's own book, else its first opening */
function openingSpread(book, canvasId) {
  const page = book.pages.findIndex((entry) => entry.canvasId === canvasId);
  const spread = page >= 0 ? book.spreads.findIndex((indices) => indices.includes(page)) : -1;
  if (spread >= 0) return spread;
  return book.paged && book.spreads.length > 1 ? 1 : 0;
}

/** The gallery and reading room, hung, with navigation around them */
function HungGallery({ books, plan, windowId, works }) {
  const gl = useThree((state) => state.gl);
  const startCanvasId = useSelector((state) => getCurrentCanvas(state, { windowId })?.id);
  const infoResponses = useSelector(
    (state) => works.map(({ canvasId, lookup }) => selectInfoResponse(state, { canvasId, ...lookup })),
    shallowEqual,
  );
  const { doorway, floors, lecterns, placements, rooms } = plan;
  const cache = useMemo(
    () => new TileCache({ load: createTileLoader({ anisotropy: gl.capabilities.getMaxAnisotropy() }) }),
    [gl],
  );
  const previews = useMemo(
    () => new PreviewCache({ load: createTileLoader({ anisotropy: gl.capabilities.getMaxAnisotropy() }) }),
    [gl],
  );
  const origin = useRef();
  const curtain = useRef();
  const targets = useRef([]);
  const statsRef = useRef({});
  const paint = useMemo(createPaintUniforms, []);
  const [paintOn, setPaintOn] = useState(false);
  const [glossOn, setGlossOn] = useState(false);
  const [notesOn, setNotesOn] = useState(false);
  // Works picked to compare, in order, and where you stood when the pair was made
  const [comparing, setComparing] = useState({ head: null, works: [] });
  const windowBook = books.findIndex(({ lookup }) => lookup.windowId);
  const [spreads, setSpreads] = useState(() =>
    books.map((book, index) => openingSpread(book, index === windowBook ? startCanvasId : undefined)),
  );

  // Everywhere you can stand to look: each painting, then each lectern
  const stations = useMemo(
    () => [
      ...placements.map((placement, work) => ({
        ...placement,
        close: CLOSE_DISTANCE,
        kind: 'painting',
        view: VIEW_DISTANCE,
        work,
      })),
      ...lecterns.map((lectern, book) => ({
        ...lectern,
        book,
        close: CLOSE_READING_DISTANCE,
        kind: 'lectern',
        view: READING_DISTANCE,
      })),
    ],
    [lecterns, placements],
  );
  const startIndex =
    windowBook >= 0
      ? placements.length + windowBook
      : Math.max(
          0,
          works.findIndex(({ canvasId, lookup }) => lookup.windowId && canvasId === startCanvasId),
        );

  const { activeIndex, eyeHeight, headInWorld, select, step, teleportTo, turn, visit } = useGalleryNavigation({
    curtain,
    origin,
    startIndex,
    stations,
  });

  useEffect(() => () => cache.dispose(), [cache]);
  useEffect(() => () => previews.dispose(), [previews]);
  useFrame(() => {
    paint.amount.value += ((paintOn ? 1 : 0) - paint.amount.value) * PAINT_EASING;
    paint.glossAmount.value += ((glossOn ? 1 : 0) - paint.glossAmount.value) * PAINT_EASING;
  });

  const active = stations[activeIndex];
  const activeBook = active.kind === 'lectern' ? books[active.book] : null;
  useViewportHandoff({
    station: activeBook
      ? { key: activeIndex, manifestId: activeBook.manifestId, viewType: activeBook.paged ? 'book' : 'single' }
      : { key: activeIndex, manifestId: works[active.work].manifestId },
    targets,
    windowId,
  });

  // Search across the books: where its panel is open, and the hit you went to
  const gallerySearch = useGallerySearch({ books, windowId });
  const [searchAt, setSearchAt] = useState(null);
  const [found, setFound] = useState(null);

  /** Opens the search panel in front of you */
  const openSearch = useCallback(() => {
    const { x, yaw, z } = headInWorld();
    setSearchAt({
      x: x - Math.sin(yaw) * SEARCH_PANEL.distance,
      y: (eyeHeight ?? DEFAULT_EYE_HEIGHT) - SEARCH_PANEL.below,
      yaw,
      z: z - Math.cos(yaw) * SEARCH_PANEL.distance,
    });
  }, [eyeHeight, headInWorld]);

  /** Goes to a search hit: its book's lectern, open at its page, with the match lit */
  const goToHit = useCallback(
    (hit) => {
      setSearchAt(null);
      setFound(hit);
      setSpreads((current) => current.map((spread, index) => (index === hit.book ? hit.spread : spread)));
      visit(placements.length + hit.book);
    },
    [placements.length, visit],
  );

  /** Picks a work to compare, or puts it back; a third pick replaces the first */
  const toggleCompare = useCallback(
    (work) =>
      setComparing(({ works: picked }) => {
        if (picked.includes(work)) return { head: null, works: picked.filter((other) => other !== work) };
        const pair = [...picked, work].slice(-2);
        return { head: pair.length === 2 ? headInWorld() : null, works: pair };
      }),
    [headInWorld],
  );

  // Where the pair floats, side by side in front of where you stood
  const floats = useMemo(() => {
    if (!comparing.head) return [];
    return compareSpots(
      comparing.head,
      comparing.works.map((work) => placements[work].width),
      { height: eyeHeight ?? DEFAULT_EYE_HEIGHT },
    );
  }, [comparing, eyeHeight, placements]);

  /** Turns a book's pages, staying within it */
  const turnPage = useCallback(
    (book, offset) =>
      setSpreads((current) =>
        current.map((spread, index) =>
          index === book ? Math.min(Math.max(spread + offset, 0), books[book].spreads.length - 1) : spread,
        ),
      ),
    [books],
  );

  /** Walks through the doorway to the other room, facing into it */
  const passDoorway = useCallback(() => {
    const inGallery = headInWorld().z < doorway.z + doorway.thickness / 2;
    if (inGallery) teleportTo(doorway.x, doorway.z + doorway.thickness + THROUGH_DOORWAY, Math.PI);
    else teleportTo(doorway.x, doorway.z - THROUGH_DOORWAY, 0);
  }, [doorway, headInWorld, teleportTo]);

  const toggles = {
    glossOn,
    notesOn,
    onGloss: () => setGlossOn((on) => !on),
    onNotes: () => setNotesOn((on) => !on),
    onPaint: () => setPaintOn((on) => !on),
    paint,
    paintOn,
  };

  return (
    <PreviewCacheContext value={previews}>
      <GalleryRooms doorway={doorway} onDoorway={passDoorway} onTurn={turn} rooms={rooms} />
      <FloorTeleport floors={floors} headInWorld={headInWorld} onTeleport={teleportTo} />
      {works.map((work, index) => (
        <GalleryPainting
          key={work.canvasId}
          active={index === active.work}
          cache={cache}
          canvasId={work.canvasId}
          centreHeight={eyeHeight ?? DEFAULT_EYE_HEIGHT}
          floating={floats[comparing.works.indexOf(index)] ?? null}
          imageResource={work.imageResource}
          inCompare={comparing.works.includes(index)}
          infoId={infoResponses[index]?.id}
          infoJson={infoResponses[index]?.json}
          layers={work.layers}
          lookup={work.lookup}
          onCompare={() => toggleCompare(index)}
          onEndCompare={() => setComparing({ head: null, works: [] })}
          onNext={() => step(1)}
          onPrevious={() => step(-1)}
          onSelect={() => select(index)}
          preview={work.preview}
          statsRef={statsRef}
          targets={targets}
          {...toggles}
          {...placements[index]}
        />
      ))}
      {books.map((book, index) => (
        <Lectern
          key={book.manifestId}
          active={index === active.book}
          book={book}
          cache={cache}
          eyeHeight={eyeHeight ?? DEFAULT_EYE_HEIGHT}
          found={found?.book === index ? found : null}
          onSelect={() => select(placements.length + index)}
          onTurn={(offset) => turnPage(index, offset)}
          spread={spreads[index]}
          targets={targets}
          windowId={windowId}
          {...toggles}
          {...lecterns[index]}
        />
      ))}
      <XROrigin ref={origin}>
        <XRStatsPanel position={STATS_POSITION} rotation-y={0.6} statsRef={statsRef} />
        {gallerySearch.searchable && !searchAt && (
          <LabelButton
            onClick={(event) => {
              event.stopPropagation();
              openSearch();
            }}
            position={[SEARCH_BUTTON.x, (eyeHeight ?? DEFAULT_EYE_HEIGHT) - SEARCH_BUTTON.below, SEARCH_BUTTON.z]}
            rotation={[-0.7, -0.8, 0, 'YXZ']}
            text="Search the books"
          />
        )}
      </XROrigin>
      {searchAt && (
        <SearchPanel
          fetching={gallerySearch.fetching}
          hits={gallerySearch.hits}
          onClose={() => setSearchAt(null)}
          onHit={goToHit}
          onSearch={gallerySearch.search}
          position={[searchAt.x, searchAt.y, searchAt.z]}
          rotation={[SEARCH_PANEL.tilt, searchAt.yaw, 0, 'YXZ']}
        />
      )}
      <FadeCurtain ref={curtain} />
    </PreviewCacheContext>
  );
}

HungGallery.propTypes = {
  books: PropTypes.arrayOf(PropTypes.object).isRequired,
  plan: PropTypes.shape({
    doorway: PropTypes.object,
    floors: PropTypes.array,
    lecterns: PropTypes.array,
    placements: PropTypes.array,
    rooms: PropTypes.array,
  }).isRequired,
  windowId: PropTypes.string.isRequired,
  works: PropTypes.arrayOf(PropTypes.object).isRequired,
};

/**
 * Waits for Mirador to load the catalogue's manifests and every work's
 * info.json (through its sagas, so IIIF auth applies), then plans the
 * gallery and reading room from the images' own proportions. Manifest
 * canvas and resource sizes can be wrong, so they're only the fallback for
 * an info.json that fails or doesn't arrive in time. The plan is fixed once
 * hung, so nothing moves while you're in the rooms.
 */
function Gallery({ windowId }) {
  const dispatch = useDispatch();
  const requested = useRef(new Set());
  const { books, settled, works } = useGalleryContents(windowId);
  const infoResponses = useSelector(
    (state) => works.map(({ canvasId, lookup }) => selectInfoResponse(state, { canvasId, ...lookup })),
    shallowEqual,
  );
  const [timedOut, setTimedOut] = useState(false);
  const [hung, setHung] = useState(null);
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
    if (hung || !(timedOut || (settled && infoResponses.every(Boolean)))) return;
    if (works.length === 0 && books.length === 0) return;
    const aspects = works.map(({ aspect }, index) => {
      const json = infoResponses[index]?.json;
      return json?.width > 0 && json?.height > 0 ? json.width / json.height : aspect;
    });
    setHung({ books, plan: planGallery(aspects, books.length), works });
  }, [books, hung, infoResponses, settled, timedOut, works]);

  return (
    <>
      <color attach="background" args={['#141416']} />
      {hung ? (
        <HungGallery books={hung.books} plan={hung.plan} windowId={windowId} works={hung.works} />
      ) : (
        <XROrigin>
          <XRStatsPanel label="Hanging the gallery…" position={STATS_POSITION} rotation-y={0.6} statsRef={waitingStats} />
        </XROrigin>
      )}
    </>
  );
}

Gallery.propTypes = {
  windowId: PropTypes.string.isRequired,
};

/**
 * The XR gallery for a Mirador window: its manifest's images hung around a
 * skylit gallery, and the catalogue's books open on lecterns in a reading
 * room beyond, starting at the work the window was showing.
 */
export function GalleryScene({ windowId }) {
  return <Gallery windowId={windowId} />;
}

GalleryScene.propTypes = {
  windowId: PropTypes.string.isRequired,
};
