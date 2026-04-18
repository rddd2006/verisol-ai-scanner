# Frontend Audit Report: verisol-guard

**Status:** ❌ **NOT COMPATIBLE** with backend — API endpoints mismatch

**Location:** `/home/riddhith/verii/verisol-ai-scanner/verisol-guard-frontend`

---

## Summary

The frontend was built with excellent UX (React + shadcn/ui + TypeScript) but uses **wrong API endpoints** that don't exist in the backend. It will fail to connect.

---

## ✅ What's Good

| Feature | Status | Notes |
|---------|--------|-------|
| Tech Stack | ✅ Modern | React 18 + TypeScript + Vite |
| UI Framework | ✅ Professional | shadcn/ui + Radix UI |
| Styling | ✅ Polished | Custom "brutal" design system |
| Port | ⚠️ Non-standard | Runs on 8080 (not 5173) |
| Build | ✅ Optimized | Vite with SWC |
| Dependencies | ✅ Installed | 496 packages, 18 vulnerabilities (low risk) |

---

## ❌ What's Wrong

### 1. **Wrong API Endpoint**

**Frontend expects:**
```
POST http://localhost:3001/analyze
Body: { inputType, input }
```

**Backend actually has:**
```
GET http://localhost:3001/api/scan/stream (SSE)
POST http://localhost:3001/api/scan (JSON)
```

### 2. **Missing SSE Streaming**

Frontend does simple POST requests. Backend sends **real-time events** via Server-Sent Events. Frontend won't see progress.

### 3. **Wrong Input Parameter Names**

| Frontend | Backend | Issue |
|----------|---------|-------|
| `inputType` | `inputType` | ✅ Correct |
| `input` | `value` | ❌ Wrong param name |
| (none) | `modules` | ❌ Missing modules selection |

### 4. **No Module Selection**

Frontend has no way to toggle:
- ✅ static (static analysis)
- ✅ honeypot (honeypot detection)
- ✅ genericFuzz (fuzzing)
- ✅ aiFuzz (AI fuzzing)

Backend requires this.

### 5. **Input Type Mismatch**

| Frontend | Backend |
|----------|---------|
| `"address"` | `"address"` ✅ |
| `"github"` | `"github"` ✅ |
| `"text"` | `"code"` ❌ |

Frontend uses `"text"` but backend expects `"code"`.

### 6. **Response Structure Mismatch**

Frontend expects:
```json
{
  "staticAnalysis": { ... },
  "dynamicAnalysis": { ... },
  "genericFuzzing": { ... },
  "aiFuzzing": { ... }
}
```

Backend returns:
```json
{
  "static": { ... },
  "honeypot": { ... },
  "genericFuzz": { ... },
  "aiFuzz": { ... },
  "report": { ... }
}
```

---

## 🔧 Files That Need Fixes

| File | Issue | Fix |
|------|-------|-----|
| `src/pages/Index.tsx` | Wrong endpoint `/analyze` | Change to `/api/scan/stream` with SSE |
| `src/components/AnalysisInput.tsx` | Input type `"text"` | Change to `"code"` |
| `src/components/AnalysisInput.tsx` | No module toggles | Add checkboxes for modules |
| `src/lib/demoData.ts` | Hardcoded mock data | Either keep or remove |
| `src/components/AnalysisResults.tsx` | Wrong response keys | Map to backend field names |

---

## 📋 Fix Checklist

### Priority 1 (Critical — App won't work)
- [ ] Create `src/hooks/useScan.ts` with SSE logic
- [ ] Update `Index.tsx` to use `useScan()` hook
- [ ] Change endpoint from `/analyze` to `/api/scan/stream`
- [ ] Add SSE event listeners for real-time progress

### Priority 2 (High — API mismatch)
- [ ] Change input type `"text"` → `"code"` in AnalysisInput
- [ ] Add module toggles (static, honeypot, genericFuzz, aiFuzz)
- [ ] Update response mapping in AnalysisResults
- [ ] Fix parameter name: `input` → `value` in request body

### Priority 3 (Medium — Better UX)
- [ ] Add real-time agent progress display
- [ ] Show each agent's status (idle/running/done/error)
- [ ] Add cancel button during scan
- [ ] Show progress percentage

### Priority 4 (Nice-to-have)
- [ ] Remove or mock demo data (currently returns fake results)
- [ ] Add error handling for CORS issues
- [ ] Test with backend running locally
- [ ] Add loading skeleton states

---

## Quick Fix Examples

### Change 1: Use correct endpoint in Index.tsx

**Before:**
```typescript
const response = await fetch(`${API_URL}/analyze`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ inputType, input }),
});
```

