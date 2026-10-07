import * as THREE from 'three';

// Falling petals and leaves, entirely on the GPU (one draw call): each one flutters down on its own
// spin, drifts with the wind, settles flat on the ground for a few seconds and fades, then starts
// again somewhere new. `follow` wraps them in a box around the player (autumn leaves everywhere);
// otherwise they stay in a disc over a fixed spot (the cherry trees).
//   shape: 'petal' (rounded, notched tip) or 'leaf' (pointed, with a midrib)
export function createPetals({ count, box, top = 9, size = 0.22, colors, shape = 'petal', follow = false, fall = 0.9 }) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5], 3));
  geo.setIndex([0, 2, 1, 1, 2, 3]);
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(count * 4).map(() => Math.random()), 4));
  geo.instanceCount = count;
  const u = {
    uTime: { value: 0 },
    uAmount: { value: 1 },
    uCenter: { value: new THREE.Vector2() },
    uWind: { value: new THREE.Vector2(0.4, 0.2) },
    uLight: { value: new THREE.Color(1, 1, 1) },
    uBox: { value: box },
    uTop: { value: top },
    uSize: { value: size },
    uFall: { value: fall },
    uC1: { value: new THREE.Color(colors[0]) },
    uC2: { value: new THREE.Color(colors[1]) },
    uC3: { value: new THREE.Color(colors[2]) },
  };
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    defines: { FOLLOW: follow ? 1 : 0, LEAF: shape === 'leaf' ? 1 : 0 },
    vertexShader: `attribute vec4 aSeed;
      uniform float uTime, uAmount, uBox, uTop, uSize, uFall; uniform vec2 uCenter, uWind;
      varying vec2 vUv; varying float vA; varying float vPick; varying float vShade;
      vec2 h2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
      mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
      mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
      mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
      void main() {
        if (fract(aSeed.z * 7.13 + aSeed.y * 3.7) > uAmount) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        float speed = uFall * (0.7 + aSeed.w * 0.6);
        float flight = uTop / speed;
        float rest = 4.0 + aSeed.x * 4.0; // lying on the ground before fading
        float period = flight + rest;
        float tt = uTime + aSeed.z * period * 5.0;
        float cyc = floor(tt / period);
        float local = tt - cyc * period;
        float air = min(local, flight);
        vec2 r = h2(aSeed.xy * 53.1 + cyc * vec2(0.71, 0.37));
        // Flutter: side-to-side swings, stronger for petals than for heavier leaves.
        vec2 sway = vec2(sin(air * 2.1 + aSeed.x * 40.0), cos(air * 1.7 + aSeed.y * 40.0)) * (0.5 + aSeed.w * 0.6);
        vec2 drift = uWind * air + sway;
      #if FOLLOW
        vec2 base = r * uBox;
        vec2 p = uCenter + mod(base + drift - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
        vec2 rel = p - uCenter;
        float edge = clamp((uBox * 0.5 - max(abs(rel.x), abs(rel.y))) / (uBox * 0.15), 0.0, 1.0);
      #else
        float ang = r.x * 6.2832;
        vec2 p = uCenter + vec2(cos(ang), sin(ang)) * sqrt(r.y) * uBox + drift;
        float edge = 1.0;
      #endif
        float y = max(0.06 + aSeed.w * 0.02, uTop - air * speed);
        bool landed = local > flight;
        // Tumbling in the air; lying flat once it lands.
        mat3 R = landed ? rotY(aSeed.x * 6.2832) : rotY(air * (1.5 + aSeed.y * 2.0) + aSeed.x * 6.2832) * rotX(sin(air * (2.0 + aSeed.w * 3.0)) * 1.3) * rotZ(air * (1.0 + aSeed.z * 2.0));
        vec3 local3 = R * (position * vec3(uSize * (0.75 + aSeed.y * 0.5), 1.0, uSize * (LEAF == 1 ? 1.5 : 1.15)));
        vec3 wp = vec3(p.x, y, p.y) + local3;
        vUv = position.xz + 0.5;
        vPick = aSeed.y;
        vShade = 0.75 + 0.25 * abs((R * vec3(0.0, 1.0, 0.0)).y);
        vA = edge * (landed ? 1.0 - smoothstep(rest * 0.55, rest, local - flight) : smoothstep(0.0, 0.6, air));
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `uniform vec3 uC1, uC2, uC3, uLight; varying vec2 vUv; varying float vA; varying float vPick; varying float vShade;
      void main() {
        vec2 q = vUv - 0.5;
      #if LEAF == 1
        // Pointed oval with a darker midrib.
        float w = 0.5 * sin(clamp(vUv.y, 0.0, 1.0) * 3.14159);
        if (abs(q.x) > w * 0.85) discard;
        float rib = 1.0 - (1.0 - smoothstep(0.0, 0.035, abs(q.x))) * 0.35;
      #else
        // Rounded petal with the little notch at its tip.
        float d = length(q * vec2(1.25, 1.0));
        float notch = smoothstep(0.08, 0.0, length(q - vec2(0.0, 0.48)));
        if (d > 0.5 || notch > 0.5) discard;
        float rib = 1.0 - d * 0.35;
      #endif
        vec3 col = vPick < 0.4 ? uC1 : vPick < 0.75 ? uC2 : uC3;
        gl_FragColor = vec4(col * rib * vShade * uLight, vA);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  mesh.frustumCulled = false;
  return { mesh, uniforms: u };
}
