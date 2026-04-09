// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VulnerableCounter
 * @dev A deliberately vulnerable contract for testing fuzzing detection
 * Contains common vulnerability patterns for testing
 */
contract VulnerableCounter {
    uint256 public number;
    bool public locked;
    mapping(address => uint256) public balances;

    // Vulnerability 1: Reentrancy via fallback
    receive() external payable {
        // Attempt to re-enter
        (bool success, ) = msg.sender.call("");
        require(success);
    }

    // Vulnerability 2: Integer underflow (even in 0.8.20, can happen in certain patterns)
    function subtractWithoutCheck(uint256 amount) public {
        // Intentional unsafe arithmetic (Solidity safety catches this, but fuzzer should note it)
        number -= amount;
    }

    // Vulnerability 3: Access Control - no checks
    function setNumber(uint256 newNumber) public {
        number = newNumber;
    }

    // Vulnerability 4: Can receive ether but might cause issues
    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);
    }

    // Vulnerability 5: Can be called recursively during withdraw
    fallback() external payable {
        // This could be exploited
    }
}
