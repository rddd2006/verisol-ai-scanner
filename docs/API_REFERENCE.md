# VeriSol AI Frontend Integration Guide

This guide covers frontend integration with the VeriSol AI backend.

---

## Backend URL

```
http://localhost:3001
```

---

## CORS Configuration

The backend is pre-configured to accept requests from localhost. For production:

In `backend/server.js`, update origins:
```js
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:8080",
    "https://yourdomain.com",  // your frontend domain
  ]
}));
```

---

## API Endpoints

### 1. Health check
```
GET http://localhost:3001/api/health
→ { status: "ok", version: "1.0.0" }
```

### 2. Streaming scan (SSE) — PRIMARY
```
GET http://localhost:3001/api/scan/stream
  ?inputType=<"code"|"address"|"github">
  &value=<base64(input)>
  &modules=<base64(JSON)>
```

### 3. Simple JSON scan — FALLBACK
```
POST http://localhost:3001/api/scan
Content-Type: application/json
Body: { inputType, value, modules }
```

---

## Complete SSE Hook (for frontend integration)

```typescript
import { useState, useCallback, useRef } from "react";

const API_BASE = "http://localhost:3001"; // ← update for production

export type Phase = "idle" | "scanning" | "done" | "error";

export interface AgentState {
  [agentId: string]: "idle" | "running" | "done" | "error";
}

export interface ScanOptions {
  inputType: "code" | "address" | "github";
  value: string;
  modules: {
    static:      boolean;
    honeypot:    boolean;
    genericFuzz: boolean;
    aiFuzz:      boolean;
  };
}

export function useVeriSolScan() {
  const [phase,       setPhase]       = useState<Phase>("idle");
  const [agentStates, setAgentStates] = useState<AgentState>({});
  const [agentData,   setAgentData]   = useState<Record<string, any>>({});
  const [report,      setReport]      = useState<any>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [log,         setLog]         = useState<Array<{ ts: number; type: string; agent?: string; message: string }>>([]);
  const esRef = useRef<EventSource | null>(null);

  const appendLog = (entry: { type: string; agent?: string; message: string }) =>
    setLog((prev) => [...prev, { ts: Date.now(), ...entry }]);

  const scan = useCallback((opts: ScanOptions) => {
    if (!opts.value?.trim()) {
      setError("Please provide contract source code, address, or GitHub URL.");
      return;
    }

    esRef.current?.close();

    setPhase("scanning");
    setAgentStates({});
    setAgentData({});
    setReport(null);
    setError(null);
    setLog([]);

    // Encode value as base64 (UTF-8 safe)
    const encoded  = btoa(unescape(encodeURIComponent(opts.value)));
    const modEncod = btoa(JSON.stringify(opts.modules));

    const url = `${API_BASE}/api/scan/stream`
              + `?inputType=${opts.inputType}`
              + `&value=${encodeURIComponent(encoded)}`
              + `&modules=${encodeURIComponent(modEncod)}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("source:resolved", (e) => {
      const d = JSON.parse(e.data);
      appendLog({ type: "info", message: `Resolved: ${d.contractName} (${d.linesOfCode} lines)` });
    });

    es.addEventListener("agent:start", (e) => {
      const { agent, message } = JSON.parse(e.data);
      setAgentStates((prev) => ({ ...prev, [agent]: "running" }));
      appendLog({ type: "start", agent, message });
    });

    es.addEventListener("agent:done", (e) => {
      const { agent, result } = JSON.parse(e.data);
      setAgentStates((prev) => ({ ...prev, [agent]: "done" }));
      setAgentData  ((prev) => ({ ...prev, [agent]: result }));
      appendLog({ type: "done", agent, message: `${agent} completed` });
    });

    es.addEventListener("agent:error", (e) => {
      const { agent, message } = JSON.parse(e.data);
      setAgentStates((prev) => ({ ...prev, [agent]: "error" }));
      appendLog({ type: "error", agent, message });
    });

    es.addEventListener("agent:complete", (e) => {
      const { report: r } = JSON.parse(e.data);
      setReport(r);
      setPhase("done");
      appendLog({ type: "complete", message: "Scan complete" });
      es.close();
    });

    es.addEventListener("error", (e: any) => {
      if (es.readyState === EventSource.CLOSED) return;
      const msg = e.data ? JSON.parse(e.data).message : "SSE error";
      setError(msg);
      setPhase("error");
      es.close();
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) return;
      setError("Could not connect to backend on port 3001. Is the server running?");
      setPhase("error");
      es.close();
    };
  }, []);

  const reset = useCallback(() => {
    esRef.current?.close();
    setPhase("idle");
    setAgentStates({});
    setAgentData({});
    setReport(null);
    setError(null);
    setLog([]);
  }, []);

  return { phase, agentStates, agentData, report, error, log, scan, reset };
}
```

---

## All React Components and Their Props

### `<InputPanel />`
```typescript
interface InputPanelProps {
  inputType:    "code" | "address" | "github";
  setInputType: (t: "code" | "address" | "github") => void;
  value:        string;
  setValue:     (v: string) => void;
  modules: {
    static:      boolean;
    honeypot:    boolean;
    genericFuzz: boolean;
    aiFuzz:      boolean;
  };
  setModules: (m: any) => void;
  onScan:     () => void;
  error:      string | null;
}
```
Renders: tab switcher (Paste Code / Sepolia Address / GitHub Repo),
textarea / input, module checkboxes, Scan button, Load Demo button.

---

### `<ModuleSelector />`
```typescript
interface ModuleSelectorProps {
  modules:    { static: boolean; honeypot: boolean; genericFuzz: boolean; aiFuzz: boolean };
  setModules: (m: any) => void;
}
```
4 toggle cards for the analysis modules.

---

### `<ScanProgress />`
```typescript
interface ScanProgressProps {
  agentStates: Record<string, "idle"|"running"|"done"|"error">;
  agentData:   Record<string, any>;
  log:         Array<{ ts: number; type: string; agent?: string; message: string }>;
}
```
Agent order: `["orchestrator","static","honeypot","fuzzStrategy","genericFuzz","aiFuzz","fuzzInterp","rating"]`

Each card shows: icon, agent name, status badge, live snippet when done.

---

### `<ResultsPanel />`
```typescript
interface ResultsPanelProps {
  report:  ScanReport;  // full report from agent:complete event
  onReset: () => void;
}
```
Contains: `<RatingCard>`, static findings, honeypot steps, fuzz results.

---

### `<RatingCard />`
```typescript
interface RatingCardProps {
  rating: {
    numericScore:    number;     // 0-100
    letterGrade:     string;     // "A+" ... "F"
    riskTier:        string;     // "Safe" | "Low Risk" | "Medium Risk" | "High Risk" | "Critical"
    recommendation:  string;     // "Deploy Safely" | "Review Before Deploying" | "Do Not Deploy"
    categoryScores:  Record<string, number>;
    executiveSummary: string;
    topThreeRisks:   string[];
    positives:       string[];
    auditConfidence: number;
    auditConfidenceNote: string;
  };
}
```
Shows: animated SVG score ring (0-100), letter grade badge, risk tier badge,
recommendation banner, category score bars, top risks list, positives list.

---

### `<FindingCard />`
```typescript
interface FindingCardProps {
  finding: {
    id:             string;
    title:          string;
    severity:       "critical"|"high"|"medium"|"low"|"informational";
    category:       string;
    description:    string;
    impact:         string;
    location:       string;
    codeSnippet:    string;
    recommendation: string;
    cweid:          string | null;
  };
  index: number;
}
```
Collapsible card with severity-coloured left border.
First card (`index === 0`) starts expanded.

---

### `<HoneypotResults />`
```typescript
interface HoneypotResultsProps {
  data: {
    verdict:    string;
    trapped:    boolean;
    confidence: number;
    rugPullRisk:string;
    summary:    string;
    patterns:   Array<{ name: string; severity: string; description: string; codeEvidence: string }>;
    steps:      Array<{ step: string; result: string; ok: boolean }>;
    bytecodeFlags: { hasSelfDestruct: boolean; hasDelegateCall: boolean };
  };
}
```

---

### `<FuzzResults />`
```typescript
interface FuzzResultsProps {
  data: {
    engine:         string;
    forgeAvailable: boolean;
    passed:         boolean;
    compileError:   string | null;
    rawOutput:      string;
    tests: Array<{
      name:           string;
      status:         "pass"|"fail"|"warn"|"pending";
      reason:         string | null;
      counterexample: string | null;
      gas:            number;
    }>;
    generatedTest?:  string;
    interpretations?: Array<{
      testName:           string;
      vulnerability:      string;
      severity:           string;
      plainExplanation:   string;
      attackVector:       string;
      fix:                string;
    }>;
  };
}
```
Shows test rows with status dots, collapsible raw forge output,
collapsible generated test source, AI interpretation cards.

---

## Severity Colour Mapping

```typescript
const SEVERITY_COLORS = {
  critical:      { bg: "#450a0a", text: "#fca5a5", border: "#7f1d1d" },
  high:          { bg: "#431407", text: "#fdba74", border: "#7c2d12" },
  medium:        { bg: "#422006", text: "#fcd34d", border: "#78350f" },
  low:           { bg: "#052e16", text: "#86efac", border: "#14532d" },
  informational: { bg: "#1e1b4b", text: "#a5b4fc", border: "#312e81" },
};
```

---

## Agent Colour Mapping

```typescript
const AGENT_META = {
  orchestrator:  { label: "Orchestrator",           color: "blue"   },
  static:        { label: "Static AI Analysis",     color: "purple" },
  honeypot:      { label: "Honeypot Detection",     color: "orange" },
  fuzzStrategy:  { label: "Fuzz Strategy Planner",  color: "yellow" },
  genericFuzz:   { label: "Generic Fuzz Runner",    color: "green"  },
  aiFuzz:        { label: "AI-Driven Fuzzer",        color: "pink"   },
  fuzzInterp:    { label: "Fuzz Interpreter",        color: "teal"   },
  rating:        { label: "Rating Agent",            color: "blue"   },
};
```

---

## Grade → Colour

```typescript
const GRADE_COLORS: Record<string, string> = {
  "A+": "#34d399",  // emerald
  "A":  "#34d399",
  "A-": "#4ade80",  // green
  "B+": "#fde047",  // yellow
  "B":  "#fbbf24",
  "B-": "#fbbf24",
  "C+": "#fb923c",  // orange
  "C":  "#f97316",
  "C-": "#f97316",
  "D":  "#f87171",  // red
  "F":  "#ef4444",
};
```

---

## Demo Contract

Load this in the UI to trigger all 4 vulnerabilities:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VulnerableBank {
    mapping(address => uint256) public balances;
    address public owner;

    constructor() { owner = msg.sender; }

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    // BUG 1: Reentrancy
    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok);
        balances[msg.sender] -= amount; // too late
    }

    // BUG 2: Unchecked overflow
    function unsafeAdd(uint256 a, uint256 b) public pure returns (uint256) {
        unchecked { return a + b; }
    }

    // BUG 3: tx.origin auth
    function adminWithdraw() public {
        require(tx.origin == owner);
        payable(owner).transfer(address(this).balance);
    }

    // BUG 4: Missing access control
    function setOwner(address newOwner) public {
        owner = newOwner;
    }
}
```
