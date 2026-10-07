import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useThree } from '@react-three/fiber';
import { BackSide, DoubleSide, Euler, Matrix4, Path, PlaneGeometry, Quaternion, Shape, ShapeGeometry, Vector3 } from 'three';
import { layoutSkylights } from '../lib/galleryLayout';
import { createContactShade, createSkylitEnvironment } from '../lib/galleryLighting';
import { loadParquet, PARQUET_TILE } from '../lib/parquetFloor';
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

/** The room's walls, each facing into the room from its foot, centred on the room */
const wallsOf = ({ depth, width }) => [
  { length: width, position: [0, -depth / 2], rotation: 0 },
  { length: depth, position: [width / 2, 0], rotation: -Math.PI / 2 },
  { length: width, position: [0, depth / 2], rotation: Math.PI },
  { length: depth, position: [-width / 2, 0], rotation: Math.PI / 2 },
];

/**
 * A wall as flat pieces in its own space (x along it, y up, centred on its
 * foot): the whole wall, or, with a doorway in its middle, the stretches
 * either side and the lintel over the opening. Each piece names the edges
 * where it meets the floor, ceiling or a corner, which are shaded.
 */
function wallPieces(length, doorway) {
  if (!doorway) {
    return [{ edges: ['bottom', 'left', 'right', 'top'], height: WALL_HEIGHT, length, x: 0, y: WALL_HEIGHT / 2 }];
  }
  const side = (length - doorway.width) / 2;
  const sideCentre = doorway.width / 2 + side / 2;
  const lintel = WALL_HEIGHT - doorway.height;
  return [
    { edges: ['bottom', 'left', 'top'], height: WALL_HEIGHT, length: side, x: -sideCentre, y: WALL_HEIGHT / 2 },
    { edges: ['bottom', 'right', 'top'], height: WALL_HEIGHT, length: side, x: sideCentre, y: WALL_HEIGHT / 2 },
    { edges: ['top'], height: lintel, length: doorway.width, x: 0, y: doorway.height + lintel / 2 },
  ];
}

/** A point in a wall's own space, in the room's */
const onWall = ({ position: [wallX, wallZ], rotation }, x, y, out) => [
  wallX + x * Math.cos(rotation) + out * Math.sin(rotation),
  y,
  wallZ - x * Math.sin(rotation) + out * Math.cos(rotation),
];

/**
 * A floor plane whose texture coordinates are world positions in parquet
 * tiles, so the pattern runs on unbroken from room to room; the 0–1
 * coordinates its contact shading needs are kept as uv1.
 */
function floorGeometry({ depth, width, x, z }) {
  const geometry = new PlaneGeometry(width, depth);
  const { position, uv } = geometry.attributes;
  geometry.setAttribute('uv1', uv.clone());
  for (let index = 0; index < uv.count; index += 1) {
    // The plane is laid flat with its y along -z
    uv.setXY(index, (x + position.getX(index)) / PARQUET_TILE, (position.getY(index) - z) / PARQUET_TILE);
  }
  return geometry;
}

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

