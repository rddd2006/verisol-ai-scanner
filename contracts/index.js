"use strict";

const fs   = require("fs");
const path = require("path");

const DIR = __dirname;

/**
 * Registry of all pre-built example contracts.
 * Each entry contains the full source code read from disk.
 */
const CONTRACTS = {
  VulnerableBank: {
    id:          "VulnerableBank",
    label:       "Vulnerable Bank",
    description: "Reentrancy + tx.origin auth + missing access control",
    tags:        ["reentrancy", "access-control", "arithmetic"],
    severity:    "critical",
    source:      fs.readFileSync(path.join(DIR, "VulnerableBank.sol"), "utf8"),
  },
  InsecureToken: {
    id:          "InsecureToken",
    label:       "Insecure Token",
    description: "Uncapped mint + no allowance check + centralized burn",
    tags:        ["access-control", "arithmetic", "erc20"],
    severity:    "high",
    source:      fs.readFileSync(path.join(DIR, "InsecureToken.sol"), "utf8"),
  },
  HoneypotVault: {
    id:          "HoneypotVault",
    label:       "Honeypot Vault",
    description: "selfdestruct trap + owner-only withdraw + pause freeze",
    tags:        ["honeypot", "selfdestruct", "rug-pull"],
    severity:    "critical",
    source:      fs.readFileSync(path.join(DIR, "HoneypotVault.sol"), "utf8"),
  },
  SafeVault: {
    id:          "SafeVault",
    label:       "Safe Vault ✓",
    description: "Well-written vault — CEI pattern + nonReentrant + timelock",
    tags:        ["safe", "best-practice"],
    severity:    "none",
    source:      fs.readFileSync(path.join(DIR, "SafeVault.sol"), "utf8"),
  },
  NaiveLendingPool: {
    id:          "NaiveLendingPool",
    label:       "Naive Lending Pool",
    description: "Flash loan oracle manipulation + free flash loans + reentrancy",
    tags:        ["flash-loan", "oracle", "reentrancy"],
    severity:    "critical",
    source:      fs.readFileSync(path.join(DIR, "NaiveLendingPool.sol"), "utf8"),
  },
};

module.exports = { CONTRACTS };
