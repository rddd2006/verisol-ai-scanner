# VeriSol Lovable Quick Start

## 🚀 API Endpoints

### Health Check
```bash
GET http://localhost:3001/health
```

### Analyze Contract
```bash
POST http://localhost:3001/analyze
Content-Type: application/json

{
  "inputType": "address|github|text",
  "input": "0x... | https://github.com/... | pragma solidity..."
}
```

---

## 📦 Response Structure

### Address Analysis
```json
{
  "reportType": "address",
  "address": "0x...",
  "staticAnalysis": { "riskScore": "High|Medium|Low", "summary": "...", "findings": [] },
  "dynamicAnalysis": { "isHoneypot": false, "reason": "..." },
  "genericFuzzing": { "status": "passed|failed|skipped", "reason": "..." },
  "aiFuzzing": { "status": "passed|failed|skipped", "reason": "..." }
}
```

### GitHub/Text Analysis
```json
{
  "reportType": "repo|text",
  "files": [
    {
      "file": "contract.sol",
      "analysis": { "riskScore": "...", "summary": "...", "findings": [...] }
    }
  ]
}
```

---

## 🎯 Core Function

```javascript
async function analyze(inputType, input) {
  const response = await fetch('http://localhost:3001/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputType, input })
  });
  return response.json();
}
```

---

## ✅ Input Validation

| Type | Pattern | Example |
|------|---------|---------|
| address | `/^0x[a-fA-F0-9]{40}$/` | `0xD7d6215b4EF4b9B5f40baea48F41047Eb67a11D5` |
| github | `https://github.com/{user}/{repo}` | `https://github.com/transmissions11/solmate` |
| text | Any Solidity code | `pragma solidity ^0.8.0; contract Test {}` |

---

## 🎨 UI Components Needed

1. **Tabs** - address, github, text
2. **Input** - text field or textarea
3. **Button** - "Analyze Now" (disable during loading)
4. **Results** - Display per report type
5. **Error** - Show error messages
6. **Spinner** - Loading animation

---

## 🔴 Risk Colors

| Score | Color | Hex |
|-------|-------|-----|
| Critical | Red | #d32f2f |
| High | Orange | #f57c00 |
| Medium | Yellow | #fbc02d |
| Low | Green | #388e3c |
| Unknown | Gray | #757575 |

---

## ⚙️ Fuzz Status Display

| Status | Icon | Color |
|--------|------|-------|
| passed | ✅ | Green |
| failed | ❌ | Red |
| incompatible | ⚠️ | Orange |
| skipped | ⏭️ | Gray |

---

## 📱 Layout

```
┌────────────────────────────────────┐
│        VeriSol AI 🤖              │
└────────────────────────────────────┘
┌──────────────────┬──────────────────┐
│  INPUT           │  RESULTS         │
│  • Tabs          │  • Report or     │
│  • Input box     │    Error/Loading │
│  • Analyze btn   │                  │
└──────────────────┴──────────────────┘
```

---

## 💡 Display Logic

```javascript
// Address Report
- If honeypot: red alert
- If safe: green alert
- Show fuzz results with status
- Show static findings if available

// GitHub/Text Report
- For each file:
  - Show file path
  - Show risk score (colored)
  - List findings
```

---

## 🧪 Test Addresses

```
0xD7d6215b4EF4b9B5f40baea48F41047Eb67a11D5  (no source code)
```

- Expected: `staticAnalysis.source === "skipped"` but dynamic + fuzzing work

---

## ⏱️ Timeout

Set 60 seconds for requests (some analyses take time).

---

## 🔗 Error Responses

```json
{
  "error": "Main error message",
  "details": "Specific details"
}
```

Common errors:
- Invalid address format
- Invalid GitHub URL
- Contract not found on Sepolia
- Source code not available (but analysis still runs)

---

## ✨ That's It

Connect to `http://localhost:3001`, send requests, display results. Done.
