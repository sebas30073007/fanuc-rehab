// cinematica.js - directa e inversa del FANUC de 6 ejes, en la convención de FANUC.
//
// Marco WORLD de FANUC: origen en el eje J1 a la altura del eje J2, X al frente,
// Y a la izquierda, Z arriba; mm y grados. El TCP es el centro de la brida
// (faceplate, sin herramienta). La pose es [x, y, z, w, p, r] con
// R = Rz(r)·Ry(p)·Rx(w) (ángulos fijos XYZ, como el pendant).
//
// Ángulos de eje como los reporta el controlador. Lo único raro es J3: FANUC
// lo mide contra la horizontal (acople J2/J3), así que el giro físico del codo
// respecto al brazo inferior es J3 + J2.
//
// Cadena (mismas medidas y ejes que el URDF fanuc_m6ib de ROS-Industrial):
//   J1  giro en Z
//   J2  (a1, 0, 0)           giro en +Y   (+ inclina el brazo inferior al frente)
//   J3  (0, 0, a2)           giro en −Y   (+ levanta el antebrazo)
//   J4  (0, 0, a3)           giro en −X
//   J5  (d4, 0, 0)           giro en −Y
//   J6  (d6, 0, 0)           giro en −X   → brida
//   herramienta 0 = brida · Ry(−90°) · Rx(180°): su Z sale de la brida.
//
// Inversa analítica (muñeca esférica): centro de muñeca → J1 (frente/atrás) →
// triángulo hombro-codo-muñeca (codo arriba/abajo) → J4-J5-J6 por Euler X-Y-X
// (muñeca N/F). Configuración como en el pendant: "N U T".
//
// Sin dependencias: se usa en la página y en tools/prueba_cinematica.mjs.

export const RAD = Math.PI / 180;
export const GRA = 180 / Math.PI;

// ----------------------------------------------------------- matrices --
// 3×3 por filas: [[a,b,c],[d,e,f],[g,h,i]]

const I3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
export const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
export const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
export const rotZ = a => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
export function mul(A, B) {
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
  return C;
}
export const tr = A => [[A[0][0], A[1][0], A[2][0]], [A[0][1], A[1][1], A[2][1]], [A[0][2], A[1][2], A[2][2]]];
export const mulV = (A, v) => [0, 1, 2].map(i => A[i][0] * v[0] + A[i][1] * v[1] + A[i][2] * v[2]);
const suma = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// Herramienta 0 respecto a la brida
const R_T0 = mul(rotY(-Math.PI / 2), rotX(Math.PI));
const R_T0t = tr(R_T0);

// ----------------------------------------------------------- WPR <-> R --

export function wprAR(w, p, r) {
  return mul(rotZ(r * RAD), mul(rotY(p * RAD), rotX(w * RAD)));
}

export function rAWpr(R) {
  const p = Math.atan2(-R[2][0], Math.hypot(R[0][0], R[1][0]));
  let w, r;
  if (Math.abs(Math.cos(p)) > 1e-7) {
    w = Math.atan2(R[2][1], R[2][2]);
    r = Math.atan2(R[1][0], R[0][0]);
  } else {                                  // P = ±90°: W y R se confunden; R = 0
    r = 0;
    w = Math.atan2(-R[1][2], R[1][1]);
  }
  return [w * GRA, p * GRA, r * GRA];
}

// ------------------------------------------------------------ ángulos --

export const norm180 = a => { a = ((a + 180) % 360 + 360) % 360 - 180; return a === -180 ? 180 : a; };

export class Cinematica {
  // geo: { a1, a2, a3, d4, d6 } en mm · lim: { min: [6], max: [6] } en grados
  constructor(geo, lim) {
    this.g = geo;
    this.lim = lim;
    this.L2 = geo.a2;
    this.L3 = Math.hypot(geo.d4, geo.a3);
    this.fi = Math.atan2(geo.a3, geo.d4);   // el antebrazo sube a3 sobre su eje
  }

  // Ángulos internos (rad) de cada articulación respecto a su padre: J3 físico = J3 + J2
  internos(q) {
    return [q[0], q[1], q[2] + q[1], q[3], q[4], q[5]].map(v => v * RAD);
  }

  // Marcos de cada eje en WORLD: [{ p, R }] para J1..J6, brida y herramienta 0
  marcos(q) {
    const [t1, t2, t3, t4, t5, t6] = this.internos(q);
    const { a1, a2, a3, d4, d6 } = this.g;
    const out = [];
    let R = rotZ(t1), p = [0, 0, 0];
    out.push({ p, R });                                       // J1
    p = suma(p, mulV(R, [a1, 0, 0])); R = mul(R, rotY(t2));
    out.push({ p, R });                                       // J2
    p = suma(p, mulV(R, [0, 0, a2])); R = mul(R, rotY(-t3));
    out.push({ p, R });                                       // J3
    p = suma(p, mulV(R, [0, 0, a3])); R = mul(R, rotX(-t4));
    out.push({ p, R });                                       // J4
    p = suma(p, mulV(R, [d4, 0, 0])); R = mul(R, rotY(-t5));
    out.push({ p, R });                                       // J5 = centro de muñeca
    p = suma(p, mulV(R, [d6, 0, 0])); R = mul(R, rotX(-t6));
    out.push({ p, R });                                       // J6 / brida
    out.push({ p, R: mul(R, R_T0) });                         // herramienta 0
    return out;
  }

