const axios = require("axios");
const simpleGit = require("simple-git");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

const ETHERSCAN_BASE = "https://api-sepolia.etherscan.io/api";

/**
 * Fetches Solidity source code from multiple input types.
 * @param {"code"|"address"|"github"} inputType
 * @param {string} value
 * @returns {{ source: string, name: string }}
 */
async function fetchSource(inputType, value) {
  switch (inputType) {
    case "code":
      return { source: value, name: extractContractName(value) };

    case "address":
      return await fetchFromEtherscan(value);

    case "github":
      return await fetchFromGitHub(value);

    default:
      throw new Error(`Unknown inputType: ${inputType}`);
  }
}

// ── Etherscan ──────────────────────────────────────────────────────────────
async function fetchFromEtherscan(address) {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) throw new Error("ETHERSCAN_API_KEY is not set in .env");

  const url = `${ETHERSCAN_BASE}?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
  const { data } = await axios.get(url, { timeout: 10000 });

  if (data.status !== "1") {
    throw new Error(`Etherscan error: ${data.result || data.message}`);
  }

  const result = data.result[0];
  if (!result.SourceCode || result.SourceCode === "") {
    throw new Error("Contract source code is not verified on Etherscan.");
  }

  // Handle multi-file Etherscan responses (wrapped JSON)
  let source = result.SourceCode;
  if (source.startsWith("{{")) {
    // Flatten all files into one string
    try {
      const parsed = JSON.parse(source.slice(1, -1));
      const files = parsed.sources || parsed;
      source = Object.values(files)
        .map((f) => (typeof f === "string" ? f : f.content))
        .join("\n\n");
    } catch {
      // Fall through with raw source
    }
  }

  return { source, name: result.ContractName || "Unknown" };
}

// ── GitHub ─────────────────────────────────────────────────────────────────
async function fetchFromGitHub(repoUrl) {
  // Normalize URL
  const url = repoUrl.replace(/\.git$/, "").trim();

  const tmpDir = path.join(
    process.env.TEMP_DIR || os.tmpdir(),
    "verisol_git_" + Date.now()
  );

  try {
    await fs.ensureDir(tmpDir);
    const git = simpleGit();
    await git.clone(url, tmpDir, ["--depth", "1"]);

    // Find all .sol files
    const solFiles = await findSolFiles(tmpDir);
    if (solFiles.length === 0) {
      throw new Error("No Solidity (.sol) files found in repository.");
    }

    // Concatenate all .sol files (excluding node_modules / lib)
    const sources = await Promise.all(
      solFiles
        .filter((f) => !f.includes("node_modules") && !f.includes("/lib/"))
        .slice(0, 20) // cap at 20 files
        .map((f) => fs.readFile(f, "utf8"))
    );

    const combined = sources.join("\n\n// ─── Next File ───\n\n");
    const name = path.basename(url);
    return { source: combined, name };
  } finally {
    await fs.remove(tmpDir).catch(() => {});
  }
}

async function findSolFiles(dir) {
  const results = [];

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".sol")) {
        results.push(full);
      }
    }
  }

  await walk(dir);
  return results;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function extractContractName(source) {
  const match = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .match(/contract\s+(\w+)/);
  return match ? match[1] : "Unknown";
}

module.exports = { fetchSource };
