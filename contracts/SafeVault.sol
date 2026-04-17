// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SafeVault
 * @notice DEMO — a well-written vault used to show VeriSol AI gives a HIGH score.
 *         Self-contained, no external imports — compiles in bare Foundry project.
 *
 * Security properties:
 *   ✓ Checks-Effects-Interactions in withdraw()
 *   ✓ Reentrancy guard (manual mutex, no OpenZeppelin needed)
 *   ✓ msg.sender auth (never tx.origin)
 *   ✓ Zero-address validation
 *   ✓ Deposit cap to limit exposure
 *   ✓ Overflow-safe (Solidity 0.8 + no unchecked)
 *   ✓ EmergencyWithdraw is time-locked (48 h delay)
 */
contract SafeVault {
    // ── State ──────────────────────────────────────────────────────────────
    mapping(address => uint256) public balances;
    address public              owner;
    bool    private             _locked;           // reentrancy guard
    uint256 public constant     MAX_DEPOSIT = 10 ether;
    uint256 public              totalDeposited;

    uint256 public  emergencyUnlockTime;
    bool    public  emergencyRequested;

    // ── Events ─────────────────────────────────────────────────────────────
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event EmergencyRequested(uint256 unlockTime);
    event EmergencyExecuted(uint256 amount);

    // ── Modifiers ──────────────────────────────────────────────────────────
    modifier nonReentrant() {
        require(!_locked, "Reentrancy");
        _locked = true;
        _;
        _locked = false;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ── Core functions ─────────────────────────────────────────────────────

    function deposit() external payable nonReentrant {
        require(msg.value > 0,          "Zero deposit");
        require(msg.value <= MAX_DEPOSIT, "Exceeds per-tx cap");
        require(msg.sender != address(0), "Zero sender");

        balances[msg.sender] += msg.value;
        totalDeposited       += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice CEI: state updated BEFORE external call
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0,                     "Zero amount");
        require(balances[msg.sender] >= amount, "Insufficient balance");

        // Effects first
        balances[msg.sender] -= amount;
        totalDeposited       -= amount;

        // Then interaction
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    // ── Emergency path (time-locked 48 h) ─────────────────────────────────
    function requestEmergencyWithdraw() external onlyOwner {
        require(!emergencyRequested, "Already requested");
        emergencyRequested  = true;
        emergencyUnlockTime = block.timestamp + 48 hours;
        emit EmergencyRequested(emergencyUnlockTime);
    }

    function executeEmergencyWithdraw() external onlyOwner nonReentrant {
        require(emergencyRequested,                    "Not requested");
        require(block.timestamp >= emergencyUnlockTime, "Timelock active");
        emergencyRequested = false;
        uint256 bal = address(this).balance;
        emit EmergencyExecuted(bal);
        payable(owner).transfer(bal);
    }

    // ── Owner transfer (2-step) ────────────────────────────────────────────
    address public pendingOwner;

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        pendingOwner = newOwner;
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        owner        = pendingOwner;
        pendingOwner = address(0);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
