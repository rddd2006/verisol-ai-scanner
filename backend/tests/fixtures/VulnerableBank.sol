// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * VulnerableBank — intentionally buggy for test assertions.
 * Bug 1: Reentrancy in withdraw()
 * Bug 2: Unchecked arithmetic in unsafeAdd()
 * Bug 3: tx.origin auth in adminWithdraw()
 * Bug 4: Missing access control on setOwner()
 */
contract VulnerableBank {
    mapping(address => uint256) public balances;
    address public owner;

    constructor() { owner = msg.sender; }

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient");
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok);
        balances[msg.sender] -= amount;
    }

    function unsafeAdd(uint256 a, uint256 b) public pure returns (uint256) {
        unchecked { return a + b; }
    }

    function adminWithdraw() public {
        require(tx.origin == owner, "Not owner");
        payable(owner).transfer(address(this).balance);
    }

    function setOwner(address newOwner) public {
        owner = newOwner;
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {}
}
