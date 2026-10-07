import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Performance helpers: the usual game-engine tricks for a scene built from thousands of small parts.

// Static batching. Every mesh that hasn't moved for a while is baked into world space and merged with
// the others that share its material, inside spatial chunks so frustum culling can still skip whatever
// is off-screen. Thousands of draw calls become a few dozen.
// `before` holds world matrices captured a moment earlier: anything whose matrix changed since then
// (spinning, bobbing, swaying...) is animated and left alone. `exclude` subtrees are never touched.
export function snapshot(scene) {
  const m = new Map();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => m.set(o, { w: o.matrixWorld.clone(), l: o.matrix.clone() }));
  return m;
}

export function batchStatic(scene, before, { exclude = [], cell = 36 } = {}) {
  scene.updateMatrixWorld(true);
  const skip = new Set();
  exclude.forEach((root) => root?.traverse?.((o) => skip.add(o)));
  const groups = new Map();
  const taken = [];
  const tmp = new THREE.Vector3();
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.geometry.isInstancedBufferGeometry || skip.has(o) || Array.isArray(o.material)) return;
    const was = before.get(o);
    if (!was || !was.w.equals(o.matrixWorld)) return; // new or moving: not static
    let visible = true;
    for (let p = o; p; p = p.parent) visible &&= p.visible;
    if (!visible || o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
    const geo = o.geometry;
    const attrs = Object.keys(geo.attributes).sort().join(',');
    if (!geo.attributes.position || geo.morphAttributes.position) return;
    o.getWorldPosition(tmp);
    const key = [o.material.uuid, attrs, geo.index ? 'i' : 'n', o.castShadow, o.receiveShadow, Math.floor(tmp.x / cell), Math.floor(tmp.z / cell)].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  let merged = 0;
  let removed = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map((o) => {
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      // Groups (multi-material ranges) don't survive merging; these meshes use one material anyway.
      g.clearGroups();
      return g;
    });
    const geo = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!geo) continue;
    geo.computeBoundingSphere();
    const src = list[0];
    const mesh = new THREE.Mesh(geo, src.material);
    mesh.castShadow = src.castShadow;
    mesh.receiveShadow = src.receiveShadow;
    mesh.renderOrder = src.renderOrder;
    mesh.name = 'batched';
    scene.add(mesh);
    list.forEach((o) => o.parent.remove(o));
    taken.push(mesh);
    merged++;
    removed += list.length;
  }
  return { merged, removed, meshes: taken };
}

// Adaptive resolution: watch the frame time and nudge the render scale so the game stays smooth
// on weak GPUs (and cool on laptops), and climbs back to full sharpness on strong ones.
export function createGovernor(apply, { max = 1.5, min = 0.6 } = {}) {
  const cap = Math.min(window.devicePixelRatio || 1, max);
  let scale = cap;
  let avg = 16;
  let cool = 0;
  return {
    get pixelRatio() {
      return scale;
    },
    frame(ms) {
      avg += (Math.min(ms, 100) - avg) * 0.05;
      if ((cool -= ms) > 0) return;
      if (avg > 24 && scale > min) {
        scale = Math.max(min, scale - 0.1);
        apply(scale);
        cool = 1500;
      } else if (avg < 14 && scale < cap) {
        scale = Math.min(cap, scale + 0.1);
        apply(scale);
        cool = 3000;
      }
    },
  };
}

// GPU wind for foliage: leaves bend in the vertex shader (higher vertices sway more), so trees stay
// static meshes that can be batched instead of being rotated on the CPU every frame.
export const SWAY_TIME = { value: 0 };
export function gpuSway(material, strength = 0.012) {
  if (material.userData.sway) return material;
  material.userData.sway = true;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    shader.uniforms.uSwayT = SWAY_TIME;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uSwayT;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec4 swW = modelMatrix * vec4(position, 1.0);
         float swH = max(0.0, swW.y - 1.5);
         transformed.x += sin(uSwayT * 1.1 + swW.x * 0.3 + swW.z * 0.2) * ${strength.toFixed(4)} * swH;
         transformed.z += cos(uSwayT * 0.9 + swW.z * 0.3) * ${(strength * 0.8).toFixed(4)} * swH;`
      );
  };
  material.customProgramCacheKey = () => `sway${strength}`;
  material.needsUpdate = true;
  return material;
}

// Rig compaction for things that move as a whole (bots, animals, planes): inside each group, the
// mesh children that never moved relative to their parent are merged by material. A bot's skull,
// face screen, ears and blush become a handful of meshes, while anything animated on its own
// (blinking eyes, spinning rotors, a pulsing core) keeps its own mesh. Tiny parts also stop casting
// shadows, which trims the shadow pass.
export function compactRigs(scene, before, { skip = new Set(), minShadow = 0 } = {}) {
  let removed = 0;
  let added = 0;
  const groups = [];
  scene.traverse((o) => o !== scene && !o.isMesh && o.children.length > 1 && !skip.has(o) && groups.push(o));
  for (const g of groups) {
    let visible = true;
    for (let p = g; p; p = p.parent) visible &&= p.visible;
    if (!visible) continue;
    const buckets = new Map();
    for (const c of g.children) {
      if (!c.isMesh || c.isInstancedMesh || c.children.length || Array.isArray(c.material) || c.geometry.isInstancedBufferGeometry) continue;
      const was = before.get(c);
      if (!was || !was.l.equals(c.matrix) || !c.visible) continue; // animated on its own: keep
      const geo = c.geometry;
      if (!geo.attributes.position || geo.morphAttributes.position) continue;
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      const small = geo.boundingSphere.radius * c.scale.length() / Math.sqrt(3) < minShadow;
      const cast = c.castShadow && !small;
      const key = [c.material.uuid, Object.keys(geo.attributes).sort().join(','), geo.index ? 'i' : 'n', cast, c.receiveShadow, c.renderOrder].join('|');
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({ c, cast });
    }
    for (const list of buckets.values()) {
      if (list.length < 2) {
        if (list[0]) list[0].c.castShadow = list[0].cast;
        continue;
      }
      const geos = list.map(({ c }) => {
        c.updateMatrix();
        const geo = c.geometry.clone().applyMatrix4(c.matrix);
        geo.clearGroups();
        return geo;
      });
      const geo = mergeGeometries(geos, false);
      geos.forEach((x) => x.dispose());
      if (!geo) continue;
      const first = list[0].c;
      const mesh = new THREE.Mesh(geo, first.material);
      mesh.castShadow = list[0].cast;
      mesh.receiveShadow = first.receiveShadow;
      mesh.renderOrder = first.renderOrder;
      g.add(mesh);
      list.forEach(({ c }) => g.remove(c));
      removed += list.length;
      added++;
    }
  }
  return { removed, added };
}
