// Click-to-walk pathfinding: A* over a grid of the walkable area.
// Obstacles are the same circle colliders the physics uses, grown by the walker's radius, so a path
// that clears the grid also clears the physics. The raw grid path is then "string-pulled": corners
// are skipped wherever there's a clear straight line, so Byte walks naturally instead of zig-zagging.

const CELL = 0.8;

export function createNav(getColliders) {
  let grid = null; // { x0, z0, n, blocked: Uint8Array, cx, cz, r, count }

  function build(bounds, radius) {
    const n = Math.ceil((bounds.r * 2) / CELL) + 2;
    const x0 = bounds.x - bounds.r - CELL;
    const z0 = bounds.z - bounds.r - CELL;
    const blocked = new Uint8Array(n * n);
    // Outside the walkable circle counts as blocked.
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = x0 + (i + 0.5) * CELL;
        const z = z0 + (j + 0.5) * CELL;
        if (Math.hypot(x - bounds.x, z - bounds.z) > bounds.r) blocked[j * n + i] = 1;
      }
    }
    // Rasterize each collider (only the ones inside these bounds).
    const cols = getColliders();
    for (const c of cols) {
      const rr = c.r + radius;
      if (Math.hypot(c.x - bounds.x, c.z - bounds.z) > bounds.r + rr) continue;
      const i0 = Math.max(0, Math.floor((c.x - rr - x0) / CELL));
      const i1 = Math.min(n - 1, Math.floor((c.x + rr - x0) / CELL));
      const j0 = Math.max(0, Math.floor((c.z - rr - z0) / CELL));
      const j1 = Math.min(n - 1, Math.floor((c.z + rr - z0) / CELL));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const x = x0 + (i + 0.5) * CELL;
          const z = z0 + (j + 0.5) * CELL;
          if (Math.hypot(x - c.x, z - c.z) < rr) blocked[j * n + i] = 1;
        }
      }
    }
    grid = { x0, z0, n, blocked, key: `${bounds.x},${bounds.z},${bounds.r},${cols.length},${radius}` };
  }

  const cellOf = (x, z) => [Math.floor((x - grid.x0) / CELL), Math.floor((z - grid.z0) / CELL)];
  const free = (i, j) => i >= 0 && j >= 0 && i < grid.n && j < grid.n && !grid.blocked[j * grid.n + i];
  const centre = (i, j) => ({ x: grid.x0 + (i + 0.5) * CELL, z: grid.z0 + (j + 0.5) * CELL });

  // Nearest free cell to (i, j), searching outward in rings.
  function nearestFree(i, j) {
    if (free(i, j)) return [i, j];
    for (let r = 1; r < 40; r++) {
      let best = null;
      let bd = Infinity;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !free(i + di, j + dj)) continue;
          const d = di * di + dj * dj;
          if (d < bd) {
            bd = d;
            best = [i + di, j + dj];
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  // Straight-line walkability between two world points (samples every half cell).
  function clear(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(d / (CELL * 0.5));
    for (let s = 1; s < steps; s++) {
      const k = s / steps;
      const [i, j] = cellOf(a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k);
      if (!free(i, j)) return false;
    }
    return true;
  }

  // Binary heap of [f, index].
  function astar(si, sj, ti, tj) {
    const n = grid.n;
    const N = n * n;
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = [];
    const push = (f, idx) => {
      heap.push([f, idx]);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (heap[p][0] <= heap[c][0]) break;
        [heap[p], heap[c]] = [heap[c], heap[p]];
        c = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let c = 0;
        for (;;) {
          const l = c * 2 + 1;
          const r = l + 1;
          let m = c;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c], heap[m]];
          c = m;
        }
      }
      return top;
    };
    const h = (i, j) => {
      const dx = Math.abs(i - ti);
      const dz = Math.abs(j - tj);
      return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz); // octile distance
    };
    const start = sj * n + si;
    const goal = tj * n + ti;
    g[start] = 0;
    push(h(si, sj), start);
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    while (heap.length) {
      const [, cur] = pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const ci = cur % n;
      const cj = (cur - ci) / n;
      for (const [di, dj, cost] of DIRS) {
        const ni = ci + di;
        const nj = cj + dj;
        if (!free(ni, nj)) continue;
        if (di && dj && (!free(ci + di, cj) || !free(ci, cj + dj))) continue; // no corner cutting
        const idx = nj * n + ni;
        const ng = g[cur] + cost;
        if (ng < g[idx]) {
          g[idx] = ng;
          came[idx] = cur;
          push(ng + h(ni, nj), idx);
        }
      }
    }
    if (came[goal] === -1 && goal !== start) return null;
    const cells = [];
    for (let c = goal; c !== -1; c = came[c]) cells.push(c);
    return cells.reverse().map((c) => centre(c % n, Math.floor(c / n)));
  }

  return {
    // Returns a list of {x, z} waypoints from `from` to (near) `to`, or null if unreachable.
    path(from, to, bounds, radius = 1) {
      const key = `${bounds.x},${bounds.z},${bounds.r},${getColliders().length},${radius}`;
      if (!grid || grid.key !== key) build(bounds, radius);
      const s = nearestFree(...cellOf(from.x, from.z));
      const t = nearestFree(...cellOf(to.x, to.z));
      if (!s || !t) return null;
      const end = free(...cellOf(to.x, to.z)) ? { x: to.x, z: to.z } : centre(...t);
      if (clear(from, end)) return [end];
      const raw = astar(s[0], s[1], t[0], t[1]);
      if (!raw) return null;
      raw[raw.length - 1] = end;
      // String-pull: from each anchor, jump to the farthest point still in straight sight.
      const out = [];
      let anchor = { x: from.x, z: from.z };
      let k = 0;
      while (k < raw.length) {
        let far = k;
        for (let m = raw.length - 1; m > k; m--) {
          if (clear(anchor, raw[m])) {
            far = m;
            break;
          }
        }
        out.push(raw[far]);
        anchor = raw[far];
        k = far + 1;
      }
      return out;
    },
    invalidate() {
      grid = null;
    },
  };
}
