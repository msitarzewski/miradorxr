import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useFrame } from '@react-three/fiber';
import { ExtrudeGeometry, Shape, Vector3 } from 'three';
import { getIiifResourceImageService } from '../../lib/iiif';
import { useCanvasAnnotations } from '../hooks/useCanvasAnnotations';
import { fetchInfoResponse } from '../../state/actions';
import { selectInfoResponses } from '../../state/selectors';
import { handGain, usePinchHand } from '../hooks/usePinchHand';
import { bookBoard, leafSide, leafTurn, PAGE, SPINE_GAP, spreadLayout, turnFromPinch } from '../lib/bookLayout';
import { sizeLine } from '../lib/physicalSize';
import { TileCache } from '../lib/TileCache';
import { bookLabelLines } from '../lib/wallLabel';
import { AnnotationPins } from './AnnotationPins';
import { DeepZoomImage } from './DeepZoomImage';
import { LabelButton } from './LabelButton';
import { LoadingCue } from './LoadingCue';
import { PreviewCacheContext, PreviewImage } from './PreviewImage';
import { RakingLight } from './RakingLight';
import { WallLabel } from './WallLabel';

// The book board's slope from horizontal: steep enough to read from a chair
const TILT = (30 * Math.PI) / 180;
const BOARD_THICKNESS = 0.025;
const PLINTH = { depth: 0.5, width: 0.72 };
// The open book's block of pages, under the two that show
const BLOCK = { margin: 0.012, thickness: 0.018 };
// How fast a leaf settles once let go (or turned by a button), and how high it lifts mid-turn
const FLIP_RATE = 6;
const FLIP_LIFT = 0.05;
// A pinch that moves less than this (metres) is a tap, and turns the page
const TAP_MOVEMENT = 0.025;
// Let go of a leaf past this much of its turn and it carries on over
const TURN_COMMIT = 0.3;
// A leaf follows the hand a little faster than under the fingers, so a short pull turns it
const PAGE_PULL = 1.3;
// Metres below the board that the buttons sit, and the gap to their row of tools
const BUTTON_GAP = 0.05;
const TOOL_ROW_GAP = 0.07;
const TOOL_SPACING = 0.24;
// Metres beyond the board's edge that the raking light's lamp starts
const LAMP_REACH = 0.05;
const NO_CORS_NOTE = "This library's images can't be shown in XR";
const pinchPoint = new Vector3();
const boardAcross = new Vector3();
const pull = new Vector3();

/** The board's height from the floor at its middle: below the eyes, seated or standing */
export const deskHeight = (eyeHeight) => Math.min(Math.max(eyeHeight - 0.45, 0.75), 1.05);

/** A plinth whose top slopes with the board: its side profile extruded across its width */
function plinthGeometry(height) {
  const rise = (PLINTH.depth / 2) * Math.tan(TILT);
  // In the profile, x is depth (+ towards the reader) and y is height
  const profile = new Shape()
    .moveTo(PLINTH.depth / 2, 0)
    .lineTo(PLINTH.depth / 2, height - rise)
    .lineTo(-PLINTH.depth / 2, height + rise)
    .lineTo(-PLINTH.depth / 2, 0)
    .closePath();
  return new ExtrudeGeometry(profile, { bevelEnabled: false, depth: PLINTH.width })
    .rotateY(-Math.PI / 2)
    .translate(PLINTH.width / 2, 0, 0);
}

/** The image service id that keys a page's info.json in Mirador's state */
const infoIdOf = (page) => getIiifResourceImageService(page.imageResource)?.id;

/**
 * One page on the board: its preview, and, while you're reading this book,
 * its full-resolution tiles. Fetches its info.json through Mirador when
 * it's needed. `targets` collects the page's group for the viewport
 * hand-off.
 */