  // Pose del TCP [x, y, z, w, p, r] (mm, grados)
  directa(q) {
    const m = this.marcos(q)[6];
    return [...m.p, ...rAWpr(m.R)];
  }

  dentro(q, tol = 1e-6) {
    return q.every((v, e) => v >= this.lim.min[e] - tol && v <= this.lim.max[e] + tol);
  }

  // Configuración de una pose de ejes: { muneca: N|F, codo: U|D, base: T|B }
  config(q) {
    const m = this.marcos(q);
    const w = m[4].p;
    const c1 = Math.cos(q[0] * RAD), s1 = Math.sin(q[0] * RAD);
    const ws = w[0] * c1 + w[1] * s1 - this.g.a1, wz = w[2];
    const t2 = q[1] * RAD, es = this.L2 * Math.sin(t2), ez = this.L2 * Math.cos(t2);
    const cruz = ws * ez - wz * es;
    return {
      muneca: q[4] <= 1e-9 ? "N" : "F",
      codo: cruz * Math.sign(ws || 1) >= 0 ? "U" : "D",
      base: w[0] * c1 + w[1] * s1 >= 0 ? "T" : "B",
    };
  }

  // Todas las soluciones exactas (hasta 8) para la pose; cada una con su
  // configuración y si respeta los límites. qRef sirve para escoger vueltas
  // de J4/J6 y el valor de J1/J4 en singularidades.
  soluciones(pose, qRef = [0, 0, 0, 0, 0, 0]) {
    const [x, y, z, w, p, r] = pose;
    const Rt = wprAR(w, p, r);
    const Rf = mul(Rt, R_T0t);                       // brida
    const { a1, d6 } = this.g;
    // centro de muñeca: la brida está a d6 sobre su eje X
    const pw = [x - d6 * Rf[0][0], y - d6 * Rf[1][0], z - d6 * Rf[2][0]];
    const rxy = Math.hypot(pw[0], pw[1]);
    const sols = [];
    const j1Frente = rxy < 1e-6 ? qRef[0] : Math.atan2(pw[1], pw[0]) * GRA;
    for (const base of ["T", "B"]) {
      const q1 = norm180(base === "T" ? j1Frente : j1Frente + 180);
      const rho = base === "T" ? rxy : -rxy;
      const s = rho - a1, h = pw[2];
      const D2 = s * s + h * h;
      const c = (D2 - this.L2 ** 2 - this.L3 ** 2) / (2 * this.L2 * this.L3);
      if (c < -1 - 1e-9 || c > 1 + 1e-9) continue;
      const cc = Math.max(-1, Math.min(1, c));
      for (const sg of [1, -1]) {
        const d = sg * Math.acos(cc);
        const tu = Math.atan2(h, s) - Math.atan2(this.L3 * Math.sin(d), this.L2 + this.L3 * Math.cos(d));
        const tf = tu + d;
        const q2 = norm180(90 - tu * GRA);
        const q3 = norm180((tf - this.fi) * GRA);
        // muñeca
        const R03 = mul(rotZ(q1 * RAD), rotY(-q3 * RAD));
        const M = mul(tr(R03), Rf);
        for (const mu of ["N", "F"]) {
          let a, b, cx;
          const b0 = Math.acos(Math.max(-1, Math.min(1, M[0][0])));
          if (Math.sin(b0) < 1e-6) {                         // J5 ≈ 0: J4 y J6 en el mismo eje
            b = b0;
            a = -qRef[3] * RAD;
            cx = Math.atan2(M[2][1], M[2][2]) - a;
            if (mu === "F") continue;                       // una sola solución útil
          } else if (mu === "N") {
            b = b0; cx = Math.atan2(M[0][1], M[0][2]); a = Math.atan2(M[1][0], -M[2][0]);
          } else {
            b = -b0; cx = Math.atan2(-M[0][1], -M[0][2]); a = Math.atan2(-M[1][0], M[2][0]);
          }
          const q4 = norm180(-a * GRA), q5 = norm180(-b * GRA), q6 = norm180(-cx * GRA);
          const q = [q1, q2, q3, q4, q5, q6];
          q[3] = this.vuelta(3, q4, qRef[3]);
          q[5] = this.vuelta(5, q6, qRef[5]);
          const cfg = this.config(q);
          sols.push({ q, cfg, dentro: this.dentro(q) });
        }
      }
    }
    return sols;
  }

