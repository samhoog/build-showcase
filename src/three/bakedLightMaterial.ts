import {
  Color,
  DataTexture,
  type Material,
  Matrix3,
  type MeshStandardMaterial,
  ShaderMaterial,
} from 'three'

// Shader-pack style lighting from light baked into the model at convert time (see
// scripts/lib/bake-light.ts): each vertex carries how much direct sun reaches it and how
// open it is to the sky. The shader only mixes the two, so it costs less than Lambert.

// Shared by every baked material, so the look can be tuned in one place
export const LIGHT = {
  // warm late-afternoon sun, and a softer, slightly cool sky for the shade
  sunColor: { value: new Color(1.0, 0.86, 0.66).multiplyScalar(1.8) },
  skyColor: { value: new Color(0.7, 0.76, 0.88).multiplyScalar(0.62) },
  exposure: { value: 1.0 },
  // the filmic curve mutes colour a little; win it back
  saturation: { value: 1.15 },
}

// light-emitting blocks ignore shadow and stay bright
const GLOWING =
  /glowstone|lantern|torch|shroomlight|froglight|redstone_lamp|jack_o|lava|fire|end_rod|beacon|magma/i

const WHITE = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
WHITE.needsUpdate = true

const vertexShader = /* glsl */ `
  attribute vec2 _light;
  uniform mat3 uvTransform;
  varying vec2 vUv;
  varying vec2 vLight;

  void main() {
    vUv = (uvTransform * vec3(uv, 1.0)).xy;
    vLight = _light;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 diffuse;
  uniform float opacity;
  uniform float cutoff;
  uniform float glow;
  uniform vec3 sunColor;
  uniform vec3 skyColor;
  uniform float exposure;
  uniform float saturation;
  varying vec2 vUv;
  varying vec2 vLight;

  // ACES filmic curve: rich mid-tones, highlights that roll off instead of clipping
  vec3 filmic(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }

  void main() {
    vec4 albedo = vec4(diffuse, opacity) * texture2D(map, vUv);
    if (albedo.a < cutoff) discard;
    // what survives the cutout is solid, as in three's own materials: otherwise leaf and
    // glass edges come out part see-through on the transparent canvas
    #ifdef OPAQUE
      albedo.a = 1.0;
    #endif
    vec3 light = sunColor * vLight.x + skyColor * vLight.y;
    light = max(light, vec3(glow));
    vec3 color = filmic(albedo.rgb * light * exposure);
    color = mix(vec3(dot(color, vec3(0.2126, 0.7152, 0.0722))), color, saturation);
    gl_FragColor = vec4(color, albedo.a);
    #include <colorspace_fragment>
  }
`

export function bakedLightMaterial(source: MeshStandardMaterial): Material {
  const map = source.map ?? WHITE
  map.updateMatrix()
  return new ShaderMaterial({
    name: source.name,
    vertexShader,
    fragmentShader,
    uniforms: {
      ...LIGHT,
      map: { value: map },
      uvTransform: { value: new Matrix3().copy(map.matrix) },
      diffuse: { value: source.color.clone() },
      opacity: { value: source.opacity },
      // the pipeline marks cutouts (leaves, glass) as MASK and real translucency as BLEND
      cutoff: { value: source.alphaTest },
      glow: { value: GLOWING.test(source.name) ? 1.6 : 0 },
    },
    side: source.side,
    transparent: source.transparent,
    depthWrite: !source.transparent,
  })
}
