import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultActiveMemoryState } from "./store.js";
import { applyGuardReport, checkContinuity, detectHeuristicFindings, selectGuardFacts } from "./guard.js";
import type { ActiveMemoryState, GuardReport, MemoryFact } from "./types.js";

function fact(overrides: Partial<MemoryFact> & Pick<MemoryFact, "id" | "subject" | "predicate" | "object">): MemoryFact {
  return {
    status: "confirmed",
    confidence: 0.9,
    importance: 0.8,
    visibleTo: "all",
    evidenceMessageIds: ["m1"],
    validFromMessageId: "m1",
    entityIds: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function stateWithFacts(...facts: MemoryFact[]): ActiveMemoryState {
  const state = createDefaultActiveMemoryState();
  state.facts = facts;
  return state;
}

test("a clean reply produces no findings", async () => {
  const state = stateWithFacts(
    fact({ id: "f1", subject: "Daren", predicate: "tiene", object: "la llave plateada" }),
  );
  const report = await checkContinuity({
    state,
    mode: "heuristic",
    responseText: "Daren guardó la llave plateada y sonrió. Iris miraba la puerta.",
  });
  assert.equal(report.findings.length, 0);
  assert.equal(report.method, "heuristic");
  assert.deepEqual(report.warnings, []);
});

test("an explicit negation of a confirmed fact yields a high heuristic finding with the real sentence", async () => {
  const state = stateWithFacts(
    fact({ id: "f1", subject: "Daren", predicate: "prometió", object: "no usar magia de sangre" }),
  );
  const responseText = "Daren ya no piensa cumplir. El mago dijo: Daren rompió su promesa anoche.";
  const report = await checkContinuity({ state, mode: "heuristic", responseText, messageId: "m9" });
  assert.equal(report.findings.length, 1);
  const finding = report.findings[0];
  assert.equal(finding.factId, "f1");
  assert.equal(finding.severity, "high", "confirmed canon is reported as high severity");
  assert.ok(responseText.includes(finding.excerpt), "excerpt must be a real sentence of the reply");
  assert.ok(finding.reason.includes("Daren"));
  assert.equal(report.method, "heuristic");
  assert.equal(report.messageId, "m9");
});

test("negating a pinned fact escalates the finding to high", async () => {
  const state = stateWithFacts(
    fact({ id: "f1", subject: "Iris", predicate: "es", object: "la guardiana del sello", pinned: true }),
  );
  const report = await checkContinuity({
    state,
    mode: "heuristic",
    responseText: "Iris dejó de ser la guardiana del sello para siempre.",
  });
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].severity, "high");
});

test("an LLM finding with an invented excerpt is discarded and counted in warnings", async () => {
  const state = stateWithFacts(
    fact({ id: "f1", subject: "Daren", predicate: "tiene", object: "la llave plateada" }),
  );
  const report = await checkContinuity({
    state,
    mode: "llm",
    responseText: "Daren negó todo y se marchó.",
    complete: async () => ({
      content: JSON.stringify({
        contradictions: [
          { factId: "f1", excerpt: "Daren arrojó la llave al río.", reason: "invented", severity: "high" },
        ],
      }),
    }),
  });
  assert.equal(report.findings.length, 0);
  assert.equal(report.method, "llm");
  assert.ok(report.warnings.some((warning) => warning.includes("excerpt")));
});

test("a valid LLM finding is accepted and the method is llm", async () => {
  const state = stateWithFacts(
    fact({ id: "f1", subject: "Daren", predicate: "tiene", object: "la llave plateada" }),
  );
  const responseText = "Daren ya no tiene la llave plateada.";
  let prompt = "";
  const report = await checkContinuity({
    state,
    mode: "llm",
    responseText,
    complete: async (messages) => {
      prompt = messages.map((message) => message.content).join("\n");
      return {
        content: `\`\`\`json\n${JSON.stringify({
          contradictions: [
            { factId: "f1", excerpt: "Daren ya no tiene la llave plateada.", reason: "Denies ownership.", severity: "medium" },
          ],
        })}\n\`\`\``,
      };
    },
  });
  assert.equal(report.method, "llm");
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].factId, "f1");
  assert.equal(report.findings[0].excerpt, "Daren ya no tiene la llave plateada.");
  assert.deepEqual(report.warnings, []);
  assert.ok(prompt.includes("la llave plateada"), "the prompt should carry the fact under check");
});

