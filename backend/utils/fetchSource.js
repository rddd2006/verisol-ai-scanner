const axios = require("axios");
const simpleGit = require("simple-git");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

const ETHERSCAN_BASE = "https://api.etherscan.io/v2/api";
const DEFAULT_ETHERSCAN_CHAIN_ID = process.env.ETHERSCAN_CHAIN_ID || "11155111";

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

  const { data } = await axios.get(ETHERSCAN_BASE, {
    timeout: 10000,
    params: {
      chainid: DEFAULT_ETHERSCAN_CHAIN_ID,
      module: "contract",
      action: "getsourcecode",
      address,
      apikey: apiKey,
    },
  });

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
    
    // Clone with timeout (30 seconds) and shallow copy
    await Promise.race([
      git.clone(url, tmpDir, ["--depth", "1", "--single-branch"]),
      new Promise((_, rej) => 
        setTimeout(() => rej(new Error("GitHub clone timed out after 30s")), 30000)
      ),
    ]);

    // Find all .sol files with exclusions and size limits
    const solFiles = await findSolFiles(tmpDir);
    if (solFiles.length === 0) {
      throw new Error("No Solidity (.sol) files found in repository.");
    }

    // Filter: exclude common dependency dirs and limit file size
    const filteredFiles = solFiles
      .filter(f => {
        const rel = path.relative(tmpDir, f).toLowerCase();
        // Skip dependency directories
        const exclusions = ["node_modules", "/lib/", "lib/", ".github", ".git", ".cache", "build/", "dist/"];
        return !exclusions.some(ex => rel.includes(ex.toLowerCase()));
      })
      .slice(0, 25); // cap at 25 files

    // Read files with size check (max 5MB per file, 50MB total)
    const fileObjects = [];
    let totalSize = 0;
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB

    for (const file of filteredFiles) {
      if (totalSize >= MAX_TOTAL_SIZE) break;
      
      const stat = await fs.stat(file);
      if (stat.size > MAX_FILE_SIZE) continue; // skip huge files
      
      const content = await fs.readFile(file, "utf8");
      const relPath = path.relative(tmpDir, file);
      const isMainContract = isMainContractFile(content, relPath);
      
      totalSize += content.length;
      fileObjects.push({
        path: relPath,
        content,
        size: content.length,
        isMainContract, // prioritize these in analysis
        contractNames: extractContractNames(content),
      });
    }

    if (fileObjects.length === 0) {
      throw new Error("No analyzable Solidity files found (files too large or all excluded).");
    }

    // Sort: main contracts first, then by size (smaller = simpler = faster to analyze)
    fileObjects.sort((a, b) => {
      if (a.isMainContract !== b.isMainContract) {
        return b.isMainContract ? 1 : -1;
      }
      return a.size - b.size;
    });

    // Build combined source with clear file separators and metadata
    const combined = fileObjects
      .map((f, i) => `// ═══════════════════════════════════\n// FILE ${i + 1}/${fileObjects.length}: ${f.path}\n// Contracts: ${f.contractNames.join(", ") || "none"}\n// ═══════════════════════════════════\n${f.content}`)
      .join("\n\n");

    const name = path.basename(url);
    
    return {
      source: combined,
      name,
      files: fileObjects, // Include file metadata for per-file analysis
      fileCount: fileObjects.length,
      totalSize,
    };
  } finally {
    await fs.remove(tmpDir).catch(() => {});
  }
}

async function findSolFiles(dir) {
  const results = [];
  const MAX_FILES = 100; // stop early if we find too many
  
  // Directories to skip entirely
  const SKIP_DIRS = new Set([
    "node_modules", ".git", ".github", "lib", "build", "dist", "target",
    ".cache", ".next", ".venv", "venv", "__pycache__", ".gradle"
  ]);

  async function walk(current) {
    if (results.length >= MAX_FILES) return; // early exit
    
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= MAX_FILES) return;
      
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        // Skip excluded directories entirely
        if (!SKIP_DIRS.has(entry.name)) {
          await walk(full);
        }
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

/**
 * Extract all contract/interface/library names from a file
 */
function extractContractNames(source) {
  const names = [];
  const cleaned = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  
  // Find contracts, interfaces, libraries
  const regex = /(?:contract|interface|library|abstract\s+contract)\s+(\w+)/g;
  let match;
  while ((match = regex.exec(cleaned)) !== null) {
    names.push(match[1]);
  }
  
  return [...new Set(names)]; // deduplicate
}

/**
 * Determine if a file contains main contracts (not just imports/interfaces)
 * Main contracts are likely in src/, contracts/, or at repo root
 */
function isMainContractFile(content, relPath) {
  const isUtilsOrLibs = /\/(utils|libraries|lib|test|mock)\//i.test(relPath);
  if (isUtilsOrLibs) return false;
  
  const hasConcreteContract = /contract\s+\w+\s*(?:is|{)/i.test(content);
  const hasInterfaces = /interface\s+\w+/i.test(content);
  const hasImplementation = /function\s+\w+.*{[\s\S]*?}/i.test(content);
  
  // Main if: has concrete contract + implementation, not just interfaces
  return hasConcreteContract && hasImplementation && !isUtilsOrLibs;
}

module.exports = { fetchSource };
