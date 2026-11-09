/*
 * Koi — a pond drawn in code.
 * Gurjot Singh, 2026.
 *
 * Plain Canvas 2D. No images, no libraries. Each koi is a chain of joints
 * that follows its head; a swimming wave is laid over the chain, then the
 * body is skinned with a few hundred overlapping scales.
 */
(() => {
  'use strict';

  const canvas = document.getElementById('pond');
  const ctx = canvas.getContext('2d', { alpha: false });
  const TAU = Math.PI * 2;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------ helpers */

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const wrap = (a) => {
    a = (a + Math.PI) % TAU;
    if (a < 0) a += TAU;
    return a - Math.PI;
  };

  // Catmull-Rom through p1..p2
  const spline = (p0, p1, p2, p3, t) =>
    0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);

  // Seeded random, so the pond looks the same on every visit
  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function valueNoise(seed) {
    const r = rng(seed);
    const table = new Float32Array(256);
    for (let i = 0; i < 256; i++) table[i] = r();
    const at = (x, y) => table[(x * 73 + y * 151) & 255];
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v);
    };
  }

  /* ------------------------------------------------------------ anatomy */

  const NB = 21;                      // joints along the body
  const NTAIL = 7;                    // extra joints carrying the tail fin
  const NJ = NB + NTAIL;
  const SUB = 4;                      // smooth samples per joint
  const MB = (NB - 1) * SUB + 1;      // samples along the body (81)
  const MS = (NJ - 1) * SUB + 1;      // samples including the tail (109)
  const ROWS = (MB - 1) / 2;          // rows of scales, nose to tail
  const COLS = 4;                     // scales either side of the spine
  const HALF = 0.094;                 // half-width of the body, as a share of length
  const ORBIT = 0.4;                  // radius the pair circle at, as a share of length

  // Half-width of the body from nose (0) to the root of the tail (1)
  const OUTLINE = [
    [0, 0], [0.02, 0.36], [0.05, 0.56], [0.1, 0.76], [0.18, 0.9], [0.3, 1],
    [0.45, 0.96], [0.6, 0.8], [0.75, 0.57], [0.88, 0.36], [1, 0.22],
  ];
  const PROF = new Float32Array(MB);
  for (let k = 0; k < MB; k++) {
    const u = k / (MB - 1);
    let i = 1;
    while (i < OUTLINE.length - 1 && u > OUTLINE[i][0]) i++;
    const a = OUTLINE[i - 1], b = OUTLINE[i];
    PROF[k] = lerp(a[1], b[1], (u - a[0]) / (b[0] - a[0]));
  }

  const INK = [22, 18, 22];

  const SPECS = [
    {
      // gold, with a red hood and a black saddle
      seed: 11,
      body: [[214, 92, 26], [240, 176, 66]],
      patches: [
        { u: 0.05, v: 0, ru: 0.2, rv: 1.7, c: [186, 46, 22], wob: 0.5 },
        { u: 0.335, v: -0.1, ru: 0.095, rv: 1.0, c: INK, wob: 0.9 },
        { u: 0.8, v: 0.5, ru: 0.04, rv: 0.45, c: INK, wob: 0.6 },
      ],
      fin: [247, 232, 204],
      finTint: [230, 146, 62],
      dorsal: [150, 60, 18],
      tail: { len: 0.78, spread: 0.13, rays: 6, rayW: 0.0075, fork: 0.42, web: [226, 156, 82], webA: 0.8, ray: [247, 222, 180] },
    },
    {
      // white butterfly koi with a red cap
      seed: 29,
      body: [[241, 237, 227], [226, 227, 224]],
      patches: [
        { u: 0.09, v: 0, ru: 0.16, rv: 1.05, c: [190, 42, 26], wob: 0.6 },
        { u: 0.66, v: 0.15, ru: 0.1, rv: 0.85, c: [226, 124, 40], wob: 1.0 },
        { u: 0.43, v: -0.7, ru: 0.05, rv: 0.4, c: [226, 124, 40], wob: 0.7 },
        { u: 0.52, v: 0.55, ru: 0.028, rv: 0.3, c: INK, wob: 0.5 },
      ],
      fin: [244, 244, 236],
      finTint: [232, 222, 206],
      dorsal: [150, 152, 150],
      tail: { len: 1, spread: 0.2, rays: 9, rayW: 0.0125, fork: 0.3, web: [168, 180, 178], webA: 0.5, ray: [245, 245, 238] },
    },
  ];

  // Work out every scale once: where it sits on the body and what colour it is.
  function buildScales(spec) {
    const rand = rng(spec.seed * 977);
    const noise = valueNoise(spec.seed);

    const colourAt = (u, v) => {
      let c = mix(spec.body[0], spec.body[1], clamp((u - 0.2) / 0.7, 0, 1));
      for (const p of spec.patches) {
        const du = (u - p.u) / p.ru, dv = (v - p.v) / p.rv;
        const edge = (noise(u * 11 + p.u * 40, v * 2.4 + 7) - 0.5) * p.wob;
        if (du * du + dv * dv + edge < 1) c = p.c;
      }
      return c;
    };

    const scales = [];
    for (let row = ROWS; row >= 0; row--) {          // tail first, so each row overlaps the one behind
      const u = row / ROWS;
      const head = u < 0.2;
      const odd = row & 1;
      for (let c = -COLS - odd; c <= COLS; c++) {
        const v = (c + (odd ? 0.5 : 0)) / COLS;
        const vv = clamp(v, -1, 1);
        const shade = 1 - 0.34 * vv * vv + (head ? 0 : (rand() - 0.5) * 0.13);
        const col = colourAt(u, vv).map((ch) => clamp(ch * shade, 0, 255));
        scales.push({
          k: row * 2,
          v,
          fill: css(col),
          rim: !head,
          rad: head ? 0.03 : 0.0125 + 0.0115 * PROF[row * 2],
        });
      }
    }
    return scales;
  }

  /* ---------------------------------------------------------------- koi */

  class Koi {
    constructor(spec, index) {
      this.spec = spec;
      this.index = index;
      this.jx = new Float32Array(NJ);
      this.jy = new Float32Array(NJ);
      this.rx = new Float32Array(MS);
      this.ry = new Float32Array(MS);
      this.x = new Float32Array(MS);
      this.y = new Float32Array(MS);
      this.tx = new Float32Array(MS);   // unit tangent, pointing toward the nose
      this.ty = new Float32Array(MS);
      this.ang = new Float32Array(MS);
      this.w = new Float32Array(MB);
      this.scales = buildScales(spec);
      this.px = new Float32Array(this.scales.length);
      this.py = new Float32Array(this.scales.length);
      this.phase = index * 2.3;
      this.heading = 0;
      this.boost = 0;
      this.L = 1;
      this.seg = 1;
      const r = rng(spec.seed * 31);
      this.rayJit = Array.from({ length: spec.tail.rays * 2 + 1 }, () => r() - 0.5);
    }

    setLength(L) {
      this.L = L;
      this.seg = L / (NB - 1);
      for (let k = 0; k < MB; k++) this.w[k] = PROF[k] * HALF * L;
    }

    // Lay the fish out along the orbit so nothing snaps on the first frame
    place(cx, cy, angle) {
      const R = this.L * ORBIT;
      for (let i = 0; i < NJ; i++) {
        const a = angle - (i * this.seg) / R;
        this.jx[i] = cx + Math.cos(a) * R;
        this.jy[i] = cy + Math.sin(a) * R;
      }
      this.heading = angle + Math.PI / 2;
    }

    rescale(ox, oy, nx, ny, ratio) {
      for (let i = 0; i < NJ; i++) {
        this.jx[i] = nx + (this.jx[i] - ox) * ratio;
        this.jy[i] = ny + (this.jy[i] - oy) * ratio;
      }
    }

    update(dt, time, cx, cy, other) {
      const L = this.L;
      const hx = this.jx[0], hy = this.jy[0];
      const a = Math.atan2(hy - cy, hx - cx);
      const dist = Math.hypot(hx - cx, hy - cy);
      const R = L * ORBIT * (1 + 0.07 * Math.sin(time * 0.21 + this.index * 2)) * (1 + 0.5 * this.boost);

      // steer for a point a little further round the circle
      const lead = 0.85;
      const want = Math.atan2(cy + Math.sin(a + lead) * R - hy, cx + Math.cos(a + lead) * R - hx);
      const turn = wrap(want - this.heading) * (1 - Math.exp(-dt * 3.2));
      const maxTurn = 2.4 * dt * (1 + this.boost);
      this.heading += clamp(turn, -maxTurn, maxTurn);

      // keep opposite the other fish, hurry when left behind
      const oa = Math.atan2(other.jy[0] - cy, other.jx[0] - cx);
      const gap = wrap(a - oa - Math.PI);
      let speed = L * 0.19 * (1 - 0.35 * Math.sin(gap)) * (1 + 1.7 * this.boost);
      speed *= 1 + 0.6 * clamp(dist / R - 1.3, 0, 1.6);

      this.phase += dt * (3.1 + 4.5 * this.boost) * (0.75 + (0.25 * speed) / (L * 0.19));
      const hd = this.heading + Math.sin(this.phase) * 0.05;
      this.jx[0] += Math.cos(hd) * speed * dt;
      this.jy[0] += Math.sin(hd) * speed * dt;

      // every joint is dragged along behind the one in front
      for (let i = 1; i < NJ; i++) {
        const dx = this.jx[i] - this.jx[i - 1], dy = this.jy[i] - this.jy[i - 1];
        const d = Math.hypot(dx, dy) || 1;
        this.jx[i] = this.jx[i - 1] + (dx / d) * this.seg;
        this.jy[i] = this.jy[i - 1] + (dy / d) * this.seg;
      }

      this.boost *= Math.exp(-dt * 1.1);
    }

    // Turn the joint chain into a smooth spine, then add the swimming wave
    sample() {
      const { jx, jy, rx, ry, x, y, tx, ty, ang } = this;
      for (let k = 0; k < MS; k++) {
        const s = k / SUB;
        const i = Math.min(NJ - 2, s | 0);
        const f = s - i;
        const i0 = Math.max(0, i - 1), i3 = Math.min(NJ - 1, i + 2);
        rx[k] = spline(jx[i0], jx[i], jx[i + 1], jx[i3], f);
        ry[k] = spline(jy[i0], jy[i], jy[i + 1], jy[i3], f);
      }
      const amp = this.L * (0.8 + 0.7 * this.boost);
      for (let k = 0; k < MS; k++) {
        const a = Math.max(0, k - 1), b = Math.min(MS - 1, k + 1);
        const dx = rx[a] - rx[b], dy = ry[a] - ry[b];
        const inv = 1 / (Math.hypot(dx, dy) || 1);
        const u = k / (MB - 1);
        const off = amp * (0.003 + 0.03 * u * u) * Math.sin(this.phase - 6.4 * u);
        x[k] = rx[k] - dy * inv * off;
        y[k] = ry[k] + dx * inv * off;
      }
      for (let k = 0; k < MS; k++) {
        const a = Math.max(0, k - 1), b = Math.min(MS - 1, k + 1);
        const dx = x[a] - x[b], dy = y[a] - y[b];
        const inv = 1 / (Math.hypot(dx, dy) || 1);
        tx[k] = dx * inv;
        ty[k] = dy * inv;
        ang[k] = Math.atan2(dy, dx);
      }
    }

    /* ---- fins sit under the body ---- */

    drawFins() {
      const L = this.L;
      this.drawTail();
      this.drawPair(42, 0.8, 0.115 * L, 0.066 * L, 0.72, 0.12, 1.3);   // pelvic
      this.drawPair(16, 0.84, 0.2 * L, 0.112 * L, 1.02, 0.22, 0);      // pectoral
    }

    drawPair(k, edge, len, wid, sweep, flap, lag) {
      const { x, y, tx, ty, w, spec } = this;
      const fx = tx[k], fy = ty[k];
      const nx = -fy, ny = fx;
      for (let side = -1; side <= 1; side += 2) {
        const bx = x[k] + nx * w[k] * edge * side;
        const by = y[k] + ny * w[k] * edge * side;
        const phi = sweep + flap * Math.sin(this.phase * 0.9 - lag + side * 0.5);
        const dx = -fx * Math.cos(phi) + nx * side * Math.sin(phi);
        const dy = -fy * Math.cos(phi) + ny * side * Math.sin(phi);

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(Math.atan2(dy, dx));
        if (-dy * fx + dx * fy > 0) ctx.scale(1, -1);   // keep the broad leading edge facing forward

        ctx.beginPath();
        ctx.moveTo(-len * 0.06, -wid * 0.1);
        ctx.bezierCurveTo(len * 0.28, -wid * 0.74, len * 0.8, -wid * 0.64, len, -wid * 0.12);
        ctx.bezierCurveTo(len * 1.03, wid * 0.22, len * 0.72, wid * 0.5, len * 0.42, wid * 0.4);
        ctx.bezierCurveTo(len * 0.24, wid * 0.34, len * 0.08, wid * 0.22, -len * 0.06, wid * 0.14);
        ctx.closePath();

        const g = ctx.createLinearGradient(0, 0, len, 0);
        g.addColorStop(0, css(spec.finTint, 0.96));
        g.addColorStop(0.4, css(spec.fin, 0.94));
        g.addColorStop(1, css(spec.fin, 0.74));
        ctx.fillStyle = g;
        ctx.fill();

        ctx.clip();
        ctx.beginPath();
        for (let i = 0; i <= 7; i++) {
          const a = lerp(-0.62, 0.42, i / 7);
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * len * 1.1, Math.sin(a) * len * 1.1);
        }
        ctx.strokeStyle = 'rgba(96,62,36,0.26)';
        ctx.lineWidth = Math.max(0.6, this.L * 0.0026);
        ctx.stroke();
        ctx.restore();
      }
    }

    drawTail() {
      const { x, y, tx, ty, w, L, spec } = this;
      const T = spec.tail;
      const R = T.rays, K = 10;
      const base = MB - 5;
      const span = (MS - 1 - base) * T.len;
      const root = w[base] * 0.85;
      const phase = this.phase;

      const at = (v, s, j) => {
        const f = base + v * span;
        const k = Math.min(MS - 2, f | 0), q = f - k;
        const px = lerp(x[k], x[k + 1], q), py = lerp(y[k], y[k + 1], q);
        const lat = s * (root + T.spread * L * Math.pow(v, 0.8)) + L * 0.012 * v * Math.sin(phase * 1.4 - v * 5 + j * 0.9);
        return [px - ty[k] * lat, py + tx[k] * lat];
      };
      const reach = (j) => {
        const s = Math.abs(j / R);
        return clamp(1 - T.fork * (1 - Math.pow(s, 1.4)) + this.rayJit[j + R] * 0.09, 0.2, 1);
      };

      // the web between the rays, with a scalloped trailing edge
      ctx.beginPath();
      for (let i = 0; i < K; i++) {
        const p = at((reach(-R) * i) / (K - 1), -1, -R);
        if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      }
      for (let j = -R + 1; j <= R; j++) {
        const dip = at(Math.min(reach(j), reach(j - 1)) * 0.86, (j - 0.5) / R, j);
        const tip = at(reach(j), j / R, j);
        ctx.quadraticCurveTo(dip[0], dip[1], tip[0], tip[1]);
      }
      for (let i = K - 2; i >= 0; i--) {
        const p = at((reach(R) * i) / (K - 1), 1, R);
        ctx.lineTo(p[0], p[1]);
      }
      ctx.closePath();
      ctx.fillStyle = css(T.web, T.webA);
      ctx.fill();

      // the rays themselves
      ctx.beginPath();
      for (let j = -R; j <= R; j++) {
        const far = reach(j);
        for (let i = 0; i < K; i++) {
          const p = at((far * i) / (K - 1), j / R, j);
          if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
        }
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = css(T.ray, 0.86);
      ctx.lineWidth = Math.max(1, L * T.rayW);
      ctx.stroke();
    }

    /* ---- body, scales, face ---- */

    drawBody() {
      const { x, y, tx, ty, w, L, spec, ang } = this;
      const e = MB - 1;

      const hull = new Path2D();
      hull.moveTo(x[0], y[0]);
      for (let k = 1; k <= e; k++) hull.lineTo(x[k] - ty[k] * w[k], y[k] + tx[k] * w[k]);
      hull.quadraticCurveTo(
        x[e] - tx[e] * w[e] * 1.6, y[e] - ty[e] * w[e] * 1.6,
        x[e] + ty[e] * w[e], y[e] - tx[e] * w[e]
      );
      for (let k = e - 1; k >= 1; k--) hull.lineTo(x[k] + ty[k] * w[k], y[k] - tx[k] * w[k]);
      hull.closePath();

      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = L * 0.05;
      ctx.fillStyle = css(spec.body[0]);
      ctx.fill(hull);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      ctx.save();
      ctx.clip(hull);

      // scales
      const S = this.scales, n = S.length, px = this.px, py = this.py;
      for (let i = 0; i < n; i++) {
        const s = S[i], k = s.k, lat = s.v * w[k];
        const X = (px[i] = x[k] - ty[k] * lat);
        const Y = (py[i] = y[k] + tx[k] * lat);
        ctx.fillStyle = s.fill;
        ctx.beginPath();
        ctx.arc(X, Y, s.rad * L, 0, TAU);
        ctx.fill();
      }

      // the dark trailing rim of each scale...
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const s = S[i];
        if (!s.rim) continue;
        const a = ang[s.k] + Math.PI, r = s.rad * L;
        ctx.moveTo(px[i] + Math.cos(a - 1.25) * r, py[i] + Math.sin(a - 1.25) * r);
        ctx.arc(px[i], py[i], r, a - 1.25, a + 1.25);
      }
      ctx.lineCap = 'butt';
      ctx.strokeStyle = 'rgba(34,14,6,0.44)';
      ctx.lineWidth = Math.max(0.7, L * 0.0036);
      ctx.stroke();

      // ...and a small catch of light inside it
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const s = S[i];
        if (!s.rim) continue;
        const a = ang[s.k] + Math.PI, r = s.rad * L * 0.56;
        ctx.moveTo(px[i] + Math.cos(a - 0.85) * r, py[i] + Math.sin(a - 0.85) * r);
        ctx.arc(px[i], py[i], r, a - 0.85, a + 0.85);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = Math.max(0.6, L * 0.003);
      ctx.stroke();

      // gill line
      ctx.beginPath();
      ctx.moveTo(x[14] - ty[14] * w[14], y[14] + tx[14] * w[14]);
      ctx.quadraticCurveTo(x[19], y[19], x[14] + ty[14] * w[14], y[14] - tx[14] * w[14]);
      ctx.strokeStyle = 'rgba(20,8,4,0.3)';
      ctx.lineWidth = Math.max(0.8, L * 0.006);
      ctx.stroke();

      // round the body off: darker toward the flanks, a sheen along the back
      ctx.strokeStyle = 'rgba(8,4,2,0.2)';
      ctx.lineWidth = L * HALF;
      ctx.stroke(hull);
      ctx.strokeStyle = 'rgba(8,4,2,0.24)';
      ctx.lineWidth = L * HALF * 0.45;
      ctx.stroke(hull);

      ctx.beginPath();
      ctx.moveTo(x[7], y[7]);
      for (let k = 8; k <= 70; k++) ctx.lineTo(x[k], y[k]);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.085)';
      ctx.lineWidth = L * HALF * 0.85;
      ctx.stroke();
      ctx.lineWidth = L * HALF * 0.32;
      ctx.stroke();
      ctx.restore();

      // dorsal fin, seen edge-on
      ctx.beginPath();
      ctx.moveTo(x[26], y[26]);
      for (let k = 27; k <= 58; k++) ctx.lineTo(x[k], y[k]);
      ctx.strokeStyle = css(spec.dorsal, 0.62);
      ctx.lineWidth = Math.max(1, L * 0.011);
      ctx.stroke();

      // whiskers
      const fx = tx[2], fy = ty[2], nx = -fy, ny = fx;
      ctx.beginPath();
      for (let side = -1; side <= 1; side += 2) {
        const sway = Math.sin(this.phase * 0.8 + side) * 0.014 * L;
        const sx = x[2] + nx * side * w[2] * 0.78, sy = y[2] + ny * side * w[2] * 0.78;
        let len = 0.11 * L;
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(
          sx + fx * len * 0.6 + nx * side * len * 0.2, sy + fy * len * 0.6 + ny * side * len * 0.2,
          sx + fx * (len * 0.12 + sway) + nx * side * len * 0.82, sy + fy * (len * 0.12 + sway) + ny * side * len * 0.82
        );
        len = 0.06 * L;
        const qx = x[1] + nx * side * w[1] * 0.6, qy = y[1] + ny * side * w[1] * 0.6;
        ctx.moveTo(qx, qy);
        ctx.quadraticCurveTo(
          qx + fx * len * 0.8 + nx * side * len * 0.1, qy + fy * len * 0.8 + ny * side * len * 0.1,
          qx + fx * (len * 0.75 - sway * 0.5) + nx * side * len * 0.6, qy + fy * (len * 0.75 - sway * 0.5) + ny * side * len * 0.6
        );
      }
      ctx.strokeStyle = 'rgba(255,248,236,0.92)';
      ctx.lineWidth = Math.max(1, L * 0.0042);
      ctx.stroke();

      // eyes
      const ke = 6, er = Math.max(1.6, L * 0.0105);
      for (let side = -1; side <= 1; side += 2) {
        const ex = x[ke] - ty[ke] * w[ke] * 0.84 * side;
        const ey = y[ke] + tx[ke] * w[ke] * 0.84 * side;
        ctx.beginPath();
        ctx.arc(ex, ey, er, 0, TAU);
        ctx.fillStyle = '#0a0a0c';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,232,196,0.7)';
        ctx.lineWidth = Math.max(0.8, er * 0.3);
        ctx.stroke();
      }
    }
  }

  /* --------------------------------------------------------------- pond */

  const TEALS = [[38, 196, 184], [22, 138, 150], [70, 224, 206], [16, 98, 124]];
  const pond = { brush: [], thin: [], dash: [], bubbles: [] };
  {
    const r = rng(42);
    for (let i = 0; i < 22; i++) {
      pond.brush.push({
        r: lerp(0.12, 0.8, r()), a: r() * TAU, span: lerp(0.22, 0.95, r()),
        w: lerp(0.004, 0.02, r() * r()), c: TEALS[(r() * 4) | 0], al: lerp(0.3, 0.74, r()), sp: lerp(0.5, 1.3, r()),
      });
    }
    for (let i = 0; i < 16; i++) {
      const q = r();
      pond.thin.push({
        r: lerp(0.14, 0.88, r()), a: r() * TAU, span: lerp(0.5, 2.4, r()),
        c: q < 0.24 ? [228, 152, 60] : q < 0.5 ? [222, 240, 236] : TEALS[(r() * 4) | 0],
        al: lerp(0.18, 0.5, r()), sp: lerp(0.4, 1.2, r()),
      });
    }
    for (let i = 0; i < 24; i++) {
      pond.dash.push({ r: lerp(0.2, 0.9, r()), a: r() * TAU, len: lerp(0.012, 0.045, r()), al: lerp(0.25, 0.7, r()), sp: lerp(0.5, 1.4, r()) });
    }
    for (let i = 0; i < 16; i++) {
      pond.bubbles.push({ r: lerp(0.1, 0.82, r()), a: r() * TAU, size: lerp(0.0045, 0.012, r()), sp: lerp(0.3, 1, r()), wob: r() * TAU });
    }
  }

  let W = 0, H = 0, DPR = 1, L = 0, U = 0;
  let bg = null, grain = null, grainSize = 1;
  let cx = 0, cy = 0;                       // the point the pair circle around
  let time = 0, last = 0, spin = 0;
  let grainX = 0, grainY = 0, grainAt = 0;
  let nextDrop = 3;
  const ripples = [];
  const pointer = { x: 0, y: 0, seen: -1e9 };
  const kois = SPECS.map((spec, i) => new Koi(spec, i));

  function paintBackdrop() {
    bg = document.createElement('canvas');
    bg.width = canvas.width;
    bg.height = canvas.height;
    const b = bg.getContext('2d');
    b.scale(DPR, DPR);
    b.fillStyle = '#04070a';
    b.fillRect(0, 0, W, H);

    const glow = (x, y, rad, rgb, alpha) => {
      const g = b.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, css(rgb, alpha));
      g.addColorStop(1, css(rgb, 0));
      b.fillStyle = g;
      b.fillRect(0, 0, W, H);
    };
    glow(W / 2, H / 2, U * 0.85, [14, 66, 78], 0.5);
    glow(W * 0.04, H * 0.97, U * 0.66, [214, 102, 26], 0.5);
    glow(W * 0.13, H * 0.7, U * 0.45, [24, 92, 156], 0.26);
    glow(W * 0.94, H * 0.1, U * 0.5, [18, 120, 122], 0.2);

    const far = Math.hypot(W, H) / 2;
    const v = b.createRadialGradient(W / 2, H / 2, far * 0.45, W / 2, H / 2, far * 1.02);
    v.addColorStop(0, 'rgba(2,4,6,0)');
    v.addColorStop(1, 'rgba(2,4,6,0.78)');
    b.fillStyle = v;
    b.fillRect(0, 0, W, H);
  }

  // A speckle of dark dropouts and the odd bright fleck, like a coarse print
  function makeGrain() {
    const cell = DPR >= 1.5 ? 3 : 2, n = 96;
    const g = document.createElement('canvas');
    g.width = g.height = grainSize = n * cell;
    const gc = g.getContext('2d');
    const r = rng(5);
    for (let yy = 0; yy < n; yy++) {
      for (let xx = 0; xx < n; xx++) {
        const q = r();
        if (q < 0.14) gc.fillStyle = `rgba(3,6,9,${(0.3 + r() * 0.5).toFixed(2)})`;
        else if (q > 0.965) gc.fillStyle = 'rgba(255,255,255,0.07)';
        else continue;
        gc.fillRect(xx * cell, yy * cell, cell, cell);
      }
    }
    grain = ctx.createPattern(g, 'repeat');
  }

  function resize() {
    const oldL = L, ocx = W / 2, ocy = H / 2;
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    while (W * H * DPR * DPR > 5.2e6 && DPR > 1) DPR -= 0.25;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    L = clamp(Math.min(W, H) * 0.58, 150, 640);
    U = L * 2;

    if (!oldL) {
      cx = W / 2;
      cy = H / 2;
      kois.forEach((k, i) => {
        k.setLength(L);
        k.place(cx, cy, -0.9 + i * Math.PI);
      });
    } else {
      const ratio = L / oldL;
      kois.forEach((k) => {
        k.rescale(ocx, ocy, W / 2, H / 2, ratio);
        k.setLength(L);
      });
      cx = W / 2 + (cx - ocx) * ratio;
      cy = H / 2 + (cy - ocy) * ratio;
    }
    paintBackdrop();
    makeGrain();
  }

  function stir(x, y, strength) {
    ripples.push({ x, y, t: 0, k: strength });
    if (strength < 1) return;
    for (const k of kois) {
      const d = Math.hypot(k.jx[0] - x, k.jy[0] - y);
      k.boost = Math.max(k.boost, clamp(1.15 - d / (L * 1.6), 0.25, 1));
    }
  }

  function step(dt, now) {
    const leading = now - pointer.seen < 4500;
    const gx = leading ? clamp(pointer.x, W * 0.12, W * 0.88) : W / 2;
    const gy = leading ? clamp(pointer.y, H * 0.12, H * 0.88) : H / 2;
    const ease = 1 - Math.exp(-dt * 0.9);
    cx += (gx - cx) * ease;
    cy += (gy - cy) * ease;

    spin += dt;
    kois[0].update(dt, time, cx, cy, kois[1]);
    kois[1].update(dt, time, cx, cy, kois[0]);

    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].t += dt / (ripples[i].k < 1 ? 3.4 : 2.6);
      if (ripples[i].t >= 1.4) ripples.splice(i, 1);
    }
    nextDrop -= dt;
    if (nextDrop <= 0) {            // now and then something touches the surface on its own
      const r = Math.random;
      stir(W * (0.1 + 0.8 * r()), H * (0.1 + 0.8 * r()), 0.55);
      nextDrop = 2.5 + r() * 4;
    }
  }

  function drawCurrents() {
    ctx.lineCap = 'round';
    for (const s of pond.brush) {
      const a = s.a + (spin * 0.11 * s.sp * 0.4) / s.r;
      const r = s.r * U;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a, a + s.span);
      ctx.strokeStyle = css(s.c, s.al * 0.5);
      ctx.lineWidth = s.w * U;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r + s.w * U * 0.18, a + s.span * 0.12, a + s.span * 0.8);
      ctx.strokeStyle = css(s.c, s.al);
      ctx.lineWidth = Math.max(1, s.w * U * 0.3);
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(1, U * 0.0016);
    for (const d of pond.dash) {
      const a = d.a + (spin * 0.09 * d.sp * 0.4) / d.r;
      ctx.beginPath();
      ctx.arc(cx, cy, d.r * U, a, a + d.len / d.r);
      ctx.strokeStyle = `rgba(226,238,232,${d.al * 0.55})`;
      ctx.stroke();
    }
  }

  function drawSurface() {
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.8, U * 0.0013);
    for (const s of pond.thin) {
      const a = s.a + (spin * 0.1 * s.sp * 0.4) / s.r;
      ctx.beginPath();
      ctx.arc(cx, cy, s.r * U, a, a + s.span);
      ctx.strokeStyle = css(s.c, s.al * 0.62);
      ctx.stroke();
    }

    ctx.lineWidth = Math.max(1, U * 0.0017);
    for (const b of pond.bubbles) {
      const a = b.a + (spin * 0.07 * b.sp * 0.4) / b.r;
      const r = (b.r + 0.012 * Math.sin(time * 0.6 + b.wob)) * U;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      const rad = Math.max(2, b.size * U);
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, TAU);
      ctx.strokeStyle = 'rgba(232,244,240,0.78)';
      ctx.stroke();
    }

    for (const rp of ripples) {
      for (let ring = 0; ring < 3; ring++) {
        const t = rp.t - ring * 0.16;
        if (t <= 0 || t >= 1) continue;
        const out = 1 - Math.pow(1 - t, 2.4);
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, 6 + out * U * 0.2 * (0.55 + 0.45 * rp.k), 0, TAU);
        ctx.strokeStyle = `rgba(178,238,228,${(Math.pow(1 - t, 1.6) * 0.55 * rp.k).toFixed(3)})`;
        ctx.lineWidth = 0.6 + 1.6 * (1 - t);
        ctx.stroke();
      }
    }
  }

  function draw(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    drawCurrents();
    for (const k of kois) k.sample();
    for (const k of kois) k.drawFins();
    for (const k of kois) k.drawBody();
    drawSurface();

    if (now - grainAt > 110) {
      grainAt = now;
      grainX = (Math.random() * grainSize) | 0;
      grainY = (Math.random() * grainSize) | 0;
    }
    ctx.setTransform(1, 0, 0, 1, grainX, grainY);
    ctx.fillStyle = grain;
    ctx.fillRect(-grainX, -grainY, canvas.width, canvas.height);
  }

  function frame(now) {
    const dt = Math.min(0.034, Math.max(0, (now - last) / 1000)) * (calm ? 0.45 : 1);
    last = now;
    time += dt;
    step(dt, now);
    draw(now);
    requestAnimationFrame(frame);
  }

  /* -------------------------------------------------------------- input */

  canvas.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.seen = performance.now();
  });
  canvas.addEventListener('pointerdown', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.seen = performance.now();
    stir(e.clientX, e.clientY, 1);
  });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { last = performance.now(); });

  if (window.matchMedia('(pointer: coarse)').matches) {
    const hint = document.getElementById('hint');
    if (hint) hint.textContent = 'Drag to lead them · Tap to stir the water';
  }

  resize();
  last = performance.now();
  requestAnimationFrame((now) => {
    document.documentElement.classList.add('ready');
    frame(now);
  });
})();
