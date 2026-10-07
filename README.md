# Mirador
[![Node.js CI](https://github.com/ProjectMirador/mirador/workflows/Node.js%20CI/badge.svg)](https://github.com/ProjectMirador/mirador/actions/workflows/node.js.yml) [![codecov](https://codecov.io/gh/ProjectMirador/mirador/branch/main/graph/badge.svg)](https://codecov.io/gh/ProjectMirador/mirador) 

## Mirador XR: a WebXR gallery for IIIF

This fork adds an immersive WebXR viewer to Mirador. Open a IIIF manifest in
Mirador, put on a headset, and walk it as a gallery: every image hangs on the
walls of a skylit room, and the books in Mirador's catalogue lie open on
lecterns in a reading room next door, all streamed at the institution's full
archival resolution.

**Try it:** [msitarzewski.github.io/miradorxr](https://msitarzewski.github.io/miradorxr/).
Open it in Safari on Apple Vision Pro, then choose **Enter XR gallery** (the
cube in the left-hand panel) or **View in XR** in a window's top bar.

### In the gallery

- **Walk the room.** Every image in the manifest is hung in order, clockwise,
  starting with the one the window was showing. Beside each work is a wall
  label with its title, details and credit, from the same data as Mirador's
  information panel.
- **Pinch a painting** to walk up to it. Pinch it again to step in close
  (0.55 m) or back to viewing distance (1.5 m). **‹ Previous** and **Next ›**
  step along the wall.
- **Teleport anywhere:** look down at the floor, then pinch and hold where you
  want to stand. Move your pinching hand the way you want to face; pull it
  back towards you to land turned round. Release to go, or raise your hand to
  cancel.
- **Snap turn:** pinch a bare wall or the ceiling and flick sideways to turn
  45°.
- **Relief: On/Off** lights the brushwork as raised paint under a raking
  light.
- **Gloss: On/Off** lets the varnish catch the light. Glints shift as you
  move your head, and differ slightly between your eyes, as real gloss does.
  The two toggles are independent; with both off you see the image exactly as
  published.
- **Leave** with the Digital Crown. Mirador reopens on the work you were at,
  zoomed to the detail you were looking at. A book from the reading room
  opens in its own window, in book view at the pages you were reading.

### In the reading room

- **Walk through the doorway** in the gallery's back wall: pinch it, or
  teleport through it. Each book in Mirador's catalogue lies open on a
  lectern; a collection is shown by its first volume.
- **Read.** Pinch a lectern to walk up to it. Pinch the right-hand page to
  read on and the page turns over; pinch the left-hand page to go back. A
  book that reads right to left turns the other way. **‹ Page** and
  **Page ›** do the same.
- **Paged books open as two-page spreads,** starting with the cover on its
  own; other manifests show one image at a time. The label beside each book
  names it, the pages it's open at, and where it's from.

### Tools

Under the buttons, a second row offers what each work has:

- **Light.** While Relief or Gloss is on, a small lamp hovers by the work.
  Pinch it and drag to swing the raking light round, the way a conservator
  rakes a lamp across a canvas.
- **Notes: On/Off** pins the work's IIIF annotations to it. Pinch a pin to
  read its note on a card, with its region lit. The Bodleian's MS. Arab.
  c. 90 carries English translations of its Arabic, passage by passage.
- **Lens: Off / X-Ray** (or whatever the work's other layers are called)
  shows another layer from a IIIF Choice through a round lens. Pinch and
  drag the painting to move the lens; only the tiles under it are fetched.
- **Compare: On/Off** picks a painting to compare. Pick a second and both
  fly off their walls to float side by side in front of you; **Done
  comparing** sends them back.
- **Search the books,** a button low on your right, opens a keyboard. Type
  and search, and every book with a IIIF Content Search service is searched
  through Mirador. Pinch a result to walk to its book, opened at the page,
  with the match lit.

### Detail and fidelity

- **Full resolution, streamed as IIIF tiles.** The National Gallery of Art's
  van Gogh *Self-Portrait* is 21,687 × 28,273 pixels (613 megapixels). Hung
  1 m tall, that's about 35 µm of painting per pixel.
- **Detail follows your eyes.** Tiles are chosen from the headset's own
  per-eye resolution: each tile is refined until its pixels are as fine as
  the display pixels it covers, seen from where you stand. Lean in and finer
  levels stream in; coarser levels fill in meanwhile, so the image is never
  blank. A thin bar under the frame shows while sharper detail is still
  loading.
- **Measured on Apple Vision Pro** (visionOS 27, Safari 27):
  - 4493 × 3604 pixels per eye, 16× anisotropic filtering, 16384-pixel
    textures.
  - 88 fps with 146 tile meshes, about 300 draw calls.
  - At 0.6 m from a 1 m painting it draws level 5 of 8 (373 tiles, 121 MB).
    The full resolution only becomes resolvable about 7 cm from the canvas.
- **Memory stays bounded.** All works share one tile cache with a 192 MB
  budget and six loads in flight. Tiles out of view aren't fetched, and the
  least recently wanted are evicted first.
- **Relief works at true scale.** It's computed per texel at each tile's real
  size, at 0.6 mm of paint per unit of lightness, so finer tiles show finer
  brushwork while flat areas keep their exact colour. It's an approximation
  from the image's lightness, not measured surface data.
- **Colour is untouched.** Paintings, labels and buttons are drawn unlit and
  without tone mapping, so a work's colours are shown as the institution
  published them. Only the room is lit, with neutral tone mapping.
- **Scale is not yet true.** Every work hangs 1 m tall for now; true
  physical scale from IIIF or museum data is on the roadmap.

### Devices and sources

- **Apple Vision Pro, Safari:** developed and tested here. Input is look and
  pinch (WebXR transient-pointer).
- **Meta Quest Browser:** should work, since it's a standard `immersive-vr`
  session, but it's untested.
- **Desktop browsers:** Mirador works as usual. Entering XR needs a headset,
  or the [IWER](https://github.com/meta-quest/immersive-web-emulation-runtime)
  emulator for development.
- **Image servers must send CORS headers,** because WebGL can't draw
  cross-origin images otherwise. The National Gallery of Art, the Bodleian,
  Gallica, e-codices, the Wellcome Collection and the IIIF Cookbook all
  work. A lectern whose images won't load says so on its label.

### How it's built

- **A set of Mirador plugins** in [`src/xr`](src/xr): entry buttons in the
  workspace panel and window top bar, a Redux reducer for XR state, and a
  three.js stage in the background plugin area.
- **Rendering and tiles:** [three.js](https://threejs.org),
  [React Three Fiber](https://r3f.docs.pmnd.rs) and
  [@react-three/xr](https://pmndrs.github.io/xr). OpenSeadragon's IIIF tile
  source does the tile maths, and image info comes through Mirador's own
  sagas, so IIIF auth still applies.
- **The room:** oak herringbone parquet (a
  [CC0 scan from Poly Haven](src/xr/assets/herringbone-parquet/README.md)),
  painted drywall and frosted skylights. It's lit by an environment map
  rendered from the room itself.

### Developing the XR viewer

Run `npm start` and open [http://127.0.0.1:4444/xr-gallery.html](http://127.0.0.1:4444/xr-gallery.html).
WebXR needs a secure context, so to try changes in a headset, serve the dev
server to it over HTTPS (for example with an HTTPS tunnel). The gallery's
catalogue of manifests is in
[`__tests__/integration/mirador-configs/xr-gallery.js`](__tests__/integration/mirador-configs/xr-gallery.js).
Pushes to `xr/main` deploy to GitHub Pages.

The rest of this README is upstream Mirador's.

## For Mirador Users
We recommend installing Mirador using a JavaScript package manager like [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/).

```sh
$ npm install mirador 

# or

$ yarn add mirador
```

If you are interested in integrating Mirador with plugins into your project, we recommend using vite to integrate the es version of the packages. Examples are here:

[https://github.com/ProjectMirador/mirador-integration](https://github.com/ProjectMirador/mirador-integration)

If you want to simply embed Mirador in an HTML page without further customization, include the Mirador UMD build:

```html
<script src="https://unpkg.com/mirador@latest/dist/mirador.min.js"></script>
```

Be aware that `latest` will at some point switch from version 3 to version 4. If you use Mirador via CDN in a production environment, consider pinning Mirador to version 3 to avoid sudden breaking changes:

```html
<script src="https://unpkg.com/mirador@^3/dist/mirador.min.js"></script>
```


More examples of embedding Mirador can be found at [https://github.com/ProjectMirador/mirador/wiki/M3-Embedding-in-Another-Environment#in-an-html-document-with-javascript](https://github.com/ProjectMirador/mirador/wiki/Embedding-in-Another-Environment).

## Adding translations to Mirador
For help with adding a translation, see [src/locales/README.md](src/locales/README.md)

## Running Mirador locally for development

Mirador local development requires [nodejs](https://nodejs.org/en/download/) to be installed.

1. Run `npm install` to install the dependencies.

### Starting the project

```sh
$ npm start
```

Then navigate to [http://127.0.0.1:4444/](http://127.0.0.1:4444/)

### Instantiating Mirador

```javascript
var miradorInstance = Mirador.viewer({
  id: 'mirador' // id selector where Mirador should be instantiated
});

> miradorInstance
{ actions, store }
```

### Example Action

Add a window:
```javascript
store.dispatch(actions.addWindow());
```

To focus a window run:

```javascript
store.dispatch(actions.focusWindow('window-1'))
```

### Check current state

```javascript
store.getState()
```

## Running the tests
We use Vitest to run our test suite.

```sh
$ npm test
```

You can see the helpful Vitest UI in your browser by running Vitest with the `--ui` flag. To pass the flag through to npm run the following:

```sh
$ npm test -- --ui
```

You can run Vitest without the additional linting and size checks in our `npm test` command. You can also test a single file:
```sh
$ npx vitest __tests__/integration/tests/sequence-switching.test.js --ui
```

## Linting the project

```sh
$ npm run lint
```
## Image Fallback

Mirador automatically displays a simple fallback placeholder when images fail to load. Customize the fallback image via configuration:

```javascript
const config = {
  fallbackImage: 'https://example.com/custom-fallback.jpg',
};
```

The error message is translatable via the `imageFailedToLoad` translation key. Detailed error information is logged to the console for debugging.

## Debugging

### Local instance

The following browser extensions are useful for debugging a local development instance of Mirador:

 - [React DevTools](https://github.com/facebook/react-devtools)
 - [Redux DevTools](https://github.com/zalmoxisus/redux-devtools-extension)

### Test suite

To debug the test suite, run:

```sh
$ npm run test:debug
```

then spin up a [nodejs inspector client](https://nodejs.org/en/docs/guides/debugging-getting-started/#inspector-clients) and set some breakpoints. See [here](https://www.digitalocean.com/community/tutorials/how-to-debug-node-js-with-the-built-in-debugger-and-chrome-devtools#step-3-%E2%80%94-debugging-node-js-with-chrome-devtools) for a guide to debugging with Chrome DevTools.
