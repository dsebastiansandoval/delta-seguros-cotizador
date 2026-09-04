# Auditoría del archivo fuente — `COTIZADOR DELTA.xlsm`

> Documento de ingeniería. Registra qué se revisó, qué se encontró y qué queda pendiente sobre las **198 macros VBA** y las **fórmulas de las 30 hojas** del archivo original. Es la base para diseñar `rate_rules` y las reglas de negocio de Delta Check. Complementa a `ARCHITECTURE.md`.

**Método:** extracción de las macros con `oletools`/`olevba` (código VBA completo, no solo nombres) y lectura de fórmulas con `openpyxl` en modo `data_only=False` (fórmula real, no el valor cacheado) sobre las 30 hojas. Los datos de tarifas reales quedaron exportados en [`reference-data/`](./reference-data/).

---

## 1. Macros VBA — clasificación completa de las 198

Clasifiqué el cuerpo de cada macro (no el nombre) buscando patrones de negocio: literales numéricos con operadores, porcentajes, palabras `Tasa`/`IVA`/`Comisión`. **Resultado: cero macros contienen cálculo de negocio.** El desglose:

| Categoría | Cantidad | Qué hacen | Ejemplo |
|---|---|---|---|
| Alternar visibilidad de plan/cobertura | 122 | Cambian un flag de texto (`"ON"`/`"OFF"`, `"Sí otorga"`/`"No otorga"`) y muestran/ocultan filas, columnas o shapes según ese flag | `AIG_MOSTRAR_OCULTAR`, `BMI_MOSTRAR_OCULTAR_GMM_10K` |
| Búsqueda / relleno automático | 14 | `VLOOKUP` masivo contra una tabla Excel (`ListObject`) para traer ~48 campos de una cotización o vehículo anterior a partir de una referencia | `BUSCAR_BASE_VEHICULOS`, `BUSCAR_BASE_EMISIONES_PENDIENTE` |
| Alta en base de seguimiento | 6 | Validan que el formulario no esté vacío, agregan una fila a una tabla Excel, muestran `MsgBox` de confirmación | `ALTA_EN_BASE_EMISIONES`, `ALTA_EN_BASE_CANCELADAS` |
| Limpiar formulario | 3 | `ClearContents` sobre el rango del formulario | `LIMPIAR_EMISION`, `LIMPIAR_PENDIENTE` |
| Imprimir / exportar | 3 | `PrintOut` / exportar el rango de la carátula u oferta | `IMPRIMIR_OFERTA_VH`, `IMPRIMIR_OFERTA_AM`, `IMPRIMIR_OFERTA_XKM` |
| Navegación de menú | 19 | Seleccionan una hoja, sin lógica adicional | `HOME`, `DASHBOARD` |
| **Flujo/estado de módulo** | ~31 | Preparan una hoja para un modo de trabajo específico — ver §1.1 | `NUEVA`, `RENOVACION`, `CARTERA`, `PENDIENTES`, `PRODUCTOS`, `VEHICULOS`, `ASISTENCIA_MEDICA`, `AUTOXKM`, `PAGOS`, `CANCELADAS`, `SINIESTROS`, `EMISION` |

**Conclusión de riesgo:** migrar la lógica de las macros es **bajo riesgo**. No hay un "motor oculto" en VBA — todo lo que decide un número (prima, impuesto, deducible) vive en fórmulas de hoja, y esas sí las documenté a fondo (§2). Las macros son mecánica de formulario de Excel que en Delta Check se reemplaza por componentes de UI estándar (toggles, validación de formulario con Zod, botón "Buscar" que llama a un Server Action).

### 1.1 Los "botones de menú" = las rutas de Delta Check

Estas macros no tienen lógica compleja (30-65 líneas, casi todo `Sheets(...).Select` + `ClearContents` + posicionar el cursor), pero **su sola existencia confirma el mapa de navegación real de la app**, útil para no inventar rutas de más o de menos:

