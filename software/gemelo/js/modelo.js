// modelo.js - el ARC Mate 100i hecho con primitivas de three.js.
//
// No hay CAD público del ARC Mate 100i. Las piezas se dibujan a mano con la
// silueta de las fotos de Huber, sobre la cinemática del URDF M-6iB:
// articulaciones exactas, volúmenes estimados (± 2 cm). Todo en mm, en el
// marco base_link (piso en z = 0, X al frente, Z arriba); escena.js lo gira
// a Y arriba y lo escala a metros.
//
// Cada articulación es un grupo con su origen en el eje, igual que el URDF:
//   j1 (0,0,450) en el fijo · j2 (150,0,0) · j3 (0,0,600) · j4 (0,0,100)
//   j5 (615,0,0) · j6 (100,0,0) → brida
// Así las mallas STL del M-6iB (ROS-Industrial) caen en los mismos grupos.
//
// Medidas estimadas (no hay plano): placa base 420 × 420, columna Ø 340
// hasta 320 mm, torreta Ø 350, brazo inferior 95 mm de grueso del lado +Y,
// antebrazo Ø 145 → 115, horquilla de muñeca, brida Ø 80 (ISO 9409-1-50-4-M6
// del M-6i, por confirmar). Motores α: cuerpo cuadrado de 130 mm (αM6) y
// 90 mm (α1) con tapa roja del encoder y conectores en el costado.

import * as THREE from "three";
import { GEO } from "./config.js";

const PI = Math.PI;

// Materiales de un grupo (cada grupo los suyos, para resaltarlo solo)
export function materiales() {
  const m = (color, rough, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  return {
    rojo: m(0x9c2a22, 0.62, 0.05),
    rojoOsc: m(0x7c211b, 0.62, 0.05),
    tapa: m(0xb8302a, 0.45, 0.05),
    negro: m(0x1d1e22, 0.45, 0.25),
    conector: m(0x3b3e44, 0.38, 0.6),
    metal: m(0x9aa0a8, 0.32, 0.85),
    amarillo: m(0xe2b928, 0.5, 0),
    gris: m(0x5b6068, 0.6, 0.2),
  };
}

// ----------------------------------------------------------- primitivas --

function malla(geo, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  return o;
}

// Cilindro con su eje en "x", "y" o "z", centrado en (x,y,z)
function cil(r1, r2, largo, mat, eje = "z", x = 0, y = 0, z = 0, seg = 48) {
  const g = new THREE.CylinderGeometry(r2, r1, largo, seg);     // three: eje Y, r2 arriba
  if (eje === "z") g.rotateX(PI / 2);
  if (eje === "x") g.rotateZ(-PI / 2);
  return malla(g, mat, x, y, z);
}

// Caja con esquinas redondeadas, centrada
function caja(sx, sy, sz, r, mat, x = 0, y = 0, z = 0) {
  r = Math.min(r, sx / 2 - 0.1, sy / 2 - 0.1);
  const b = Math.min(r * 0.6, sz / 2 - 0.1, 6);
  const s = new THREE.Shape();
  const w = sx / 2 - b, h = sy / 2 - b, rr = Math.max(0.1, r - b);
  s.moveTo(-w + rr, -h);
  s.lineTo(w - rr, -h); s.quadraticCurveTo(w, -h, w, -h + rr);
  s.lineTo(w, h - rr); s.quadraticCurveTo(w, h, w - rr, h);
  s.lineTo(-w + rr, h); s.quadraticCurveTo(-w, h, -w, h - rr);
  s.lineTo(-w, -h + rr); s.quadraticCurveTo(-w, -h, -w + rr, -h);
  const g = new THREE.ExtrudeGeometry(s, { depth: sz - 2 * b, bevelEnabled: b > 0.2, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, 0, -(sz - 2 * b) / 2);
  return malla(g, mat, x, y, z);
}

// Placa de perfil libre en el plano XZ, de grueso "grueso" en Y (de y0 a y0 + grueso)
function perfilXZ(dibujar, grueso, y0, mat, bisel = 8) {
  const s = new THREE.Shape();
  dibujar(s);
  const g = new THREE.ExtrudeGeometry(s, { depth: grueso - 2 * bisel, bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 4, curveSegments: 24 });
  g.rotateX(PI / 2);                    // forma (x, y) → (x, z); extrusión → −y
  g.translate(0, y0 + grueso - bisel, 0);
  return malla(g, mat);
}

// Círculo de tornillos sobre una cara
function tornillos(n, rc, rt, alto, mat, eje, centro) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * PI + PI / n;
    const u = Math.cos(a) * rc, v = Math.sin(a) * rc;
    const p = eje === "y" ? [u, 0, v] : eje === "x" ? [0, u, v] : [u, v, 0];
    g.add(cil(rt, rt, alto, mat, eje, ...p, 16));
  }
  g.position.set(...centro);
  return g;
}

