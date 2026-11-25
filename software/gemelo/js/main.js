// main.js - la página: une escena, controlador (simulado) y paneles.
//
// Igual que en Pólux, la idea central es la REFERENCIA: la pose que pide quien
// controla (rieles, arrastre de piezas, punto o jog cartesiano). Se dibuja
// como el fantasma y se manda al controlador como "J ..." (articular) o
// "L ..." (lineal), a lo más cada 120 ms mientras se arrastra y una vez más
// al soltar. El controlador cambia el destino al vuelo.
//
// En las rutinas la referencia es el destino del movimiento en curso.
// Después de ALTO se pega al real.
//
// Modo Real: pendiente (no hay hardware todavía). Se ve el aviso y el gemelo
// se queda quieto.

import { MODELO, GEO, EJES, NOMBRES, LIM, VEL_MAX, HOME, MOTORES, ESLABONES, RUTINAS, CARGA_KG, REPETIBILIDAD, limitar, recordar } from "./config.js";
import { Cinematica, textoCfg } from "./cinematica.js";
import { Escena } from "./escena.js";
import { Controlador } from "./sim.js";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const MS_ENVIO = 120;
const VEL_JOG = 0.35;          // fracción de la velocidad máxima del eje al sostener ‹ ›

const cin = new Cinematica(GEO, LIM);
const sim = new Controlador(cin);
// Enlace con el robot real: todavía no existe
const REAL = {
  tipo: "real", conectado: false, ocupado: false, q: null,
  async cmd(l) { alLog({ detail: { d: "tx", x: l, t: Date.now() } }); alLog({ detail: { d: "sys", x: "sin enlace con el controlador (pendiente)", t: Date.now() } }); return "ERR SIN_ENLACE"; },
};
let enlace = sim;

let ref = HOME.slice();
let real = sim.q.slice();
let refSigue = { activo: true, hasta: 0 };
let timerEnvio = null, tEnvio = 0, envioPendiente = null;
let jog = null;
let puntoObjetivo = null;     // pose pedida en modo punto (mm, grados)
let paso = 10;

// ------------------------------------------------------------- escena --

const escena = new Escena($("#visor"), {
  alCambiarRef: (q, { final, eje }) => cambiarRef(q, { final, eje, origen: "escena" }),
  alHover: info => mostrarEtiqueta(info),
  alPunto: (p, { final }) => irAPunto(p, final),
});
escena.cargar();
escena.setReal(real);
escena.setRef(ref);
$("#cargando").hidden = true;
$("#nombreRobot").textContent = MODELO.nombre;
document.title = `${MODELO.nombre} · ${MODELO.robot}`;

sim.addEventListener("crudo", alLog);
// Al terminar un movimiento la referencia se pega al real, salvo que alguien
// la esté moviendo todavía (arrastre, riel, jog o un envío por salir)
let rielesActivos = 0;
const manipulando = () => jog || timerEnvio || rielesActivos || escena.arrastre || escena.punto?.arrastrando;
sim.addEventListener("fin", () => { if (!manipulando()) pegarRef(0); pintarChip(); });
sim.addEventListener("ovr", pintarOvr);

// -------------------------------------------------------- referencia --

function puedeMover() { return enlace === sim; }

function pegarRef(ms = 300) {
  refSigue = { activo: true, hasta: performance.now() + ms };
  clearTimeout(timerEnvio);
  timerEnvio = null;
  envioPendiente = null;
  puntoObjetivo = null;
  escena.marcarPunto(null, true);
  pintarAlcance(null);
  ref = real.slice();
  escena.setRef(ref);
}

function cambiarRef(q, { final = false, eje = -1, origen = "", lineal = null } = {}) {
  if (!puedeMover()) { ref = real.slice(); escena.setRef(ref); avisar("Modo Real pendiente: cambia a Digital para mover"); return; }
  refSigue.activo = false;
  if (sim.nombre) sim.alto();                       // tocar algo detiene la rutina
  ref = q.map((v, e) => limitar(e, v));
  escena.setRef(ref);
  if (origen !== "punto" && escena.modo === "punto") { puntoObjetivo = null; escena.marcarPunto(null, true); pintarAlcance(null); }
  marcarActivo(eje);
  envioPendiente = lineal ? `L ${lineal.map(v => v.toFixed(1)).join(" ")} ${textoCfg(cin.config(ref))} 250` : null;
  programarEnvio(final);
}

