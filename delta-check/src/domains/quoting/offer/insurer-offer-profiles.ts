/**
 * Perfil de oferta por aseguradora — generado desde COTIZADOR ACTUALIZADO.xlsm:
 * `rows` = valores por defecto de la hoja OFERTA (filas 11-34), `defaults` =
 * estado inicial de DATOS OFERTA (filas 67-82) y `options` = los valores que
 * escriben los botones de opción VBA de esa hoja (módulo Sheet4). Si Delta
 * cambia una cobertura en el Excel, se regenera este archivo.
 *
 * Reverificado 2026-10-26 contra el Excel real (valores cacheados de la hoja
 * OFERTA): estaba desactualizado en 8 de 13 aseguradoras — AIG, SESA,
 * GENERALI, ZURICH, SWEADEN, ATLANTIDA, CHUBB y CONDOR tenían RC, Accidentes
 * personales, Amparo Patrimonial y/o deducibles con el valor de una versión
 * anterior del Excel (el propio Excel cambió desde que se generó este
 * archivo la primera vez, y nadie lo regeneró). GENERALI era la más
 * desactualizada (5 campos). ALIANZA, CONSTITUCION, UNIDOS, LATINA y ASEGSUR
 * ya coincidían.
 *
 * Segunda pasada el mismo día: se verificaron también los `options` contra
 * los 76 botones VBA reales del módulo Sheet4 (OptionButtonNN_Click, cada
 * uno escribe un valor fijo en DATOS OFERTA). ZURICH tenía $50.000 de RC que
 * ningún botón ofrece (son $30.000/$40.000, no $40.000/$50.000); SWEADEN
 * tenía un RC, un mínimo de deducible y un total-pérdida "fantasma" que
 * tampoco corresponden a ningún botón. GENERALI y CONDOR no tienen ningún
 * OptionButton de RC/deducible en el Excel — su valor es fijo — pero tenían
 * un menú de opciones inventado; ahora `options: {}`, igual que SESA,
 * CONSTITUCION, UNIDOS y LATINA (los otros sin selector real).
 */
export const OFFER_COVERAGE_ROWS = [
  { key: "PERDIDA_PARCIAL", label: "Pérdida Parcial por Daño", section: "PRINCIPALES" },
  { key: "PERDIDA_TOTAL", label: "Pérdida Total por Daño", section: "PRINCIPALES" },
  { key: "ROBO_PARCIAL", label: "Robo Parcial", section: "PRINCIPALES" },
  { key: "ROBO_TOTAL", label: "Robo Total", section: "PRINCIPALES" },
  { key: "RC", label: "Responsabilidad civil", section: "ADICIONALES" },
  { key: "AP", label: "Accidentes personales", section: "ADICIONALES" },
  { key: "GM", label: "Gastos médicos", section: "ADICIONALES" },
  { key: "HONORARIOS_LEGALES", label: "Honorarios legales", section: "ADICIONALES" },
  { key: "ASISTENCIA_MECANICA", label: "Asistencia mecánica", section: "ADICIONALES" },
  { key: "AUTO_SUSTITUTO", label: "Auto sustituto", section: "ADICIONALES" },
  { key: "ACCESORIOS_EXTRAS", label: "Accesorios extras", section: "ADICIONALES" },
  { key: "CONCESIONARIOS", label: "Concesionarios", section: "ADICIONALES" },
  { key: "AIRBAG", label: "Air-bag", section: "ADICIONALES" },
  { key: "LICENCIA_CADUCADA", label: "Licencia caducada", section: "ADICIONALES" },
  { key: "PACTO_ANDINO", label: "Cobertura pacto Andino", section: "ADICIONALES" },
  { key: "ASISTENCIA_EXEQUIAL", label: "Asistencia exequial", section: "ADICIONALES" },
  { key: "CONDUCTOR_ELEGIDO", label: "Conductor elegido", section: "ADICIONALES" },
  { key: "AMPARO_PATRIMONIAL", label: "Amparo Patrimonial", section: "ADICIONALES" },
] as const;

