// config.js - datos del robot y del gemelo.
//
// ROBOT #2 (Formet Industries, St. Thomas, ON): FANUC de 6 ejes de soldadura
// de arco, pintado de rojo, motores α de 1996-2000. Por la silueta (brazo
// inferior curvo, motor de J3 en el codo, motores de muñeca atrás del
// antebrazo, motor de J2 de lado) lo identificamos como ARC Mate 100i
// (= M-6i, controlador RJ2/RJ3). Confianza media: falta leer la placa de
// identificación del robot (en la base, del lado del panel de conectores).
//
// MEDIDAS. Fuente de cada una:
//   a1  150 mm  desfase J1 → J2 (horizontal)          URDF fanuc_m6ib (ROS-I, BSD)
//   a2  600 mm  brazo inferior J2 → J3                 URDF fanuc_m6ib
//   a3  100 mm  J3 → eje del antebrazo (vertical)      URDF fanuc_m6ib
//   d4  615 mm  antebrazo J3 → centro de muñeca (J5)   URDF fanuc_m6ib
//   d6  100 mm  centro de muñeca → brida               URDF fanuc_m6ib
//   h0  450 mm  piso (base) → eje J2                   URDF fanuc_m6ib
// El M-6iB (ARC Mate 100iB) da 150 + 600 + √(615² + 100²) = 1373 mm de
// alcance al centro de muñeca, que es su dato de catálogo. La hoja del ARC
// Mate 100i dice 1368 mm: 5 mm menos (0.4 %), así que el 100i y el 100iB
// comparten la cinemática salvo algún milímetro en el antebrazo. Confirmar
// con $PARAM_GROUP[1].$DH_* del controlador cuando lo tengamos.
//
// LÍMITES y VELOCIDADES: hoja de datos del ARC Mate 100i (copia de
// distribuidor, rabindustries/machinio; verificar con el manual B-81545).
// J3 en convención FANUC (contra la horizontal). No se modela la zona de
// interferencia J2/J3 del manual.
//
// MOTORES: por las placas de las fotos de Huber. J1-J3 αM6/3000
// (A06B-0162-B175, 1.4 kW, 144 V, 6.0 A, 3000 min⁻¹, fecha 96.11); J4-J6
// α1/3000 (A06B-0371-B175, 0.3 kW, 90 V, 2.5 A, 1 N·m, fechas 98.11 y 00.05).
// Vimos tres αM6 (dos en la base, uno en el codo) y dos α1; el tercero de
// la muñeca se supone igual.

export const MODELO = {
  nombre: "FANUC ARC Mate 100i",
  robot: "Robot #2",
  equivalente: "M-6i",
  confianza: "media",
};

export const GEO = { a1: 150, a2: 600, a3: 100, d4: 615, d6: 100, h0: 450 };

export const EJES = ["J1", "J2", "J3", "J4", "J5", "J6"];
export const NOMBRES = ["J1 · giro", "J2 · brazo", "J3 · antebrazo", "J4 · giro muñeca", "J5 · flexión", "J6 · brida"];

export const LIM = {
  min: [-165, -75, -149, -190, -140, -320],
  max: [165, 135, 150, 190, 140, 320],
};
export const VEL_MAX = [120, 120, 120, 360, 360, 450];   // °/s, hoja del ARC Mate 100i
export const CARGA_KG = 6;
export const REPETIBILIDAD = 0.1;                        // mm

export const MOTORES = [
  { eje: "J1", motor: "αM6/3000", parte: "A06B-0162-B175", kw: 1.4, donde: "Base, vertical detrás de la columna", visto: true },
  { eje: "J2", motor: "αM6/3000", parte: "A06B-0162-B175", kw: 1.4, donde: "Costado derecho del hombro", visto: true },
  { eje: "J3", motor: "αM6/3000", parte: "A06B-0162-B175", kw: 1.4, donde: "Codo, por detrás del eje J3", visto: true },
  { eje: "J4", motor: "α1/3000", parte: "A06B-0371-B175", kw: 0.3, donde: "Parte trasera del antebrazo", visto: true },
  { eje: "J5", motor: "α1/3000", parte: "A06B-0371-B175", kw: 0.3, donde: "Parte trasera del antebrazo", visto: true },
  { eje: "J6", motor: "α1/3000", parte: "A06B-0371-B175", kw: 0.3, donde: "Parte trasera del antebrazo", visto: false },
];

