"""
Extrae las tarifas y coberturas de Salud del cotizador de Delta (.xlsm).

Uso:  python3 -I extract_salud_from_excel.py "COTIZADOR ACTUALIZADO.xlsm"

Recorre cada columna de plan de OFERTA AM, sigue la fórmula de prima del
titular (fila 56) y del dependiente 1 (fila 57) hasta la hoja de la
aseguradora, interpreta las ramas IF/VLOOKUP (región, género, edad) y lee la
tabla de BASES ASEGURADORAS AM. Escribe en este directorio:

  salud_tarifas.json   reglas {insurerCode, planCode, relation, ageMin, ageMax, gender, region, premium}
  salud_planes.json    catálogo {insurerCode, planCode, label, otrosCargos, manual}
  ../delta-check/src/domains/health/health-plans.generated.ts   el mismo catálogo para la app
  salud_oferta_am_coberturas_RAW.csv   grilla de copago/sublímite/carencia por plan

Correcciones a errores del Excel (se aplica la intención evidente):
  * BMI titular en AUSTRO: la fórmula pide edad = 18 en vez de >= 18.
  * OFERTA AM!W56 (Sigma 2000) apunta a BMI!F10 (dependiente 1, D250): la
    prima del titular se toma siempre de la fila anterior a la del dependiente 1.
Simplificación: las tarifas de dependientes asumen un titular adulto (el caso
normal); las ramas "titular menor de 18" de las fórmulas de dependientes no se usan.
"""

import csv
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_NS = "{http://schemas.openxmlformats.org/package/2006/relationships}"

INSURER_BY_SHEET = {
    "BMI": "BMI", "SALUD": "SALUD", "SALUDSA": "SALUDSA", "CONFIAMED": "CONFIAMED",
    "HUMANA": "HUMANA", "BUPA": "BUPA", "PRO": "PRO", "VB": "VB",
}
MEMBER_AGE_CELL = {"TITULAR": "F10", "DEPENDIENTE": "I10"}
TITULAR_AGE_CELL = "F10"
SECTION_ROWS = {33: "MATERNIDAD", 37: "TOPE_CONSULTA", 42: "PERIODOS_CARENCIA"}
SALUDSA_NAMES = {
    "UNICO 7K": "UNICO_7K", "ESENCIAL 15K": "ESENCIAL_15K", "PRACTICO 3": "PRACTICO_30K_3",
    "PRACTICO 3D": "PRACTICO_30K_3D", "IDEAL 4": "IDEAL_45K_4", "IDEAL 4D": "IDEAL_45K_4D",
    "ELITE 5": "ELITE_100K_5", "ELITE 5D": "ELITE_100K_5D", "PRIVILEGIO 7": "PRIVILEGIO_1M_7",
    "PRIVILEGIO 7D": "PRIVILEGIO_1M_7D", "PRIVILEGIO PLUS 8D": "PRIVILEGIO_PLUS_1M_8D",
}


def colnum(s):
    n = 0
    for ch in s:
        n = n * 26 + ord(ch) - 64
    return n


def colname(n):
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


class Workbook:
    def __init__(self, path):
        self.zip = zipfile.ZipFile(path)
        rels = {
            r.get("Id"): r.get("Target")
            for r in ET.fromstring(self.zip.read("xl/_rels/workbook.xml.rels")).iter(PKG_NS + "Relationship")
        }
        self.sheet_paths = {
            s.get("name"): "xl/" + rels[s.get("{%s}id" % R_NS)].lstrip("/").replace("xl/", "")
            for s in ET.fromstring(self.zip.read("xl/workbook.xml")).iter("{%s}sheet" % NS["m"])
        }
        self.strings = [
            "".join(t.text or "" for t in si.iter("{%s}t" % NS["m"]))
            for si in ET.fromstring(self.zip.read("xl/sharedStrings.xml")).findall("m:si", NS)
        ]
        self._sheets = {}

    def sheet(self, name):
        if name not in self._sheets:
            values, formulas = {}, {}
            for c in ET.fromstring(self.zip.read(self.sheet_paths[name])).iter("{%s}c" % NS["m"]):
                v, f = c.find("m:v", NS), c.find("m:f", NS)
                if v is not None:
                    values[c.get("r")] = self.strings[int(v.text)] if c.get("t") == "s" else v.text
                if f is not None and f.text:
                    formulas[c.get("r")] = f.text
            self._sheets[name] = (values, formulas)
        return self._sheets[name]


def split_args(s):
    depth, out, cur = 0, [], ""
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return out


def call_args(expr, fname):
    i = expr.index(fname + "(") + len(fname) + 1
    depth, j = 1, i
    while depth:
        depth += {"(": 1, ")": -1}.get(expr[j], 0)
        j += 1
    return split_args(expr[i : j - 1])


