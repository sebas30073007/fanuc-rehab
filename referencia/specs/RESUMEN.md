# Manipulador FANUC (Formet «ROBOT #2»): resumen técnico

20-nov-2026. Convención: **[C]** = confirmado en una fuente (manual FANUC o placa), **[R]** = dato de revendedor (puede tener errores), **[I]** = inferido por mí, falta verificarlo en el robot.
Detalle y tablas en `motores-alfa.md`; fuentes en `enlaces.md`; PDFs en `pdf/`.

## 1. Modelo probable: FANUC ARC Mate 100i (= M-6i), controlador R-J2

**Por qué [I]:**
- La forma coincide con las fotos del ARC Mate 100i de robots.com: brazo J2 curvo, motor de J3 detrás del codo, antebrazo con los motores de la muñeca atrás y **dos conectores Harting en el costado de la base** (en las fotos se ven igual). El S-6 / ARC Mate 120 tienen un brazo recto y ancho, así que se descartan.
- Motores **α** (no αi) con fechas de 1996 a 1998 (más un α1 de 2000.05, quizá un repuesto) → generación **R-J2** (los αi son de la R-J3iB). El 100i se vendió con R-J2 y después con R-J3 [R].
- Hay revendedores que listan exactamente estas piezas para el ARC Mate 100i / M-6i: A06B-0371-B175 (α1 con freno) como motor de **J3** y A06B-0162-B175 (αM6 con freno) para el M-6i [R].
- El robot no es un ARC Mate 100i**B** ni un «100i Model B»: esos usan motores αiS (A06B-02xx), y su manual es el B-81545EN.

**Especificaciones del ARC Mate 100i [R], sin ficha oficial de FANUC:**
| Concepto | Valor |
|---|---|
| Ejes | 6 |
| Carga útil | 6 kg |
| Alcance horizontal | 1368 mm |
| Repetibilidad | ±0.1 mm |
| Masa | 290 kg según dos revendedores; otro dice 138 kg (**sin resolver**; el M-6iB pesa ~135 kg) |
| Montaje | piso, invertido, inclinado |

| Eje | Rango | Velocidad |
|---|---|---|
| J1 | ±165° (330°) | 120 °/s |
| J2 | +135° / −75° (210°) | 120 °/s |
| J3 | +150° / −149° (299°) | 120 °/s |
| J4 | ±190° (380°) | 360 °/s |
| J5 | ±140° (280°) | 360 °/s |
| J6 | ±320° (640°) | 450 °/s |

**DH / longitudes:** no encontré los parámetros publicados del 100i. Como punto de partida sirve su sucesor, el **M-6iB** (ROS-Industrial `m6ib_macro.xacro`, alcance 1373 mm contra 1368 del 100i) [I: geometría muy parecida, falta medirla]:
altura de J2 sobre la base 450 mm · desfase J1→J2 a1 = 150 mm · brazo J2→J3 a2 = 600 mm · desfase J3 a3 = 100 mm · antebrazo J3→muñeca d4 = 615 mm · muñeca→brida d6 = 100 mm.
**Hay que medirlo en el robot** (cinta y láser, o fotogrametría) antes de escribir la cinemática.

**Reductores y relaciones:** no encontré nada publicado. Estimación [I]: con 3000 min⁻¹ → 120 °/s, J1 a J3 tienen una relación de ≈150:1; J4/J5 ≈50:1 y J6 ≈40:1. Se mide fácil: girar el motor N vueltas (contando con el encoder) y medir el ángulo del eje.

**Frenos:** el sufijo B**1**75 significa «con freno» [C, esquema de designación del manual]. Probable versión de «2 frenos» (J2 y J3) [R/I]. Revisar la placa de cada motor: B1xx = con freno, B0xx = sin freno.

## 2. Motores por eje (hipótesis [I] a confirmar con las placas)
| Eje | Motor | Especificación |
|---|---|---|
| J1 | αM6/3000 | A06B-0162-B075 o B175 |
| J2 | αM6/3000 con freno | A06B-0162-B175 (placa de 96.11) |
| J3 | α1/3000 con freno | A06B-0371-B175 (coincide con el revendedor) |
| J4 | α1/3000 sin freno | A06B-0371-B075 [R] |
| J5, J6 | α1/3000 o α0.5 | por confirmar |