function programarEnvio(final) {
  if (final) { clearTimeout(timerEnvio); timerEnvio = null; enviar(); return; }
  if (timerEnvio) return;
  const espera = Math.max(0, MS_ENVIO - (performance.now() - tEnvio));
  timerEnvio = setTimeout(() => { timerEnvio = null; enviar(); }, espera);
}

async function enviar() {
  tEnvio = performance.now();
  const linea = envioPendiente || `J ${ref.map(v => (Math.round(v * 100) / 100).toFixed(2)).join(" ")}`;
  envioPendiente = null;
  if (sim.mov?.J && sim.mov.J.every((v, e) => Math.abs(v - ref[e]) < 0.01)) return;
  const r = await enlace.cmd(linea);
  if (r?.startsWith("ERR")) { avisar(r.slice(4)); pegarRef(0); }
}

// ------------------------------------------------------------- punto --

function cfgElegida() {
  return {
    muneca: $("#cfgMuneca .on")?.dataset.v,
    codo: $("#cfgCodo .on")?.dataset.v,
    base: $("#cfgBase .on")?.dataset.v,
  };
}

// p = [x, y, z] mm en WORLD; la orientación se conserva
function irAPunto(p, final) {
  const o = (puntoObjetivo || cin.directa(ref)).slice(3);
  irAPose([...p, ...o], final, "punto");
}

function irAPose(pose, final, origen = "punto", lineal = false) {
  puntoObjetivo = origen === "punto" ? pose : null;
  const r = cin.inversa(pose, cfgElegida(), ref);
  escena.marcarPunto(null, r.ok);
  if (r.ok) {
    cambiarRef(r.q, { final, origen: "punto", lineal: lineal ? pose : null });
    if (origen !== "punto") puntoObjetivo = null;
    pintarAlcance(null);
  } else {
    pintarAlcance(r);
    if (final && origen !== "punto") avisar(r.motivo);
  }
  return r;
}

function pintarAlcance(r) {
  const el = $("#alcance");
  el.textContent = !r || r.ok ? "" : r.motivo;
}

for (const inp of $$(".visor__coords input")) {
  inp.addEventListener("change", () => {
    const pose = cin.directa(ref);
    const v = Number(inp.value);
    if (!Number.isFinite(v)) return;
    pose[Number(inp.dataset.i)] = v;
    const r = irAPose(pose, true, "pastilla");
    if (r.ok) escena.marcarPunto(pose.slice(0, 3), true);
  });
}

// Jog cartesiano: un paso por clic; sostenido repite cada 140 ms (lineal)
const COORD = ["X", "Y", "Z", "W", "P", "R"];
for (let i = 0; i < 6; i++) {
  const c = document.createElement("div");
  c.className = "jc";
  c.innerHTML = `<button class="jog" data-s="-1" aria-label="${COORD[i]} menos">−</button><b>${COORD[i]}</b><button class="jog" data-s="1" aria-label="${COORD[i]} más">+</button>`;
  for (const b of c.querySelectorAll("button")) {
    let rep = null;
    const uno = () => {
      const pose = cin.directa(ref);
      pose[i] += Number(b.dataset.s) * paso;
      const r = irAPose(pose, true, "jog", true);
      if (!r.ok) { avisar(r.motivo); parar(); }
    };
    const parar = () => { clearInterval(rep); rep = null; b.classList.remove("pulsado"); };
    b.addEventListener("pointerdown", ev => {
      if (!puedeMover()) { avisar("Modo Real pendiente"); return; }
      b.setPointerCapture(ev.pointerId);
      b.classList.add("pulsado");
      uno();
      rep = setInterval(uno, 140);
    });
    for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(t, parar);
  }
  $("#jogCart").appendChild(c);
}
$("#segPaso").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  $$("#segPaso button").forEach(x => x.classList.toggle("on", x === b));
  paso = Number(b.dataset.p);
  recordar.set("paso", paso);
});
paso = recordar.get("paso", 10);
$$("#segPaso button").forEach(x => x.classList.toggle("on", Number(x.dataset.p) === paso));

