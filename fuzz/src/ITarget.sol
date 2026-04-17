// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ITarget
 * @notice Minimal interface that VeriSol AI expects target contracts
 *         to optionally implement. Tests gracefully skip unavailable functions.
 */
interface ITarget {
    // Common ERC-20-like surface
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);

    // Common vault/bank surface
    function deposit() external payable;
    function withdraw(uint256 amount) external;

    // Ownership
    function owner() external view returns (address);
}
