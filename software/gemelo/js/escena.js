// escena.js - el gemelo en three.js (misma idea que Pólux).
//
// Dos copias del robot:
//   - el sólido, que es el real (o el simulado): lo mueve el controlador;
//   - el fantasma translúcido, que es la referencia: lo mueve quien controla
//     (rieles, arrastre de piezas, punto). Si coinciden, se esconde.
//
// Interacción:
//   Articulaciones  pasar el cursor sobre una pieza muestra el arco de su eje
//                   (rango completo y flechas hacia donde puede girar);
//                   arrastrarla gira la referencia.
//   Punto           una esfera en el TCP con flechas XYZ; la cinemática
//                   inversa (con la configuración elegida) pone la referencia.
// Clic izquierdo en el vacío orbita, derecho o central desplaza, rueda acerca.
//
// El robot se modela en mm con Z arriba (marco de FANUC); aquí se gira a Y
// arriba y se escala a metros. Conversión WORLD de FANUC → three:
//   three = ((x) , (z + h0) , −y) / 1000

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GEO, LIM, limitar } from "./config.js";
import { RAD } from "./cinematica.js";
import { construirRobot, materiales, leerSTL } from "./modelo.js";

const COLOR = {
  fondo: 0xe5e7eb,
  grafito: 0x111317,
  alloy: 0x6b6f76,
  dato: 0x2563eb,
  aviso: 0xc2410c,
  fantasma: 0x9aa0a8,
  reticula: 0xcfd3d9,
  reticulaFina: 0xdadde2,
};
const VISTA_INICIAL = { pos: new THREE.Vector3(2.25, 1.55, 2.05), mira: new THREE.Vector3(0.32, 0.66, 0) };
const UMBRAL_FANTASMA = 0.3;      // grados

// Eje de giro de cada articulación en su marco (como el URDF)
const EJE = [[0, 0, 1], [0, 1, 0], [0, -1, 0], [-1, 0, 0], [0, -1, 0], [-1, 0, 0]].map(v => new THREE.Vector3(...v));
// Arcos: dirección del ángulo 0 (en el marco de orientación), radio (m) y
// desplazamiento del centro sobre el pivote (mm, marco del pivote)
const ARCO = [
  { r0: [1, 0, 0], radio: 0.32, off: [0, 0, -60] },
  { r0: [0, 0, 1], radio: 0.24, off: [0, 150, 0] },
  { r0: [1, 0, 0], radio: 0.22, off: [0, -30, 0] },
  { r0: [0, 0, 1], radio: 0.13, off: [300, 0, 0] },
  { r0: [1, 0, 0], radio: 0.11, off: [0, 0, 0] },
  { r0: [0, 0, 1], radio: 0.075, off: [0, 0, 0] },
];

export const aTres = p => [p[0] / 1000, (p[2] + GEO.h0) / 1000, -p[1] / 1000];
export const deTres = v => [v[0] * 1000, -v[2] * 1000, v[1] * 1000 - GEO.h0];

export class Escena {
  constructor(contenedor, { alCambiarRef, alHover, alPunto }) {
    this.contenedor = contenedor;
    this.alCambiarRef = alCambiarRef;
    this.alHover = alHover;
    this.alPunto = alPunto;
    this.modo = "articulaciones";
    this.ref = null;
    this.real = null;
    this.hover = -1;
    this.arrastre = null;
    this.listo = false;

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    contenedor.appendChild(r.domElement);

    const s = (this.scene = new THREE.Scene());
    s.background = new THREE.Color(COLOR.fondo);
    const pmrem = new THREE.PMREMGenerator(r);
    s.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    s.environmentIntensity = 0.55;

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.02, 60);
    this.camera.position.copy(VISTA_INICIAL.pos);

    r.domElement.addEventListener("pointerdown", e => this.bajar(e));
    r.domElement.addEventListener("pointermove", e => this.mover(e));
    window.addEventListener("pointerup", e => this.soltar(e));
    r.domElement.addEventListener("pointerleave", () => { if (!this.arrastre) this.ponerHover(-1); });

