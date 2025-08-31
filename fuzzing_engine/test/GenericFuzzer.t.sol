// fuzzing_engine/test/GenericFuzzer.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

// A generic interface for common functions.
interface IGenericTarget {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
    function totalSupply() external view returns (uint256);
}

contract GenericFuzzer is Test {
    IGenericTarget target;

    function setUp() public {
        string memory targetEnv = vm.envString("TARGET_CONTRACT");
        address targetAddress = vm.parseAddress(targetEnv);
        target = IGeneric_Target(targetAddress);
    }

    // --- FUZZ TEST 1: ERC20 Total Supply Invariant ---
    function invariant_erc20_totalSupply_should_not_change_on_transfer() public {
        try target.totalSupply() returns (uint256 initialTotalSupply) {
            address randomAddress = address(0x1337);
            uint256 randomAmount = uint256(1);
            try target.transfer(randomAddress, randomAmount) {
                assertEq(target.totalSupply(), initialTotalSupply, "Total supply changed!");
            } catch {}
        } catch {}
    }

    // --- FUZZ TEST 2: Deposit Balance Invariant ---
    function invariant_balance_should_increase_on_deposit() public {
        try target.deposit{value: 0}() {
            uint256 initialBalance = address(target).balance;
            uint256 randomDeposit = 1 ether;
            vm.deal(address(this), randomDeposit);
            target.deposit{value: randomDeposit}();
            assertEq(address(target).balance, initialBalance + randomDeposit, "Balance incorrect.");
        } catch {}
    }
}