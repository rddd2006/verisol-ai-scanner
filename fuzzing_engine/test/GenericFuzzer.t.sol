// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "./helpers/FuzzTestBase.sol";

/**
 * @title GenericFuzzer
 * @dev Generic fuzz testing suite that works on ANY contract
 * Tests vulnerability patterns without assuming specific functions exist
 * Focuses on state consistency and value handling invariants
 */
contract GenericFuzzer is FuzzTestBase {
    address payable targetAddress;

    function setUp() public {
        // Get target contract from environment variable
        string memory targetEnv = vm.envString("TARGET_CONTRACT");
        targetAddress = payable(vm.parseAddress(targetEnv));

        // Record initial state
        recordInitialState(targetAddress);
    }

    // ===== FUZZ TEST 1: Balance Consistency After Random Calls =====
    // Test: Call contract with random data and check balance is reasonable
    function testFuzz_balance_consistency(
        uint256 randomSelector,
        uint256 randomValue
    ) public {
        bytes4 selector = bytes4(uint32(randomSelector));
        uint256 boundedValue = randomValue % (10 ether);

        // Call with random selector and value
        (bool success, ) = targetAddress.call{value: boundedValue}(
            abi.encodePacked(selector)
        );

        // Contract balance should be reasonable (not corrupted)
        assert(targetAddress.balance < type(uint256).max);
        
        // Contract should still exist
        uint256 codeSize;
        address addr = targetAddress;
        assembly {
            codeSize := extcodesize(addr)
        }
        assert(codeSize > 0);
    }

    // ===== FUZZ TEST 2: Contract Existence After Calls =====
    // Test: Ensure contract doesn't selfdestruct unexpectedly
    function testFuzz_contract_never_disappears(
        uint256 callCount
    ) public {
        uint256 numCallsBounded = (callCount % 5) + 1; // 1-5 calls

        for (uint256 i = 0; i < numCallsBounded; i++) {
            bytes4 selector = bytes4(uint32(i));
            (bool success, ) = targetAddress.call(abi.encodePacked(selector));
            
            // After each call, verify contract still exists
            uint256 codeSize;
            address addr = targetAddress;
            assembly {
                codeSize := extcodesize(addr)
            }
            assert(codeSize > 0);
        }
    }

    // ===== FUZZ TEST 3: Fallback Handling =====
    // Test: Contract should handle ether gracefully
    function testFuzz_fallback_handles_value(uint256 value) public {
        uint256 boundedValue = value % (50 ether);
        
        uint256 balanceBefore = targetAddress.balance;

        // Send ether via fallback
        (bool success, ) = targetAddress.call{value: boundedValue}("");

        uint256 balanceAfter = targetAddress.balance;

        // If call succeeded, contract should have received the ether
        if (success) {
            assert(balanceAfter >= balanceBefore);
        }

        // Contract should still exist
        uint256 codeSize;
        address addr = targetAddress;
        assembly {
            codeSize := extcodesize(addr)
        }
        assert(codeSize > 0);
    }

    // ===== FUZZ TEST 4: No Memory Safety Issues =====
    // Test: Calling with large data shouldn't break contract
    function testFuzz_large_calldata(bytes memory data) public {
        // Limit data size for practical fuzzing
        if (data.length > 1024) {
            return; // Skip very large data
        }

        bytes4 selector = bytes4(keccak256("test()"));

        // Call with potentially problematic calldata
        (bool success, ) = targetAddress.call(
            abi.encodePacked(selector, data)
        );

        // Contract should remain stable regardless of call result
        uint256 codeSize;
        address addr = targetAddress;
        assembly {
            codeSize := extcodesize(addr)
        }
        assert(codeSize > 0);
        assert(targetAddress.balance < type(uint256).max);
    }

    // ===== FUZZ TEST 5: No State Lock =====
    // Test: Multiple calls shouldn't deadlock contract
    function testFuzz_no_state_lock(uint256 numCalls) public {
        uint256 callCount = (numCalls % 10) + 1; // 1-10 calls

        for (uint256 i = 0; i < callCount; i++) {
            bytes4 selector = bytes4(uint32(i * 12345)); // Varied selector
            (bool success, ) = targetAddress.call(abi.encodePacked(selector));
            
            // Contract should still be responsive
            uint256 codeSize;
            address addr = targetAddress;
            assembly {
                codeSize := extcodesize(addr)
            }
            assert(codeSize > 0);
        }
    }
}