// Eslabones para la ficha (mm)
export const ESLABONES = [
  { nombre: "Base → J2", valor: GEO.h0, fuente: "URDF M-6iB" },
  { nombre: "J1 → J2", valor: GEO.a1, fuente: "URDF M-6iB" },
  { nombre: "Brazo inferior", valor: GEO.a2, fuente: "URDF M-6iB" },
  { nombre: "Codo ↑ antebrazo", valor: GEO.a3, fuente: "URDF M-6iB" },
  { nombre: "Antebrazo", valor: GEO.d4, fuente: "URDF M-6iB" },
  { nombre: "Muñeca → brida", valor: GEO.d6, fuente: "URDF M-6iB" },
];

// Poses (grados FANUC)
export const CERO = [0, 0, 0, 0, 0, 0];
export const HOME = [0, 0, 0, 0, -90, 0];                // brida hacia abajo

export const limitar = (e, v) => Math.min(LIM.max[e], Math.max(LIM.min[e], v));

// Herramienta hacia abajo: W 180, P 0, R 0
const ABAJO = [180, 0, 0];

// Rutinas de demostración. Movimientos:
//   { J: [6 ejes] }                     articular, todos llegan a la vez
//   { L: [x,y,z,w,p,r], v: mm/s }       lineal del TCP (inversa en cada paso)
//   { espera: ms }
export const RUTINAS = [
  { id: "HOME", nombre: "HOME", ico: "casa", movs: [{ J: HOME }] },
  { id: "CERO", nombre: "Cero", ico: "mira", titulo: "Todos los ejes en 0°", movs: [{ J: CERO }] },
  { id: "SALUDO", nombre: "Saludo", ico: "mano", movs: [
    { J: [0, 10, 25, 0, -30, 0] },
    { J: [30, 10, 25, 0, 30, 0] }, { J: [-30, 10, 25, 0, -30, 0] },
    { J: [30, 10, 25, 0, 30, 0] }, { J: [0, 10, 25, 0, -30, 0] },
    { J: HOME },
  ] },
  { id: "CORDON", nombre: "Cordón", ico: "pasos", titulo: "Cordón de soldadura recto, lineal a 100 mm/s", movs: [
    { J: HOME },
    { L: [900, -300, 0, ...ABAJO], v: 400 },
    { L: [900, -300, -150, ...ABAJO], v: 150 },
    { espera: 300 },
    { L: [900, 300, -150, ...ABAJO], v: 100 },
    { espera: 300 },
    { L: [900, 300, 0, ...ABAJO], v: 150 },
    { J: HOME },
  ] },
  { id: "CUADRO", nombre: "Cuadro", ico: "pasos", titulo: "Cuadro de 400 mm en lineal, herramienta abajo", movs: [
    { J: HOME },
    { L: [700, -200, 100, ...ABAJO], v: 300 },
    { L: [1000, -200, 100, ...ABAJO], v: 200 },
    { L: [1000, 200, 100, ...ABAJO], v: 200 },
    { L: [700, 200, 100, ...ABAJO], v: 200 },
    { L: [700, -200, 100, ...ABAJO], v: 200 },
    { J: HOME },
  ] },
  { id: "MUNECA", nombre: "Muñeca", ico: "pasos", titulo: "J4, J5 y J6 de punta a punta", movs: [
    { J: [0, 0, 0, 0, -45, 0] },
    { J: [0, 0, 0, 150, -45, 0] }, { J: [0, 0, 0, -150, -45, 0] }, { J: [0, 0, 0, 0, -45, 0] },
    { J: [0, 0, 0, 0, 110, 0] }, { J: [0, 0, 0, 0, -110, 0] },
    { J: [0, 0, 0, 0, -90, 270] }, { J: [0, 0, 0, 0, -90, -270] },
    { J: HOME },
  ] },
];

const CLAVE = "fanuc2.";
export const recordar = {
  get(k, def) { try { const v = localStorage.getItem(CLAVE + k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem(CLAVE + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
};
