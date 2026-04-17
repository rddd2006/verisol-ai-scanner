// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SafeBank
 * @notice A well-written vault contract for testing the scanner's
 *         ability to distinguish safe contracts from vulnerable ones.
 *
 * Security properties:
 *  ✓ Checks-Effects-Interactions pattern in withdraw()
 *  ✓ ReentrancyGuard on withdraw()
 *  ✓ Ownable with proper msg.sender check (no tx.origin)
 *  ✓ Zero-address validation
 *  ✓ Capped deposits
 */
contract SafeBank is Ownable, ReentrancyGuard {
    mapping(address => uint256) public balances;
    uint256 public constant MAX_DEPOSIT = 100 ether;
    uint256 public totalDeposited;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor() Ownable(msg.sender) {}

    function deposit() external payable {
        require(msg.value > 0,                       "Zero deposit");
        require(msg.value <= MAX_DEPOSIT,             "Exceeds max deposit");
        require(msg.sender != address(0),             "Zero address");
        balances[msg.sender] += msg.value;
        totalDeposited       += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0,                           "Zero amount");
        require(balances[msg.sender] >= amount,       "Insufficient balance");

        // Effects before interactions (CEI)
        balances[msg.sender] -= amount;
        totalDeposited       -= amount;

        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    function emergencyWithdraw() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "Nothing to withdraw");
        payable(owner()).transfer(bal);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