**After:**
```typescript
const url = `${API_URL}/api/scan/stream?inputType=${inputType}&value=${btoa(input)}&modules=${btoa(JSON.stringify(modules))}`;
const es = new EventSource(url);
es.addEventListener("report:complete", (e) => {
  const data = JSON.parse(e.data);
  setResult(data);
});
```

### Change 2: Fix input type in AnalysisInput.tsx

**Before:**
```typescript
const TABS = [
  { id: "address", label: "ADDRESS", ... },
  { id: "github", label: "GITHUB", ... },
  { id: "text", label: "SOLIDITY", ... },
];
```

**After:**
```typescript
const TABS = [
  { id: "address", label: "ADDRESS", ... },
  { id: "github", label: "GITHUB", ... },
  { id: "code", label: "SOLIDITY", ... },
];
```

### Change 3: Add module toggles

Add to AnalysisInput:
```typescript
interface AnalysisInputProps {
  onAnalyze: (inputType: InputType, input: string, modules: Modules) => void;
  isLoading: boolean;
}

const [modules, setModules] = useState({
  static: true,
  honeypot: true,
  genericFuzz: true,
  aiFuzz: false,
});

// Add to JSX:
<div className="p-4 border-t border-foreground/20">
  <p className="text-xs font-bold mb-2">MODULES:</p>
  {Object.entries(modules).map(([key, value]) => (
    <label key={key} className="flex items-center gap-2 mb-2">
      <input type="checkbox" checked={value} onChange={(e) => setModules({...modules, [key]: e.target.checked})} />
      <span className="text-sm">{key}</span>
    </label>
  ))}
</div>
```

---

## Testing

### Test 1: Health Check
```bash
curl http://localhost:3001/api/health
```
Expected: `{ "status": "ok", ... }`

### Test 2: Start Frontend
```bash
cd /home/riddhith/verii/verisol-ai-scanner/verisol-guard-frontend
npm run dev
# Opens http://localhost:8080
```

### Test 3: Try a Scan (after fixes)
1. Paste code into "SOLIDITY" tab
2. Select modules
3. Click "ANALYZE"
4. Should show real-time progress

---

## Architecture Comparison

### Current Frontend (Wrong)
```
AnalysisInput
  ↓ (POST /analyze)
Index.tsx
  ↓
AnalysisResults (static display)
```

### Should Be (Correct)
```
AnalysisInput (+ modules)
  ↓ (SSE /api/scan/stream)
useScan() hook (real-time events)
  ├─ source:resolved
  ├─ agent:started
  ├─ agent:done
  ├─ agent:done
  └─ report:complete
  ↓
ScanProgress (live agent status)
  ↓
AnalysisResults (final report)
```

---

## Recommendations

### Option A: Quick Fix (2-3 hours)
Just fix the API calls to match backend:
1. Update `Index.tsx` to use `/api/scan/stream`
2. Create `useScan.ts` hook
3. Update response mapping
4. Add module toggles
5. Test

### Option B: Rebuild from scratch (6-8 hours)
Use an AI code generator or manual setup to create with correct spec:
1. Describe backend API properly
2. Explain SSE needs
3. Request module toggles
4. Generate clean components

### Option C: Keep current frontend + merge (1 hour)
Since current frontend looks nice:
1. Keep the UI/styling
2. Swap out logic for correct hooks
3. Update components to accept real data
4. Minimal rewrite

**Recommended:** Option A (quick fix) — keeps investment in current design

---

## Files to Examine/Modify

```
verisol-guard-frontend/
├── src/
│   ├── pages/
│   │   └── Index.tsx              ❌ Wrong endpoint
│   ├── components/
│   │   ├── AnalysisInput.tsx      ❌ Wrong input type, no modules
│   │   ├── AnalysisResults.tsx    ❌ Wrong response keys
│   │   └── ...
│   └── hooks/
│       └── (create useScan.ts)    ✨ NEW
├── package.json                   ✅ Good
└── vite.config.ts                 ✅ Good
```

---

## Summary Table

| Aspect | Current | Required | Status |
|--------|---------|----------|--------|
| React + TypeScript | ✅ | ✅ | ✅ OK |
| Port | 8080 | 3001 (backend) | ✅ OK (separate) |
| API Endpoint | `/analyze` | `/api/scan/stream` | ❌ WRONG |
| HTTP Method | POST | GET (SSE) | ❌ WRONG |
| Input Field | `input` | `value` | ❌ WRONG |
| Input Type | `"text"` | `"code"` | ❌ WRONG |
| Module Toggles | ❌ None | ✅ Required | ❌ MISSING |
| Real-time UI | ❌ No | ✅ Yes | ❌ MISSING |
| Response Fields | `staticAnalysis` | `static` | ❌ MISMATCH |

**Overall: 3/10 Compatible** — Needs fixes to work

