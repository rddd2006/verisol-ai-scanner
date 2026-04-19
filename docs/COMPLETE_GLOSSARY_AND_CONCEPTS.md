# VeriSol AI Scanner - Complete Glossary & Concepts Guide

A comprehensive guide for understanding VeriSol AI Scanner without prior Web3 or blockchain experience.

---

## Table of Contents
1. [Blockchain & Web3 Basics](#blockchain--web3-basics)
2. [Smart Contracts](#smart-contracts)
3. [Security Vulnerabilities](#security-vulnerabilities)
4. [Testing Concepts](#testing-concepts)
5. [Tools & Technologies](#tools--technologies)
6. [VeriSol-Specific Concepts](#verisol-specific-concepts)
7. [How VeriSol Works (End-to-End)](#how-verisol-works-end-to-end)

---

## Blockchain & Web3 Basics

### Blockchain
**What it is:** A distributed database that records transactions in a chain of "blocks." Each block contains data and a reference to the previous block, creating an immutable chain.

**Why it matters:** Because no single person/company controls it, blockchain transactions are transparent and permanent.

**Analogy:** Think of it like a notebook that's copied to thousands of computers worldwide. When someone writes something down, everyone updates their notebook. Nobody can erase or change old entries.

### Cryptocurrency
**What it is:** Digital money that runs on blockchain. Bitcoin and Ethereum are the most famous.

**Why it matters:** Instead of trusting a bank to hold your money, the blockchain verifies and records ownership.

### Ethereum
**What it is:** A blockchain specifically designed to run programs (smart contracts), not just record transactions.

**Why it matters:** It's the main platform where most DeFi (Decentralized Finance) applications live.

### Web3
**What it is:** The vision of the internet where users own their data and assets (via blockchain), instead of companies controlling it.

**Examples:**
- Web2: You have a Facebook account, but Facebook owns your data
- Web3: You have a crypto wallet that *you* own completely

### Wallet
**What it is:** A digital account that holds cryptocurrency and proves ownership via a private key (like a password you can't recover if lost).

**Types:**
- **EOA (Externally Owned Account):** A regular wallet controlled by a person with a private key
- **Contract Account:** A wallet controlled by smart contract code (no private key)

### Gas
**What it is:** The cost to execute transactions on Ethereum, measured in "wei" (smallest unit of Ethereum).

**Why it exists:** It prevents spam and incentivizes efficient code.

**Analogy:** Like paying a fee to run a program on someone else's computer.

### Transaction
**What it is:** A request to move money or execute code on the blockchain.

**Who pays:** The person initiating the transaction pays gas fees.

---

## Smart Contracts

### What is a Smart Contract?
A smart contract is a program that runs on the blockchain. It's like a vending machine:
- You send coins (money) + instructions
- The machine executes the code automatically
- Everyone can see the transaction
- The results are permanent

**Key difference:** Unlike regular software, once deployed, a smart contract **cannot be changed**. This makes security critical.

### Solidity
**What it is:** The most popular programming language for writing Ethereum smart contracts.

**Syntax:** Similar to JavaScript but with blockchain-specific features.

**Example:**
```solidity
contract Bank {
  mapping(address => uint) balance;
  
  function deposit() external payable {
    balance[msg.sender] += msg.value;
  }
  
  function withdraw(uint amount) external {
    require(balance[msg.sender] >= amount);
    balance[msg.sender] -= amount;
    payable(msg.sender).transfer(amount);
  }
}
```

### Key Solidity Concepts

#### `address`
A 42-character identifier (like an Ethereum account number). Format: `0x123abc...`

#### `mapping`
Like a dictionary/hash map. Maps one value to another.
```solidity
mapping(address => uint) balance;  // Maps each address to their balance
```

#### `require()`
A safety check. If the condition is false, the transaction reverts (undoes).
```solidity
require(balance >= 100);  // Only proceed if balance is at least 100
```

#### `payable`
Means the function can receive money (Ethereum).

#### `external` / `public` / `private`
- `external`: Can only be called from outside the contract
- `public`: Can be called from anywhere (including inside)
- `private`: Can only be called from inside the contract

#### `view` / `pure`
- `view`: Reads data but doesn't change blockchain
- `pure`: Doesn't read or change anything
- Neither costs gas when called directly

#### `msg.sender`
The address of whoever called the current function.

#### `msg.value`
The amount of money sent with the current transaction.

### Bytecode
**What it is:** The compiled version of a smart contract that runs on the Ethereum Virtual Machine (EVM).

**Why it matters:** When you search for code on Etherscan, you see bytecode, not the original Solidity. VeriSol decodes this.

---

## Security Vulnerabilities

### Reentrancy Attack
**What it is:** A vulnerability where a contract calls another contract, and that contract calls back to the original contract before the first call finishes.

**How it works:**
```
1. Attacker calls Bank.withdraw(100)
2. Bank starts sending money to Attacker
3. Before Bank finishes, Attacker's fallback function runs
4. Attacker's function calls Bank.withdraw(100) again
5. Bank hasn't updated the balance yet, so it sends 100 more
6. Attacker gets 200 with only 100 in their balance!
```

**Real example:** The DAO hack (2016) stole $50M this way.

**Prevention:**
```solidity
// BAD: Vulnerable to reentrancy
function withdraw(uint amount) external {
  require(balance[msg.sender] >= amount);
  payable(msg.sender).transfer(amount);  // ← Calls attacker's code here
  balance[msg.sender] -= amount;          // ← Too late to check
}

// GOOD: Update balance first
function withdraw(uint amount) external {
  require(balance[msg.sender] >= amount);
  balance[msg.sender] -= amount;          // ← Update first
  payable(msg.sender).transfer(amount);   // ← Then send money
}
```

### Honeypot
**What it is:** A fake or malicious smart contract designed to steal money from people trying to use it.

**How it works:**
```solidity
contract FakeToken {
  mapping(address => uint) balance;
  
  function buy(uint amount) public payable {
    balance[msg.sender] = amount;
  }
  
  function sell(uint amount) public {
    // Contract author secretly blacklisted you
    require(!blacklist[msg.sender]);
    // ... rest of sell code
  }
}
```

**What happens:** You can buy the token easily, but when you try to sell, it fails. Your money is stuck.

**VeriSol detects:** Honeypots via bytecode analysis and behavioral simulation.

### Integer Overflow/Underflow
**What it is:** When a number exceeds or goes below its limit.

**Example:**
```solidity
uint8 number = 255;  // Max value for uint8
number += 1;         // Overflows to 0 (in older Solidity)
```

**Danger:** A contract with `uint amount = 0; amount -= 1;` becomes `amount = 2^256 - 1` (huge number).

**Modern Solidity:** Solidity 0.8+ prevents this automatically.

### Logic Bugs
**What it is:** Code that's technically valid but does the wrong thing.

**Example:**
```solidity
// Supposed to be: "if balance is more than 100"
if (balance > 100) { }

// But written as: "if balance is more than OR EQUAL to 100"
if (balance >= 100) { }  // Off-by-one error
```

### Access Control Vulnerabilities
**What it is:** Functions that should be restricted but are publicly callable.

**Example:**
```solidity
// BAD: Anyone can drain the contract
function emergencyWithdraw() public {
  payable(msg.sender).transfer(address(this).balance);
}

// GOOD: Only owner can call
function emergencyWithdraw() public onlyOwner {
  payable(owner).transfer(address(this).balance);
}

modifier onlyOwner {
  require(msg.sender == owner);
  _;
}
```

### Gas Limit DOS (Denial of Service)
**What it is:** Making a transaction fail by consuming too much gas.

**Example:**
```solidity
// BAD: If users array has 10,000 entries, this will run out of gas
function distribute(uint amount) public {
  for (uint i = 0; i < users.length; i++) {
    payable(users[i]).transfer(amount);
  }
}
```

### Front Running
**What it is:** A malicious miner/validator seeing your transaction and submitting their own first to exploit you.

**Example:**
```
1. You see a good deal: "Buy 100 tokens for 1 ETH"
2. You submit the transaction
3. Attacker sees it in the mempool (pending transactions)
4. Attacker submits their own transaction with higher gas fee
5. Attacker's transaction happens first, buys the tokens
6. Your transaction happens, but price has changed
```

---

## Testing Concepts

### Fuzz Testing
**What it is:** Automatically generating random inputs and feeding them to code to find crashes or unexpected behavior.

**How it works:**
```
1. Contract has: function swap(uint tokenA, uint tokenB) {}
2. Fuzzer generates random numbers: 12984, 0, 2^256-1, etc.
3. Tries: swap(12984, 512), swap(0, 10), swap(huge_number, 1), etc.
4. Watches for crashes, reverts, or unexpected state changes
5. If something breaks, it records the exact inputs (counterexample)
```

**Why it's powerful:** Humans can't think of all edge cases. Computers can try thousands quickly.

### Generic Fuzz
**What it is:** Basic fuzz testing that generates random inputs without understanding the contract.

**Pros:** Fast, finds basic bugs
**Cons:** Might miss complex attack scenarios

### AI Fuzz (VeriSol Feature)
**What it is:** Fuzz testing guided by AI that understands contract logic.

**How it differs:**
- **Generic:** Tries `amount=0, amount=1, amount=9999999` randomly
- **AI Fuzz:** Understands "if user balance is checked first," so it tries values designed to bypass that check

**Result:** Finds deeper vulnerabilities faster.

### Test Case
**What it is:** A single input+expected output to verify code works.

**Example:**
```solidity
// Test: "Can user withdraw if they have balance?"
function testWithdraw() public {
  deposit(100);  // Setup: User deposits 100
  uint balance = withdraw(50);  // Action: User withdraws 50
  assert(balance == 50);  // Verification: They get 50 back
}
```

### Coverage
**What it is:** Percentage of code lines that are executed by tests.

**Example:**
```solidity
function withdraw(uint amount) external {
  if (amount == 0) {  // ← Line A
    return;           // ← Line B
  }
  balance[msg.sender] -= amount;  // ← Line C
}

// If tests only call withdraw(100), coverage = 66% (Lines A,C run, B doesn't)
// If tests call both withdraw(0) and withdraw(100), coverage = 100%
```

### Foundry / Forge
**What it is:** A testing framework for Solidity smart contracts (like Jest for JavaScript).

**What it does:**
- Compiles contracts
- Runs test functions
- Measures gas usage
- Fuzz tests automatically
- Shows test results

**VeriSol integration:** Uses Forge to run contracts in a sandboxed environment.

---

## Tools & Technologies

### Etherscan
**What it is:** A blockchain explorer - like Google for Ethereum.

**What you can do:**
- Look up any contract by address
- See all transactions
- View verified source code
- Check contract creation details

**VeriSol use:** Fetches contract bytecode from Etherscan.

### Gemini / Claude / OpenRouter
**What they are:** Large Language Models (LLMs) - AI trained on massive amounts of text.

**How VeriSol uses them:**
1. Feed contract code to the AI
2. Ask questions like "Is this vulnerable to reentrancy?"
3. AI analyzes and explains findings

### Git/GitHub
**What it is:** Version control system - tracks changes to code over time.

**Why VeriSol uses it:** Can clone entire smart contract repositories to analyze all contracts at once.

### Simple-Git
**What it is:** A Node.js library that lets you run Git commands from code.

**VeriSol use:** Automatically clones GitHub repos to analyze them.

### Tailwind CSS
**What it is:** A utility-first CSS framework for styling web interfaces.

**VeriSol use:** Styles the frontend UI (the web interface where you input contracts).

### React / TypeScript
**What they are:**
- **React:** A JavaScript library for building interactive web UIs
- **TypeScript:** JavaScript with type-checking (safer)

**VeriSol use:** Powers the interactive analysis interface in the browser.

### Server-Sent Events (SSE)
**What it is:** A way for a server to push real-time updates to the browser (like notifications).

**How VeriSol uses it:** Shows live progress as agents analyze (Agent 1 running... done! Agent 2 running... done!)

### Node.js / Express
**What they are:**
- **Node.js:** JavaScript runtime that runs on servers (not just browsers)
- **Express:** A framework for building web servers with Node.js

**VeriSol use:** The backend server that analyzes contracts and sends results to the frontend.

---

## VeriSol-Specific Concepts

### Agent
**What it is:** A specialized AI that performs one specific type of analysis.

**VeriSol's agents:**

#### Static Agent
Analyzes code without running it.
- Looks for common vulnerability patterns
- Checks for unsafe function calls
- Identifies obvious logic errors
- Fast but might miss complex bugs

#### Honeypot Agent
Detects if a contract is designed to steal money.
- Analyzes bytecode for hidden restrictions
- Checks for blacklist/whitelist mechanisms
- Compares contract behavior to expected behavior

#### Fuzz Strategy Agent
Designs a fuzz testing strategy.
- Analyzes contract functions
- Plans which inputs might reveal bugs
- Decides how many tests to run

#### Fuzz Runner Agent
Executes fuzz tests guided by the strategy.
- Runs actual tests against contract
- Collects results and counterexamples
- Measures code coverage

#### Fuzz Interpreter Agent
Explains fuzz test failures.
- Takes failed test cases
- Analyzes why they failed
- Determines if it's a real vulnerability

#### Rating Agent
Assigns an overall security score (1-10).
- Combines all findings
- Weighs severity of issues
- Computes final security rating

### Orchestrator
**What it is:** The master controller that coordinates all agents.

**How it works:**
```
1. Start: Orchestrator receives contract code
2. Parallel: Static Agent + Honeypot Agent run together
3. Wait: Orchestrator waits for both to finish
4. Plan: Fuzz Strategy Agent plans tests
5. Test: Fuzz Runner Agent executes tests
6. Interpret: Fuzz Interpreter Agent explains failures
7. Rate: Rating Agent computes final score
8. Done: Return final report
```

### Module
**What it is:** An optional component of VeriSol you can enable/disable.

**VeriSol's modules:**
- **Static Analysis:** Fast code review
- **Honeypot Detection:** Checks for theft traps
- **Generic Fuzz:** Random fuzz testing
- **AI Fuzz:** Smart fuzz testing

You can toggle each on/off depending on speed vs. accuracy needs.

### Input Type
**What it is:** Where the contract code comes from.

**VeriSol supports:**
- **Code:** Paste Solidity code directly
- **Address:** Fetch code from Etherscan (by contract address)
- **GitHub:** Clone and analyze entire repository

### File Tree (GitHub Repos)
**What it is:** A visual folder structure of a GitHub repository.

**VeriSol feature:** Shows which folders contain `.sol` (Solidity) files in red, and marks important "main" contracts.

**Example:**
```
📁 Uniswap V2 Core
  📁 contracts/
    🔴 UniswapV2Pair.sol (MAIN)
    🔴 UniswapV2Factory.sol (MAIN)
  📁 test/
    🔴 TestPair.sol
  📁 lib/
    (skipped - dependencies)
```

### Code Display
**What it is:** Shows the full contract source code with syntax highlighting.

**VeriSol features:**
- Colored keywords (red=contract, blue=function, etc.)
- Line numbers
- Copy-to-clipboard
- Shows file size

### Risk Score
**What it is:** A severity rating for vulnerabilities.

**Levels:**
- 🟢 **Low/Safe:** Minor issues, unlikely to cause real damage
- 🟡 **Medium:** Could cause problems under certain conditions
- 🟠 **High:** Serious vulnerability, money could be lost
- 🔴 **Critical:** Immediate danger, likely exploit already exists

### Finding
**What it is:** A single detected security issue.

**Components:**
- Title: What's the problem?
- Severity: How bad is it?
- Description: Why is it bad?
- Location: Where in code?

---

## How VeriSol Works (End-to-End)

### User Journey

**Step 1: User Inputs Contract**
```
User visits http://127.0.0.1:8080
Chooses input method:
  ├─ CODE: Pastes Solidity code
  ├─ ADDRESS: Enters 0x123abc... (Etherscan lookup)
  └─ GITHUB: Enters https://github.com/...
```

**Step 2: Frontend Sends to Backend**
```
Frontend (React):
  1. Encodes input as base64
  2. Sends to: /api/scan/stream?inputType=...&value=...&modules=...
  3. Opens EventSource to listen for real-time updates
```

**Step 3: Backend Fetches Source Code**
```
Backend (Node.js + Express):
  1. Decodes the input
  2. Fetches actual code:
     - CODE: Uses input directly
     - ADDRESS: Calls Etherscan API
     - GITHUB: Clones repo with simple-git
  3. Sends "source:resolved" event to frontend
```

**Step 4: Orchestrator Coordinates Agents**
```
Orchestrator starts:
  1. Emit "agent:start" for Static Agent
  2. Emit "agent:start" for Honeypot Agent
  3. Both run in parallel
  4. Emit "agent:done" when each finishes
  5. Emit "agent:start" for Fuzz Strategy
  6. Emit "agent:start" for Fuzz Runner
  7. Continue until all done
  8. Emit "agent:complete" with final report
```

**Step 5: Frontend Displays Results**
```
Frontend (React):
  1. Shows FileTree (if GitHub repo)
  2. Shows CodeDisplay (if address)
  3. Shows Honeypot verdict
  4. Shows Static Analysis findings
  5. Shows Fuzz results
  6. Shows Final security rating (1-10)
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER'S BROWSER                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Frontend (React)                                   │   │
│  │  - Input Panel (CODE/ADDRESS/GITHUB tabs)          │   │
│  │  - File Tree (for repos)                            │   │
│  │  - Code Display (with syntax highlighting)          │   │
│  │  - Analysis Results (findings, fuzz, rating)        │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬──────────────────────────────────┘
                         │ HTTP + SSE Events
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND SERVER (Node.js)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Express Server (port 3001)                         │   │
│  │  /api/scan/stream endpoint                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────┼──────────────────────────────┐   │
│  │                      ▼                              │   │
│  │  FetchSource Utility                               │   │
│  │  ├─ Decodes base64 input                           │   │
│  │  ├─ Handles CODE type (direct)                     │   │
│  │  ├─ Handles ADDRESS type (Etherscan API)           │   │
│  │  └─ Handles GITHUB type (git clone)                │   │
│  │                      │                              │   │
│  │                      ▼                              │   │
│  │  Orchestrator                                      │   │
│  │  ├─ Static Agent (pattern analysis)                │   │
│  │  ├─ Honeypot Agent (theft detection)               │   │
│  │  ├─ Fuzz Strategy Agent (test planning)            │   │
│  │  ├─ Fuzz Runner Agent (test execution)             │   │
│  │  ├─ Fuzz Interpreter (explain failures)            │   │
│  │  └─ Rating Agent (final score)                     │   │
│  │                      │                              │   │
│  │  Gemini/OpenRouter API                             │   │
│  │  (AI for smart analysis)                           │   │
│  │                      │                              │   │
│  │  Forge/Foundry                                     │   │
│  │  (Sandbox contract execution)                      │   │
│  └──────────────────────┼──────────────────────────────┘   │
│                         │ SSE: agent:start, agent:done,   │
│                         │      agent:complete              │
└────────────────────────┬──────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │ External │
                    │ APIs     │
                    │ - Gemini │
                    │ - OpenR. │
                    │ - Ethers │
                    └──────────┘
```

---

## Quick Reference: The 10 Most Important Concepts

1. **Smart Contract**: Automated program on blockchain
2. **Reentrancy**: Function calling itself before updating state
3. **Honeypot**: Fake contract that traps your money
4. **Fuzz Testing**: Throwing random inputs at code to find bugs
5. **Gas**: Cost to run code on Ethereum
6. **Bytecode**: Compiled version of contract code
7. **Agent**: Specialized AI analyzer
8. **Orchestrator**: Master coordinator of agents
9. **SSE**: Real-time events from server to browser
10. **Risk Score**: How dangerous is the vulnerability?

---

## Common Questions Answered

### Q: What if I'm not a programmer?
**A:** VeriSol does the analysis for you. You just need to know: "This contract is code, I want to check if it's safe."

### Q: Can VeriSol find ALL bugs?
**A:** No. No tool can. But it finds the most common and dangerous ones. Human auditors still needed for critical contracts.

### Q: What's the difference between the three input types?
- **CODE:** For contracts you wrote or have the source
- **ADDRESS:** For deployed contracts (requires Etherscan indexing)
- **GITHUB:** For entire projects with multiple files

### Q: Why do some agents run in parallel?
**A:** Static and Honeypot analysis are independent - no need to wait for one to finish before starting the other. Saves time.

### Q: What does "main contract" mean?
**A:** The primary smart contract in a repository. Supporting files (libraries, test files) are less critical to analyze first.

### Q: Why use AI for smart contract analysis?
**A:** AI understands context and logic flow better than pattern matching. It can understand "this could be exploited if..." scenarios.

### Q: Is this replacement for professional audits?
**A:** No. VeriSol is a first-pass automated check. Critical contracts still need human auditors.

---

## Resources for Learning More

### Web3 Basics
- ethereum.org (Official Ethereum docs)
- cryptozombies.io (Interactive Solidity lessons)

### Smart Contract Security
- smartcontractsecurity.org
- CWE-1104 (Common Weakness Enumeration for smart contracts)

### VeriSol Specific
- See docs/ folder in repository
- GitHub README

---

**Last Updated:** April 2026
**For:** Complete beginners to smart contract security
