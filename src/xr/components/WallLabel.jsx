import { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useThree } from '@react-three/fiber';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { wrapText } from '../lib/wallLabel';

// About 16 mm body text and 23 mm titles: legible from arm's length in a headset
const PIXELS_PER_METRE = 2800;
const LABEL_WIDTH = 1200;
const PADDING = 56;
const FONT_FAMILY = '-apple-system, system-ui, sans-serif';
const STYLES = {
  body: { color: '#2d2a26', font: `44px ${FONT_FAMILY}`, lineHeight: 60 },
  small: { color: '#5b564f', font: `34px ${FONT_FAMILY}`, lineHeight: 48 },
  title: { color: '#1d1b18', font: `600 64px ${FONT_FAMILY}`, lineHeight: 84 },
};

/** Lays the lines out on a label-card canvas sized to fit them */
function drawLabel(lines) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const laidOut = lines.flatMap(({ style, text }) => {
    context.font = STYLES[style].font;
    return wrapText(text, LABEL_WIDTH - PADDING * 2, (value) => context.measureText(value).width).map((line) => ({
      style,
      text: line,
    }));
  });

  canvas.width = LABEL_WIDTH;
  canvas.height = PADDING * 2 + laidOut.reduce((sum, { style }) => sum + STYLES[style].lineHeight, 0);
  context.fillStyle = '#f3efe6';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textBaseline = 'top';

  let y = PADDING;
  laidOut.forEach(({ style, text }) => {
    context.font = STYLES[style].font;
    context.fillStyle = STYLES[style].color;
    context.fillText(text, PADDING, y);
    y += STYLES[style].lineHeight;
  });

  return canvas;
}

/**
 * A museum wall label drawn into a canvas texture. Its top-left corner sits
 * at the group origin, so the caller places it beside the work.
 */
export function WallLabel({ lines, ...groupProps }) {
  const gl = useThree((state) => state.gl);
  const texture = useMemo(() => {
    const canvasTexture = new CanvasTexture(drawLabel(lines));
    canvasTexture.colorSpace = SRGBColorSpace;
    canvasTexture.anisotropy = gl.capabilities.getMaxAnisotropy();
    return canvasTexture;
  }, [gl, lines]);

  useEffect(() => () => texture.dispose(), [texture]);

  if (lines.length === 0) return null;

  const width = texture.image.width / PIXELS_PER_METRE;
  const height = texture.image.height / PIXELS_PER_METRE;

  return (
    <group {...groupProps}>
      <mesh position={[width / 2, -height / 2, 0]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

WallLabel.propTypes = {
  lines: PropTypes.arrayOf(PropTypes.shape({ style: PropTypes.string, text: PropTypes.string })).isRequired,
};