/** A painted baseboard (a unit box) along the foot of each wall piece that meets the floor, just proud of it */
function baseboardPlacements(walls) {
  return walls.flatMap((wall) =>
    wall.pieces
      .filter(({ edges }) => edges.includes('bottom'))
      .map(({ length, x }) =>
        placed(
          onWall(wall, x, BASEBOARD.height / 2, BASEBOARD.thickness / 2),
          new Quaternion().setFromEuler(new Euler(0, wall.rotation, 0)),
          [length, BASEBOARD.height, BASEBOARD.thickness],
        ),
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

/** The contact shading for the named edges of a wall piece */
const shadeFor = ({ edges, height, length }) =>
  createContactShade(length, height, Object.fromEntries(edges.map((edge) => [edge, WALL_SHADE[edge]])));

const ROOM_EDGES = (shade) => ({ bottom: shade, left: shade, right: shade, top: shade });

/** A room's walls, floor, ceiling and skylights, built for its size and doorway */
function buildRoom(room, doorway) {
  const skylights = layoutSkylights(room);
  const walls = wallsOf(room).map((wall, index) => ({
    ...wall,
    colour: WALL_COLOURS[index],
    pieces: wallPieces(wall.length, index === room.door ? doorway : null).map((piece) => ({
      ...piece,
      shade: shadeFor(piece),
    })),
  }));
  const ceilingShade = createContactShade(room.width, room.depth, ROOM_EDGES(CEILING_SHADE));
  // The ceiling's UVs are its shape's coordinates in metres, centred on the room
  ceilingShade.repeat.set(1 / room.width, 1 / room.depth);
  ceilingShade.offset.set(0.5, 0.5);
  const floorShade = createContactShade(room.width, room.depth, ROOM_EDGES(FLOOR_SHADE));
  floorShade.channel = 1;

  return {
    baseboards: baseboardPlacements(walls),
    ceiling: ceilingGeometry(room, skylights),
    ceilingShade,
    floor: floorGeometry(room),
    floorShade,
    walls,
    ...skylightPlacements(skylights),
  };
}

/** One skylit room: parquet floor, painted drywall with baseboards, frosted skylights */
function Room({ doorway = null, handlers, parquet = null, room }) {
  const built = useMemo(() => buildRoom(room, doorway), [doorway, room]);

  useEffect(
    () => () => {
      [built.ceiling, built.floor].forEach((geometry) => geometry.dispose());
      [built.ceilingShade, built.floorShade, ...built.walls.flatMap(({ pieces }) => pieces.map(({ shade }) => shade))].forEach(
        (texture) => texture.dispose(),
      );
    },
    [built],
  );

  return (
    <group position={[room.x, 0, room.z]}>
      <mesh geometry={built.floor} rotation-x={-Math.PI / 2}>
        {/* A new material once the maps arrive, so three.js compiles it with them */}
        <meshStandardMaterial
          key={parquet ? 'parquet' : 'plain'}
          aoMap={built.floorShade}
          color={parquet ? '#ffffff' : FLOOR_COLOUR}
          roughness={parquet ? 1 : 0.5}
          {...parquet}
        />
      </mesh>
      <group {...handlers}>
        <mesh geometry={built.ceiling} position={[0, WALL_HEIGHT, 0]} rotation-x={Math.PI / 2}>
          <meshStandardMaterial
            aoMap={built.ceilingShade}
            color="#f1f0ec"
            emissive="#f1f0ec"
            emissiveIntensity={CEILING_BOUNCE.own}
            envMapIntensity={CEILING_BOUNCE.environment}
            roughness={0.95}
          />
        </mesh>
        <Instances placements={built.wells}>
          <boxGeometry />
          <meshStandardMaterial color="#f4f3f0" roughness={0.95} side={BackSide} />
        </Instances>
        <Instances placements={built.panes}>
          <planeGeometry />
          <meshBasicMaterial color="#f7f9fc" toneMapped={false} />
        </Instances>
        {built.walls.map(({ colour, pieces, position: [x, z], rotation }) => (
          <group key={colour} position={[x, 0, z]} rotation-y={rotation}>
            {pieces.map((piece) => (
              <mesh key={`${piece.x},${piece.y}`} position={[piece.x, piece.y, 0]}>
                <planeGeometry args={[piece.length, piece.height]} />
                <meshStandardMaterial aoMap={piece.shade} color={colour} roughness={0.92} />
              </mesh>
            ))}
          </group>
        ))}
        <Instances placements={built.baseboards}>
          <boxGeometry />
          <meshStandardMaterial color="#f5f3ef" roughness={0.5} />
        </Instances>
      </group>
    </group>
  );
}

Room.propTypes = {
  doorway: PropTypes.shape({ height: PropTypes.number, width: PropTypes.number }),
  handlers: PropTypes.objectOf(PropTypes.func).isRequired,
  parquet: PropTypes.objectOf(PropTypes.object),
  room: PropTypes.shape({
    depth: PropTypes.number,
    door: PropTypes.number,
    width: PropTypes.number,
    x: PropTypes.number,
    z: PropTypes.number,
  }).isRequired,
};

// Where pinching a doorway counts as walking through it: above where you'd
// look through it at the floor beyond, which teleports you there instead
const DOORWAY_TARGET_FROM = 1;

/**
 * The opening between the gallery and the reading room: its reveal through
 * the wall, a pale stone threshold, and a pinch target that walks you
 * through to the other side.
 */
function Doorway({ doorway, handlers, onPass }) {
  const { height, thickness, width, z } = doorway;
  const middle = z + thickness / 2;

  return (
    <group>
      <group {...handlers}>
        <mesh position={[-width / 2, height / 2, middle]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[thickness, height]} />
          <meshStandardMaterial color={WALL_COLOURS[2]} roughness={0.92} />
        </mesh>
        <mesh position={[width / 2, height / 2, middle]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[thickness, height]} />
          <meshStandardMaterial color={WALL_COLOURS[2]} roughness={0.92} />
        </mesh>
        <mesh position={[0, height, middle]} rotation-x={Math.PI / 2}>
          <planeGeometry args={[width, thickness]} />
          <meshStandardMaterial color={WALL_COLOURS[2]} roughness={0.92} />
        </mesh>
      </group>
      <mesh position={[0, 0.002, middle]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[width, thickness]} />
        <meshStandardMaterial color="#e4e0d8" roughness={0.6} />
      </mesh>
      <mesh
        position={[0, (DOORWAY_TARGET_FROM + height) / 2, middle]}
        onClick={(event) => {
          event.stopPropagation();
          onPass();
        }}
      >
        <planeGeometry args={[width, height - DOORWAY_TARGET_FROM]} />
        <meshBasicMaterial depthWrite={false} opacity={0} side={DoubleSide} transparent />
      </mesh>
    </group>
  );
}

Doorway.propTypes = {
  doorway: PropTypes.shape({
    height: PropTypes.number,
    thickness: PropTypes.number,
    width: PropTypes.number,
    z: PropTypes.number,
  }).isRequired,
  handlers: PropTypes.objectOf(PropTypes.func).isRequired,
  onPass: PropTypes.func.isRequired,
};

/**
 * The building: each room skylit and lit as one, with an oak parquet floor
 * that runs on through the doorway between them. Pinch a bare wall or the
 * ceiling and flick sideways to snap-turn 45 degrees that way; pinch the
 * doorway to walk through it.
 *
 * @param {Array} rooms - from planGallery
 * @param {object} doorway - from planGallery, or null
 */
export function GalleryRooms({ doorway = null, onDoorway, onTurn, rooms }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const flick = useRef(null);
  const [parquet, setParquet] = useState(null);

  useEffect(() => {
    let maps;
    let current = true;
    loadParquet({ anisotropy: gl.capabilities.getMaxAnisotropy() })
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
  }, [gl]);

  // Light every room's standard materials from the first room's skylit environment
  const [firstRoom] = rooms;
  useEffect(() => {
    const environment = createSkylitEnvironment(gl, {
      depth: firstRoom.depth,
      height: WALL_HEIGHT,
      skylights: layoutSkylights(firstRoom),
      width: firstRoom.width,
    });
    scene.environment = environment.texture;
    scene.environmentIntensity = ENVIRONMENT_INTENSITY;
    return () => {
      scene.environment = null;
      environment.dispose();
    };
  }, [firstRoom, gl, scene]);

  const handlers = useMemo(
    () => ({
      /** */
      onPointerDown: (event) => {
        event.stopPropagation();
        event.object.setPointerCapture(event.pointerId);
        flick.current = { heading: rayHeading(event), pointerId: event.pointerId };
      },
      /** */
      onPointerUp: (event) => {
        const start = flick.current;
        if (!start || start.pointerId !== event.pointerId) return;
        flick.current = null;
        event.object.releasePointerCapture(event.pointerId);

        const swing = angleBetween(start.heading, rayHeading(event));
        if (Math.abs(swing) > FLICK_ANGLE) onTurn(Math.sign(swing) * SNAP_TURN);
      },
    }),
    [onTurn],
  );

  return (
    <>
      <directionalLight color="#fffaf3" intensity={0.5} position={SUN_POSITION} />
      {rooms.map((room) => (
        <Room key={room.name} doorway={doorway} handlers={handlers} parquet={parquet} room={room} />
      ))}
      {doorway && <Doorway doorway={doorway} handlers={handlers} onPass={onDoorway} />}
    </>
  );
}

GalleryRooms.propTypes = {
  doorway: PropTypes.shape({ height: PropTypes.number, width: PropTypes.number }),
  onDoorway: PropTypes.func.isRequired,
  onTurn: PropTypes.func.isRequired,
  rooms: PropTypes.arrayOf(PropTypes.object).isRequired,
};
