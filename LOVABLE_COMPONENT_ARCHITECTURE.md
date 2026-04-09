# Lovable Component Architecture Guide

## 📐 Component Breakdown

### 1. Main App Container
**Purpose:** Root component that manages overall state and layout

**Props:** None (root component)

**State:**
- `inputType` - Current selected input type (address|github|text)
- `inputValue` - Current input text
- `isLoading` - Whether analysis is in progress
- `result` - Current analysis result data
- `error` - Current error message

**Key Functions:**
- `handleInputTypeChange(type)` - Switch between input tabs
- `handleInputChange(value)` - Update input value
- `handleAnalyze()` - Submit analysis request
- `handleReset()` - Clear all state

---

### 2. Input Panel Component
**Purpose:** Left column with input controls

**Props:**
- `inputType` - Current input type
- `inputValue` - Current input value
- `isLoading` - Disable inputs during analysis
- `onTypeChange(type)` - Callback when tab changes
- `onValueChange(value)` - Callback when input changes
- `onAnalyze()` - Callback when analyze button clicked

**Renders:**
- Tab buttons (Address, GitHub, Code)
- Input field or textarea (based on type)
- Analyze button with loading state

**Features:**
- Tabs with active state styling
- Different input element for text (textarea) vs other types
- Button disabled/loading state
- Input placeholder based on selected type

---

### 3. Tab Selector Sub-component
**Purpose:** Reusable tab navigation

**Props:**
- `tabs` - Array of tab objects: `[{ id: 'address', label: 'Contract Address' }, ...]`
- `activeTab` - Currently active tab id
- `onTabChange(tabId)` - Callback when tab selected

**Renders:**
- Button group with styling
- Active tab highlighted

---

### 4. Input Field Sub-component
**Purpose:** Smart input based on type

**Props:**
- `type` - Input type (address|github|text)
- `value` - Current value
- `isLoading` - Disable input
- `onChange(value)` - Callback on change
- `onSubmit()` - Callback on enter/button click

**Behavior:**
- `address` or `github` types → `<input type="text">`
- `text` type → `<textarea rows="8">`
- Both disabled while loading

---

### 5. Results Panel Component
**Purpose:** Right column displaying analysis results

**Props:**
- `isLoading` - Show loading spinner
- `error` - Error message to display
- `result` - Analysis result object

**Renders:**
- Error card (if error exists)
- Loading spinner (if isLoading true)
- Results display (if result exists)

---

### 6. Results Display Component
**Purpose:** Route to correct result type handler

**Props:**
- `result` - Full analysis result

**Logic:**
```
if result.reportType === 'address'
  → render AddressReportComponent
else if result.reportType === 'repo' or 'text'
  → render FileListComponent
```

---

### 7. Address Report Component
**Purpose:** Display address analysis (4 analysis engines)

**Props:**
- `staticAnalysis` - Static analysis results
- `dynamicAnalysis` - Honeypot detection results
- `genericFuzzing` - Generic fuzzing results
- `aiFuzzing` - AI fuzzing results

**Renders:**
1. **Honeypot Section**
   - Green box if safe, red box if honeypot
   - Reason text

2. **Fuzzing Results Row**
   - Generic Fuzzing box with status badge
   - AI Fuzzing box with status badge

3. **Static Analysis Section** (if available)
   - Risk score with color coding
   - Summary text
   - Findings list (if any)

---

### 8. Analysis Box Component
**Purpose:** Reusable box for single analysis result

**Props:**
- `title` - Box title (e.g., "Generic Fuzzing")
- `icon` - Emoji/icon (e.g., "🔬")
- `status` - Result status (passed|failed|incompatible|skipped)
- `reason` - Explanation text

**Renders:**
- Title with icon
- Status badge with color
- Reason paragraph

**Status Colors:**
- passed → Green
- failed → Red
- incompatible → Orange
- skipped → Gray

---

### 9. Finding Card Component
**Purpose:** Display individual security finding

**Props:**
- `title` - Finding title
- `description` - Detailed description
- `severity` - Severity level (Critical|High|Medium|Low|Info)

**Features:**
- Color-coded severity badge
- Title text
- Description paragraph

---

### 10. File Report Component
**Purpose:** Display GitHub/text analysis results

**Props:**
- `files` - Array of file analysis objects

**Renders:**
- For each file:
  - File name/path
  - Risk score with color
  - Summary
  - Findings list

---

### 11. Error Display Component
**Purpose:** Show error messages