function BookPage({
  active,
  cache,
  chosenNote = null,
  layout,
  notes = [],
  onChooseNote = undefined,
  onError,
  onPinch,
  onPress,
  paint,
  progressRef = undefined,
  targets = undefined,
  windowId,
}) {
  const dispatch = useDispatch();
  const group = useRef();
  const { height, page, width, x } = layout;
  const infoId = infoIdOf(page);
  const entry = useSelector((state) => infoId && selectInfoResponses(state)[infoId]);
  const infoJson = entry && !entry.isFetching ? entry.json : undefined;

  useEffect(() => {
    if (active && infoId && !entry) dispatch(fetchInfoResponse({ imageResource: page.imageResource, windowId }));
  }, [active, dispatch, entry, infoId, page.imageResource, windowId]);

  useEffect(() => {
    if (!active || !targets) return undefined;
    const target = { canvasId: page.canvasId, group, height, infoId, width };
    const list = targets.current;
    list.push(target);
    return () => {
      list.splice(list.indexOf(target), 1);
    };
  }, [active, height, infoId, page.canvasId, targets, width]);

  return (
    <group ref={group} position={[x, 0, BLOCK.thickness + 0.001]}>
      <PreviewImage
        height={height}
        onClick={onPinch}
        onError={onError}
        onPointerDown={onPress}
        paint={paint}
        url={page.preview}
        width={width}
      />
      {active && infoJson && (
        <DeepZoomImage
          boxHeight={height}
          boxWidth={width}
          cache={cache}
          infoJson={infoJson}
          paint={paint}
          progressRef={progressRef}
        />
      )}
      {active && notes.length > 0 && (
        <AnnotationPins chosen={chosenNote} height={height} notes={notes} onChoose={onChooseNote} width={width} />
      )}
    </group>
  );
}

BookPage.propTypes = {
  active: PropTypes.bool.isRequired,
  cache: PropTypes.instanceOf(TileCache).isRequired,
  chosenNote: PropTypes.string,
  layout: PropTypes.shape({
    height: PropTypes.number,
    page: PropTypes.object,
    width: PropTypes.number,
    x: PropTypes.number,
  }).isRequired,
  notes: PropTypes.arrayOf(PropTypes.object),
  onChooseNote: PropTypes.func,
  onError: PropTypes.func.isRequired,
  onPinch: PropTypes.func.isRequired,
  onPress: PropTypes.func.isRequired,
  paint: PropTypes.objectOf(PropTypes.shape({ value: PropTypes.any })).isRequired,
  progressRef: PropTypes.shape({ current: PropTypes.object }),
  targets: PropTypes.shape({ current: PropTypes.array }),
  windowId: PropTypes.string.isRequired,
};

/**
 * The page being turned: the page lifting off one side on its front, and
 * the page it reveals on its back, swinging over the spine. It lies on the
 * board at rest, `side` of the spine.
 */
function Leaf({ back = undefined, front = undefined, leaf, paint, side }) {
  const sign = side === 'right' ? 1 : -1;

  return (
    <group ref={leaf} position={[0, 0, BLOCK.thickness + 0.003]}>
      {front && (
        <PreviewImage
          height={front.height}
          paint={paint}
          position={[front.x, 0, 0]}
          url={front.page.preview}
          width={front.width}
        />
      )}
      {back && (
        // Back to back with the front; it reads the right way round once the leaf lands
        <PreviewImage
          height={back.height}
          paint={paint}
          position={[sign * (SPINE_GAP / 2 + back.width / 2), 0, -0.001]}
          rotation-y={Math.PI}
          url={back.page.preview}
          width={back.width}
        />
      )}
    </group>
  );
}

Leaf.propTypes = {
  back: PropTypes.object,
  front: PropTypes.object,
  leaf: PropTypes.shape({ current: PropTypes.object }).isRequired,
  paint: PropTypes.objectOf(PropTypes.shape({ value: PropTypes.any })).isRequired,
  side: PropTypes.oneOf(['left', 'right']).isRequired,
};

const bySide = (layout, side) => layout.find((entry) => entry.side === side);
const opposite = (side) => (side === 'right' ? 'left' : 'right');

