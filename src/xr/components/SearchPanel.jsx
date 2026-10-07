import { useState } from 'react';
import PropTypes from 'prop-types';
import { LabelButton } from './LabelButton';
import { WallLabel } from './WallLabel';

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const KEY_PITCH = 0.06;
const KEY_SCALE = 0.78;
const ROW_PITCH = 0.06;
const TOP = 0.2;
const MAX_QUERY = 40;
const RESULTS_PER_PAGE = 4;
const RESULT_PITCH = 0.13;
// WallLabel cards are 1200 px wide at 2800 px per metre
const CARD_WIDTH = 1200 / 2800;
const PANEL_WIDTH = 0.68;
const noop = (event) => event.stopPropagation();

/** A pinchable key; keys are small buttons */
function Key({ onPress, text, x, y }) {
  return (
    <LabelButton
      onClick={(event) => {
        event.stopPropagation();
        onPress();
      }}
      position={[x, y, 0]}
      scale={KEY_SCALE}
      text={text}
    />
  );
}

Key.propTypes = {
  onPress: PropTypes.func.isRequired,
  text: PropTypes.string.isRequired,
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
};

/** A keyboard of letters, with backspace, space and Search */
function Keyboard({ onSearch, onText }) {
  return (
    <>
      {KEY_ROWS.map((row, rowIndex) =>
        [...row].map((letter, index) => (
          <Key
            key={letter}
            onPress={() => onText((text) => `${text}${letter.toLowerCase()}`.slice(0, MAX_QUERY))}
            text={letter}
            // Rows set in a little, as on a real keyboard
            x={(index - (row.length - 1) / 2) * KEY_PITCH + rowIndex * 0.012}
            y={TOP - 0.09 - rowIndex * ROW_PITCH}
          />
        )),
      )}
      <Key onPress={() => onText((text) => text.slice(0, -1))} text="⌫ Delete" x={-0.22} y={TOP - 0.09 - 3 * ROW_PITCH} />
      <Key
        onPress={() => onText((text) => (text.endsWith(' ') ? text : `${text} `).slice(0, MAX_QUERY))}
        text="Space"
        x={0}
        y={TOP - 0.09 - 3 * ROW_PITCH}
      />
      <Key onPress={onSearch} text="Search ›" x={0.22} y={TOP - 0.09 - 3 * ROW_PITCH} />
    </>
  );
}

Keyboard.propTypes = {
  onSearch: PropTypes.func.isRequired,
  onText: PropTypes.func.isRequired,
};

/** A page of search results as cards, with paging and a way back to the keyboard */
function Results({ fetching, hits, onHit, onNewSearch }) {
  const [page, setPage] = useState(0);
  const shown = hits.slice(page * RESULTS_PER_PAGE, (page + 1) * RESULTS_PER_PAGE);
  const pages = Math.ceil(hits.length / RESULTS_PER_PAGE);
  const status = (fetching && 'Searching…') || (hits.length === 0 && 'No matches in the gallery') || null;
  const bottom = TOP - 0.1 - RESULTS_PER_PAGE * RESULT_PITCH;

  return (
    <>
      {status && <WallLabel lines={[{ style: 'body', text: status }]} position={[-CARD_WIDTH / 2, TOP - 0.08, 0]} />}
      {shown.map((hit, index) => (
        <WallLabel
          key={hit.id}
          lines={[
            { style: 'small', text: hit.label },
            { style: 'body', text: hit.text },
          ]}
          onClick={(event) => {
            event.stopPropagation();
            onHit(hit);
          }}
          position={[-CARD_WIDTH / 2, TOP - 0.08 - index * RESULT_PITCH, 0]}
        />
      ))}
      {page > 0 && <Key onPress={() => setPage(page - 1)} text="‹ Back" x={-0.22} y={bottom} />}
      <Key onPress={onNewSearch} text="New search" x={0} y={bottom} />
      {page + 1 < pages && <Key onPress={() => setPage(page + 1)} text="More ›" x={0.22} y={bottom} />}
    </>
  );
}

Results.propTypes = {
  fetching: PropTypes.bool.isRequired,
  hits: PropTypes.arrayOf(PropTypes.object).isRequired,
  onHit: PropTypes.func.isRequired,
  onNewSearch: PropTypes.func.isRequired,
};

/**
 * Searching the gallery's books from inside it: a panel with what you've
 * typed, a keyboard of pinchable keys, and once you search, the results as
 * cards (book, page and the match in context). Pinch a result to go to it.
 * The panel faces +z; place it in front of the viewer.
 */
export function SearchPanel({ fetching, hits, onClose, onHit, onSearch, ...groupProps }) {
  const [text, setText] = useState('');
  const [showingResults, setShowingResults] = useState(false);
  const height = showingResults ? 0.25 + RESULTS_PER_PAGE * RESULT_PITCH : 0.36;

  return (
    <group {...groupProps}>
      <mesh onClick={noop} position={[0, TOP + 0.04 - height / 2, -0.004]}>
        <planeGeometry args={[PANEL_WIDTH, height]} />
        <meshBasicMaterial color="#f3efe6" opacity={0.94} toneMapped={false} transparent />
      </mesh>
      <LabelButton onClick={noop} position={[-0.07, TOP, 0]} text={text ? `${text}▏` : 'Type to search the books'} />
      <LabelButton
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        position={[0.27, TOP, 0]}
        text="Close"
      />
      {showingResults ? (
        <Results fetching={fetching} hits={hits} onHit={onHit} onNewSearch={() => setShowingResults(false)} />
      ) : (
        <Keyboard
          onSearch={() => {
            if (!text.trim()) return;
            onSearch(text);
            setShowingResults(true);
          }}
          onText={setText}
        />
      )}
    </group>
  );
}

SearchPanel.propTypes = {
  fetching: PropTypes.bool.isRequired,
  hits: PropTypes.arrayOf(PropTypes.object).isRequired,
  onClose: PropTypes.func.isRequired,
  onHit: PropTypes.func.isRequired,
  onSearch: PropTypes.func.isRequired,
};
