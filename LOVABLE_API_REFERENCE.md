# VeriSol API Quick Reference

## 🚀 Quick Start

### Health Check
```bash
curl http://localhost:3001/health
```

### Analyze an Address
```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"inputType": "address", "input": "0xD7d6215b4EF4b9B5f40baea48F41047Eb67a11D5"}'
```

### Analyze GitHub Repo
```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"inputType": "github", "input": "https://github.com/transmissions11/solmate"}'
```

### Analyze Code Snippet
```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"inputType": "text", "input": "pragma solidity ^0.8.0; contract Test {}"}'
```

---

## 📦 JavaScript/Fetch Examples

### Example 1: Analyze Address with Error Handling

```javascript
async function analyzeAddress(address) {
  const statusEl = document.getElementById('status');
  const resultsEl = document.getElementById('results');
  
  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    statusEl.textContent = 'Invalid address format';
    return;
  }
  
  statusEl.textContent = 'Analyzing...';
  resultsEl.innerHTML = '';
  
  try {
    const response = await fetch('http://localhost:3001/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputType: 'address',
        input: address
      }),
      timeout: 60000  // 60 second timeout
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      statusEl.textContent = `Error: ${data.error}`;
      return;
    }
    
    displayResults(data);
    statusEl.textContent = 'Analysis Complete';
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
  }
}
```

### Example 2: Display Dynamic Analysis Result

```javascript
function displayDynamicAnalysis(data) {
  const honeypotElement = document.getElementById('honeypot-result');
  
  if (data.isHoneypot) {
    honeypotElement.innerHTML = `
      <div class="alert alert-danger">
        <h3>🚨 Honeypot Alert!</h3>
        <p>${data.reason}</p>
      </div>
    `;
  } else {
    honeypotElement.innerHTML = `
      <div class="alert alert-success">
        <h3>✅ Honeypot Check Passed</h3>
        <p>${data.reason}</p>
      </div>
    `;
  }
}
```

### Example 3: Display Fuzz Test Results

```javascript
function displayFuzzResults(genericFuzzing, aiFuzzing) {
  const container = document.getElementById('fuzz-results');
  
  const getStatusBadge = (status) => {
    const badges = {
      'passed': '<span class="badge bg-success">✅ Passed</span>',
      'failed': '<span class="badge bg-danger">❌ Failed</span>',
      'incompatible': '<span class="badge bg-warning">⚠️ Incompatible</span>',
      'skipped': '<span class="badge bg-secondary">⏭️ Skipped</span>'
    };
    return badges[status] || `<span class="badge bg-secondary">${status}</span>`;
  };
  
  container.innerHTML = `
    <div class="fuzz-box">
      <h3>🔬 Generic Fuzzing</h3>
      ${getStatusBadge(genericFuzzing?.status)}
      <p>${genericFuzzing?.reason || 'No result'}</p>
    </div>
    <div class="fuzz-box">
      <h3>🧠 AI-Generated Fuzzing</h3>
      ${getStatusBadge(aiFuzzing?.status)}
      <p>${aiFuzzing?.reason || 'No result'}</p>
    </div>
  `;
}
```

### Example 4: Display Static Analysis Findings

```javascript
function displayStaticAnalysis(staticAnalysis) {
  if (!staticAnalysis || staticAnalysis.source === 'skipped') {
    document.getElementById('static-section').innerHTML = 
      '<p>Source code not available - static analysis skipped</p>';
    return;
  }
  
  const severityColor = {
    'Critical': '#d32f2f',
    'High': '#f57c00',
    'Medium': '#fbc02d',
    'Low': '#388e3c',
    'Info': '#1976d2'
  };
  
  let html = `
    <h3>Static AI Analysis</h3>
    <p><strong>Risk Score:</strong> <span style="color: ${severityColor[staticAnalysis.riskScore]}">
      ${staticAnalysis.riskScore}
    </span></p>
    <p><strong>Summary:</strong> ${staticAnalysis.summary}</p>
    <h4>Findings:</h4>
  `;
  
  if (staticAnalysis.findings && staticAnalysis.findings.length > 0) {
    html += '<ul>';
    staticAnalysis.findings.forEach(finding => {
      html += `
        <li>
          <strong>${finding.title}</strong>
          <span style="color: ${severityColor[finding.severity]}"> (${finding.severity})</span>
          <p>${finding.description}</p>
        </li>
      `;
    });
    html += '</ul>';
  } else {
    html += '<p>No findings</p>';
  }
  
  document.getElementById('static-section').innerHTML = html;
}
```