/**
 * A reading lectern in the reading room: a white plinth with a sloping
 * walnut board, and a book open on it at `spread`. Pinch it to walk up to
 * it; once you're reading, take hold of the right-hand page and pull it
 * over to read on, or the left-hand page to go back (a quick pinch turns
 * it too). Previous and next
 * buttons do the same, beside Relief and Gloss (with the raking light's
 * lamp to move while either is on), and a label beside the
 * board names the book and the pages it's open at. The lectern's reading
 * side faces +z.
 */
export function Lectern({
  active,
  book,
  cache,
  eyeHeight,
  found = null,
  glossOn,
  notesOn,
  onGloss,
  onNotes,
  onPaint,
  onSelect,
  onTurn,
  paint,
  paintOn,
  spread,
  targets = undefined,
  windowId,
  x,
  yaw,
  z,
}) {
  const previews = useContext(PreviewCacheContext);
  const board = useRef();
  const leaf = useRef();
  // How far the turning leaf is over (0 to 1), and whether the hand or its own momentum moves it
  const drive = useRef({ byHand: false, progress: 0, target: 1 });
  const grab = usePinchHand();
  const progress = [useRef({ ready: 0, total: 0 }), useRef({ ready: 0, total: 0 })];
  const [shown, setShown] = useState(spread);
  const [flip, setFlip] = useState(null);
  const [failed, setFailed] = useState(false);
  const height = deskHeight(eyeHeight);
  const plinth = useMemo(() => plinthGeometry(height - 0.02), [height]);

  useEffect(() => () => plinth.dispose(), [plinth]);

  // A step to the next or previous spread (from the buttons) turns the page; a jump just opens there
  useEffect(() => {
    if (flip || spread === shown) return;
    if (book.paged && Math.abs(spread - shown) === 1) {
      drive.current = { byHand: false, progress: 0, target: 1 };
      setFlip({ direction: Math.sign(spread - shown), from: shown, to: spread });
    } else {
      setShown(spread);
    }
  }, [book.paged, flip, shown, spread]);

  useFrame((_state, delta) => {
    if (!flip || !leaf.current) return;
    const turn = drive.current;
    if (!turn.byHand) {
      turn.progress += (turn.target - turn.progress) * (1 - Math.exp(-delta * FLIP_RATE));
      if (Math.abs(turn.target - turn.progress) < 0.004) turn.progress = turn.target;
    }
    // A right-hand page turns over leftwards, a left-hand one rightwards
    leaf.current.rotation.y = (leafSide(book, flip.direction) === 'right' ? -1 : 1) * Math.PI * turn.progress;
    leaf.current.position.z = BLOCK.thickness + 0.003 + FLIP_LIFT * Math.sin(Math.PI * turn.progress);
    if (turn.byHand || turn.progress !== turn.target) return;

    // Settled: over onto the next spread, or back where it was
    setFlip(null);
    if (turn.target === 1) {
      setShown(flip.to);
      if (flip.fromHand) onTurn(flip.direction);
    }
  });

  const layout = useMemo(() => spreadLayout(book, shown), [book, shown]);
  // The board fits the book's largest opening, so it stays put as pages turn
  const { block, board: boardSize } = useMemo(() => bookBoard(book), [book]);
  const buttonRow = -boardSize.depth / 2 - BUTTON_GAP;
  // Up to two pages show at a time; each has its own annotations
  const reading = active && !flip;
  const notes = [
    useCanvasAnnotations({ active: reading, canvasId: layout[0]?.page.canvasId, lookup: book.lookup }),
    useCanvasAnnotations({ active: reading, canvasId: layout[1]?.page.canvasId, lookup: book.lookup }),
  ];
  const [chosenNote, setChosenNote] = useState(null);

  // A search hit you came here for shows lit on its page, with its match as the note
  useEffect(() => {
    if (found) setChosenNote(found.id);
  }, [found]);
  const pageNotes = layout.map(({ page }, index) => [
    ...(notesOn ? notes[index] : []),
    ...(found?.canvasId === page.canvasId && found.region
      ? [{ id: found.id, lines: [{ style: 'body', text: found.text }], region: found.region }]
      : []),
  ]);
  const tools = [
    notes.some((annotations) => annotations.length > 0) && {
      active: notesOn,
      key: 'notes',
      onClick: onNotes,
      text: notesOn ? 'Notes: On' : 'Notes: Off',
    },
  ].filter(Boolean);
  const turning = useMemo(() => {
    if (!flip) return null;
    const from = spreadLayout(book, flip.from);
    const to = spreadLayout(book, flip.to);
    const side = leafSide(book, flip.direction);
    return {
      back: bySide(to, opposite(side)),
      front: bySide(from, side),
      // Under the leaf: the old page it will cover, and the new one it uncovers
      resting: [bySide(from, opposite(side)), bySide(to, side)].filter(Boolean),
      side,
    };
  }, [book, flip]);

  // Hold the spreads either side ready, so pages turn without a wait
  useEffect(() => {
    if (!active) return undefined;
    const urls = [shown - 1, shown + 1].flatMap((neighbour) =>
      (book.spreads[neighbour] || []).map((index) => book.pages[index].preview),
    );
    urls.forEach((url) => previews.acquire(url).catch(() => {}));
    return () => urls.forEach((url) => previews.release(url));
  }, [active, book, previews, shown]);

  /** Pinching a page of a book you're not reading walks you up to it */
  const handlePagePinch = (event) => {
    event.stopPropagation();
    if (!active) onSelect();
  };

  /**
   * Taking hold of a page of the book you're reading: pull it towards the
   * spine and the leaf follows your hand over; let go past TURN_COMMIT of
   * the way and it carries on, or before that it falls back. A quick pinch
   * without moving turns it too.
   */
  const handlePagePress = (event) => {
    if (!active) return;
    event.stopPropagation();
    if (flip) return;
    board.current.worldToLocal(pinchPoint.copy(event.point));
    const direction = turnFromPinch(book, pinchPoint.x);
    const to = shown + direction;
    if (to < 0 || to >= book.spreads.length) return;
    if (!book.paged) {
      onTurn(direction);
      return;
    }

    const side = leafSide(book, direction);
    const pageWidth = bySide(spreadLayout(book, shown), side)?.width ?? PAGE.width;
    const at = event.point.clone();
    const turn = { byHand: true, progress: 0, target: 1 };
    let gain = null;
    let moved = 0;
    drive.current = turn;
    setFlip({ direction, from: shown, fromHand: true, to });

    grab({
      /** The leaf turns as far as the hand has pulled it across the board */
      onMove: (hand, start, head) => {
        gain ??= handGain(head, start, at) * PAGE_PULL;
        pull.copy(hand).sub(start);
        moved = Math.max(moved, pull.length());
        boardAcross.setFromMatrixColumn(board.current.matrixWorld, 0).normalize();
        const across = pull.dot(boardAcross) * gain;
        turn.progress = leafTurn(side === 'right' ? -across : across, pageWidth);
      },
      /** Let go: a tap or a pull far enough turns the page, a short pull doesn't */
      onRelease: () => {
        turn.byHand = false;
        turn.target = moved < TAP_MOVEMENT || turn.progress >= TURN_COMMIT ? 1 : 0;
      },
    });
  };

  const labelLines = useMemo(
    () =>
      bookLabelLines({
        note: failed ? NO_CORS_NOTE : undefined,
        pages: layout.map(({ page }) => page.label),
        provider: book.provider,
        // Pages without a recorded size are fitted to the board
        size: layout[0]?.page.size?.approximate ? 'Size not recorded' : layout[0] && sizeLine(layout[0].page.size),
        title: book.title,
      }),
    [book.provider, book.title, failed, layout],
  );

  return (
    <group position={[x, 0, z]} rotation-y={yaw}>
      <mesh
        geometry={plinth}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <meshStandardMaterial color="#f2f0ec" roughness={0.6} />
      </mesh>
      <group ref={board} position={[0, height, 0]} rotation-x={TILT - Math.PI / 2}>
        <mesh
          position={[0, 0, -BOARD_THICKNESS / 2]}
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
        >
          <boxGeometry args={[boardSize.width + 0.04, boardSize.depth + 0.04, BOARD_THICKNESS]} />
          <meshStandardMaterial color="#3b2f22" roughness={0.55} />
        </mesh>
        {book.paged && (
          <mesh position={[0, 0, BLOCK.thickness / 2]}>
            <boxGeometry args={[block.width + 2 * BLOCK.margin, block.height + 2 * BLOCK.margin, BLOCK.thickness]} />
            <meshStandardMaterial color="#ece2cc" roughness={0.85} />
          </mesh>
        )}
        {(turning ? turning.resting : layout).map((entry, index) => (
          <BookPage
            key={entry.page.canvasId}
            active={active && !turning}
            cache={cache}
            chosenNote={chosenNote}
            layout={entry}
            notes={turning ? undefined : pageNotes[index]}
            onChooseNote={setChosenNote}
            onError={() => setFailed(true)}
            onPinch={handlePagePinch}
            onPress={handlePagePress}
            paint={paint}
            progressRef={progress[index]}
            targets={targets}
            windowId={windowId}
          />
        ))}
        {turning && <Leaf back={turning.back} front={turning.front} leaf={leaf} paint={paint} side={turning.side} />}
        <WallLabel lines={labelLines} position={[boardSize.width / 2 + 0.07, boardSize.depth / 2 - 0.02, 0.002]} />
        {active && (paintOn || glossOn) && (
          <RakingLight paint={paint} radius={Math.max(boardSize.width, boardSize.depth) / 2 + LAMP_REACH} />
        )}
        {active && (
          <>
            <LoadingCue position={[0, -block.height / 2 - 0.03, BLOCK.thickness + 0.002]} progressRefs={progress} width={0.3} />
            <LabelButton onClick={() => onTurn(-1)} position={[-0.37, buttonRow, 0.004]} text="‹ Page" />
            <LabelButton
              active={paintOn}
              onClick={onPaint}
              position={[-0.12, buttonRow, 0.004]}
              text={paintOn ? 'Relief: On' : 'Relief: Off'}
            />
            <LabelButton
              active={glossOn}
              onClick={onGloss}
              position={[0.12, buttonRow, 0.004]}
              text={glossOn ? 'Gloss: On' : 'Gloss: Off'}
            />
            <LabelButton onClick={() => onTurn(1)} position={[0.36, buttonRow, 0.004]} text="Page ›" />
            {tools.map(({ key, ...tool }, index) => (
              <LabelButton
                key={key}
                position={[(index - (tools.length - 1) / 2) * TOOL_SPACING, buttonRow - TOOL_ROW_GAP, 0.004]}
                {...tool}
              />
            ))}
          </>
        )}
      </group>
    </group>
  );
}

