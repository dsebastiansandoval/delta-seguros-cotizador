import "@/db/schema"; // fuerza el orden de carga seguro del barrel antes de tocar las tablas directo (ver _helpers.ts <-> organizations.ts)
import { describe, expect, it } from "vitest";
import { quoteOptions, quoteRisks } from "@/db/schema/quoting";
import { policies } from "@/db/schema/policies";
import { quoteService, QuoteDeleteError } from "./quote.service";

/**
 * `assertEditable` es el guard que reemplazó al viejo `status === BORRADOR`
 * (ARCHITECTURE.md §36): las tres consultas encadenadas se simulan con un tx
 * que devuelve filas según la tabla, sin levantar Postgres.
 */
function fakeTx(rows: { risks?: Array<{ id: string }>; options?: Array<{ id: string }>; policies?: Array<{ id: string }> }) {
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          const result =
            table === quoteRisks
              ? (rows.risks ?? [])
              : table === quoteOptions
                ? (rows.options ?? [])
                : table === policies
                  ? (rows.policies ?? [])
                  : [];
          // La tercera consulta lleva `.limit(1)`; las otras se awaitean
          // directo. Un objeto thenable con `limit` sirve para las dos.
          const promise = Promise.resolve(result);
          return { limit: () => promise, then: promise.then.bind(promise) };
        },
      }),
    }),
  } as never;
}

const risk = { id: "risk-1" };
const option = { id: "option-1" };

describe("quoteService.assertEditable", () => {
  it("no bloquea una cotización sin riesgos ni opciones", async () => {
    await expect(quoteService.assertEditable(fakeTx({}), "quote-1")).resolves.toBeUndefined();
  });

  it("permite editar si las opciones no tienen póliza emitida", async () => {
    await expect(
      quoteService.assertEditable(fakeTx({ risks: [risk], options: [option] }), "quote-1"),
    ).resolves.toBeUndefined();
  });

  it("bloquea la edición completa si alguna opción ya tiene póliza", async () => {
    await expect(
      quoteService.assertEditable(
        fakeTx({ risks: [risk], options: [option], policies: [{ id: "policy-1" }] }),
        "quote-1",
      ),
    ).rejects.toBeInstanceOf(QuoteDeleteError);
  });
});