  // J4 y J6 pasan de ±180: de los equivalentes (±360) dentro del límite, el más cercano a la referencia
  vuelta(e, v, ref) {
    let mejor = v, dm = Infinity;
    for (const k of [-2, -1, 0, 1, 2]) {
      const c = v + 360 * k;
      if (c < this.lim.min[e] - 1e-9 || c > this.lim.max[e] + 1e-9) continue;
      const d = Math.abs(c - ref);
      if (d < dm) { dm = d; mejor = c; }
    }
    return mejor;
  }

  // Solución para una configuración pedida ({ muneca, codo, base }; null = la más cercana).
  // Devuelve { ok, q, cfg, motivo }.
  inversa(pose, cfgPedida, qRef) {
    const sols = this.soluciones(pose, qRef);
    if (!sols.length) return { ok: false, q: null, motivo: "Fuera de alcance" };
    const dist = s => s.q.reduce((t, v, e) => t + Math.abs(v - qRef[e]) * (e < 3 ? 2 : 1), 0);
    let cand = sols;
    if (cfgPedida) {
      cand = sols.filter(s => (!cfgPedida.muneca || s.cfg.muneca === cfgPedida.muneca)
        && (!cfgPedida.codo || s.cfg.codo === cfgPedida.codo)
        && (!cfgPedida.base || s.cfg.base === cfgPedida.base));
      if (!cand.length) return { ok: false, q: null, motivo: `No hay solución ${textoCfg(cfgPedida)}` };
    }
    const validas = cand.filter(s => s.dentro).sort((a, b) => dist(a) - dist(b));
    if (validas.length) return { ok: true, q: validas[0].q, cfg: validas[0].cfg };
    const fuera = cand.sort((a, b) => dist(a) - dist(b))[0];
    const e = fuera.q.findIndex((v, i) => v < this.lim.min[i] - 1e-6 || v > this.lim.max[i] + 1e-6);
    return { ok: false, q: fuera.q, cfg: fuera.cfg, motivo: `J${e + 1} fuera de límite (${fuera.q[e].toFixed(1)}°)` };
  }
}

export const textoCfg = c => `${c.muneca || "·"} ${c.codo || "·"} ${c.base || "·"}`;

// ------------------------------------------------- interpolación lineal --

// Cuaternión de una matriz y vuelta, para interpolar la orientación en L
export function rAQuat(R) {
  const t = R[0][0] + R[1][1] + R[2][2];
  let w, x, y, z;
  if (t > 0) {
    const s = Math.sqrt(t + 1) * 2;
    w = 0.25 * s; x = (R[2][1] - R[1][2]) / s; y = (R[0][2] - R[2][0]) / s; z = (R[1][0] - R[0][1]) / s;
  } else if (R[0][0] > R[1][1] && R[0][0] > R[2][2]) {
    const s = Math.sqrt(1 + R[0][0] - R[1][1] - R[2][2]) * 2;
    w = (R[2][1] - R[1][2]) / s; x = 0.25 * s; y = (R[0][1] + R[1][0]) / s; z = (R[0][2] + R[2][0]) / s;
  } else if (R[1][1] > R[2][2]) {
    const s = Math.sqrt(1 + R[1][1] - R[0][0] - R[2][2]) * 2;
    w = (R[0][2] - R[2][0]) / s; x = (R[0][1] + R[1][0]) / s; y = 0.25 * s; z = (R[1][2] + R[2][1]) / s;
  } else {
    const s = Math.sqrt(1 + R[2][2] - R[0][0] - R[1][1]) * 2;
    w = (R[1][0] - R[0][1]) / s; x = (R[0][2] + R[2][0]) / s; y = (R[1][2] + R[2][1]) / s; z = 0.25 * s;
  }
  return [w, x, y, z];
}

export function quatAR([w, x, y, z]) {
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
}

export function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0) { b = b.map(v => -v); d = -d; }
  if (d > 0.9995) {
    const q = a.map((v, i) => v + (b[i] - v) * t);
    const n = Math.hypot(...q);
    return q.map(v => v / n);
  }
  const th = Math.acos(d), s = Math.sin(th);
  return a.map((v, i) => (v * Math.sin((1 - t) * th) + b[i] * Math.sin(t * th)) / s);
}

// Pose intermedia entre dos poses [x,y,z,w,p,r], t ∈ [0,1]
export function interpolarPose(A, B, t) {
  const p = [0, 1, 2].map(i => A[i] + (B[i] - A[i]) * t);
  const q = slerp(rAQuat(wprAR(A[3], A[4], A[5])), rAQuat(wprAR(B[3], B[4], B[5])), t);
  return [...p, ...rAWpr(quatAR(q))];
}

// Distancia angular (grados) entre dos orientaciones WPR
export function anguloEntre(A, B) {
  const R = mul(tr(wprAR(...A)), wprAR(...B));
  return Math.acos(Math.max(-1, Math.min(1, (R[0][0] + R[1][1] + R[2][2] - 1) / 2))) * GRA;
}
