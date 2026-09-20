/**
 * Banco de evaluación del extractor de Memoria Viva.
 *
 * El problema real no era "faltan datos" sino "entra basura": marcadores de imagen convertidos en
 * planes, preguntas retóricas convertidas en hilos abiertos y nombres como IMG o SQUARE tomados por
 * personajes. Por eso cada caso etiqueta tanto lo que DEBE extraerse como lo que DEBE rechazarse, y
 * el veredicto es precisión y recall por tipo.
 *
 * Correr desde backend/:
 *   npx tsx ../scripts/memory-acceptance/06-extraction-quality.ts
 *   npx tsx ../scripts/memory-acceptance/06-extraction-quality.ts --verbose
 */
import { extractWithHeuristics } from "../../backend/src/services/activeMemory/extractor.js";
import type { MemoryExtractionDraft, MemoryExtractionInput, MemoryThreadKind } from "../../backend/src/services/activeMemory/types.js";

const VERBOSE = process.argv.includes("--verbose");

interface Case {
  name: string;
  /** Names the chat already knows, exactly what the route passes from the card and NPC roster. */
  knownNames?: string[];
  messages: string[];
  /** Thread kinds that must appear, and how many of each at minimum. */
  expectThreads?: Partial<Record<MemoryThreadKind, number>>;
  /** Thread kinds that must not appear at all. */
  forbidThreads?: MemoryThreadKind[];
  /** Minimum facts and episodes expected. */
  expectFacts?: number;
  expectEpisodes?: number;
  /** Substrings that must appear in the scene; substring that must NOT appear in any entity. */
  expectSceneLocation?: string;
  expectPresent?: string[];
  forbidPresent?: string[];
}

const CASES: Case[] = [
  {
    name: "marcador de imagen no produce memoria",
    knownNames: ["Anya", "Svetlana"],
    messages: [
      "[[IMG: masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, anime, anime coloring, rating:questionable, 1girl, elf, long blonde hair, violet eyes, pale porcelain skin, medium breasts, pointed elegant ears, platinum collar, nude, short dark miniskirt, sitting against headboard, knees to chest, holding teacup, steam, porcelain cup, bedroom, rumpled sheets, headboard, wooden furniture, soft morning light, city view through window, relaxed pose, smirk, half-lidded eyes, smug expression, afterglow, happy tears | SQUARE | MEDIUM | RANDOM]] Su cara de mañana es de gata descansada y con planes.*",
    ],
    expectThreads: {},
    forbidThreads: ["plan", "conflict", "threat", "clue", "goal", "secret"],
    expectFacts: 0,
    expectEpisodes: 0,
    forbidPresent: ["IMG", "SQUARE", "MEDIUM", "RANDOM", "Su", "Best", "Masterpiece"],
  },
  {
    name: "pregunta retórica de diálogo no es un hilo abierto",
    knownNames: ["Svetlana"],
    messages: ['Svetlana: <font color="#7F8C8D">"No puede dormir, ¿sí?"</font>'],
    forbidThreads: ["question"],
    expectFacts: 0,
    forbidPresent: ["No", "Font", "Color"],
  },
  {
    name: "pregunta real dirigida a alguien sí es un hilo abierto",
    knownNames: ["Svetlana", "Anya"],
    messages: ['Svetlana: <font color="#7F8C8D">"¿Vas a pagar el alquiler de este mes?"</font>'],
    expectThreads: { question: 1 },
  },
  {
    name: "beat de acción en presente no es conflicto",
    knownNames: ["Anya"],
    messages: [
      "Anya empieza: sus dedos expertos envuelven tu verga despertando, bombeando lento y parejo mientras en la pantalla la sicubo discute el contrato de renta de su local.",
    ],
    forbidThreads: ["conflict"],
  },
  {
    name: "palabras que contienen términos clave no disparan (skill/planes/monkey)",
    knownNames: ["Ella"],
    messages: [
      "Ella tiene un skill raro y un monkey en el hombro.",
      "Los planes de la academia eran un misterio para todos.",
    ],
    forbidThreads: ["threat", "plan", "clue"],
  },
  {
    name: "promesa explícita produce hilo y hecho",
    knownNames: ["Daren", "Iris"],
    messages: ["Daren prometió no volver a usar magia de sangre delante de Iris."],
    expectThreads: { promise: 1 },
    expectFacts: 1,
    expectPresent: ["Daren"],
  },
  {
    name: "cambio de lugar alimenta la escena",
    knownNames: ["Iris"],
    messages: ["Caminamos hacia la Cripta del monasterio al anochecer."],
    expectSceneLocation: "Cripta",
  },
  {
    name: "beat completado produce episodio",
    knownNames: ["Anya", "Svetlana"],
    messages: ["Anya aceptó el contrato de renta y firmó delante de Svetlana."],
    expectEpisodes: 1,
  },
  {
    name: "narración neutra no inventa hechos",
    knownNames: ["Iris"],
    messages: ["La lluvia golpeaba la ventana mientras el fuego se apagaba despacio."],
    expectFacts: 0,
    expectEpisodes: 0,
    forbidThreads: ["clue", "conflict", "threat", "plan"],
  },
  {
    name: "solo entidades conocidas aparecen como presentes",
    knownNames: ["Anya", "Svetlana"],
    messages: [
      "Anya miró a Svetlana y sonrió. El Televisor estaba encendido y la Cámara grababa todo.",
    ],
    expectPresent: ["Anya", "Svetlana"],
    forbidPresent: ["Televisor", "Cámara"],
  },
];