| Macro | Preparación que hace | Ruta equivalente en Delta Check |
|---|---|---|
| `HOME` / `DASHBOARD` | Va al menú principal | `/` |
| `PRODUCTOS` | Menú de selección de ramo | `/cotizar` |
| `VEHICULOS` | Entra al flujo de Autos | `/cotizar/autos` |
| `NUEVA` | Limpia el formulario para cotización nueva | `/cotizar/autos/nueva` |
| `RENOVACION` | Prepara el formulario para buscar una póliza existente | `/cotizar/autos/renovacion` |
| `AUTOXKM` | Entra al flujo de Auto x Km | `/cotizar/autos/km` |
| `ASISTENCIA_MEDICA` | Entra al flujo de Salud | `/cotizar/salud` |
| `EMISION` | Registrar una póliza emitida | `/cartera/emisiones/nueva` |
| `CARTERA` / `PENDIENTES` | Ver cartera pendiente de pago | `/cartera/pendientes` |
| `CANCELADAS` | Registrar cancelación | `/cartera/canceladas/nueva` |
| `SINIESTROS` | Registrar siniestro | `/siniestros/nuevo` |
| `PAGOS` | Formas de pago / cuotas | Parte del flujo de oferta, no ruta propia |

---

## 2. Fórmulas — dónde vive realmente cada número

Búsqueda global de fórmulas `VLOOKUP` en las 30 hojas (motor real de tarifas, si existe):

| Hoja | VLOOKUPs encontrados | Línea | Interpretación |
|---|---|---|---|
| SALUD | 210 | Salud | Tabla de tarifas real |
| SALUDSA | 132 | Salud | Tabla de tarifas real |
| BMI | 96 | Salud | Tabla de tarifas real |
| CONFIAMED | 96 | Salud | Tabla de tarifas real |
| OFERTA AM | 69 | Salud | Arma la comparativa desde las tablas anteriores |
| HUMANA | 36 | Salud | Tabla de tarifas real |
| OFERTA | 13 | Autos | Solo Latina/Cóndor + derechos de emisión |
| PRO | 12 | Salud | Tabla de tarifas real |
| DATOS OFERTA | 8 | Autos | Solo Latina/Cóndor |
| OFERTA KM | 6 | Autos x Km | Solo referencia de rótulos, **no** tabla de tasas |
| VB | 6 | Salud | Tabla de tarifas real |
| INFO GENERAL | 4 | Ambas | Fuente de las tablas de Autos (RC1/RC2, emisión) |
| DATOS VH | 1 | Autos | — |

**Hallazgo central: Autos y Salud son estructuralmente opuestos.**

### 2.1 Autos (anual) — 11 de 13 aseguradoras son digitación manual

Verificado celda por celda (no fórmula) en `DATOS OFERTA`: AIG, SESA, Generali, Zurich, Sweaden, Atlántida, Alianza, Constitución, Unidos, Asegsur y Chubb tienen la Prima Neta como **input literal `0`** — el ejecutivo la escribe por cotización. **Latina y Cóndor** sí tienen motor real: `VLOOKUP` contra `INFO GENERAL!AF7:AI25`, por rango de valor asegurado × clase (`LIVIANO`/`PICKUP`) × antigüedad (≤10 años tabla completa, 11–13 años tasa plana 3%, >13 no cotiza). Exportado en [`reference-data/autos_tasas_latina_condor_y_cargos.csv`](./reference-data/autos_tasas_latina_condor_y_cargos.csv).

### 2.2 Auto x Km — 100% manual, igual que Autos anual

`OFERTA KM!H37` deriva la prima neta desde `DATOS OFERTA X KM!E10`, que es input manual por cada uno de los 6 rangos de km (900 a 10.000 km). No hay tabla de tasas para esta modalidad.

### 2.3 Salud (AM) — motor de tarifas real y completo, para prácticamente todas las aseguradoras

**Este es el hallazgo más importante de la auditoría.** Existe una hoja oculta, `BASES ASEGURADORAS AM` (238 filas × 152 columnas), que es una tabla maestra de tarifas real, de producción, para múltiples aseguradoras concatenadas verticalmente. Confirmé mediante `VLOOKUP` por edad (`'DATOS AM'!F10`, la edad del titular o dependiente) que **BMI la usa en vivo** (`VLOOKUP(edad, 'BASES ASEGURADORAS AM'!B35:T140, columna_por_región)`), y por los rótulos de columna encontré bloques que corresponden a:

**Actualización — mapeo cerrado con evidencia de fórmula, no por patrón de rótulo.** En vez de inferir qué bloque pertenece a qué aseguradora por el nombre del producto, revisé las fórmulas `VLOOKUP` de las hojas `BMI`, `HUMANA`, `SALUDSA`, `CONFIAMED`, `PRO`, `VB`, `SALUD` y `BUPA` una por una — cada una dice exactamente contra qué rango de `BASES ASEGURADORAS AM` apunta. Esto es autoridad de fórmula, no adivinado:

| Aseguradora | Rango real en `BASES ASEGURADORAS AM` | Producto(s) | Estructura |
|---|---|---|---|
| Humana | `B7:O28` aprox. | Metrohumana 50/80/150, Practihumana 15/30/50 | Rango de edad (`DESDE`/`HASTA`) × Hombre/Mujer |
| BMI | `B35:AX~145` | Sigma, Innova, GMM | Edad individual (0–105+) × Región (Costa/Sierra/Austro) × Deducible (I150/D150/D250/D500/D1000/D2000), GMM con tramos 5K/10K/15K/20K |
| Confiamed | `B151:K167`, `M151:V167`, `X151:AG167`, `AI151:AR167` (4 tramos) | tramos 10K/30K/60K/110K | Edad × Red1/Red2 × con/sin maternidad × sexo |
| SaludSA | `DF179:EN187` (+ `DF191:EN191` para edad<2) | Único 7K, Esencial 15K, Práctico 30K (2 variantes), Ideal 45K (2 variantes), Elite 100K (2 variantes), Privilegio 1M (2 variantes), Privilegio Plus 1M | Edad × plan × sexo (mujer: con/sin maternidad) |
| **Salud** (genérica) | 9 bloques `179:187` (adultos) + 9 bloques `190:191` (niños, uno en columnas separadas) | Star 15-70, Star 30-90, Sky 70-100, Sky 70 Plus-100, Sky 70 Plus-200, Pro 150-150, Pro 150-300, Pro 500-200, Pro 500-400 — cada uno con 3-4 variantes de deducible (35 planes en total) | Edad × sexo, **dos tablas por producto** — ver estructura abajo |
| **Pro** | `B200:G210` | "Plan 10.000" / "Plan 15.000" | Edad × sexo |
| **VB** | `B224:G238` | "Plan Predilecto 20.000" + rider dental | Edad × sexo, con tabla dental aparte (Básico/Plus × sexo) |
| **Bupa** | — | — | **Confirmado 100% manual: cero fórmulas `VLOOKUP` en toda la hoja `BUPA`.** Mismo patrón que 11 de las 13 aseguradoras de Autos. |

**Corrección importante sobre SaludSA vs. Salud (genérica):** una pasada anterior de esta auditoría había atribuido el rango `D176:BH187` a SaludSA, basado en rótulos cercanos ("Star 15-70", "Sky 70 Plus", etc.) y en el nombre de las macros `SALUDSA_MOSTRAR_OCULTAR_STAR_*`. Al revisar la fórmula `VLOOKUP` real de la hoja `SALUDSA` (no el rótulo), esa hoja apunta a `DF179:EN187` — una zona completamente distinta, columnas 110–144, no 4–60. El bloque `D176:BH187` que había explorado en realidad son los propios 9 sub-bloques de producto de la hoja **`SALUD` genérica** (columnas B, K, V, AG, AR, BN, BY, CJ, CU, cada uno de ~9 columnas). Los rótulos "Star"/"Sky" que vi ahí pertenecen a Salud genérica, no a SaludSA.

**Estructura real de Salud (genérica), confirmada por fórmula (`SALUD!D9`, `D53`, etc.):** cada uno de los 9 productos tiene **dos tablas separadas**, seleccionadas por la propia fórmula según la edad:

- **Adultos** (`edad>=18`): filas `181:187` del bloque del producto (7 tramos: 18-23, 24-31, 32-49, 50-60, 61-65, 66-70, 71-999). Las filas `179:180` del mismo bloque (0-1, 2-17) **existen pero son datos muertos** — la fórmula nunca las lee, porque cualquier edad <18 siempre toma la otra tabla. No se siembran.
- **Niños** (`edad<18`): filas `190:191` (2 tramos: 0-1, 2-17), casi siempre en el mismo bloque de columnas que la tabla de adultos — **excepto el producto Sky 70 Plus-200**, cuya tabla de niños vive en un bloque de columnas totalmente distinto (`BC190:BL191`, en vez de `AR190:AR191`), confirmado revisando la fórmula `SALUD!D53` que referencia exactamente ese rango. Ese bloque `BC:BL` es el que antes parecía "huérfano" (tenía rótulo "Sky 70 Plus-500" duplicado y ningún rango principal `179:187` propio) — la duplicación del rótulo es un artefacto de copiado en el Excel, no un décimo producto real.
- **Dato faltante real:** la tabla de niños de Sky 70 Plus-200 (`BC190:BL191`) existe como rango con encabezados pero **las celdas de precio están vacías** — cero datos, en las 8 combinaciones (4 variantes de deducible × M/F). La fórmula que las referencia cae en su `IFERROR(...,0)`, es decir, un niño cotizando ese plan vería $0 en el Excel en vez de "no disponible". No sembré esas 4 combinaciones para edad<18 — mismo criterio que Practihumana 50 en Humana (no se inventa un precio real donde el Excel solo tiene un cero de fallback).