test("a failing LLM falls back to heuristics with method heuristic-fallback", async () => {
  const state = stateWithFacts(
    fact({ id: "f1", subject: "Daren", predicate: "juró", object: "proteger a Iris" }),
  );
  const report = await checkContinuity({
    state,
    mode: "auto",
    responseText: "Daren rompió su promesa y abandonó a Iris.",
    complete: async () => {
      throw new Error("provider offline");
    },
  });
  assert.equal(report.method, "heuristic-fallback");
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].factId, "f1");
  assert.ok(report.warnings.some((warning) => warning.includes("provider offline")));
});

test("memory disabled returns an empty report", async () => {
  const state = stateWithFacts(
    fact({ id: "f1", subject: "Daren", predicate: "tiene", object: "la llave plateada" }),
  );
  state.settings.enabled = false;
  let called = false;
  const report = await checkContinuity({
    state,
    mode: "llm",
    responseText: "Daren ya no tiene la llave plateada.",
    complete: async () => {
      called = true;
      return { content: "{}" };
    },
  });
  assert.equal(called, false);
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.warnings, []);
});

test("applyGuardReport stores lastGuard without touching other state", () => {
  const state = stateWithFacts(
    fact({ id: "f1", subject: "Daren", predicate: "tiene", object: "la llave plateada" }),
  );
  const report: GuardReport = {
    checkedAt: 42,
    messageId: "m5",
    method: "heuristic",
    findings: [{ factId: "f1", excerpt: "Daren ya no la tiene.", reason: "negation", severity: "high" }],
    warnings: ["note"],
  };
  applyGuardReport(state, report);
  assert.deepEqual(state.lastGuard, report);
  assert.equal(state.facts.length, 1);
  assert.equal(state.facts[0].object, "la llave plateada");
});

test("heuristics watch candidates quietly and ignore superseded facts", () => {
  const facts = [
    fact({ id: "candidate", subject: "Daren", predicate: "tiene", object: "la llave", status: "candidate", confidence: 0.6 }),
    fact({ id: "superseded", subject: "Iris", predicate: "es", object: "la guardiana", validUntilMessageId: "m9" }),
    fact({ id: "live", subject: "Rhea", predicate: "es", object: "la capitana", status: "confirmed", confidence: 1 }),
  ];
  const findings = detectHeuristicFindings(facts, "Daren ya no tiene la llave. Iris ya no es la guardiana. Rhea nunca fue la capitana.");

  // Nothing superseded is ever reported: its period of validity already ended.
  assert.ok(!findings.some((finding) => finding.factId === "superseded"));
  assert.equal(findings.length, 2);
  assert.deepEqual(findings.map((finding) => finding.factId).sort(), ["candidate", "live"]);
  assert.equal(findings.find((finding) => finding.factId === "candidate")?.severity, "low", "a low-confidence candidate is reported quietly");
  assert.equal(findings.find((finding) => finding.factId === "live")?.severity, "high");
});

test("a disputed fact is not reported again until it is resolved", () => {
  const facts = [fact({ id: "disputed", subject: "Daren", predicate: "tiene", object: "la llave", status: "disputed" })];
  assert.equal(detectHeuristicFindings(facts, "Daren ya no tiene la llave.").length, 0);
});

test("prompt facts are limited to current facts, prioritizing the responder", () => {
  const state = stateWithFacts(
    fact({ id: "old", subject: "Otro", predicate: "es", object: "algo", validUntilMessageId: "m2" }),
    fact({ id: "mine", subject: "Daren", predicate: "tiene", object: "la llave", entityIds: ["daren"] }),
    fact({ id: "public", subject: "Iris", predicate: "es", object: "la guardiana" }),
  );
  const selected = selectGuardFacts(state, "daren");
  assert.deepEqual(selected.map((entry) => entry.id), ["mine", "public"]);
});
