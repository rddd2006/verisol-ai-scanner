// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "./YourToken.sol"; // Replace YourToken.sol with the actual contract name

contract AIGeneratedFuzzer is Test {
    YourToken public token;

    function setUp() public {
        token = new YourToken(); // Initialize the contract under test
    }

    function testApproveFuzz(uint256 amount) public {
        address spender = address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)))));
        bool success = token.approve(spender, amount);
        assert(success);
        uint256 allowance = token.allowance(address(this), spender);
        assert(allowance == amount); //Invariant: Allowance should match approved amount
    }


    function testDecreaseAllowanceFuzz(uint256 amount) public {
        address spender = address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)))));
        token.approve(spender, amount * 2); // Approve a larger amount first
        bool success = token.decreaseAllowance(spender, amount);
        assert(success);
        uint256 allowance = token.allowance(address(this), spender);
        assert(allowance == amount); //Invariant: Allowance should be reduced correctly.
        vm.expectRevert();
        token.decreaseAllowance(spender, amount + 1); // Check for underflow protection
    }

    function testIncreaseAllowanceFuzz(uint256 amount) public {
        address spender = address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)))));
        uint256 initialAllowance = token.allowance(address(this), spender);
        bool success = token.increaseAllowance(spender, amount);
        assert(success);
        uint256 finalAllowance = token.allowance(address(this), spender);
        assert(finalAllowance == initialAllowance + amount); //Invariant: Allowance should be increased correctly.

    }


    function testTransferFuzz(uint256 amount) public {
        address recipient = address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)))));
        uint256 initialBalance = token.balanceOf(address(this));
        //mint some tokens for the test
        token.transfer(address(this), amount * 2);

        bool success = token.transfer(recipient, amount);
        assert(success);
        assert(token.balanceOf(recipient) == amount); //Invariant: Recipient balance should increase
        assert(token.balanceOf(address(this)) == initialBalance + amount * 2 - amount); //Invariant: Sender balance should decrease

        vm.expectRevert(); //check for insufficient balance
        token.transfer(recipient, amount + 1);

    }


    function testTransferFromFuzz(uint256 amount) public {
        address sender = address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)))));
        address recipient = address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp + 1, msg.sender)))));
        token.transfer(sender, amount * 2);
        token.approve(address(this), amount * 2);

        uint256 initialSenderBalance = token.balanceOf(sender);
        uint256 initialRecipientBalance = token.balanceOf(recipient);

        bool success = token.transferFrom(sender, recipient, amount);
        assert(success);
        assert(token.balanceOf(sender) == initialSenderBalance - amount); //Invariant: Sender balance decreases
        assert(token.balanceOf(recipient) == initialRecipientBalance + amount); //Invariant: Recipient balance increases

        vm.expectRevert(); //check for insufficient allowance
        token.transferFrom(sender, recipient, amount + 1);
    }

    // Add more fuzz tests for other state-changing functions as needed.  For example,  functions involving minting and burning would require additional tests with invariants around total supply.


}