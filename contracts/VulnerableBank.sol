// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title VulnerableBank
 * @notice DEMO — intentionally vulnerable for VeriSol AI fuzzing.
 *
 * Bugs present (Foundry will catch all of these):
 *   1. Reentrancy  — withdraw() updates state AFTER external call
 *   2. tx.origin   — adminWithdraw() uses tx.origin for auth
 *   3. No access   — setOwner() has zero access control
 *   4. Unchecked   — unsafeAdd() wraps in unchecked block
 */
contract VulnerableBank {
    mapping(address => uint256) public balances;
    address public owner;
    uint256 public totalDeposited;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    function deposit() external payable {
        require(msg.value > 0, "Zero value");
        balances[msg.sender] += msg.value;
        totalDeposited       += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /// @dev BUG 1: Reentrancy — external call before state update
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        // External call FIRST — attacker can re-enter here
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
        // State update happens too late
        balances[msg.sender] -= amount;
        totalDeposited       -= amount;
        emit Withdrawn(msg.sender, amount);
    }

    /// @dev BUG 2: tx.origin authentication — phishable
    function adminWithdraw() external {
        require(tx.origin == owner, "Not owner");
        payable(owner).transfer(address(this).balance);
    }

    /// @dev BUG 3: No access control — anyone can hijack ownership
    function setOwner(address newOwner) external {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    /// @dev BUG 4: Unchecked arithmetic — can silently overflow
    function unsafeAdd(uint256 a, uint256 b) external pure returns (uint256) {
        unchecked {
            return a + b;
        }
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {
        balances[msg.sender] += msg.value;
        totalDeposited       += msg.value;
    }
}