Esto reemplaza la nota anterior ("Salud genérica solo tiene 2 tramos de edad, 0–1 y 2–17") que estaba basada en una lectura incompleta de las fórmulas — la estructura real es mucho más rica: 35 planes (9 productos × 3-4 variantes de deducible) × edad × sexo, con tabla de adulto y de niño por separado.

**Hallazgo de datos en VB:** el Excel guarda el `HASTA` de cada tramo de edad igual al `DESDE` del siguiente (p. ej. tramo `35–40` y tramo `40–45`, ambos incluyen el 40). Pero `VLOOKUP(edad, rango, columna, TRUE)` en modo aproximado **solo usa la columna DESDE** para ubicar la fila — el `HASTA` es puramente informativo/visual en la hoja, nunca se evalúa. Confirmado leyendo la fórmula de `VB!C8` (`TRUE` como cuarto argumento). Si se siembra el `HASTA` tal como aparece en la celda, una edad límite (ej. 40) matchea dos filas a la vez, lo cual rompe la lógica de "todo miembro debe tener precio en el mismo plan" del comparador. Se corrigió en la siembra: `ageMax` efectivo = `DESDE` del siguiente tramo − 1 (no el valor literal de la celda `HASTA`). Ningún otro asegurador de Salud tiene este patrón — Confiamed, SaludSA y Pro ya traían el `HASTA` como `DESDE_siguiente − 1` de forma nativa.

**Consecuencia directa para Fase 2:** a diferencia de Autos (11 de 13 sin tabla), acá es al revés — **7 de las 8 aseguradoras de Salud tienen motor de tarifas real**, solo Bupa queda en modo manual. Volqué la tabla completa (sin interpretar) a [`reference-data/salud_bases_aseguradoras_am_RAW.csv`](./reference-data/salud_bases_aseguradoras_am_RAW.csv). **Fase 2 completa:** sembradas con datos reales las 7 — BMI (Sigma), Humana, Confiamed, SaludSA, Pro, VB y Salud genérica — todas con rango confirmado por la propia fórmula de su hoja, exportadas a JSON (`reference-data/salud_*.json`) y verificadas centavo a centavo contra el Excel vía ejecución directa del comparador, incluida la edad límite exacta (18 años) donde la tabla de adulto y la de niño de Salud genérica se separan sin solaparse. Solo **Bupa** queda 100% manual (sin tabla).

### 2.4 Impuestos y cargos — **solo Autos, no Salud**

Confirmado en `INFO GENERAL`: IVA `15%` (`E37`), Superintendencia de Bancos `3.5%` (`E38`), Seguro Campesino `0.5%` (`E39`), derechos de emisión por tabla de tramos de valor asegurado (`T6:V11`, de $0.50 a $9 según el tramo). Esto es exactamente lo que ya está en `premium.calculator.ts`.

**Corrección a lo que decía antes este documento ("aplican a ambas líneas"):** no es cierto. Busqué toda referencia a `INFO GENERAL!E37/E38/E39` en las hojas `BMI`, `HUMANA`, `SALUD`, `SALUDSA`, `CONFIAMED`, `PRO`, `VB`, `BUPA`, `OFERTA AM` y `CARATULA AM` — **cero resultados**. Ninguna hoja de Salud aplica IVA, Superintendencia de Bancos ni Seguro Campesino. La prima de Salud que se le muestra al cliente es directamente la suma de las primas individuales de cada miembro (titular + dependientes) para el plan elegido, sin ninguna capa de impuesto encima. Consecuencia para el código: `premium.calculator.ts` es exclusivo de Autos — Salud no lo usa, ni una versión adaptada de él.

### 2.5 Comisión — confirmado manual, sin tabla

