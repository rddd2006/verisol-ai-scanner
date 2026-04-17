# VeriSol AI — Foundry Fuzz Project

Standalone Foundry project used by the VeriSol AI backend at runtime.
You can also run any of the 5 pre-built contracts manually.

## Setup

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
forge install foundry-rs/forge-std --no-commit
```

## Run per contract

```bash
# VulnerableBank — FAIL: reentrancy, overflow, access control
cp ../contracts/VulnerableBank.sol src/Target.sol && forge test -vvv --fuzz-runs 512

# InsecureToken — FAIL: totalSupply invariant, allowance bypass
cp ../contracts/InsecureToken.sol src/Target.sol  && forge test -vvv --fuzz-runs 512

# HoneypotVault — FAIL: user withdraw locked, ownership hijack
cp ../contracts/HoneypotVault.sol src/Target.sol  && forge test -vvv --fuzz-runs 512

# SafeVault — PASS: baseline secure contract
cp ../contracts/SafeVault.sol src/Target.sol      && forge test -vvv --fuzz-runs 512

# NaiveLendingPool — FAIL: flash loan not repaid, undercollateral borrow
cp ../contracts/NaiveLendingPool.sol src/Target.sol && forge test -vvv --fuzz-runs 512
```

## How the backend uses this

1. Creates `/tmp/verisol/forge_<ts>/` with `src/Target.sol` + `test/Fuzz.t.sol`
2. Detects constructor args and encodes defaults
3. Runs `forge build` → `forge test --json -vvv`
4. Parses output → structured TestResult[]
5. Failures fed to FuzzInterpreterAgent for AI explanation