**Props:**
- `error` - Error message text
- `onDismiss()` - Optional callback to clear error

**Features:**
- Red/danger styling
- Error icon
- Message text
- Optional close button

---

### 12. Loading Spinner Component
**Purpose:** Show analysis is in progress

**Props:**
- `message` - Optional loading message

**Features:**
- Animated spinner
- "Analyzing..." text
- Center positioned

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    App Component                             │
│  State: inputType, inputValue, isLoading, result, error     │
└─────────────────────────────────────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
          ┌─────────▼──────┐  ┌──▼─────────────┐
          │  Input Panel   │  │  Results Panel │
          │  (Left Column) │  │  (Right Column)│
          └────────────────┘  └────────────────┘
                    │                    │
         ┌──────────┼──────────┐         │
         │          │          │         │
    ┌────▼────┐ ┌──▼────┐ ┌───▼──┐      │
    │ Tabs    │ │Input  │ │Analyze│     │
    │Component│ │Field  │ │Button │     │
    └─────────┘ └───────┘ └───────┘     │
                                        │
                    ┌───────────────────┤
                    │                   │
         ┌──────────▼────────┐  ┌──────▼──────────┐
         │ Error Display    │  │ Loading Spinner │
         │ (if error)       │  │ (if isLoading)  │
         └──────────────────┘  └─────────────────┘
                                        │
                    ┌───────────────────┤
                    │                   │
         ┌──────────▼──────────────┐   │
         │ Results Display Router  │◄──┘
         │ (if result exists)      │
         └──────────────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    ┌────▼──────────┐  ┌──────▼──────────┐
    │ Address       │  │ File List       │
    │ Report        │  │ Component       │
    │               │  │                 │
    │ • Honeypot    │  │ • Analyze box   │
    │ • Fuzz boxes  │  │ • For each file:│
    │ • Static      │  │   - Risk score  │
    │   findings    │  │   - Findings    │
    └───────────────┘  └─────────────────┘
```

---

## 🎯 Event Flow

### User Submits Analysis

```
1. User selects input type (tab click)
   → onTypeChange() 
   → setInputType()
   → setInputValue('')
   → Render with empty input

2. User types/pastes input
   → onChange()
   → setInputValue(newValue)
   → Re-render (no API call yet)

3. User clicks "Analyze Now"
   → onAnalyze()
   → validateInput()
   → setIsLoading(true)
   → fetch POST /analyze
   
4A. Success response:
   → setResult(data)
   → setIsLoading(false)
   → Render results
   
4B. Error response:
   → setError(errorMessage)
   → setIsLoading(false)
   → Render error message
```

---

## 💾 Local Storage Pattern (Optional)

```javascript
// Save input history
function saveInputHistory(inputType, inputValue) {
  const history = JSON.parse(localStorage.getItem('verisol_history') || '[]');
  history.unshift({ type: inputType, value: inputValue, timestamp: Date.now() });
  localStorage.setItem('verisol_history', JSON.stringify(history.slice(0, 10))); // Keep last 10
}

// Load input history
function loadInputHistory() {
  return JSON.parse(localStorage.getItem('verisol_history') || '[]');
}

// Save last result
function saveLastResult(result) {
  localStorage.setItem('verisol_last_result', JSON.stringify(result));
}

// Load last result
function loadLastResult() {
  return JSON.parse(localStorage.getItem('verisol_last_result') || 'null');
}
```

---

## 🎨 Styling Architecture

### Color Scheme
```javascript
const COLORS = {
  primary: '#1976d2',      // Blue
  success: '#388e3c',      // Green
  warning: '#fbc02d',      // Yellow
  error: '#d32f2f',        // Red
  info: '#1976d2',         // Blue
  dark: '#212121',
  light: '#f5f5f5',
  border: '#e0e0e0'
};

const RISK_COLORS = {
  critical: COLORS.error,           // Red
  high: '#f57c00',                  // Orange
  medium: COLORS.warning,           // Yellow
  low: COLORS.success,              // Green
  unknown: '#757575'                // Gray
};

const STATUS_COLORS = {
  passed: COLORS.success,           // Green
  failed: COLORS.error,             // Red
  incompatible: '#f57c00',          // Orange
  skipped: '#757575',               // Gray
  pending: COLORS.primary           // Blue
};
```

### Typography Scale
```
Heading 1 (H1): 32px, bold, dark      - Main title
Heading 2 (H2): 24px, bold, dark      - Section titles
Heading 3 (H3): 18px, bold, dark      - Box titles
Heading 4 (H4): 14px, bold, dark      - Sub-section titles
Heading 5 (H5): 12px, bold, dark      - Finding titles
Body:           14px, regular, dark   - Regular text
Small:          12px, regular, gray   - Secondary text
Code:           12px, monospace       - Code snippets
```

### Spacing
```
Base unit: 8px