def branches(expr, conds=()):
    """Ramas IF(AND(...), VLOOKUP(...), IF(...)) → [{conds, range, idx}]."""
    expr = expr.strip()
    if expr.startswith("IFERROR("):
        return branches(call_args(expr, "IFERROR")[0], conds)
    if expr.startswith("IF("):
        a = call_args(expr, "IF")
        cond = a[0]
        cl = tuple(call_args(cond, "AND")) if cond.startswith("AND(") else (cond,)
        out = branches(a[1], conds + cl)
        if len(a) > 2:
            out += branches(a[2], conds)
        return out
    if expr.startswith("VLOOKUP("):
        a = call_args(expr, "VLOOKUP")
        return [{"conds": conds, "range": a[1].split("!")[-1].replace("$", ""), "idx": int(a[2])}]
    return []


def age_bounds(conds, cell):
    lo, hi = 0, 999
    for c in conds:
        m = re.search(r"'DATOS AM'!\$([A-Z])\$(\d+)\s*(>=|<=|<|>|=)\s*(\d+)", c)
        if not m or f"{m.group(1)}{m.group(2)}" != cell:
            continue
        op, n = m.group(3), int(m.group(4))
        if op in (">=", "="):  # "=" solo aparece en el error de BMI AUSTRO
            lo = max(lo, n)
        elif op == ">":
            lo = max(lo, n + 1)
        elif op == "<":
            hi = min(hi, n - 1)
        elif op == "<=":
            hi = min(hi, n)
    return lo, hi


def attr(conds, pattern):
    for c in conds:
        m = re.search(pattern, c)
        if m:
            return m.group(1)
    return None


def table_rows(wb, rng):
    values, _ = wb.sheet("BASES ASEGURADORAS AM")
    a, b = rng.split(":")
    c1, r1 = colnum(re.match(r"[A-Z]+", a).group()), int(re.search(r"\d+", a).group())
    c2, r2 = colnum(re.match(r"[A-Z]+", b).group()), int(re.search(r"\d+", b).group())
    rows = []
    for r in range(r1, r2 + 1):
        first = values.get(f"{colname(c1)}{r}")
        try:
            age = int(float(first))
        except (TypeError, ValueError):
            continue
        rows.append((age, [values.get(f"{colname(c)}{r}") for c in range(c1, c2 + 1)]))
    return rows


def rules_for(wb, sheet, cell, relation):
    _, formulas = wb.sheet(sheet)
    out = []
    for br in branches(formulas.get(cell, "")):
        if relation == "DEPENDIENTE":
            tlo, thi = age_bounds(br["conds"], TITULAR_AGE_CELL)
            if thi < 18:  # rama "titular menor de edad": fuera del caso normal
                continue
        lo, hi = age_bounds(br["conds"], MEMBER_AGE_CELL[relation])
        gender = attr(br["conds"], r'="(MASCULINO|FEMENINO)"')
        region = attr(br["conds"], r'="(COSTA|SIERRA|AUSTRO)"')
        rows = table_rows(wb, br["range"])
        for i, (age_from, cells) in enumerate(rows):
            age_to = rows[i + 1][0] - 1 if i + 1 < len(rows) else 999
            a_min, a_max = max(age_from, lo), min(age_to, hi)
            if a_min > a_max:
                continue
            try:
                premium = round(float(cells[br["idx"] - 1]), 2)
            except (TypeError, ValueError, IndexError):
                continue
            if premium <= 0:
                continue
            out.append({"relation": relation, "ageMin": a_min, "ageMax": a_max,
                        "gender": gender, "region": region, "premium": premium})
    return out


def plan_code(wb, insurer, header, sheet, cell, branch_idx):
    h = re.sub(r"\s+", " ", header).strip().upper()
    if insurer == "BMI":
        family, level = h.split(" ", 1)
        if family == "GMM":
            return f"GMM_{int(level.replace('.', '')) // 1000}K"
        return f"{family}_{'I150' if level == 'INCAPACIDAD' else 'D' + level}"
    if insurer == "SALUD":
        return re.sub(r"[\s-]+", "_", h)
    if insurer == "SALUDSA":
        values, _ = wb.sheet("SALUDSA")
        col, row = re.match(r"([A-Z]+)(\d+)", cell).groups()
        mat = next(
            (values.get(f"{col}{r}") for r in range(int(row) - 1, int(row) - 4, -1)
             if "MATERNIDAD" in (values.get(f"{col}{r}") or "")), "")
        return f"{SALUDSA_NAMES[h]}_{'CON' if mat.startswith('CON') else 'SIN'}_MATERNIDAD"
    if insurer == "CONFIAMED":
        m = re.match(r"RED (\d) - (\d+K)", h)
        return f"{m.group(2)}_RED{m.group(1)}_{'CON' if branch_idx <= 6 else 'SIN'}_MATERNIDAD"
    if insurer == "HUMANA":
        return re.sub(r"K$", "", h).replace(" ", "_")
    if insurer == "PRO":
        return f"PLAN_{int(h.split()[-1].rstrip('K')) * 1000}"
    if insurer == "VB":
        return "PREDILECTO_20K_DENTAL_PLUS"
    return h.replace(" ", "_")


