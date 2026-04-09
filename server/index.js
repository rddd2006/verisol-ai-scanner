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
import crypto from 'crypto';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- SETUP ---
const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname)); // Serve static files

// Validate environment variables
if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️  WARNING: GEMINI_API_KEY not set. AI analysis will fail.');
}
if (!process.env.ETHERSCAN_API_KEY) {
    console.warn('⚠️  WARNING: ETHERSCAN_API_KEY not set. Contract fetching will fail.');
}
if (!process.env.SEPOLIA_RPC_URL) {
    console.warn('⚠️  WARNING: SEPOLIA_RPC_URL not set. Honeypot check will fail.');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- UTILITY FUNCTIONS ---

// Validate Ethereum address format
function isValidEthereumAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Validate GitHub URL format
function isValidGitHubUrl(url) {
    return /^https:\/\/github\.com\/[\w-]+\/[\w\-.]+$/.test(url) || 
           /^https:\/\/github\.com\/[\w-]+\/[\w\-.]+\.git$/.test(url);
}

// Generate unique identifier for concurrent requests
function generateRequestId() {
    return crypto.randomBytes(8).toString('hex');
}

// --- HELPER FUNCTIONS ---

// 1. Static AI Analysis
async function getStaticAnalysis(sourceCode) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return { error: 'Gemini API key not configured' };
        }
        
        const prompt = `You are a world-class smart contract security auditor. Analyze the provided Solidity contract for vulnerabilities. Provide a response ONLY in a valid JSON format. The JSON object must have three keys: "riskScore" (string: "Low", "Medium", "High", or "Critical"), "summary" (string: a one-sentence summary), and "findings" (array of objects). Each finding object must have "title", "description", and "severity". Do not include any text, markdown, or apologies outside of the JSON object.`;
        const fullPrompt = prompt + "\n\nHere is the contract code:\n" + sourceCode;
        const result = await model.generateContent(fullPrompt);
        const responseText = await result.response.text();
        const parsed = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
        return parsed;
    } catch (error) {
        console.error('Static analysis error:', error.message);
        return { 
            riskScore: 'Unknown', 
            summary: 'Could not analyze contract', 
            findings: [{ title: 'Analysis Error', description: error.message, severity: 'Info' }] 
        };
    }
}

// 2. Honeypot Check
async function getDynamicAnalysis(address) {
    try {
        if (!process.env.SEPOLIA_RPC_URL) {
            return { isHoneypot: false, reason: 'RPC URL not configured' };
        }

        const honeypotScriptPath = path.join(__dirname, 'honeypot_check.sh');
        const command = `bash ${honeypotScriptPath} ${process.env.SEPOLIA_RPC_URL} ${address}`;
        
        try {
            const { stdout } = await execPromise(command, { timeout: 30000 });
            return JSON.parse(stdout.trim());
        } catch (execError) {
            console.error('Honeypot check failed:', execError.message);
            return { isHoneypot: false, reason: 'Honeypot check not available' };
        }
    } catch (error) {
        console.error('Dynamic analysis error:', error.message);
        return { isHoneypot: false, reason: `Dynamic analysis failed: ${error.message}` };
    }
}

// 3. Generic Fuzzer
async function getGenericFuzzingAnalysis(address) {
    try {
        const fuzzingEnginePath = path.join(__dirname, '../fuzzing_engine');
        const command = `TARGET_CONTRACT=${address} forge test --fuzz-runs 128 --match-contract GenericFuzzer 2>&1`;
        
        try {
            const { stdout, stderr } = await execPromise(command, { cwd: fuzzingEnginePath, timeout: 45000, maxBuffer: 10 * 1024 * 1024 });
            const output = stdout + stderr;
            
            if (output.includes('passed') || output.includes('Ran')) {
                return { status: 'passed', reason: 'All generic invariants passed.' };
            } else {
                return { status: 'failed', reason: 'Generic fuzzing detected issues' };
            }
        } catch (execError) {
            // Handle timeout specifically
            if (execError.killed || execError.signal === 'SIGTERM') {
                return { status: 'timeout', reason: 'Generic fuzzing took too long - skipping' };
            }
            
            const output = (execError.stdout || '') + (execError.stderr || '');
            
            if (output.includes('No contracts to fuzz')) {
                return { status: 'incompatible', reason: 'Contract not compatible with generic fuzzer' };
            }
            if (output.includes('compilation failed') || output.includes('Compiler')) {
                return { status: 'incompatible', reason: 'Generic test compilation failed' };
            }
            
            return { status: 'failed', reason: 'Generic fuzzing detected potential vulnerabilities' };
        }
    } catch (error) {
        console.error('Generic fuzzing error:', error.message);
        return { status: 'error', reason: `Fuzzing error: ${error.message}` };
    }
}