// Configuración: muestra la de la referencia; al cambiarla, el robot se
// reacomoda (articular) a la misma pose con la otra solución
for (const id of ["#cfgMuneca", "#cfgCodo", "#cfgBase"]) {
  $(id).addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b || b.classList.contains("on")) return;
    if (!puedeMover()) { avisar("Modo Real pendiente"); return; }
    $$(id + " button").forEach(x => x.classList.toggle("on", x === b));
    const pose = puntoObjetivo || cin.directa(ref);
    const r = cin.inversa(pose, cfgElegida(), ref);
    if (r.ok) cambiarRef(r.q, { final: true, origen: "punto" });
    else { avisar(r.motivo); pintarCfg(); }
  });
}

function pintarCfg() {
  const c = cin.config(ref);
  for (const [id, v] of [["#cfgMuneca", c.muneca], ["#cfgCodo", c.codo], ["#cfgBase", c.base]]) {
    $$(id + " button").forEach(x => x.classList.toggle("on", x.dataset.v === v));
  }
  $("#cfgActual").textContent = textoCfg(c);
}

// ------------------------------------------------------------ rieles --

const fr = (e, v) => Math.min(1, Math.max(0, (v - LIM.min[e]) / (LIM.max[e] - LIM.min[e])));
const vr = (e, f) => Math.round((LIM.min[e] + Math.min(1, Math.max(0, f)) * (LIM.max[e] - LIM.min[e])) * 10) / 10;

const filas = [0, 1, 2, 3, 4, 5].map(e => {
  const nodo = $("#tplEje").content.firstElementChild.cloneNode(true);
  nodo.querySelector(".eje-nombre").textContent = NOMBRES[e];
  nodo.title = `${MOTORES[e].motor} · ${LIM.min[e]}° … ${LIM.max[e]}° · ${VEL_MAX[e]} °/s`;
  const sl = nodo.querySelector(".sl");
  sl.title = `${fmt(LIM.min[e])} … ${fmt(LIM.max[e])}`;
  sl.setAttribute("aria-label", NOMBRES[e]);
  sl.setAttribute("aria-valuemin", LIM.min[e]);
  sl.setAttribute("aria-valuemax", LIM.max[e]);
  nodo.querySelector(".sl-casa").style.left = fr(e, HOME[e]) * 100 + "%";
  const num = nodo.querySelector(".eje-num");
  num.min = LIM.min[e];
  num.max = LIM.max[e];

  let arrastrando = false;
  const mover = ev => {
    const r = sl.getBoundingClientRect();
    cambiarEje(e, vr(e, (ev.clientX - r.left) / r.width), false);
  };
  sl.addEventListener("pointerdown", ev => {
    if (!puedeMover()) return;
    arrastrando = true;
    rielesActivos++;
    sl.setPointerCapture(ev.pointerId);
    mover(ev);
  });
  sl.addEventListener("pointermove", ev => { if (arrastrando) mover(ev); });
  const fin = () => {
    if (!arrastrando) return;
    arrastrando = false;
    rielesActivos--;
    cambiarRef(ref, { final: true, eje: e });
    marcarActivo(-1);
  };
  sl.addEventListener("pointerup", fin);
  sl.addEventListener("pointercancel", fin);
  sl.addEventListener("keydown", ev => {
    const vis = { ArrowLeft: -1, ArrowRight: 1 }[ev.key];
    if (!vis) return;
    ev.preventDefault();
    cambiarEje(e, ref[e] + vis * (ev.shiftKey ? 10 : 1), true);
  });
  num.addEventListener("change", () => { if (num.value !== "") cambiarEje(e, Number(num.value), true); });

  const jogs = [...nodo.querySelectorAll(".jog")];
  for (const b of jogs) {
    const vis = Number(b.dataset.vis);
    b.addEventListener("pointerdown", ev => {
      if (!puedeMover()) return;
      b.setPointerCapture(ev.pointerId);
      jog = { e, s: vis, boton: b };
      b.classList.add("pulsado");
    });
    for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(t, () => terminarJog(b));
    b.addEventListener("contextmenu", ev => ev.preventDefault());
  }
  $("#ejes").appendChild(nodo);
  return {
    nodo, sl, num, jogs,
    vReal: nodo.querySelector(".v-real"),
    real: nodo.querySelector(".sl-real"),
    ref: nodo.querySelector(".sl-ref"),
    barra: nodo.querySelector(".sl-barra"),
  };
});