export type OfferCoverageKey = (typeof OFFER_COVERAGE_ROWS)[number]["key"];

/** Una celda de la hoja OFERTA: monto (columna izquierda) y/o texto (columna derecha). */
export type OfferCell = { amount?: number; text?: string };

export type DeductibleParts = { vs: string[]; va: string[]; min: string[] };

export type InsurerOfferProfile = {
  rows: Record<OfferCoverageKey, OfferCell>;
  defaults: {
    rcAmount: number;
    gmAmount: number;
    partialDeductible: string;
    totalLossDeductible: string;
    amparoPatrimonial: boolean;
  };
  options: {
    rc?: number[];
    gm?: number[];
    partialDeductible?: string[];
    /** Deducible armado en 3 partes (CONCAT de DATOS OFERTA filas 72/74/76). */
    partialDeductibleParts?: DeductibleParts;
    totalLossDeductible?: string[];
  };
};

export const INSURER_OFFER_PROFILES: Record<string, InsurerOfferProfile> = {
  AIG: {
    rows: {
      PERDIDA_PARCIAL: { text: "Sí otorga" },
      PERDIDA_TOTAL: { text: "Sí otorga" },
      ROBO_PARCIAL: { text: "Sí otorga" },
      ROBO_TOTAL: { text: "Sí otorga" },
      RC: { amount: 30000, text: "sin costo" },
      AP: { amount: 5000, text: "sin costo" },
      GM: { amount: 3000, text: "sin costo" },
      HONORARIOS_LEGALES: { text: "Sí otorga" },
      ASISTENCIA_MECANICA: { text: "Sí otorga" },
      AUTO_SUSTITUTO: { text: "15 días perdidas parciales \n30 días pérdidas totales" },
      ACCESORIOS_EXTRAS: { text: "Hasta 20% del VA" },
      CONCESIONARIOS: { text: "2 años" },
      AIRBAG: { text: "1" },
      LICENCIA_CADUCADA: { text: "30 días" },
      PACTO_ANDINO: { text: "Sí otorga" },
      ASISTENCIA_EXEQUIAL: { text: "Sí otorga" },
      CONDUCTOR_ELEGIDO: { text: "Sí otorga" },
      AMPARO_PATRIMONIAL: { text: "Sí otorga" },
    },
    defaults: {
      rcAmount: 30000,
      gmAmount: 3000,
      partialDeductible: "* 10% VS, 1% VA, mínimo USD 500 (el que sea mayor)",
      totalLossDeductible: "* Vehículos menor a USD 19.999: 20% del valor asegurado sin dispositivo; 15% con dispositivo (por robo)\n* Vehículos mayores a USD 20.000: 20% del valor asegurado, sin dispositivo; 10% con dispositivo. (por robo)",
      amparoPatrimonial: true,
    },
    options: { rc: [2000, 5000, 10000, 15000, 20000, 30000, 40000, 50000, 75000, 100000], partialDeductible: ["* 10% VS, 1% VA, mínimo USD 150 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 200 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 250 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 300 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 350 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 500 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 550 (el que sea mayor)"] },
  },
  SESA: {
    rows: {
      PERDIDA_PARCIAL: { text: "Sí otorga" },
      PERDIDA_TOTAL: { text: "Sí otorga" },
      ROBO_PARCIAL: { text: "Sí otorga" },
      ROBO_TOTAL: { text: "Sí otorga" },
      RC: { amount: 35000, text: "sin costo" },
      AP: { amount: 5000, text: "sin costo" },
      GM: { amount: 3000, text: "sin costo" },
      HONORARIOS_LEGALES: { text: "Sí otorga" },
      ASISTENCIA_MECANICA: { text: "Sí otorga" },
      AUTO_SUSTITUTO: { text: "10 días perdidas parciales \n20 días pérdidas totales" },
      ACCESORIOS_EXTRAS: { text: "Hasta 20% del VA" },
      CONCESIONARIOS: { text: "2 años" },
      AIRBAG: { text: "1" },
      LICENCIA_CADUCADA: { text: "30 días" },
      PACTO_ANDINO: { text: "Sí otorga" },
      ASISTENCIA_EXEQUIAL: { text: "Sí otorga" },
      CONDUCTOR_ELEGIDO: { text: "Sí otorga" },
      AMPARO_PATRIMONIAL: { text: "Sí otorga" },
    },
    defaults: {
      rcAmount: 35000,
      gmAmount: 3000,
      partialDeductible: "* 10% VS, 1% VA, mínimo USD 200 (el que sea mayor)",
      totalLossDeductible: "* 10% del VA por robo con dispositivo\n* 10% del VA por robo menores a USD 30,000 sin dispositivo\n* 20% del VA por robo mayores a USD 30,000 sin dispositivo",
      amparoPatrimonial: true,
    },
    options: {},
  },
  GENERALI: {
    rows: {
      PERDIDA_PARCIAL: { text: "Sí otorga" },
      PERDIDA_TOTAL: { text: "Sí otorga" },
      ROBO_PARCIAL: { text: "Sí otorga" },
      ROBO_TOTAL: { text: "Sí otorga" },
      RC: { amount: 35000, text: "sin costo" },
      AP: { amount: 8000, text: "sin costo" },
      GM: { amount: 3000, text: "sin costo" },
      HONORARIOS_LEGALES: { text: "Sí otorga" },
      ASISTENCIA_MECANICA: { text: "Sí otorga" },
      AUTO_SUSTITUTO: { text: "10 días perdidas parciales \n20 días pérdidas totales" },
      ACCESORIOS_EXTRAS: { text: "Hasta 10% del VA" },
      CONCESIONARIOS: { text: "No otorga" },
      AIRBAG: { text: "1" },
      LICENCIA_CADUCADA: { text: "30 días" },
      PACTO_ANDINO: { text: "Sí otorga" },
      ASISTENCIA_EXEQUIAL: { text: "Sí otorga" },
      CONDUCTOR_ELEGIDO: { text: "Sí otorga" },
      AMPARO_PATRIMONIAL: { text: "No otorga" },
    },
    defaults: {
      rcAmount: 35000,
      gmAmount: 3000,
      partialDeductible: "* 10% VS, 1% VA,mínimo USD 500 (el que sea mayor)",
      totalLossDeductible: "* 25% del VA por daño\n* 25% del VA por robo",
      amparoPatrimonial: false,
    },
    options: {},
  },
  ZURICH: {
    rows: {
      PERDIDA_PARCIAL: { text: "Sí otorga" },
      PERDIDA_TOTAL: { text: "Sí otorga" },
      ROBO_PARCIAL: { text: "Sí otorga" },
      ROBO_TOTAL: { text: "Sí otorga" },
      RC: { amount: 40000, text: "sin costo" },
      AP: { amount: 10000, text: "sin costo" },
      GM: { amount: 4000, text: "sin costo" },
      HONORARIOS_LEGALES: { text: "Sí otorga" },
      ASISTENCIA_MECANICA: { text: "Sí otorga" },
      AUTO_SUSTITUTO: { text: "10 días perdidas parciales \n20 días pérdidas totales" },
      ACCESORIOS_EXTRAS: { text: "Sí otorga" },
      CONCESIONARIOS: { text: "2 años" },
      AIRBAG: { text: "1" },
      LICENCIA_CADUCADA: { text: "30 días" },
      PACTO_ANDINO: { text: "Sí otorga" },
      ASISTENCIA_EXEQUIAL: { text: "Sí otorga" },
      CONDUCTOR_ELEGIDO: { text: "Sí otorga" },
      AMPARO_PATRIMONIAL: { text: "Sí otorga" },
    },
    defaults: {
      rcAmount: 40000,
      gmAmount: 4000,
      partialDeductible: "* 10% VS, 1% VA, mínimo USD 500 (el que sea mayor)",
      totalLossDeductible: "* 15% del VA por daño\n* 30% del VA por robo",
      amparoPatrimonial: true,
    },
    options: { rc: [30000, 40000], gm: [3000, 4000], partialDeductible: ["* 10% VS, 1% VA, mínimo USD 300 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 350 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 400 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 500 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 550 (el que sea mayor)"], totalLossDeductible: ["* 15% del VA por daño\n* 20% del VA por robo", "* 15% del VA por daño\n* 30% del VA por robo"] },
  },
  SWEADEN: {
    rows: {
      PERDIDA_PARCIAL: { text: "Sí otorga" },
      PERDIDA_TOTAL: { text: "Sí otorga" },
      ROBO_PARCIAL: { text: "Sí otorga" },
      ROBO_TOTAL: { text: "Sí otorga" },
      RC: { amount: 10000, text: "sin costo" },
      AP: { amount: 3000, text: "sin costo" },
      GM: { amount: 2000, text: "sin costo" },
      HONORARIOS_LEGALES: { text: "Sí otorga" },
      ASISTENCIA_MECANICA: { text: "Sí otorga" },
      AUTO_SUSTITUTO: { text: "El valor del auto sustituto es de USD 50" },
      ACCESORIOS_EXTRAS: { text: "Hasta 20% del VA" },
      CONCESIONARIOS: { text: "3 años" },
      AIRBAG: { text: "1" },
      LICENCIA_CADUCADA: { text: "30 días" },
      PACTO_ANDINO: { text: "Sí otorga" },
      ASISTENCIA_EXEQUIAL: { text: "Sí otorga" },
      CONDUCTOR_ELEGIDO: { text: "Sí otorga" },
      AMPARO_PATRIMONIAL: { text: "Sí otorga" },
    },
    defaults: {
      rcAmount: 10000,
      gmAmount: 2000,
      partialDeductible: "* 12% VS, 1% VA,mínimo USD 400 (el que sea mayor)",
      totalLossDeductible: "* 25% del VA por robo, Sweaden no exige dispositivo de rastreo satelital",
      amparoPatrimonial: true,
    },
    options: { rc: [10000, 15000, 20000, 25000, 30000, 35000], gm: [2000, 3000, 5000], partialDeductibleParts: {"vs": ["* 10% VS, ", "* 11% VS, ", "* 12% VS, "], "va": ["1% VA,mínimo USD ", "1.5% VA,mínimo USD ", "2% VA,mínimo USD "], "min": ["250 (el que sea mayor)", "350 (el que sea mayor)", "400 (el que sea mayor)", "450 (el que sea mayor)"]}, totalLossDeductible: ["* 15% del VA por robo, Sweaden no exige dispositivo de rastreo satelital", "* 20% del VA por robo, Sweaden no exige dispositivo de rastreo satelital", "* 25% del VA por robo, Sweaden no exige dispositivo de rastreo satelital"] },
  },
  ATLANTIDA: {
    rows: {
      PERDIDA_PARCIAL: { text: "Sí otorga" },
      PERDIDA_TOTAL: { text: "Sí otorga" },
      ROBO_PARCIAL: { text: "Sí otorga" },
      ROBO_TOTAL: { text: "Sí otorga" },
      RC: { amount: 45000, text: "sin costo" },
      AP: { amount: 5000, text: "sin costo" },
      GM: { amount: 3000, text: "sin costo" },
      HONORARIOS_LEGALES: { text: "Sí otorga" },
      ASISTENCIA_MECANICA: { text: "Sí otorga" },
      AUTO_SUSTITUTO: { text: "30 días" },
      ACCESORIOS_EXTRAS: { text: "Sí otorga" },
      CONCESIONARIOS: { text: "2 años" },
      AIRBAG: { text: "1" },
      LICENCIA_CADUCADA: { text: "90 días" },
      PACTO_ANDINO: { text: "Sí otorga" },
      ASISTENCIA_EXEQUIAL: { text: "Sí otorga" },
      CONDUCTOR_ELEGIDO: { text: "Sí otorga" },
      AMPARO_PATRIMONIAL: { text: "Sí otorga" },
    },
    defaults: {
      rcAmount: 45000,
      gmAmount: 3000,
      partialDeductible: "* 10% VS, 1% VA, mínimo USD 300 (el que sea mayor)",
      totalLossDeductible: "* 15% del VA por daño\n* 15% del VA por robo con o sin dispositivo hasta 30.000\n *20% del VA por robo con o sin dispositivo mayores a 30.000",
      amparoPatrimonial: true,
    },
    options: { partialDeductible: ["* 10% VS, 1% VA, mínimo USD 300 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 350 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 400 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 600 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 800 (el que sea mayor)"] },
  },
  ALIANZA: {
    rows: {
      PERDIDA_PARCIAL: { text: "Sí otorga" },
      PERDIDA_TOTAL: { text: "Sí otorga" },
      ROBO_PARCIAL: { text: "Sí otorga" },
      ROBO_TOTAL: { text: "Sí otorga" },
      RC: { amount: 30000, text: "sin costo" },
      AP: { amount: 5000, text: "sin costo" },
      GM: { amount: 2500, text: "sin costo" },
      HONORARIOS_LEGALES: { text: "Sí otorga" },
      ASISTENCIA_MECANICA: { text: "Sí otorga" },
      AUTO_SUSTITUTO: { text: "10 días perdidas parciales \n20 días pérdidas totales" },
      ACCESORIOS_EXTRAS: { text: "Hasta 20% del VA" },
      CONCESIONARIOS: { text: "2 años" },
      AIRBAG: { text: "1" },
      LICENCIA_CADUCADA: { text: "30 días" },
      PACTO_ANDINO: { text: "Sí otorga" },
      ASISTENCIA_EXEQUIAL: { text: "Sí otorga" },
      CONDUCTOR_ELEGIDO: { text: "Sí otorga" },
      AMPARO_PATRIMONIAL: { text: "Sí otorga" },
    },
    defaults: {
      rcAmount: 30000,
      gmAmount: 2500,
      partialDeductible: "* 10% VS, 1.5% VA,mínimo USD 300 (el que sea mayor)",
      totalLossDeductible: "* 20% del VA por daños\n* 20% del VA por robo",
      amparoPatrimonial: true,
    },
    options: { partialDeductibleParts: {"vs": ["* 10% VS, ", "* 11% VS, ", "* 12% VS, "], "va": ["1% VA,mínimo USD ", "1.5% VA,mínimo USD ", "2% VA,mínimo USD "], "min": ["300 (el que sea mayor)", "350 (el que sea mayor)"]} },
  },
  CONSTITUCION: {
    rows: {
      PERDIDA_PARCIAL: { text: "Sí otorga" },
      PERDIDA_TOTAL: { text: "Sí otorga" },
      ROBO_PARCIAL: { text: "Sí otorga" },
      ROBO_TOTAL: { text: "Sí otorga" },
      RC: { amount: 40000, text: "sin costo" },
      AP: { amount: 10000, text: "sin costo" },
      GM: { amount: 3000, text: "sin costo" },
      HONORARIOS_LEGALES: { text: "Sí otorga" },
      ASISTENCIA_MECANICA: { text: "Sí otorga" },
      AUTO_SUSTITUTO: { text: "10 días perdidas parciales o totales" },
      ACCESORIOS_EXTRAS: { text: "Hasta 10% del VA" },
      CONCESIONARIOS: { text: "2 años" },
      AIRBAG: { text: "1" },
      LICENCIA_CADUCADA: { text: "30 días" },
      PACTO_ANDINO: { text: "Sí otorga" },
      ASISTENCIA_EXEQUIAL: { text: "Sí otorga" },
      CONDUCTOR_ELEGIDO: { text: "Sí otorga" },
      AMPARO_PATRIMONIAL: { text: "No otorga" },
    },
    defaults: {
      rcAmount: 40000,
      gmAmount: 3000,
      partialDeductible: "* 10% VS, 1% VA, mínimo USD 300 (el que sea mayor)",
      totalLossDeductible: "* 25% del VA por daños\n* 25% del VA sin dispositivo, vehículos menores a 30.000\n* 10% del VA con dispositivo, vehículos mayores a USD 30.000",
      amparoPatrimonial: false,
    },
    options: {},
  },
  UNIDOS: {
    rows: {
      PERDIDA_PARCIAL: { text: "Sí otorga" },
      PERDIDA_TOTAL: { text: "Sí otorga" },
      ROBO_PARCIAL: { text: "Sí otorga" },
      ROBO_TOTAL: { text: "Sí otorga" },
      RC: { amount: 40000, text: "sin costo" },
      AP: { amount: 6000, text: "sin costo" },
      GM: { amount: 3000, text: "sin costo" },
      HONORARIOS_LEGALES: { text: "Sí otorga" },
      ASISTENCIA_MECANICA: { text: "Sí otorga" },
      AUTO_SUSTITUTO: { text: "10 días perdidas parciales \n20 días pérdidas totales" },
      ACCESORIOS_EXTRAS: { text: "Hasta 20% del VA" },
      CONCESIONARIOS: { text: "2 años" },
      AIRBAG: { text: "1" },
      LICENCIA_CADUCADA: { text: "30 días" },
      PACTO_ANDINO: { text: "Sí otorga" },
      ASISTENCIA_EXEQUIAL: { text: "Sí otorga" },
      CONDUCTOR_ELEGIDO: { text: "Sí otorga" },
      AMPARO_PATRIMONIAL: { text: "No otorga" },
    },
    defaults: {
      rcAmount: 40000,
      gmAmount: 3000,
      partialDeductible: "* 10% VS, 1% VA, mínimo USD 300 (el que sea mayor)",
      totalLossDeductible: "* 20% del VA por cualquier causa",
      amparoPatrimonial: false,
    },
    options: {},
  },
  LATINA: {
    rows: {
      PERDIDA_PARCIAL: { text: "Sí otorga" },
      PERDIDA_TOTAL: { text: "Sí otorga" },
      ROBO_PARCIAL: { text: "Sí otorga" },
      ROBO_TOTAL: { text: "Sí otorga" },
      RC: { amount: 30000, text: "sin costo" },
      AP: { amount: 10000, text: "sin costo" },
      GM: { amount: 2500, text: "sin costo" },
      HONORARIOS_LEGALES: { text: "Sí otorga" },
      ASISTENCIA_MECANICA: { text: "Sí otorga" },
      AUTO_SUSTITUTO: { text: "10 días perdidas parciales \n20 días pérdidas totales" },
      ACCESORIOS_EXTRAS: { text: "Hasta 20% del VA máximo USD 5,000" },
      CONCESIONARIOS: { text: "2 años" },
      AIRBAG: { text: "1" },
      LICENCIA_CADUCADA: { text: "No otorga" },
      PACTO_ANDINO: { text: "Sí otorga" },
      ASISTENCIA_EXEQUIAL: { text: "Hasta un máximo de 5 ocupantes por vehículo" },
      CONDUCTOR_ELEGIDO: { text: "Sí otorga" },
      AMPARO_PATRIMONIAL: { text: "No otorga" },
    },
    defaults: {
      rcAmount: 30000,
      gmAmount: 2500,
      partialDeductible: "* 10% VS, 1% VA, mínimo USD 350 (el que sea mayor) menos de 3.000 km mensuales.\n* 15% VS, 1.5% VA, mínimo USD 500 (el que sea mayor) más de 3.000 km mensuales.",
      totalLossDeductible: "* 20% del VA por daño\n* 20% del VA por robo y/o hurto sin dispositivo\n *15% del VA por robo y/o hurto con dispositivo\n*25% del VA por robo y/o hurto con o sin dispositivo para modelos específicos",
      amparoPatrimonial: false,
    },
    options: {},
  },
  ASEGSUR: {
    rows: {
      PERDIDA_PARCIAL: { text: "Sí otorga" },
      PERDIDA_TOTAL: { text: "Sí otorga" },
      ROBO_PARCIAL: { text: "Sí otorga" },
      ROBO_TOTAL: { text: "Sí otorga" },
      RC: { amount: 40000, text: "sin costo" },
      AP: { amount: 5000, text: "sin costo" },
      GM: { amount: 2500, text: "sin costo" },
      HONORARIOS_LEGALES: { text: "Sí otorga" },
      ASISTENCIA_MECANICA: { text: "Sí otorga" },
      AUTO_SUSTITUTO: { text: "No otorga" },
      ACCESORIOS_EXTRAS: { text: "Hasta USD 1500" },
      CONCESIONARIOS: { text: "No otorga" },
      AIRBAG: { text: "1" },
      LICENCIA_CADUCADA: { text: "No otorga" },
      PACTO_ANDINO: { text: "Sí otorga" },
      ASISTENCIA_EXEQUIAL: { text: "Sí otorga" },
      CONDUCTOR_ELEGIDO: { text: "No otorga" },
      AMPARO_PATRIMONIAL: { text: "No otorga" },
    },
    defaults: {
      rcAmount: 40000,
      gmAmount: 2500,
      partialDeductible: "* Deducible 350",
      totalLossDeductible: "* 15% del VA por daño\n* 20% del VA por robo y/o hurto\n *20% del VA por robo y/o hurto sin dispositivo",
      amparoPatrimonial: false,
    },
    options: { partialDeductible: ["* Deducible 350", "* Deducible 400", "* Deducible 450", "* Deducible 550", "* Deducible 650"] },
  },
  CHUBB: {
    rows: {
      PERDIDA_PARCIAL: { text: "Sí otorga" },
      PERDIDA_TOTAL: { text: "Sí otorga" },
      ROBO_PARCIAL: { text: "Sí otorga" },
      ROBO_TOTAL: { text: "Sí otorga" },
      RC: { amount: 30000, text: "sin costo" },
      AP: { amount: 5000, text: "sin costo" },
      GM: { amount: 3000, text: "sin costo" },
      HONORARIOS_LEGALES: { text: "Sí otorga" },
      ASISTENCIA_MECANICA: { text: "Sí otorga" },
      AUTO_SUSTITUTO: { text: "Sí otorga" },
      ACCESORIOS_EXTRAS: { text: "Sí otorga" },
      CONCESIONARIOS: {  },
      AIRBAG: { text: "1" },
      LICENCIA_CADUCADA: {  },
      PACTO_ANDINO: { text: "Sí otorga" },
      ASISTENCIA_EXEQUIAL: { text: "Sí otorga" },
      CONDUCTOR_ELEGIDO: { text: "Sí otorga" },
      AMPARO_PATRIMONIAL: { text: "No otorga" },
    },
    defaults: {
      rcAmount: 30000,
      gmAmount: 3000,
      partialDeductible: "* 10% VS, 1% VA, mínimo USD 300 (el que sea mayor)",
      totalLossDeductible: "* 15% del VA por daño\n* 20% del VA por robo sin dispositivo\n* 0% del VA por robo con dispositivo",
      amparoPatrimonial: false,
    },
    options: { rc: [30000, 35000, 40000, 50000], partialDeductible: ["* 10% VS, 1% VA, mínimo USD 250 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 300 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 350 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 400 (el que sea mayor)"] },
  },
  CONDOR: {
    rows: {
      PERDIDA_PARCIAL: { text: "Sí otorga" },
      PERDIDA_TOTAL: { text: "Sí otorga" },
      ROBO_PARCIAL: { text: "Sí otorga" },
      ROBO_TOTAL: { text: "Sí otorga" },
      RC: { amount: 35000, text: "sin costo" },
      AP: { amount: 8000, text: "sin costo" },
      GM: { amount: 3000, text: "sin costo" },
      HONORARIOS_LEGALES: { text: "Sí otorga" },
      ASISTENCIA_MECANICA: { text: "Sí otorga" },
      AUTO_SUSTITUTO: { text: "10 días perdidas parciales y totales" },
      ACCESORIOS_EXTRAS: { text: "Sí otorga" },
      CONCESIONARIOS: { text: "No otorga" },
      AIRBAG: { text: "1" },
      LICENCIA_CADUCADA: { text: "No otorga" },
      PACTO_ANDINO: { text: "No otorga" },
      ASISTENCIA_EXEQUIAL: { text: "No otorga" },
      CONDUCTOR_ELEGIDO: { text: "No otorga" },
      AMPARO_PATRIMONIAL: { text: "No otorga" },
    },
    defaults: {
      rcAmount: 35000,
      gmAmount: 3000,
      partialDeductible: "* 10% VS, 1% VA, mínimo USD 300 (el que sea mayor)",
      totalLossDeductible: "* 20% del VA por robo sin dispositivo\n* 10% del VA por robo con dispositivo",
      amparoPatrimonial: false,
    },
    options: {},
  },
};

