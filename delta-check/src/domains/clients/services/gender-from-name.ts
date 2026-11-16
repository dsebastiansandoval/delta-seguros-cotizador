/**
 * Sugerencia de género a partir del primer nombre — igual que
 * `provinceFromCedula`/`inferBodyType` (EcuadorAPI), nunca un hecho
 * verificado: el formulario precarga el <select> con esto pero el usuario
 * siempre puede corregirlo. Si el nombre no está en la lista ni tiene una
 * terminación inequívoca, no se adivina (null) en vez de arriesgar un
 * género incorrecto — mejor no sugerir que sugerir mal.
 *
 * Lista curada de nombres comunes en Ecuador (no exhaustiva). Para nombres
 * compuestos ("Juan Carlos", "María Fernanda") solo se evalúa la primera
 * palabra.
 */

const FEMALE_NAMES = new Set([
  "maria", "ana", "rosa", "carmen", "luz", "gladys", "silvia", "monica", "veronica", "patricia",
  "sandra", "sonia", "diana", "carla", "carolina", "paola", "daniela", "andrea", "gabriela", "valeria",
  "fernanda", "alejandra", "cristina", "elizabeth", "katherine", "katty", "catalina", "jessica", "jenny",
  "jennifer", "johanna", "pamela", "mayra", "doris", "nancy", "nelly", "norma", "gloria", "marcia",
  "marisol", "margarita", "marlene", "narcisa", "piedad", "rocio", "soledad", "teresa", "yolanda",
  "lucia", "lorena", "ximena", "priscila", "priscilla", "tatiana", "viviana", "vanessa", "adriana",
  "beatriz", "blanca", "consuelo", "dolores", "esperanza", "eugenia", "eulalia", "francisca", "graciela",
  "guadalupe", "irene", "isabel", "janeth", "jacqueline", "jaqueline", "karina", "karen", "kerly",
  "liliana", "luisa", "magdalena", "mariana", "martha", "marta", "mercedes", "mirian", "myriam",
  "miriam", "nathaly", "nataly", "olga", "paulina", "pilar", "rebeca", "reina", "roxana", "roxanna",
  "samantha", "sofia", "stefania", "stephanie", "susana", "victoria", "virginia", "yadira", "zoila",
  "dayana", "dallana", "erika", "evelyn", "estefania", "belen", "camila", "nicole", "melanie", "melany",
  "ashley", "scarlett", "genesis", "mishell", "michelle", "britany", "brithany", "allison", "alison",
  "amparo", "socorro", "ines", "angelica", "angela", "cecilia", "claudia", "deysi", "elena", "emperatriz",
  "fabiola", "flor", "giovanna", "ivonne", "jimena", "josselyn", "joselyn", "judith", "kimberly",
  "leonor", "leticia", "lissette", "luzmila", "madeleine", "magaly", "maritza", "mercy", "nadia",
  "natalia", "odalys", "olivia", "rosario", "ruth", "sara", "shirley", "tamara", "thalia", "wendy",
  "yesenia", "yessenia", "zulema", "estela", "elsa", "emma", "yajaira",
]);

const MALE_NAMES = new Set([
  "jose", "juan", "carlos", "luis", "jorge", "pedro", "diego", "andres", "fernando", "ricardo",
  "eduardo", "miguel", "francisco", "antonio", "manuel", "rafael", "alberto", "roberto", "daniel",
  "david", "pablo", "sergio", "alejandro", "gabriel", "rodrigo", "mauricio", "patricio", "marco",
  "marcelo", "ivan", "hernan", "vinicio", "byron", "washington", "galo", "klever", "segundo", "wilson",
  "edison", "edwin", "freddy", "geovanny", "giovanny", "jefferson", "jhonny", "johnny", "kevin",
  "bryan", "brayan", "cristian", "christian", "oswaldo", "rolando", "ramiro", "napoleon", "hugo",
  "gustavo", "angel", "julio", "cesar", "raul", "victor", "mario", "jaime", "oscar", "enrique",
  "ernesto", "guillermo", "gonzalo", "nelson", "nestor", "alfonso", "alfredo", "arturo", "bolivar",
  "bayardo", "teodoro", "teofilo", "leonardo", "ruben", "rodolfo", "agustin", "adrian", "martin",
  "esteban", "joaquin", "joel", "abel", "isaac", "ismael", "emilio", "emiliano", "felipe", "fabian",
  "fabricio", "vicente", "tomas", "vladimir", "vladimiro", "xavier", "javier", "santiago", "sebastian",
  "nicolas", "ignacio", "humberto", "ildefonso", "lenin", "milton", "hamilton", "wellington", "darwin",
  "franklin", "anthony", "erick", "erik", "christopher", "cristopher", "jostin", "justin", "alexis",
  "axel", "dennis", "denis", "dylan", "elvis", "elkin", "franco", "harold", "jean", "jeancarlos",
  "jeremy", "jhon", "john", "johan", "jordy", "josue", "kleber", "leandro", "lizandro", "maicol",
  "michael", "robinson", "ronny", "ronald", "walter", "wagner", "wander", "yandry", "yordi", "yordy",
  "tyrone", "alexander", "alfredo", "armando", "bladimir", "bolivar", "cornelio", "efrain", "elias",
  "estuardo", "ever", "exson", "giovanni", "homero", "israel", "jonathan", "jonnathan", "jairo",
  "leonidas", "leovigildo", "marlon", "medardo", "octavio", "orlando", "pastor", "polivio", "rene",
  "reyes", "rigoberto", "salomon", "segundo", "simon", "tito", "uriel", "virgilio", "wilmer", "xevier",
  "yovany", "zacarias", "joshua", "josua",
]);

// Excepciones a la heurística de terminación -a (nombres masculinos reales
// que la romperían). Los femeninos que terminan en -o ("rosario",
// "consuelo", "amparo", "socorro"...) ya están en FEMALE_NAMES y se
// consultan primero, así que no hacen falta excepciones para -o.
const MALE_NAMES_ENDING_IN_A = new Set(["joshua", "josua", "elisha", "noah"]);

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export function inferGenderFromName(fullFirstName: string): "MASCULINO" | "FEMENINO" | null {
  const firstToken = normalize(fullFirstName).split(/\s+/)[0];
  if (!firstToken) return null;

  if (FEMALE_NAMES.has(firstToken)) return "FEMENINO";
  if (MALE_NAMES.has(firstToken)) return "MASCULINO";

  if (firstToken.endsWith("a") && !MALE_NAMES_ENDING_IN_A.has(firstToken)) return "FEMENINO";
  if (firstToken.endsWith("o")) return "MASCULINO";

  return null;
}