function cambiarEje(e, v, final) {
  const q = ref.slice();
  q[e] = v;
  cambiarRef(q, { final, eje: e });
}

function terminarJog(boton) {
  if (!jog || jog.boton !== boton) return;
  boton.classList.remove("pulsado");
  const e = jog.e;
  jog = null;
  cambiarRef(ref, { final: true, eje: e });
  marcarActivo(-1);
}

// El jog adelanta la referencia a una fracción de la velocidad del eje
function avanzarJog(dt) {
  if (!jog) return;
  const q = ref.slice();
  q[jog.e] = limitar(jog.e, q[jog.e] + jog.s * VEL_MAX[jog.e] * VEL_JOG * (sim.ovr / 100) * dt);
  cambiarRef(q, { eje: jog.e });
}

function marcarActivo(eje) {
  filas.forEach((f, e) => f.nodo.classList.toggle("activo", e === eje));
  $$(".fe").forEach((f, e) => f.classList.toggle("activo", e === eje));
}

function pintarRef() {
  filas.forEach((f, e) => {
    f.ref.style.left = fr(e, ref[e]) * 100 + "%";
    f.sl.setAttribute("aria-valuenow", ref[e].toFixed(1));
    if (document.activeElement !== f.num) f.num.value = ref[e].toFixed(1);
  });
  const pose = puntoObjetivo || cin.directa(ref);
  $$(".visor__coords input").forEach(inp => {
    if (document.activeElement !== inp) inp.value = (Math.round(pose[Number(inp.dataset.i)] * 10) / 10).toFixed(Number(inp.dataset.i) < 3 ? 0 : 1);
  });
  escena.ponerTcpRef(cin.directa(ref).slice(0, 3));
  pintarCfg();
}

function pintarReal() {
  filas.forEach((f, e) => {
    const fa = fr(e, real[e]), f0 = fr(e, HOME[e]);
    f.real.style.left = fa * 100 + "%";
    f.barra.style.left = Math.min(fa, f0) * 100 + "%";
    f.barra.style.width = Math.abs(fa - f0) * 100 + "%";
    f.vReal.textContent = fmt(real[e], 1);
  });
  const p = cin.directa(real);
  $("#tcpReal").innerHTML = COORD.map(c => `<dt>${c}</dt>`).join("") + p.map((v, i) => `<dd>${v.toFixed(i < 3 ? 0 : 1)}</dd>`).join("");
  $$(".fe-val").forEach((el, e) => { el.textContent = fmt(real[e], 1); });
}

// Chip: con qué se habla y qué hace
function pintarChip() {
  const chip = $("#chipConexion");
  let est = "on", t;
  if (enlace === REAL) { est = "off"; t = "Real · sin enlace"; }
  else if (sim.ocupado) { est = "run"; t = `Simulación · ${sim.nombre || "Moviendo"}`; }
  else t = "Simulación · Quieto";
  chip.dataset.s = est;
  $("#chipTexto").textContent = t;
}

function actualizarBloqueo() {
  const ok = puedeMover();
  for (const b of $$("[data-rutina]")) b.disabled = !ok;
  for (const f of filas) {
    f.num.disabled = !ok;
    f.jogs.forEach(b => { b.disabled = !ok; });
    f.nodo.classList.toggle("off", !ok);
  }
  $$("#jogCart button").forEach(b => { b.disabled = !ok; });
}

// ----------------------------------------------------------- etiqueta --

let etiquetaEje = -1;
function mostrarEtiqueta(info) {
  etiquetaEje = info ? info.eje : -1;
  $("#etiquetaEje").hidden = etiquetaEje < 0;
  if (!escena.arrastre) marcarActivo(etiquetaEje);
}

