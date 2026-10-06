import { Vector3 } from 'three';

/**
 * Uniforms shared by every painting surface in the gallery. `amount` eases
 * between 0 (flat, true colour) and 1 (paint relief shown); `height` is the
 * paint height in metres for a full change in luminance; `light` points from
 * the canvas towards a low raking light at its upper left, in the painting's
 * own space (x right, y up, z out of the canvas). `glossAmount` eases the
 * varnish's glints in and out the same way, independently of the relief;
 * `gloss` and `shininess` are their strength and tightness.
 */
export function createPaintUniforms() {
  return {
    amount: { value: 0 },
    gloss: { value: 0.25 },
    glossAmount: { value: 0 },
    height: { value: 0.0006 },
    light: { value: new Vector3(-0.6, 0.6, 0.45).normalize() },
    shininess: { value: 80 },
  };
}

/**
 * Lights a painting surface as if its paint stood in relief. Brushstroke
 * ridges show in high-resolution scans as fine variations in lightness, so
 * the shader treats lightness as paint height, takes its slope from
 * neighbouring texels, and shades the slope with the raking light. Flat
 * areas keep their exact colour; only ridges and furrows brighten or darken.
 *
 * Because the slope is measured per texel of each tile, finer tiles show
 * finer brushwork: the relief sharpens as you get closer.
 *
 * With gloss on, wherever a slope turns the light towards your eye, the
 * varnish glints. The eye is each eye's own camera, so a glint sits a little
 * differently in each, as the shine on real varnish does, and moves as you
 * move.
 *
 * @param {number} texelSize - metres one texel of this mesh's map covers
 * @param {object} uniforms - from createPaintUniforms
 */
export function applyPaintRelief(material, { texelSize, uniforms }) {
  /* eslint-disable no-param-reassign */
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      paintAmount: uniforms.amount,
      paintGloss: uniforms.gloss,
      paintGlossAmount: uniforms.glossAmount,
      paintHeight: uniforms.height,
      paintLight: uniforms.light,
      paintShininess: uniforms.shininess,
      paintTexelSize: { value: texelSize },
    });
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vPaintToEye;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
// The way to the eye in the painting's own space
vec3 paintRight = normalize(mat3(modelMatrix)[0]);
vec3 paintUp = normalize(mat3(modelMatrix)[1]);
vec3 paintToEye = cameraPosition - (modelMatrix * vec4(transformed, 1.0)).xyz;
vPaintToEye = vec3(dot(paintToEye, paintRight), dot(paintToEye, paintUp), dot(paintToEye, cross(paintRight, paintUp)));`,
      );
    shader.fragmentShader = shader.fragmentShader
      // After map_pars_fragment, which declares the map the helper reads
      .replace(
        '#include <map_pars_fragment>',
        `#include <map_pars_fragment>
uniform float paintAmount;
uniform float paintGloss;
uniform float paintGlossAmount;
uniform float paintHeight;
uniform vec3 paintLight;
uniform float paintShininess;
uniform float paintTexelSize;
varying vec3 vPaintToEye;

#ifdef USE_MAP
float paintLightness(vec2 uv) {
  return dot(texture2D(map, uv).rgb, vec3(0.2126, 0.7152, 0.0722));
}
#endif`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
#ifdef USE_MAP
if (paintAmount > 0.001 || paintGlossAmount > 0.001) {
  vec2 texel = 1.0 / vec2(textureSize(map, 0));
  // v runs down the image; y runs up the painting
  float slopeX = paintHeight * (paintLightness(vMapUv + vec2(texel.x, 0.0)) - paintLightness(vMapUv - vec2(texel.x, 0.0)));
  float slopeY = paintHeight * (paintLightness(vMapUv - vec2(0.0, texel.y)) - paintLightness(vMapUv + vec2(0.0, texel.y)));
  vec3 paintNormal = normalize(vec3(-slopeX, -slopeY, 2.0 * paintTexelSize));
  float shade = clamp(dot(paintNormal, paintLight) / paintLight.z, 0.0, 2.5);
  vec3 paintHalfway = normalize(paintLight + normalize(vPaintToEye));
  float glint = paintGloss * pow(max(dot(paintNormal, paintHalfway), 0.0), paintShininess);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * shade, paintAmount) + glint * paintGlossAmount;
}
#endif`,
      );
  };
  material.customProgramCacheKey = () => 'mirador-xr-paint-relief';
  material.needsUpdate = true;
  /* eslint-enable no-param-reassign */
}
