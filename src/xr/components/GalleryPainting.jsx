import PropTypes from 'prop-types';
import { useWallLabel } from '../hooks/useWallLabel';
import { TileCache } from '../lib/TileCache';
import { DeepZoomImage } from './DeepZoomImage';
import { LabelButton } from './LabelButton';
import { PreviewImage } from './PreviewImage';
import { WallLabel } from './WallLabel';

const FRAME_BORDER = 0.04;
const LABEL_GAP = 0.15;

/**
 * One work on the gallery wall: framed, shown by its preview image, and
 * streamed at full resolution while it's the painting you're at. Pinching it
 * selects it; the arrows under the painting you're at step along the wall,
 * and Relief turns the gallery's paint relief lighting on and off.
 * `ref` is the group the image is centred in.
 */
export function GalleryPainting({
  active,
  cache,
  canvasId,
  centreHeight,
  height,
  infoJson = undefined,
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
            statsRef={statsRef}
          />
        )}
      </group>
      <WallLabel lines={labelLines} position={[width / 2 + FRAME_BORDER + LABEL_GAP, -0.1, 0]} />
      {active && (
        <>
          <LabelButton onClick={onPrevious} position={[-0.27, -height / 2 - 0.12, 0]} text="‹ Previous" />
          <LabelButton
            active={paintOn}
            onClick={onPaint}
            position={[0, -height / 2 - 0.12, 0]}
            text={paintOn ? 'Relief: On' : 'Relief: Off'}
          />
          <LabelButton onClick={onNext} position={[0.25, -height / 2 - 0.12, 0]} text="Next ›" />
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
  height: PropTypes.number.isRequired,
  infoJson: PropTypes.object,
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
