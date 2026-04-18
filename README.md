# VeriSol AI 🤖

> **Multi-agent smart contract security scanner** — powered by Google Gemini 1.5 Pro, Foundry fuzz testing, and live on-chain honeypot simulation.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)](https://nodejs.org)
[![Foundry](https://img.shields.io/badge/foundry-required-orange)](https://getfoundry.sh)

---

## ✨ What it does

VeriSol AI spins up **6 specialist AI agents** that run in a coordinated pipeline to give you a complete security picture of any Solidity contract:

| Agent | What it does |
|---|---|
| **Static Analysis Agent** | Gemini audits for 25+ vulnerability classes (reentrancy, overflow, tx.origin, etc.) |
| **Honeypot Agent** | 3-layer check: EVM bytecode scan → live `eth_call` on Sepolia → Gemini AI audit |
| **Fuzz Strategy Agent** | Plans which invariants to test based on the contract's actual functions |
| **Fuzz Runner Agent** | Gemini generates a Foundry test file, compiles & runs it with `forge test` |
| **Fuzz Interpreter Agent** | Explains every forge failure in plain English with CWE mappings |
| **Rating Agent** | Aggregates all findings into a score (0–100), letter grade (A+–F), and recommendation |

Results stream back to the browser in real-time via **Server-Sent Events** so you see each agent fire as it happens.

---

## 🏗 Architecture

```
Browser (React + Vite)
  │  EventSource → GET /api/scan/stream
  │  POST        → POST /api/scan  (non-streaming fallback)
  ▼
Express API  :3001
  └─ Orchestrator
       ├─ [parallel] StaticAgent      → Gemini 1.5 Pro
       ├─ [parallel] HoneypotAgent    → bytecode + eth_call + Gemini
       │
       ├─ FuzzStrategyAgent           → Gemini (uses static output)
       │
       ├─ [parallel] GenericFuzz      → forge test (pre-written suite)
       ├─ [parallel] FuzzRunnerAgent  → Gemini generates test → forge test
       │
       ├─ FuzzInterpreterAgent        → Gemini explains failures
       └─ RatingAgent                 → Gemini computes final grade
```

---

## 📂 Project Structure

```
verisol-ai-scanner/
│
├── backend/
│   ├── server.js                   # Express entry point  (port 3001)
│   ├── .env.example                # Copy → .env and fill in keys
│   ├── check-env.js                # Pre-flight key checker
│   │
│   ├── agents/                     # ◀ All AI agents live here
│   │   ├── orchestrator.js         # Master coordinator (SSE + parallel dispatch)
│   │   ├── staticAgent.js          # Gemini static vulnerability audit
│   │   ├── honeypotAgent.js        # Bytecode + eth_call + Gemini honeypot
│   │   ├── fuzzStrategyAgent.js    # Invariant planning agent
│   │   ├── fuzzRunnerAgent.js      # Test generation + forge execution
│   │   ├── fuzzInterpreterAgent.js # Failure explanation agent
│   │   └── ratingAgent.js          # Score + grade + recommendation
│   │
│   ├── modules/
│   │   ├── genericFuzz.js          # Pre-written Foundry invariant suite
│   │   └── honeypot.js             # Low-level honeypot detection (viem)
│   │
│   ├── routes/
│   │   └── scan.js                 # GET /stream (SSE) + POST /
│   │
│   ├── utils/
│   │   ├── geminiClient.js         # Shared Gemini client factory
│   │   ├── foundryRunner.js        # forge subprocess wrapper
│   │   └── fetchSource.js          # Etherscan / GitHub / raw source resolver
│   │
│   └── tests/
│       ├── agents.test.js          # Jest unit tests for each agent
│       ├── integration.test.js     # Full pipeline tests
│       └── fixtures/               # Sample contracts for tests
│
├── frontend/                       # React 18 + Vite + TailwindCSS
│   └── src/
│       ├── App.jsx
│       ├── hooks/useScan.js        # SSE hook — all API communication
│       └── components/
│           ├── Header.jsx
│           ├── InputPanel.jsx
│           ├── ModuleSelector.jsx
│           ├── ScanProgress.jsx    # Live agent status grid
│           ├── ResultsPanel.jsx    # Full report layout
│           ├── RatingCard.jsx      # Score ring + grade + categories
│           ├── FindingCard.jsx     # Individual vulnerability card
│           ├── HoneypotResults.jsx
│           └── FuzzResults.jsx
│
├── fuzz/                           # Standalone Foundry project
│   ├── foundry.toml
│   ├── src/ITarget.sol
│   └── test/GenericFuzz.t.sol      # 6 invariant tests + ReentrancyAttacker
│
└── contracts/
    └── VulnerableBank.sol          # Demo contract with 4 intentional bugs
```

---

## 🚀 Quick Start

### 1. Prerequisites

```bash
# Node.js 18+
node --version   # must be ≥ 18

# Foundry  (for fuzz testing)
curl -L https://foundry.paradigm.xyz | bash
foundryup
forge --version  # confirm it works

# Git (for forge install)
git --version
```

### 2. Clone & install

```bash
git clone https://github.com/yourusername/verisol-ai-scanner.git
cd verisol-ai-scanner

# Install all at once
npm run install:all

# Or separately
cd backend  && npm install && cd ..
cd frontend && npm install && cd ..
```

### 3. Configure environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
GEMINI_API_KEY=AIza...           # Required — get at aistudio.google.com
ETHERSCAN_API_KEY=ABC123...      # Required only for address scanning
SEPOLIA_RPC_URL=https://rpc.sepolia.org   # Default is fine; swap for Alchemy/Infura
PORT=3001
FOUNDRY_PATH=forge               # Full path only if forge isn't in PATH
TEMP_DIR=/tmp/verisol            # Temp dir for forge projects
```

Verify your setup:

```bash
cd backend
node check-env.js
```

### 4. Run

```bash
# From repo root — starts both servers concurrently
npm run dev

# Or manually:
cd backend  && npm run dev   # http://localhost:3001
cd frontend && npm run dev   # http://localhost:5173
```

Open **http://localhost:5173**, paste `contracts/VulnerableBank.sol`, and hit **Run Security Scan**.

---

## 🔌 API Reference

### Base URL
```
http://localhost:3001
```

### Endpoints

#### `GET /api/health`
```json
{ "status": "ok", "version": "1.0.0" }
```

---

#### `GET /api/scan/stream` — **Real-time SSE scan**

Query params (all base64-encoded):

| Param | Type | Description |
|---|---|---|
| `inputType` | `"code"\|"address"\|"github"` | How to resolve the contract |
| `value` | `base64(string)` | The code / address / URL |
| `modules` | `base64(JSON)` | `{"static":true,"honeypot":true,"genericFuzz":true,"aiFuzz":true}` |

**SSE event types:**

| Event | Payload | When |
|---|---|---|
| `source:resolved` | `{contractName, linesOfCode}` | Source fetched successfully |
| `agent:start` | `{agent, message}` | Agent begins work |
| `agent:done` | `{agent, result}` | Agent finished with result |
| `agent:error` | `{agent, message}` | Agent failed (pipeline continues) |
| `agent:complete` | `{message, report}` | All agents done — full report included |
| `ping` | `{ts}` | Keep-alive every 15s |
| `error` | `{message}` | Fatal error — stream closes |

**Example (browser):**
```js
const value   = btoa(solidityCode);
const modules = btoa(JSON.stringify({ static: true, honeypot: true, genericFuzz: true, aiFuzz: true }));
const es = new EventSource(`/api/scan/stream?inputType=code&value=${encodeURIComponent(value)}&modules=${encodeURIComponent(modules)}`);

es.addEventListener("agent:done",     (e) => console.log(JSON.parse(e.data)));
es.addEventListener("agent:complete", (e) => { console.log("Report:", JSON.parse(e.data).report); es.close(); });
```

---

#### `POST /api/scan` — **Simple JSON scan (no streaming)**

```json
{
  "inputType": "code",
  "value": "<solidity source>",
  "modules": { "static": true, "honeypot": true, "genericFuzz": true, "aiFuzz": true }
}
```

**Response:**
```json
{
  "contractName": "VulnerableBank",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "static":      { ... },
  "honeypot":    { ... },
  "fuzzStrategy":{ ... },
  "genericFuzz": { ... },
  "aiFuzz":      { ... },
  "rating":      { ... },
  "errors":      { }
}
```

**Full response schema** → see `docs/IMPLEMENTATION.md`

---

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ | — | Google AI Studio key |
| `ETHERSCAN_API_KEY` | ⚠️ address scan | — | Sepolia Etherscan key |
| `SEPOLIA_RPC_URL` | ❌ | `https://rpc.sepolia.org` | JSON-RPC endpoint |
| `PORT` | ❌ | `3001` | Backend port |
| `FOUNDRY_PATH` | ❌ | `forge` | Path to forge binary |
| `TEMP_DIR` | ❌ | `/tmp/verisol` | Temp dir for forge projects |

---

## 🧪 Running Tests

```bash
cd backend
npm test                    # all tests
npm run test:unit           # agent unit tests only
npm run test:integration    # full pipeline (requires API keys)
npm run test:debug          # verbose output + no timeout
```

---

## 🐛 Debugging

### Enable verbose logging
```env
DEBUG=verisol:*
```

### Test individual agents
```bash
node scripts/testAgent.js static      # run only static agent
node scripts/testAgent.js honeypot    # run only honeypot agent
node scripts/testAgent.js rating      # run only rating agent
```

### Test forge runner directly
```bash
node scripts/testForge.js             # checks forge is installed + working
```

### Common issues

| Problem | Fix |
|---|---|
| `forge not found` | Run `foundryup` then check `which forge` |
| `GEMINI_API_KEY not set` | Add key to `backend/.env` |
| `SSE connection drops` | Check `CORS` origin in `server.js` matches your frontend port |
| `Compile error in fuzz test` | AI fuzz has a repair loop — check `backend/agents/fuzzRunnerAgent.js` |
| `eth_call fails on Sepolia` | Switch `SEPOLIA_RPC_URL` to Alchemy or Infura |

---

---

## 📜 License

MIT
