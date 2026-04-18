# GitHub Repo & Contract Address Display Enhancements

## Overview
Enhanced the frontend to display:
1. **GitHub Repos:** Complete file tree structure with `.sol` files highlighted in red
2. **Contract Addresses:** Full source code with syntax highlighting and copy functionality

## Backend Changes

### `/backend/routes/scan.js`
- Updated `source:resolved` event to include metadata:
  - `inputType` - "github", "address", or "code"
  - `files` - Array of file objects with metadata
  - `fileCount` - Total number of files analyzed
  - `totalSize` - Total size in bytes
  - `address` - Deployed contract address (for address type)
  
- Enhanced `agent:complete` event to attach sourceCode for address/code analyses

### `/backend/utils/fetchSource.js`
- Returns file metadata including:
  - `files` - Array of file objects with paths, contents, sizes
  - `fileCount` - Number of analyzed files
  - `totalSize` - Combined size in bytes
  - File metadata: `isMainContract`, `contractNames`

## Frontend Changes

### New Components

#### `FileTree.tsx`
- **Purpose:** Display repository file structure for GitHub repos
- **Features:**
  - Expandable/collapsible folder tree
  - 🔴 Red highlighting for `.sol` files
  - 🏆 "MAIN" badge for primary contracts
  - File sizes and contract names in tree
  - Summary stats: Total files, .sol files, main contracts
  - Responsive scrollable view with max-height

#### `CodeDisplay.tsx`
- **Purpose:** Display source code for contract address analyses
- **Features:**
  - Syntax highlighting (keywords, strings, comments)
  - Line numbers
  - Copy-to-clipboard button with success indicator
  - File size and line count display
  - Shows contract address and name
  - Responsive scrollable code viewer

### Updated Components

#### `AnalysisResults.tsx`
- Imports new FileTree and CodeDisplay components
- Renders FileTree conditionally for `inputType === "github"`
- Renders CodeDisplay conditionally for `inputType === "address"`
- Maintains existing analysis results display below

#### `useScan.ts` Hook
- Captures metadata from `source:resolved` SSE event
- Merges metadata with final report
- Extended `AnalysisReport` interface with:
  - `inputType`, `address`, `linesOfCode`
  - `files`, `fileCount`, `totalSize`
  - `sourceCode` (for address/code types)

## Display Flow

### GitHub Repositories
```
Frontend Input (GitHub URL)
    ↓
Backend: Clone + Find .sol files
    ↓
SSE: source:resolved with files metadata
    ↓
Frontend: FileTree displays
    ├─ folder structure
    ├─ 🔴 red .sol files
    ├─ 🏆 main contracts
    └─ stats (total files, .sol count, main count)
    ↓
SSE: agent:complete with analysis results
    ↓
Frontend: Show Honeypot, Static, Fuzz, Rating results
```

### Contract Addresses
```
Frontend Input (0x123... address)
    ↓
Backend: Fetch code from Etherscan
    ↓
SSE: source:resolved with address metadata
    ↓
Frontend: CodeDisplay shows
    ├─ Full contract code with syntax highlighting
    ├─ Line numbers
    ├─ Copy button
    └─ Address display
    ↓
SSE: agent:complete with analysis results
    ↓
Frontend: Show Honeypot, Static, Fuzz, Rating results
```

## File Priority in Analysis

Files are sorted by importance:
1. **Main Contracts** (high priority) - Located in src/, contracts/, root
   - Have concrete implementations (not just interfaces)
   - Marked with 🏆 "MAIN" badge
2. **Supporting Files** (medium priority) - Listed by size (smaller first)
   - Libraries, utilities, smaller contracts
3. **Excluded Directories** - Not analyzed
   - test/, mock/, lib/, build/, node_modules/, etc.

## Testing

### Test with GitHub Repository
```
1. Go to frontend: http://127.0.0.1:8080
2. Switch to GITHUB tab
3. Enter: https://github.com/Uniswap/v2-core
4. Observe:
   - FileTree shows folder structure
   - Core contracts (UniswapV2Pair, UniswapV2Factory) marked as MAIN
   - .sol files in red color
   - Summary: Total files, .sol file count, main contract count
```

### Test with Contract Address
```
1. Switch to ADDRESS tab
2. Enter: 0x1F98431c8aD98523631AE4a59f267346ea31F984 (Uniswap V3 PositionManager)
3. Observe:
   - CodeDisplay shows full contract code
   - Syntax highlighting: keywords (red), strings (green), comments (gray)
   - Line numbers on left
   - Copy button to copy code
   - Address displayed in header
```

## Efficiency Features

- **Smart File Selection:** Only main contracts analyzed first
- **Size Limits:** 5MB per file, 50MB total
- **Early Exit:** 25 files max, 100 files found max
- **Directory Skipping:** 12+ exclusion patterns (node_modules, lib, test, etc.)
- **Token-Aware:** Shorter files analyzed first to prevent token exhaustion

## CSS Classes Used

- `brutal-box-static` - Card styling
- `text-risk-critical` - Red color for .sol files
- `text-risk-low` - Green for main contract badge
- `font-mono` - Monospace for code
- Font sizes: `text-xs`, `text-sm`, `text-lg` for hierarchy

## Browser Compatibility

- Modern browsers with ES6+ support
- EventSource API for SSE streaming
- CSS Grid/Flexbox for responsive layouts
