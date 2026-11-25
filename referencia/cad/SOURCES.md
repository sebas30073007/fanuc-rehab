# Fuentes de geometría (CAD / mallas)

Descargado el 20-nov-2026. Solo archivos de geometría y descripción (STL, xacro, XML); nada ejecutable.

## ros-industrial-fanuc_m6ib_support/

FANUC M-6iB (= ARC Mate 100iB), el pariente más cercano al ARC Mate 100i (M-6i) con modelo público.

| Archivo | URL | Licencia |
|---|---|---|
| `meshes/visual/base_link.stl` … `link_6.stl` (7 mallas, ~250–400 triángulos c/u, en metros) | https://github.com/ros-industrial/fanuc/tree/noetic-devel/fanuc_m6ib_support/meshes/m6ib/visual | BSD-3-Clause (TU Delft Robotics Institute / ROS-Industrial) |
| `urdf/m6ib_macro.xacro` (cinemática y límites) | https://github.com/ros-industrial/fanuc/blob/noetic-devel/fanuc_m6ib_support/urdf/m6ib_macro.xacro | BSD-3-Clause |
| `package.xml` | https://github.com/ros-industrial/fanuc/blob/noetic-devel/fanuc_m6ib_support/package.xml | BSD-3-Clause |
| `LICENSE` | https://github.com/ros-industrial/fanuc/blob/noetic-devel/LICENSE | — |

Commit de referencia: `d8f42bd73584b255df87098395512538882caea1` (rama `noetic-devel`, 19-feb-2025).

Medidas del URDF (mm): J2 a 450 sobre la base · J1→J2 150 · brazo inferior 600 · codo→eje del antebrazo 100 · antebrazo 615 · muñeca→brida 100. Alcance al centro de muñeca: 150 + 600 + √(615² + 100²) = 1373 mm (dato de catálogo del M-6iB). El ARC Mate 100i publica 1368 mm.

Copia de las mallas para el gemelo en `software/gemelo/modelos/m6ib/` (se ven en Ajustes → Modelo 3D → M-6iB · ROS-I).

## Lo que no se encontró

- ARC Mate 100i / M-6i: no encontramos CAD público. En GrabCAD solo aparecen peticiones sin respuesta (ARC Mate 100iB) y un hilo del foro de SolidWorks que pide el 100i; las bibliotecas comerciales (Encycam, RoboDK) tienen el 100iD, que es otro robot. No se revisó TraceParts con cuenta ni se pidió el CAD a FANUC. El gemelo usa un modelo reconstruido con primitivas de three.js (`software/gemelo/js/modelo.js`) sobre la cinemática del M-6iB.
- `fanuc_experimental` (ROS-Industrial) no tiene paquetes del M-6i ni del ARC Mate 100i.

## Datos (no geometría)

- Límites, velocidades, carga, alcance y repetibilidad del ARC Mate 100i: https://rabindustries.system.machinio.com/blog/2835-fanuc-arc-mate-100i-data-sheet (copia de distribuidor; verificar con el manual B-81545).
- Motores: placas de las fotos en `../fotos-huber/` (αM6/3000 A06B-0162-B175; α1/3000 A06B-0371-B175).