## 3. Motores α1/3000 y αM6/3000 [C, B-65142E/04]
| | α1/3000 | αM6/3000 |
|---|---|---|
| Par continuo bloqueado | 1.0 N·m | 6.0 N·m |
| Par máx. (curva) | ≈3.5 N·m | ≈27 N·m |
| Corriente continua | 2.3 A rms | 8.0 A rms |
| Kt | 0.44 N·m/A rms | 0.75 N·m/A rms |
| Ke (fase) | 15.5 V rms/krpm | 26 V rms/krpm |
| Ra (fase) | 1.73 Ω | 0.463 Ω |
| Inductancia | no publicada → medir | no publicada → medir |
| Inercia del rotor | 0.00030 kg·m² | 0.0013 kg·m² |
| Masa | 2.8 kg + 1.3 con freno | 8 kg + 2.3 con freno |
| Polos [I, 200 Hz a 3000 min⁻¹] | 8 (4 pares) | 8 (4 pares) |
| Corriente pico [I] | ≈11 A pico (amp. de 12 A) | ≈50 A pico (amp. de 40/80 A) |
| Freno | 2 N·m, **90 VDC**, ≤0.2 A, 516 Ω | 8 N·m, **90 VDC**, ≤0.4 A, 295 Ω |
| Bus para 3000 min⁻¹ [I] | ≈130 V | ≈210 V |
| Velocidad con 48 V [I] | ≈1000–1250 min⁻¹ | ≈600–750 min⁻¹ |

**Pulsecoder:** sufijo 75 = **αA64**: absoluto, **65 536 cuentas/rev**, más un contador de vueltas respaldado por batería (+6VA) y un ángulo de 10 bits para la conmutación [C].
Conector redondo 3102A20-29P: SD A, *SD D, REQ F, *REQ G, +5 V J/K, 0 V N/T, blindaje H, +6VA R, 0VA S [C].
El freno probablemente va en pines libres de ese conector (B, C, E, L, M, P) [I]; se encuentra con el óhmetro (516/295 Ω).
Potencia del αM6 (18-10P): A = U, B = V, C = W, D = tierra [I].
La batería de respaldo suele ir en la base del robot o en el controlador (en los FANUC suele ser un paquete de 6 V) [I]. **Al desconectar se pierde el conteo de vueltas**: con controlador propio habrá que calibrar el cero (homing) de todos modos.

**Protocolo** (α de 4 hilos, el mismo de los β) [C, foro LinuxCNC y hostmot2]:
- RS-422 diferencial. El maestro manda un pulso **REQ positivo de ~7 a 9 µs** y el encoder responde por **SD a 1.024 Mbit/s**.
- Respuesta de ~76–77 bits: 4 tramas de (inicio + 16 bits + parada) y un **CRC de 5 bits**.
- Campos: estado (alarmas, batería, «index visto»), posición en la vuelta (16 bits), contador de vueltas y ángulo absoluto de 10 bits para conmutar.
- Los encoders nuevos (αi, de 2 hilos) van a ~2.7 Mbit/s y son distintos; el nuestro es el viejo.

Quién ya lo decodificó:
- **LinuxCNC hostmot2** (tarjetas FPGA Mesa) tiene el módulo `fanuc` con el formato `AA64` y expone la posición, la conmutación, la batería y la validez.
- **mark-v-d/motor_control** (rama `fanuc`, microcontrolador XMC4400, con la tabla de CRC).
- **Pico Systems** vende un convertidor de serie a cuadratura + U/V/W (150 USD).
- En Arduino/AVR hubo intentos parciales; un RP2040 (PIO) o un STM32 con un transceptor RS-422 alcanza sin problema [I].

## 4. Accionamientos
**Los originales:** amplificadores α SVU (A06B-6089-H1xx/H2xx) o SVM (A06B-6079/6096): SVU1-12 para α1 y SVU1-80 o SVU2-40/80 para αM6 [C].
- El controlador R-J2 del 100i se lista como A05B-2371-B002 [R].
- Son solo la etapa de potencia (PWM + medición de corriente hacia la CPU de servo FANUC). **No sirven solos** sin hacerles ingeniería inversa.

