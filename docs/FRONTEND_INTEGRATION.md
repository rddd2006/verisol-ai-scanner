# VeriSol AI — Frontend Integration Guide

Complete documentation for building a frontend compatible with the VeriSol backend.

---

## Network Configuration

### Ports & Domains

| Service | URL | Notes |
|---------|-----|-------|
| **Backend** | `http://localhost:3001` | Main API server |
| **Frontend (Vite)** | `http://localhost:8080` | Development frontend |
| **Production** | `https://yourdomain.com` | Your deployed app |

### CORS Configuration (Already Added)
The backend (`backend/server.js`) is configured to accept requests from:
- `http://localhost:5173` (Vite default port)
- `http://localhost:8080` (alternate frontend port)
- `http://localhost:3000` (fallback)
- Custom origin via `CORS_ORIGIN` env var

**No additional CORS setup needed** — you're ready to connect.

---

## API Endpoints

### 1. Health Check
Verify backend connectivity.

```
GET http://localhost:3001/api/health
```

**Response:**
```json
{
  "status": "ok",
  "version": "2.0.0",
  "openai": true,
  "gemini": true,
  "etherscan": true,
  "port": 3001
}
```

---

### 2. Get Example Contracts (Load Examples)
Fetch pre-built contracts for the UI "Load Example" buttons.

```
GET http://localhost:3001/api/contracts
```

**Response:**
```json
{
  "contracts": [
    {
      "id": "safe-vault",
      "name": "SafeVault",
      "category": "Secure",
      "description": "Best practices implementation...",
      "linesOfCode": 150
    }
  ]
}
```

**Note:** Full source is `NOT` returned in this list — see scan endpoints to fetch full code.

---

### 3. Streaming Scan (Recommended)
Real-time progress via **Server-Sent Events (SSE)**.

```
GET http://localhost:3001/api/scan/stream
  ?inputType=code|address|github
  &value=<base64(input)>
  &modules=<base64(JSON)>
```

#### Query Parameters

| Param | Type | Example | Notes |
|-------|------|---------|-------|
| `inputType` | string | `"code"`, `"address"`, `"github"` | Input source type |
| `value` | base64 | `base64("pragma solidity...")` | Encoded Solidity source, Ethereum address (0x...), or GitHub URL |
| `modules` | base64 | `base64('{"static":true,"honeypot":true,...}')` | Optional. Encoded JSON with enabled modules |

#### Query Parameter Encoding (JavaScript)
```javascript
// Encode input
const inputValue = "pragma solidity ^0.8.0;\n...";
const encodedValue = Buffer.from(inputValue).toString("base64");
// In browser: btoa(inputValue)

// Encode modules
const modules = { static: true, honeypot: true, genericFuzz: true, aiFuzz: false };
const encodedModules = Buffer.from(JSON.stringify(modules)).toString("base64");
// In browser: btoa(JSON.stringify(modules))

// Build URL
const url = `http://localhost:3001/api/scan/stream?inputType=code&value=${encodedValue}&modules=${encodedModules}`;
```

#### SSE Events (Order & Format)

| Event | Data Shape | Example |
|-------|-----------|---------|
| `source:resolved` | `{ contractName: string, linesOfCode: number }` | `{"contractName":"SafeVault","linesOfCode":150}` |
| `agent:started` | `{ agent: string, ts: number }` | `{"agent":"static_analysis","ts":1707123456000}` |
| `agent:running` | `{ agent: string, message?: string }` | `{"agent":"static_analysis","message":"Scanning..."}` |
| `agent:done` | `{ agent: string, result?: object }` | `{"agent":"honeypot_detector","result":{...}}` |
| `rating:update` | `{ overallRating: number, timestamp: number }` | `{"overallRating":7.2,"timestamp":...}` |
| `report:complete` | Full report object | `{"findings":[...],"statistics":{...}}` |
| `error` | `{ message: string }` | `{"message":"Source fetch failed..."}` |
| `ping` | `{ ts: number }` | Keep-alive signal every 15s |

#### Example SSE Connection (JavaScript)
```javascript
const es = new EventSource(
  "http://localhost:3001/api/scan/stream?inputType=code&value=" + 
  btoa(sourceCode) + 
  "&modules=" + 
  btoa(JSON.stringify({static: true, honeypot: true, genericFuzz: true}))
);

es.addEventListener("source:resolved", (e) => {
  const { contractName, linesOfCode } = JSON.parse(e.data);
  console.log(`Scanning ${contractName} (${linesOfCode} lines)`);
});

