// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

/**
 * @title FuzzTestBase
 * @dev Base contract for fuzz testing with utilities for testing arbitrary contracts
 * Uses generic patterns to detect vulnerabilities without hardcoded assumptions
 */
abstract contract FuzzTestBase is Test {
    // Track contract balance to detect ether loss/gain
    uint256 initialBalance;
    address payable target_contract;

    /**
     * @dev Records initial state before fuzz test
     */
    function recordInitialState(address payable target) internal {
        target_contract = target;
        initialBalance = target.balance;
    }

    /**
     * @dev Check that contract balance hasn't mysteriously changed (ether accounting invariant)
     */
    function assertBalanceConsistency() internal {
        // Allow small dust (1 wei) for rounding, but flag major discrepancies
        uint256 currentBalance = target_contract.balance;
        assert(currentBalance >= initialBalance || (initialBalance - currentBalance) <= 1);
    }

    /**
     * @dev Safely call an arbitrary function on the target contract
     * Returns success and data without reverting
     */
    function callFunction(
        bytes memory callData
    ) internal returns (bool success, bytes memory returnData) {
        (success, returnData) = target_contract.call(callData);
    }

    /**
     * @dev Helper to safely call with value
     */
    function callFunctionWithValue(
        bytes memory callData,
        uint256 value
    ) internal returns (bool success, bytes memory returnData) {
        (success, returnData) = target_contract.call{value: value}(callData);
    }

    /**
     * @dev Records initial contract code size (detects if selfdestruct is called)
     */
    function assertContractStillExists(address target) internal {
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(target)
        }
        assert(codeSize > 0); // Contract should still exist
    }
}
