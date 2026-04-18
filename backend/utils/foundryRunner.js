/**
 * foundryRunner.js
 *
 * Bootstraps a self-contained Foundry project in a temp directory,
 * compiles the target contract alongside a test file, executes
 * `forge test --json` and returns structured results.
 *
 * Prerequisites:
 *   forge  — install via:  curl -L https://foundry.paradigm.xyz | bash && foundryup
 */

"use strict";

const { spawn, execFileSync } = require("child_process");
const fs   = require("fs-extra");
const path = require("path");
const os   = require("os");

const FORGE     = process.env.FOUNDRY_PATH || "forge";
const TEMP_ROOT = process.env.TEMP_DIR     || path.join(os.tmpdir(), "verisol");

// ── Minimal forge-std/Test.sol stub ──────────────────────────────────────
// Used when `forge install` cannot reach github (air-gapped / CI).
const FORGE_STD_STUB = `// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

interface Vm {
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function deal(address who, uint256 newBalance) external;
    function assume(bool condition) external pure;
    function expectRevert() external;
    function expectRevert(bytes calldata revertData) external;
    function warp(uint256 timestamp) external;
    function roll(uint256 blockNumber) external;
    function label(address addr_, string calldata lbl) external;
    function getCode(string calldata artifactPath) external returns (bytes memory bytecode);
    function toString(uint256 value) external pure returns (string memory);
    function toString(address value) external pure returns (string memory);
    function toString(bool value) external pure returns (string memory);
}

contract Test {
    Vm internal constant vm =
        Vm(address(bytes20(uint160(uint256(keccak256("hevm cheat code"))))));

    event log(string);
    event log_named_uint(string, uint256);
    event log_named_address(string, address);

    function fail() internal virtual {
        revert("assertion failed");
    }

    function assertTrue(bool c) internal virtual {
        if (!c) { emit log("assertTrue: false"); fail(); }
    }
    function assertTrue(bool c, string memory err) internal virtual {
        if (!c) { emit log(err); fail(); }
    }
    function assertFalse(bool c) internal virtual {
        assertTrue(!c);
    }
    function assertFalse(bool c, string memory err) internal virtual {
        assertTrue(!c, err);
    }
    function assertEq(uint256 a, uint256 b) internal virtual {
        if (a != b) {
            emit log_named_uint("Expected", b);
            emit log_named_uint("Actual  ", a);
            fail();
        }
    }
    function assertEq(uint256 a, uint256 b, string memory err) internal virtual {
        if (a != b) { emit log(err); fail(); }
    }
    function assertEq(address a, address b) internal virtual {
        if (a != b) {
            emit log_named_address("Expected", b);
            emit log_named_address("Actual  ", a);
            fail();
        }
    }
    function assertNotEq(address a, address b) internal virtual {
        if (a == b) { emit log("assertNotEq(address): equal"); fail(); }
    }
    function assertNotEq(address a, address b, string memory err) internal virtual {
        if (a == b) { emit log(err); fail(); }
    }
    function assertGt(uint256 a, uint256 b) internal virtual {
        if (a <= b) { emit log("assertGt: a <= b"); fail(); }
    }
    function assertGt(uint256 a, uint256 b, string memory err) internal virtual {
        if (a <= b) { emit log(err); fail(); }
    }
    function assertLt(uint256 a, uint256 b) internal virtual {
        if (a >= b) { emit log("assertLt: a >= b"); fail(); }
    }
    function assertLt(uint256 a, uint256 b, string memory err) internal virtual {
        if (a >= b) { emit log(err); fail(); }
    }
    function assertGe(uint256 a, uint256 b) internal virtual {
        if (a < b) { emit log("assertGe: a < b"); fail(); }
    }
    function assertGe(uint256 a, uint256 b, string memory err) internal virtual {
        if (a < b) { emit log(err); fail(); }
    }
    function assertLe(uint256 a, uint256 b) internal virtual {
        if (a > b) { emit log("assertLe: a > b"); fail(); }
    }
    function assertLe(uint256 a, uint256 b, string memory err) internal virtual {
        if (a > b) { emit log(err); fail(); }
    }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} TestResult
 * @property {string}      name
 * @property {"pass"|"fail"|"warn"} status
 * @property {string|null} reason          failure message / revert reason
 * @property {string|null} counterexample  fuzz counterexample string
 * @property {number}      gas
 */

/**
 * @typedef {Object} ForgeRunResult
 * @property {boolean}      passed
 * @property {string}       rawOutput
 * @property {TestResult[]} parsedTests
 * @property {string|null}  compileError
 */

/**
 * Compile and run a fuzz test suite inside a fresh Foundry project.
 *
 * @param {string} contractSource  Solidity source of the contract under test
 * @param {string} testSource      Solidity source of the fuzz test file
 * @param {{ fuzzRuns?: number, timeout?: number }} [opts]
 * @returns {Promise<ForgeRunResult>}
 */
async function runForgeTest(contractSource, testSource, opts = {}) {
  const { fuzzRuns = 512, timeout = 90_000 } = opts;

  // ── 0. Gate: forge must be in PATH ──────────────────────────────────
  await assertForgeAvailable();

  // ── 1. Create temp workspace ─────────────────────────────────────────
  await fs.ensureDir(TEMP_ROOT);
  const tmpDir = await fs.mkdtemp(path.join(TEMP_ROOT, "forge_"));

  try {
    await buildProject(tmpDir, contractSource, testSource, fuzzRuns);
  } catch (err) {
    await cleanup(tmpDir);
    throw err;
  }

  // ── 2. Compile (separate step gives cleaner error messages) ──────────
  const buildOut = await spawnForge(tmpDir, ["build", "--silent"], 30_000);
  if (buildOut.code !== 0) {
    const compileError = extractCompileError(buildOut.stderr + buildOut.stdout);
    await cleanup(tmpDir);
    return { passed: false, rawOutput: compileError, parsedTests: [], compileError };
  }

  // ── 3. Run tests ─────────────────────────────────────────────────────
  const testArgs = [
    "test",
    "--json",
    "-vvv",
    "--fuzz-runs", String(fuzzRuns),
    "--no-match-test", "SKIP_THIS_PLACEHOLDER",
  ];

  const testOut = await spawnForge(tmpDir, testArgs, timeout);
  const rawOutput = (testOut.stdout + "\n" + testOut.stderr).trim();
  const parsedTests = parseForgeOutput(rawOutput);

  await cleanup(tmpDir);

  return {
    passed:       testOut.code === 0,
    rawOutput:    rawOutput.substring(0, 10_000),
    parsedTests,
    compileError: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Project builder
// ─────────────────────────────────────────────────────────────────────────────

async function buildProject(tmpDir, contractSource, testSource, fuzzRuns) {
  await fs.ensureDir(path.join(tmpDir, "src"));
  await fs.ensureDir(path.join(tmpDir, "test"));
  await fs.ensureDir(path.join(tmpDir, "lib", "forge-std", "src"));

  // foundry.toml
  await fs.writeFile(path.join(tmpDir, "foundry.toml"), makeFoundryToml(fuzzRuns));

  // forge-std: try real install first, fall back to stub
  const installed = await tryInstallForgeStd(tmpDir);
  if (!installed) {
    // Write minimal stub so imports resolve
    await fs.writeFile(
      path.join(tmpDir, "lib", "forge-std", "src", "Test.sol"),
      FORGE_STD_STUB
    );
  }

  // Target contract
  await fs.writeFile(
    path.join(tmpDir, "src", "Target.sol"),
    prepareContract(contractSource)
  );

  // Fuzz test — normalise the forge-std import
  await fs.writeFile(
    path.join(tmpDir, "test", "Fuzz.t.sol"),
    normaliseTestImport(testSource)
  );
}

function makeFoundryToml(fuzzRuns) {
  return `[profile.default]