function pintarEtiqueta() {
  const el = $("#etiquetaEje");
  const e = escena.arrastre ? escena.arrastre.eje : etiquetaEje;
  if (e < 0 || escena.modo !== "articulaciones") { el.hidden = true; return; }
  el.hidden = false;
  const { x, y } = escena.pantallaDeEje(e);
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.innerHTML = `<b>${NOMBRES[e]}</b> <span class="mono">${fmt(ref[e], 1)}</span> · ${MOTORES[e].motor}`;
}

// ------------------------------------------------------------ ratón --

const raton = { botones: 0, rueda: 0 };
const lienzo3d = $("#visor canvas");
lienzo3d.addEventListener("pointerdown", e => { raton.botones = e.buttons; });
window.addEventListener("pointerup", e => { raton.botones = e.buttons; });
lienzo3d.addEventListener("pointermove", e => { raton.botones = e.buttons; });
lienzo3d.addEventListener("wheel", () => { raton.rueda = performance.now(); }, { passive: true });
lienzo3d.addEventListener("contextmenu", e => e.preventDefault());

function pintarRaton() {
  const on = raton.botones | (performance.now() - raton.rueda < 250 ? 4 : 0);
  for (const el of $$("#raton [data-b]")) el.classList.toggle("on", (on & Number(el.dataset.b)) !== 0);
  let izq = "Orbitar";
  const e = escena.arrastre ? escena.arrastre.eje : escena.hover;
  if (escena.modo === "articulaciones" && e >= 0) izq = `Girar ${EJES[e]}`;
  if (escena.modo === "punto" && escena.punto?.tc.axis) izq = "Mover TCP";
  $("#ratonIzq").textContent = izq;
}

// ------------------------------------------------------------ cuadro --

let tPrev = performance.now();
function cuadro(t) {
  const dt = Math.min(0.1, (t - tPrev) / 1000);
  tPrev = t;
  avanzarJog(dt);
  if (enlace === sim) {
    sim.tick(dt);
    real = sim.q.slice();
    if (sim.nombre && sim.destino) ref = sim.destino.slice();
    else if (refSigue.activo && !sim.ocupado && performance.now() > refSigue.hasta) refSigue.activo = false;
    if (refSigue.activo) ref = real.slice();
    // El robot siempre alcanza a la referencia: si quedó un valor sin mandar, se manda
    else if (!sim.ocupado && !manipulando() && performance.now() - tEnvio > 300 && ref.some((v, e) => Math.abs(v - real[e]) > 0.05)) enviar();
  }
  escena.setReal(real);
  escena.setRef(ref);
  pintarRef();
  pintarReal();
  pintarChip();
  pintarEtiqueta();
  pintarRaton();
  requestAnimationFrame(cuadro);
}
requestAnimationFrame(cuadro);

// ------------------------------------------------------------ acciones --

function alto() {
  jog = null;
  $$(".jog.pulsado").forEach(b => b.classList.remove("pulsado"));
  if (enlace === sim) sim.cmd("STOP");
  pegarRef(400);
}
$("#bAlto").addEventListener("click", alto);
window.addEventListener("keydown", e => {
  if (e.key === "Escape") { e.preventDefault(); alto(); cerrarAjustes(); }
});

// Rutinas
const ICONO = { HOME: "casa", CERO: "mira", SALUDO: "mano", CORDON: "linea", CUADRO: "cuadro", MUNECA: "muneca" };
for (const ru of RUTINAS) {
  const b = document.createElement("button");
  b.className = "accion";
  b.dataset.rutina = ru.id;
  b.title = ru.titulo || ru.nombre;
  b.innerHTML = `<span class="accion__ico"><svg class="ico" aria-hidden="true"><use href="#i-${ICONO[ru.id] || "pasos"}"/></svg></span>`;
  b.append(ru.nombre);
  b.addEventListener("click", async () => {
    if (!puedeMover()) { avisar("Modo Real pendiente"); return; }
    refSigue.activo = false;
    const r = await sim.cmd(ru.id === "HOME" || ru.id === "CERO" ? ru.id : "RUTINA " + ru.id);
    if (r.startsWith("ERR")) avisar(r);
  });
  $("#rutinasBotones").appendChild(b);
}

