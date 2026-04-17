"use strict";

require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const path     = require("path");
const fs       = require("fs-extra");

const scanRouter = require("./routes/scan");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── CORS — allow localhost dev + Lovable preview domains ──────────────────
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:3000",
    /https:\/\/.*\.lovable\.app$/,
    process.env.CORS_ORIGIN,
  ].filter(Boolean),
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));
app.use(express.json({ limit: "10mb" }));

// ── Health ────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({
    status:    "ok",
    version:   "2.0.0",
    openai:    !!process.env.OPENAI_API_KEY,
    gemini:    !!process.env.GEMINI_API_KEY,
    etherscan: !!process.env.ETHERSCAN_API_KEY,
    port:      PORT,
  })
);

// ── Contract library ──────────────────────────────────────────────────────
// Returns metadata + full source for all pre-built example contracts.
// Used by the "Load Example" buttons in the frontend.
app.get("/api/contracts", (_req, res) => {
  try {
    const { CONTRACTS } = require(path.join(__dirname, "../contracts/index.js"));
    // Strip source from the list endpoint (save bandwidth)
    const list = Object.values(CONTRACTS).map(({ source: _src, ...meta }) => meta);
    res.json({ contracts: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Returns the full source for a single contract by id
app.get("/api/contracts/:id", (req, res) => {
  try {
    const { CONTRACTS } = require(path.join(__dirname, "../contracts/index.js"));
    const contract = CONTRACTS[req.params.id];
    if (!contract) return res.status(404).json({ error: "Contract not found" });
    res.json(contract);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Scan ──────────────────────────────────────────────────────────────────
app.use("/api/scan", scanRouter);

// ── Start ─────────────────────────────────────────────────────────────────
async function start() {
  await fs.ensureDir(process.env.TEMP_DIR || "/tmp/verisol");

  app.listen(PORT, () => {
    console.log(`\n🤖  VeriSol AI v2  →  http://localhost:${PORT}`);
    console.log(`    OpenAI    : ${process.env.OPENAI_API_KEY    ? "✓ set" : "✗ MISSING — add OPENAI_API_KEY to .env"}`);
    console.log(`    Etherscan : ${process.env.ETHERSCAN_API_KEY  ? "✓ set" : "✗ missing (needed for address scanning only)"}`);
    console.log(`    CORS      : localhost:5173, localhost:3000, *.lovable.app`);
    console.log();
  });
}

start().catch((err) => { console.error("Fatal startup error:", err); process.exit(1); });