xs: 4px   (2x)
sm: 8px   (1x)
md: 16px  (2x)
lg: 24px  (3x)
xl: 32px  (4x)
```

### Responsive Breakpoints
```
Mobile:  < 640px   (single column layout)
Tablet:  640-1024px (2 column layout)
Desktop: > 1024px  (2 column layout with better spacing)
```

---

## 🔐 Security Considerations

1. **Input Validation**
   - Validate on client before sending
   - Server also validates (defense in depth)
   - Don't trust server response (sanitize HTML)

2. **API Keys**
   - Never expose API keys in frontend
   - All API keys kept in backend `.env`
   - Backend makes all external API calls

3. **CORS**
   - Backend has CORS enabled
   - Frontend requests to `http://localhost:3001`
   - Safe for development/local use

4. **Content Security**
   - Sanitize error messages before display
   - Don't eval() or use dangerouslySetInnerHTML
   - Use textContent for user-provided text

---

## 📊 Component State Management

### Option 1: React Hooks (if using React on Lovable)
```javascript
const [inputType, setInputType] = useState('address');
const [inputValue, setInputValue] = useState('');
const [isLoading, setIsLoading] = useState(false);
const [result, setResult] = useState(null);
const [error, setError] = useState('');
```

### Option 2: Vanilla JavaScript
```javascript
const state = {
  inputType: 'address',
  inputValue: '',
  isLoading: false,
  result: null,
  error: ''
};

function updateState(updates) {
  Object.assign(state, updates);
  render();
}
```

### Option 3: Lovable Data Binding
- Use Lovable's built-in state management
- Bind inputs to state properties
- Bind button click to handler function
- State changes trigger re-render

---

## 📱 Responsive Design

### Mobile Layout (< 640px)
```
┌──────────────────┐
│     Header       │
├──────────────────┤
│   Input Tab      │
├──────────────────┤
│  Input Area      │
├──────────────────┤
│  Analyze Button  │
├──────────────────┤
│   Results or     │
│  Error/Loading   │
└──────────────────┘
```

### Desktop Layout (> 640px)
```
┌────────────────────────────────────┐
│          Header                     │
├──────────────────┬──────────────────┤
│  Input Column    │  Results Column  │
│  • Tabs          │  • Results       │
│  • Input         │  • Error/Loading │
│  • Button        │                  │
└──────────────────┴──────────────────┘
```

---

## 🧪 Testing Scenarios

### Test 1: Basic Flow
1. Start app → inputType = 'address', inputValue = ''
2. Type address → state updates
3. Click analyze → API call
4. Receive result → display results

### Test 2: Error Handling
1. Type invalid address
2. Click analyze → validation error before API
3. Error message displays

### Test 3: Loading State
1. Click analyze → isLoading = true
2. Button shows "Analyzing..."
3. Spinner displays
4. Inputs disabled
5. Response arrives → isLoading = false

### Test 4: Tab Switching
1. Click "GitHub Repo" tab
2. inputType changes
3. inputValue clears
4. Placeholder updates
5. Input field remains focused (optional)

### Test 5: Long Analysis
1. Submit slow contract
2. Wait 30+ seconds
3. Result eventually displays
4. Spinner never times out (server handles it)

---

## 🚀 Deployment Checklist

- [ ] API base URL points to production backend
- [ ] All environment variables removed from code
- [ ] Error messages sanitized
- [ ] Loading states work correctly
- [ ] Mobile responsive design tested
- [ ] CORS errors verified absent
- [ ] Performance tested (no unnecessary re-renders)
- [ ] Accessibility tested (keyboard navigation, screen readers)
- [ ] Browser compatibility verified
- [ ] Network timeout handled gracefully

---

## 📞 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| CORS error | Ensure backend has CORS enabled, use correct API URL |
| Request timeout | Increase timeout to 60s, check network |
| Results not displaying | Check response structure matches expected format |
| Styling looks wrong | Check CSS classes match component structure |
| Input validation failing | Verify regex patterns match user input |
| Loading spinner spinning forever | Server might be down, check /health endpoint |
| Results card blank | Response might have unexpected structure, check console |