/** Hoja OFERTA KM (hoy solo AIG) — opciones de los botones VBA de DATOS OFERTA X KM (módulo Sheet18). */
export const KM_OFFER_ROWS = [
  { key: "KM_12", label: "Pérdida Parcial por Daño", section: "PRINCIPALES", text: "Sí otorga" },
  { key: "KM_13", label: "Pérdida Total por Daño", section: "PRINCIPALES", text: "Sí otorga" },
  { key: "KM_14", label: "Robo Parcial", section: "PRINCIPALES", text: "Sí otorga" },
  { key: "KM_15", label: "Robo Total", section: "PRINCIPALES", text: "Sí otorga" },
  { key: "RC", label: "Responsabilidad civil", section: "ADICIONALES" },
  { key: "KM_19", label: "Accidentes personales", section: "ADICIONALES", amount: 5000 },
  { key: "KM_20", label: "Gastos médicos para ocupantes", section: "ADICIONALES", amount: 3000 },
  { key: "KM_21", label: "Gastos de grúa o remolque", section: "ADICIONALES", amount: 300 },
  { key: "KM_22", label: "Asistencia juridica en proceso penal", section: "ADICIONALES", amount: 1000 },
  { key: "KM_23", label: "Asistencia vehicular", section: "ADICIONALES", text: "Sí otorga" },
  { key: "KM_24", label: "Llave protegida", section: "ADICIONALES", amount: 150 },
  { key: "KM_25", label: "Documentos protegidos", section: "ADICIONALES", amount: 100 },
  { key: "KM_26", label: "Auto sustituto", section: "ADICIONALES", text: "Sí otorga" },
] as const;

export const KM_OFFER_PROFILE = {
  defaults: {
    rcAmount: 15000,
    partialDeductible: "* 10% VS, 1% VA, mínimo USD 150 (el que sea mayor)",
    totalLossDeductible: "* 15% del VA pérdida total\n* Vehículos menor a USD 19.999: 15% del valor asegurado, sin dispositivo; 10% con dispositivo (por robo)\n* Vehículos mayores a USD 20.000: 20% del valor asegurado, sin dispositivo; 10% con dispositivo. (por robo)",
  },
  options: {
    rc: [2000, 5000, 10000, 15000, 20000, 30000, 40000, 50000, 75000, 100000],
    partialDeductible: ["* 10% VS, 1% VA, mínimo USD 150 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 200 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 250 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 300 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 350 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 500 (el que sea mayor)", "* 10% VS, 1% VA, mínimo USD 550 (el que sea mayor)"],
  },
};
