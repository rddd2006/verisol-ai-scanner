# VeriSol AI — Frontend Quick Reference

## Ports & URLs

| Service | URL |
|---------|-----|
| Backend | `http://localhost:3001` |
| Frontend (Vite) | `http://localhost:8080` |

**CORS:** Already configured in backend ✅

---

## API Endpoints

### Health Check
```
GET http://localhost:3001/api/health
→ { status: "ok", version: "2.0.0", openai, gemini, etherscan, port }
```

### Load Example Contracts
```
GET http://localhost:3001/api/contracts
→ { contracts: [...] }
```

### Streaming Scan (SSE) — PRIMARY
```
GET http://localhost:3001/api/scan/stream
  ?inputType=code|address|github
  &value=base64(input)
  &modules=base64(JSON)
```

**SSE Events:**
| Event | Data |
|-------|------|
| `source:resolved` | `{ contractName, linesOfCode }` |
| `agent:started` | `{ agent, ts }` |
| `agent:done` | `{ agent, result }` |
| `report:complete` | `{ findings, statistics, ... }` |
| `error` | `{ message }` |

### JSON Scan (Fallback)
```
POST http://localhost:3001/api/scan
Content-Type: application/json
Body: { inputType, value, modules }
```

---

## React Hook: useVeriSolScan

```typescript
import { useState, useCallback, useRef } from "react";

const API_BASE = "http://localhost:3001";

export function useVeriSolScan() {
  const [phase, setPhase] = useState("idle"); // idle | scanning | done | error
  const [agentStates, setAgentStates] = useState({}); // { agent: state }
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const esRef = useRef(null);

  const scan = useCallback(({ inputType, value, modules }) => {
    if (!value?.trim()) {
      setError("Input required");
      return;
    }

    esRef.current?.close();
    setPhase("scanning");
    setError(null);
    setReport(null);
    setAgentStates({});

    const url = `${API_BASE}/api/scan/stream?inputType=${inputType}&value=${btoa(value)}&modules=${btoa(JSON.stringify(modules))}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("source:resolved", (e) => {
      const data = JSON.parse(e.data);
      console.log("Scanning:", data.contractName);
    });

    es.addEventListener("agent:started", (e) => {
      const { agent } = JSON.parse(e.data);
      setAgentStates((p) => ({ ...p, [agent]: "running" }));
    });

    es.addEventListener("agent:done", (e) => {
      const { agent } = JSON.parse(e.data);
      setAgentStates((p) => ({ ...p, [agent]: "done" }));
    });

    es.addEventListener("report:complete", (e) => {
      const data = JSON.parse(e.data);
      setReport(data);
      setPhase("done");
      es.close();
    });

    es.addEventListener("error", (e) => {
      const { message } = JSON.parse(e.data);
      setError(message);
      setPhase("error");
      es.close();
    });
  }, []);

  const cancel = useCallback(() => {
    esRef.current?.close();
    setPhase("idle");
  }, []);

  return { phase, agentStates, report, error, scan, cancel };
}
```

---

## Minimal App Component

```jsx
import { useState } from "react";
import { useVeriSolScan } from "./hooks/useVeriSolScan";

export default function App() {
  const [inputType, setInputType] = useState("code");
  const [value, setValue] = useState("");
  const [modules, setModules] = useState({
    static: true, honeypot: true, genericFuzz: true, aiFuzz: false
  });

  const { phase, agentStates, report, error, scan, cancel } = useVeriSolScan();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6">VeriSol AI Scanner</h1>

      {phase !== "scanning" && (
        <div className="space-y-4 max-w-2xl">
          {/* Input Type */}
          <div className="flex gap-2">
            {["code", "address", "github"].map((t) => (
              <button
                key={t}
                onClick={() => setInputType(t)}
                className={`px-4 py-2 rounded ${inputType === t ? "bg-blue-600" : "bg-gray-700"}`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Input */}
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste code, address, or GitHub URL..."
            className="w-full h-60 bg-gray-900 border border-gray-800 rounded p-4"
          />

          {/* Modules */}
          <div className="flex gap-4">
            {Object.keys(modules).map((m) => (
              <label key={m}>
                <input
                  type="checkbox"
                  checked={modules[m]}
                  onChange={(e) => setModules({ ...modules, [m]: e.target.checked })}
                />
                {" " + m}
              </label>
            ))}
          </div>

          {/* Scan */}
          <button
            onClick={() => scan({ inputType, value, modules })}
            className="w-full bg-green-600 px-4 py-3 rounded font-bold"
          >
            Scan
          </button>

          {error && <p className="text-red-400">{error}</p>}
        </div>
      )}

      {phase === "scanning" && (
        <div>
          <p className="text-lg mb-4">Scanning...</p>
          {Object.entries(agentStates).map(([agent, state]) => (
            <p key={agent} className="text-sm">
              {agent}: {state}
            </p>
          ))}
          <button onClick={cancel} className="mt-4 bg-red-600 px-4 py-2 rounded">Cancel</button>
        </div>
      )}

      {report && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Results</h2>
          <pre className="bg-gray-900 p-4 rounded text-xs overflow-auto max-h-96">
            {JSON.stringify(report, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
```

---

## Styling (Tailwind)

Copy into your CSS:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .card {
    @apply bg-gray-900 border border-gray-800 rounded-xl p-4;
  }
  .badge-critical {
    @apply bg-red-900/60 text-red-300 text-xs font-semibold px-2 py-1 rounded;
  }
  .badge-high {
    @apply bg-orange-900/60 text-orange-300 text-xs font-semibold px-2 py-1 rounded;
  }
  .badge-medium {
    @apply bg-yellow-900/60 text-yellow-300 text-xs font-semibold px-2 py-1 rounded;
  }
  .badge-low {
    @apply bg-blue-900/60 text-blue-300 text-xs font-semibold px-2 py-1 rounded;
  }
  .font-code {
    font-family: "JetBrains Mono", "Fira Code", monospace;
  }
}
```

---

## Current Frontend Files (Reference)

| File | Purpose |
|------|---------|
| [frontend/src/App.jsx](../../frontend/src/App.jsx) | Main layout |
| [frontend/src/hooks/useScan.js](../../frontend/src/hooks/useScan.js) | SSE hook (copy pattern) |
| [frontend/src/components/InputPanel.jsx](../../frontend/src/components/InputPanel.jsx) | Input form |
| [frontend/src/components/ScanProgress.jsx](../../frontend/src/components/ScanProgress.jsx) | Agent display |
| [frontend/src/components/ResultsPanel.jsx](../../frontend/src/components/ResultsPanel.jsx) | Results view |
| [frontend/src/components/FindingCard.jsx](../../frontend/src/components/FindingCard.jsx) | Vulnerability card |
| [frontend/src/styles/index.css](../../frontend/src/styles/index.css) | All styles |

---

## Env Setup

```bash
# Backend (already done)
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
ETHERSCAN_API_KEY=...
PORT=3001
API_BASE=http://localhost:3001
```

---

## Checklist

- [ ] Backend running: `curl http://localhost:3001/api/health`
- [ ] CORS configured (✅ already done)
- [ ] Frontend setup complete
- [ ] Hook configured in `src/hooks/useScan.ts`
- [ ] App component working
- [ ] Test scan with example code
- [ ] Style cards + badges
- [ ] Add result visualization

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS blocked | Check backend has frontend URL in origins |
| SSE closes | Check `/api/health` — backend might be down |
| Base64 error | Use `btoa()` in browser, not `Buffer` |
| Address not found | Must be `0x...` format on mainnet/testnet |

