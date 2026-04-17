// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title NaiveLendingPool
 * @notice DEMO — simplified lending pool with price oracle manipulation
 *         and flash-loan attack surface. Self-contained, no imports.
 *
 * Bugs present:
 *   1. Spot-price oracle  — uses single block price, manipulable via flash loan
 *   2. No flash-loan fee  — loans are free; attacker repays in same tx
 *   3. Reentrancy in flashLoan callback path
 *   4. Integer division truncation in collateral check
 *   5. Missing msg.sender == borrower check in repay()
 */
contract NaiveLendingPool {
    // ── State ──────────────────────────────────────────────────────────────
    address public owner;
    uint256 public reserveETH;
    uint256 public reserveToken;   // "token" tracked as internal balance
    uint256 public totalBorrowed;

    mapping(address => uint256) public collateral;   // ETH deposited as collateral
    mapping(address => uint256) public borrowed;     // tokens borrowed

    // ── Fake "oracle" — just the reserve ratio, manipulable ──────────────
    /// @dev BUG 1: spot price — single-block, no TWAP, flashloan-manipulable
    function getPrice() public view returns (uint256) {
        if (reserveToken == 0) return 1e18;
        return (reserveETH * 1e18) / reserveToken;
    }

    event Deposited(address indexed user, uint256 eth, uint256 tokens);
    event Borrowed(address indexed user,  uint256 tokens);
    event Repaid(address indexed user,    uint256 tokens);
    event FlashLoan(address indexed borrower, uint256 amount);

    constructor() {
        owner        = msg.sender;
        reserveETH   = 0;
        reserveToken = 0;
    }

    // ── Liquidity deposit ─────────────────────────────────────────────────
    function addLiquidity(uint256 tokenAmount) external payable {
        require(msg.value > 0 && tokenAmount > 0, "Zero amounts");
        reserveETH   += msg.value;
        reserveToken += tokenAmount;
        emit Deposited(msg.sender, msg.value, tokenAmount);
    }

    // ── Deposit collateral ────────────────────────────────────────────────
    function depositCollateral() external payable {
        require(msg.value > 0, "Zero collateral");
        collateral[msg.sender] += msg.value;
    }

    /// @dev BUG 2: collateral check uses manipulable spot price
    ///      Attacker flash-loans ETH → inflates reserveETH → price spikes
    ///      → borrow far more tokens than collateral is worth
    function borrow(uint256 tokenAmount) external {
        uint256 price           = getPrice();                // manipulable
        uint256 collateralNeeded = (tokenAmount * price) / 1e18 / 2; // BUG 4: integer division
        require(collateral[msg.sender] >= collateralNeeded, "Undercollateralized");
        require(reserveToken >= tokenAmount,                "Insufficient reserves");

        borrowed[msg.sender] += tokenAmount;
        reserveToken         -= tokenAmount;
        totalBorrowed        += tokenAmount;
        emit Borrowed(msg.sender, tokenAmount);
    }

    /// @dev BUG 5: anyone can repay on behalf — borrowed[victim] cleared by attacker
    function repay(address borrower, uint256 tokenAmount) external {
        require(borrowed[borrower] >= tokenAmount, "Overpayment");
        // No check: msg.sender == borrower
        borrowed[borrower] -= tokenAmount;
        reserveToken       += tokenAmount;
        totalBorrowed      -= tokenAmount;
        emit Repaid(borrower, tokenAmount);
    }

    // ── Flash loan — free, no fee ────────────────────────────────────────
    /// @dev BUG 3: callback happens before balance check → reentrancy path
    function flashLoan(uint256 amount, address target, bytes calldata data) external {
        require(reserveETH >= amount, "Insufficient ETH reserves");
        uint256 balBefore = address(this).balance;

        // Send ETH to target and call arbitrary data
        (bool ok,) = target.call{value: amount}(data);  // BUG: reentrancy surface
        require(ok, "Flash loan callback failed");

        // BUG 3: balance check AFTER callback — attacker can manipulate price here
        require(address(this).balance >= balBefore, "Flash loan not repaid");
        emit FlashLoan(msg.sender, amount);
    }

    function getReserves() external view returns (uint256 eth, uint256 tokens) {
        return (reserveETH, reserveToken);
    }

    receive() external payable {
        reserveETH += msg.value;
    }
}
