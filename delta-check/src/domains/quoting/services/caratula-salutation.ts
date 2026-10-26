/**
 * CARATULA!C7 (confirmada contra la fórmula real, no asumida): el saludo no
 * es fijo. `=IF(AND(NATURAL,MASCULINO),"Señor",IF(JURIDICA,"Señores",
 * IF(AND(NATURAL,FEMENINO,SOLTERO),"Señorita","Señora")))` — el orden del IF
 * importa: una persona NATURAL sin género MASCULINO ni (FEMENINO+SOLTERO)
 * cae en "Señora" por default, igual que en el Excel.
 */
export function salutationFor(client: {
  personType: "NATURAL" | "JURIDICA";
  gender: "MASCULINO" | "FEMENINO" | null;
  maritalStatus: string | null;
}): "Señor" | "Señores" | "Señorita" | "Señora" {
  if (client.personType === "NATURAL" && client.gender === "MASCULINO") return "Señor";
  if (client.personType === "JURIDICA") return "Señores";
  if (client.personType === "NATURAL" && client.gender === "FEMENINO" && client.maritalStatus === "SOLTERO") return "Señorita";
  return "Señora";
}
