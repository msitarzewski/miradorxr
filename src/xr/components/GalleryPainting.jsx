import { useRef } from 'react';
import PropTypes from 'prop-types';
import { useWallLabel } from '../hooks/useWallLabel';
import { TileCache } from '../lib/TileCache';
import { DeepZoomImage } from './DeepZoomImage';
import { LabelButton } from './LabelButton';
import { LoadingCue } from './LoadingCue';
import { PreviewImage } from './PreviewImage';
import { WallLabel } from './WallLabel';

const FRAME_BORDER = 0.04;
const LABEL_GAP = 0.15;
const LOADING_CUE_WIDTH = 0.3;
// Metres below the painting's bottom edge that the buttons sit
const BUTTON_ROW = -0.12;

/**
 * One work on the gallery wall: framed, shown by its preview image, and
 * streamed at full resolution while it's the painting you're at. Pinching it
 * selects it; the arrows under the painting you're at step along the wall,
 * and Relief and Gloss turn the gallery's paint relief lighting and varnish
 * glints on and off, each on its own. A thin
 * bar under the frame shows while sharper detail is still loading.
 * `ref` is the group the image is centred in.
 */
export function GalleryPainting({
  active,
  cache,
  canvasId,
  centreHeight,
  glossOn,
  height,
  infoJson = undefined,
  onGloss,
  onNext,
  onPrevious,
  onPaint,
  onSelect,
  paint,
  paintOn,
  preview,
  ref = undefined,
  statsRef = undefined,
  width,
  windowId,
  x,
  yaw,
  z,
}) {
  const labelLines = useWallLabel(windowId, canvasId);
  const progress = useRef({ ready: 0, total: 0 });

  return (
    <group position={[x, centreHeight, z]} rotation-y={yaw}>
      <group
        ref={ref}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <mesh position={[0, 0, -0.025]}>
          <boxGeometry args={[width + FRAME_BORDER * 2, height + FRAME_BORDER * 2, 0.04]} />
          <meshStandardMaterial color="#3b2f22" />
        </mesh>
        <PreviewImage height={height} paint={paint} position={[0, 0, -0.001]} url={preview} width={width} />
        {active && infoJson && (
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
      </group>
      {active && infoJson && (
        <LoadingCue
          position={[0, -height / 2 - FRAME_BORDER - 0.025, 0]}
          progressRef={progress}
          width={Math.min(LOADING_CUE_WIDTH, width / 2)}
        />
      )}
      <WallLabel lines={labelLines} position={[width / 2 + FRAME_BORDER + LABEL_GAP, -0.1, 0]} />
      {active && (
        <>
          <LabelButton onClick={onPrevious} position={[-0.37, BUTTON_ROW - height / 2, 0]} text="‹ Previous" />
          <LabelButton
            active={paintOn}
            onClick={onPaint}
            position={[-0.12, BUTTON_ROW - height / 2, 0]}
            text={paintOn ? 'Relief: On' : 'Relief: Off'}
          />
          <LabelButton
            active={glossOn}
            onClick={onGloss}
            position={[0.12, BUTTON_ROW - height / 2, 0]}
            text={glossOn ? 'Gloss: On' : 'Gloss: Off'}
          />
          <LabelButton onClick={onNext} position={[0.35, BUTTON_ROW - height / 2, 0]} text="Next ›" />
        </>
      )}
    </group>
  );
}

GalleryPainting.propTypes = {
  active: PropTypes.bool.isRequired,
  cache: PropTypes.instanceOf(TileCache).isRequired,
  canvasId: PropTypes.string.isRequired,
  centreHeight: PropTypes.number.isRequired,
  glossOn: PropTypes.bool.isRequired,
  height: PropTypes.number.isRequired,
  infoJson: PropTypes.object,
  onGloss: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onPrevious: PropTypes.func.isRequired,
  onPaint: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  paint: PropTypes.objectOf(PropTypes.shape({ value: PropTypes.any })).isRequired,
  paintOn: PropTypes.bool.isRequired,
  preview: PropTypes.string.isRequired,
  ref: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
  statsRef: PropTypes.shape({ current: PropTypes.object }),
  width: PropTypes.number.isRequired,
  windowId: PropTypes.string.isRequired,
  x: PropTypes.number.isRequired,
  yaw: PropTypes.number.isRequired,
  z: PropTypes.number.isRequired,
};