function pintarOvr() {
  $("#ovr").value = sim.ovr;
  $("#ovrTexto").textContent = sim.ovr + " %";
}
$("#ovr").addEventListener("input", e => { $("#ovrTexto").textContent = e.target.value + " %"; });
$("#ovr").addEventListener("change", e => sim.cmd("OVR " + e.target.value));
pintarOvr();

// Digital | Real
$("#segModo").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b || b.classList.contains("on")) return;
  $$("#segModo button").forEach(x => {
    x.classList.toggle("on", x === b);
    x.setAttribute("aria-checked", x === b);
  });
  if (b.dataset.modo === "digital") {
    enlace = sim;
    sim.ponerEn(real);
  } else {
    sim.alto();
    enlace = REAL;
    alLog({ detail: { d: "sys", x: "Modo Real: pendiente, todavía no hay enlace con el controlador", t: Date.now() } });
  }
  jog = null;
  pegarRef(0);
  $("#puerto").hidden = enlace !== REAL;
  $("#visorVacio").hidden = enlace !== REAL;
  $("#ajustesSim").hidden = enlace === REAL;
  pintarFuenteTerminal();
  actualizarBloqueo();
});

$("#segInteraccion").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  $$("#segInteraccion button").forEach(x => {
    x.classList.toggle("on", x === b);
    x.setAttribute("aria-checked", x === b);
  });
  escena.setModo(b.dataset.i);
  puntoObjetivo = null;
  pintarAlcance(null);
});

$("#bEncuadrar").addEventListener("click", () => escena.encuadrar());

// ----------------------------------------------------------- ajustes --

$("#segTiempo").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  $$("#segTiempo button").forEach(x => x.classList.toggle("on", x === b));
  sim.escala = Number(b.dataset.x);
});

async function ponerModelo(m) {
  $$("#segModelo button").forEach(x => x.classList.toggle("on", x.dataset.m === m));
  if (m === "m6ib") {
    try { await escena.cargarM6ib(); } catch (err) { avisar("No se pudieron cargar las mallas del M-6iB"); console.error(err); return; }
  }
  escena.verModelo(m);
  recordar.set("modelo", m);
}
$("#segModelo").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (b) ponerModelo(b.dataset.m);
});
{
  const pm = new URLSearchParams(location.search).get("modelo");
  if ((pm || recordar.get("modelo", "rojo")) === "m6ib") ponerModelo("m6ib");
}

// ------------------------------------------------------------- ficha --

function pintarFicha() {
  const alcance = GEO.a1 + GEO.a2 + Math.hypot(GEO.d4, GEO.a3);
  $("#confianza").textContent = `Identificación: confianza ${MODELO.confianza}`;
  const filasR = [
    ["Modelo", `${MODELO.nombre} <small>≈ ${MODELO.equivalente}</small>`],
    ["Robot", `${MODELO.robot} <small>Formet, St. Thomas ON</small>`],
    ["Alcance", `1368 mm <small>hoja · ${alcance.toFixed(0)} en el modelo</small>`],
    ["Carga", `${CARGA_KG} kg`],
    ["Repetibilidad", `± ${REPETIBILIDAD} mm`],
    ["Controlador", `RJ2 / RJ3 <small>por confirmar</small>`],
  ];
  $("#datosRobot").innerHTML = filasR.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  $("#tablaEjes").innerHTML = MOTORES.map((m, e) => `
    <div class="fe" data-eje="${e}">
      <b>${EJES[e]}</b>
      <span class="fe-motor">${m.motor}<small>${m.kw} kW${m.visto ? "" : " · supuesto"}</small></span>
      <span class="fe-val"></span>
      <span class="fe-sub">${m.parte} · ${LIM.min[e]}° … ${LIM.max[e]}° · ${VEL_MAX[e]} °/s · ${m.donde}</span>
    </div>`).join("");
  $("#datosEslabones").innerHTML = ESLABONES.map(s => `<dt>${s.nombre}</dt><dd>${s.valor}<small>${s.fuente}</small></dd>`).join("");
}
pintarFicha();

// ---------------------------------------------------------- terminal --

