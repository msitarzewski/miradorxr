import { useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { useFrame, useThree } from '@react-three/fiber';
import { Box3, Frustum, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { createTileGrid } from '../lib/tileGrid';
import { baseLevel, resolveDrawList, selectTiles, tilesAtLevel } from '../lib/selectTiles';
import { TileCache } from '../lib/TileCache';
import { createTileLoader } from '../lib/loadTileTexture';

// Re-select tiles every few frames; tile loading is far slower than this
const SELECT_EVERY_N_FRAMES = 8;
// Finer levels sit fractionally in front, so they cover coarser fallbacks
const LEVEL_DEPTH_STEP = 0.0002;

// One unit quad shared by every tile, with V flipped for ImageBitmap textures
const tileGeometry = new PlaneGeometry(1, 1);
const { uv } = tileGeometry.attributes;
for (let i = 0; i < uv.count; i += 1) uv.setY(i, 1 - uv.getY(i));

const frustum = new Frustum();
const projectionView = new Matrix4();
const tileBox = new Box3();
const corner = new Vector3();
const eyeInImage = new Vector3();
// Tiles skip raycasting; pointer events land on whatever backs the image
const noRaycast = () => {};

/**
 * A IIIF image as a plane of streamed tiles, `width` metres wide and centred
 * on its group. While an XR session runs it selects tiles from the headset's
 * per-eye resolution and draws each wanted tile, or its nearest loaded
 * ancestor until the tile arrives.
 */
export function DeepZoomImage({ infoJson, statsRef = undefined, width, ...groupProps }) {
  const gl = useThree((state) => state.gl);
  const grid = useMemo(() => createTileGrid(infoJson), [infoJson]);
  const baseTiles = useMemo(() => tilesAtLevel(grid, baseLevel(grid)), [grid]);
  const cache = useMemo(
    () => new TileCache({ load: createTileLoader({ anisotropy: gl.capabilities.getMaxAnisotropy() }) }),
    [gl],
  );
  const group = useRef();
  const meshes = useRef(new Map());
  const frameCount = useRef(0);

  useEffect(() => () => cache.dispose(), [cache]);

  // Drop the previous image's tile meshes when the image changes
  useEffect(() => {
    const tileMeshes = meshes.current;
    return () => {
      tileMeshes.forEach((mesh) => {
        mesh.removeFromParent();
        mesh.material.dispose();
      });
      tileMeshes.clear();
    };
  }, [grid]);

  useFrame(() => {
    frameCount.current += 1;
    if (!gl.xr.isPresenting || !group.current || frameCount.current % SELECT_EVERY_N_FRAMES !== 0) return;

    const camera = gl.xr.getCamera();
    const eye = camera.cameras[0];
    if (!eye) return;

    const halfHeight = (width * grid.aspectRatio) / 2;
    // Rects are in image-width units with y down; the group's local space is metres with y up
    const toLocal = (u, v) => corner.set((u - 0.5) * width, halfHeight - v * width, 0);

    projectionView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projectionView);
    group.current.updateWorldMatrix(true, false);
    group.current.worldToLocal(eyeInImage.setFromMatrixPosition(camera.matrixWorld));
    // Display pixels per metre at 1 m, from the eye's projection and viewport
    const pixelsPerMetre = (eye.viewport.z / 2) * eye.projectionMatrix.elements[0];

    /** */
    const isVisible = (rect) => {
      tileBox.makeEmpty();
      [
        [rect.x, rect.y],
        [rect.x + rect.w, rect.y],
        [rect.x, rect.y + rect.h],
        [rect.x + rect.w, rect.y + rect.h],
      ].forEach(([u, v]) => tileBox.expandByPoint(toLocal(u, v).applyMatrix4(group.current.matrixWorld)));
      return frustum.intersectsBox(tileBox);
    };

    /** Display pixels across the tile, seen from its nearest point */
    const displayPixels = (rect) => {
      const left = (rect.x - 0.5) * width;
      const top = halfHeight - rect.y * width;
      const dx = Math.max(left - eyeInImage.x, 0, eyeInImage.x - (left + rect.w * width));
      const dy = Math.max(top - rect.h * width - eyeInImage.y, 0, eyeInImage.y - top);
      const distance = Math.max(Math.hypot(dx, dy, eyeInImage.z), 0.05);
      return (rect.w * width * pixelsPerMetre) / distance;
    };

    const selected = selectTiles(grid, { displayPixels, isVisible });
    // The base level is always drawn behind, so newly visible areas are never empty
    const drawList = resolveDrawList(grid, [...baseTiles, ...selected], (key) => cache.isLoaded(key));
    const wanted = new Map();
    [...baseTiles, ...selected, ...drawList].forEach((tile) => {
      wanted.set(tile.key, { key: tile.key, priority: tile.level, url: grid.url(tile.level, tile.x, tile.y) });
    });
    cache.want([...wanted.values()]);

    syncMeshes(drawList);

    if (statsRef) {
      Object.assign(statsRef.current, {
        deepestLevel: Math.max(...drawList.map(({ level }) => level), grid.minLevel),
        failed: cache.failed.size,
        inFlight: cache.inFlight.size,
        loaded: cache.entries.size,
        maxLevel: grid.maxLevel,
        textureMB: cache.bytes / (1024 * 1024),
        tilesDrawn: drawList.length,
        tilesSelected: selected.length,
        viewport: `${eye.viewport.z}×${eye.viewport.w}`,
      });
    }
  });

  /** Adds and removes tile meshes so the group holds exactly the draw list */
  function syncMeshes(drawList) {
    const keep = new Set(drawList.map(({ key }) => key));
    meshes.current.forEach((mesh, key) => {
      if (keep.has(key)) return;
      group.current.remove(mesh);
      mesh.material.dispose();
      meshes.current.delete(key);
    });

    drawList.forEach(({ key, level, x, y }) => {
      if (meshes.current.has(key)) return;
      const rect = grid.bounds(level, x, y);
      const mesh = new Mesh(tileGeometry, new MeshBasicMaterial({ map: cache.texture(key), toneMapped: false }));
      mesh.position.set(
        (rect.x + rect.w / 2 - 0.5) * width,
        (width * grid.aspectRatio) / 2 - (rect.y + rect.h / 2) * width,
        level * LEVEL_DEPTH_STEP,
      );
      mesh.scale.set(rect.w * width, rect.h * width, 1);
      mesh.raycast = noRaycast;
      group.current.add(mesh);
      meshes.current.set(key, mesh);
    });
  }

  return <group ref={group} {...groupProps} />;
}

DeepZoomImage.propTypes = {
  infoJson: PropTypes.object.isRequired,
  statsRef: PropTypes.shape({ current: PropTypes.object }),
  width: PropTypes.number.isRequired,
};
