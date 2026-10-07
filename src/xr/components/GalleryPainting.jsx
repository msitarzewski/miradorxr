import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useFrame } from '@react-three/fiber';
import { useCanvasAnnotations } from '../hooks/useCanvasAnnotations';
import { useWallLabel } from '../hooks/useWallLabel';
import { sizeLine } from '../lib/physicalSize';
import { angleBetween } from '../lib/teleport';
import { TileCache } from '../lib/TileCache';
import { AnnotationPins } from './AnnotationPins';
import { DeepZoomImage } from './DeepZoomImage';
import { LabelButton } from './LabelButton';
import { LayerLens, useLayerLens } from './LayerLens';
import { LoadingCue } from './LoadingCue';
import { PreviewImage } from './PreviewImage';
import { RakingLight } from './RakingLight';
import { WallLabel } from './WallLabel';

const FRAME_BORDER = 0.04;
const LABEL_GAP = 0.15;
const LOADING_CUE_WIDTH = 0.3;
// Metres beyond the painting's edge that the raking light's lamp swings round
const LAMP_REACH = 0.12;
// Metres below the painting's bottom edge that the buttons sit, and the gap to their row of tools
const BUTTON_ROW = -0.12;
const TOOL_ROW_GAP = 0.07;
const TOOL_SPACING = 0.24;
// A large work's buttons go beside it, under its label, rather than this near the floor (metres)
const LOWEST_BUTTONS = 0.7;
// WallLabel cards are 1200 px wide at 2800 px per metre; buttons beside a work sit in pairs under it
const LABEL_WIDTH = 1200 / 2800;
const COMPACT_SPACING = 0.12;

// How quickly a work flies between the wall and where it floats to be compared
const FLIGHT_RATE = 5;

/**
 * Keeps a work's group on the wall at `home`, or flies it to `away` (where
 * it floats to be compared) and back again, easing in and out.
 */
function useFlight(holder, home, away) {
  const flying = useRef(false);

  useFrame((_state, delta) => {
    const group = holder.current;
    if (!group) return;
    if (away) flying.current = true;
    if (!flying.current) return;

    const target = away ?? { ...home, scale: 1 };
    const step = 1 - Math.exp(-delta * FLIGHT_RATE);
    group.position.x += (target.x - group.position.x) * step;
    group.position.y += (target.y - group.position.y) * step;
    group.position.z += (target.z - group.position.z) * step;
    group.rotation.y += angleBetween(group.rotation.y, target.yaw) * step;
    group.scale.setScalar(group.scale.x + (target.scale - group.scale.x) * step);

    // Back on the wall: settle exactly where it hangs
    const offWall = Math.hypot(home.x - group.position.x, home.y - group.position.y, home.z - group.position.z);
    if (!away && offWall < 0.003) {
      group.position.set(home.x, home.y, home.z);
      group.rotation.y = home.yaw;
      group.scale.setScalar(1);
      flying.current = false;
    }
  });
}

/**
 * Where a painting's label and buttons go, relative to its centre: the
 * label beside it at about eye level, and the buttons under it, or under
 * the label when the work comes down too near the floor for them.
 */
function labelAndButtons({ centreHeight, eyeHeight, height, width }) {
  const labelAt = [
    width / 2 + FRAME_BORDER + LABEL_GAP,
    Math.min(height / 2, Math.max(-height / 2 + 0.1, eyeHeight - centreHeight)) - 0.1,
  ];
  const under = centreHeight - height / 2 + BUTTON_ROW - TOOL_ROW_GAP >= LOWEST_BUTTONS;
  return {
    buttonsAt: under ? [0, BUTTON_ROW - height / 2] : [labelAt[0] + LABEL_WIDTH / 2, labelAt[1] - LABEL_WIDTH * 0.6],
    compact: !under,
    labelAt,
  };
}

/** The size the image is shown at: its own proportions, fitted inside the box */
function shownSize(infoJson, width, height) {
  const aspect = infoJson?.width > 0 && infoJson?.height > 0 ? infoJson.width / infoJson.height : width / height;
  return aspect > width / height ? { height: width / aspect, width } : { height, width: height * aspect };
}

/**
 * The buttons for a painting, their main row centred at `at`: while you're
 * at it, the arrows along the wall, Relief and Gloss, and a row of tools
 * below (or, `compact`, all of them two to a row); while it floats to be
 * compared, Relief, Gloss and Done.
 */