### Example 5: Handle Repository Analysis

```javascript
function displayRepoAnalysis(files) {
  const container = document.getElementById('repo-results');
  
  let html = '<h3>Repository Analysis</h3>';
  
  files.forEach(file => {
    const riskColor = {
      'Critical': '#d32f2f',
      'High': '#f57c00',
      'Medium': '#fbc02d',
      'Low': '#388e3c',
      'Unknown': '#757575'
    }[file.analysis.riskScore] || '#757575';
    
    html += `
      <div class="file-result">
        <h4>${file.file}</h4>
        <p>Risk: <span style="color: ${riskColor}; font-weight: bold;">
          ${file.analysis.riskScore}
        </span></p>
        <p>${file.analysis.summary}</p>
    `;
    
    if (file.analysis.findings && file.analysis.findings.length > 0) {
      html += '<ul>';
      file.analysis.findings.forEach(finding => {
        html += `<li>${finding.title}: ${finding.description}</li>`;
      });
      html += '</ul>';
    }
    
    html += '</div>';
  });
  
  container.innerHTML = html;
}
```

---

## 🎯 Response Examples

### Successful Address Analysis Response

```json
{
  "reportType": "address",
  "address": "0xD7d6215b4EF4b9B5f40baea48F41047Eb67a11D5",
  "timestamp": "2026-04-08T19:00:58.402Z",
  "staticAnalysis": {
    "source": "skipped",
    "reason": "Source code not verified on Etherscan"
  },
  "dynamicAnalysis": {
    "isHoneypot": false,
    "reason": "Standard deposit/withdraw functions callable."
  },
  "genericFuzzing": {
    "status": "failed",
    "reason": "Generic fuzzing detected potential vulnerabilities"
  },
  "aiFuzzing": {
    "status": "skipped",
    "reason": "AI fuzzing not available: ABI not found for this contract."
  }
}
```

### Successful GitHub Analysis Response

```json
{
  "reportType": "repo",
  "timestamp": "2026-04-08T19:00:58.402Z",
  "files": [
    {
      "file": "src/tokens/ERC20.sol",
      "analysis": {
        "riskScore": "Low",
        "summary": "Well-structured ERC20 implementation with proper checks.",
        "findings": [
          {
            "title": "Missing emergency pause function",
            "description": "Consider adding emergency pause capabilities",
            "severity": "Medium"
          }
        ]
      }
    }
  ]
}
```

---

## 🔍 Error Response Examples

### Invalid Address Format

```bash
$ curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"inputType": "address", "input": "invalid"}'

{
  "error": "Invalid Ethereum address format",
  "details": "Expected format: 0x followed by 40 hex characters"
}
```

### Missing Required Fields

```bash
$ curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{}'

{
  "error": "Input type and value are required.",
  "details": "Provide {\"inputType\": \"address|github|text\", \"input\": \"...\"}"
}
```

### Contract Not Found

```json
{
  "error": "Contract not found on Sepolia"
}
```

---

## 🛠️ State Management Pattern (for Lovable)

```javascript
// Initialize state
let appState = {
  inputType: 'address',        // 'address', 'github', 'text'
  inputValue: '',
  isLoading: false,
  error: null,
  result: null,
  requestId: null
};

// Update input type
function setInputType(type) {
  appState.inputType = type;
  appState.inputValue = '';
  appState.result = null;
  render();
}

// Update input value
function setInputValue(value) {
  appState.inputValue = value;
  appState.error = null;
}

// Set loading state
function setLoading(loading) {
  appState.isLoading = loading;
  render();
}

// Set analysis result
function setResult(result) {
  appState.result = result;
  appState.error = null;
  appState.isLoading = false;
  render();
}

// Set error
function setError(error) {
  appState.error = error;
  appState.result = null;
  appState.isLoading = false;
  render();
}

// Main analyze function
async function handleAnalyze() {
  // Validate input
  const inputEmpty = !appState.inputValue || !appState.inputValue.trim();
  if (inputEmpty) {
    setError('Please provide input');
    return;
  }
  
  // Validate format based on type
  const validation = validateInput(appState.inputType, appState.inputValue);
  if (!validation.valid) {
    setError(validation.error);
    return;
  }
  
  setLoading(true);
  appState.requestId = generateRequestId();
  
  try {
    const response = await fetch('http://localhost:3001/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputType: appState.inputType,
        input: appState.inputValue
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Analysis failed');
    }
    
    setResult(data);
  } catch (error) {
    setError(error.message || 'An unexpected error occurred');
  }
}

// Helper to generate request ID
function generateRequestId() {
  return Math.random().toString(36).substring(2, 10) + 
         Math.random().toString(36).substring(2, 10);
}
```

