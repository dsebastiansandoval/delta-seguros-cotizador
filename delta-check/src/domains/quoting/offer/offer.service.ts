import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import type { Db } from "@/db";
import { insurers } from "@/db/schema/catalog";
import { quoteInsurerSettings, quoteOptions, quoteRisks, quotes } from "@/db/schema/quoting";
import { vehicles } from "@/db/schema/clients";
import { comparisonService } from "../services/comparison.service";
import { breakdownForNet, type PremiumBreakdown } from "../services/premium.calculator";
import type { CoverageType } from "./excel-rates";
import {
  INSURER_OFFER_PROFILES,
  KM_OFFER_PROFILE,
  KM_OFFER_ROWS,
  OFFER_COVERAGE_ROWS,
  type InsurerOfferProfile,
  type OfferCell,
  type OfferCoverageKey,
} from "./insurer-offer-profiles";
import { buildOfferColumn, type OfferColumn, type RiskPremium } from "./offer-sheet";

const ENGINE_CODES = new Set(["LATINA", "CONDOR"]);

const EMPTY_ROWS = Object.fromEntries(OFFER_COVERAGE_ROWS.map((r) => [r.key, {}])) as Record<OfferCoverageKey, OfferCell>;

/** Opciones de los selectores de DATOS OFERTA para una aseguradora. */
export type InsurerOptions = InsurerOfferProfile["options"];

function annualProfile(code: string): InsurerOfferProfile | null {
  return INSURER_OFFER_PROFILES[code] ?? null;
}

const kmOptions: InsurerOptions = KM_OFFER_PROFILE.options;

export type ConfigurationRisk = {
  id: string;
  riskNumber: number;
  label: string;
  insuredValueCents: number;
  extrasValueCents: number;
};

export type ConfigurationPremium = {
  quoteOptionId: string;
  riskId: string;
  kmBracket: number | null;
  netPremiumCents: number | null;
  totalPremiumCents: number | null;
  ratePercentApplied: string | null;
};

export type ConfigurationColumn = {
  insurerId: string;
  code: string;
  name: string;
  isEngine: boolean;
  settings: {
    included: boolean;
    coverageType: CoverageType;
    amparoPatrimonial: boolean;
    rcAmountCents: number | null;
    gmAmountCents: number | null;
    partialDeductible: string | null;
    totalLossDeductible: string | null;
  };
  options: InsurerOptions;
  premiums: ConfigurationPremium[];
};

export type OfferConfiguration = {
  quote: { id: string; code: string; modality: "ANUAL" | "POR_KM"; status: "BORRADOR" | "ENVIADA" | "ACEPTADA" | "VENCIDA" };
  risks: ConfigurationRisk[];
  columns: ConfigurationColumn[];
};

export type SettingsInput = {
  insurerId: string;
  included: boolean;
  coverageType: CoverageType;
  amparoPatrimonial: boolean;
  rcAmountCents: number | null;
  gmAmountCents: number | null;
  partialDeductible: string | null;
  totalLossDeductible: string | null;
};

export class OfferConfigurationError extends Error {}

/** Un valor elegido tiene que ser una opción real del perfil (o el valor que ya estaba). */
function assertAllowed<T>(value: T | null, allowed: T[] | undefined, current: T | null, label: string) {
  if (value == null || value === current) return;
  if (!allowed?.includes(value)) throw new OfferConfigurationError(`Valor no permitido para ${label}`);
}

function partsCombinations(options: InsurerOptions): string[] | undefined {
  const parts = options.partialDeductibleParts;
  if (!parts) return options.partialDeductible;
  return parts.vs.flatMap((vs) => parts.va.flatMap((va) => parts.min.map((min) => `${vs}${va}${min}`)));
}

