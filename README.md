# Cotizador Delta — MVP visual + propuesta comercial

Proyecto para modernizar el cotizador de seguros de [Delta Seguros](https://deltaseguros.com.ec/), hoy resuelto con un archivo de Excel con macros (`COTIZADOR DELTA.xlsm`). El objetivo final es una plataforma web que reemplace ese archivo e integre las APIs de las aseguradoras. Este repo contiene, por ahora, la primera etapa: una maqueta visual (sin funcionalidad) y la propuesta comercial para presentarle a **Diego Viera**.

## Archivo fuente

`COTIZADOR DELTA.xlsm` — 30 hojas, macros VBA. Estructura relevante:

- **Autos:** `DATOS VH` (datos de cliente/vehículo) → `DATOS OFERTA` + `OFERTA` (comparador de **13 aseguradoras**: AIG, SESA, Generali, Zurich, Sweaden, Atlántida/Liberty, Alianza, Constitución, Unidos, Latina, Asegsur, Chubb, Cóndor) → `CARÁTULA` (carta de oferta final al cliente).
- **Salud (AM):** mismo flujo para **8 aseguradoras** (BMI, Humana, SaludSA, Salud, Confiamed, Bupa, Pro, VB), hojas `CARATULA AM` / `OFERTA AM`.
- **Gestión interna:** hojas `BASE VEHICULOS`, `BASE EMISIONES`, `BASE PENDIENTE`, `BASE COMISIONES`, `BASE CANCELADAS`, `BASE SINIESTROS`.

## Entregables

| Archivo | Qué es |
|---|---|
| `Cotizador-Delta-MVP-visual.html` | Maqueta visual del producto (flujo de cotización, comparador multi-aseguradora, carátula generada). Usa el logo y colores reales del sitio de Delta Seguros. **Sin funcionalidad real** — es solo interfaz, para validar dirección de producto. |
| `Propuesta-Comercial-Cotizador-Delta.html` | Propuesta comercial dirigida a Diego Viera: diagnóstico del Excel actual, alcance por fases y presupuesto. Tiene botón de impresión/PDF. |

Ambos son HTML autocontenidos (sin CDNs, sin conexión a internet) — se abren con doble clic en cualquier equipo. También están publicados como Artifacts de Claude:
- MVP visual: https://claude.ai/code/artifact/7bbfe484-fb6f-48e5-9440-d9bc8a6148ab
- Propuesta comercial: https://claude.ai/code/artifact/bf0af407-df76-4cad-96b1-5687676b6cb6

## Plan de fases y presupuesto (estado actual)

Cálculo por horas a **$10/hora** (tarifa real del desarrollador) con un colchón del 20% para imprevistos/revisiones. Desarrollo individual apoyado en Claude Code.

| Fase | Contenido | Duración | Precio |
|---|---|---|---|
| 0 | MVP visual | Entregado | Cortesía |
| 1 | Plataforma base — Autos **+ Auto x Km** (confirmado en alcance) | 5–6 sem | $1.128 |
| 2 | Módulo Salud (AM) | 2–3 sem | $365 |
| 3 | Back-office (emisiones, comisiones, siniestros) | 2–3 sem | $408 |
| 4 | Integraciones API con aseguradoras (piloto 3–4) **+ integración SoftSeguros** (emisión + histórico, ver `ARCHITECTURE.md` §5b) | 3–5 sem | desde $576 (+$144–240 c/u adicional) |
| 5 | Despliegue y entrega | 3–5 días | $60 |

- **Paquete base** (1+3+5): $1.596
- **Paquete recomendado** (1+2+3+5): $1.961
- **Completo con piloto API** (1–5): desde $2.537

⚠️ Esta tabla **ya no refleja el alcance completo**: desde que se armó, se sumó multi-tenencia (§1b de `ARCHITECTURE.md`) y la integración con SoftSeguros con lectura de histórico (§5b.4) — ambas con trabajo real de por medio (RLS, esquema de organización, modo plantilla, adaptador de SoftSeguros). No la he recalculado todavía porque no ha sido el foco de la conversación; avisa cuando quieras el número actualizado.

Se descartó migrar el Excel: las hojas `BASE *` están vacías salvo 6 registros de salud en `BASE AM` — el histórico real vive en SoftSeguros y se importa por API (§5b.4), no por migración de archivo.

## Documentación técnica

La arquitectura, el esquema de base de datos, las convenciones de código y los requisitos de seguridad viven en **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** — es la guía que se sigue durante el desarrollo. El producto se llama **Cotizador Delta Seguros**.

La auditoría completa de las 198 macros VBA y las fórmulas de las 30 hojas del Excel original —qué se calcula, dónde, y qué es digitación manual— vive en **[`EXCEL-AUDIT.md`](./EXCEL-AUDIT.md)**, con las tablas de tarifas reales exportadas en [`reference-data/`](./reference-data/).

## Código

El desarrollo arrancó en **[`delta-check/`](./delta-check/)** — Next.js 16 + Drizzle + PostgreSQL, con el esquema completo de 28 tablas y aislamiento multi-tenant (RLS) ya funcionando y verificado. Ver `delta-check/README.md` para levantarlo en local. (El directorio sigue llamándose `delta-check/` por razones históricas; el producto se conoce como **Cotizador Delta Seguros**.)

## Próximos pasos

- [ ] Validar la maqueta visual con Diego Viera / decisión sobre avanzar
- [ ] Confirmar con qué aseguradoras hay canal técnico real para Fase 4 (ninguna confirmada aún — es un supuesto de la propuesta)
- [ ] Conseguir tabla de tasas de las 11 aseguradoras que hoy se cotizan a mano (Latina y Cóndor ya tienen tasas reales extraídas del Excel)
- [ ] Conseguir credenciales de API de SoftSeguros y el resultado de `GET /api/estadopoliza/` de la cuenta de Delta (para mapear sus estados reales al importar el histórico)
- [ ] Confirmar con IT de Delta el tenant de Microsoft Entra ID (debería existir por tener M365/Exchange)
- [ ] Si se aprueba, arrancar Fase 1 (plataforma base + línea Autos + Auto x Km)
