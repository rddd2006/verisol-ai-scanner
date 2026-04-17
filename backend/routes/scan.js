"use strict";

const express = require("express");
const router  = express.Router();

const { fetchSource }              = require("../utils/fetchSource");
const { runOrchestrator,
        runOrchestratorSimple }    = require("../agents/orchestrator");

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/scan/stream  — Server-Sent Events (real-time progress)
//
//  Query params:
//    inputType : "code" | "address" | "github"
//    value     : base64-encoded input value
//    modules   : base64-encoded JSON  { static, honeypot, genericFuzz, aiFuzz }
// ─────────────────────────────────────────────────────────────────────────────
router.get("/stream", async (req, res) => {
  // SSE headers
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // for nginx
  res.flushHeaders();

  const { inputType, value: encodedValue, modules: encodedModules } = req.query;

  if (!inputType || !encodedValue) {
    sendSSE(res, "error", { message: "inputType and value are required" });
    return res.end();
  }

  let value, modules;
  try {
    value   = Buffer.from(encodedValue,   "base64").toString("utf8");
    modules = encodedModules
      ? JSON.parse(Buffer.from(encodedModules, "base64").toString("utf8"))
      : {};
  } catch {
    sendSSE(res, "error", { message: "Failed to decode query parameters" });
    return res.end();
  }

  // Resolve source
  let sourceCode, contractName;
  try {
    const fetched = await fetchSource(inputType, value);
    sourceCode    = fetched.source;
    contractName  = fetched.name;
  } catch (e) {
    sendSSE(res, "error", { message: `Source fetch failed: ${e.message}` });
    return res.end();
  }

  if (!sourceCode?.trim()) {
    sendSSE(res, "error", { message: "Could not retrieve non-empty Solidity source." });
    return res.end();
  }

  const address = inputType === "address" && /^0x[0-9a-fA-F]{40}$/.test(value.trim())
    ? value.trim()
    : null;

  // Keep-alive ping every 15s so proxy doesn't close idle SSE
  const ping = setInterval(() => sendSSE(res, "ping", { ts: Date.now() }), 15_000);

  sendSSE(res, "source:resolved", { contractName, linesOfCode: sourceCode.split("\n").length });

  try {
    await runOrchestrator(sourceCode, address, modules, (event, data) => {
      sendSSE(res, event, data);
    });
  } catch (e) {
    sendSSE(res, "error", { message: e.message });
  } finally {
    clearInterval(ping);
    res.end();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/scan  — traditional JSON response (non-streaming)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { inputType, value, modules = {} } = req.body;

  if (!inputType || !value) {
    return res.status(400).json({ error: "inputType and value are required." });
  }

  let sourceCode, contractName;
  try {
    const fetched = await fetchSource(inputType, value);
    sourceCode    = fetched.source;
    contractName  = fetched.name;
  } catch (e) {
    return res.status(400).json({ error: `Source fetch failed: ${e.message}` });
  }

  if (!sourceCode?.trim()) {
    return res.status(400).json({ error: "Could not retrieve non-empty Solidity source." });
  }

  const address = inputType === "address" && /^0x[0-9a-fA-F]{40}$/.test(value.trim())
    ? value.trim()
    : null;

  try {
    const report = await runOrchestratorSimple(sourceCode, address, modules);
    return res.json(report);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Helper
// ─────────────────────────────────────────────────────────────────────────────
function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  if (res.flush) res.flush(); // compression middleware
}

module.exports = router;