function PaintingButtons({ at, compact, floating, glossOn, onEndCompare, onGloss, onNext, onPaint, onPrevious, paintOn, tools }) {
  const [x, row] = at;
  const relief = { active: paintOn, onClick: onPaint, text: paintOn ? 'Relief: On' : 'Relief: Off' };
  const gloss = { active: glossOn, onClick: onGloss, text: glossOn ? 'Gloss: On' : 'Gloss: Off' };

  if (floating) {
    return (
      <>
        <LabelButton position={[x - 0.24, row, 0]} {...relief} />
        <LabelButton position={[x, row, 0]} {...gloss} />
        <LabelButton onClick={onEndCompare} position={[x + 0.26, row, 0]} text="Done comparing" />
      </>
    );
  }

  if (compact) {
    // Beside the work, under its label: two to a row
    const buttons = [
      { key: 'previous', onClick: onPrevious, text: '‹ Previous' },
      { key: 'next', onClick: onNext, text: 'Next ›' },
      { key: 'relief', ...relief },
      { key: 'gloss', ...gloss },
      ...tools,
    ];
    return buttons.map(({ key, ...button }, index) => (
      <LabelButton
        key={key}
        position={[x + (index % 2 ? 1 : -1) * COMPACT_SPACING, row - Math.floor(index / 2) * TOOL_ROW_GAP, 0]}
        {...button}
      />
    ));
  }

  return (
    <>
      <LabelButton onClick={onPrevious} position={[x - 0.37, row, 0]} text="‹ Previous" />
      <LabelButton position={[x - 0.12, row, 0]} {...relief} />
      <LabelButton position={[x + 0.12, row, 0]} {...gloss} />
      <LabelButton onClick={onNext} position={[x + 0.35, row, 0]} text="Next ›" />
      {tools.map(({ key, ...tool }, index) => (
        <LabelButton
          key={key}
          position={[x + (index - (tools.length - 1) / 2) * TOOL_SPACING, row - TOOL_ROW_GAP, 0]}
          {...tool}
        />
      ))}
    </>
  );
}

PaintingButtons.propTypes = {
  at: PropTypes.arrayOf(PropTypes.number).isRequired,
  compact: PropTypes.bool.isRequired,
  floating: PropTypes.bool.isRequired,
  glossOn: PropTypes.bool.isRequired,
  onEndCompare: PropTypes.func.isRequired,
  onGloss: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onPaint: PropTypes.func.isRequired,
  onPrevious: PropTypes.func.isRequired,
  paintOn: PropTypes.bool.isRequired,
  tools: PropTypes.arrayOf(PropTypes.object).isRequired,
};

/**
 * One work on the gallery wall: framed, shown by its preview image, and
 * streamed at full resolution while it's the painting you're at. Pinching it
 * selects it; the arrows under the painting you're at step along the wall,
 * and Relief and Gloss turn the gallery's paint relief lighting and varnish
 * glints on and off, each on its own, and while either is on, a lamp
 * beside it moves the raking light. Below them, tools for what the work
 * has: Notes pins its annotations to it, and Lens steps through its other
 * layers (an X-ray, say), seen through a lens you pinch and drag across it;
 * while the lens is out, pinching the work moves the lens. Compare picks it
 * as one of a pair to compare: once two are picked, both fly off their
 * walls (`floating`) to hang side by side in front of you. A thin bar under the frame shows
 * while sharper detail is still loading. While it's active, the image's
 * group joins `targets` for the viewport hand-off.
 */