// Conector circular MS (cuerpo + rosca + cable que sale)
function conectorMS(r, M, largo = 50) {
  const g = new THREE.Group();
  g.add(cil(r, r, 14, M.conector, "z", 0, 0, 7));
  g.add(cil(r * 0.92, r * 0.92, largo * 0.5, M.negro, "z", 0, 0, 14 + largo * 0.25, 24));
  g.add(cil(r * 0.75, r * 0.6, largo * 0.5, M.negro, "z", 0, 0, 14 + largo * 0.75, 20));
  return g;
}

// Servomotor FANUC α: brida en z = 0, cuerpo hacia +z, tapa roja del encoder
// al final, dos conectores (potencia y encoder) hacia +x local, placa amarilla en −x.
export function motor(lado, largo, M, { conectores = true } = {}) {
  const g = new THREE.Group();
  const r = lado / 2;
  g.add(caja(lado + 14, lado + 14, 12, 10, M.negro, 0, 0, 6));                   // brida
  g.add(caja(lado, lado, largo * 0.72, lado * 0.22, M.negro, 0, 0, 12 + largo * 0.36));
  const zt = 12 + largo * 0.72;
  g.add(cil(r * 0.98, r * 0.98, largo * 0.06, M.negro, "z", 0, 0, zt + largo * 0.03));
  g.add(cil(r * 0.95, r * 0.88, largo * 0.22, M.tapa, "z", 0, 0, zt + largo * 0.06 + largo * 0.11));   // tapa del encoder
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(lado * 0.62, largo * 0.38), M.amarillo);
  placa.rotation.y = -PI / 2;
  placa.rotation.x = PI / 2;
  placa.position.set(-r - 0.6, 0, 12 + largo * 0.36);
  g.add(placa);
  if (conectores) {
    for (const [z, rc] of [[12 + largo * 0.18, lado * 0.13], [12 + largo * 0.52, lado * 0.11]]) {
      const c = conectorMS(rc, M, lado * 0.45);
      c.rotation.y = PI / 2;
      c.position.set(r, 0, z);
      g.add(c);
    }
  }
  return g;
}

// Manguera de cables (corrugada) por una lista de puntos
function manguera(puntos, r, mat) {
  const curva = new THREE.CatmullRomCurve3(puntos.map(p => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curva, 64, r, 14, false), mat);
}

