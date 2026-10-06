import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useThree } from '@react-three/fiber';
import { BackSide, Euler, Matrix4, Path, Quaternion, Shape, ShapeGeometry, Vector3 } from 'three';
import { layoutSkylights } from '../lib/galleryLayout';
import { createContactShade, createSkylitEnvironment } from '../lib/galleryLighting';
import { loadParquet } from '../lib/parquetFloor';
import { angleBetween, headingOf } from '../lib/teleport';

const WALL_HEIGHT = 3.4;
// Painted drywall, just off white so the paintings' own whites stay brightest.
// Each wall is a touch different, which helps keep your bearings after a teleport.
const WALL_COLOURS = ['#ebe8e2', '#e7e9e4', '#ebe6e3', '#e6e7e9'];
// Metres the skylights' light wells rise above the ceiling
const SKYLIGHT_WELL = 0.45;
const BASEBOARD = { height: 0.1, thickness: 0.015 };
// The skylit environment supplies most of the room's light; the sun adds a little direction
const ENVIRONMENT_INTENSITY = 1;
const SUN_POSITION = [2.5, 8, 1.5];
// The ceiling sees mostly floor in the environment; real ceilings under skylights
// catch far more light bounced off the walls, so it adds some of its own
const CEILING_BOUNCE = { environment: 0.6, own: 0.5 };
// The parquet's average tone, shown until its scan has loaded
const FLOOR_COLOUR = '#a27c55';
const WALL_SHADE = {
  bottom: { depth: 0.4, reach: 0.35 },
  left: { depth: 0.3, reach: 0.4 },
  right: { depth: 0.3, reach: 0.4 },
  top: { depth: 0.25, reach: 0.3 },
};
const FLOOR_SHADE = { depth: 0.45, reach: 0.45 };
const CEILING_SHADE = { depth: 0.3, reach: 0.35 };

const SNAP_TURN = Math.PI / 4;
// How far the pinch ray has to swing sideways to count as a flick
const FLICK_ANGLE = (8 * Math.PI) / 180;
const rayDirection = new Vector3();

/** Heading of the pointer's ray, from its world orientation */
const rayHeading = (event) => {
  rayDirection.set(0, 0, -1).applyQuaternion(event.pointerQuaternion);
  return headingOf(rayDirection.x, rayDirection.z);
};

/** The room's walls, each a plane facing into the room */
const wallsOf = ({ depth, width }) => [
  { length: width, position: [0, WALL_HEIGHT / 2, -depth / 2], rotation: 0 },
  { length: depth, position: [width / 2, WALL_HEIGHT / 2, 0], rotation: -Math.PI / 2 },
  { length: width, position: [0, WALL_HEIGHT / 2, depth / 2], rotation: Math.PI },
  { length: depth, position: [-width / 2, WALL_HEIGHT / 2, 0], rotation: Math.PI / 2 },
];

/** The ceiling as one face-down sheet with a square hole for each skylight */
function ceilingGeometry({ depth, width }, skylights) {
  const shape = new Shape()
    .moveTo(-width / 2, -depth / 2)
    .lineTo(width / 2, -depth / 2)
    .lineTo(width / 2, depth / 2)
    .lineTo(-width / 2, depth / 2)
    .closePath();
  skylights.forEach(({ size, x, z }) => {
    shape.holes.push(
      new Path()
        .moveTo(x - size / 2, z - size / 2)
        .lineTo(x - size / 2, z + size / 2)
        .lineTo(x + size / 2, z + size / 2)
        .lineTo(x + size / 2, z - size / 2)
        .closePath(),
    );
  });
  return new ShapeGeometry(shape);
}

const facingDown = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0));
const upright = new Quaternion();

/** Places a unit shape: moved to `position`, turned by `rotation`, sized by `scale` */
const placed = (position, rotation, scale) => new Matrix4().compose(new Vector3(...position), rotation, new Vector3(...scale));

/** Every skylight's light well (a unit box, seen from inside) and frosted pane (a unit plane) */
function skylightPlacements(skylights) {
  return {
    panes: skylights.map(({ size, x, z }) => placed([x, WALL_HEIGHT + SKYLIGHT_WELL - 0.005, z], facingDown, [size, size, 1])),
    wells: skylights.map(({ size, x, z }) =>
      placed([x, WALL_HEIGHT + SKYLIGHT_WELL / 2, z], upright, [size, SKYLIGHT_WELL, size]),
    ),
  };
}

/** A painted baseboard (a unit box) along the foot of each wall, just proud of it */
function baseboardPlacements(walls) {
  return walls.map(({ length, position: [x, , z], rotation }) =>
    placed(
      [
        x + (Math.sin(rotation) * BASEBOARD.thickness) / 2,
        BASEBOARD.height / 2,
        z + (Math.cos(rotation) * BASEBOARD.thickness) / 2,
      ],
      new Quaternion().setFromEuler(new Euler(0, rotation, 0)),
      [length, BASEBOARD.height, BASEBOARD.thickness],
    ),
  );
}

/** Copies of one unit shape, drawn together in one call, one per placement matrix */
function Instances({ children, placements }) {
  const mesh = useRef();

  useLayoutEffect(() => {
    placements.forEach((matrix, index) => mesh.current.setMatrixAt(index, matrix));
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [placements]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, placements.length]}>
      {children}
    </instancedMesh>
  );
}

Instances.propTypes = {
  children: PropTypes.node.isRequired,
  placements: PropTypes.arrayOf(PropTypes.instanceOf(Matrix4)).isRequired,
};

