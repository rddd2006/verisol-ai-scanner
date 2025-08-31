import express from 'express';
import axios from 'axios';
import cors from 'cors';
import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { exec } from 'child_process';
import { promisify } from 'util';
import simpleGit from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- SETUP ---
const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json({ limit: '10mb' }));
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- HELPER FUNCTIONS ---

// 1. Static AI Analysis
async function getStaticAnalysis(sourceCode) {
    const prompt = `You are a world-class smart contract security auditor. Analyze the provided Solidity contract for vulnerabilities. Provide a response ONLY in a valid JSON format. The JSON object must have three keys: "riskScore" (string: "Low", "Medium", "High", or "Critical"), "summary" (string: a one-sentence summary), and "findings" (array of objects). Each finding object must have "title", "description", and "severity". Do not include any text, markdown, or apologies outside of the JSON object.`;
    const fullPrompt = prompt + "\n\nHere is the contract code:\n" + sourceCode;
    const result = await model.generateContent(fullPrompt);
    const responseText = await result.response.text();
    return JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
}

// 2. Honeypot Check
async function getDynamicAnalysis(address) {
    const fuzzingEnginePath = path.join(__dirname, '../fuzzing_engine');
    const command = `./honeypot_check.sh ${process.env.SEPOLIA_RPC_URL} ${address}`;
    const { stdout } = await execPromise(command, { cwd: path.join(__dirname) });
    return JSON.parse(stdout);
}

// 3. Generic Fuzzer with improved error handling
async function getGenericFuzzingAnalysis(address) {
    const fuzzingEnginePath = path.join(__dirname, '../fuzzing_engine');
    const command = `TARGET_CONTRACT=${address} forge test --fuzz-runs 256 --match-contract GenericFuzzer`;
    try {
        await execPromise(command, { cwd: fuzzingEnginePath });
        return { status: 'passed', reason: 'All generic invariants passed.' };
    } catch (error) {
        const errorLog = error.stdout || error.stderr;
        if (errorLog.includes("Compiler error") || errorLog.includes("compilation failed")) {
            return { status: 'incompatible', reason: 'Generic test suite was not compatible with this contract.' };
        }
        return { status: 'failed', reason: `Generic invariant violated. Details: ${errorLog}` };
    }
}

// 4. Get ABI for AI Fuzzer
async function getContractAbi(address) {
    const response = await axios.get(`https://api-sepolia.etherscan.io/api?module=contract&action=getabi&address=${address}&apikey=${process.env.ETHERSCAN_API_KEY}`);
    if (response.data.status === "0") {
        throw new Error("ABI not found for this contract.");
    }
    return response.data.result;
}

// 5. AI generates test code
async function generateFuzzTest(abi) {
    const prompt = `You are an expert smart contract security engineer specializing in writing Foundry fuzz tests. Analyze the functions in the provided ABI and write a complete, ready-to-run Foundry test file (\`.t.sol\`) that implements critical fuzz tests for state-changing functions. The test contract should be named "AIGeneratedFuzzer". Focus on invariants for functions involving value transfers, minting/burning, or critical parameter changes.`;
    const fullPrompt = prompt + "\n\nHere is the ABI:\n" + abi;
    const result = await model.generateContent(fullPrompt);
    const responseText = await result.response.text();
    const match = responseText.match(/```solidity([\s\S]*?)```/);
    if (!match || !match[1]) {
        throw new Error("AI failed to generate a valid Solidity code block. Response was: " + responseText);
    }
    return match[1].trim();
}

// 6. Run AI-generated test with improved error handling
async function runAIGeneratedFuzzer(address, testCode) {
    const fuzzingEnginePath = path.join(__dirname, '../fuzzing_engine');
    const testFilePath = path.join(fuzzingEnginePath, 'test/AIGeneratedFuzzer.t.sol');
    await fs.writeFile(testFilePath, testCode);
    const command = `TARGET_CONTRACT=${address} forge test --match-path test/AIGeneratedFuzzer.t.sol --fuzz-runs 256`;
    try {
        const { stdout } = await execPromise(command, { cwd: fuzzingEnginePath });
        return { status: 'passed', log: stdout };
    } catch (error) {
        const errorLog = error.stdout || error.stderr;
        if (errorLog.includes("Compiler error") || errorLog.includes("compilation failed")) {
            return { status: 'incompatible', log: 'AI-generated test was not compatible or failed to compile.' };
        }
        return { status: 'failed', log: errorLog };
    }
}

