# Enlaces y fuentes (consultados el 20-nov-2026)

## PDFs descargados en `pdf/`
| Archivo | Qué es | Origen |
|---|---|---|
| B-65142E_alpha_servo_motor_descriptions.pdf | FANUC α series AC Servo Motor Descriptions B-65142E/04 (2001): hojas de datos, frenos, pulsecoder, conectores, amplificadores | https://www.mroelectric.com/static/app/product/pdfs/B-65142E%20%CE%B1%20Servo%20Motor%20Descriptions.pdf |
| B-65165E_alpha_amplifier_descriptions.pdf | FANUC Control Motor Amplifier α series Descriptions (B-65165E) | https://www.mroelectric.com/static/app/product/pdfs/b65165e.pdf |
| alpha_servo_amplifier_unit_SVU.pdf | α series Servo Amplifier Unit (SVU) | https://www.mroelectric.com/static/app/product/pdfs/Alpha%20Series%20Control%20Motor%20Amplifier%20Servo%20Amplifier%20Unit.pdf |
| A06B-0371-B175_servotech.pdf | Ficha del α1/3000 B175 (revendedor) | https://www.servotechusa.com/Customer-Content/www/shop-parts-and-motors/Files/A06B-0371-B175.pdf |

Otra copia de B-65142E (edición /02): https://dmitrov.cnc360.ru/files/292/65142e.pdf

## Robot (ARC Mate 100i / M-6i)
- Ficha (revendedor): https://www.robots.com/fanuc/arcmate-100i — foto con brazo J2 curvo y dos conectores Harting en la base
- Ficha con rangos y velocidades: https://rabindustries.system.machinio.com/blog/2835-fanuc-arc-mate-100i-data-sheet
- https://robotsdoneright.com/FANUC/Arcmate-Series/FANUC-Arcmate-100i.html
- S-6 (descartado por forma): https://www.robots.com/fanuc/s-6
- α1/3000 B175 como motor de **J3** del ARC Mate 100i: https://www.repair-robots.com/robot-part/fanuc-arc-mate-100i-servo-motor-type-a06b-0371-b175/
- α1/3000 B075 (sin freno) como motor de **J4**: https://www.eurobots.es/spare-part/fanuc-arc-mate-100i-servo-motor-type-a06b-0371-b075-en.html
- αM6/3000 B175 usado en M-6i, S-420i, S-430i: https://www.alliancerobotics.com/product-page/a06b-0162-b175
- Controlador R-J2 del ARC Mate 100i A05B-2371-B002 (revendedor): https://www.dosupply.com/automation/fanuc/a05b/A05B-2371-B002
- Manual de mantenimiento ARC Mate 100i / M-6i (no se pudo abrir, Cloudflare): https://studylib.net/doc/25655168/fanuc-arc-mate-100i-model-b--m-6i-model-b-maintenance-manual
- Manual del R-J2 (B-80525EN/04, Scribd, requiere cuenta): https://www.scribd.com/document/469304912/FANUC-Robotic-pdf
- Geometría del M-6iB (sucesor, referencia de DH): https://github.com/ros-industrial/fanuc/blob/indigo-devel/fanuc_m6ib_support/urdf/m6ib_macro.xacro

## Protocolo del Pulsecoder
- Foro LinuxCNC «Fanuc encoders» (tramas, CRC, REQ): https://forum.linuxcnc.org/27-driver-boards/57395-fanuc-encoders
- Código de decodificación (β, mismo protocolo de 4 hilos): https://github.com/mark-v-d/motor_control/tree/fanuc (`software/xmc4400/src/encoder.cpp`, `crc_lut.h`)
- LinuxCNC hostmot2, módulo `fanuc` con formato `AA64`: https://linuxcnc.org/docs/stable/html/man/man9/hostmot2.9.html
- CNCZone: https://www.cnczone.com/forums/fanuc/127192-need-serial-pulse-coder-info.html y https://www.cnczone.com/forums/fanuc/172614-fanuc-abs-pulse-coder.html
- Granite Devices / Argon con pulse coder FANUC (certificado vencido, no leído): http://openservodrive.com/fanuc-serial-pulse-coder-support-argon-servo-drive/
- Convertidor Pico Systems (serie → cuadratura + U/V/W): https://pico-systems.com/fanser.html , pines https://www.pico-systems.com/fanser_pins.html , cables https://pico-systems.com/fanser_conn.html , tienda (150 USD) https://picosystems.store/?p=705

## Reconversiones
- Excessive Overkill, R-2000iA con LinuxCNC + Mesa + ODrive: https://hackaday.com/2023/05/14/industrial-robot-gets-open-source-upgrade/ , video https://www.youtube.com/watch?v=P2O8KCmVjU0 , resumen https://www.polytechforum.com/cnc-machines/six-axis-industrial-robot-arm-running-as-a-cnc-machine-1630550-.htm
- STMBL (servo abierto hasta ~380 V CC): https://github.com/rene-dev/stmbl , https://freakontrol.github.io/stmbl/docs/introduction
- Foro LinuxCNC, integrar amplificadores FANUC: https://forum.linuxcnc.org/30-cnc-machines/20837-fanuc-servo-drive-integration
