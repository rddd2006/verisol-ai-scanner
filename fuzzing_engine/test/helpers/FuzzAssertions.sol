// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

/**
 * @title FuzzAssertions
 * @dev Custom assertion helpers for fuzz testing smart contracts
 */
library FuzzAssertions {
    /**
     * @dev Assert that a call to a contract succeeded
     */
    function assertCallSucceeds(
        address target,
        bytes memory callData
    ) internal {
        (bool success, ) = target.call(callData);
        require(success, "FuzzAssertions: target call failed");
    }

    /**
     * @dev Assert that a call to a contract failed
     */
    function assertCallFails(
        address target,
        bytes memory callData
    ) internal {
        (bool success, ) = target.call(callData);
        require(!success, "FuzzAssertions: expected target call to fail");
    }

    /**
     * @dev Assert contract still has code (not self-destructed)
     */
    function assertContractExists(address target) internal view {
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(target)
        }
        require(codeSize > 0, "FuzzAssertions: contract code not found");
    }

    /**
     * @dev Assert that balance within expected range
     */
    function assertBalanceInRange(
        address target,
        uint256 minBalance,
        uint256 maxBalance
    ) internal view {
        uint256 balance = target.balance;
        require(
            balance >= minBalance && balance <= maxBalance,
            "FuzzAssertions: balance out of range"
        );
    }
}