export function GalleryPainting({
  active,
  cache,
  canvasId,
  centreHeight,
  eyeHeight,
  floating = null,
  glossOn,
  height,
  imageResource = undefined,
  inCompare = false,
  infoId = undefined,
  infoJson = undefined,
  layers = [],
  lookup,
  notesOn,
  onCompare,
  onEndCompare,
  onGloss,
  onNotes,
  onNext,
  onPrevious,
  onPaint,
  onSelect,
  paint,
  paintOn,
  preview,
  size = null,
  statsRef = undefined,
  targets = undefined,
  width,
  x,
  yaw,
  z,
}) {
  const wallLines = useWallLabel(lookup, canvasId);
  const labelLines = useMemo(
    () => (size ? [...wallLines, { style: 'small', text: sizeLine(size) }] : wallLines),
    [size, wallLines],
  );
  const { buttonsAt, compact, labelAt } = labelAndButtons({ centreHeight, eyeHeight, height, width });
  const holder = useRef();
  const image = useRef();
  // Streamed at full resolution while you're at it or comparing it
  const showing = active || Boolean(floating);
  const home = useMemo(() => ({ x, y: centreHeight, yaw, z }), [centreHeight, x, yaw, z]);
  useFlight(holder, home, floating);
  const notes = useCanvasAnnotations({ active, canvasId, lookup });
  const [chosenNote, setChosenNote] = useState(null);
  const shown = shownSize(infoJson, width, height);

  const otherLayers = useMemo(() => layers.filter((layer) => layer !== imageResource), [imageResource, layers]);
  const layerLens = useLayerLens({ active, image, layers: otherLayers, shown });

  const tools = [
    notes.length > 0 && { active: notesOn, key: 'notes', onClick: onNotes, text: notesOn ? 'Notes: On' : 'Notes: Off' },
    layerLens.tool,
    { active: inCompare, key: 'compare', onClick: onCompare, text: inCompare ? 'Compare: On' : 'Compare: Off' },
  ].filter(Boolean);
  const progress = useRef({ ready: 0, total: 0 });

  useEffect(() => {
    if (!showing || !targets) return undefined;
    const target = { canvasId, group: image, height, infoId, width };
    const list = targets.current;
    list.push(target);
    return () => {
      list.splice(list.indexOf(target), 1);
    };
  }, [canvasId, height, infoId, showing, targets, width]);

  return (
    <group ref={holder} position={[x, centreHeight, z]} rotation-y={yaw}>
      <group
        ref={image}
        onClick={(event) => {
          event.stopPropagation();
          if (!layerLens.on && !floating) onSelect();
        }}
        {...layerLens.handlers}
      >
        <mesh position={[0, 0, -0.025]}>
          <boxGeometry args={[width + FRAME_BORDER * 2, height + FRAME_BORDER * 2, 0.04]} />
          <meshStandardMaterial color="#3b2f22" />
        </mesh>
        <PreviewImage height={height} paint={paint} position={[0, 0, -0.001]} url={preview} width={width} />
        {showing && infoJson && (
          <DeepZoomImage
            boxHeight={height}
            boxWidth={width}
            cache={cache}
            infoJson={infoJson}
            paint={paint}
            progressRef={progress}
            statsRef={statsRef}
          />
        )}
        {layerLens.layer && (
          <LayerLens
            boxHeight={height}
            boxWidth={width}
            cache={cache}
            layer={layerLens.layer}
            lens={layerLens.lens}
            paint={paint}
            region={layerLens.region}
            windowId={lookup.windowId}
          />
        )}
        {active && notesOn && (
          <AnnotationPins chosen={chosenNote} height={shown.height} notes={notes} onChoose={setChosenNote} width={shown.width} />
        )}
      </group>
      {showing && infoJson && (
        <LoadingCue
          position={[0, -height / 2 - FRAME_BORDER - 0.025, 0]}
          progressRefs={[progress]}
          width={Math.min(LOADING_CUE_WIDTH, width / 2)}
        />
      )}
      <WallLabel lines={labelLines} position={[...labelAt, 0]} />
      {showing && (paintOn || glossOn) && <RakingLight paint={paint} radius={Math.max(width, height) / 2 + LAMP_REACH} />}
      {showing && (
        <PaintingButtons
          at={buttonsAt}
          compact={compact}
          floating={Boolean(floating)}
          glossOn={glossOn}
          onEndCompare={onEndCompare}
          onGloss={onGloss}
          onNext={onNext}
          onPaint={onPaint}
          onPrevious={onPrevious}
          paintOn={paintOn}
          tools={tools}
        />
      )}
    </group>
  );
}

GalleryPainting.propTypes = {
  active: PropTypes.bool.isRequired,
  cache: PropTypes.instanceOf(TileCache).isRequired,
  canvasId: PropTypes.string.isRequired,
  centreHeight: PropTypes.number.isRequired,
  eyeHeight: PropTypes.number.isRequired,
  floating: PropTypes.shape({
    scale: PropTypes.number,
    x: PropTypes.number,
    y: PropTypes.number,
    yaw: PropTypes.number,
    z: PropTypes.number,
  }),
  glossOn: PropTypes.bool.isRequired,
  height: PropTypes.number.isRequired,
  imageResource: PropTypes.object,
  inCompare: PropTypes.bool,
  infoId: PropTypes.string,
  infoJson: PropTypes.object,
  layers: PropTypes.arrayOf(PropTypes.object),
  lookup: PropTypes.shape({ manifestId: PropTypes.string, windowId: PropTypes.string }).isRequired,
  notesOn: PropTypes.bool.isRequired,
  onCompare: PropTypes.func.isRequired,
  onEndCompare: PropTypes.func.isRequired,
  onGloss: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onNotes: PropTypes.func.isRequired,
  onPrevious: PropTypes.func.isRequired,
  onPaint: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  paint: PropTypes.objectOf(PropTypes.shape({ value: PropTypes.any })).isRequired,
  paintOn: PropTypes.bool.isRequired,
  preview: PropTypes.string.isRequired,
  size: PropTypes.shape({ approximate: PropTypes.bool, height: PropTypes.number, label: PropTypes.string }),
  statsRef: PropTypes.shape({ current: PropTypes.object }),
  targets: PropTypes.shape({ current: PropTypes.array }),
  width: PropTypes.number.isRequired,
  x: PropTypes.number.isRequired,
  yaw: PropTypes.number.isRequired,
  z: PropTypes.number.isRequired,
};