---

## 📱 CSS Classes/Styling Reference

Recommended class names for consistent styling:

```css
.container              /* Main wrapper */
.header                 /* Top section with title */
.main-layout            /* Flexbox container for columns */
.input-column           /* Left column */
.results-column         /* Right column */
.input-card             /* Input section wrapper */
.tabs                   /* Tab buttons container */
.tab                    /* Individual tab button */
.tab.active             /* Active tab styling */
.input-area             /* Input field container */
.report-card            /* Results wrapper */
.results-card           /* Main results section */
.report-box             /* Individual result box */
.report-box.pass        /* Passing result styling */
.report-box.fail        /* Failing result styling */
.error-card             /* Error message styling */
.loading-card           /* Loading state styling */
.spinner                /* Loading spinner animation */
.finding-card           /* Individual finding box */
.alert                  /* Alert/notification style */
.alert-success          /* Success alert (green) */
.alert-danger           /* Danger alert (red) */
.alert-warning          /* Warning alert (yellow) */
.badge                  /* Status badge */
.badge.bg-success       /* Success badge (green) */
.badge.bg-danger        /* Danger badge (red) */
.badge.bg-warning       /* Warning badge (yellow) */
```

---

## ⚙️ Configuration Constants

```javascript
const API_CONFIG = {
  BASE_URL: 'http://localhost:3001',
  ENDPOINTS: {
    HEALTH: '/health',
    ANALYZE: '/analyze'
  },
  TIMEOUT: 60000,  // 60 seconds
  INPUT_TYPES: ['address', 'github', 'text'],
  PLACEHOLDERS: {
    address: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
    github: 'https://github.com/transmissions11/solmate',
    text: 'pragma solidity ^0.8.0;\ncontract MyContract {\n  // ...\n}'
  }
};

const RISK_COLORS = {
  'Critical': { bg: '#ffebee', text: '#d32f2f' },
  'High': { bg: '#fff3e0', text: '#f57c00' },
  'Medium': { bg: '#fffde7', text: '#fbc02d' },
  'Low': { bg: '#e8f5e9', text: '#388e3c' },
  'Unknown': { bg: '#f5f5f5', text: '#757575' }
};

const FUZZ_STATUS_ICONS = {
  'passed': '✅',
  'failed': '❌',
  'incompatible': '⚠️',
  'error': '🔴',
  'skipped': '⏭️'
};
```

---

## 🧪 Test Data Sets

### Test Case 1: Unverified Contract (No Source Code)
```
Address: 0xD7d6215b4EF4b9B5f40baea48F41047Eb67a11D5
Expected: staticAnalysis.source === "skipped"
          dynamicAnalysis runs normally
          genericFuzzing runs normally
```

### Test Case 2: Simple Code Snippet
```
Code: pragma solidity ^0.8.0; contract Test { function test() public {} }
Expected: Immediate response with static analysis findings
          No dynamic/fuzzing (text analysis only)
```

### Test Case 3: Invalid Input
```
Address: 0xInvalid
Expected: 400 error with message about address format
```

---

## 🔧 Debugging Tips

1. **Check backend is running:**
   ```bash
   curl http://localhost:3001/health
   ```

2. **Test address validation:**
   ```javascript
   console.log(/^0x[a-fA-F0-9]{40}$/.test('0xD7d6215b4EF4b9B5f40baea48F41047Eb67a11D5'));
   // Should output: true
   ```

3. **Monitor network tab:**
   - Open browser DevTools → Network tab
   - Look for POST request to `/analyze`
   - Check response status and body

4. **Check for CORS errors:**
   - If you see CORS errors, backend has CORS enabled but check browser console
   - Add `credentials: 'include'` to fetch if needed

5. **Timeout issues:**
   - If request times out, increase timeout from 60s
   - Check backend logs for slow requests
   - Some analyses (AI fuzzing) can take 30+ seconds
