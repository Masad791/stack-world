import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Cinematic colour grading for the secret places: split-toned shadows and highlights, a gentle
// contrast curve, saturation, a soft vignette and thin letterbox bars. One texture read per pixel,
// so it costs next to nothing and never softens the image.
//   spirit   - Ghibli green: teal shadows, warm sunlit highlights
//   koi      - soft pastel morning: lifted, creamy, a touch desaturated
//   windmill - golden hour: amber highlights, deep warm contrast
//   shrine   - dusk: violet shadows, rose highlights
//   sakura   - spring: soft pink light, lifted shadows
const GRADES = {
  spirit: { shadow: [0.86, 1.0, 1.04], high: [1.06, 1.03, 0.9], sat: 1.15, contrast: 1.06, lift: 0.015 },
  koi: { shadow: [0.97, 0.98, 1.02], high: [1.04, 1.02, 0.95], sat: 0.92, contrast: 0.96, lift: 0.04 },
  windmill: { shadow: [0.95, 0.9, 0.86], high: [1.1, 1.0, 0.82], sat: 1.12, contrast: 1.1, lift: 0.0 },
  shrine: { shadow: [0.92, 0.88, 1.06], high: [1.08, 0.97, 1.0], sat: 1.1, contrast: 1.05, lift: 0.02 },
  sakura: { shadow: [0.97, 0.93, 1.03], high: [1.07, 0.98, 1.02], sat: 1.08, contrast: 1.02, lift: 0.035 }, // soft spring pink
};

const shader = {
  uniforms: {
    tDiffuse: { value: null },
    uMix: { value: 0 },
    uShadow: { value: new THREE.Vector3(1, 1, 1) },
    uHigh: { value: new THREE.Vector3(1, 1, 1) },
    uSat: { value: 1 },
    uContrast: { value: 1 },
    uLift: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uMix, uSat, uContrast, uLift; uniform vec3 uShadow, uHigh;
    varying vec2 vUv;
    void main() {
      vec3 c = sqrt(max(texture2D(tDiffuse, vUv).rgb, 0.0)); // grade in perceptual space
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      vec3 g = c * mix(uShadow, uHigh, smoothstep(0.1, 0.85, l));
      g = (g - 0.5) * uContrast + 0.5 + uLift;
      g = mix(vec3(dot(g, vec3(0.299, 0.587, 0.114))), g, uSat);
      vec2 q = vUv - 0.5;
      g *= 1.0 - dot(q, q) * 0.55; // vignette
      g = mix(c, clamp(g, 0.0, 1.0), uMix);
      float bar = 0.065 * uMix; // letterbox bars slide in
      g *= step(bar, vUv.y) * step(vUv.y, 1.0 - bar);
      gl_FragColor = vec4(g * g, 1.0); // back to linear for the output pass
    }`,
};

export function createArt() {
  const pass = new ShaderPass(shader);
  const u = pass.uniforms;
  pass.enabled = false;
  let wanted = null;
  let current = null;
  let mix = 0;
  const apply = (name) => {
    const gr = GRADES[name];
    u.uShadow.value.set(...gr.shadow);
    u.uHigh.value.set(...gr.high);
    u.uSat.value = gr.sat;
    u.uContrast.value = gr.contrast;
    u.uLift.value = gr.lift;
    current = name;
  };
  return {
    pass,
    setStyle(name) {
      wanted = GRADES[name] ? name : null;
    },
    setSize() {},
    update(dt) {
      // Switching places: fade the old grade out before easing the new one in.
      const goal = wanted && wanted === current ? 1 : 0;
      mix = THREE.MathUtils.clamp(mix + Math.sign(goal - mix) * dt * 0.8, 0, 1);
      if (mix === 0 && wanted && wanted !== current) apply(wanted);
      u.uMix.value = mix * mix * (3 - 2 * mix);
      pass.enabled = mix > 0.001;
    },
  };
}