const consola = $("#consola");
const MAX_LINEAS = 1500;
const term = { cola: [], sondeo: false, pausa: false, pendiente: false };

function alLog(ev) {
  term.cola.push(ev.detail);
  if (term.cola.length > MAX_LINEAS) term.cola.splice(0, term.cola.length - MAX_LINEAS);
  if (!term.pausa && !term.pendiente) { term.pendiente = true; requestAnimationFrame(pintarTerminal); }
}

const hora = t => {
  const d = new Date(t), dos = n => String(n).padStart(2, "0");
  return `${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`;
};

function pintarTerminal() {
  term.pendiente = false;
  if (term.pausa) return;
  const lineas = term.cola.splice(0);
  const abajo = consola.scrollTop + consola.clientHeight >= consola.scrollHeight - 4;
  const frag = document.createDocumentFragment();
  for (const { d, x, t, sondeo } of lineas) {
    const div = document.createElement("div");
    div.className = "l " + d + (sondeo ? " sondeo" : "");
    const tm = document.createElement("time");
    tm.textContent = hora(t);
    const et = document.createElement("b");
    et.textContent = d === "sys" ? "··" : d.toUpperCase();
    const tx = document.createElement("span");
    tx.textContent = x;
    div.append(tm, et, tx);
    frag.appendChild(div);
  }
  consola.appendChild(frag);
  const sobran = consola.childElementCount - MAX_LINEAS;
  for (let i = 0; i < sobran; i++) consola.firstElementChild.remove();
  if (abajo) consola.scrollTop = consola.scrollHeight;
}

function botonTerminal(id, alPulsar) {
  const b = $(id);
  b.addEventListener("click", () => {
    const on = alPulsar();
    if (on !== undefined) { b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); }
  });
}
botonTerminal("#termSondeo", () => {
  term.sondeo = !term.sondeo;
  sim.sondeo = term.sondeo;
  consola.classList.toggle("sin-sondeo", !term.sondeo);
  return term.sondeo;
});
botonTerminal("#termPausa", () => {
  term.pausa = !term.pausa;
  if (!term.pausa) pintarTerminal();
  return term.pausa;
});
botonTerminal("#termLimpiar", () => { consola.textContent = ""; term.cola = []; });

function pintarFuenteTerminal() {
  $("#termFuente").textContent = enlace === sim ? "Simulador · controlador en el navegador" : "Real · sin enlace (pendiente)";
}
pintarFuenteTerminal();

const historial = [];
let iHist = 0;
$("#consolaForm").addEventListener("submit", async e => {
  e.preventDefault();
  const input = $("#consolaInput");
  const linea = input.value.trim();
  if (!linea) return;
  historial.push(linea);
  iHist = historial.length;
  input.value = "";
  if (/^(J|L|HOME|CERO|RUTINA|STOP)\b/i.test(linea)) { refSigue.activo = false; puntoObjetivo = null; }
  const r = await enlace.cmd(linea);
  if (enlace === sim && /^(J|L)\b/i.test(linea) && !r.startsWith("ERR")) ref = sim.destino?.slice() || ref;
  if (enlace === sim && /^STOP\b/i.test(linea)) pegarRef(0);
});
$("#consolaInput").addEventListener("keydown", e => {
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
  e.preventDefault();
  iHist = Math.max(0, Math.min(historial.length, iHist + (e.key === "ArrowUp" ? -1 : 1)));
  e.target.value = historial[iHist] ?? "";
});
alLog({ detail: { d: "sys", x: `${MODELO.nombre} · ${MODELO.robot} · escribe ? para ver los comandos`, t: Date.now() } });

// ------------------------------------------------------------ panel --

const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const ICO_TAB = { mover: "brazo", rutinas: "rutinas", ficha: "ficha" };

