"use strict";

/**
 * Orchestrator
 *
 * The master agent. Coordinates all specialist agents, streams
 * live progress via Server-Sent Events, and assembles the final report.
 *
 * Agent pipeline:
 *
 *  ┌─────────────┐
 *  │  Orchestrator│  ← receives source code
 *  └──────┬──────┘
 *         │ parallel
 *    ┌────┴──────────────────┐
 *    ▼                       ▼
 * StaticAgent          HoneypotAgent
 *    │                       │
 *    └────────┬──────────────┘
 *             │ strategy planning
 *             ▼
 *      FuzzStrategyAgent
 *             │
 *             ▼ (parallel: generic + AI fuzz)
 *   ┌─────────┴──────────┐
 *   ▼                    ▼
 * GenericFuzz        FuzzRunner
 *   │                    │
 *   └────────┬───────────┘
 *            │
 *            ▼
 *   FuzzInterpreterAgent
 *            │
 *            ▼
 *       RatingAgent
 *            │
 *            ▼
 *       Final Report
 */

const { runStaticAgent }          = require("../agents/staticAgent");
const { runHoneypotAgent }        = require("../agents/honeypotAgent");
const { runFuzzStrategyAgent }    = require("../agents/fuzzStrategyAgent");
const { runFuzzRunnerAgent }      = require("../agents/fuzzRunnerAgent");
const { runFuzzInterpreterAgent } = require("../agents/fuzzInterpreterAgent");
const { runRatingAgent }          = require("../agents/ratingAgent");
const { runGenericFuzz }          = require("../modules/genericFuzz");

// ─────────────────────────────────────────────────────────────────────────────
//  Public API  — streaming version (SSE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the full multi-agent pipeline, emitting progress events as it goes.
 *
 * @param {string}   sourceCode
 * @param {string|null} address   deployed address (Sepolia)
 * @param {object}   modules      { static, honeypot, genericFuzz, aiFuzz }
 * @param {Function} emit         (event: string, data: object) => void
 *
 * @returns {Promise<FinalReport>}
 */
