// Prueba de ida y vuelta: directa → inversa → directa, con la configuración de
// cada pose. Uso: node tools/prueba_cinematica.mjs
import { Cinematica, anguloEntre, interpolarPose } from "../js/cinematica.js";
import { GEO, LIM, HOME, CERO } from "../js/config.js";

const cin = new Cinematica(GEO, LIM);
const fmt = a => a.map(v => v.toFixed(2)).join(", ");
let fallas = 0;
const falla = (...m) => { fallas++; if (fallas <= 10) console.log("FALLA", ...m); };

// 1. Poses conocidas
const p0 = cin.directa(CERO);
console.log("Cero  ", fmt(p0), cin.config(CERO));
const ph = cin.directa(HOME);
console.log("HOME  ", fmt(ph), cin.config(HOME));
const esperado0 = [GEO.a1 + GEO.d4 + GEO.d6, 0, GEO.a2 + GEO.a3];
if (Math.hypot(...[0, 1, 2].map(i => p0[i] - esperado0[i])) > 1e-6) falla("Cero", p0);
if (Math.abs(p0[4] + 90) > 1e-6) falla("P en cero debe ser -90", p0);
if (Math.abs(ph[3] - 180) > 1e-6 && Math.abs(ph[3] + 180) > 1e-6) falla("W en HOME debe ser 180", ph);
// alcance al centro de muñeca
console.log("Alcance (centro de muñeca):", (GEO.a1 + GEO.a2 + Math.hypot(GEO.d4, GEO.a3)).toFixed(1), "mm");

// 2. Aleatorias dentro de límites
let n = 0, maxP = 0, maxO = 0, maxQ = 0, singulares = 0;
const azar = (a, b) => a + Math.random() * (b - a);
for (let k = 0; k < 20000; k++) {
  const q = LIM.min.map((lo, e) => azar(lo, LIM.max[e]));
  const pose = cin.directa(q);
  const cfg = cin.config(q);
  const r = cin.inversa(pose, cfg, q);
  if (!r.ok) {
    if (Math.abs(q[4]) < 1) { singulares++; continue; }
    falla("sin solución", fmt(q), cfg, r.motivo);
    continue;
  }
  n++;
  const p2 = cin.directa(r.q);
  const dp = Math.hypot(...[0, 1, 2].map(i => p2[i] - pose[i]));
  const dO = anguloEntre(pose.slice(3), p2.slice(3));
  maxP = Math.max(maxP, dp); maxO = Math.max(maxO, dO);
  if (dp > 1e-6 || dO > 1e-5) falla("pose", fmt(q), "→", fmt(r.q), dp, dO);
  // Mismos ejes si la muñeca no está en singularidad
  if (Math.abs(q[4]) > 1) {
    const dq = Math.max(...q.map((v, e) => Math.abs(v - r.q[e])));
    maxQ = Math.max(maxQ, dq);
    if (dq > 1e-5) falla("ejes", fmt(q), "→", fmt(r.q), cfg);
  }
  const c2 = cin.config(r.q);
  if (c2.muneca !== cfg.muneca || c2.codo !== cfg.codo || c2.base !== cfg.base) falla("config", cfg, c2);
}
console.log(`Ida y vuelta: ${n} poses · error máx pos ${maxP.toExponential(2)} mm · orient ${maxO.toExponential(2)}° · ejes ${maxQ.toExponential(2)}° · casi singulares saltadas ${singulares}`);

// 3. Las rutinas lineales: cada punto intermedio debe tener solución
import { RUTINAS } from "../js/config.js";
for (const ru of RUTINAS) {
  let prev = null, q = HOME.slice(), mal = 0;
  for (const m of ru.movs) {
    if (m.J) { q = m.J.slice(); prev = cin.directa(q); }
    if (m.L) {
      const A = prev || cin.directa(q);
      for (let t = 0; t <= 1.0001; t += 0.02) {
        const r = cin.inversa(interpolarPose(A, m.L, t), cin.config(q), q);
        if (!r.ok) { mal++; continue; }
        q = r.q;
      }
      prev = m.L;
    }
  }
  console.log(`Rutina ${ru.id}: ${mal ? mal + " puntos sin solución" : "ok"}`);
  if (mal) falla("rutina", ru.id);
}

console.log(fallas ? `${fallas} fallas` : "TODO BIEN");
process.exit(fallas ? 1 : 0);
