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

| Aseguradora | Producto(s) identificados en la tabla | Estructura |
|---|---|---|
| Humana | Metrohumana 50/80/150, Practihumana 15/30/50 | Rango de edad (`DESDE`/`HASTA`) × Hombre/Mujer |
| BMI | Sigma | Edad individual (0–105+) × Región (Costa/Sierra/Austro) × Deducible (150/250/500/1000/2000) |
| SaludSA | Star 15-70, Star 30-90, Sky 70, Sky 70 Plus | Edad × plan × deducible (100/200/500) × sub-tramo (1500/2500/5000) |
| Pro | Pro 150-150, 150-300, 500-200, 500-400 | Edad × plan × sub-tramo (2500/5000/10000) |
| Confiamed | tramos 10K/15K/30K/60K/110K, con/sin maternidad | Edad × tramo × maternidad |
| VB | tramo 20K | Edad × tramo |

Sin confirmar aún si **Bupa** y la hoja genérica **Salud** (distinta de SaludSA) tienen su bloque en esta misma tabla o viven en otro lado — quedó pendiente, ver §4.

**Consecuencia directa para Fase 2:** a diferencia de Autos, en Salud **no vamos a depender de digitación manual** — hay datos reales de tarifa para poblar `rate_rules` desde el día uno, por edad/región/plan/deducible. Volqué la tabla completa (sin interpretar) a [`reference-data/salud_bases_aseguradoras_am_RAW.csv`](./reference-data/salud_bases_aseguradoras_am_RAW.csv) para no perder nada mientras se termina de mapear cada bloque a su aseguradora exacta.

### 2.4 Impuestos y cargos (aplican a ambas líneas)

Confirmado en `INFO GENERAL`: IVA `15%` (`E37`), Superintendencia de Bancos `3.5%` (`E38`), Seguro Campesino `0.5%` (`E39`), derechos de emisión por tabla de tramos de valor asegurado (`T6:V11`, de $0.50 a $9 según el tramo). Esto es exactamente lo que ya está en `premium.calculator.ts` en `ARCHITECTURE.md` §6 — sin cambios.

### 2.5 Comisión — confirmado manual, sin tabla

`BASE COMISIONES!O15` = columna `% COMISION`, de texto/número libre, sin fórmula. Se llena a mano por póliza. No hay tabla de comisión por aseguradora en ningún lado del archivo.

---

## 3. Impacto en `ARCHITECTURE.md`

- **`rate_rules` para Autos** se puede sembrar con datos reales solo para Latina y Cóndor (Fase 1). Las otras 11 arrancan sin seed, en modo manual — coherente con cómo opera hoy Delta.
- **`rate_rules` para Salud** necesita ser más rico de lo que tenía diseñado: no alcanza con "tramo de valor × tasa fija" (el modelo de Autos), hace falta **edad (o rango de edad) × región × plan × nivel de deducible × sexo (en algunos productos) × maternidad (en Confiamed)**. Esto es una tabla de tarifas multidimensional real, no una regla simple — lo reflejo en el esquema de Fase 2 cuando se diseñe a detalle, usando el CSV exportado como fuente.
- Ninguna de las macros exige lógica de servidor adicional a la ya prevista (Server Actions + Zod + servicios de dominio). No hay sorpresas de "regla de negocio escondida en VBA".

---

## 4. Pendiente (no resuelto en esta auditoría)

- Confirmar el bloque exacto de **Bupa** y **Salud** (genérica) dentro de `BASES ASEGURADORAS AM`, o si viven en otra hoja/rango.
- Mapear con precisión cada columna del CSV exportado a su aseguradora + producto + deducible (hoy está identificado por región/patrón de rótulo, falta la pasada fila-por-fila para Fase 2).
- Confirmar si `CARATULA` / `CARATULA AM` tienen alguna fórmula de composición de texto no trivial (no se revisó — son mayormente combinación de texto/mail-merge, riesgo bajo).
- Las 14 macros de "búsqueda/relleno" tienen columnas de tabla mapeadas por número de índice (`,34,FALSE`, `,35,FALSE`…) — antes de construir el buscador de renovaciones en Fase 1 hay que resolver esos 48 índices contra los encabezados reales de la tabla `BASE_VEHICULOS`.