// 4. Get ABI for AI Fuzzer
async function getContractAbi(address) {
    try {
        if (!process.env.ETHERSCAN_API_KEY) {
            throw new Error('Etherscan API key not configured');
        }

        const response = await axios.get(
            `https://api-sepolia.etherscan.io/api?module=contract&action=getabi&address=${address}&apikey=${process.env.ETHERSCAN_API_KEY}`,
            { timeout: 15000 }
        );
        
        if (response.data.status === "0" || !response.data.result) {
            throw new Error("ABI not found for this contract.");
        }
        
        // response.data.result is already a string, parse if needed
        if (typeof response.data.result === 'string') {
            return JSON.parse(response.data.result);
        }
        return response.data.result;
    } catch (error) {
        console.error('ABI fetch error:', error.message);
        throw error;
    }
}

// 5. AI generates test code
async function generateFuzzTest(abi) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('Gemini API key not configured');
        }

        const abiString = typeof abi === 'string' ? abi : JSON.stringify(abi);
        const prompt = `You are an expert smart contract security engineer specializing in writing Foundry fuzz tests. Analyze the functions in the provided ABI and write a complete, ready-to-run Foundry test file (\.t.sol) that implements critical fuzz tests for state-changing functions. The test contract should be named "AIGeneratedFuzzer". Focus on invariants for functions involving value transfers, minting/burning, or critical parameter changes. IMPORTANT: Include proper imports and make sure the contract is completely self-contained.`;
        const fullPrompt = prompt + "\n\nHere is the ABI:\n" + abiString;
        
        const result = await model.generateContent(fullPrompt);
        const responseText = await result.response.text();
        const match = responseText.match(/```solidity([\s\S]*?)```/);
        
        if (!match || !match[1]) {
            throw new Error("AI failed to generate valid Solidity. Response: " + responseText.substring(0, 200));
        }
        
        return match[1].trim();
    } catch (error) {
        console.error('Test generation error:', error.message);
        throw error;
    }
}

// 6. Run AI-generated test
async function runAIGeneratedFuzzer(address, testCode, requestId) {
    try {
        const fuzzingEnginePath = path.join(__dirname, '../fuzzing_engine');
        const testFilePath = path.join(fuzzingEnginePath, 'test/AIGeneratedFuzzer.t.sol');
        
        // Write test code
        await fs.writeFile(testFilePath, testCode);
        
        // Run test
        const command = `TARGET_CONTRACT=${address} forge test --match-path test/AIGeneratedFuzzer.t.sol --fuzz-runs 128 2>&1`;
        
        try {
            const { stdout, stderr } = await execPromise(command, { cwd: fuzzingEnginePath, timeout: 45000, maxBuffer: 10 * 1024 * 1024 });
            const output = stdout + stderr;
            
            if (output.includes('PASSED') || output.includes('passed')) {
                return { status: 'passed', log: 'AI-generated fuzz tests passed' };
            } else {
                return { status: 'failed', log: output };
            }
        } catch (execError) {
            // Handle timeout
            if (execError.killed || execError.signal === 'SIGTERM') {
                return { status: 'timeout', log: 'AI fuzzing test took too long - skipping' };
            }
            
            const output = (execError.stdout || '') + (execError.stderr || '');
            return { status: 'failed', log: output };
        }
    } catch (error) {
        console.error('AI fuzzer execution error:', error.message);
        return { status: 'error', log: error.message };
    }
}

// 7. AI interprets failure log
async function interpretFuzzFailure(log) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return 'API key not configured - cannot interpret failure';
        }

        const prompt = `You are an expert smart contract security analyst. I will provide you with a failed test log from a Foundry fuzz test. Read the log, identify the function that failed and the specific inputs (the "counterexample") that caused the failure. Explain the likely security vulnerability in simple, clear English. Keep the explanation to 2-3 sentences.`;
        const fullPrompt = prompt + "\n\nHere is the failed test log:\n" + log.substring(0, 2000);
        
        const result = await model.generateContent(fullPrompt);
        return await result.response.text();
    } catch (error) {
        console.error('Interpretation error:', error.message);
        return `Could not interpret failure: ${error.message}`;
    }
}