es.addEventListener("agent:started", (e) => {
  const { agent } = JSON.parse(e.data);
  console.log(`Agent started: ${agent}`);
});

es.addEventListener("agent:done", (e) => {
  const { agent, result } = JSON.parse(e.data);
  console.log(`Agent done: ${agent}`, result);
});

es.addEventListener("report:complete", (e) => {
  const report = JSON.parse(e.data);
  console.log("Full report:", report);
  es.close();
});

es.addEventListener("error", (e) => {
  console.error("Scan error:", JSON.parse(e.data));
  es.close();
});
```

---

### 4. Simple Scan (Fallback — No Streaming)
Traditional JSON response if SSE is unavailable.

```
POST http://localhost:3001/api/scan
Content-Type: application/json
```

**Request Body:**
```json
{
  "inputType": "code",
  "value": "pragma solidity ^0.8.0;\n...",
  "modules": {
    "static": true,
    "honeypot": true,
    "genericFuzz": true,
    "aiFuzz": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "contractName": "SafeVault",
  "sourceCode": "...",
  "findings": [
    {
      "agent": "static_analysis",
      "severity": "low",
      "message": "..."
    }
  ],
  "statistics": {
    "totalFindings": 3,
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 0
  },
  "report": { ... },
  "ratingResult": {
    "overallRating": 7.5
  }
}
```

---

## Current Frontend Analysis

### Existing Architecture (Vite/React)

The current frontend (`frontend/src/`) has a mature component-driven architecture:

| File | Purpose | Key Exports |
|------|---------|-------------|
| [App.jsx](../../frontend/src/App.jsx) | Main entry point, layout orchestrator | App component |
| [hooks/useScan.js](../../frontend/src/hooks/useScan.js) | **SSE state management** | `useScan()` hook |
| [components/InputPanel.jsx](../../frontend/src/components/InputPanel.jsx) | Input form + example contract loader | `InputPanel` component |
| [components/ScanProgress.jsx](../../frontend/src/components/ScanProgress.jsx) | **Real-time agent status display** | `ScanProgress` component |
| [components/ResultsPanel.jsx](../../frontend/src/components/ResultsPanel.jsx) | Findings + analysis results viewer | `ResultsPanel` component |
| [components/FindingCard.jsx](../../frontend/src/components/FindingCard.jsx) | Individual vulnerability display | `FindingCard` component |
| [components/HoneypotResults.jsx](../../frontend/src/components/HoneypotResults.jsx) | Honeypot detection results | `HoneypotResults` component |
| [components/FuzzResults.jsx](../../frontend/src/components/FuzzResults.jsx) | Fuzzing test results + failures | `FuzzResults` component |
| [components/RatingCard.jsx](../../frontend/src/components/RatingCard.jsx) | Overall security rating display | `RatingCard` component |
| [styles/index.css](../../frontend/src/styles/index.css) | Tailwind + custom styling system | CSS utilities |

### Data Flow Architecture

```
App.jsx (main state coordinator)
  ├─ useScan() (SSE connection + event parsing)
  │   └─ EventSource: http://localhost:3001/api/scan/stream
  │
  ├─ InputPanel (user input + contract loading)
  │   └─ GET /api/contracts (load examples)
  │
  ├─ ScanProgress (live agent status during scanning)
  │   └─ Displays: agent states, live logs, current progress
  │
  └─ ResultsPanel (final report display)
      ├─ FindingCard (static analysis results)
      ├─ HoneypotResults (honeypot detection)
      ├─ FuzzResults (fuzzing failures)
      └─ RatingCard (security rating)
```

### Current `useScan()` Hook Pattern

The existing hook in `frontend/src/hooks/useScan.js` already implements the SSE pattern you need:

```javascript
// Key exports
export const PHASES = { IDLE, SCANNING, DONE, ERROR };
export const DEFAULT_MODULES = { static, honeypot, genericFuzz, aiFuzz };
export const AGENT_META = { /* agent metadata + colors */ };

export function useScan() {
  // Returns: { phase, agentStates, agentData, finalReport, error, log, scan, reset }
  // - phase: "idle" | "scanning" | "done" | "error"
  // - agentStates: { [agentId]: "idle" | "running" | "done" | "error" }
  // - agentData: { [agentId]: result object }
  // - finalReport: complete scan report when done
  // - scan({ inputType, value, modules }): start a scan
  // - reset(): cancel and reset state
}
```

**Current SSE Events:**
- `source:resolved` → contract name + LOC
- `agent:start` → agent beginning
- `agent:done` → agent completed with result
- `agent:error` → agent failure
- `agent:complete` → all agents done, final report
- `ping` → 15s keep-alive signal

### Styling System

Uses **Tailwind CSS** with custom layer components:

```css
/* Cards */
.card { @apply bg-gray-900 border border-gray-800 rounded-xl; }

/* Severity badges */
.badge-critical { @apply bg-red-900/60 text-red-300 border border-red-700/40; }
.badge-high     { @apply bg-orange-900/60 text-orange-300 border border-orange-700/40; }
.badge-medium   { @apply bg-yellow-900/60 text-yellow-300 border border-yellow-700/40; }
.badge-low      { @apply bg-blue-900/60 text-blue-300 border border-blue-700/40; }
.badge-pass     { @apply bg-green-900/60 text-green-300 border border-green-700/40; }

/* Code font */
.font-code { font-family: "JetBrains Mono", "Fira Code", monospace; }
```

**Color Scheme:**
- Dark mode: `bg-gray-950` (base) → `bg-gray-900` (cards) → `bg-gray-800` (borders)
- Accent colors: red, orange, yellow, green, blue, purple, pink, teal
- Each agent has a dedicated color for visual distinction

### What to Import into Lovable

For a 1:1 reproduction in Lovable, use:

1. **The `useScan()` hook** — has all SSE logic pre-built
2. **Component structure** — InputPanel → ScanProgress → ResultsPanel flow
3. **Styling classes** — Tailwind config + custom CSS (copy `index.css`)
4. **Agent metadata** — `AGENT_META` enum for labels + icons
5. **Utility functions** — `sortFindings()`, severity calculations

### Lovable Adaptations Needed

| Item | Current | Lovable | Notes |
|------|---------|---------|-------|
| Hook location | `frontend/src/hooks/useScan.js` | Create in Lovable code | Copy useScan pattern |
| Component tree | Built with separate files | Lovable single-file | All in one `App.jsx` equivalent |
| CSS | `tailwind.config.js` + `index.css` | Lovable Tailwind + inline | Copy card/badge classes |
| Environment | `.env` via Vite | Lovable settings | Set `REACT_APP_API_BASE` |
| Icons | lucide-react library | Lovable defaults or inline SVG | Use Lovable's icon set |

### API Integration Points

Current frontend makes these API calls:

| Endpoint | Method | Trigger | Response Use |
|----------|--------|---------|--------------|
| `/api/contracts` | GET | App mount (InputPanel) | Populate "Load Example" buttons |
| `/api/contracts/:id` | GET | Click "Load Example" | Populate textarea with source |
| `/api/scan/stream` | GET (SSE) | Click "Scan" button | Stream agent events in real-time |

**No POST endpoint needed** unless you want a non-streaming fallback.

---

## Complete Lovable Frontend Implementation

### React Hook: `useVeriSolScan`

Copy this entire hook into your Lovable frontend:

```typescript
import { useState, useCallback, useRef } from "react";

const API_BASE = "http://localhost:3001";

export type Phase = "idle" | "scanning" | "done" | "error";

export interface AgentState {
  [agentId: string]: "idle" | "running" | "done" | "error";
}

export interface ScanOptions {
  inputType: "code" | "address" | "github";
  value: string;
  modules: {
    static: boolean;
    honeypot: boolean;
    genericFuzz: boolean;
    aiFuzz?: boolean;
  };
}

export interface ScanEvent {
  type: string;
  data: any;
  timestamp: number;
}

export function useVeriSolScan() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [agentStates, setAgentStates] = useState<AgentState>({});
  const [agentData, setAgentData] = useState<Record<string, any>>({});
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [contractName, setContractName] = useState<string>("");
  const [linesOfCode, setLinesOfCode] = useState<number>(0);
  const esRef = useRef<EventSource | null>(null);

  const appendEvent = (type: string, data: any) => {
    setEvents((prev) => [...prev, { type, data, timestamp: Date.now() }]);
  };

  const scan = useCallback((opts: ScanOptions) => {
    if (!opts.value?.trim()) {
      setError("Please provide contract source code, address, or GitHub URL.");
      setPhase("error");
      return;
    }

    // Reset state
    setPhase("scanning");
    setError(null);
    setAgentStates({});
    setAgentData({});
    setReport(null);
    setEvents([]);
    setContractName("");
    setLinesOfCode(0);

    // Close any existing SSE connection
    if (esRef.current) {
      esRef.current.close();
    }

    try {
      // Encode parameters for URL
      const encodedValue = btoa(opts.value);
      const encodedModules = btoa(JSON.stringify(opts.modules));

      const url = new URL(`${API_BASE}/api/scan/stream`);
      url.searchParams.append("inputType", opts.inputType);
      url.searchParams.append("value", encodedValue);
      url.searchParams.append("modules", encodedModules);

      const es = new EventSource(url.toString());
      esRef.current = es;

      es.addEventListener("source:resolved", (e) => {
        const data = JSON.parse(e.data);
        appendEvent("source:resolved", data);
        setContractName(data.contractName || "Unknown");
        setLinesOfCode(data.linesOfCode || 0);
      });

      es.addEventListener("agent:started", (e) => {
        const data = JSON.parse(e.data);
        appendEvent("agent:started", data);
        setAgentStates((prev) => ({
          ...prev,
          [data.agent]: "running",
        }));
      });

      es.addEventListener("agent:running", (e) => {
        const data = JSON.parse(e.data);
        appendEvent("agent:running", data);
      });

      es.addEventListener("agent:done", (e) => {
        const data = JSON.parse(e.data);
        appendEvent("agent:done", data);
        setAgentStates((prev) => ({
          ...prev,
          [data.agent]: "done",
        }));
        if (data.result) {
          setAgentData((prev) => ({
            ...prev,
            [data.agent]: data.result,
          }));
        }
      });

      es.addEventListener("rating:update", (e) => {
        const data = JSON.parse(e.data);
        appendEvent("rating:update", data);
        setReport((prev: any) => ({
          ...prev,
          overallRating: data.overallRating,
        }));
      });

      es.addEventListener("report:complete", (e) => {
        const data = JSON.parse(e.data);
        appendEvent("report:complete", data);
        setReport(data);
        setPhase("done");
        es.close();
        esRef.current = null;
      });

      es.addEventListener("error", (e) => {
        try {
          const data = JSON.parse(e.data);
          appendEvent("error", data);
          setError(data.message || "Unknown error occurred");
        } catch {
          setError("Connection lost or malformed error response");
        }
        setPhase("error");
        es.close();
        esRef.current = null;
      });

      es.addEventListener("ping", () => {
        // Keep-alive ping, no action needed
      });
    } catch (err: any) {
      setError(err.message);
      setPhase("error");
    }
  }, []);

  const cancel = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setPhase("idle");
    setError(null);
  }, []);

  return {
    // State
    phase,
    error,
    contractName,
    linesOfCode,
    agentStates,
    agentData,
    report,
    events,

    // Methods
    scan,
    cancel,
  };
}
```

---

## Component Usage Example

```typescript
import { useVeriSolScan } from "./hooks/useVeriSolScan";

