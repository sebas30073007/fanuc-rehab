# Motores FANUC α del robot — tablas transcritas

Fuente principal: **FANUC AC Servo Motor α series Descriptions, B-65142E/04 (feb-2001)**, copia local en `pdf/B-65142E_alpha_servo_motor_descriptions.pdf`
(origen: https://www.mroelectric.com/static/app/product/pdfs/B-65142E%20%CE%B1%20Servo%20Motor%20Descriptions.pdf).
Páginas del PDF (no del manual) entre corchetes.

## 1. Hojas de datos (confirmado, transcrito del manual)

| Parámetro | Símbolo | α1/3000 (A06B-0371) [p.126] | αM6/3000 (A06B-0162) [p.170] | Unidad |
|---|---|---|---|---|
| Velocidad nominal máx. | Nmax | 3000 | 3000 | min⁻¹ |
| Par a rotor bloqueado (continuo) | Ts | 1.0 | 6.0 | N·m |
| Inercia del rotor | Jm | 0.00030 | 0.0013 | kg·m² |
| Corriente RMS continua bloqueado | Is | 2.3 | 8.0 | A rms |
| Constante de par | Kt | 0.44 | 0.75 | N·m/A rms |
| Constante FCEM (por fase) | Ke | 15.5 | 26 | V rms/1000 min⁻¹ |
| Constante FCEM (por fase) | Kv | 0.15 | 0.25 | V rms·s/rad |
| Resistencia de armadura (por fase) | Ra | 1.73 | 0.463 | Ω |
| Constante de tiempo mecánica | tm | 0.010 | 0.003 | s |
| Constante de tiempo térmica | tt | 15 | 45 | min |
| Fricción estática | Tf | 0.10 | 0.3 | N·m |
| Masa (sin freno) | — | 2.8 | 8 | kg |
| Par intermitente máx. (leído de la curva) | — | ≈3.5 (plano hasta 3000) | ≈27 hasta 2000, cae a ≈20 a 3000 | N·m |

Valores a 20 °C, tolerancia ±10 %. **La inductancia no viene en este manual**: medirla con LCR (fase-fase) antes de sintonizar el lazo de corriente.

### Datos de las placas (fotos de Huber)
| | α1/3000 | αM6/3000 |
|---|---|---|
| Especificación | A06B-0371-B175 | A06B-0162-B175 |
| Salida | 0.3 kW | 1.4 kW (cont.) |
| Voltaje | 90 V | 144 V |
| Corriente | 2.5 A (otra placa: 2.3 A) | 6.0 A |
| Frecuencia a 3000 min⁻¹ | 200 Hz | 200 Hz |
| Fechas vistas | 98.11, 00.05 | 96.11 |
| Manual citado en la placa | B-65142E | — |

**Derivado (no viene en el manual):**
- 200 Hz a 3000 min⁻¹ (50 rev/s) → **4 pares de polos (8 polos)** en ambos.
- Sufijo B175 según el esquema de designación del manual (A06B-xxxx-B☆○○): ☆ = 1 → **eje cónico con freno**; ○○ = 75 → **Pulsecoder αA64 (absoluto, 65 536 cuentas/rev)**. (77 = αI64 incremental, 88 = αA1000.)
- Corriente pico estimada para el par máximo: α1 ≈ 3.5/0.44 ≈ 8 A rms ≈ 11 A pico (coincide con el amplificador de 12 A); αM6 ≈ 27/0.75 ≈ 36 A rms ≈ 51 A pico (coincide con amplificadores de 40/80 A).
- Voltaje de bus mínimo (suponiendo que Kv es por fase, rms): FCEM línea-línea pico = Kv·√2·√3.
  - α1: 0.367 V·s/rad → 3000 min⁻¹ ≈ 115 V pico LL; **con 48 V ≈ 1250 min⁻¹ en vacío** (≈1000 útil).
  - αM6: 0.612 V·s/rad → 3000 min⁻¹ ≈ 192 V pico LL; **con 48 V ≈ 750 min⁻¹ en vacío** (≈600 útil).
  - El amplificador original trabaja con ~300 V CC (200 VAC rectificado).

## 2. Frenos integrados (confirmado, B-65142E §7.1 [p.95])

| Modelo | Par de freno | Liberación / frenado | Alimentación | Corriente | Resistencia bobina | Masa extra | Inercia extra |
|---|---|---|---|---|---|---|---|
| α1, α2, αM2, αM2.5 | 2 N·m | 60 / 20 ms | **90 VDC ±10 %** | ≤0.2 A | 516 Ω | 1.3 kg | 0.00002 kg·m² |
| α3, α6, αM6, αM9 | 8 N·m | 70 / 30 ms | **90 VDC ±10 %** | ≤0.4 A | 295 Ω | 2.3 kg | 0.00007 kg·m² |
| (versiones HV) | — | — | 24 VDC | — | 21 Ω | — | — |

Sin polaridad. FANUC conecta: 90 VDC → interruptor → supresor de picos + varistor (spark killer) → bobina. Freno de seguridad: se libera con voltaje (sin voltaje = frenado).
Prueba útil: con un óhmetro, buscar en los conectores del motor el par de pines con **≈516 Ω (α1)** o **≈295 Ω (αM6)**: ese es el freno.

## 3. Pulsecoder (encoder) (confirmado, B-65142E §6)

| Tipo | Resolución | Absoluto/incremental |
|---|---|---|
| αA64 | 65 536 div/rev | Absoluto (con batería) |
| αI64 | 65 536 div/rev | Incremental |
| αA1000 | 1 000 000 div/rev | Absoluto |

### Pines de señal: conector redondo H/MS3102A20-29P (motores α3 en adelante y αM6) [p.85]
| Señal | Pin |
|---|---|
| SD (datos serie, RS-422 +) | A |
| *SD | D |
| REQ (petición, RS-422 +) | F |
| *REQ | G |
| +5 V | J, K |
| 0 V | N, T |
| Blindaje | H |
| +6VA (batería) | R |
| 0VA (batería) | S |
| Libres en la versión CNC | B, C, E, L, M, P |

> **Inferido:** en los motores de robot (sufijo B175) el freno viaja por el cable de pulsecoder (no se ve un tercer conector en las fotos), así que probablemente use dos de los pines libres (B, C, E, L, M, P). Verificar con óhmetro (516/295 Ω) antes de energizar nada.

### Versión CNC del α1/α2: D-SUB 15 (Hirose SDAB-15P) [p.85] — por referencia
SD 12, *SD 13, REQ 5, *REQ 6, +5 V 8 y 15, 0 V 1-2-3, blindaje 4, +6VA 14, 0VA 10.
**Ojo:** el α1 del robot (B175) tiene conectores redondos según las fotos, no el D-SUB de la versión CNC; los pines pueden seguir el patrón de la tabla redonda. Verificar.

### Potencia
- αM6/3000: H/MS3102A18-10P-D-T (Hirose), 4 pines. Asignación FANUC habitual **A = U, B = V, C = W, D = tierra** (inferida, confirmar con óhmetro: entre fases ≈2×Ra = 0.93 Ω; tierra aislada).
- α1 (versión CNC): AMP 176339-2, con el freno en el mismo conector. La versión robot es redonda (foto); misma prueba: entre fases ≈3.5 Ω.

### Especificación eléctrica del pulsecoder (tabla de pulsecoder separado, referencial)
5 V ±5 %, hasta 0.35 A, 0 a 60 °C. Batería de respaldo +6VA para el conteo de vueltas.

## 4. Amplificadores α compatibles (confirmado, B-65142E §2.1 [p.21, p.25])

| Motor | Amplificador | Especificación |
|---|---|---|
| α1/3000, α2 | SVU1-12 | A06B-6089-H101 |
| α1/3000, α2 | SVM1-12 | A06B-6079-H101 / A06B-6096-H101 |
| α1/3000, α2 | SVU2-12/12, SVU3-12/12/12… | A06B-6089-H201/H301… |
| αM6/3000, α6/3000 | SVU1-80 | A06B-6089-H105 |
| αM6/3000, α6/3000 | SVM1-80 | A06B-6079-H105 / A06B-6096-H105 |
| αM6/3000, α6/3000 | SVU2-40/80, SVU2-80/80, SVU2-12/80, SVU2-20/80 | A06B-6089-H207/H208/H209/H210 |

El número (12, 40, 80) es la corriente pico del canal en A. Estos amplificadores **no cierran el lazo**: reciben PWM y devuelven corriente al CPU de servo FANUC (interfaz propietaria), así que no se pueden usar solos sin ingeniería inversa.