// 8. Find Solidity files recursively
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
    } catch (error) {
        console.error(`Could not read directory ${startPath}:`, error.message);
    }
    return result;
}

// 9. Analyze GitHub Repository
async function analyzeGitHubRepo(repoUrl) {
    const requestId = generateRequestId();
    const tempDir = path.join(__dirname, `temp_repo_${requestId}`);
    
    try {
        await fs.remove(tempDir);
        await fs.ensureDir(tempDir);
        
        console.log(`Cloning repository to ${tempDir}`);
        await simpleGit().clone(repoUrl, tempDir, ['--depth', '1']);
        
        const findings = [];
        const files = await findSolidityFiles(tempDir);
        
        if (files.length === 0) {
            return findings;
        }
        
        const BATCH_SIZE = 3;
        const DELAY_MS = 2000;
        
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            const batch = files.slice(i, Math.min(i + BATCH_SIZE, files.length));
            
            await Promise.all(
                batch.map(async (filePath) => {
                    try {
                        const fileContent = await fs.readFile(filePath, 'utf-8');
                        if (fileContent.trim().length < 50) return;
                        
                        const analysis = await getStaticAnalysis(fileContent);
                        findings.push({ 
                            file: path.relative(tempDir, filePath), 
                            analysis: analysis 
                        });
                    } catch (error) {
                        console.error(`Error analyzing ${filePath}:`, error.message);
                    }
                })
            );
            
            if (i + BATCH_SIZE < files.length) {
                await new Promise(res => setTimeout(res, DELAY_MS));
            }
        }
        
        return findings;
    } catch (error) {
        console.error('GitHub analysis error:', error.message);
        throw error;
    } finally {
        // Clean up temp directory
        await fs.remove(tempDir);
    }
}


// --- SERVE FRONTEND HTML ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend.html'));
});

// --- HEALTH CHECK ENDPOINT ---
app.get('/health', (req, res) => {
    const status = {
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        config: {
            geminiConfigured: !!process.env.GEMINI_API_KEY,
            etherscanConfigured: !!process.env.ETHERSCAN_API_KEY,
            sepoliaRpcConfigured: !!process.env.SEPOLIA_RPC_URL
        }
    };
    res.json(status);
});

