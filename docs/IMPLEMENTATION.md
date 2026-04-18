# Implementation Reference

Complete technical documentation for VeriSol AI.

---

## Ports

| Service | Port | URL |
|---|---|---|
| **Backend API** | `3001` | `http://localhost:3001` |
| **Frontend (Vite)** | `5173` | `http://localhost:5173` |
| **Vite → backend proxy** | auto | `/api/*` proxied to `3001` |

> Point your API calls to `http://localhost:3001`.

---

## Complete API Response Schemas

### POST `/api/scan` — Full response

```typescript
interface ScanReport {
  contractName:  string;
  timestamp:     string;          // ISO 8601
  static:        StaticResult | null;
  honeypot:      HoneypotResult | null;
  fuzzStrategy:  FuzzStrategy | null;
  genericFuzz:   FuzzRunResult | null;
  aiFuzz:        AIFuzzResult | null;
  rating:        Rating | null;
  errors:        Record<string, string>; // agent name → error message
}
```

---

### `StaticResult`

```typescript
interface StaticResult {
  contractName:     string;
  solidityVersion:  string;
  linesOfCode:      number;
  summary:          string;
  rawScore:         number;          // 0-100 pre-Gemini score
  overallRisk:      "critical"|"high"|"medium"|"low"|"informational";
  abi: Array<{
    type:            "function"|"event"|"constructor";
    name:            string;
    inputs:          Array<{ type: string; name: string }>;
    stateMutability: "pure"|"view"|"nonpayable"|"payable";
  }>;
  findings: Array<{
    id:             string;           // "VSF-001"
    title:          string;
    severity:       "critical"|"high"|"medium"|"low"|"informational";
    category:       string;           // "Reentrancy", "Access Control", ...
    description:    string;
    impact:         string;
    location:       string;           // function name or line ref
    codeSnippet:    string;
    recommendation: string;
    cweid:          string | null;    // "CWE-841" etc
  }>;
  gasOptimizations: Array<{
    title:       string;
    description: string;
  }>;
}
```

---

### `HoneypotResult`

```typescript
interface HoneypotResult {
  verdict:      "SAFE"|"SUSPICIOUS"|"LIKELY_HONEYPOT"|"CONFIRMED_HONEYPOT"|"UNKNOWN";
  trapped:      boolean;
  confidence:   number;              // 0-100
  rugPullRisk:  "none"|"low"|"medium"|"high"|"critical";
  safeToDeposit: boolean;
  summary:      string;
  patterns: Array<{
    name:         string;
    severity:     "critical"|"high"|"medium"|"low";
    description:  string;
    codeEvidence: string;
  }>;
  steps: Array<{
    step:   string;
    result: string;
    ok:     boolean;
  }>;
  bytecodeFlags: {
    hasSelfDestruct: boolean;
    hasDelegateCall: boolean;
  };
  simulationFlags: {
    depositSimulated:      boolean;
    withdrawSimulated:     boolean;
    withdrawRevertReason:  string | null;
  };
}
```

---

### `FuzzStrategy`

```typescript
interface FuzzStrategy {
  contractType:         "token"|"vault"|"dao"|"nft"|"amm"|"other";
  highRiskFunctions:    string[];     // ["withdraw(uint256)", "transfer(address,uint256)"]
  invariants: Array<{
    id:              string;          // "INV-001"
    name:            string;
    description:     string;
    targetFunction:  string;
    inputBounds:     string;
    testType:        "fuzz"|"invariant"|"unit";
    priority:        "critical"|"high"|"medium"|"low";
  }>;
  attackScenarios: Array<{
    name:             string;
    steps:            string[];
    expectedOutcome:  string;
    forgeTestHint:    string;
  }>;
  recommendedFuzzRuns: number;
  notes:               string;
}
```

---

### `FuzzRunResult` (generic + AI fuzz share this shape)

```typescript
interface FuzzRunResult {
  engine:         "foundry"|"ai-gemini"|"static-heuristic";
  forgeAvailable: boolean;
  passed:         boolean;
  compileError:   string | null;
  rawOutput:      string;
  tests: Array<{
    name:            string;
    status:          "pass"|"fail"|"warn"|"pending";
    reason:          string | null;
    counterexample:  string | null;
    gas:             number;
  }>;
  // Only on aiFuzz:
  generatedTest?:  string;           // the full Solidity test file Gemini wrote
  interpretations?: Array<{
    testName:                string;
    vulnerability:           string;
    cweid:                   string | null;
    severity:                "critical"|"high"|"medium"|"low";
    plainExplanation:        string;
    attackVector:            string;
    counterexampleExplained: string | null;
    fix:                     string;
  }>;
}
```

---

### `Rating`

```typescript
interface Rating {
  numericScore:   number;            // 0-100
  letterGrade:    "A+"|"A"|"A-"|"B+"|"B"|"B-"|"C+"|"C"|"C-"|"D"|"F";
  riskTier:       "Safe"|"Low Risk"|"Medium Risk"|"High Risk"|"Critical";
  recommendation: "Deploy Safely"|"Review Before Deploying"|"Do Not Deploy";
  categoryScores: {
    accessControl:   number;         // 0-100
    arithmetic:      number;
    reentrancy:      number;
    inputValidation: number;
    logic:           number;
    upgradeability:  number;
    codeQuality:     number;
  };
  executiveSummary:     string;
  topThreeRisks:        string[];
  positives:            string[];
  auditConfidence:      number;      // 0-100
  auditConfidenceNote:  string;
}
```

