// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title HoneypotVault
 * @notice DEMO — classic honeypot that accepts deposits but traps withdrawals.
 *         Self-contained, no external imports — compiles in bare Foundry project.
 *
 * Honeypot patterns present:
 *   1. selfdestruct  — owner can destroy contract and claim all ETH
 *   2. Owner-only withdraw gate  — users cannot retrieve their own funds
 *   3. tx.origin phish guard
 *   4. Hidden pause  — owner can silently freeze all withdrawals
 *   5. Fake public withdraw that always reverts for non-owner
 */
contract HoneypotVault {
    mapping(address => uint256) public deposits;
    address public owner;
    bool    private _paused;
    uint256 public  totalLocked;

    event Deposited(address indexed user, uint256 amount);
    event OwnerClaimed(uint256 amount);

    constructor() {
        owner   = msg.sender;
        _paused = false;
    }

    // ── Anyone can deposit ────────────────────────────────────────────────
    function deposit() external payable {
        require(msg.value > 0, "Zero deposit");
        deposits[msg.sender] += msg.value;
        totalLocked          += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    // ── BUG 1: withdraw APPEARS public but always reverts for non-owner ───
    function withdraw(uint256 amount) external {
        require(!_paused,                          "Withdrawals paused");
        require(deposits[msg.sender] >= amount,    "Insufficient deposit");
        // Looks legitimate, but the real check below blocks all non-owners
        require(tx.origin == owner,                "Security check failed"); // BUG: tx.origin gate
        deposits[msg.sender] -= amount;
        totalLocked          -= amount;
        payable(msg.sender).transfer(amount);
    }

    // ── BUG 2: Owner can pause withdrawals at will ────────────────────────
    function setPaused(bool paused) external {
        require(msg.sender == owner, "Not owner");
        _paused = paused;
    }

    // ── BUG 3: Owner drains everything ────────────────────────────────────
    function ownerClaim() external {
        require(msg.sender == owner, "Not owner");
        uint256 bal = address(this).balance;
        emit OwnerClaimed(bal);
        payable(owner).transfer(bal);
    }

    // ── BUG 4: selfdestruct — destroys contract and sends all ETH to owner ─
    function destroy() external {
        require(msg.sender == owner, "Not owner");
        selfdestruct(payable(owner));
    }

    // ── BUG 5: No access control on owner transfer ────────────────────────
    function transferOwnership(address newOwner) external {
        // Missing: require(msg.sender == owner)
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function isPaused() external view returns (bool) {
        return _paused;
    }

    receive() external payable {
        deposits[msg.sender] += msg.value;
        totalLocked          += msg.value;
    }
}
