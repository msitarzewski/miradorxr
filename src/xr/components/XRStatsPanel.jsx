import { useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasTexture, SRGBColorSpace } from 'three';

const UPDATE_SECONDS = 0.5;
const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 512;
const LINE_HEIGHT = 64;

/**
 * Phase 1 measurements, readable in the headset: frame rate, draw calls,
 * tile counts and texture memory, drawn into a canvas texture.
 */
export function XRStatsPanel({ label = '', statsRef, ...meshProps }) {
  const gl = useThree((state) => state.gl);
  const canvas = useMemo(
    () => Object.assign(document.createElement('canvas'), { height: CANVAS_HEIGHT, width: CANVAS_WIDTH }),
    [],
  );
  const texture = useMemo(() => {
    const canvasTexture = new CanvasTexture(canvas);
    canvasTexture.colorSpace = SRGBColorSpace;
    return canvasTexture;
  }, [canvas]);
  const sample = useRef({ elapsed: 0, frames: 0 });

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((_state, delta) => {
    if (!gl.xr.isPresenting) return;

    sample.current.frames += 1;
    sample.current.elapsed += delta;
    if (sample.current.elapsed < UPDATE_SECONDS) return;

    const fps = sample.current.frames / sample.current.elapsed;
    sample.current = { elapsed: 0, frames: 0 };

    const stats = statsRef.current;
    const layer = gl.xr.getBaseLayer();
    const framebuffer = layer
      ? `${layer.framebufferWidth ?? layer.textureWidth}×${layer.framebufferHeight ?? layer.textureHeight}`
      : '–';
    const lines = [
      label,
      `${fps.toFixed(0)} fps · ${gl.info.render.calls} draw calls`,
      `tiles ${stats.tilesDrawn ?? 0} drawn · ${stats.tilesSelected ?? 0} selected · ${stats.inFlight ?? 0} loading · ${stats.failed ?? 0} failed`,
      `level ${stats.deepestLevel ?? '–'} of ${stats.maxLevel ?? '–'} · ${(stats.textureMB ?? 0).toFixed(0)} MB in ${stats.loaded ?? 0} tiles`,
      `eye ${stats.viewport ?? '–'} px · framebuffer ${framebuffer}`,
      `max texture ${gl.capabilities.maxTextureSize} · anisotropy ${gl.capabilities.getMaxAnisotropy()}`,
    ];

    const context = canvas.getContext('2d');
    context.fillStyle = '#101012';
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    context.fillStyle = '#e8e6e1';
    context.font = '40px -apple-system, system-ui, sans-serif';
    lines.forEach((line, index) => context.fillText(line, 32, LINE_HEIGHT * (index + 1), CANVAS_WIDTH - 64));
    texture.needsUpdate = true;
  });

  return (
    <mesh {...meshProps}>
      <planeGeometry args={[0.6, (0.6 * CANVAS_HEIGHT) / CANVAS_WIDTH]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

XRStatsPanel.propTypes = {
  label: PropTypes.string,
  statsRef: PropTypes.shape({ current: PropTypes.object }).isRequired,
};
