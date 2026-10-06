import {
  BackSide,
  BoxGeometry,
  CanvasTexture,
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
} from 'three';

const SHADE_PIXELS_PER_METRE = 64;
// Where the skylit environment is seen from: roughly a visitor's eye height
const ENVIRONMENT_EYE_HEIGHT = 1.4;
// Linear radiance of the room in the environment; the skylights are the light source
const ENVIRONMENT = { ceiling: 0.75, floor: [0.45, 0.3, 0.18], skylight: 6, walls: 0.85 };

/**
 * A greyscale ambient-occlusion texture for a flat surface: white, darkening
 * softly towards whichever edges meet another surface, the way light falls
 * off into a room's corners. Used as a material's aoMap on a 0–1 UV.
 *
 * @param {number} width - metres
 * @param {number} height - metres
 * @param {object} edges - per edge ('bottom', 'left', 'right', 'top'):
 *   `{ reach, depth }`, metres the shade reaches in and how dark it gets there (0–1)
 */
export function createContactShade(width, height, edges) {
  const canvas = Object.assign(document.createElement('canvas'), {
    height: Math.max(8, Math.round(height * SHADE_PIXELS_PER_METRE)),
    width: Math.max(8, Math.round(width * SHADE_PIXELS_PER_METRE)),
  });
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'multiply';

  const scale = canvas.width / width;
  const lines = {
    bottom: [0, canvas.height, 0, canvas.height - 1],
    left: [0, 0, 1, 0],
    right: [canvas.width, 0, canvas.width - 1, 0],
    top: [0, 0, 0, 1],
  };
  Object.entries(edges).forEach(([edge, { depth, reach }]) => {
    const [x, y, towardsX, towardsY] = lines[edge];
    const pixels = reach * scale;
    const shade = context.createLinearGradient(x, y, x + (towardsX - x) * pixels, y + (towardsY - y) * pixels);
    const grey = Math.round(255 * (1 - depth));
    shade.addColorStop(0, `rgb(${grey} ${grey} ${grey})`);
    shade.addColorStop(1, '#fff');
    context.fillStyle = shade;
    context.fillRect(0, 0, canvas.width, canvas.height);
  });

  return new CanvasTexture(canvas);
}

/**
 * Renders a simplified copy of the room — pale walls, an oak floor and
 * bright skylights — into a prefiltered environment map, once. As the
 * scene's environment it lights every standard material softly from above
 * and gives the floor and frames their reflections of the skylights.
 * Paintings use basic materials and ignore it.
 *
 * @returns {import('three').WebGLRenderTarget} its `texture` is the environment; dispose it when done
 */
export function createSkylitEnvironment(renderer, { depth, height, skylights, width }) {
  const scene = new Scene();
  /** An unlit surface of the given linear radiance, a grey level or [r, g, b] */
  const surface = (radiance) =>
    new MeshBasicMaterial({
      color: Array.isArray(radiance) ? new Color(...radiance) : new Color().setScalar(radiance),
      side: BackSide,
    });
  const walls = surface(ENVIRONMENT.walls);
  // Box faces: +x, -x, +y (ceiling), -y (floor), +z, -z
  const room = new Mesh(new BoxGeometry(width, height, depth), [
    walls,
    walls,
    surface(ENVIRONMENT.ceiling),
    surface(ENVIRONMENT.floor),
    walls,
    walls,
  ]);
  room.position.y = height / 2 - ENVIRONMENT_EYE_HEIGHT;
  scene.add(room);

  const glow = new MeshBasicMaterial({ color: new Color().setScalar(ENVIRONMENT.skylight) });
  skylights.forEach(({ size, x, z }) => {
    const pane = new Mesh(new PlaneGeometry(size, size), glow);
    pane.position.set(x, height - ENVIRONMENT_EYE_HEIGHT - 0.01, z);
    pane.rotation.x = Math.PI / 2;
    scene.add(pane);
  });

  const generator = new PMREMGenerator(renderer);
  const target = generator.fromScene(scene, 0.04);
  generator.dispose();
  scene.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry.dispose();
    [object.material].flat().forEach((material) => material.dispose());
  });

  return target;
}