Lectern.propTypes = {
  active: PropTypes.bool.isRequired,
  book: PropTypes.shape({
    direction: PropTypes.string,
    lookup: PropTypes.shape({ manifestId: PropTypes.string, windowId: PropTypes.string }),
    pages: PropTypes.arrayOf(PropTypes.object),
    paged: PropTypes.bool,
    provider: PropTypes.string,
    spreads: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
    title: PropTypes.string,
  }).isRequired,
  cache: PropTypes.instanceOf(TileCache).isRequired,
  eyeHeight: PropTypes.number.isRequired,
  found: PropTypes.shape({ canvasId: PropTypes.string, id: PropTypes.string, region: PropTypes.object }),
  glossOn: PropTypes.bool.isRequired,
  notesOn: PropTypes.bool.isRequired,
  onGloss: PropTypes.func.isRequired,
  onNotes: PropTypes.func.isRequired,
  onPaint: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  onTurn: PropTypes.func.isRequired,
  paint: PropTypes.objectOf(PropTypes.shape({ value: PropTypes.any })).isRequired,
  paintOn: PropTypes.bool.isRequired,
  spread: PropTypes.number.isRequired,
  targets: PropTypes.shape({ current: PropTypes.array }),
  windowId: PropTypes.string.isRequired,
  x: PropTypes.number.isRequired,
  yaw: PropTypes.number.isRequired,
  z: PropTypes.number.isRequired,
};