`BASE COMISIONES!O15` = columna `% COMISION`, de texto/número libre, sin fórmula. Se llena a mano por póliza. No hay tabla de comisión por aseguradora en ningún lado del archivo.

---

## 3. Impacto en `ARCHITECTURE.md`

- **`rate_rules` para Autos** se puede sembrar con datos reales solo para Latina y Cóndor (Fase 1). Las otras 11 arrancan sin seed, en modo manual — coherente con cómo opera hoy Delta.
- **`rate_rules` para Salud** necesita ser más rico de lo que tenía diseñado: no alcanza con "tramo de valor × tasa fija" (el modelo de Autos), hace falta **edad (o rango de edad) × región × plan × nivel de deducible × sexo (en algunos productos) × maternidad (en Confiamed)**. Esto es una tabla de tarifas multidimensional real, no una regla simple — lo reflejo en el esquema de Fase 2 cuando se diseñe a detalle, usando el CSV exportado como fuente.
- Ninguna de las macros exige lógica de servidor adicional a la ya prevista (Server Actions + Zod + servicios de dominio). No hay sorpresas de "regla de negocio escondida en VBA".

---

## 4. Cartera, comisiones y siniestros (Fase 3) — columnas reales, estados sin definir

Las 5 hojas de back-office (`BASE EMISIONES`, `BASE PENDIENTE`, `BASE COMISIONES`, `BASE CANCELADAS`, `BASE SINIESTROS`) son tablas Excel (`ListObject`) reales, con nombre y columnas propias — las leí directamente de la definición de la tabla, no del texto visible en pantalla:

| Hoja | Columnas reales (`ListObject`) |
|---|---|
| `BASE_EMISIONES` | REFERENCIA, FECHA EMISION, DOCUMENTO, FUENTE, C.I., NOMBRES, APELLIDOS, RAMO, ASEGURADORA, POLIZA, ANEXO, ESTATUS, PRIMA, DOC, OBSERVACIONES |
| `BASE_PENDIENTE` (cartera) | REFERENCIA, FECHA EMISION, DOCUMENTO, FUENTE, C.I., NOMBRES, APELLIDOS, RAMO, CIA, ASEGURADORA, ESTATUS, FORMA DE PAGO, CUOTAS, POLIZA, ANEXO, FACTURA, PRIMA, SUPER BCOS, SC, DERECHOS EMISION, IVA, TOTAL, VALOR CUOTA, VALOR PENDIENTE, **1..12** (una columna por cuota mensual), OBSERVACIONES |
| `BASE_COMISIONES` | REFERENCIA, FECHA EMISION, DOCUMENTO, FUENTE, C.I., NOMBRES, APELLIDOS, POLIZA, RAMO, CIA, ASEGURADORA, CARTERA, PRIMA, % COMISION, ESTATUS, OBSERVACIONES |
| `BASE_CANCELADAS` | FECHA CANCELACION, C.I., NOMBRES, APELLIDOS, FUENTE, ASEGURADORA, RAMO, POLIZA, PRIMA, ESTATUS, COMISION, OBSERVACIONES |
| `BASE_SINIESTROS` | FECHA SINIESTRO, FECHA REPORTE, C.I., NOMBRES, APELLIDOS, RAMO, ASEGURADORA, POLIZA, TALLER, ASESOR, CONTACTO, PLACA, MARCA, MODELO, RC, PLACA RC, ESTATUS, VALOR, VALOR RC, OBSERVACIONES |

**Las 5 tablas están vacías** (sin filas de datos, solo encabezado) — no hay histórico real que migrar, coherente con la decisión ya tomada de no migrar histórico del Excel (ARCHITECTURE.md §11.6, se trae de SoftSeguros cuando el tenant lo tenga activado).

**`ESTATUS` es texto libre en las 5 hojas — no hay un vocabulario fijo que extraer.** Revisé: (a) validación de datos de cada hoja — cero listas desplegables sobre la columna ESTATUS (la única lista real encontrada en las 5 hojas es `P14` de `BASE SINIESTROS`, `"SI,NO"`, que corresponde a la columna RC, no a ESTATUS); (b) `DASHBOARD`/`BASE DASHBOARD` — ambas hojas están completamente vacías, sin fórmulas `COUNTIF`/`SUMIF` que referencien literales de estado; (c) el código de las 5 macros `ALTA_EN_BASE_*` — ninguna escribe un valor literal en la columna ESTATUS, solo copian celdas del formulario (y de hecho ni siquiera todas las columnas se copian: `ALTA_EN_BASE_EMISIONES` solo llena 7 de las 15 columnas de su tabla, dejando ASEGURADORA/POLIZA/ANEXO/ESTATUS/PRIMA/DOC/OBSERVACIONES para digitación manual posterior). Conclusión: los valores de los enums de estado (`issue_status`, `payment_status`, `lifecycle_status`, `commission_status`, `claim_status`) en el esquema de Delta Check son una decisión de producto razonable, no un hecho extraído del Excel — a diferencia de los enums de Autos/Salud, que sí vienen de una fórmula o lista de validación real.