function irATab(id, { animar = true } = {}) {
  if (!ICO_TAB[id]) id = "mover";
  for (const b of $$(".navinf__pildora [data-tab]")) {
    const si = b.dataset.tab === id;
    if (si) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    b.querySelector("use").setAttribute("href", `#i-${ICO_TAB[b.dataset.tab]}${si ? "-on" : ""}`);
  }
  for (const p of $$(".pag")) {
    const si = p.dataset.pag === id;
    if (si && p.hidden && animar) {
      p.classList.remove("pag--funde");
      void p.offsetWidth;
      p.classList.add("pag--funde");
    }
    p.hidden = !si;
  }
  $("#vista").scrollTop = 0;
  recordar.set("tab", id);
}
for (const b of $$(".navinf__pildora [data-tab]")) b.addEventListener("click", () => irATab(b.dataset.tab));
irATab(new URLSearchParams(location.search).get("tab") || recordar.get("tab", "mover"), { animar: false });

const hojaAj = $("#hojaAjustes");
let hojaPrevio = null, timerHoja = null;
function abrirAjustes() {
  clearTimeout(timerHoja);
  hojaPrevio = document.activeElement;
  hojaAj.hidden = false;
  void hojaAj.offsetWidth;
  hojaAj.classList.add("abierta");
  hojaAj.querySelector(".btn-icono[data-cerrar]").focus({ preventScroll: true });
}
function cerrarAjustes() {
  if (hojaAj.hidden || !hojaAj.classList.contains("abierta")) return;
  hojaAj.classList.remove("abierta");
  timerHoja = setTimeout(() => { hojaAj.hidden = true; }, reducido() ? 0 : 320);
  if (hojaPrevio && document.contains(hojaPrevio)) hojaPrevio.focus({ preventScroll: true });
}
$("#bAjustes").addEventListener("click", abrirAjustes);
for (const b of $$("#hojaAjustes [data-cerrar]")) b.addEventListener("click", cerrarAjustes);
hojaAj.addEventListener("keydown", e => {
  if (e.key !== "Tab") return;
  const f = $$("#hojaAjustes button:not([disabled]), #hojaAjustes input:not([disabled])").filter(x => x.offsetParent);
  if (!f.length) return;
  if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
});

function plegarTerminal(si, guardar = true) {
  $("#terminal").classList.toggle("plegada", si);
  const b = $("#termPlegar");
  b.setAttribute("aria-expanded", !si);
  b.title = si ? "Abrir la terminal" : "Plegar la terminal";
  if (!si) consola.scrollTop = consola.scrollHeight;
  if (guardar) recordar.set("terminalPlegada", si);
}
$("#termPlegar").addEventListener("click", () => plegarTerminal(!$("#terminal").classList.contains("plegada")));
plegarTerminal(innerWidth < 720 || recordar.get("terminalPlegada", false), false);

function agrandarVisor(si) {
  $(".app").classList.toggle("visor-grande", si);
  const b = $("#bVisorTam"), t = si ? "Achicar vista 3D" : "Agrandar vista 3D";
  b.setAttribute("aria-pressed", si);
  b.setAttribute("aria-label", t);
  b.title = t;
  recordar.set("visorGrande", si);
}
$("#bVisorTam").addEventListener("click", () => agrandarVisor(!$(".app").classList.contains("visor-grande")));
agrandarVisor(recordar.get("visorGrande", false));

// Para pruebas desde la consola o la URL: ?q=j1,j2,j3,j4,j5,j6 pone la pose
const qURL = new URLSearchParams(location.search).get("q");
if (qURL) {
  const q = qURL.split(",").map(Number);
  if (q.length === 6 && q.every(Number.isFinite)) { sim.ponerEn(q.map((v, e) => limitar(e, v))); real = sim.q.slice(); pegarRef(0); }
}
if (new URLSearchParams(location.search).get("modo") === "punto") $('#segInteraccion [data-i="punto"]').click();
{
  const ru = new URLSearchParams(location.search).get("rutina");
  if (ru) setTimeout(() => $(`[data-rutina="${ru}"]`)?.click(), 100);
}
window.gemelo = { cin, sim, escena, get ref() { return ref; }, get real() { return real; } };

// ------------------------------------------------------------ varios --

let timerAviso = null;
function avisar(texto) {
  const el = $("#aviso");
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => { el.hidden = true; }, 3200);
}

function fmt(v, dec = 0) {
  const t = Math.abs(v).toFixed(dec);
  return (v < 0 && Number(t) !== 0 ? "−" : "") + t + "°";
}
