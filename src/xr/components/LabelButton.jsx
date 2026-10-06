import { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { CanvasTexture, SRGBColorSpace } from 'three';

const PIXELS_PER_METRE = 2800;
const HEIGHT = 0.055;

/** Draws a pill-shaped button label: dark, to stand out on the pale walls; an active toggle is filled green */
function drawButton(text, active) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const font = `500 64px -apple-system, system-ui, sans-serif`;
  context.font = font;
  const height = Math.round(HEIGHT * PIXELS_PER_METRE);
  canvas.width = Math.ceil(context.measureText(text).width + height * 1.2);
  canvas.height = height;

  context.fillStyle = active ? '#3ec46d' : '#2d2a26';
  context.beginPath();
  context.roundRect(0, 0, canvas.width, canvas.height, canvas.height / 2);
  context.fill();
  context.font = font;
  context.fillStyle = active ? '#1d1b18' : '#f3efe6';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  return canvas;
}

/**
 * A small pinchable button, e.g. the next and previous arrows under a
 * painting. `active` marks a toggle that's on.
 */
export function LabelButton({ active = false, onClick, text, ...meshProps }) {
  const texture = useMemo(() => {
    const canvasTexture = new CanvasTexture(drawButton(text, active));
    canvasTexture.colorSpace = SRGBColorSpace;
    return canvasTexture;
  }, [active, text]);

  useEffect(() => () => texture.dispose(), [texture]);

  const width = texture.image.width / PIXELS_PER_METRE;

  return (
    <mesh onClick={onClick} {...meshProps}>
      <planeGeometry args={[width, HEIGHT]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent />
    </mesh>
  );
}

LabelButton.propTypes = {
  active: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  text: PropTypes.string.isRequired,
};