**Opciones para nosotros** (precios aproximados [I]):
| Opción | Encoder | Pros | Contras | Costo/eje |
|---|---|---|---|---|
| **A. moteus r4/n1 u ODrive Pro a 48 V** + MCU que lea el αA64 (RP2040/STM32 + RS-422), o un encoder magnético nuevo atrás del motor | el original vía MCU, o AS5047/AMT | Barato, FOC con corriente por fase (sirve para el modo colaborativo), CAN-FD, mucha documentación | Velocidad limitada (αM6 ≈600 min⁻¹ → J2 ≈24 °/s con 150:1; suficiente para un laboratorio o un cobot); ODrive Pro llega a 58 V y moteus a 44–54 V | 100–230 USD + ~20 de MCU |
| **B. PC + LinuxCNC + Mesa** (7i92T/7i76E con el `fanuc AA64` nativo) + drives de corriente o PWM | el original, sin tocarlo | El encoder se lee en FPGA, la cinemática del robot ya está en LinuxCNC, ruta probada por Excessive Overkill | Se necesita un drive de potencia aparte; tiempo real (PREEMPT_RT) | Mesa 100–250 USD por todo el robot |
| **C. Convertidor Pico + drive industrial** de terceros que acepte cuadratura + Hall (Copley, AMC) a 200–300 V | convertido | Velocidad y par completos, drive certificado | Caro; 1/8000 s de latencia; el control de corriente queda en el drive | 150 + 500–1500 USD |
| **D. STMBL** (servo abierto, hasta ~380 V CC, 2.2 kW) | resolver/serie; el soporte FANUC se menciona en el foro, **sin confirmar** | Alto voltaje, abierto, habla con LinuxCNC por smart-serial | Pocas piezas en el mercado, montaje propio, riesgo de alto voltaje | ~200–400 USD |
| **E. Diseño propio** (puente trifásico a 150–200 V, p. ej. con un módulo IPM) | MCU propio | Control total para la tesis | Lo más lento y riesgoso (alto voltaje) | — |

**Recomendación [I]:** para el primer motor, **opción A con el α1/3000** en el banco, a 24–48 V. Leer el αA64 con un RP2040 y un transceptor RS-422, y dar la conmutación al moteus u ODrive por SPI o UART (o empezar con su encoder magnético y un imán pegado a la flecha).
Antes de energizar, con el motor ya fuera:
1. Medir la resistencia y la inductancia entre fases.
2. Identificar el freno con el óhmetro y liberarlo con 90 VDC (o con ~24–48 V, que quizá no basten para liberarlo: probar).
3. Medir el Ke girándolo a mano y viendo la FCEM en el osciloscopio.

**Colaborativo con corriente:** el par se estima como Kt·Iq. Pero a través de reductores de ~150:1 la fricción y su histéresis enmascaran fuerzas de contacto pequeñas: hay que identificar un modelo de fricción y uno de dinámica. Lo realista es una detección de choques al estilo «collision guard». Para una sensibilidad de cobot (ISO/TS 15066) harían falta sensores de par por eje o encoders del lado de la salida.

## 5. Reconversiones conocidas y lecciones
- **Excessive Overkill, FANUC R-2000iA/200F** (2023): LinuxCNC + Mesa con VHDL propio para los encoders de 2 hilos a 2.7 Mbaud y 8 kHz, más ODrive a 48 V.
  - Lecciones: a 48 V quedó en ~10 % de la velocidad de diseño; el lazo de 300 Hz del ODrive y la falta de compensación de fricción limitaron el desempeño; el error de seguimiento llegó a 0.2°; leer el encoder en FPGA saca la temporización del PC; el controlador original no servía porque su firmware era de otra máquina.
- **Foros LinuxCNC / CNCZone:** el CRC se sacó por fuerza bruta. La posición fina se reinicia en el primer index en los encoders incrementales. Sin batería no hay vuelta absoluta.
- No encontré una tesis ni un proyecto publicado sobre un ARC Mate 100i en particular.

## Pendientes para confirmar en el robot
1. Fotografiar las placas de los 6 motores (sufijo B0/B1 = freno, 75 = αA64).
2. Abrir la tapa de la base: buscar la batería y una placa del robot con el número A05B-…. Ese número confirma el modelo.
3. Medir las longitudes de los eslabones y las relaciones de reducción.
4. Conseguir el manual de mecánica del ARC Mate 100i (R-J2): está en studylib y Scribd, pero no se pudo abrir sin cuenta.

**Seguridad:** J2 y J3 caen por gravedad al liberar el freno o al sacar el motor. Hay que apuntalar o bajar el brazo antes. Ojo también con los 90 VDC del freno y con el bus de alto voltaje si se elige C, D o E.
