import { describe, expect, it } from "vitest";
import { createUserSchema, updateUserSchema, userFormToObject } from "./user.schema";

function form(entries: Array<[string, string]>) {
  const data = new FormData();
  for (const [k, v] of entries) data.append(k, v);
  return data;
}

describe("createUserSchema", () => {
  it("normaliza el correo y lee los ramos marcados", () => {
    const parsed = createUserSchema.parse(
      userFormToObject(
        form([
          ["email", "  Ana.Perez@DeltaSeguros.com.ec "],
          ["fullName", "Ana Pérez"],
          ["role", "AGENTE"],
          ["branches", "SALUD"],
        ]),
      ),
    );
    expect(parsed).toEqual({ email: "ana.perez@deltaseguros.com.ec", fullName: "Ana Pérez", role: "AGENTE", branches: ["SALUD"] });
  });

  it("no permite asignar PLATFORM_ADMIN desde la organización", () => {
    const result = createUserSchema.safeParse({ email: "a@b.ec", fullName: "A", role: "PLATFORM_ADMIN", branches: [] });
    expect(result.success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("un checkbox de activo sin marcar desactiva al usuario", () => {
    const parsed = updateUserSchema.parse(
      userFormToObject(
        form([
          ["userId", "7b0f4b8e-2c1a-4d3e-9f6a-1b2c3d4e5f60"],
          ["fullName", "Ana"],
          ["role", "SUPERVISOR"],
          ["branches", "AUTOS"],
          ["branches", "SALUD"],
        ]),
      ),
    );
    expect(parsed.isActive).toBe(false);
    expect(parsed.branches).toEqual(["AUTOS", "SALUD"]);
  });
});
