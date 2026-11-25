// sim.js - un controlador FANUC de juguete que corre en el navegador.
//
// No imita al RJ2 por dentro: recibe líneas de texto, mueve los ejes con las
// velocidades máximas de la hoja de datos (escaladas por el override) y
// contesta. Sirve para que el gemelo y la terminal se comporten como lo harán
// con el robot real, cuando haya enlace.
//
// Comandos (uno por línea, mayúsculas o minúsculas):
//   J j1 j2 j3 j4 j5 j6          articular: todos los ejes llegan a la vez
//   L x y z w p r [N U T] [v]    lineal del TCP a v mm/s (100 por defecto)
//   HOME · CERO · RUTINA <id>    poses y rutinas de config.js
//   OVR <1-100>                  override de velocidad, %
//   STOP                         detiene y vacía la cola
//   JNT? · POS? · CFG? · OVR? · ?
// Respuestas: OK, ERR <motivo>, y LISTO cuando termina un movimiento.

import { HOME, CERO, LIM, VEL_MAX, RUTINAS, EJES } from "./config.js";
import { interpolarPose, anguloEntre, textoCfg } from "./cinematica.js";

const RAMPA = 0.25;        // s para llegar a velocidad plena (y frenar)

export class Controlador extends EventTarget {
  constructor(cin) {
    super();
    this.tipo = "sim";
    this.conectado = true;
    this.cin = cin;
    this.q = HOME.slice();
    this.ovr = 50;
    this.cola = [];        // movimientos pendientes
    this.mov = null;       // el que se ejecuta
    this.nombre = "";      // rutina en curso
    this.escala = 1;       // ×tiempo
    this.k = 0;            // rampa 0..1
    this.tSondeo = 0;
    this.sondeo = false;
  }

  get ocupado() { return !!(this.mov || this.cola.length); }

  // Destino del movimiento actual en ejes (para el fantasma)
  get destino() {
    const m = this.mov;
    if (!m) return null;
    if (m.J) return m.J;
    if (m.L) return m.qFin;
    return null;
  }

  log(d, x, sondeo = false) {
    this.dispatchEvent(new CustomEvent("crudo", { detail: { d, x, t: Date.now(), sondeo } }));
  }

  // ------------------------------------------------------------ comandos --

  async cmd(linea, { silencio = false } = {}) {
    linea = linea.trim();
    if (!silencio) this.log("tx", linea);
    const r = this.interpretar(linea);
    if (!silencio) this.log("rx", r);
    return r;
  }

  interpretar(linea) {
    const p = linea.toUpperCase().split(/[\s,]+/).filter(Boolean);
    const c = p[0], n = p.slice(1).map(Number);
    switch (c) {
      case "?": return "J · L · HOME · CERO · RUTINA <id> · OVR <%> · STOP · JNT? · POS? · CFG?";
      case "JNT?": return "JNT " + this.q.map(v => v.toFixed(2)).join(" ");
      case "POS?": return "POS " + this.cin.directa(this.q).map(v => v.toFixed(1)).join(" ");
      case "CFG?": return "CFG " + textoCfg(this.cin.config(this.q));
      case "OVR?": return "OVR " + this.ovr;
      case "OVR":
        if (!(n[0] >= 1 && n[0] <= 100)) return "ERR OVR 1-100";
        this.ovr = Math.round(n[0]);
        this.dispatchEvent(new Event("ovr"));
        return "OK";
      case "STOP": this.alto(); return "OK";
      case "HOME": this.ejecutar([{ J: HOME }], "HOME"); return "OK";
      case "CERO": this.ejecutar([{ J: CERO }], "Cero"); return "OK";
      case "RUTINA": {
        const ru = RUTINAS.find(r => r.id === p[1]);
        if (!ru) return "ERR RUTINA " + RUTINAS.map(r => r.id).join("|");
        this.ejecutar(ru.movs, ru.nombre);
        return "OK";
      }
      case "J": {
        if (n.length !== 6 || n.some(v => !Number.isFinite(v))) return "ERR J necesita 6 valores";
        const e = n.findIndex((v, i) => v < LIM.min[i] - 1e-6 || v > LIM.max[i] + 1e-6);
        if (e >= 0) return `ERR LIMITE ${EJES[e]} ${LIM.min[e]}..${LIM.max[e]}`;
        this.ir({ J: n });
        return "OK";
      }
      case "L": {
        const v = n.slice(0, 6);
        if (v.length !== 6 || v.some(x => !Number.isFinite(x))) return "ERR L necesita x y z w p r";
        const letras = p.slice(7).filter(t => /^[NFUDTB]$/.test(t));
        const cfg = letras.length ? {
          muneca: letras.find(t => "NF".includes(t)), codo: letras.find(t => "UD".includes(t)), base: letras.find(t => "TB".includes(t)),
        } : null;
        const vel = Number(p.slice(7).find(t => /^\d+(\.\d+)?$/.test(t))) || 100;
        const r = this.cin.inversa(v, cfg || this.cin.config(this.q), this.q);
        if (!r.ok) return "ERR " + r.motivo;
        this.ir({ L: v, v: vel, cfg: cfg || this.cin.config(this.q) });
        return "OK";
      }
      default: return "ERR COMANDO";
    }
  }