export function ScanPanel() {
  const [inputType, setInputType] = useState<"code" | "address" | "github">("code");
  const [value, setValue] = useState("");
  const [modules, setModules] = useState({
    static: true,
    honeypot: true,
    genericFuzz: true,
    aiFuzz: false,
  });

  const { phase, error, report, agentStates, contractName, scan, cancel } = useVeriSolScan();

  const handleScan = () => {
    scan({ inputType, value, modules });
  };

  return (
    <div className="space-y-4">
      {/* Input Selection */}
      <div className="flex gap-2">
        {(["code", "address", "github"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setInputType(type)}
            className={inputType === type ? "bg-blue-600" : "bg-gray-600"}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Input Textarea */}
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={
          inputType === "code"
            ? "Paste Solidity contract..."
            : inputType === "address"
              ? "Paste Ethereum address (0x...)"
              : "Paste GitHub URL..."
        }
        className="w-full h-40 border rounded p-2"
        disabled={phase === "scanning"}
      />

      {/* Module Toggles */}
      <div className="flex gap-4">
        {(["static", "honeypot", "genericFuzz", "aiFuzz"] as const).map((mod) => (
          <label key={mod} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={modules[mod as keyof typeof modules] ?? false}
              onChange={(e) =>
                setModules((prev) => ({
                  ...prev,
                  [mod]: e.target.checked,
                }))
              }
              disabled={phase === "scanning"}
            />
            {mod === "genericFuzz"
              ? "Generic Fuzz"
              : mod === "aiFuzz"
                ? "AI Fuzz"
                : mod.charAt(0).toUpperCase() + mod.slice(1)}
          </label>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleScan}
          disabled={phase === "scanning" || !value.trim()}
          className="bg-green-600 disabled:bg-gray-400"
        >
          Scan
        </button>
        {phase === "scanning" && (
          <button onClick={cancel} className="bg-red-600">
            Cancel
          </button>
        )}
      </div>

      {/* Status */}
      {phase === "scanning" && <p>Scanning {contractName}...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {/* Results */}
      {report && <ScanResults report={report} />}
    </div>
  );
}
```

---

## Environment Configuration

### For Development (Local)
No changes needed — use `http://localhost:3001` directly.

### For Lovable Preview
The backend is already CORS-configured. Just use the hook as-is.

### For Production Deployment
Update the `API_BASE` in the hook or pass it as a prop:

```typescript
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001";
```

Then in Lovable settings, set the environment variable to your deployed backend URL.

---

## Troubleshooting

### CORS Error Blocked
- Check backend `server.js` has `https://*.lovable.app` in origins array
- Verify request is being sent with `http://localhost:3001` (not missing port)

### SSE Connection Closes Immediately
- Browser console may show errors (check Network tab)
- Fallback to POST `/api/scan` endpoint if SSE doesn't work

### Base64 Encoding Issues
- Use `btoa()` for strings in browser
- Node.js: `Buffer.from(string).toString("base64")`
- Always URL-encode special characters in query strings

### Contract Not Found
- Verify `inputType` is correct (`"code"`, `"address"`, or `"github"`)
- If address: must be valid 0x... format on mainnet/testnet
- If GitHub: must be public repo with Solidity files

---

## Summary

| Item | Value |
|------|-------|
| Backend URL | `http://localhost:3001` |
| Streaming Endpoint | `GET /api/scan/stream` |
| Fallback Endpoint | `POST /api/scan` |
| Health Check | `GET /api/health` |
| Frontend Port (Current Vite) | `5173` |
| Required Encoding | base64 for query params |
| CORS Status | ✅ Already configured |
| Ready for Lovable | ✅ Yes |

---

## Migration Path: Current Frontend → Lovable

### What You Have (Vite)

Your current Vite frontend is **production-ready**:
- Full component library (findings, honeypot, fuzzing views)
- Real-time SSE streaming with agent status
- Contract example loader
- Advanced result visualization
- Fully styled with Tailwind

### What Lovable Brings

Lovable AI-assisted frontend builder, good for:
- **Rapid iteration** — AI generates component layouts
- **No build tooling** — deploys instantly
- **Visual editing** — drag-and-drop UI
- **Version history** — automatic backups

### Two Strategies

#### Strategy 1: Copy Existing Frontend (Recommended for Feature Parity)
1. Take your existing Vite frontend file-by-file
2. Combine into single Lovable components
3. Import the `useScan()` hook
4. Keep full feature set (findings cards, fuzzing results, etc.)

**Pros:** Feature-complete, tested, familiar architecture
**Cons:** More initial setup in Lovable

#### Strategy 2: Rebuild in Lovable from Scratch (Recommended for Learning/Speed)
1. Use Lovable's AI to create from description: "Build a Solidity contract security scanner UI"
2. Use the `useVeriSolScan()` hook provided above
3. Gradually add features (findings display, honeypot results, etc.)

**Pros:** Modern Lovable-native patterns, faster iteration
**Cons:** May miss advanced features initially

### Code Map for Copy-Paste

If you choose **Strategy 1**, migrate in this order:

| Priority | Component | Copy From | Purpose |
|----------|-----------|-----------|---------|
| 🔴 Critical | `useVeriSolScan()` hook | This doc (provided above) | Core functionality |
| 🟠 High | InputPanel | `frontend/src/components/InputPanel.jsx` | Input form + examples |
| 🟠 High | ScanProgress | `frontend/src/components/ScanProgress.jsx` | Real-time agent display |
| 🟠 High | ResultsPanel | `frontend/src/components/ResultsPanel.jsx` | Results display |
| 🟡 Medium | FindingCard | `frontend/src/components/FindingCard.jsx` | Vulnerability cards |
| 🟡 Medium | Styling | `frontend/src/styles/index.css` | Tailwind classes + colors |
| 🟢 Nice-to-Have | HoneypotResults | `frontend/src/components/HoneypotResults.jsx` | Honeypot details |
| 🟢 Nice-to-Have | FuzzResults | `frontend/src/components/FuzzResults.jsx` | Fuzzing test results |

### Minimal Lovable App (Start Here)

To get **something working immediately**, you only need:

```javascript
// App.jsx in Lovable
import { useState } from "react";
import { useVeriSolScan } from "./hooks/useVeriSolScan";

export default function App() {
  const [inputType, setInputType] = useState("code");
  const [value, setValue] = useState("");
  const [modules, setModules] = useState({
    static: true,
    honeypot: true,
    genericFuzz: true,
    aiFuzz: false,
  });

  const { phase, error, report, scan } = useVeriSolScan();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6">VeriSol AI Scanner</h1>

      {phase !== "scanning" && (
        <div className="space-y-4 max-w-2xl">
          {/* Input Type Selector */}
          <div className="flex gap-2">
            {(["code", "address", "github"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setInputType(type)}
                className={`px-4 py-2 rounded ${
                  inputType === type ? "bg-blue-600" : "bg-gray-700"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Input Field */}
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste Solidity code, address, or GitHub URL..."
            className="w-full h-60 bg-gray-900 border border-gray-800 rounded p-4 text-gray-100"
          />

          {/* Module Toggles */}
          <div className="flex gap-4">
            {Object.keys(modules).map((mod) => (
              <label key={mod} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={modules[mod]}
                  onChange={(e) =>
                    setModules({ ...modules, [mod]: e.target.checked })
                  }
                />
                {mod}
              </label>
            ))}
          </div>

          {/* Scan Button */}
          <button
            onClick={() => scan({ inputType, value, modules })}
            className="w-full bg-green-600 hover:bg-green-700 px-4 py-3 rounded font-bold"
          >
            Start Scan
          </button>

          {error && <p className="text-red-400">{error}</p>}
        </div>
      )}

      {phase === "scanning" && <p className="text-lg">Scanning...</p>}

      {report && (
        <div className="mt-8 space-y-4 max-w-4xl">
          <h2 className="text-2xl font-bold">Results</h2>
          <pre className="bg-gray-900 p-4 rounded text-xs overflow-auto">
            {JSON.stringify(report, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
```

This alone gives you:
- ✅ Input selection
- ✅ Real-time scanning
- ✅ Results display
- ✅ Full backend integration

Then enhance with:
- 🎨 Better styling (copy `index.css`)
- 📊 Rich components (FindingCard, RatingCard, etc.)
- 📈 Advanced visualizations (charts, graphs)

---

## Checklists

### Pre-Migration Checklist (Lovable Setup)
- [ ] Backend running on `http://localhost:3001`
- [ ] `/api/health` endpoint returns "ok"
- [ ] `/api/scan/stream` accepts query params
- [ ] CORS allows `https://*.lovable.app`
- [ ] `.env` has `OPENAI_API_KEY` / `GEMINI_API_KEY` / `ETHERSCAN_API_KEY`

### Initial Lovable Build
- [ ] Create new Lovable project
- [ ] Set environment variable `REACT_APP_API_BASE=http://localhost:3001`
- [ ] Copy `useVeriSolScan()` hook into project
- [ ] Create minimal InputPanel component
- [ ] Test `/api/health` endpoint
- [ ] Test scan with example Solidity code

### Feature Completeness
- [ ] Input panel (code/address/github)
- [ ] Real-time agent progress display
- [ ] Findings card display
- [ ] Honeypot results
- [ ] Fuzzing test results
- [ ] Rating card
- [ ] Example contract loader
- [ ] Dark mode styling
- [ ] Error handling + retry logic

---

## FAQ

**Q: Can I use my existing Vite frontend?**
A: Yes! The Vite app is production-ready. Lovable is optional — it's just an alternative way to build + host. You can keep using Vite.

**Q: Will Lovable understand my code?**
A: Lovable's AI can understand React patterns, but for complex hooks like SSE management, provide the full `useVeriSolScan()` hook from this doc to avoid confusion.

**Q: What if Lovable changes my code?**
A: Lovable has version history. You can revert changes. For critical logic (the hook), keep it read-only or isolated.

**Q: Should I use Lovable or keep Vite?**
A: **Lovable** if you want AI-assisted rapid iteration + instant deploys. **Vite** if you prefer full control + advanced tooling. Both work with the same backend.

**Q: Do I need to change the backend?**
A: No! The backend already has CORS configured for Lovable. Just point to `http://localhost:3001`.

---

## Reference

- **Current Frontend:** [frontend/](../../frontend/)
- **Backend API:** [backend/routes/scan.js](../../backend/routes/scan.js)
- **Test Examples:** [backend/tests/](../../backend/tests/)
- **Contracts:** [contracts/](../../contracts/)

