import { describe, expect, it } from "vitest";
import { resolveExecutive, resolveVendor, vendorMode } from "./vendor-assignment";

function session(permissionCodes: string[], fullName: string | null = "Juan Pérez") {
  return { permissions: new Set(permissionCodes), fullName };
}

describe("resolveExecutive", () => {
  it("siempre es el usuario autenticado — nadie puede asignarlo", () => {
    expect(resolveExecutive(session(["quote:assign_vendor"]))).toBe("Juan Pérez");
    expect(resolveExecutive(session([]))).toBe("Juan Pérez");
  });
});

describe("vendorMode", () => {
  it("ADMIN/SUPERVISOR (quote:assign_vendor) → free", () => {
    expect(vendorMode(session(["quote:assign_vendor"]))).toBe("free");
  });

  it("Agente (quote:select_vendor) → select", () => {
    expect(vendorMode(session(["quote:select_vendor"]))).toBe("select");
  });

  it("Freelance (ninguno de los dos) → locked", () => {
    expect(vendorMode(session([]))).toBe("locked");
  });
});

describe("resolveVendor", () => {
  it("free: usa lo que mandó el formulario", () => {
    expect(resolveVendor(session(["quote:assign_vendor"]), "Ana Torres", [])).toBe("Ana Torres");
  });

  it("free: si no mandó nada, cae al propio nombre", () => {
    expect(resolveVendor(session(["quote:assign_vendor"]), undefined, [])).toBe("Juan Pérez");
  });

  it("select: acepta el valor si está en la lista cerrada", () => {
    expect(resolveVendor(session(["quote:select_vendor"]), "Ana Torres", ["Ana Torres", "Juan Pérez"])).toBe(
      "Ana Torres",
    );
  });

  it("select: ignora un valor fuera de la lista (POST armado a mano) y cae al propio nombre", () => {
    expect(resolveVendor(session(["quote:select_vendor"]), "Alguien Inventado", ["Ana Torres", "Juan Pérez"])).toBe(
      "Juan Pérez",
    );
  });

  it("locked: siempre el propio nombre, ignora lo que haya mandado el formulario", () => {
    expect(resolveVendor(session([]), "Otro Nombre", ["Otro Nombre"])).toBe("Juan Pérez");
  });
});
