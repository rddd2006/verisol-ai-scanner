# VeriSol AI Scanner - Lovable Frontend Integration Guide

## Overview
VeriSol AI is a smart contract security scanner with a Node.js/Express backend running on `http://localhost:3001`. This guide provides all technical specifications needed to build a compatible frontend on Lovable.

---

## 🔌 Backend API Specification

### Base URL
```
http://localhost:3001
```

### 1. Health Check Endpoint

**Endpoint:** `GET /health`

**Purpose:** Verify server is running and check configuration

**Request:**
```http
GET http://localhost:3001/health
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-04-08T18:46:39.714Z",
  "config": {
    "geminiConfigured": true,
    "etherscanConfigured": true,
    "sepoliaRpcConfigured": true
  }
}
```

---

### 2. Main Analysis Endpoint

**Endpoint:** `POST /analyze`

**Purpose:** Analyze smart contracts via 3 input types

#### Request Format

**Required Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "inputType": "address|github|text",
  "input": "string"
}
```

**Input Type Details:**

| Type | Format | Example | Notes |
|------|--------|---------|-------|
| `address` | Ethereum address | `0xD7d6215b4EF4b9B5f40baea48F41047Eb67a11D5` | Must be valid checksummed or lowercase 0x + 40 hex chars |
| `github` | GitHub repo URL | `https://github.com/transmissions11/solmate` | https:// URL to public repo |
| `text` | Solidity code | `pragma solidity ^0.8.0; contract Test {}` | Complete or partial Solidity code |

---

### 3. Response Formats

#### Success Response - Address Analysis (200 OK)

```json
{
  "reportType": "address",
  "address": "0xD7d6215b4EF4b9B5f40baea48F41047Eb67a11D5",
  "timestamp": "2026-04-08T19:00:58.402Z",
  "staticAnalysis": {
    "source": "skipped|analyzed",
    "reason": "Source code not verified on Etherscan OR analysis description",
    "riskScore": "Critical|High|Medium|Low|Unknown",
    "summary": "Brief summary of findings",
    "findings": [
      {
        "title": "Finding title",
        "description": "Detailed description",
        "severity": "Critical|High|Medium|Low|Info"
      }
    ]
  },
  "dynamicAnalysis": {
    "isHoneypot": false,
    "reason": "Standard deposit/withdraw functions callable."
  },
  "genericFuzzing": {
    "status": "passed|failed|incompatible|error",
    "reason": "Details about fuzz testing results"
  },
  "aiFuzzing": {
    "status": "passed|failed|skipped|incompatible",
    "reason": "Details about AI-generated fuzz tests"
  }
}
```

---

#### Success Response - GitHub/Text Analysis (200 OK)

```json
{
  "reportType": "repo|text",
  "timestamp": "2026-04-08T19:00:58.402Z",
  "files": [
    {
      "file": "contracts/Token.sol",
      "analysis": {
        "riskScore": "High|Medium|Low|Unknown",
        "summary": "Summary of analysis",
        "findings": [
          {
            "title": "Vulnerability title",
            "description": "Detailed description",
            "severity": "Critical|High|Medium|Low|Info"
          }
        ]
      }
    },
    {
      "file": "contracts/Vault.sol",
      "analysis": {
        "riskScore": "Low",
        "summary": "No critical issues found",
        "findings": []
      }
    }
  ]
}
```

---

#### Error Response (400/404/500)

**Validation Error (400):**
```json
{
  "error": "Invalid Ethereum address format",
  "details": "Expected format: 0x followed by 40 hex characters"
}
```

**Missing Source Code (404):**
```json
{
  "error": "Source code not available for this contract"
}
```

**Server Error (500):**
```json
{
  "error": "Failed to complete analysis",
  "details": "Error message",
  "requestId": "unique-request-id-for-debugging"
}
```

**Input Validation Errors:**
```json
{
  "error": "Input type and value are required.",
  "details": "Provide {\"inputType\": \"address|github|text\", \"input\": \"...\"}"
}
```

---

## 📋 Data Structure Reference

### Risk Score Levels
```javascript
const riskLevels = {
  'Critical': { color: '#d32f2f', severity: 5 },
  'High': { color: '#f57c00', severity: 4 },
  'Medium': { color: '#fbc02d', severity: 3 },
  'Low': { color: '#388e3c', severity: 2 },
  'Unknown': { color: '#757575', severity: 0 }
};
```