// 7. AI interprets failure log
async function interpretFuzzFailure(log) {
    const prompt = `You are an expert smart contract security analyst. I will provide you with a failed test log from a Foundry fuzz test. Read the log, identify the function that failed and the specific inputs (the "counterexample") that caused the failure. Explain the likely security vulnerability in simple, clear English.`;
    const fullPrompt = prompt + "\n\nHere is the failed test log:\n" + log;
    const result = await model.generateContent(fullPrompt);
    return await result.response.text();
}

// 8. GitHub Repo Analysis
async function analyzeGitHubRepo(repoUrl) {
    const tempDir = path.join(__dirname, 'temp_repo');
    await fs.remove(tempDir);
    await fs.ensureDir(tempDir);
    await simpleGit().clone(repoUrl, tempDir, ['--depth', '1']);
    const findings = [];
    const files = await findSolidityFiles(tempDir);
    const BATCH_SIZE = 5;
    const DELAY_MS = 2000;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        await Promise.all(
            batch.map(async (filePath) => {
                try {
                    const fileContent = await fs.readFile(filePath, 'utf-8');
                    if (fileContent.trim().length < 50) return;
                    const staticResult = await getStaticAnalysis(fileContent);
                    findings.push({ file: path.relative(tempDir, filePath), analysis: staticResult });
                } catch (error) { console.error(`Skipping analysis for ${path.relative(tempDir, filePath)}.`); }
            })
        );
        if (i + BATCH_SIZE < files.length) {
            await new Promise(res => setTimeout(res, DELAY_MS));
        }
    }
    await fs.remove(tempDir);
    return findings;
}

// 9. File Finder
async function findSolidityFiles(startPath) {
    let result = [];
    try {
        const files = await fs.readdir(startPath);
        for (const file of files) {
            const filename = path.join(startPath, file);
            const stat = await fs.lstat(filename);
            if (stat.isDirectory()) {
                result = result.concat(await findSolidityFiles(filename));
            } else if (filename.endsWith('.sol')) {
                result.push(filename);
            }
        }
    } catch (error) { console.error(`Could not read directory ${startPath}: `, error); }
    return result;
}


// --- UNIFIED API ENDPOINT ---
app.post('/analyze', async (req, res) => {
    try {
        const { inputType, input } = req.body;
        if (!inputType || !input) return res.status(400).json({ error: 'Input type and value are required.' });

        let finalReport = {};

        switch (inputType) {
            case 'address':
                const sourceCodeResponse = await axios.get(`https://api-sepolia.etherscan.io/api?module=contract&action=getsourcecode&address=${input}&apikey=${process.env.ETHERSCAN_API_KEY}`);
                const sourceCode = sourceCodeResponse.data.result[0].SourceCode;
                if (!sourceCode) throw new Error('Source code not found.');
                const abi = await getContractAbi(input);
                const [staticResult, dynamicResult, genericFuzzResult] = await Promise.allSettled([
                    getStaticAnalysis(sourceCode),
                    getDynamicAnalysis(input),
                    getGenericFuzzingAnalysis(input)
                ]);
                let aiFuzzing;
                try {
                    const testCode = await generateFuzzTest(abi);
                    const fuzzerOutput = await runAIGeneratedFuzzer(input, testCode);
                    if (fuzzerOutput.status === 'failed') {
                        const interpretation = await interpretFuzzFailure(fuzzerOutput.log);
                        aiFuzzing = { status: 'failed', reason: interpretation };
                    } else {
                        aiFuzzing = { status: fuzzerOutput.status, reason: fuzzerOutput.log };
                    }
                } catch (err) {
                    aiFuzzing = { status: 'incompatible', reason: 'AI-driven fuzzing process failed to run.' };
                }
                finalReport = {
                    reportType: 'address',
                    staticAnalysis: staticResult.status === 'fulfilled' ? staticResult.value : null,
                    dynamicAnalysis: dynamicResult.status === 'fulfilled' ? dynamicResult.value : { isHoneypot: false, reason: 'Honeypot check failed.' },
                    genericFuzzing: genericFuzzResult.status === 'fulfilled' ? genericFuzzResult.value : { status: 'incompatible', reason: 'Generic fuzzing failed.' },
                    aiFuzzing: aiFuzzing
                };
                break;

            case 'github':
                 const repoResults = await analyzeGitHubRepo(input);
                 finalReport = { reportType: 'repo', files: repoResults };
                 break;
            case 'text':
                 const textResult = await getStaticAnalysis(input);
                 finalReport = { reportType: 'text', files: [{ file: 'PastedCode.sol', analysis: textResult }] };
                 break;
            default:
                return res.status(400).json({ error: 'Invalid input type.' });
        }
        res.json(finalReport);
    } catch (error) {
        console.error('Analysis failed:', error.message);
        res.status(500).json({ error: 'Failed to complete analysis. Please check your input.' });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));