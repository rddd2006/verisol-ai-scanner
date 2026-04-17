import type { AnalysisReport } from "@/components/AnalysisResults";

// Demo addresses and repos with pre-built mock results
export const DEMO_ADDRESSES = [
  {
    label: "Suspicious Token (Honeypot)",
    value: "0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B",
  },
  {
    label: "Safe DEX Router",
    value: "0xAaBbCcDdEeFf00112233445566778899AaBbCcDd",
  },
  {
    label: "Vulnerable Vault",
    value: "0xD7d6215b4EF4b9B5f40baea48F41047Eb67a11D5",
  },
];

export const DEMO_REPOS = [
  {
    label: "solmate (transmissions11)",
    value: "https://github.com/transmissions11/solmate",
  },
  {
    label: "openzeppelin-contracts",
    value: "https://github.com/OpenZeppelin/openzeppelin-contracts",
  },
];

const DEMO_RESULTS: Record<string, AnalysisReport> = {
  // Honeypot token
  "address:0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B": {
    reportType: "address",
    address: "0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B",
    staticAnalysis: {
      riskScore: "Critical",
      summary:
        "This contract contains multiple high-severity issues including a hidden transfer fee mechanism and an owner-only pause function that can freeze all user funds indefinitely.",
      findings: [
        {
          title: "Hidden Transfer Fee",
          severity: "Critical",
          description:
            "The _transfer function deducts a dynamic fee (up to 99%) controlled by the owner. Users may receive far less tokens than expected.",
        },
        {
          title: "Unrestricted Pause",
          severity: "High",
          description:
            "The owner can call pause() at any time, preventing all transfers. There is no timelock or governance mechanism.",
        },
        {
          title: "Blacklist Functionality",
          severity: "High",
          description:
            "An onlyOwner setBlacklist() function can block any address from transferring tokens with no recourse.",
        },
        {
          title: "No Renounce Ownership",
          severity: "Medium",
          description:
            "The contract inherits Ownable but overrides renounceOwnership() to revert, meaning the owner retains permanent control.",
        },
      ],
    },
    dynamicAnalysis: {
      isHoneypot: true,
      reason:
        "Sell simulation failed: transfer reverted with 'Blacklisted' after initial buy succeeded. Funds cannot be withdrawn.",
    },
    genericFuzzing: {
      status: "failed",
      reason:
        "Token supply invariant violated — totalSupply decreased after a transfer due to hidden burn in fee mechanism.",
    },
    aiFuzzing: {
      status: "failed",
      reason:
        "AI-generated test detected that calling setFee(9900) followed by a transfer results in 99% token loss. Owner can drain liquidity.",
    },
  },

  // Safe DEX router
  "address:0xAaBbCcDdEeFf00112233445566778899AaBbCcDd": {
    reportType: "address",
    address: "0xAaBbCcDdEeFf00112233445566778899AaBbCcDd",
    staticAnalysis: {
      riskScore: "Low",
      summary:
        "Well-structured DEX router contract following standard patterns. Uses SafeMath, has proper access controls, and emits events for all state changes.",
      findings: [
        {
          title: "Floating Pragma",
          severity: "Low",
          description:
            "Contract uses pragma solidity ^0.8.19 instead of a locked version. Consider locking to a specific compiler version for reproducible builds.",
        },
      ],
    },
    dynamicAnalysis: {
      isHoneypot: false,
      reason:
        "Buy and sell simulations both succeeded. Slippage within expected range (0.3%). No trading restrictions detected.",
    },
    genericFuzzing: {
      status: "passed",
      reason:
        "All 12 property-based tests passed across 500 iterations. Token balances, allowances, and supply remain consistent.",
    },
    aiFuzzing: {
      status: "passed",
      reason:
        "AI-generated suite tested swap, addLiquidity, and removeLiquidity functions. All edge cases (zero amounts, max uint, self-swaps) handled correctly.",
    },
  },

  // Vulnerable vault (no source)
  "address:0xD7d6215b4EF4b9B5f40baea48F41047Eb67a11D5": {
    reportType: "address",
    address: "0xD7d6215b4EF4b9B5f40baea48F41047Eb67a11D5",
    staticAnalysis: {
      riskScore: "Medium",
      summary:
        "Source code not verified on Etherscan. Static analysis limited to bytecode heuristics.",
      source: "skipped",
      findings: [],
    },
    dynamicAnalysis: {
      isHoneypot: false,
      reason:
        "Deposit and withdrawal simulations succeeded. No fund-trapping behavior detected in dynamic analysis.",
    },
    genericFuzzing: {
      status: "incompatible",
      reason:
        "Contract ABI not available — generic fuzz suite could not be executed against unverified bytecode.",
    },
    aiFuzzing: {
      status: "skipped",
      reason:
        "AI fuzzing requires source code or verified ABI. Skipped due to unverified contract.",
    },
  },

  // Solmate repo
  "github:https://github.com/transmissions11/solmate": {
    reportType: "repo",
    files: [
      {
        file: "src/tokens/ERC20.sol",
        analysis: {
          riskScore: "Low",
          summary:
            "Gas-optimized ERC20 implementation. Clean code, well-tested. Uses unchecked blocks appropriately for gas savings.",
          findings: [
            {
              title: "No Return Value Check",
              severity: "Low",
              description:
                "transfer() and transferFrom() return bool but some callers may not check. Consider using SafeERC20 patterns.",
            },
          ],
        },
      },
      {
        file: "src/tokens/ERC721.sol",
        analysis: {
          riskScore: "Low",
          summary:
            "Minimal ERC721 implementation. Supports safe transfers and approvals. No known vulnerabilities.",
          findings: [],
        },
      },
      {
        file: "src/auth/Owned.sol",
        analysis: {
          riskScore: "Low",
          summary:
            "Simple ownership module. Single owner pattern with transfer capability.",
          findings: [
            {
              title: "No Two-Step Transfer",
              severity: "Low",
              description:
                "Ownership transfer is single-step. A typo in the new owner address would permanently lose admin access.",
            },
          ],
        },
      },
      {
        file: "src/mixins/ERC4626.sol",
        analysis: {
          riskScore: "Medium",
          summary:
            "Tokenized vault standard implementation. Potential first-depositor inflation attack vector if not mitigated by the integrating protocol.",
          findings: [
            {
              title: "Inflation Attack",
              severity: "Medium",
              description:
                "First depositor can manipulate share price by donating tokens directly to the vault before others deposit. Recommend adding virtual shares/assets.",
            },
            {
              title: "Rounding Direction",
              severity: "Low",
              description:
                "Some rounding favors the user over the vault in edge cases. Standard ERC4626 implementations should round against the user.",
            },
          ],
        },
      },
    ],
  },

  // OpenZeppelin repo
  "github:https://github.com/OpenZeppelin/openzeppelin-contracts": {
    reportType: "repo",
    files: [
      {
        file: "contracts/token/ERC20/ERC20.sol",
        analysis: {
          riskScore: "Low",
          summary:
            "Industry-standard ERC20 implementation. Battle-tested with extensive audit history. No vulnerabilities found.",
          findings: [],
        },
      },
      {
        file: "contracts/access/AccessControl.sol",
        analysis: {
          riskScore: "Low",
          summary:
            "Role-based access control with admin hierarchy. Well-structured and audited.",
          findings: [
            {
              title: "Default Admin Role",
              severity: "Low",
              description:
                "DEFAULT_ADMIN_ROLE is the admin for all roles by default. Ensure this is intentional and the admin key is properly secured.",
            },
          ],
        },
      },
      {
        file: "contracts/proxy/transparent/TransparentUpgradeableProxy.sol",
        analysis: {
          riskScore: "Medium",
          summary:
            "Upgradeable proxy pattern. Powerful but risky — admin can change implementation to arbitrary code.",
          findings: [
            {
              title: "Centralized Upgrade Authority",
              severity: "Medium",
              description:
                "ProxyAdmin has full power to change the implementation contract. If compromised, all proxy state and funds are at risk.",
            },
            {
              title: "Storage Collision Risk",
              severity: "Medium",
              description:
                "Upgrades must maintain storage layout compatibility. A mismatched layout can corrupt contract state silently.",
            },
          ],
        },
      },
      {
        file: "contracts/security/ReentrancyGuard.sol",
        analysis: {
          riskScore: "Low",
          summary:
            "Standard reentrancy protection using a mutex lock. Simple, effective, and gas-efficient.",
          findings: [],
        },
      },
    ],
  },
};

export function getDemoResult(
  inputType: string,
  input: string
): AnalysisReport | null {
  const key = `${inputType}:${input}`;
  return DEMO_RESULTS[key] || null;
}