// Etiqueta de texto en una placa (CanvasTexture)
function etiqueta(lineas, ancho, alto, fondo, tinta, fuente) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = Math.round(512 * alto / ancho);
  const x = c.getContext("2d");
  x.fillStyle = fondo; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = tinta; x.textAlign = "center"; x.textBaseline = "middle";
  lineas.forEach((t, i) => {
    x.font = `${i === 0 ? 700 : 500} ${Math.round(c.height / (lineas.length + 1.2))}px ${fuente}`;
    x.fillText(t, c.width / 2, (c.height * (i + 1)) / (lineas.length + 1));
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
}

// ---------------------------------------------------------------- robot --

// Devuelve { raiz, g: [fijo, j1..j6] }. matsDe(i) da los materiales del grupo i (−1 = fijo).
export function construirRobot(matsDe, { etiquetas = true } = {}) {
  const raiz = new THREE.Group();
  const fijo = new THREE.Group(); fijo.name = "fijo";
  const j = [1, 2, 3, 4, 5, 6].map(i => { const g = new THREE.Group(); g.name = "j" + i; return g; });
  raiz.add(fijo);
  fijo.add(j[0]); j[0].position.set(0, 0, GEO.h0);
  j[0].add(j[1]); j[1].position.set(GEO.a1, 0, 0);
  j[1].add(j[2]); j[2].position.set(0, 0, GEO.a2);
  j[2].add(j[3]); j[3].position.set(0, 0, GEO.a3);
  j[3].add(j[4]); j[4].position.set(GEO.d4, 0, 0);
  j[4].add(j[5]); j[5].position.set(GEO.d6, 0, 0);

  // ---- fijo: placa, base, motor J1 y panel de conectores
  {
    const M = matsDe(-1);
    fijo.add(caja(440, 440, 28, 26, M.rojo, 0, 0, 14));
    for (const [x, y] of [[-185, -185], [185, -185], [185, 185], [-185, 185]]) fijo.add(cil(14, 14, 12, M.metal, "z", x, y, 34, 6));
    fijo.add(caja(340, 340, 150, 60, M.rojo, 0, 0, 28 + 75));
    fijo.add(cil(170, 160, 150, M.rojo, "z", 0, 0, 178 + 75 - 20));
    fijo.add(cil(176, 176, 14, M.rojoOsc, "z", 0, 0, 312));
    // Motor J1: vertical detrás de la columna, brida arriba y cuerpo hacia abajo
    const m1 = motor(130, 200, M);
    m1.rotation.x = PI;
    m1.rotation.z = PI;
    m1.position.set(-215, 0, 300);
    fijo.add(m1);
    fijo.add(caja(150, 170, 40, 14, M.rojo, -205, 0, 300));         // soporte del motor
    fijo.add(manguera([[-110, 145, 200], [-150, 120, 330], [-170, 60, 380], [-150, 0, 395]], 24, M.negro));
    // Panel de conectores (Harting) del lado izquierdo-atrás
    fijo.add(caja(150, 120, 180, 14, M.rojo, -110, 200, 28 + 90));
    for (const z of [80, 160]) {
      fijo.add(caja(70, 18, 56, 6, M.conector, -110, 262, z));
      const h = caja(60, 18, 50, 6, M.conector, -110, 266, z);
      fijo.add(h);
      fijo.add(cil(5, 5, 70, M.metal, "x", -110, 276, z + 22, 12));      // estribo
    }
    if (etiquetas) {
      const e1 = etiqueta(["Formet Industries", "St. Thomas, ON"], 100, 46, "#ece9e1", "#222", "Georgia, serif");
      const e2 = etiqueta(["ROBOT #2"], 100, 24, "#15161a", "#f2f2f2", "Arial, sans-serif");
      for (const [e, z] of [[e1, 150], [e2, 95]]) {
        e.rotation.set(PI / 2, -PI / 2, 0);
        e.position.set(-186, 200, z);
        fijo.add(e);
      }
    }
  }

  // ---- J1: torreta, hombro y motor J2
  {
    const M = matsDe(0), g = j[0];
    g.add(cil(176, 176, 70, M.rojo, "z", 0, 0, -130 + 35 - 20));
    g.add(caja(330, 290, 130, 50, M.rojo, 50, -20, -80));
    // reductor de J2 (lado −Y) y tapa del lado +Y
    g.add(cil(118, 118, 160, M.rojo, "y", GEO.a1, -60, 0));
    g.add(cil(92, 92, 20, M.rojoOsc, "y", GEO.a1, -150, 0));
    const m2 = motor(130, 190, M);
    m2.rotation.x = PI / 2;                               // eje del motor hacia −Y
    m2.rotation.y = 0;
    m2.position.set(GEO.a1, -160, 0);
    g.add(m2);
    g.add(tornillos(8, 75, 6, 6, M.metal, "y", [GEO.a1, -160, 0]));
    // tope mecánico y patín del cable
    g.add(caja(70, 60, 50, 10, M.rojoOsc, -60, -60, -10));
    g.add(cil(26, 26, 220, M.negro, "z", -90, 90, -60, 20));
  }

  // ---- J2: brazo inferior curvo, del lado +Y
  {
    const M = matsDe(1), g = j[1];
    const L = GEO.a2;
    g.add(perfilXZ(s => {
      s.moveTo(-108, -10);
      s.bezierCurveTo(-120, 160, -150, 380, -86, L + 10);
      s.absarc(0, L, 86, PI - 0.12, 0.05, true);
      s.bezierCurveTo(80, L - 160, 30, 300, 100, 60);
      s.absarc(0, 0, 108, 0.6, PI + 0.09, true);
    }, 100, 22, M.rojo, 10));
    g.add(cil(96, 96, 22, M.rojoOsc, "y", 0, 128, 0));
    g.add(tornillos(10, 70, 6, 6, M.metal, "y", [0, 141, 0]));
    g.add(cil(78, 78, 22, M.rojoOsc, "y", 0, 128, L));
    // nervio del lado de afuera
    g.add(caja(46, 16, 360, 8, M.rojoOsc, -42, 128, 300));
    // manguera de cables por detrás del brazo, con dos abrazaderas
    g.add(manguera([[-90, 40, -60], [-175, 50, 120], [-185, 55, 330], [-150, 50, 520], [-120, -20, 640]], 22, M.negro));
    for (const z of [180, 430]) g.add(caja(40, 70, 26, 6, M.metal, z === 180 ? -180 : -178, 52, z));
  }

  // ---- J3: carcasa del codo, motor J3 y motores de muñeca atrás
  {
    const M = matsDe(2), g = j[2];
    g.add(cil(100, 100, 128, M.rojo, "y", 0, -42, 0));
    g.add(caja(330, 130, 200, 40, M.rojo, -70, -42, 70));
    g.add(cil(88, 88, 170, M.rojo, "x", 60, 0, GEO.a3));          // raíz del antebrazo (J4)
    // Motor J3: atrás del codo, apuntando a −Y
    g.add(caja(140, 60, 150, 20, M.rojoOsc, -150, -125, 20));
    const m3 = motor(130, 190, M);
    m3.rotation.x = PI / 2;
    m3.position.set(-150, -150, 20);
    g.add(m3);
    // Motores J4, J5, J6 (α1) atrás del antebrazo, apuntando a −X
    g.add(caja(120, 210, 160, 30, M.rojo, -270, 0, GEO.a3 + 10));
    const pos = [[-60, GEO.a3 + 50], [60, GEO.a3 + 50], [0, GEO.a3 - 40]];
    for (const [y, z] of pos) {
      const m = motor(88, 150, M);
      m.rotation.y = -PI / 2;
      m.rotation.z = y < 0 ? PI : 0;
      m.position.set(-330, y, z);
      g.add(m);
    }
  }

  // ---- J4: tubo del antebrazo y horquilla de la muñeca
  {
    const M = matsDe(3), g = j[3];
    g.add(cil(74, 62, 380, M.rojo, "x", 330, 0, 0));
    g.add(cil(80, 80, 30, M.rojoOsc, "x", 150, 0, 0));
    g.add(caja(90, 150, 110, 30, M.rojo, 535, 0, 0));
    for (const y of [-58, 58]) {
      g.add(caja(150, 22, 110, 30, M.rojo, GEO.d4 - 30, y, 0));
      g.add(cil(55, 55, 22, M.rojo, "y", GEO.d4, y, 0));
    }
  }

  // ---- J5: cuerpo de la muñeca
  {
    const M = matsDe(4), g = j[4];
    g.add(cil(50, 50, 94, M.rojo, "y", 0, 0, 0));
    g.add(cil(48, 44, 70, M.rojo, "x", 45, 0, 0));
  }

  // ---- J6: brida
  {
    const M = matsDe(5), g = j[5];
    g.add(cil(40, 40, 16, M.metal, "x", -8, 0, 0));
    g.add(tornillos(4, 25, 3.5, 2, M.negro, "x", [0.5, 0, 0]));
    g.add(cil(3, 3, 3, M.negro, "x", 1, 0, 32, 12));              // pasador
  }

  return { raiz, g: [fijo, ...j] };
}

// -------------------------------------------------------- STL del M-6iB --

// Lector de STL binario o ASCII (sin dependencias)
export function leerSTL(buf) {
  const dv = new DataView(buf);
  const n = dv.getUint32(80, true);
  const pos = [];
  if (84 + n * 50 === buf.byteLength) {
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12;
      for (let k = 0; k < 9; k++) pos.push(dv.getFloat32(o + k * 4, true));
    }
  } else {
    const t = new TextDecoder().decode(buf);
    for (const m of t.matchAll(/vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g)) pos.push(+m[1], +m[2], +m[3]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