async function loadRisks(tx: Db, quoteId: string): Promise<ConfigurationRisk[]> {
  const rows = await tx
    .select({
      id: quoteRisks.id,
      riskNumber: quoteRisks.riskNumber,
      insuredValueCents: quoteRisks.insuredValueCents,
      extrasValueCents: quoteRisks.extrasValueCents,
      plate: vehicles.plate,
      brand: vehicles.brand,
      model: vehicles.model,
      year: vehicles.year,
    })
    .from(quoteRisks)
    .leftJoin(vehicles, eq(vehicles.id, quoteRisks.vehicleId))
    .where(eq(quoteRisks.quoteId, quoteId))
    .orderBy(asc(quoteRisks.riskNumber));

  return rows.map((r) => ({
    id: r.id,
    riskNumber: r.riskNumber,
    // OFERTA!C37: MARCA MODELO PLACA AÑO
    label: r.brand ? `${r.brand} ${r.model} ${r.plate} ${r.year}` : `Riesgo ${r.riskNumber}`,
    insuredValueCents: r.insuredValueCents ?? 0,
    extrasValueCents: r.extrasValueCents ?? 0,
  }));
}

export const offerService = {
  /** Crea la configuración por defecto (estado inicial de DATOS OFERTA) para las aseguradoras que falten. */
  async ensureSettings(tx: Db, organizationId: string, quoteId: string) {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
    if (!quote) throw new Error("Cotización no encontrada");
    const isKm = quote.modality === "POR_KM";

    const candidates = await tx
      .select({ id: insurers.id, code: insurers.code })
      .from(insurers)
      .where(
        and(
          eq(insurers.branch, "AUTOS"),
          eq(insurers.isActive, true),
          ...(isKm ? [eq(insurers.supportsKm, true)] : []),
        ),
      );
    const existing = await tx
      .select({ insurerId: quoteInsurerSettings.insurerId })
      .from(quoteInsurerSettings)
      .where(eq(quoteInsurerSettings.quoteId, quoteId));
    const have = new Set(existing.map((e) => e.insurerId));

    const rows = candidates
      .filter((insurer) => !have.has(insurer.id))
      .map((insurer) => {
        if (isKm) {
          return {
            organizationId,
            quoteId,
            insurerId: insurer.id,
            included: true,
            amparoPatrimonial: false,
            rcAmountCents: KM_OFFER_PROFILE.defaults.rcAmount * 100,
            gmAmountCents: null,
            partialDeductible: KM_OFFER_PROFILE.defaults.partialDeductible,
            totalLossDeductible: KM_OFFER_PROFILE.defaults.totalLossDeductible,
            coverageSnapshot: KM_OFFER_ROWS,
          };
        }
        const profile = annualProfile(insurer.code);
        return {
          organizationId,
          quoteId,
          insurerId: insurer.id,
          // DATOS OFERTA fila 65: todas arrancan ocultas; se muestran al cotizarlas.
          included: false,
          amparoPatrimonial: profile?.defaults.amparoPatrimonial ?? false,
          rcAmountCents: profile ? profile.defaults.rcAmount * 100 : null,
          gmAmountCents: profile ? profile.defaults.gmAmount * 100 : null,
          partialDeductible: profile?.defaults.partialDeductible ?? null,
          totalLossDeductible: profile?.defaults.totalLossDeductible ?? null,
          coverageSnapshot: profile?.rows ?? EMPTY_ROWS,
        };
      });
    if (rows.length) await tx.insert(quoteInsurerSettings).values(rows);
  },

  /** Al crear la cotización, muestra en la oferta las aseguradoras que el motor ya cotizó. */
  async includePricedInsurers(tx: Db, quoteId: string) {
    const priced = await tx
      .selectDistinct({ insurerId: quoteOptions.insurerId })
      .from(quoteOptions)
      .innerJoin(quoteRisks, eq(quoteRisks.id, quoteOptions.quoteRiskId))
      .where(and(eq(quoteRisks.quoteId, quoteId), isNotNull(quoteOptions.netPremiumCents)));
    if (!priced.length) return;
    await tx
      .update(quoteInsurerSettings)
      .set({ included: true })
      .where(
        and(
          eq(quoteInsurerSettings.quoteId, quoteId),
          inArray(
            quoteInsurerSettings.insurerId,
            priced.map((p) => p.insurerId),
          ),
        ),
      );
  },

  async getConfiguration(tx: Db, quoteId: string): Promise<OfferConfiguration | null> {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
    if (!quote) return null;
    const isKm = quote.modality === "POR_KM";

    const risks = await loadRisks(tx, quoteId);

    const settingsRows = await tx
      .select({ settings: quoteInsurerSettings, code: insurers.code, name: insurers.name })
      .from(quoteInsurerSettings)
      .innerJoin(insurers, eq(insurers.id, quoteInsurerSettings.insurerId))
      .where(eq(quoteInsurerSettings.quoteId, quoteId));

    const premiumRows = await tx
      .select({
        quoteOptionId: quoteOptions.id,
        insurerId: quoteOptions.insurerId,
        riskId: quoteOptions.quoteRiskId,
        kmBracket: quoteOptions.kmBracket,
        netPremiumCents: quoteOptions.netPremiumCents,
        totalPremiumCents: quoteOptions.totalPremiumCents,
        ratePercentApplied: quoteOptions.ratePercentApplied,
      })
      .from(quoteOptions)
      .innerJoin(quoteRisks, eq(quoteRisks.id, quoteOptions.quoteRiskId))
      .where(eq(quoteRisks.quoteId, quoteId))
      .orderBy(asc(quoteRisks.riskNumber), asc(quoteOptions.kmBracket));

    // Mismo orden de columnas que DATOS OFERTA (C..O).
    const order = Object.keys(INSURER_OFFER_PROFILES);
    const columns = settingsRows
      .map(({ settings, code, name }) => ({
        insurerId: settings.insurerId,
        code,
        name,
        isEngine: !isKm && ENGINE_CODES.has(code),
        settings: {
          included: settings.included,
          coverageType: settings.coverageType,
          amparoPatrimonial: settings.amparoPatrimonial,
          rcAmountCents: settings.rcAmountCents,
          gmAmountCents: settings.gmAmountCents,
          partialDeductible: settings.partialDeductible,
          totalLossDeductible: settings.totalLossDeductible,
        },
        options: isKm ? kmOptions : (annualProfile(code)?.options ?? {}),
        premiums: premiumRows.filter((p) => p.insurerId === settings.insurerId),
      }))
      .sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));

    return { quote: { id: quote.id, code: quote.code, modality: quote.modality, status: quote.status }, risks, columns };
  },

  /**
   * Guarda la configuración (DATOS OFERTA) y las primas digitadas, y recalcula
   * Latina/Cóndor. Cada valor elegido se valida contra las opciones del perfil
   * — no se aceptan montos o textos que no existan en el Excel.
   */
  async saveConfiguration(
    tx: Db,
    quoteId: string,
    input: { settings: SettingsInput[]; premiums: Array<{ quoteOptionId: string; premiumCents: number | null }> },
  ) {
    const config = await this.getConfiguration(tx, quoteId);
    if (!config) throw new OfferConfigurationError("Cotización no encontrada");
    const columnsById = new Map(config.columns.map((c) => [c.insurerId, c]));

    for (const s of input.settings) {
      const column = columnsById.get(s.insurerId);
      if (!column) throw new OfferConfigurationError("Aseguradora no pertenece a esta cotización");
      const { options, settings: current } = column;
      assertAllowed(s.rcAmountCents, options.rc?.map((v) => v * 100), current.rcAmountCents, `RC de ${column.name}`);
      assertAllowed(s.gmAmountCents, options.gm?.map((v) => v * 100), current.gmAmountCents, `GM de ${column.name}`);
      assertAllowed(s.partialDeductible, partsCombinations(options), current.partialDeductible, `deducible de ${column.name}`);
      assertAllowed(s.totalLossDeductible, options.totalLossDeductible, current.totalLossDeductible, `pérdida total de ${column.name}`);

      await tx
        .update(quoteInsurerSettings)
        .set({
          included: s.included,
          coverageType: s.coverageType,
          amparoPatrimonial: s.amparoPatrimonial,
          rcAmountCents: s.rcAmountCents ?? current.rcAmountCents,
          gmAmountCents: s.gmAmountCents ?? current.gmAmountCents,
          partialDeductible: s.partialDeductible ?? current.partialDeductible,
          totalLossDeductible: s.totalLossDeductible ?? current.totalLossDeductible,
          updatedAt: new Date(),
        })
        .where(and(eq(quoteInsurerSettings.quoteId, quoteId), eq(quoteInsurerSettings.insurerId, s.insurerId)));
    }

    const manualOptions = new Map(
      config.columns
        .filter((c) => !c.isEngine)
        .flatMap((c) => c.premiums.map((p) => [p.quoteOptionId, p] as const)),
    );
    for (const { quoteOptionId, premiumCents } of input.premiums) {
      const current = manualOptions.get(quoteOptionId);
      if (!current) throw new OfferConfigurationError("Prima de una opción que no se digita a mano");
      const currentValue = config.quote.modality === "POR_KM" ? current.totalPremiumCents : current.netPremiumCents;
      if (currentValue === premiumCents) continue;
      await comparisonService.setManualPremium(tx, quoteOptionId, premiumCents);
    }

    await comparisonService.repriceEngines(tx, quoteId);
  },

  /** Hoja OFERTA (anual) u OFERTA KM, lista para la web y el PDF. */
  async getOfferSheet(tx: Db, quoteId: string): Promise<OfferSheet | null> {
    const config = await this.getConfiguration(tx, quoteId);
    if (!config) return null;

    const snapshots = await tx
      .select({ insurerId: quoteInsurerSettings.insurerId, snapshot: quoteInsurerSettings.coverageSnapshot })
      .from(quoteInsurerSettings)
      .where(eq(quoteInsurerSettings.quoteId, quoteId));
    const snapshotByInsurer = new Map(snapshots.map((s) => [s.insurerId, s.snapshot]));
    const riskNumberById = new Map(config.risks.map((r) => [r.id, r.riskNumber]));

    if (config.quote.modality === "POR_KM") {
      const column = config.columns[0];
      if (!column) return { kind: "KM", generated: false, quote: config.quote, risks: config.risks, km: null };
      return {
        kind: "KM",
        generated: column.premiums.length > 0,
        quote: config.quote,
        risks: config.risks,
        km: {
          insurerName: column.name,
          rows: (snapshotByInsurer.get(column.insurerId) as typeof KM_OFFER_ROWS) ?? KM_OFFER_ROWS,
          rcAmountCents: column.settings.rcAmountCents,
          partialDeductible: column.settings.partialDeductible ?? "",
          totalLossDeductible: column.settings.totalLossDeductible ?? "",
          brackets: column.premiums.map((p) => ({
            quoteOptionId: p.quoteOptionId,
            riskNumber: riskNumberById.get(p.riskId) ?? 1,
            kmBracket: p.kmBracket ?? 0,
            ratePercentApplied: p.ratePercentApplied,
            totals: p.netPremiumCents != null ? breakdownForNet(p.netPremiumCents) : null,
          })),
        },
      };
    }

    const columns = config.columns
      .filter((c) => c.settings.included)
      .map((c) =>
        buildOfferColumn({
          insurerId: c.insurerId,
          insurerName: c.name,
          snapshot: (snapshotByInsurer.get(c.insurerId) as Record<OfferCoverageKey, OfferCell>) ?? EMPTY_ROWS,
          settings: c.settings,
          risks: c.premiums.map<RiskPremium>((p) => ({
            quoteOptionId: p.quoteOptionId,
            riskNumber: riskNumberById.get(p.riskId) ?? 1,
            netPremiumCents: p.netPremiumCents,
            ratePercentApplied: p.ratePercentApplied,
          })),
        }),
      );
    return { kind: "ANUAL", generated: config.columns.length > 0, quote: config.quote, risks: config.risks, columns };
  },
};

export type KmBracketOffer = {
  quoteOptionId: string;
  riskNumber: number;
  kmBracket: number;
  ratePercentApplied: string | null;
  totals: PremiumBreakdown | null;
};

export type OfferSheet =
  | { kind: "ANUAL"; generated: boolean; quote: OfferConfiguration["quote"]; risks: ConfigurationRisk[]; columns: OfferColumn[] }
  | {
      kind: "KM";
      generated: boolean;
      quote: OfferConfiguration["quote"];
      risks: ConfigurationRisk[];
      km: {
        insurerName: string;
        rows: typeof KM_OFFER_ROWS;
        rcAmountCents: number | null;
        partialDeductible: string;
        totalLossDeductible: string;
        brackets: KmBracketOffer[];
      } | null;
    };
