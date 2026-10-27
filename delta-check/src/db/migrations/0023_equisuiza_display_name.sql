-- SESA se renombró a Equisuiza; mantenemos code = 'SESA' como identificador interno
-- (usado en insurer-offer-profiles.ts y lógica de cotización) y solo mostramos
-- "EQUISUIZA" como nombre visible.
UPDATE "insurers" SET "name" = 'EQUISUIZA' WHERE "code" = 'SESA';