def main(xlsm):
    wb = Workbook(xlsm)
    values, formulas = wb.sheet("OFERTA AM")
    out_dir = os.path.dirname(os.path.abspath(__file__))
    rates, plans, coverages = [], [], []

    for ref, f in sorted(formulas.items(), key=lambda kv: colnum(re.match(r"[A-Z]+", kv[0]).group())):
        col, row = re.match(r"([A-Z]+)(\d+)$", ref).groups()
        if row != "57":
            continue
        refs = [(a or b, c.replace("$", "")) for a, b, c in re.findall(r"(?:'([^']+)'|\b([A-Z]+))!(\$?[A-Z]+\$?\d+)", f)]
        refs = [r for r in refs if r[0] in INSURER_BY_SHEET]
        if not refs:
            continue
        sheet, dep_cell = refs[0]
        insurer = INSURER_BY_SHEET[sheet]
        c, r = re.match(r"([A-Z]+)(\d+)", dep_cell).groups()
        tit_cell = f"{c}{int(r) - 1}"
        n = colnum(col)
        header = values.get(f"{col}8") or values.get(f"{colname(n - 1)}8") or ""
        triplet = values.get(f"{colname(n - 1)}11") == "COPAGO"

        _, sheet_formulas = wb.sheet(sheet)
        brs = branches(sheet_formulas.get(tit_cell, ""))
        code = plan_code(wb, insurer, header, sheet, dep_cell, brs[-1]["idx"] if brs else 0)

        plan_rates = rules_for(wb, sheet, tit_cell, "TITULAR") + rules_for(wb, sheet, dep_cell, "DEPENDIENTE")
        otros = formulas.get(f"{col}64") or values.get(f"{col}64") or "0"
        m = re.search(r",(\d+(?:\.\d+)?),", otros)
        otros_cargos = float(m.group(1)) if m else float(otros)
        if not plan_rates and insurer != "BUPA":
            print(f"  sin tarifa (no se ofrece): {insurer} {code}", file=sys.stderr)
            continue
        plans.append({"insurerCode": insurer, "planCode": code, "label": re.sub(r"\s+", " ", header).strip(),
                      "otrosCargos": otros_cargos, "manual": not plan_rates})
        rates += [{"insurerCode": insurer, "planCode": code, **x} for x in plan_rates]

        section = "COBERTURAS"
        for rr in range(12, 47):
            section = SECTION_ROWS.get(rr, section)
            label = (values.get(f"B{rr}") or "").strip()
            if not label or rr in SECTION_ROWS:
                continue
            cell = lambda k: (values.get(f"{colname(n + k)}{rr}") or "").strip()  # noqa: E731
            copago, sub, car = (cell(-1), cell(0), cell(1)) if triplet else ("", cell(0), "")
            if not (copago or sub or car):
                continue
            coverages.append([insurer, code, section, label, rr, copago, sub, car])

    with open(os.path.join(out_dir, "salud_tarifas.json"), "w") as fh:
        json.dump(rates, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(out_dir, "salud_planes.json"), "w") as fh:
        json.dump(plans, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(out_dir, "salud_oferta_am_coberturas_RAW.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["insurerCode", "planCode", "section", "label", "displayOrder", "copago", "sublimite", "carencia"])
        w.writerows(coverages)
    ts_path = os.path.join(out_dir, "..", "delta-check", "src", "domains", "health", "health-plans.generated.ts")
    with open(ts_path, "w") as fh:
        fh.write("// Generado por reference-data/extract_salud_from_excel.py desde OFERTA AM — no editar a mano.\n")
        fh.write("// otrosCargosCents = OFERTA AM fila 64; manual = la aseguradora no tiene tabla (se digita la prima).\n")
        fh.write("export type HealthPlan = { insurerCode: string; planCode: string; label: string; otrosCargosCents: number; manual: boolean };\n\n")
        fh.write("export const HEALTH_PLANS: HealthPlan[] = [\n")
        for p in plans:
            fh.write(
                f"  {{ insurerCode: {json.dumps(p['insurerCode'])}, planCode: {json.dumps(p['planCode'])}, "
                f"label: {json.dumps(p['label'], ensure_ascii=False)}, otrosCargosCents: {round(p['otrosCargos'] * 100)}, "
                f"manual: {'true' if p['manual'] else 'false'} }},\n"
            )
        fh.write("];\n")
    print(f"{len(plans)} planes, {len(rates)} reglas de tarifa, {len(coverages)} filas de cobertura")


if __name__ == "__main__":
    main(sys.argv[1])