async function runOrchestrator(sourceCode, address, modules, emit) {
  const report = {
    contractName: extractName(sourceCode),
    timestamp:    new Date().toISOString(),
    static:       null,
    honeypot:     null,
    fuzzStrategy: null,
    genericFuzz:  null,
    aiFuzz:       null,
    rating:       null,
    errors:       {},
  };

  // ── 0. Announce start ────────────────────────────────────────────────
  emit("agent:start", { agent: "orchestrator", message: "Pipeline started" });

  // ── 1. Static analysis + Honeypot in PARALLEL ────────────────────────
  if (modules.static !== false) {
    emit("agent:start", { agent: "static", message: "Gemini static vulnerability scan started" });
  }
  if (modules.honeypot !== false) {
    emit("agent:start", { agent: "honeypot", message: "Honeypot + bytecode analysis started" });
  }

  const [staticResult, honeypotResult] = await Promise.all([
    modules.static !== false
      ? runStaticAgent(sourceCode)
          .then((r) => { emit("agent:done", { agent: "static",   result: r }); return r; })
          .catch((e) => { handleErr("static",   e, report, emit); return null; })
      : Promise.resolve(null),

    modules.honeypot !== false
      ? runHoneypotAgent(sourceCode, address)
          .then((r) => { emit("agent:done", { agent: "honeypot", result: r }); return r; })
          .catch((e) => { handleErr("honeypot", e, report, emit); return null; })
      : Promise.resolve(null),
  ]);

  report.static   = staticResult;
  report.honeypot = honeypotResult;

  // ── 2. Fuzz Strategy (sequential — needs static output) ──────────────
  let fuzzStrategy = null;
  if (modules.genericFuzz !== false || modules.aiFuzz !== false) {
    emit("agent:start", { agent: "fuzzStrategy", message: "Fuzz strategy agent planning invariants..." });
    try {
      fuzzStrategy = await runFuzzStrategyAgent(sourceCode, staticResult || {});
      report.fuzzStrategy = fuzzStrategy;
      emit("agent:done", { agent: "fuzzStrategy", result: fuzzStrategy });
    } catch (e) {
      handleErr("fuzzStrategy", e, report, emit);
    }
  }

  // ── 3. Generic fuzz + AI-driven fuzz in PARALLEL ─────────────────────
  if (modules.genericFuzz !== false) {
    emit("agent:start", { agent: "genericFuzz", message: "Generic Foundry invariant suite starting..." });
  }
  if (modules.aiFuzz !== false) {
    emit("agent:start", { agent: "aiFuzz", message: "AI-driven fuzz runner starting..." });
  }

  const [genericResult, aiFuzzResult] = await Promise.all([
    modules.genericFuzz !== false
      ? runGenericFuzz(sourceCode)
          .then((r) => { emit("agent:done", { agent: "genericFuzz", result: r }); return r; })
          .catch((e) => { handleErr("genericFuzz", e, report, emit); return null; })
      : Promise.resolve(null),

    modules.aiFuzz !== false
      ? runFuzzRunnerAgent(sourceCode, fuzzStrategy || {})
          .then((r) => { emit("agent:done", { agent: "aiFuzz", result: r }); return r; })
          .catch((e) => { handleErr("aiFuzz", e, report, emit); return null; })
      : Promise.resolve(null),
  ]);

  report.genericFuzz = genericResult;

  // ── 4. Fuzz interpretation ────────────────────────────────────────────
  const allFuzzTests = [
    ...(genericResult?.tests || []),
    ...(aiFuzzResult?.tests  || []),
  ];

  let fuzzInterp = null;
  const fuzzWasEnabled = modules.genericFuzz !== false || modules.aiFuzz !== false;
  if (allFuzzTests.some((t) => t.status === "fail")) {
    emit("agent:start", { agent: "fuzzInterp", message: "Interpreter agent explaining fuzz failures..." });
    try {
      fuzzInterp = await runFuzzInterpreterAgent(allFuzzTests, sourceCode, staticResult);
      emit("agent:done", { agent: "fuzzInterp", result: fuzzInterp });
    } catch (e) {
      handleErr("fuzzInterp", e, report, emit);
    }
  } else if (fuzzWasEnabled) {
    emit("agent:done", {
      agent: "fuzzInterp",
      result: { interpretations: [], overallFuzzSeverity: "none", newFindingsVsStatic: "No fuzz failures to interpret." },
    });
  }

  // Enrich aiFuzz with interpretations
  report.aiFuzz = aiFuzzResult
    ? { ...aiFuzzResult, interpretations: fuzzInterp?.interpretations ?? [] }
    : null;

  // ── 5. Rating agent ───────────────────────────────────────────────────
  emit("agent:start", { agent: "rating", message: "Rating agent computing final score..." });
  try {
    const rating = await runRatingAgent(
      {
        static:       staticResult,
        honeypot:     honeypotResult,
        fuzzStrategy: fuzzStrategy,
        fuzzRunner:   aiFuzzResult,
        fuzzInterp:   fuzzInterp,
      },
      sourceCode
    );
    report.rating = rating;
    emit("agent:done", { agent: "rating", result: rating });
  } catch (e) {
    handleErr("rating", e, report, emit);
  }

  // ── 6. Done ───────────────────────────────────────────────────────────
  emit("agent:complete", { message: "All agents finished", report });
  return report;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Non-streaming wrapper (for simple HTTP POST responses)
// ─────────────────────────────────────────────────────────────────────────────

async function runOrchestratorSimple(sourceCode, address, modules) {
  const events = [];
  const emit = (event, data) => events.push({ event, data });
  const report = await runOrchestrator(sourceCode, address, modules, emit);
  report._events = events;
  return report;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function handleErr(agent, err, report, emit) {
  report.errors[agent] = err.message;
  emit("agent:error", { agent, message: err.message });
}

function extractName(src) {
  return src.match(/\bcontract\s+(\w+)/)?.[1] ?? "Unknown";
}

module.exports = { runOrchestrator, runOrchestratorSimple };