### Fuzz Test Status
```javascript
const fuzzStatus = {
  'passed': { icon: '✅', label: 'Passed', color: 'green' },
  'failed': { icon: '❌', label: 'FAILED', color: 'red' },
  'incompatible': { icon: '⚠️', label: 'Incompatible', color: 'orange' },
  'error': { icon: '🔴', label: 'Error', color: 'red' },
  'skipped': { icon: '⏭️', label: 'Skipped', color: 'gray' }
};
```

---

## 🎨 UI Component Structure

### Layout Recommendation
```
┌─────────────────────────────────────────┐
│            Header: VeriSol AI 🤖         │
│     The All-in-One Smart Contract      │
│         Security Scanner              │
└─────────────────────────────────────────┘
┌──────────────────┬──────────────────────┐
│  INPUT COLUMN    │   RESULTS COLUMN     │
│                  │                      │
│ [Address] ✓      │ ┌──────────────────┐ │
│ [GitHub]         │ │ Analysis Report  │ │
│ [Paste Code]     │ │                  │ │
│                  │ │ • Honeypot Check │ │
│ ┌──────────────┐ │ │ • Generic Fuzz   │ │
│ │              │ │ │ • AI Fuzz        │ │
│ │  Input Box   │ │ │ • Static Review  │ │
│ │              │ │ │                  │ │
│ └──────────────┘ │ │ Findings:        │ │
│                  │ │ - Finding 1      │ │
│ [Analyze Now]    │ │ - Finding 2      │ │
│ (or Loading...)  │ │                  │ │
│                  │ └──────────────────┘ │
└──────────────────┴──────────────────────┘
```

---

## 🔄 Implementation Flow

### User Journey - Address Analysis

```
1. User enters contract address (e.g., 0xD7d6215b4EF4b9B5f40baea48F41047Eb67a11D5)
2. Click "Analyze Now" button
3. Frontend sends:
   POST http://localhost:3001/analyze
   {
     "inputType": "address",
     "input": "0xD7d6215b4EF4b9B5f40baea48F41047Eb67a11D5"
   }
4. Backend runs 4 parallel analyses:
   - Static Analysis (AI review of source code)
   - Dynamic Analysis (honeypot check)
   - Generic Fuzzing (pattern-based vulnerability detection)
   - AI Fuzzing (AI-generated fuzz tests)
5. Backend returns consolidated report
6. Frontend displays:
   - Honeypot Alert (if honeypot detected)
   - Fuzz test results with status badges
   - Static analysis findings with severity levels
```

---

## 🛠️ Frontend Implementation Checklist

### Core Features Needed

- [ ] **Tab Navigation**
  - Address input tab
  - GitHub URL input tab
  - Paste code textarea tab
  - Active tab styling

- [ ] **Input Area**
  - Text input field for address/GitHub
  - Textarea for code (larger, multiline)
  - Input validation pattern
  - Disable during loading

- [ ] **Action Button**
  - "Analyze Now" button
  - Show "Analyzing..." during request
  - Disable button during loading
  - Loading spinner/animation

- [ ] **Results Display**
  - Honeypot Alert box (red if true, green if false)
  - Generic Fuzzing result box with status badge
  - AI Fuzzing result box with status badge
  - Risk score color coding

- [ ] **Findings Section**
  - Title + severity badge per finding
  - Description (supports multi-line text)
  - Color-coded by severity (Critical/High/Medium/Low/Info)

- [ ] **Error Handling**
  - Display error message if API request fails
  - Show validation errors with helpful messages
  - Handle network timeout gracefully
  - Display "Analyzing..." state while loading

- [ ] **Repository Analysis Results**
  - List of analyzed files
  - Per-file risk scores
  - Per-file findings

---

## 📝 JavaScript/TypeScript Function Examples

### 1. Validate Input

```javascript
function validateInput(inputType, input) {
  if (!input || !input.trim()) {
    return { valid: false, error: "Input cannot be empty" };
  }

  if (inputType === 'address') {
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(input)) {
      return { 
        valid: false, 
        error: "Invalid Ethereum address format. Expected: 0x followed by 40 hex characters"
      };
    }
  }

  if (inputType === 'github') {
    const githubRegex = /^https:\/\/github\.com\/([\w-]+)\/([\w\-.]+)(\.git)?$/;
    if (!githubRegex.test(input)) {
      return { 
        valid: false, 
        error: "Invalid GitHub URL. Expected: https://github.com/username/repository"
      };
    }
  }

  return { valid: true };
}
```

### 2. Make API Request

```javascript
async function analyzeContract(inputType, inputValue) {
  try {
    const response = await fetch('http://localhost:3001/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputType: inputType,
        input: inputValue
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Analysis failed');
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: error.message || 'Network error occurred'
    };
  }
}
```