src  = "src"
out  = "out"
libs = ["lib"]
remappings = [
    "forge-std/=lib/forge-std/src/"
]

[fuzz]
runs             = ${fuzzRuns}
max_test_rejects = 131072
seed             = "0xc0ffee42"
dictionary_weight = 40

[invariant]
runs  = ${Math.min(fuzzRuns, 256)}
depth = 20
`;
}

/**
 * Attempt `forge install foundry-rs/forge-std --no-commit` in tmpDir.
 * Returns true if git + network are available and install succeeded.
 */
async function tryInstallForgeStd(tmpDir) {
  // Need git for forge install
  try { execFileSync("git", ["--version"], { stdio: "pipe" }); }
  catch { return false; }

  // Initialise a bare git repo so forge install works
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: tmpDir, stdio: "pipe" });
  } catch { return false; }

  const r = await spawnForge(
    tmpDir,
    ["install", "foundry-rs/forge-std", "--no-commit"],
    40_000
  );
  return r.code === 0;
}

/** Ensure the pragma is compatible and strip multi-file GitHub blobs */
function prepareContract(source) {
  if (source.startsWith("[GITHUB:") || source.startsWith("[ADDRESS:")) {
    return "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\ncontract Stub {}";
  }
  return source;
}

/** Normalise any forge-std import path to match our remapping */
function normaliseTestImport(src) {
  return src
    .replace(/import\s+"[^"]*\/forge-std\/[^"]*"/g, 'import "forge-std/Test.sol"')
    .replace(/import\s+'[^']*\/forge-std\/[^']*'/g, "import 'forge-std/Test.sol'");
}

// ─────────────────────────────────────────────────────────────────────────────
//  Output parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse `forge test --json` output.
 *
 * forge emits one JSON object per test-file, as a newline-delimited stream:
 *   {"path/Fuzz.t.sol:ContractName": {"test_results": {"testFuzz_foo": {...}}}}
 *
 * Older forge versions use `{"tests": {...}}` directly; we handle both.
 */
function parseForgeOutput(raw) {
  const results = [];

  // ── JSON mode ────────────────────────────────────────────────────────
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const top = JSON.parse(trimmed);
      for (const suiteData of Object.values(top)) {
        const testMap =
          suiteData?.test_results ??
          suiteData?.tests ??
          (typeof suiteData === "object" ? suiteData : {});

        for (const [name, data] of Object.entries(testMap)) {
          if (typeof data !== "object") continue;
          results.push(parseOneTest(name, data));
        }
      }
    } catch { /* not JSON */ }
  }
  if (results.length) return results;

  // ── Text / verbose fallback ──────────────────────────────────────────
  const passRe = /\[PASS\]\s+(testFuzz_\w+|\w+)\s*\(/gm;
  const failRe = /\[FAIL(?:\.\s*Reason:\s*([^\]]+))?\]\s+(testFuzz_\w+|\w+)\s*\(/gm;
  let m;

  while ((m = passRe.exec(raw)) !== null) {
    results.push({ name: m[1], status: "pass", reason: null, counterexample: null, gas: 0 });
  }
  while ((m = failRe.exec(raw)) !== null) {
    results.push({
      name:           m[2],
      status:         "fail",
      reason:         m[1]?.trim() ?? null,
      counterexample: null,
      gas:            0,
    });
  }

  // Attach counterexamples to failures
  const ceRe = /Counterexample:\s*\[([^\]]+)\]/gm;
  const failures = results.filter((r) => r.status === "fail");
  let ci = 0;
  while ((m = ceRe.exec(raw)) !== null && ci < failures.length) {
    failures[ci++].counterexample = m[1].trim();
  }

  return results;
}

function parseOneTest(name, data) {
  // Handle both `{status: "Success"}` and `{success: true}` schemas
  const passed =
    data.status === "Success" ||
    data.status === "success" ||
    data.success === true;

  const reason =
    data.reason ??
    data.failure_reason ??
    (data.decoded_logs?.find((l) => l.includes("failed") || l.includes("Error")) ?? null);

  let counterexample = null;
  if (data.counterexample != null) {
    counterexample =
      typeof data.counterexample === "string"
        ? data.counterexample
        : JSON.stringify(data.counterexample, null, 2);
  }

  return {
    name,
    status:         passed ? "pass" : "fail",
    reason:         typeof reason === "string" ? reason.substring(0, 400) : null,
    counterexample: counterexample?.substring(0, 600) ?? null,
    gas:            data.gas ?? data.gasUsed ?? 0,
  };
}

function extractCompileError(raw) {
  return raw
    .split("\n")
    .filter((l) => /error|Error|warning/i.test(l))
    .join("\n")
    .substring(0, 2000) || raw.substring(0, 2000);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Process helpers
// ─────────────────────────────────────────────────────────────────────────────

function spawnForge(cwd, args, timeoutMs) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";

    const proc = spawn(FORGE, args, {
      cwd,
      env: {
        ...process.env,
        FOUNDRY_DISABLE_NIGHTLY_WARNING: "1",
        RUST_BACKTRACE: "0",
        HOME: process.env.HOME || os.homedir(),
      },
      shell: false,
    });

    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ code: 124, stdout, stderr: `${stderr}\n[forge timed out after ${timeoutMs}ms]` });
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      // ENOENT = forge not found
      const msg = err.code === "ENOENT"
        ? `forge not found at "${FORGE}". Install Foundry: curl -L https://foundry.paradigm.xyz | bash && foundryup`
        : err.message;
      resolve({ code: 1, stdout, stderr: msg });
    });
  });
}

async function assertForgeAvailable() {
  return new Promise((resolve, reject) => {
    const proc = spawn(FORGE, ["--version"], { stdio: "pipe" });
    let version = "";
    proc.stdout.on("data", (d) => (version += d));
    proc.on("close", (code) => {
      if (code === 0) resolve(version.trim());
      else reject(new Error(`forge exited with code ${code}`));
    });
    proc.on("error", () =>
      reject(new Error(
        `Foundry (forge) is not installed or not in PATH.\n` +
        `Install:  curl -L https://foundry.paradigm.xyz | bash && foundryup\n` +
        `Or set FOUNDRY_PATH=/path/to/forge in backend/.env`
      ))
    );
  });
}

async function cleanup(dir) {
  try { await fs.remove(dir); } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Exports
// ─────────────────────────────────────────────────────────────────────────────
// No-op export — kept for server.js import compatibility
async function ensureForgeStd() { /* forge-std installed per-run in buildProject() */ }

module.exports = { runForgeTest, ensureForgeStd };