function countKinds(draft: MemoryExtractionDraft): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const thread of draft.threads) counts[thread.kind] = (counts[thread.kind] ?? 0) + 1;
  return counts;
}

let expectedTotal = 0;
let expectedHit = 0;
let forbiddenTotal = 0;
let forbiddenHit = 0;
let casesPassed = 0;

for (const testCase of CASES) {
  const messages: MemoryExtractionInput[] = testCase.messages.map((content, index) => ({
    id: `m${index + 1}`,
    role: "assistant",
    content,
    createdAt: 1_700_000_000_000 + index,
  }));
  const draft = extractWithHeuristics(messages, { knownNames: testCase.knownNames ?? [] });
  const counts = countKinds(draft);
  const problems: string[] = [];

  for (const [kind, minimum] of Object.entries(testCase.expectThreads ?? {})) {
    expectedTotal += minimum;
    const found = counts[kind] ?? 0;
    expectedHit += Math.min(found, minimum);
    if (found < minimum) problems.push(`falta hilo ${kind} (esperado ${minimum}, hay ${found})`);
  }

  for (const kind of testCase.forbidThreads ?? []) {
    forbiddenTotal += 1;
    const found = counts[kind] ?? 0;
    if (found === 0) forbiddenHit += 1;
    else problems.push(`hilo prohibido ${kind} x${found}: "${draft.threads.find((t) => t.kind === kind)?.title.slice(0, 90)}"`);
  }

  if (testCase.expectFacts !== undefined) {
    expectedTotal += 1;
    if (draft.facts.length >= testCase.expectFacts) expectedHit += 1;
    else problems.push(`hechos ${draft.facts.length} < ${testCase.expectFacts}`);
  }

  if (testCase.expectEpisodes !== undefined) {
    expectedTotal += 1;
    if (draft.episodes.length >= testCase.expectEpisodes) expectedHit += 1;
    else problems.push(`episodios ${draft.episodes.length} < ${testCase.expectEpisodes}`);
  }

  const present = draft.scene?.presentCharacterIds ?? [];
  for (const name of testCase.forbidPresent ?? []) {
    forbiddenTotal += 1;
    if (!present.includes(name)) forbiddenHit += 1;
    else problems.push(`entidad basura presente: ${name}`);
  }
  for (const name of testCase.expectPresent ?? []) {
    expectedTotal += 1;
    if (present.includes(name)) expectedHit += 1;
    else problems.push(`falta presente: ${name} (hay ${JSON.stringify(present)})`);
  }
  if (testCase.expectSceneLocation) {
    expectedTotal += 1;
    const location = draft.scene?.location ?? "";
    if (location.toLowerCase().includes(testCase.expectSceneLocation.toLowerCase())) expectedHit += 1;
    else problems.push(`ubicación "${location}" no contiene "${testCase.expectSceneLocation}"`);
  }

  if (problems.length === 0) casesPassed += 1;

  const status = problems.length === 0 ? "PASS" : "FAIL";
  console.log(`${status} ${testCase.name}`);
  for (const problem of problems) console.log(`     - ${problem}`);
  if (VERBOSE) {
    console.log(`     hilos: ${draft.threads.map((t) => t.kind).join(", ") || "(ninguno)"}`);
    console.log(`     hechos: ${draft.facts.length} · episodios: ${draft.episodes.length} · presentes: ${JSON.stringify(present)}`);
  }
}

const precision = forbiddenTotal === 0 ? 1 : forbiddenHit / forbiddenTotal;
const recall = expectedTotal === 0 ? 1 : expectedHit / expectedTotal;
const accuracy = casesPassed / CASES.length;

console.log("");
console.log(`casos perfectos : ${casesPassed}/${CASES.length} (${(accuracy * 100).toFixed(0)}%)`);
console.log(`precisión       : ${(precision * 100).toFixed(0)}%  (no inventar lo prohibido)`);
console.log(`recall          : ${(recall * 100).toFixed(0)}%  (no perder lo esperado)`);

// El ruido es peor que la omisión: una memoria equivocada se inyecta como canon.
const ok = precision >= 0.9 && recall >= 0.75 && accuracy >= 0.8;
console.log(ok ? "EXTRACTION QUALITY OK" : "EXTRACTION QUALITY BELOW TARGET");
process.exit(ok ? 0 : 1);