**Hallazgo de regla de negocio real, sí confirmado en código:** la macro `ALTA_EN_BASE_PENDIENTE` (botón "Cartera") escribe una fila nueva en `BASE_PENDIENTE` **y**, en el mismo procedimiento, otra fila en `BASE_COMISIONES` con los mismos datos base (referencia, fecha, documento, cliente, aseguradora, prima). Es decir: **registrar una póliza en cartera crea automáticamente su registro de comisión pendiente** — no son dos pasos manuales independientes. Delta Check reproduce esto: `policyService.emitPolicy()` crea la póliza y la comisión (`status: PENDIENTE`, sin `percent`/`amountCents` todavía) en la misma transacción.

---

## 5. Pendiente (no resuelto en esta auditoría)

- ~~Confirmar el bloque exacto de Bupa y Salud (genérica)~~ — resuelto en §2.3, con evidencia de fórmula.
- ~~Mapear columna por columna (tramo/red/maternidad exactos) de Confiamed, SaludSA, Pro y VB para poder sembrarlos con datos reales~~ — resuelto: los 4 están sembrados con datos reales, verificados contra el Excel.
- ~~Mapear los 9 sub-bloques de Salud (genérica) a nombres de plan concretos~~ — resuelto: los rótulos sí existen en `BASES ASEGURADORAS AM` (filas 176/177, no en la hoja `SALUD`), confirmados y sembrados los 9 productos con sus 35 variantes, adulto y niño por separado.
- Fase 2 queda completa. Único ítem real sin resolver de Salud: **Bupa** sigue 100% manual (confirmado, no es un mapeo pendiente — la hoja no tiene tabla).
- Confirmar si `CARATULA` / `CARATULA AM` tienen alguna fórmula de composición de texto no trivial (no se revisó — son mayormente combinación de texto/mail-merge, riesgo bajo).
- ~~Las 14 macros de "búsqueda/relleno" tienen columnas de tabla mapeadas por número de índice (`,34,FALSE`, `,35,FALSE`…) — antes de construir el buscador de renovaciones hay que resolver esos 48 índices contra los encabezados reales de la tabla `BASE_VEHICULOS`~~ — resuelto: se leyó el `ListObject BASE_VEHICULOS` completo (120 columnas con nombre) y se contrastó índice por índice contra el código real de `BUSCAR_BASE_VEHICULOS`. La referencia de búsqueda es `DATOS VH!O21`, y la macro trae (por índice de columna dentro de `BASE_VEHICULOS[REFERENCIA]:[MES]`): 3=C.I., 4=NOMBRES, 5=APELLIDOS, 6=NACIMIENTO/CONSTITUCION, 8=GENERO, 9=ESTADO CIVIL, 10=DOCUMENTO, 11=EJECUTIVO, 12=FUENTE, 13=CIA ANTERIOR, 14=No. POLIZA, 15=INICIO VIGENCIA, 17=PRIMA ANTERIOR, 18-25=PLACA/AÑO/MARCA/TIPO/MODELO/COLOR/VALOR/ACC del riesgo 1, 26-33/34-41/42-49=lo mismo para los riesgos 2/3/4 (hasta 4 vehículos por referencia), y 50-107=la prima que cada una de las 13 aseguradoras había cotizado la vez anterior (más los 6 rangos de Auto x Km, idx 63-68), para los 3 primeros riesgos. Implementado en Delta Check como `renewalService.findPreviousVehicleData()` (§17 de `ARCHITECTURE.md`) — no se replicó la copia plana de "prima por aseguradora la vez pasada" (idx 50-107): esa comparación completa ya vive en `quote_options` de la cotización anterior del mismo vehículo, no hace falta duplicarla a mano como tenía que hacer el Excel.
