// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FuzzCleanVault
 * @notice DEMO - intentionally small, self-contained vault designed to pass
 *         the generic Foundry fuzz suite without relying on skipped paths.
 *
 * Security properties:
 *   - No constructor args or external imports
 *   - deposit() and withdraw(uint256) are payable/fuzz-friendly
 *   - Checks-effects-interactions withdrawal flow
 *   - Reentrancy guard
 *   - Two-step ownership transfer with access control
 *   - No token or lending keywords, so generic fuzz uses vault tests
 */
contract FuzzCleanVault {
    mapping(address => uint256) public balances;
    address public owner;
    address public pendingOwner;

    bool private locked;
    uint256 public totalDeposits;

    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event OwnershipTransferStarted(address indexed currentOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier nonReentrant() {
        require(!locked, "REENTRANCY");
        locked = true;
        _;
        locked = false;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function deposit() external payable nonReentrant {
        require(msg.value > 0, "ZERO_DEPOSIT");
        balances[msg.sender] += msg.value;
        totalDeposits += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "ZERO_WITHDRAW");
        require(balances[msg.sender] >= amount, "INSUFFICIENT_BALANCE");

        balances[msg.sender] -= amount;
        totalDeposits -= amount;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "TRANSFER_FAILED");
        emit Withdrawn(msg.sender, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_OWNER");
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "NOT_PENDING_OWNER");
        address previousOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, owner);
    }

    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {
        balances[msg.sender] += msg.value;
        totalDeposits += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
}
