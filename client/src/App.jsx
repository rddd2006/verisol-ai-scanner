import { useState } from 'react';
import axios from 'axios';
import './App.css';

// --- Helper for styling risk scores ---
const getRiskColor = (score) => {
    switch (score?.toLowerCase()) {
        case 'critical': case 'high': return 'risk-high';
        case 'medium': return 'risk-medium';
        case 'low': return 'risk-low';
        default: return '';
    }
};

// --- Sub-component for a single Fuzz Test result box ---
const FuzzReportBox = ({ title, icon, data }) => {
    if (!data) return null;

    let statusClass = '';
    let statusText = '';
    
    // The backend now provides a 'status' field for fuzz tests
    switch(data.status) {
        case 'passed':
            statusClass = 'pass';
            statusText = 'Passed';
            break;
        case 'failed':
            statusClass = 'fail';
            statusText = 'FAILED';
            break;
        case 'incompatible':
            statusClass = 'incompatible';
            statusText = 'Incompatible';
            break;
        default:
            // Fallback for the older boolean 'passed' field
            if (data.passed) {
                statusClass = 'pass';
                statusText = 'Passed';
            } else {
                statusClass = 'fail';
                statusText = 'FAILED';
            }
            break;
    }

    return (
        <div className={`report-box ${statusClass}`}>
            <h3>{icon} {title}</h3>
            <p><strong>Status:</strong> {statusText}</p>
        </div>
    );
};

// --- Sub-component for the comprehensive address report ---
const AddressReport = ({ staticAnalysis, dynamicAnalysis, genericFuzzing, aiFuzzing }) => (
    <>
        {/* Dynamic & Fuzzing Results */}
        <div className="dynamic-reports">
            {dynamicAnalysis && (
                dynamicAnalysis.isHoneypot
                    ? <div className="report-box fail"><h3>🚨 Honeypot Alert!</h3><p>{dynamicAnalysis.reason}</p></div>
                    : <div className="report-box pass"><h3>✅ Honeypot Check</h3><p>Passed</p></div>
            )}

            <FuzzReportBox title="Generic Fuzzing" icon="🔬" data={genericFuzzing} />
            <FuzzReportBox title="AI-Driven Fuzzing" icon="🧠" data={aiFuzzing} />
        </div>

        {/* Static AI Analysis */}
        {staticAnalysis && (
            <div className="static-report">
                <hr/>
                <h3>Static AI Analysis</h3>
                <h4>Risk Score: <span className={getRiskColor(staticAnalysis.riskScore)}>{staticAnalysis.riskScore}</span></h4>
                <p><strong>Summary:</strong> {staticAnalysis.summary}</p>
                <h4>Findings</h4>
                {staticAnalysis.findings?.length > 0 ? (
                    staticAnalysis.findings.map((finding, index) => (
                        <div className="finding-card" key={index}>
                            <h5>{finding.title} <span className={getRiskColor(finding.severity)}>({finding.severity})</span></h5>
                            <p>{finding.description}</p>
                        </div>
                    ))
                ) : <p>No significant vulnerabilities found by the AI.</p>}
            </div>
        )}
    </>
);

// --- Component to handle GitHub and Text reports ---
const RepoReport = ({ files }) => (
    <>
        {files?.map((fileResult, index) => (
            <div key={index} className="file-report">
                <h3>File: <code>{fileResult.file}</code></h3>
                {/* Repo report only shows static analysis */}
                <AddressReport staticAnalysis={fileResult.analysis} />
            </div>
        ))}
    </>
);

// --- Main component to route to the correct report type ---
const ResultsDisplay = ({ report }) => {
    if (!report) return null;
    return (
        <div className="results-card">
            <h2>Analysis Report</h2>
            {report.reportType === 'address' && <AddressReport {...report} />}
            {(report.reportType === 'repo' || report.reportType === 'text') && <RepoReport files={report.files} />}
        </div>
    );
};

// --- Main App Component ---
function App() {
    const [inputType, setInputType] = useState('address');
    const [inputValue, setInputValue] = useState('');
    const [result, setResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const placeholders = {
        address: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
        github: 'https://github.com/transmissions11/solmate',
        text: 'pragma solidity ^0.8.20;\ncontract MyContract {\n  // ...\n}'
    };

    const handleAnalyze = async () => {
        if (!inputValue) {
            setError('Please provide input.');
            return;
        }
        setIsLoading(true);
        setResult(null);
        setError('');

        try {
            const response = await axios.post('http://localhost:3001/analyze', {
                inputType: inputType,
                input: inputValue,
            });
            setResult(response.data);
        } catch (err) {
            setError(err.response?.data?.error || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container">
            <header>
                <h1>VeriSol AI 🤖</h1>
                <p>The All-in-One Smart Contract Security Scanner</p>
            </header>

            <div className="main-layout">
                {/* Left Column for Inputs */}
                <div className="input-column">
                    <div className="input-card">
                        <div className="tabs">
                            <button className={`tab ${inputType === 'address' ? 'active' : ''}`} onClick={() => setInputType('address')}>Contract Address</button>
                            <button className={`tab ${inputType === 'github' ? 'active' : ''}`} onClick={() => setInputType('github')}>GitHub Repo</button>
                            <button className={`tab ${inputType === 'text' ? 'active' : ''}`} onClick={() => setInputType('text')}>Paste Code</button>
                        </div>
                        <div className="input-area">
                            {inputType === 'text' ? (
                                <textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)} rows="8" placeholder={placeholders.text} disabled={isLoading}></textarea>
                            ) : (
                                <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder={placeholders[inputType]} disabled={isLoading} />
                            )}
                            <button onClick={handleAnalyze} disabled={isLoading}>{isLoading ? 'Analyzing...' : 'Analyze Now'}</button>
                        </div>
                    </div>
                </div>

                {/* Right Column for Results */}
                <div className="results-column">
                    {error && <div className="error-card"><p>{error}</p></div>}
                    {isLoading && <div className="loading-card"><div className="spinner"></div><p>Analyzing...</p></div>}
                    {result && <ResultsDisplay report={result} />}
                </div>
            </div>
        </div>
    );
}

export default App;