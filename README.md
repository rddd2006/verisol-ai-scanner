# VeriSol AI 🤖

VeriSol AI is a powerful, multi-engine smart contract security scanner. It combines static AI analysis, dynamic analysis, and advanced fuzz testing techniques to provide a comprehensive security overview of Solidity smart contracts.



## ✨ Features

- **Multi-Input Support**: Analyze contracts by a deployed Sepolia address, an entire GitHub repository, or by pasting raw Solidity code.
- **Static AI Analysis**: Leverages Google's Gemini Pro to read source code and identify a wide range of common vulnerabilities.
- **Honeypot Detection**: A simple dynamic check to simulate deposits and withdrawals, flagging contracts that may trap funds.
- **Generic Fuzz Testing**: Runs a pre-written suite of property-based tests against the contract to check for common invariant violations (e.g., token supply consistency).
- **AI-Driven Fuzz Testing**: A cutting-edge module where the AI dynamically generates a custom fuzz testing suite based on the target contract's unique functions (ABI), and then interprets any failures in plain English.

## 🛠️ Tech Stack

- **Frontend**: React (Vite)
- **Backend**: Node.js, Express.js
- **AI**: Google Gemini API
- **Blockchain Tools**: Foundry (Forge), Etherscan API
- **Utilities**: simple-git, fs-extra, jq

## 🚀 Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

You must have the following tools installed globally on your system:

- **Node.js**: [Download LTS Version](https://nodejs.org/)
- **Foundry**: Follow the [official installation guide](https://book.getfoundry.sh/getting-started/installation)
- **jq**: A command-line JSON processor.
  - **Ubuntu/Debian**: `sudo apt-get install jq`
  - **macOS (Homebrew)**: `brew install jq`

### Local Setup

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/your-username/verisol-ai-scanner.git](https://github.com/your-username/verisol-ai-scanner.git)
    cd verisol-ai-scanner
    ```

2.  **Setup the Backend:**
    ```bash
    cd server
    npm install
    ```
    Create a `.env` file in the `server` directory and add your API keys:
    ```
    ETHERSCAN_API_KEY="YOUR_ETHERSCAN_KEY_HERE"
    GEMINI_API_KEY="YOUR_GEMINI_KEY_HERE"
    SEPOLIA_RPC_URL="YOUR_SEPOLIA_RPC_URL_HERE"
    ```
    Make the runner scripts executable:
    ```bash
    chmod +x *.sh
    ```

3.  **Setup the Fuzzing Engine:**
    ```bash
    cd ../fuzzing_engine
    forge install foundry-rs/forge-std
    forge install OpenZeppelin/openzeppelin-contracts
    ```

4.  **Setup the Frontend:**
    ```bash
    cd ../client
    npm install
    ```

### Running the Application

You need to run the backend and frontend in two separate terminals from the project's root directory.

- **Terminal 1 (Backend):**
  ```bash
  cd server
  node index.js
  ```

- **Terminal 2 (Frontend):**
  ```bash
  cd client
  npm run dev
  ```
The application will be available at `http://localhost:5173` (or a similar port).

## 📂 Project Structure

```
verisol-ai-scanner/
├── client/          # Contains the React frontend application
├── server/          # Contains the Node.js backend, API logic, and runner scripts
└── fuzzing_engine/  # The dedicated Foundry project for all fuzz testing
```

## 📄 License

This project is licensed under the MIT License.