---

## SSE Event Reference

All SSE events carry `event: <name>` and `data: <JSON string>`.

```
GET /api/scan/stream
  ?inputType=code|address|github
  &value=<base64(rawValue)>
  &modules=<base64(JSON)>
```

### Encoding params

```js
// Frontend encoding (copy-paste ready)
const encoded  = btoa(unescape(encodeURIComponent(solidityCode)));
const modEncod = btoa(JSON.stringify({ static: true, honeypot: true, genericFuzz: true, aiFuzz: true }));
const url = `http://localhost:3001/api/scan/stream`
          + `?inputType=code`
          + `&value=${encodeURIComponent(encoded)}`
          + `&modules=${encodeURIComponent(modEncod)}`;
```

### Event payloads

```
source:resolved  →  { contractName: string, linesOfCode: number }
agent:start      →  { agent: AgentId, message: string }
agent:done       →  { agent: AgentId, result: AgentResult }
agent:error      →  { agent: AgentId, message: string }
agent:complete   →  { message: string, report: ScanReport }
ping             →  { ts: number }
error            →  { message: string }
```

### Agent IDs

```
orchestrator | static | honeypot | fuzzStrategy | genericFuzz | aiFuzz | fuzzInterp | rating
```

---

## Agent Execution Order

```
                    ┌─────────────────────────────────────────────┐
                    │              Orchestrator                   │
                    └───────────────────┬─────────────────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              │  PARALLEL BATCH 1       │                         │
              ▼                         ▼                         │
        StaticAgent              HoneypotAgent                   │
      (Gemini audit)         (bytecode+eth_call+Gemini)           │
              │                         │                         │
              └─────────────┬───────────┘                         │
                            │                                     │
                            ▼                                     │
                    FuzzStrategyAgent                             │
                  (Gemini plans invariants)                       │
                            │                                     │
              ┌─────────────┴─────────────────┐                  │
              │  PARALLEL BATCH 2             │                  │
              ▼                               ▼                  │
       GenericFuzz                    FuzzRunnerAgent            │
    (pre-written forge suite)   (Gemini generates + forge runs)  │
              │                               │                  │
              └─────────────┬─────────────────┘                  │
                            │                                     │
                            ▼                                     │
                  FuzzInterpreterAgent                            │
                 (Gemini explains failures)                       │
                            │                                     │
                            ▼                                     │
                       RatingAgent           ◀────────────────────┘
                 (Gemini final grade)
                            │
                            ▼
                       Final Report
```

---

## Foundry Integration

### How the fuzz runner works

1. `foundryRunner.js` creates a temp directory: `/tmp/verisol/forge_<timestamp>`
2. Writes `foundry.toml`, `src/Target.sol` (user's contract), `test/Fuzz.t.sol`
3. Installs `forge-std` via `forge install foundry-rs/forge-std --no-commit`
   - Falls back to embedded `Test.sol` stub if offline
4. Runs `forge build --silent` — parse compile errors
5. Runs `forge test --json -vvv --fuzz-runs <N>`
6. Parses JSON output → `TestResult[]`
7. Deletes temp directory

### forge-std remapping

```toml
remappings = ["forge-std/=lib/forge-std/src/"]
```

### Fuzz test contract shape

Every generated test must:
- Deploy via `vm.getCode("Target.sol:ContractName")` + `assembly { addr := create(...) }`
- Use only `target.call{...}(abi.encodeWithSignature(...))` — no direct import
- All fuzz functions: `testFuzz_<name>(...)` prefix
- Include `receive() external payable {}` and `fallback() external payable {}`

---

## Gemini Usage

All agents use **`gemini-1.5-pro`** via `@google/generative-ai`.

| Agent | Model | Max tokens | Temperature |
|---|---|---|---|
| Static | `gemini-1.5-pro` | 3000 | 0.1 |
| Honeypot (AI pass) | `gemini-1.5-pro` | 2048 | 0.1 |
| Fuzz Strategy | `gemini-1.5-pro` | 2000 | 0.1 |
| Fuzz Runner (gen) | `gemini-1.5-pro` | 3000 | 0.1 |
| Fuzz Runner (repair) | `gemini-1.5-flash` | 3000 | 0.1 |
| Fuzz Interpreter | `gemini-1.5-pro` | 2000 | 0.1 |
| Rating | `gemini-1.5-pro` | 1500 | 0.1 |

---

## CORS Configuration

```js
// backend/server.js
app.use(cors({ origin: "http://localhost:5173" }));
```

For production environments, update the `origin` to your frontend URL.

---

## Debugging

### Debug flags

```bash
# backend/.env
DEBUG=verisol:*          # all namespaces
DEBUG=verisol:forge      # only foundry runner
DEBUG=verisol:agents     # only agent calls
DEBUG=verisol:gemini     # only Gemini API calls
```

### Manual agent tests

```bash
cd backend
node scripts/testAgent.js static
node scripts/testAgent.js honeypot
node scripts/testAgent.js rating
node scripts/testForge.js
```

### Inspect SSE stream with curl

```bash
curl -N "http://localhost:3001/api/scan/stream?inputType=code&value=$(echo -n 'pragma solidity ^0.8.0; contract X {}' | base64)&modules=$(echo -n '{"static":true}' | base64)"
```