/**
 * A light, skylit gallery around the hung works: an oak parquet floor, painted
 * drywall with baseboards, and a ceiling of frosted skylights that light the
 * room softly from above. Pinch a bare wall or the ceiling and flick
 * sideways to snap-turn 45 degrees that way.
 */
export function GalleryRoom({ depth, onTurn, width }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const flick = useRef(null);

  const room = useMemo(() => {
    const size = { depth, width };
    const walls = wallsOf(size);
    const skylights = layoutSkylights(size);
    const ceilingShade = createContactShade(width, depth, {
      bottom: CEILING_SHADE,
      left: CEILING_SHADE,
      right: CEILING_SHADE,
      top: CEILING_SHADE,
    });
    // The ceiling's UVs are its shape's coordinates in metres, centred on the room
    ceilingShade.repeat.set(1 / width, 1 / depth);
    ceilingShade.offset.set(0.5, 0.5);

    return {
      baseboards: baseboardPlacements(walls),
      ceiling: ceilingGeometry(size, skylights),
      ceilingShade,
      floorShade: createContactShade(width, depth, {
        bottom: FLOOR_SHADE,
        left: FLOOR_SHADE,
        right: FLOOR_SHADE,
        top: FLOOR_SHADE,
      }),
      skylights,
      walls: walls.map((wall) => ({ ...wall, shade: createContactShade(wall.length, WALL_HEIGHT, WALL_SHADE) })),
      ...skylightPlacements(skylights),
    };
  }, [depth, width]);

  useEffect(
    () => () => {
      room.ceiling.dispose();
      [room.ceilingShade, room.floorShade, ...room.walls.map(({ shade }) => shade)].forEach((texture) => texture.dispose());
    },
    [room],
  );

  // The oak parquet's scanned maps, once loaded
  const [parquet, setParquet] = useState(null);
  useEffect(() => {
    let maps;
    let current = true;
    loadParquet({ anisotropy: gl.capabilities.getMaxAnisotropy(), depth, width })
      .then((loaded) => {
        maps = loaded;
        if (current) setParquet(loaded);
        else Object.values(loaded).forEach((texture) => texture.dispose());
      })
      .catch((error) => console.warn('[Mirador XR: parquet floor failed to load]', error));
    return () => {
      current = false;
      setParquet(null);
      if (maps) Object.values(maps).forEach((texture) => texture.dispose());
    };
  }, [depth, gl, width]);

  // Light the room's standard materials with its own skylit environment
  useEffect(() => {
    const environment = createSkylitEnvironment(gl, { depth, height: WALL_HEIGHT, skylights: room.skylights, width });
    scene.environment = environment.texture;
    scene.environmentIntensity = ENVIRONMENT_INTENSITY;
    return () => {
      scene.environment = null;
      environment.dispose();
    };
  }, [depth, gl, room, scene, width]);

  /** */
  const handlePointerDown = (event) => {
    event.stopPropagation();
    event.object.setPointerCapture(event.pointerId);
    flick.current = { heading: rayHeading(event), pointerId: event.pointerId };
  };

  /** */
  const handlePointerUp = (event) => {
    const start = flick.current;
    if (!start || start.pointerId !== event.pointerId) return;
    flick.current = null;
    event.object.releasePointerCapture(event.pointerId);

    const swing = angleBetween(start.heading, rayHeading(event));
    if (Math.abs(swing) > FLICK_ANGLE) onTurn(Math.sign(swing) * SNAP_TURN);
  };

  return (
    <>
      <directionalLight color="#fffaf3" intensity={0.5} position={SUN_POSITION} />
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[width, depth]} />
        {/* A new material once the maps arrive, so three.js compiles it with them */}
        <meshStandardMaterial
          key={parquet ? 'parquet' : 'plain'}
          aoMap={room.floorShade}
          color={parquet ? '#ffffff' : FLOOR_COLOUR}
          roughness={parquet ? 1 : 0.5}
          {...parquet}
        />
      </mesh>
      <group onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
        <mesh geometry={room.ceiling} position={[0, WALL_HEIGHT, 0]} rotation-x={Math.PI / 2}>
          <meshStandardMaterial
            aoMap={room.ceilingShade}
            color="#f1f0ec"
            emissive="#f1f0ec"
            emissiveIntensity={CEILING_BOUNCE.own}
            envMapIntensity={CEILING_BOUNCE.environment}
            roughness={0.95}
          />
        </mesh>
        <Instances placements={room.wells}>
          <boxGeometry />
          <meshStandardMaterial color="#f4f3f0" roughness={0.95} side={BackSide} />
        </Instances>
        <Instances placements={room.panes}>
          <planeGeometry />
          <meshBasicMaterial color="#f7f9fc" toneMapped={false} />
        </Instances>
        {room.walls.map(({ length, position, rotation, shade }, index) => (
          <mesh key={WALL_COLOURS[index]} position={position} rotation-y={rotation}>
            <planeGeometry args={[length, WALL_HEIGHT]} />
            <meshStandardMaterial aoMap={shade} color={WALL_COLOURS[index]} roughness={0.92} />
          </mesh>
        ))}
        <Instances placements={room.baseboards}>
          <boxGeometry />
          <meshStandardMaterial color="#f5f3ef" roughness={0.5} />
        </Instances>
      </group>
    </>
  );
}

GalleryRoom.propTypes = {
  depth: PropTypes.number.isRequired,
  onTurn: PropTypes.func.isRequired,
  width: PropTypes.number.isRequired,
};
