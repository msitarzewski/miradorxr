import PropTypes from 'prop-types';
import { WallLabel } from './WallLabel';

const PIN_RADIUS = 0.012;
const PIN_COLOUR = '#ffffff';
const CHOSEN_COLOUR = '#f0b429';
// Above the image's tiles, so pins and their highlight are never hidden
const LIFT = 0.006;
// WallLabel cards are 1200 px wide at 2800 px per metre
const CARD_WIDTH = 1200 / 2800;
const CARD_GAP = 0.02;

/**
 * An image's annotations as pins at the middle of their regions. Pinch a
 * pin to see its note on a card beside it, with its region lit; pinch the
 * pin or the card again to put it away. Drawn in the image's own space:
 * centred on the group's origin, `width` x `height` metres, facing +z.
 *
 * @param {Array} notes - from useCanvasAnnotations
 */
export function AnnotationPins({ height, notes, onChoose, chosen = null, width }) {
  const note = notes.find(({ id }) => id === chosen);
  /** Pinching a pin: show its note, or put away the one showing */
  const choose = (id) => (event) => {
    event.stopPropagation();
    onChoose(id === chosen ? null : id);
  };

  // Region corners in the image's space, from fractions of the image from its top left
  const left = note ? (note.region.x - 0.5) * width : 0;
  const top = note ? (0.5 - note.region.y) * height : 0;
  const regionWidth = note ? note.region.w * width : 0;
  const regionHeight = note ? note.region.h * height : 0;

  return (
    <group>
      {notes.map(({ id, region }) => (
        <group key={id} position={[(region.x + region.w / 2 - 0.5) * width, (0.5 - region.y - region.h / 2) * height, LIFT * 2]}>
          <mesh onClick={choose(id)}>
            <circleGeometry args={[PIN_RADIUS, 32]} />
            <meshBasicMaterial color={id === chosen ? CHOSEN_COLOUR : PIN_COLOUR} toneMapped={false} />
          </mesh>
          <mesh position-z={-0.0005}>
            <circleGeometry args={[PIN_RADIUS * 1.4, 32]} />
            <meshBasicMaterial color="#1d1b18" opacity={0.6} toneMapped={false} transparent />
          </mesh>
        </group>
      ))}
      {note && (
        <>
          <mesh position={[left + regionWidth / 2, top - regionHeight / 2, LIFT]}>
            <planeGeometry args={[regionWidth, regionHeight]} />
            <meshBasicMaterial color={CHOSEN_COLOUR} depthWrite={false} opacity={0.18} toneMapped={false} transparent />
          </mesh>
          <WallLabel
            lines={note.lines}
            onClick={choose(note.id)}
            position={[Math.max(-width / 2, Math.min(left + regionWidth + CARD_GAP, width / 2 - CARD_WIDTH)), top, LIFT * 3]}
          />
        </>
      )}
    </group>
  );
}

AnnotationPins.propTypes = {
  chosen: PropTypes.string,
  height: PropTypes.number.isRequired,
  notes: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      lines: PropTypes.array,
      region: PropTypes.shape({ h: PropTypes.number, w: PropTypes.number, x: PropTypes.number, y: PropTypes.number }),
    }),
  ).isRequired,
  onChoose: PropTypes.func.isRequired,
  width: PropTypes.number.isRequired,
};
