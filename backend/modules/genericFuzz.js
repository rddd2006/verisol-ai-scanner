"use strict";

/**
 * genericFuzz.js
 *
 * Builds a Foundry fuzz-test file tailored to the contract's shape:
 *  - Detects constructor arguments and encodes them in the deploy call
 *  - Chooses bank/vault vs token test suites based on contract interface
 *  - Ships an inline ReentrancyAttacker helper
 *  - Falls back to static heuristics when forge is not installed
 */

const { runForgeTest } = require("../utils/foundryRunner");

// ─────────────────────────────────────────────────────────────────────────────
//  Constructor argument detector
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse the constructor signature and return an ABI-encoded args suffix
 * ready to append to creationCode, plus a human comment.
 */
function detectConstructorArgs(source) {
  const match = source.match(/constructor\s*\(([^)]*)\)/);
  if (!match || !match[1].trim()) {
    return { encodedArgs: "", deployNote: "// No-arg constructor" };
  }

  const params = match[1].trim().split(",").map((p) => p.trim());
  const types  = params.map((p) => p.split(/\s+/)[0]); // just the type

  // Build abi.encode(...) expression with safe default values
  const defaults = types.map((t) => {
    if (t.startsWith("uint") || t.startsWith("int")) return "1000e18";
    if (t === "address") return "address(this)";
    if (t === "bool")    return "true";
    if (t === "string")  return '"TestToken"';
    if (t === "bytes")   return '"0x"';
    return "0";
  });

  const encodeCall = `abi.encode(${defaults.join(", ")})`;
  return {
    encodedArgs: encodeCall,
    deployNote:  `// Constructor args: ${types.join(", ")} → ${defaults.join(", ")}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Contract type detector
// ─────────────────────────────────────────────────────────────────────────────

function detectContractType(source) {
  const lc = stripComments(source).toLowerCase();
  if (lc.includes("flashloan") || lc.includes("flash_loan") || lc.includes("reserve"))
    return "lending";
  if (
    /\b(totalSupply|totalsupply)\b/i.test(source) ||
    /\bbalanceOf\b/i.test(source) ||
    /\bfunction\s+transfer\s*\(/i.test(source)
  ) return "token";
  return "vault";
}

// ─────────────────────────────────────────────────────────────────────────────
//  Test-suite builder
// ─────────────────────────────────────────────────────────────────────────────

function buildGenericTestSuite(contractName, pragma, source) {
  const solVer  = pragma || "^0.8.0";
  const { encodedArgs, deployNote } = detectConstructorArgs(source);
  const contractType = detectContractType(source);

  const deployBlock = encodedArgs
    ? `bytes memory creation = abi.encodePacked(
            vm.getCode("Target.sol:${contractName}"),
            ${encodedArgs}
        );`
    : `bytes memory creation = abi.encodePacked(
            vm.getCode("Target.sol:${contractName}")
        );`;

  // Token-specific tests
  const tokenTests = contractType === "token" ? `
    // ─────────────────────────────────────────────────────────────────
    //  TOKEN TEST 1: totalSupply consistency after transfer
    // ─────────────────────────────────────────────────────────────────
    function testFuzz_totalSupplyConsistentAfterTransfer(address to, uint96 amount) public {
        vm.assume(to != address(0) && to != target);
        vm.assume(amount > 0 && amount <= 1e24);

        (, bytes memory supplyBefore) = target.staticcall(abi.encodeWithSignature("totalSupply()"));
        if (supplyBefore.length < 32) return;
        uint256 tsBefore = abi.decode(supplyBefore, (uint256));

        target.call(abi.encodeWithSignature("transfer(address,uint256)", to, uint256(amount)));

        (, bytes memory supplyAfter) = target.staticcall(abi.encodeWithSignature("totalSupply()"));
        if (supplyAfter.length < 32) return;
        uint256 tsAfter = abi.decode(supplyAfter, (uint256));

        assertEq(
            tsBefore,
            tsAfter,
            "INVARIANT: totalSupply changed after transfer — hidden fee or burn"
        );
    }

    // ─────────────────────────────────────────────────────────────────
    //  TOKEN TEST 2: transferFrom without approve must fail
    // ─────────────────────────────────────────────────────────────────
    function testFuzz_transferFromRequiresApproval(address from, address to, uint96 amount) public {
        vm.assume(from != address(0) && to != address(0) && from != to);
        vm.assume(amount > 0);

        // Check allowance is zero for this test account
        (, bytes memory allowBytes) = target.staticcall(
            abi.encodeWithSignature("allowance(address,address)", from, address(this))
        );
        if (allowBytes.length >= 32) {
            uint256 allowance = abi.decode(allowBytes, (uint256));
            if (allowance > 0) return; // already approved — skip
        }

        // Try to transferFrom with no approval
        vm.prank(address(this));
        (bool ok,) = target.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, uint256(amount))
        );

        // If the caller has no allowance, transferFrom MUST fail
        (, bytes memory balBytes) = target.staticcall(
            abi.encodeWithSignature("balanceOf(address)", from)
        );
        if (balBytes.length < 32) return;
        uint256 fromBalance = abi.decode(balBytes, (uint256));

        if (fromBalance >= amount) {
            assertFalse(
                ok,
                "MISSING ALLOWANCE CHECK: transferFrom succeeded without approval"
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //  TOKEN TEST 3: admin burn must not exceed holder balance
    // ─────────────────────────────────────────────────────────────────
    function testFuzz_adminBurnCapped(address victim, uint96 burnAmount) public {
        vm.assume(victim != address(0));
        vm.assume(burnAmount > 0);

        (, bytes memory balBefore) = target.staticcall(
            abi.encodeWithSignature("balanceOf(address)", victim)
        );
        if (balBefore.length < 32) return;
        uint256 balanceBeforeBurn = abi.decode(balBefore, (uint256));

        target.call(abi.encodeWithSignature("adminBurn(address,uint256)", victim, uint256(burnAmount)));

        (, bytes memory balAfter) = target.staticcall(
            abi.encodeWithSignature("balanceOf(address)", victim)
        );
        if (balAfter.length < 32) return;
        uint256 balanceAfterBurn = abi.decode(balAfter, (uint256));

        assertLe(
            balanceAfterBurn,
            balanceBeforeBurn,
            "BURN: balance increased after burn — impossible"
        );
    }
` : "";

  // Lending-specific tests
  const lendingTests = contractType === "lending" ? `
    // ─────────────────────────────────────────────────────────────────
    //  LENDING TEST 1: flash loan must be fully repaid
    // ─────────────────────────────────────────────────────────────────
    function testFuzz_flashLoanMustBeRepaid(uint96 loanAmount) public {
        vm.assume(loanAmount >= 0.001 ether && loanAmount <= 1 ether);

        uint256 poolBalBefore = target.balance;
        if (poolBalBefore < loanAmount) return;

        // Try a flash loan to a contract that does NOT repay
        BadFlashBorrower borrower = new BadFlashBorrower();
        (bool ok,) = target.call(
            abi.encodeWithSignature(
                "flashLoan(uint256,address,bytes)",
                uint256(loanAmount),
                address(borrower),
                bytes("")
            )
        );

        // Must revert — borrower never repaid
        assertFalse(ok, "FLASH LOAN: unreturned flash loan was accepted");
    }

    // ─────────────────────────────────────────────────────────────────
    //  LENDING TEST 2: borrow without sufficient collateral must fail
    // ─────────────────────────────────────────────────────────────────
    function testFuzz_borrowRequiresCollateral(uint96 borrowAmount) public {
        vm.assume(borrowAmount > 0 && borrowAmount <= 1e6);

        // New address with zero collateral tries to borrow
        address poorBorrower = address(0xBAAD);
        vm.prank(poorBorrower);
        (bool ok,) = target.call(
            abi.encodeWithSignature("borrow(uint256)", uint256(borrowAmount))
        );
        assertFalse(ok, "UNDERCOLLATERAL: borrow succeeded with zero collateral");
    }
` : "";

  return `// SPDX-License-Identifier: MIT
pragma solidity ${solVer};

import "forge-std/Test.sol";

/**
 * @title GenericFuzzTest
 * @notice VeriSol AI auto-generated fuzz suite for ${contractName}
 *         Contract type detected: ${contractType}
 */
contract GenericFuzzTest is Test {

    address payable target;
    ReentrancyAttacker attacker;

    function setUp() public {
        vm.deal(address(this), 1000 ether);

        ${deployNote}
        ${deployBlock}

        address deployed;
        assembly {
            deployed := create(0, add(creation, 0x20), mload(creation))
        }
        require(deployed != address(0), "Target deployment failed");
        target = payable(deployed);

        vm.deal(target, 10 ether);

        attacker = new ReentrancyAttacker(target);
        vm.deal(address(attacker), 100 ether);

        vm.label(target,            "${contractName}");
        vm.label(address(attacker), "ReentrancyAttacker");
    }

    // ─────────────────────────────────────────────────────────────────
    //  TEST 1: Reentrancy — attacker must not drain more than deposited
    // ─────────────────────────────────────────────────────────────────
    function testFuzz_noReentrancyDrain(uint96 depositWei) public {
        vm.assume(depositWei >= 0.001 ether && depositWei <= 5 ether);

        uint256 attackerBalBefore = address(attacker).balance;

        bool attacked = attacker.attack{value: depositWei}(depositWei);

        if (attacked) {
            uint256 gained = address(attacker).balance > attackerBalBefore
                ? address(attacker).balance - attackerBalBefore
                : 0;

            assertLe(
                gained,
                depositWei,
                string(abi.encodePacked(
                    "REENTRANCY: attacker gained ",
                    vm.toString(gained / 1e12), "e-6 ETH but deposited ",
                    vm.toString(uint256(depositWei) / 1e12), "e-6 ETH"
                ))
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //  TEST 2: Over-withdrawal must always revert
    // ─────────────────────────────────────────────────────────────────
    function testFuzz_cannotOverWithdraw(uint96 deposit, uint96 extra) public {
        vm.assume(deposit >= 0.001 ether && deposit <= 5 ether);
        vm.assume(extra   >= 1 && uint256(deposit) + uint256(extra) <= 50 ether);

        (bool depOk,) = target.call{value: deposit}(abi.encodeWithSignature("deposit()"));
        if (!depOk) return;

        uint256 overAmt = uint256(deposit) + uint256(extra);
        (bool wdOk,) = target.call(abi.encodeWithSignature("withdraw(uint256)", overAmt));

        assertFalse(
            wdOk,
            string(abi.encodePacked(
                "OVER-WITHDRAW: withdrew ", vm.toString(overAmt / 1e15),
                " mETH but only deposited ", vm.toString(uint256(deposit) / 1e15), " mETH"
            ))
        );
    }

    // ─────────────────────────────────────────────────────────────────
    //  TEST 3: Arithmetic must not silently overflow
    // ─────────────────────────────────────────────────────────────────
    function testFuzz_arithmeticNoOverflow(uint128 a, uint128 b) public {
        (bool ok, bytes memory ret) = target.staticcall(
            abi.encodeWithSignature("unsafeAdd(uint256,uint256)", uint256(a), uint256(b))
        );
        if (!ok || ret.length < 32) return;

        uint256 result = abi.decode(ret, (uint256));

        if (a < type(uint64).max && b < type(uint64).max) {
            assertEq(
                result,
                uint256(a) + uint256(b),
                string(abi.encodePacked(
                    "OVERFLOW: unsafeAdd(", vm.toString(uint256(a)),
                    ", ", vm.toString(uint256(b)), ") = ", vm.toString(result)
                ))
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //  TEST 4: Unauthorized ownership takeover must fail
    // ─────────────────────────────────────────────────────────────────
    function testFuzz_noUnauthorizedOwnerTakeover(address adversary) public {
        vm.assume(adversary != address(0) && adversary != address(this));

        (, bytes memory ob) = target.staticcall(abi.encodeWithSignature("owner()"));
        if (ob.length != 32) return;
        address originalOwner = abi.decode(ob, (address));

        vm.prank(adversary);
        target.call(abi.encodeWithSignature("setOwner(address)", adversary));
        vm.prank(adversary);
        target.call(abi.encodeWithSignature("transferOwnership(address)", adversary));

        (, bytes memory ob2) = target.staticcall(abi.encodeWithSignature("owner()"));
        if (ob2.length != 32) return;
        address newOwner = abi.decode(ob2, (address));

        if (adversary != originalOwner) {
            assertNotEq(
                newOwner,
                adversary,
                string(abi.encodePacked(
                    "ACCESS CONTROL: ", vm.toString(adversary),
                    " hijacked ownership from ", vm.toString(originalOwner)
                ))
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //  TEST 5: Deposit must increase contract ETH balance
    // ─────────────────────────────────────────────────────────────────
    function testFuzz_depositMonotonicity(uint96 amount) public {
        vm.assume(amount >= 1 && amount <= 10 ether);

        uint256 before = target.balance;
        (bool ok,) = target.call{value: amount}(abi.encodeWithSignature("deposit()"));
        if (!ok) return;

        assertGe(
            target.balance,
            before,
            "INVARIANT: contract ETH decreased after deposit"
        );
    }

    // ─────────────────────────────────────────────────────────────────
    //  TEST 6: Solvency — contract must hold >= recorded user balance
    // ─────────────────────────────────────────────────────────────────
    function testFuzz_solvencyInvariant(uint96 amount) public {
        vm.assume(amount >= 0.001 ether && amount <= 2 ether);

        (bool depOk,) = target.call{value: amount}(abi.encodeWithSignature("deposit()"));
        if (!depOk) return;

        (, bytes memory balBytes) = target.staticcall(
            abi.encodeWithSignature("balances(address)", address(this))
        );
        if (balBytes.length < 32) return;
        uint256 recorded = abi.decode(balBytes, (uint256));

        assertGe(
            target.balance,
            recorded,
            "SOLVENCY: contract ETH < recorded user balance — protocol insolvent"
        );
    }

    // ─────────────────────────────────────────────────────────────────
    //  TEST 7: selfdestruct / honeypot — withdraw reverts for non-owner
    // ─────────────────────────────────────────────────────────────────
    function testFuzz_withdrawNotLockedForUsers(uint96 depositAmount) public {
        vm.assume(depositAmount >= 0.001 ether && depositAmount <= 1 ether);

        address user = address(0xBEEF);
        vm.deal(user, depositAmount + 0.1 ether);
        vm.prank(user);
        (bool depOk,) = target.call{value: depositAmount}(abi.encodeWithSignature("deposit()"));
        if (!depOk) return;

        // User tries to withdraw their own funds
        vm.prank(user);
        (bool wdOk,) = target.call(
            abi.encodeWithSignature("withdraw(uint256)", uint256(depositAmount))
        );

        // If tx.origin guard is used, the withdraw will fail for normal users
        // Detect this as a honeypot pattern
        if (!wdOk) {
            // Check if owner CAN withdraw (asymmetric access = honeypot signal)
            address contractOwner;
            (, bytes memory ownerBytes) = target.staticcall(abi.encodeWithSignature("owner()"));
            if (ownerBytes.length == 32) {
                contractOwner = abi.decode(ownerBytes, (address));
                // Just log it — test doesn't hard-fail to avoid false positives
                // The static/honeypot agent will confirm this finding
                emit log_named_address("HONEYPOT SIGNAL: user withdraw failed, owner =", contractOwner);
            }
        }
    }

    ${tokenTests}
    ${lendingTests}

    receive()  external payable {}
    fallback() external payable {}
}

// ─────────────────────────────────────────────────────────────────────────────
//  ReentrancyAttacker — deployed in setUp
// ─────────────────────────────────────────────────────────────────────────────
contract ReentrancyAttacker {
    address payable immutable target;
    uint256 public withdrawAmount;
    uint256 public depth;
    uint256 constant MAX_DEPTH = 10;

    constructor(address payable _t) { target = _t; }

    function attack(uint256 _amount) external payable returns (bool) {
        withdrawAmount = _amount;
        depth          = 0;
        (bool dOk,) = target.call{value: msg.value}(abi.encodeWithSignature("deposit()"));
        if (!dOk) return false;
        (bool wOk,) = target.call(abi.encodeWithSignature("withdraw(uint256)", withdrawAmount));
        return wOk;
    }

    receive() external payable {
        if (depth < MAX_DEPTH && address(target).balance >= withdrawAmount) {
            depth++;
            target.call(abi.encodeWithSignature("withdraw(uint256)", withdrawAmount));
        }
    }

    fallback() external payable {}
}

${contractType === "lending" ? `
// ─────────────────────────────────────────────────────────────────────────────
//  BadFlashBorrower — never repays the flash loan
// ─────────────────────────────────────────────────────────────────────────────
contract BadFlashBorrower {
    // Receives ETH via flash loan callback but does NOT send it back
    receive() external payable {}
    fallback() external payable {}
}` : ""}
`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────────────────────────

async function runGenericFuzz(sourceCode) {
  const contractName = extractContractName(sourceCode) || "Target";
  const pragma       = extractPragma(sourceCode)       || "^0.8.0";
  const testSuite    = buildGenericTestSuite(contractName, pragma, sourceCode);

  try {
    const result = await runForgeTest(sourceCode, testSuite, { fuzzRuns: 512, timeout: 60_000 });

    if (result.compileError) {
      return {
        engine:         "foundry",
        forgeAvailable: true,
        compileError:   result.compileError,
        passed:         false,
        rawOutput:      result.rawOutput,
        tests:          [],
      };
    }

    return {
      engine:         "foundry",
      forgeAvailable: true,
      passed:         result.passed,
      rawOutput:      result.rawOutput,
      tests:          result.parsedTests,
    };
  } catch (err) {
    const notInstalled = /ENOENT|not found|not installed/i.test(err.message);
    return {
      engine:         "foundry",
      forgeAvailable: !notInstalled,
      error:          err.message,
      passed:         false,
      rawOutput:      err.message,
      tests:          staticFallback(sourceCode),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Static heuristic fallback
// ─────────────────────────────────────────────────────────────────────────────
function staticFallback(src) {
  const lc = stripComments(src).toLowerCase();
  return [
    {
      name:   "testFuzz_noReentrancyDrain",
      status: lc.includes(".call{") && !lc.includes("nonreentrant") ? "fail" : "pass",
      reason: lc.includes(".call{") && !lc.includes("nonreentrant")
        ? "Low-level .call{value} without reentrancy guard — static heuristic" : null,
      counterexample: null, gas: 0,
    },
    {
      name:   "testFuzz_arithmeticNoOverflow",
      status: lc.includes("unchecked") ? "fail" : "pass",
      reason: lc.includes("unchecked") ? "unchecked block — overflow possible" : null,
      counterexample: null, gas: 0,
    },
    {
      name:   "testFuzz_noUnauthorizedOwnerTakeover",
      status: lc.includes("setowner") && !lc.includes("onlyowner") ? "fail" : "pass",
      reason: lc.includes("setowner") && !lc.includes("onlyowner")
        ? "setOwner() lacks access control" : null,
      counterexample: null, gas: 0,
    },
    {
      name:   "testFuzz_withdrawNotLockedForUsers",
      status: (lc.includes("tx.origin") && lc.includes("withdraw")) ? "fail" : "pass",
      reason: (lc.includes("tx.origin") && lc.includes("withdraw"))
        ? "tx.origin guard on withdraw — honeypot signal" : null,
      counterexample: null, gas: 0,
    },
    {
      name:   "testFuzz_totalSupplyConsistentAfterTransfer",
      status: lc.includes("totalsupply") ? "warn" : "pass",
      reason: "forge not available — static check only",
      counterexample: null, gas: 0,
    },
  ];
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function extractContractName(src) { return stripComments(src).match(/\bcontract\s+(\w+)/)?.[1] ?? null; }
function extractPragma(src)       { return stripComments(src).match(/pragma\s+solidity\s+([^;]+);/)?.[1]?.trim() ?? null; }

module.exports = { runGenericFuzz };