    const c = (this.controles = new OrbitControls(this.camera, r.domElement));
    c.target.copy(VISTA_INICIAL.mira);
    c.enableDamping = true;
    c.dampingFactor = 0.12;
    c.minDistance = 0.6;
    c.maxDistance = 12;
    c.maxPolarAngle = Math.PI * 0.495;
    c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    c.update();
    this.vistaMovida = false;
    c.addEventListener("start", () => { this.vistaMovida = true; });

    this.luces();
    this.piso();

    this.raycaster = new THREE.Raycaster();
    this.puntero = new THREE.Vector2();

    new ResizeObserver(() => this.ajustar()).observe(contenedor);
    this.ajustar();
    this.renderer.setAnimationLoop(() => this.cuadro());
  }

  luces() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc6cad1, 1.1));
    const sol = new THREE.DirectionalLight(0xffffff, 2.2);
    sol.position.set(2.2, 4.4, 2.8);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 12 });
    sol.shadow.bias = -0.0004;
    sol.shadow.normalBias = 0.02;
    sol.shadow.radius = 4;
    this.scene.add(sol);
    const relleno = new THREE.DirectionalLight(0xffffff, 0.6);
    relleno.position.set(-3, 2, -2);
    this.scene.add(relleno);
  }

  piso() {
    const sombra = new THREE.Mesh(new THREE.CircleGeometry(8, 64).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ color: 0x1f2937, opacity: 0.16 }));
    sombra.receiveShadow = true;
    this.scene.add(sombra);
    // Retícula de 10 cm con líneas de 1 m, que se desvanece hacia afuera
    const fina = new THREE.GridHelper(8, 80, COLOR.reticulaFina, COLOR.reticulaFina);
    const gruesa = new THREE.GridHelper(8, 8, COLOR.reticula, COLOR.reticula);
    for (const g of [fina, gruesa]) {
      g.position.y = 0.0005;
      g.material.transparent = true;
      g.material.depthWrite = false;
      g.material.onBeforeCompile = sh => {
        sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vMundo;")
          .replace("#include <fog_vertex>", "#include <fog_vertex>\nvMundo = (modelMatrix * vec4(position, 1.0)).xyz;");
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vMundo;")
          .replace("#include <opaque_fragment>", "#include <opaque_fragment>\ngl_FragColor.a *= 1.0 - smoothstep(1.4, 3.8, length(vMundo.xz));");
      };
      this.scene.add(g);
    }
  }

  ajustar() {
    const { clientWidth: w, clientHeight: h } = this.contenedor;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.vistaMovida) this.encuadrar();
  }

  alejamiento() {
    const a = this.camera.aspect;
    return a < 1.3 ? Math.min(1.3 / a, 2.2) : 1;
  }

  encuadrar() {
    this.camera.position.copy(VISTA_INICIAL.pos);
    this.controles.target.copy(VISTA_INICIAL.mira);
    const mira = this.controles.target;
    this.camera.position.sub(mira).multiplyScalar(this.alejamiento()).add(mira);
    this.vistaMovida = false;
    this.controles.update();
  }

  // ------------------------------------------------------------- modelo --

  cargar() {
    this.solido = this.armar(false);
    this.fantasma = this.armar(true);
    this.scene.add(this.solido.raiz, this.fantasma.raiz);
    this.arcos = [0, 1, 2, 3, 4, 5].map(e => this.crearArco(e));
    this.crearPunto();
    this.listo = true;
  }

  // Robot completo: raíz girada a Y arriba, grupos por eje, mallas marcadas
  // con su eje (−1 = fijo) para el resalte y el arrastre.
  armar(esFantasma) {
    const mats = new Map();
    const matsDe = i => {
      if (esFantasma) return new Proxy({}, { get: () => MAT_FANTASMA });
      if (!mats.has(i)) mats.set(i, materiales());
      return mats.get(i);
    };
    const { raiz: robot, g } = construirRobot(matsDe, { etiquetas: !esFantasma });
    const raiz = new THREE.Group();
    robot.rotation.x = -Math.PI / 2;
    robot.scale.setScalar(0.001);
    raiz.add(robot);
    const r = { raiz, robot, g, mallas: [], porGrupo: g.map(() => []), mats: [...g.keys()].map(i => mats.get(i - 1)) };
    g.forEach((grupo, i) => {
      const propias = [];
      grupo.traverse(o => { if (o.isMesh && grupoDe(o, g) === i) propias.push(o); });
      propias.forEach(o => {
        o.userData.eje = i - 1;
        if (esFantasma) {
          o.material = MAT_FANTASMA;
          o.renderOrder = 2;
          const prof = new THREE.Mesh(o.geometry, MAT_PROFUNDIDAD);
          prof.renderOrder = 1;
          prof.raycast = () => {};
          o.add(prof);
        } else {
          o.castShadow = true;
          o.receiveShadow = true;
        }
        r.mallas.push(o);
        r.porGrupo[i].push(o);
      });
    });
    r.mats = [-1, 0, 1, 2, 3, 4, 5].map(i => mats.get(i));
    if (esFantasma) raiz.visible = false;
    return r;
  }

  // Malla de referencia del M-6iB (ROS-Industrial), en los mismos grupos del sólido
  async cargarM6ib(base = "modelos/m6ib/") {
    if (this.m6ib) return this.m6ib;
    const nombres = ["base_link", "link_1", "link_2", "link_3", "link_4", "link_5", "link_6"];
    const mat = new THREE.MeshStandardMaterial({ color: 0xe0b31a, roughness: 0.55, metalness: 0.05 });
    const negro = new THREE.MeshStandardMaterial({ color: 0x222326, roughness: 0.5 });
    const mallas = await Promise.all(nombres.map(async (n, i) => {
      const buf = await (await fetch(base + n + ".stl")).arrayBuffer();
      const m = new THREE.Mesh(leerSTL(buf), i === 6 ? negro : mat);
      m.scale.setScalar(1000);                // el URDF está en metros
      m.castShadow = m.receiveShadow = true;
      m.userData.eje = i - 1;
      m.visible = false;
      this.solido.g[i].add(m);
      return m;
    }));
    this.m6ib = mallas;
    return mallas;
  }

  // "rojo" = reconstruido, "m6ib" = mallas del URDF
  verModelo(cual) {
    const m6 = cual === "m6ib";
    for (const m of this.m6ib || []) m.visible = m6;
    for (const lista of this.solido.porGrupo) for (const o of lista) if (!o.userData.esM6) o.visible = !m6;
    this.solido.mallas = m6 ? this.m6ib : this.solido.porGrupo.flat();
  }

  poner(robot, q) {
    const t = [q[0], q[1], q[2] + q[1], q[3], q[4], q[5]];
    for (let e = 0; e < 6; e++) robot.g[e + 1].quaternion.setFromAxisAngle(EJE[e], t[e] * RAD);
  }

  setReal(q) {
    this.real = q.slice();
    if (!this.ref) this.setRef(q);
  }

  setRef(q) {
    this.ref = q.slice();
  }

  // ------------------------------------------------------------- arcos --

  // El arco vive en la escena; cada cuadro se coloca en el pivote del eje en
  // el FANTASMA (sigue a la referencia), orientado como el padre del eje. J3
  // se orienta con J1 (FANUC mide J3 contra la horizontal), así el ángulo del
  // arco es el ángulo del pendant en todos los ejes.
  crearArco(e) {
    const f = this.fantasma;
    const pivote = f.g[e + 1];
    const orient = e === 2 ? f.g[1] : f.g[e];
    const eje = EJE[e].clone();
    const r0 = new THREE.Vector3(...ARCO[e].r0);
    const w = new THREE.Vector3().crossVectors(eje, r0);
    const basis = new THREE.Matrix4().makeBasis(r0, w, eje);
    const grupo = new THREE.Group();
    grupo.matrixAutoUpdate = false;
    grupo.visible = false;
    this.scene.add(grupo);

    const radio = ARCO[e].radio;
    const a0 = LIM.min[e] * RAD, a1 = LIM.max[e] * RAD;
    // J4 y J6 pasan de una vuelta: el anillo completo y el rango marcado
    const rango = new THREE.Mesh(
      new THREE.RingGeometry(radio - 0.006, radio + 0.006, 160, 1, a0, Math.min(a1 - a0, 2 * Math.PI)),
      nuevoMatGuia(COLOR.alloy, 0.55),
    );
    const marcas = (a1 - a0 < 2 * Math.PI ? [a0, a1] : []).map(a => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.005, 0.04), nuevoMatGuia(COLOR.grafito, 0.8));
      m.position.set(Math.cos(a) * radio, Math.sin(a) * radio, 0);
      m.rotation.z = a - Math.PI / 2;
      return m;
    });
    const aguja = new THREE.Mesh(new THREE.PlaneGeometry(radio, 0.005).translate(radio / 2, 0, 0), nuevoMatGuia(COLOR.grafito, 0.85));
    const conoGeo = new THREE.ConeGeometry(0.016, 0.038, 20);
    const flechas = [1, -1].map(signo => {
      const m = new THREE.Mesh(conoGeo, nuevoMatGuia(COLOR.grafito, 0.9));
      m.userData.signo = signo;
      return m;
    });
    const real = new THREE.Mesh(new THREE.CircleGeometry(0.011, 24), nuevoMatGuia(COLOR.dato, 0.95));
    grupo.add(rango, ...marcas, aguja, ...flechas, real);
    for (const o of grupo.children) o.renderOrder = 10;
    return { e, grupo, pivote, orient, basis, radio, aguja, flechas, real, off: new THREE.Vector3(...ARCO[e].off) };
  }

  reconstruirArcos() {
    for (const a of this.arcos) {
      a.grupo.removeFromParent();
      a.grupo.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
    }
    this.arcos = [0, 1, 2, 3, 4, 5].map(e => this.crearArco(e));
  }

  colocarArco(arco) {
    arco.pivote.updateWorldMatrix(true, false);
    const centro = arco.off.clone().applyMatrix4(arco.pivote.matrixWorld);
    const q = new THREE.Quaternion();
    arco.orient.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3());
    arco.grupo.matrix.compose(centro, q, new THREE.Vector3(1, 1, 1)).multiply(arco.basis);
    arco.grupo.matrixWorldNeedsUpdate = true;
  }

  actualizarArco(arco, activo) {
    const { e, radio } = arco;
    this.colocarArco(arco);
    const aRef = this.ref[e] * RAD;
    arco.aguja.rotation.z = aRef;
    for (const f of arco.flechas) {
      const s = f.userData.signo;
      f.visible = s > 0 ? this.ref[e] < LIM.max[e] - 0.3 : this.ref[e] > LIM.min[e] + 0.3;
      const a = aRef + s * 0.3;
      f.position.set(Math.cos(a) * radio, Math.sin(a) * radio, 0);
      f.rotation.z = a + (s > 0 ? 0 : Math.PI);
      f.material.color.setHex(activo ? COLOR.dato : COLOR.grafito);
    }
    const aReal = this.real[e] * RAD;
    arco.real.position.set(Math.cos(aReal) * radio, Math.sin(aReal) * radio, 0.001);
    arco.real.visible = Math.abs(this.real[e] - this.ref[e]) > UMBRAL_FANTASMA;
  }

  // ------------------------------------------------------------- punto --

  crearPunto() {
    const esfera = new THREE.Mesh(new THREE.SphereGeometry(0.018, 32, 16), new THREE.MeshStandardMaterial({ color: COLOR.dato, roughness: 0.4 }));
    esfera.visible = false;
    esfera.renderOrder = 11;
    this.scene.add(esfera);
    const lineaGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const linea = new THREE.Line(lineaGeo, new THREE.LineDashedMaterial({ color: COLOR.alloy, dashSize: 0.02, gapSize: 0.015, transparent: true, opacity: 0.8 }));
    const huella = new THREE.Mesh(new THREE.RingGeometry(0.014, 0.022, 32).rotateX(-Math.PI / 2), nuevoMatGuia(COLOR.alloy, 0.8));
    const faltaGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const falta = new THREE.Line(faltaGeo, new THREE.LineDashedMaterial({ color: COLOR.aviso, dashSize: 0.02, gapSize: 0.012 }));
    for (const o of [linea, huella, falta]) { o.visible = false; this.scene.add(o); }

    const tc = new TransformControls(this.camera, this.renderer.domElement);
    tc.setSize(0.85);
    tc.setSpace("world");
    tc.attach(esfera);
    tc.enabled = false;
    const ayuda = tc.getHelper();
    ayuda.visible = false;
    this.scene.add(ayuda);
    tc.addEventListener("dragging-changed", ev => {
      this.controles.enabled = !ev.value;
      this.punto.arrastrando = ev.value;
      if (!ev.value) this.alPunto?.(deTres(esfera.position.toArray()), { final: true });
    });
    tc.addEventListener("objectChange", () => {
      if (esfera.position.y < 0.01) esfera.position.y = 0.01;
      this.alPunto?.(deTres(esfera.position.toArray()), { final: false });
    });
    this.punto = { esfera, linea, huella, falta, tc, ayuda, arrastrando: false, fuera: false, tcpRef: null };
  }

  // p en mm (WORLD de FANUC); alcanzable = false deja la esfera y marca lo que falta
  marcarPunto(p, alcanzable) {
    this.punto.fuera = !alcanzable;
    if (p) this.punto.esfera.position.fromArray(aTres(p));
  }

  // TCP de la referencia (mm), para la esfera y la línea de lo que falta
  ponerTcpRef(p) {
    this.punto.tcpRef = p;
    if (this.modo === "punto" && !this.punto.arrastrando && !this.punto.fuera) this.punto.esfera.position.fromArray(aTres(p));
  }

  setModo(modo) {
    this.modo = modo;
    const enPunto = modo === "punto";
    const pt = this.punto;
    pt.tc.enabled = enPunto;
    pt.ayuda.visible = enPunto;
    for (const o of [pt.esfera, pt.linea, pt.huella]) o.visible = enPunto;
    pt.fuera = false;
    if (enPunto && pt.tcpRef) pt.esfera.position.fromArray(aTres(pt.tcpRef));
    this.ponerHover(-1);
  }

  // ----------------------------------------------------------- puntero --

  rayo(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.puntero, this.camera);
    return this.raycaster.ray;
  }

  pieza(e) {
    this.rayo(e);
    const objetos = [...this.solido.mallas.filter(m => m.visible), ...(this.fantasma.raiz.visible ? this.fantasma.mallas.filter(m => m.visible) : [])];
    const hit = this.raycaster.intersectObjects(objetos, false)[0];
    return hit ? hit.object.userData.eje : -1;
  }

  ponerHover(eje) {
    if (eje === this.hover) return;
    this.hover = eje;
    this.solido.mats.forEach((M, i) => {
      if (!M) return;
      const on = eje >= 0 && i - 1 === eje;
      for (const m of Object.values(M)) {
        if (!m.emissive) continue;
        m.emissive.setHex(on ? 0x3a3d44 : 0x000000);
      }
    });
    this.renderer.domElement.style.cursor = eje >= 0 ? "grab" : "";
    this.alHover?.(eje >= 0 ? { eje } : null);
  }

  bajar(e) {
    if (!this.listo || this.modo !== "articulaciones" || e.button !== 0) return;
    const eje = this.pieza(e);
    if (eje < 0) return;
    this.controles.enabled = false;
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.renderer.domElement.style.cursor = "grabbing";
    const arco = this.arcos[eje];
    this.colocarArco(arco);
    arco.grupo.updateMatrixWorld(true);
    const centro = new THREE.Vector3().setFromMatrixPosition(arco.grupo.matrixWorld);
    const ejeMundo = new THREE.Vector3().setFromMatrixColumn(arco.grupo.matrixWorld, 2).normalize();
    this.arrastre = { eje, centro, ejeMundo, q: this.ref[eje], previo: this.enPlano(e, ejeMundo, centro), x: e.clientX, y: e.clientY };
  }

  enPlano(e, ejeMundo, centro) {
    const ray = this.rayo(e);
    if (Math.abs(ray.direction.dot(ejeMundo)) < 0.18) return null;
    const p = new THREE.Vector3();
    return ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(ejeMundo, centro), p) ? p.sub(centro) : null;
  }

  mover(e) {
    if (!this.listo) return;
    const a = this.arrastre;
    if (!a) {
      if (this.modo === "articulaciones" && e.buttons === 0) this.ponerHover(this.pieza(e));
      return;
    }
    const v = this.enPlano(e, a.ejeMundo, a.centro);
    let d;
    if (v && a.previo) {
      const cruz = new THREE.Vector3().crossVectors(a.previo, v);
      d = Math.atan2(cruz.dot(a.ejeMundo), a.previo.dot(v));
    } else {
      d = -((e.clientX - a.x) + (e.clientY - a.y)) * 0.006;
    }
    a.previo = v;
    a.x = e.clientX; a.y = e.clientY;
    a.q = limitar(a.eje, a.q + d / RAD);
    const q = this.ref.slice();
    q[a.eje] = a.q;
    this.setRef(q);
    this.alCambiarRef?.(q, { final: false, eje: a.eje });
  }

  soltar(e) {
    const a = this.arrastre;
    if (!a) return;
    this.arrastre = null;
    this.controles.enabled = true;
    try { this.renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* nada */ }
    this.alCambiarRef?.(this.ref.slice(), { final: true, eje: a.eje });
    this.renderer.domElement.style.cursor = "";
    this.hover = -2;
    this.ponerHover(this.pieza(e));
  }

  pantallaDeEje(eje) {
    const arco = this.arcos[eje];
    this.colocarArco(arco);
    arco.grupo.updateMatrixWorld(true);
    const p = new THREE.Vector3().setFromMatrixPosition(arco.grupo.matrixWorld);
    p.project(this.camera);
    const { clientWidth: w, clientHeight: h } = this.contenedor;
    return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h };
  }

  // ------------------------------------------------------------ cuadro --

  cuadro() {
    this.controles.update();
    if (this.listo && this.real && this.ref) {
      this.poner(this.solido, this.real);
      this.poner(this.fantasma, this.ref);
      // J3 se mide contra la horizontal: si cambia J2, el codo también se mueve
      const difiere = e => Math.abs(this.ref[e] - this.real[e]) > UMBRAL_FANTASMA;
      let desde = [0, 1, 2, 3, 4, 5].find(difiere) ?? 6;
      this.fantasma.raiz.visible = desde < 6;
      if (desde !== this.fantasmaDesde) {
        this.fantasmaDesde = desde;
        this.fantasma.porGrupo.forEach((lista, i) => {
          const ver = i > 0 && i - 1 >= desde;
          for (const m of lista) m.visible = ver;
        });
      }
      const activo = this.arrastre ? this.arrastre.eje : this.hover;
      for (const arco of this.arcos) {
        arco.grupo.visible = this.modo === "articulaciones" && arco.e === activo;
        if (arco.grupo.visible) this.actualizarArco(arco, !!this.arrastre);
      }
      if (this.modo === "punto") this.actualizarPunto();
    }
    this.renderer.render(this.scene, this.camera);
  }

  actualizarPunto() {
    const { esfera, linea, huella, falta } = this.punto;
    const p = esfera.position;
    const a = linea.geometry.attributes.position;
    a.setXYZ(0, p.x, p.y, p.z);
    a.setXYZ(1, p.x, 0, p.z);
    a.needsUpdate = true;
    linea.computeLineDistances();
    huella.position.set(p.x, 0.001, p.z);
    falta.visible = this.punto.fuera && !!this.punto.tcpRef;
    if (falta.visible) {
      const t = aTres(this.punto.tcpRef), f = falta.geometry.attributes.position;
      f.setXYZ(0, t[0], t[1], t[2]);
      f.setXYZ(1, p.x, p.y, p.z);
      f.needsUpdate = true;
      falta.computeLineDistances();
    }
    esfera.material.color.setHex(this.punto.fuera ? COLOR.alloy : COLOR.dato);
  }
}

function grupoDe(o, grupos) {
  for (let p = o; p; p = p.parent) { const i = grupos.indexOf(p); if (i >= 0) return i; }
  return -1;
}

const MAT_FANTASMA = new THREE.MeshStandardMaterial({
  color: COLOR.fantasma, roughness: 0.6, metalness: 0,
  transparent: true, opacity: 0.38, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4,
});
const MAT_PROFUNDIDAD = new THREE.MeshBasicMaterial({
  colorWrite: false, transparent: true, depthWrite: true,
  polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4,
});

function nuevoMatGuia(color, opacidad) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacidad, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
}