// --- UNIFIED API ENDPOINT ---
app.post('/analyze', async (req, res) => {
    const requestId = generateRequestId();
    console.log(`[${requestId}] Analysis request received`);
    
    try {
        const { inputType, input } = req.body;
        
        // Validate input
        if (!inputType || !input) {
            return res.status(400).json({ 
                error: 'Input type and value are required.',
                details: 'Provide {"inputType": "address|github|text", "input": "..."}'
            });
        }

        let finalReport = {};

        switch (inputType) {
            case 'address':
                // Validate Ethereum address
                if (!isValidEthereumAddress(input)) {
                    return res.status(400).json({ 
                        error: 'Invalid Ethereum address format',
                        details: 'Expected format: 0x followed by 40 hex characters'
                    });
                }

                console.log(`[${requestId}] Analyzing address: ${input}`);
                
                try {
                    // Fetch source code (optional - proceed even if not available)
                    let sourceCode = null;
                    let hasSourceCode = false;
                    
                    try {
                        const sourceCodeResponse = await axios.get(
                            `https://api-sepolia.etherscan.io/api?module=contract&action=getsourcecode&address=${input}&apikey=${process.env.ETHERSCAN_API_KEY}`,
                            { timeout: 15000 }
                        );
                        
                        if (sourceCodeResponse.data.result && sourceCodeResponse.data.result[0]) {
                            sourceCode = sourceCodeResponse.data.result[0].SourceCode;
                            hasSourceCode = sourceCode && sourceCode.trim().length > 0;
                        }
                    } catch (err) {
                        console.log(`[${requestId}] Could not fetch source code:`, err.message);
                    }

                    console.log(`[${requestId}] Source code available: ${hasSourceCode ? 'yes' : 'no'}`);
                    console.log(`[${requestId}] Running analysis engines in parallel...`);
                    
                    // Prepare analysis promises based on source code availability
                    const analysisPromises = [];
                    analysisPromises.push(Promise.resolve({ source: 'skipped', reason: 'Source code not verified on Etherscan' })); // Static analysis placeholder
                    
                    if (hasSourceCode) {
                        // If we have source code, run static analysis
                        analysisPromises[0] = getStaticAnalysis(sourceCode);
                    }
                    
                    analysisPromises.push(getDynamicAnalysis(input));
                    analysisPromises.push(getGenericFuzzingAnalysis(input));
                    
                    // Run all available analyses in parallel
                    const [staticResult, dynamicResult, genericFuzzResult] = await Promise.allSettled(analysisPromises);

                    console.log(`[${requestId}] Basic analyses complete, starting AI fuzzer...`);

                    let aiFuzzing = { status: 'pending', reason: 'Attempting AI-generated test generation' };
                    
                    try {
                        const abi = await getContractAbi(input);
                        const testCode = await generateFuzzTest(abi);
                        console.log(`[${requestId}] Running AI-generated fuzzer...`);
                        
                        const fuzzerOutput = await runAIGeneratedFuzzer(input, testCode, requestId);
                        
                        if (fuzzerOutput.status === 'failed' && fuzzerOutput.log) {
                            const interpretation = await interpretFuzzFailure(fuzzerOutput.log);
                            aiFuzzing = { status: 'failed', interpretation: interpretation, rawLog: fuzzerOutput.log };
                        } else {
                            aiFuzzing = { status: fuzzerOutput.status, log: fuzzerOutput.log };
                        }
                    } catch (err) {
                        console.error(`[${requestId}] AI fuzzing error:`, err.message);
                        aiFuzzing = { status: 'skipped', reason: `AI fuzzing not available: ${err.message}` };
                    }

                    finalReport = {
                        reportType: 'address',
                        address: input,
                        timestamp: new Date().toISOString(),
                        staticAnalysis: staticResult.status === 'fulfilled' ? staticResult.value : { error: 'Failed' },
                        dynamicAnalysis: dynamicResult.status === 'fulfilled' ? dynamicResult.value : { isHoneypot: null, reason: 'Check failed' },
                        genericFuzzing: genericFuzzResult.status === 'fulfilled' ? genericFuzzResult.value : { status: 'error', reason: 'Fuzzing failed' },
                        aiFuzzing: aiFuzzing
                    };
                } catch (error) {
                    console.error(`[${requestId}] Address analysis error:`, error.message);
                    return res.status(400).json({ 
                        error: 'Failed to analyze contract',
                        details: error.message 
                    });
                }
                break;

            case 'github':
                // Validate GitHub URL
                if (!isValidGitHubUrl(input)) {
                    return res.status(400).json({ 
                        error: 'Invalid GitHub URL format',
                        details: 'Expected: https://github.com/username/repository'
                    });
                }

                console.log(`[${requestId}] Analyzing GitHub repository: ${input}`);
                
                try {
                    const repoResults = await analyzeGitHubRepo(input);
                    finalReport = { 
                        reportType: 'repo', 
                        repository: input,
                        timestamp: new Date().toISOString(),
                        filesAnalyzed: repoResults.length,
                        files: repoResults 
                    };
                } catch (error) {
                    console.error(`[${requestId}] GitHub analysis error:`, error.message);
                    return res.status(400).json({
                        error: 'Failed to analyze GitHub repository',
                        details: error.message
                    });
                }
                break;

            case 'text':
                console.log(`[${requestId}] Analyzing provided Solidity code`);
                
                try {
                    const textResult = await getStaticAnalysis(input);
                    finalReport = { 
                        reportType: 'text',
                        timestamp: new Date().toISOString(),
                        files: [{ 
                            file: 'ProvidedCode.sol', 
                            analysis: textResult 
                        }] 
                    };
                } catch (error) {
                    console.error(`[${requestId}] Text analysis error:`, error.message);
                    return res.status(400).json({
                        error: 'Failed to analyze code',
                        details: error.message
                    });
                }
                break;

            default:
                return res.status(400).json({ 
                    error: 'Invalid input type',
                    details: 'Must be one of: address, github, text'
                });
        }

        console.log(`[${requestId}] Analysis complete, returning report`);
        res.json(finalReport);

    } catch (error) {
        console.error(`[${requestId}] Unexpected error:`, error.message);
        res.status(500).json({ 
            error: 'Failed to complete analysis',
            details: error.message,
            requestId: requestId
        });
    }
});

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`🚀 VeriSol AI Server running on port ${PORT}`);
    console.log(`📍 Health check: GET http://localhost:${PORT}/health`);
    console.log(`📍 Analysis API: POST http://localhost:${PORT}/analyze`);
});