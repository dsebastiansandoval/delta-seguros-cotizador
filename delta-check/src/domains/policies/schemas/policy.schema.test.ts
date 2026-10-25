import { describe, expect, it } from "vitest";
import { cancelPolicySchema, setIssueStatusSchema } from "./policy.schema";

const policyId = "7b0f4b8e-2c1a-4d3e-9f6a-1b2c3d4e5f60";

describe("cancelPolicySchema (BASE CANCELADAS)", () => {
  it("sin el checkbox la cancelación queda pendiente de confirmar por la aseguradora", () => {
    const parsed = cancelPolicySchema.parse({ policyId, cancellationReason: "Venta del vehículo", cancelledPremiumDollars: "350.40" });
    expect(parsed).toMatchObject({ cancelledPremiumDollars: 350.4, confirmed: false });
  });

  it("con el checkbox marcado queda confirmada", () => {
    const parsed = cancelPolicySchema.parse({ policyId, cancellationReason: "x", cancelledPremiumDollars: "0", confirmed: "on" });
    expect(parsed.confirmed).toBe(true);
  });

  it("rechaza una prima cancelada negativa", () => {
    expect(cancelPolicySchema.safeParse({ policyId, cancellationReason: "x", cancelledPremiumDollars: "-1" }).success).toBe(false);
  });
});

describe("setIssueStatusSchema (BASE EMISIONES)", () => {
  it("acepta INSPECCION pero no EMITIDA, que se fija al asignar el número de póliza", () => {
    expect(setIssueStatusSchema.safeParse({ policyId, issueStatus: "INSPECCION" }).success).toBe(true);
    expect(setIssueStatusSchema.safeParse({ policyId, issueStatus: "EMITIDA" }).success).toBe(false);
  });
});