### 3. Format Risk Score

```javascript
function getRiskColor(riskScore) {
  const colorMap = {
    'Critical': '#d32f2f',  // Red
    'High': '#f57c00',      // Orange
    'Medium': '#fbc02d',    // Yellow
    'Low': '#388e3c',       // Green
    'Unknown': '#757575'    // Gray
  };
  return colorMap[riskScore] || '#757575';
}

function getRiskBgColor(riskScore) {
  const bgMap = {
    'Critical': '#ffebee',  // Light red
    'High': '#fff3e0',      // Light orange
    'Medium': '#fffde7',    // Light yellow
    'Low': '#e8f5e9',       // Light green
    'Unknown': '#f5f5f5'    // Light gray
  };
  return bgMap[riskScore] || '#f5f5f5';
}
```

### 4. Determine Fuzz Status Display

```javascript
function getFuzzStatusDisplay(data) {
  if (!data) {
    return { status: 'N/A', icon: '⏭️', color: '#757575' };
  }

  const statusMap = {
    'passed': { icon: '✅', label: 'Passed', color: '#388e3c' },
    'failed': { icon: '❌', label: 'FAILED', color: '#d32f2f' },
    'incompatible': { icon: '⚠️', label: 'Incompatible', color: '#f57c00' },
    'error': { icon: '🔴', label: 'Error', color: '#d32f2f' },
    'skipped': { icon: '⏭️', label: 'Skipped', color: '#757575' }
  };

  return statusMap[data.status] || { icon: '❓', label: data.status, color: '#757575' };
}
```

### 5. Handle Loading State

```javascript
function showLoadingState() {
  // Show spinner
  const spinner = document.querySelector('.spinner');
  if (spinner) spinner.style.display = 'block';
  
  // Hide results
  const results = document.querySelector('.results-card');
  if (results) results.style.display = 'none';
  
  // Disable button
  const button = document.querySelector('button[name="analyzeButton"]');
  if (button) {
    button.disabled = true;
    button.textContent = 'Analyzing...';
  }
}

function hideLoadingState() {
  const spinner = document.querySelector('.spinner');
  if (spinner) spinner.style.display = 'none';
  
  const button = document.querySelector('button[name="analyzeButton"]');
  if (button) {
    button.disabled = false;
    button.textContent = 'Analyze Now';
  }
}
```

---

## 🔗 Environment Configuration

### Required Backend Setup

Ensure the backend has these environment variables in `.env`:

```env
# API Keys
GEMINI_API_KEY=YOUR_GOOGLE_GEMINI_API_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
SEPOLIA_RPC_URL=YOUR_SEPOLIA_RPC_URL

# Server Config
PORT=3001
```

### Frontend Configuration

- **API Base URL:** `http://localhost:3001`
- **Request Timeout:** 45 seconds (some analyses take time)
- **CORS:** Backend has CORS enabled (no special headers needed)

---

## ⚡ Performance Tips

1. **Debounce Input**: Add debounce (500ms) to address input to prevent accidental rapid submissions
2. **Timeout Handling**: Set request timeout to 60 seconds (contract fuzzing can take time)
3. **Graceful Degradation**: If AI API fails, other analysis engines still run
4. **Caching**: Consider caching analysis results by address (if implementing locally)

---

## 🧪 Test Cases

### Test Address (No Source Code)
```
0xD7d6215b4EF4b9B5f40baea48F41047Eb67a11D5
```
**Expected:** Returns report with `staticAnalysis.source: "skipped"` but still runs dynamic + fuzzing

### Test Address (Verified Source)
```
0x779877A7B0D9E8603169DdbD7836e478b4624789
```
**Expected:** Returns complete report with all analyses

### Test GitHub URL
```
https://github.com/transmissions11/solmate
```
**Expected:** Clones repo and analyzes all Solidity files

### Test Code Snippet
```solidity
pragma solidity ^0.8.0;
contract Test {
  function test() public {}
}
```
**Expected:** Analyzes provided code directly

---

## 🚀 Deployment Notes

- Backend runs on `localhost:3001` in development
- For production deployment, update API base URL to production server
- Ensure CORS headers are properly configured for your domain
- Add HTTPS if deploying to production

---

## 📞 Support

If components fail:
1. Check `/health` endpoint to verify backend is running
2. Check browser console for CORS errors
3. Verify all required API keys are set in backend `.env`
4. Check backend logs for detailed error messages
