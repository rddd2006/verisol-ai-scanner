// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";

/**
 * @title GenericFuzzTest
 * @notice VeriSol AI — standalone Foundry fuzz suite.
 *
 * Run for VulnerableBank:
 *   cp ../../contracts/VulnerableBank.sol src/Target.sol
 *   forge test -vvv --fuzz-runs 512
 *
 * Run for InsecureToken:
 *   cp ../../contracts/InsecureToken.sol src/Target.sol
 *   forge test -vvv --fuzz-runs 512
 *
 * Uses only low-level calls — no direct import of Target needed.
 * Automatically handles constructor args via encoded defaults.
 */
contract GenericFuzzTest is Test {

    address payable target;
    ReentrancyAttacker attacker;

    // ── Try both no-arg and 1-arg constructors ───────────────────────────
    function setUp() public {
        vm.deal(address(this), 1000 ether);

        // Attempt 1: no-arg constructor (VulnerableBank, HoneypotVault, SafeVault, NaiveLendingPool)
        bytes memory creation = abi.encodePacked(vm.getCode("Target.sol:VulnerableBank"));
        address deployed;
        assembly { deployed := create(0, add(creation, 0x20), mload(creation)) }

        // Attempt 2: constructor(uint256) for InsecureToken / similar
        if (deployed == address(0)) {
            bytes memory creationWithArgs = abi.encodePacked(
                vm.getCode("Target.sol:InsecureToken"),
                abi.encode(uint256(1_000_000e18))
            );
            assembly { deployed := create(0, add(creationWithArgs, 0x20), mload(creationWithArgs)) }
        }

        require(deployed != address(0), "Target deployment failed - check Target.sol is copied");
        target = payable(deployed);

        vm.deal(target, 10 ether);
        attacker = new ReentrancyAttacker(target);
        vm.deal(address(attacker), 100 ether);

        vm.label(target,            "Target");
        vm.label(address(attacker), "ReentrancyAttacker");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  TEST 1: Reentrancy — attacker must not drain more than deposited
    // ─────────────────────────────────────────────────────────────────────
    function testFuzz_noReentrancyDrain(uint96 depositWei) public {
        vm.assume(depositWei >= 0.001 ether && depositWei <= 5 ether);

        uint256 attackerBefore = address(attacker).balance;
        bool attacked = attacker.attack{value: depositWei}(depositWei);

        if (attacked) {
            uint256 gained = address(attacker).balance > attackerBefore
                ? address(attacker).balance - attackerBefore : 0;
            assertLe(
                gained, depositWei,
                string(abi.encodePacked(
                    "REENTRANCY: attacker gained ", vm.toString(gained / 1e12),
                    " microETH deposited only ", vm.toString(uint256(depositWei) / 1e12)
                ))
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    //  TEST 2: Over-withdrawal must always revert
    // ─────────────────────────────────────────────────────────────────────
    function testFuzz_cannotOverWithdraw(uint96 deposit, uint96 extra) public {
        vm.assume(deposit >= 0.001 ether && deposit <= 5 ether);
        vm.assume(extra   >= 1 && uint256(deposit) + uint256(extra) <= 50 ether);

        (bool depOk,) = target.call{value: deposit}(abi.encodeWithSignature("deposit()"));
        if (!depOk) return;

        uint256 overAmt = uint256(deposit) + uint256(extra);
        (bool wdOk,) = target.call(abi.encodeWithSignature("withdraw(uint256)", overAmt));
        assertFalse(wdOk, string(abi.encodePacked(
            "OVER-WITHDRAW: withdrew ", vm.toString(overAmt / 1e15),
            " mETH but deposited ", vm.toString(uint256(deposit) / 1e15), " mETH"
        )));
    }

    // ─────────────────────────────────────────────────────────────────────
    //  TEST 3: Arithmetic overflow in any exposed add function
    // ─────────────────────────────────────────────────────────────────────
    function testFuzz_arithmeticNoOverflow(uint128 a, uint128 b) public {
        (bool ok, bytes memory ret) = target.staticcall(
            abi.encodeWithSignature("unsafeAdd(uint256,uint256)", uint256(a), uint256(b))
        );
        if (!ok || ret.length < 32) return;
        uint256 result = abi.decode(ret, (uint256));

        if (a < type(uint64).max && b < type(uint64).max) {
            assertEq(result, uint256(a) + uint256(b), string(abi.encodePacked(
                "OVERFLOW: unsafeAdd(", vm.toString(uint256(a)), ",",
                vm.toString(uint256(b)), ")=", vm.toString(result)
            )));
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    //  TEST 4: Access control — random address must not take ownership
    // ─────────────────────────────────────────────────────────────────────
    function testFuzz_noUnauthorizedOwnerTakeover(address adversary) public {
        vm.assume(adversary != address(0) && adversary != address(this));

        (, bytes memory ob) = target.staticcall(abi.encodeWithSignature("owner()"));
        if (ob.length != 32) return;
        address originalOwner = abi.decode(ob, (address));

        vm.prank(adversary);
        target.call(abi.encodeWithSignature("setOwner(address)", adversary));
        vm.prank(adversary);
        target.call(abi.encodeWithSignature("transferOwnership(address)", adversary));

        (, bytes memory ob2) = target.staticcall(abi.encodeWithSignature("owner()"));
        if (ob2.length != 32) return;
        address newOwner = abi.decode(ob2, (address));

        if (adversary != originalOwner) {
            assertNotEq(newOwner, adversary, string(abi.encodePacked(
                "ACCESS CONTROL: ", vm.toString(adversary), " hijacked ownership"
            )));
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    //  TEST 5: Deposit increases contract balance
    // ─────────────────────────────────────────────────────────────────────
    function testFuzz_depositMonotonicity(uint96 amount) public {
        vm.assume(amount >= 1 && amount <= 10 ether);

        uint256 before = target.balance;
        (bool ok,) = target.call{value: amount}(abi.encodeWithSignature("deposit()"));
        if (!ok) return;

        assertGe(target.balance, before, "INVARIANT: balance decreased on deposit");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  TEST 6: Solvency — contract holds >= recorded user balances
    // ─────────────────────────────────────────────────────────────────────
    function testFuzz_solvencyInvariant(uint96 amount) public {
        vm.assume(amount >= 0.001 ether && amount <= 2 ether);

        (bool depOk,) = target.call{value: amount}(abi.encodeWithSignature("deposit()"));
        if (!depOk) return;

        (, bytes memory balBytes) = target.staticcall(
            abi.encodeWithSignature("balances(address)", address(this))
        );
        if (balBytes.length < 32) return;
        uint256 recorded = abi.decode(balBytes, (uint256));

        assertGe(target.balance, recorded, "SOLVENCY: contract ETH < user's recorded balance");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  TEST 7: Honeypot — user should be able to withdraw own deposit
    // ─────────────────────────────────────────────────────────────────────
    function testFuzz_userCanWithdrawOwnDeposit(uint96 depositAmount) public {
        vm.assume(depositAmount >= 0.001 ether && depositAmount <= 1 ether);

        address user = address(0xBEEF);
        vm.deal(user, depositAmount + 0.1 ether);

        vm.prank(user);
        (bool depOk,) = target.call{value: depositAmount}(abi.encodeWithSignature("deposit()"));
        if (!depOk) return;

        uint256 userBalBefore = user.balance;
        vm.prank(user);
        (bool wdOk,) = target.call(
            abi.encodeWithSignature("withdraw(uint256)", uint256(depositAmount))
        );

        if (!wdOk) {
            (, bytes memory ownerB) = target.staticcall(abi.encodeWithSignature("owner()"));
            if (ownerB.length == 32) {
                emit log("HONEYPOT SIGNAL: user cannot withdraw own deposit");
                emit log_named_address("Contract owner", abi.decode(ownerB, (address)));
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    //  TEST 8: ERC-20 totalSupply invariant (token contracts)
    // ─────────────────────────────────────────────────────────────────────
    function testFuzz_totalSupplyConsistentAfterTransfer(address to, uint96 amount) public {
        vm.assume(to != address(0) && to != target);
        vm.assume(amount > 0 && amount <= 1e24);

        (, bytes memory supBefore) = target.staticcall(abi.encodeWithSignature("totalSupply()"));
        if (supBefore.length < 32) return;
        uint256 tsBefore = abi.decode(supBefore, (uint256));

        target.call(abi.encodeWithSignature("transfer(address,uint256)", to, uint256(amount)));

        (, bytes memory supAfter) = target.staticcall(abi.encodeWithSignature("totalSupply()"));
        if (supAfter.length < 32) return;
        uint256 tsAfter = abi.decode(supAfter, (uint256));

        assertEq(tsBefore, tsAfter, "TOKEN INVARIANT: totalSupply changed after transfer");
    }

    receive()  external payable {}
    fallback() external payable {}
}

// ─────────────────────────────────────────────────────────────────────────────
//  ReentrancyAttacker helper
// ─────────────────────────────────────────────────────────────────────────────
contract ReentrancyAttacker {
    address payable immutable target;
    uint256 public withdrawAmount;
    uint256 public depth;
    uint256 constant MAX_DEPTH = 10;

    constructor(address payable _t) { target = _t; }

    function attack(uint256 _amount) external payable returns (bool) {
        withdrawAmount = _amount;
        depth          = 0;
        (bool dOk,) = target.call{value: msg.value}(abi.encodeWithSignature("deposit()"));
        if (!dOk) return false;
        (bool wOk,) = target.call(abi.encodeWithSignature("withdraw(uint256)", withdrawAmount));
        return wOk;
    }

    receive() external payable {
        if (depth < MAX_DEPTH && address(target).balance >= withdrawAmount) {
            depth++;
            target.call(abi.encodeWithSignature("withdraw(uint256)", withdrawAmount));
        }
    }

    fallback() external payable {}
}