  // Un movimiento manual: reemplaza lo que haya (el destino cambia al vuelo)
  ir(m) {
    this.cola = [];
    this.nombre = "";
    this.empezar(m, true);
  }

  ejecutar(movs, nombre = "") {
    this.cola = movs.map(m => ({ ...m }));
    this.nombre = nombre;
    this.mov = null;
    this.k = 0;
    this.siguiente();
  }

  alto() {
    const habia = this.ocupado;
    this.cola = [];
    this.mov = null;
    this.nombre = "";
    this.k = 0;
    if (habia) this.dispatchEvent(new Event("fin"));
  }

  // Lleva el simulador a una pose (al cambiar de modo)
  ponerEn(q) { this.alto(); this.q = q.slice(); }

  siguiente() {
    const m = this.cola.shift();
    if (!m) {
      const nombre = this.nombre;
      this.mov = null;
      this.nombre = "";
      this.log("rx", nombre ? `LISTO ${nombre}` : "LISTO");
      this.dispatchEvent(new Event("fin"));
      return;
    }
    this.empezar(m, false);
  }

  empezar(m, alVuelo) {
    if (!this.mov || !alVuelo) this.k = 0;
    if (m.L) {
      const A = this.cin.directa(this.q);
      const cfg = m.cfg || this.cin.config(this.q);
      const d = Math.hypot(m.L[0] - A[0], m.L[1] - A[1], m.L[2] - A[2]);
      const ang = anguloEntre(A.slice(3), m.L.slice(3));
      const fin = this.cin.inversa(m.L, cfg, this.q);
      if (!fin.ok) { this.log("rx", "ERR L " + fin.motivo); this.alto(); return; }
      this.mov = { L: m.L, A, cfg, t: 0, dur: Math.max(d / (m.v || 100), ang / 90, 0.05), qFin: fin.q };
    } else if (m.J) {
      this.mov = { J: m.J.slice() };
    } else if (m.espera) {
      this.mov = { espera: m.espera / 1000 };
    }
  }

  // ------------------------------------------------------------- tiempo --

  tick(dt) {
    dt *= this.escala;
    const ovr = this.ovr / 100;
    const m = this.mov;
    if (m?.espera !== undefined) {
      m.espera -= dt;
      if (m.espera <= 0) this.siguiente();
    } else if (m?.J) {
      const d = m.J.map((v, e) => v - this.q[e]);
      // tiempo que tarda el eje más lento a velocidad plena
      const T = Math.max(...d.map((v, e) => Math.abs(v) / (VEL_MAX[e] * ovr)));
      if (T < 1e-4) { this.q = m.J.slice(); this.siguiente(); }
      else {
        this.k = Math.min(1, this.k + dt / RAMPA);
        const frena = Math.min(1, Math.sqrt(T / RAMPA));
        const paso = Math.min(1, (dt * Math.max(0.05, this.k * frena)) / T);
        this.q = this.q.map((v, e) => v + d[e] * paso);
        if (paso >= 1) { this.q = m.J.slice(); this.siguiente(); }
      }
    } else if (m?.L) {
      this.k = Math.min(1, this.k + dt / RAMPA);
      const resta = (1 - m.t) * m.dur / ovr;
      const frena = Math.min(1, Math.sqrt(resta / RAMPA));
      m.t = Math.min(1, m.t + (dt * ovr * Math.max(0.05, this.k * frena)) / m.dur);
      const r = this.cin.inversa(interpolarPose(m.A, m.L, m.t), m.cfg, this.q);
      if (!r.ok) { this.log("rx", "ERR L " + r.motivo); this.alto(); }
      else {
        this.q = r.q;
        if (m.t >= 1) this.siguiente();
      }
    }
    // Sondeo: lo que el pendant pediría solo
    this.tSondeo += dt;
    if (this.sondeo && this.tSondeo > 0.5) {
      this.tSondeo = 0;
      this.log("tx", "JNT?", true);
      this.log("rx", "JNT " + this.q.map(v => v.toFixed(2)).join(" "), true);
    }
    this.dispatchEvent(new Event("estado"));
  }
}
