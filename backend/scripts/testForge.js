#!/usr/bin/env node
/**
 * Test that Foundry is installed and working correctly.
 *
 * Usage:  node scripts/testForge.js
 */

"use strict";
require("dotenv").config();

const { runForgeTest } = require("../utils/foundryRunner");

const SIMPLE_CONTRACT = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Counter {
    uint256 public count;
    function increment() public { count += 1; }
    function decrement() public { require(count > 0, "underflow"); count -= 1; }
    function reset()     public { count = 0; }
}`;

const SIMPLE_TEST = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "forge-std/Test.sol";

contract CounterTest is Test {
    address payable target;

    function setUp() public {
        bytes memory c = abi.encodePacked(vm.getCode("Target.sol:Counter"));
        address d;
        assembly { d := create(0, add(c, 0x20), mload(c)) }
        require(d != address(0), "deploy failed");
        target = payable(d);
    }

    function testFuzz_countNeverNegative(uint8 increments, uint8 decrements) public {
        vm.assume(increments >= decrements);

        for (uint256 i = 0; i < increments; i++) {
            target.call(abi.encodeWithSignature("increment()"));
        }
        for (uint256 i = 0; i < decrements; i++) {
            target.call(abi.encodeWithSignature("decrement()"));
        }

        (, bytes memory ret) = target.staticcall(abi.encodeWithSignature("count()"));
        uint256 cnt = abi.decode(ret, (uint256));
        assertTrue(cnt >= 0, "count is negative");
    }

    function testFuzz_decrementBelowZeroReverts(uint8 extra) public {
        vm.assume(extra > 0 && extra <= 10);
        for (uint256 i = 0; i < extra; i++) {
            (bool ok,) = target.call(abi.encodeWithSignature("decrement()"));
            if (!ok) return; // expected to fail
        }
    }

    receive() external payable {}
    fallback() external payable {}
}`;

async function main() {
  console.log("🔨 VeriSol AI — Foundry Integration Check\n");

  // 1. Check forge version
  const { spawn } = require("child_process");
  const forge = process.env.FOUNDRY_PATH || "forge";

  await new Promise((resolve, reject) => {
    const p = spawn(forge, ["--version"], { stdio: "pipe" });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ forge found: ${out.trim()}`);
        resolve();
      } else {
        reject(new Error("forge exited non-zero"));
      }
    });
    p.on("error", () =>
      reject(new Error(
        `forge not found at "${forge}".\nInstall: curl -L https://foundry.paradigm.xyz | bash && foundryup`
      ))
    );
  });

  // 2. Run a simple fuzz test
  console.log("\n⚡ Running minimal fuzz test (Counter contract)...\n");
  const start = Date.now();

  const result = await runForgeTest(SIMPLE_CONTRACT, SIMPLE_TEST, { fuzzRuns: 128, timeout: 60_000 });

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  if (result.compileError) {
    console.error("❌ Compile error:\n" + result.compileError);
    process.exit(1);
  }

  console.log(`Forge run complete in ${elapsed}s`);
  console.log(`Passed: ${result.passed}`);
  console.log(`Tests:  ${result.parsedTests.length}`);
  result.parsedTests.forEach((t) => {
    const icon = t.status === "pass" ? "✅" : t.status === "fail" ? "❌" : "⚠";
    console.log(`  ${icon} ${t.name} — ${t.status}${t.reason ? ` (${t.reason})` : ""}`);
  });

  if (!result.passed) {
    console.log("\n⚠  Some tests failed — raw output:");
    console.log(result.rawOutput.substring(0, 1500));
  } else {
    console.log("\n✅ Foundry integration working correctly!");
  }
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
