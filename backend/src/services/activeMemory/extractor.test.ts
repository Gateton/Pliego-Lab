/**
 * Unit tests for the heuristic extractor's new front half: markup hygiene, typed segmentation, word
 * boundaries, entity anchoring, the per-kind quality gates and the confidence threshold.
 *
 * Each block documents one measured failure of the old implementation, so a regression shows up as a
 * failing test rather than as quiet canon pollution.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { HEURISTIC_CONFIDENCE_THRESHOLD, MAX_THREADS_PER_TURN, extractWithHeuristics } from "./extractor.js";
import { collectBeats, isNoiseLine, looksLikeTagList, segmentMessage, splitSentences, stripMarkup } from "./segments.js";
import { collectAnchors, hasNameLikeToken, presentNames } from "./entities.js";
import { hasWord, wholeWord } from "./lexicon.js";
import type { MemoryExtractionDraft, MemoryExtractionInput, MemoryThreadKind } from "./types.js";

function inputs(contents: string[], role: "user" | "assistant" = "assistant"): MemoryExtractionInput[] {
  return contents.map((content, index) => ({
    id: `m${index + 1}`,
    role,
    content,
    createdAt: 1_700_000_000_000 + index,
  }));
}

function extract(contents: string[], knownNames: string[] = [], role: "user" | "assistant" = "assistant"): MemoryExtractionDraft {
  return extractWithHeuristics(inputs(contents, role), { knownNames });
}

function kinds(draft: MemoryExtractionDraft): MemoryThreadKind[] {
  return draft.threads.map((thread) => thread.kind);
}

const IMAGE_MARKER =
  "[[IMG: masterpiece, best quality, absurdres, 1girl, elf, rating:questionable, lora, SQUARE | MEDIUM | RANDOM]]";

test("markup hygiene keeps the prose and drops markers, tags and entities", () => {
  assert.equal(
    stripMarkup(`[[IMG: masterpiece, 1girl]] <font color="#7F8C8D">Hola &amp; adiós</font><br>**Sigue** aquí`),
    "Hola & adiós\nSigue aquí",
  );
  assert.equal(stripMarkup("{{getvar: affection}} Ella sonríe."), "Ella sonríe.");
  assert.equal(stripMarkup("<div></div>"), "");
  // Emphasis decoration is unwrapped, not deleted.
  assert.equal(stripMarkup("__muy__ ~~importante~~"), "muy importante");
});

test("tag lists and markup-only lines are noise, prose is not", () => {
  assert.equal(isNoiseLine("masterpiece, best quality, amazing quality, absurdres, 1girl, rating:questionable"), true);
  assert.equal(isNoiseLine("<div></div>"), true);
  assert.equal(isNoiseLine("   "), true);
  assert.equal(isNoiseLine("Ella dejó la taza sobre la mesa y esperó en silencio."), false);
  assert.equal(
    looksLikeTagList("SQUARE | MEDIUM | RANDOM"),
    false,
    "three parts are not enough to call it a tag list",
  );
});

test("segmentation types the beats and keeps the speaker", () => {
  const { beats } = segmentMessage({
    id: "m1",
    role: "assistant",
    content: 'Svetlana: <font color="#7F8C8D">"No puede dormir."</font>\n*Anya se gira hacia la puerta.*',
  });
  assert.deepEqual(
    beats.map((beat) => [beat.kind, beat.speaker ?? null]),
    [
      ["dialogue", "Svetlana"],
      ["action", null],
    ],
  );
  assert.equal(beats[0].text, "No puede dormir.");
  assert.equal(beats[1].text, "Anya se gira hacia la puerta.");
  // A bare `Nombre: text` line is dialogue; a thinking verb inside asterisks is a thought.
  const bare = collectBeats([{ id: "m2", role: "assistant", content: "Anya: No sé qué hacer." }]).beats;
  assert.deepEqual(bare.map((beat) => [beat.kind, beat.speaker]), [["dialogue", "Anya"]]);
  const thought = collectBeats([{ id: "m3", role: "assistant", content: "*Pienso que debería irme.*" }]).beats;
  assert.equal(thought[0].kind, "thought");
});

test("word boundaries fold accents but never match substrings", () => {
  assert.equal(hasWord("Ella tiene un skill raro", "kill"), false);
  assert.equal(hasWord("Los planes de la academia", "plan"), false);
  assert.equal(hasWord("un monkey en el hombro", "key"), false);
  assert.equal(hasWord("Iris guardó el mapa", "map"), false);
  assert.equal(hasWord("Iris guardó el mapa", "mapa"), true);
  // The accents that `\b` used to break are still matched.
  assert.equal(hasWord("Daren confesó todo", "confes(?:ó|aron)"), true);
  assert.equal(hasWord("Daren juró venganza", "jur(?:ó|aron)"), true);
  assert.equal(wholeWord("plan").test("planes"), false);
});

test("a rhetorical aside is not an open question, a real one is", () => {
  assert.deepEqual(kinds(extract(['Svetlana: <font color="#7F8C8D">"No puede dormir, ¿sí?"</font>'], ["Svetlana"])), []);
  const real = extract(['Svetlana: <font color="#7F8C8D">"¿Vas a pagar el alquiler de este mes?"</font>'], ["Svetlana"]);
  assert.deepEqual(kinds(real), ["question"]);
  assert.equal(real.threads[0].title, "¿Vas a pagar el alquiler de este mes?");
  assert.ok(real.threads[0].participantIds?.includes("Svetlana"));
});

test("the confidence threshold drops the candidates the gates let through", () => {
  // A quoted question nobody is attributed to: dialogue, but no speaker, no second person and no
  // known interlocutor, so it scores 0.45 and stays out.
  assert.deepEqual(kinds(extract(['"¿Habrá suficiente comida para el invierno?"'])), []);
  // The same question with a speaker and a known name clears the bar.
  assert.deepEqual(kinds(extract(['Anya: "¿Vas a pagar el alquiler de este mes?"'], ["Anya"])), ["question"]);
  // A weak, unanchored reading: the player mentions a clue with a secondary modality and too few
  // content words to pay for it, so it scores 0.45 and never opens a thread.
  assert.deepEqual(kinds(extract(["Quiero encontrar la pista."], [], "user")), []);
  // The same sentence with the strongest reading (obligation, primary for a goal) clears the bar.
  assert.deepEqual(kinds(extract(["Debemos buscar la llave del sótano."], [], "user")), ["goal"]);
});

test("every emitted candidate carries a confidence at or above the threshold", () => {
  const draft = extractWithHeuristics(
    inputs([
      `Anya aceptó el contrato y firmó delante de Svetlana. ${IMAGE_MARKER}`,
      "Daren prometió no volver a usar magia de sangre delante de Iris.",
      'Iris: "¿Vas a buscar la llave del sótano?"',
    ]),
    { knownNames: ["Anya", "Daren", "Iris", "Svetlana"] },
  );
  const scores = [
    ...draft.threads.map((thread) => thread.confidence),
    ...draft.episodes.map((episode) => episode.confidence),
    ...draft.facts.map((fact) => fact.confidence),
  ];
  assert.ok(scores.length >= 3, `expected several candidates, got ${JSON.stringify(draft)}`);
  for (const score of scores) {
    assert.equal(typeof score, "number");
    assert.ok((score ?? 0) >= HEURISTIC_CONFIDENCE_THRESHOLD, `confidence ${score} below the threshold`);
    assert.ok((score ?? 0) <= 1);
  }
});

test("a present-tense description is not an open thread, a modalised one is", () => {
  const descriptive = extract([
    "Anya empieza: sus dedos envuelven las sábanas mientras en la pantalla la sicubo discute el contrato de renta de su local.",
  ], ["Anya"]);
  assert.ok(!kinds(descriptive).includes("conflict"), "descriptive present tense opens no conflict");
  assert.deepEqual(kinds(extract(["Anya va a discutir el contrato con la sicubo."], ["Anya"])), ["conflict"]);
  assert.deepEqual(kinds(extract(["Daren prometió no volver a usar magia de sangre delante de Iris."], ["Daren", "Iris"])), ["promise"]);
});

test("a turn adds at most two threads, highest confidence first", () => {
  const draft = extract(
    [
      "Anya prometió volver antes del amanecer.",
      "Anya amenazó con romper el pacto del gremio.",
      "Anya ocultará la carta hasta que llegue el invierno.",
      "Anya debe encontrar la llave antes de que cierren la puerta.",
    ],
    ["Anya"],
  );
  assert.equal(draft.threads.length, MAX_THREADS_PER_TURN);
  assert.deepEqual(kinds(draft).sort(), ["promise", "threat"]);
});

test("a completed beat becomes an episode, a closed promise and a future beat do not", () => {
  const draft = extract(["Anya aceptó el contrato de renta y firmó delante de Svetlana."], ["Anya", "Svetlana"]);
  assert.equal(draft.episodes.length, 1);
  assert.ok(draft.episodes[0].summary.length <= 200);
  assert.deepEqual(draft.episodes[0].participantIds, ["Anya", "Svetlana"]);

  assert.equal(extract(["Anya aceptará el contrato de renta mañana."], ["Anya"]).episodes.length, 0, "future is not an episode");
  assert.equal(
    extract(["La lluvia golpeaba la ventana mientras el fuego se apagaba despacio."]).episodes.length,
    0,
    "an imperfect past description is not a completed change",
  );
  assert.equal(
    extract(["Anya besó a Svetlana por primera vez a medianoche."], ["Anya", "Svetlana"]).episodes.length,
    1,
    "first times count as episodes",
  );
});

test("garbage capitals and tag vocabulary never reach the entity list", () => {
  const anchors = collectAnchors(inputs([`${IMAGE_MARKER} Su cara de mañana es de gata descansada.`, "Su turno otra vez."]));
  assert.deepEqual(anchors.all, [], `unexpected entities: ${JSON.stringify(anchors.all)}`);
  assert.deepEqual(presentNames("IMG SQUARE MEDIUM RANDOM Su No", anchors), []);

  const scene = extract([`${IMAGE_MARKER} Su cara de mañana es de gata descansada y con planes.`]).scene;
  assert.deepEqual(scene?.presentCharacterIds, []);
  // Televisor and Cámara are ordinary nouns: they appear once each and the window never repeats them.
  const oneOff = extract(["Anya miró a Svetlana y sonrió. El Televisor estaba encendido y la Cámara grababa todo."], ["Anya", "Svetlana"]);
  assert.deepEqual(oneOff.scene?.presentCharacterIds, ["Anya", "Svetlana"]);
  // A name that repeats mid-sentence is anchored even without the roster.
  assert.deepEqual(extract(["Iris guardó el mapa.", "El guardián miró a Iris sin decir nada."]).scene?.presentCharacterIds, ["Iris"]);
  assert.equal(hasNameLikeToken("el televisor"), false);
});

test("facts need a name-like subject and a non-trivial object", () => {
  assert.equal(extract(["Su cara de mañana es de gata descansada."]).facts.length, 0);
  assert.equal(extract(["El Televisor estaba encendido y la Cámara grababa todo."]).facts.length, 0);
  assert.equal(extract(["Iris es fuerte."]).facts.length, 0, "a one-word object is not a fact");

  const fact = extract(["Daren tiene la llave plateada."]).facts[0];
  assert.equal(fact.subject, "Daren");
  assert.equal(fact.predicate, "tiene");
  assert.equal(fact.object, "la llave plateada");

  const deferred = extractWithHeuristics(inputs(["Iris lleva una armadura negra."]), { deferVisualFactsToDirector: true });
  assert.equal(deferred.facts.length, 0, "outfit facts belong to Image Director");
  const injuries = extractWithHeuristics(inputs(["Iris perdió la visión del ojo izquierdo."]), { deferVisualFactsToDirector: true });
  assert.ok(injuries.facts.length >= 1, "injuries are canon, not appearance");
});

test("the scene only gets a location from an explicit movement or state pattern", () => {
  assert.equal(extract(["El fuego se apagaba despacio en la sala."]).scene?.location, undefined);
  assert.equal(extract(["Caminamos hacia la Cripta del monasterio al anochecer."]).scene?.location, "Cripta del monasterio al anochecer");
  assert.equal(extract([IMAGE_MARKER]).scene?.location, undefined);
});

test("lastSignificantChange only comes from narration or action and is truncated", () => {
  const long = `Anya empujó la puerta y entró en la sala. ${"palabra ".repeat(60)}`;
  const draft = extract([long], ["Anya"]);
  const change = draft.scene?.lastSignificantChange ?? "";
  assert.ok(change.length <= 200, `change was ${change.length} characters`);
  const dialogueOnly = extract(['Anya: "Solo hablo yo aquí."'], ["Anya"]);
  assert.ok(!(dialogueOnly.scene?.lastSignificantChange ?? "").includes("Solo hablo yo aquí"));
});

test("sentence splitting keeps Spanish question marks together", () => {
  assert.deepEqual(splitSentences("¿Vas a pagar? Sí, mañana."), ["¿Vas a pagar?", "Sí, mañana."]);
});
