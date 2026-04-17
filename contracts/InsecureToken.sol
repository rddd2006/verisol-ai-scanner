// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title InsecureToken
 * @notice DEMO — ERC-20-like token with multiple security vulnerabilities.
 *         Self-contained (no OpenZeppelin) — compiles in bare Foundry project.
 *
 * Bugs present:
 *   1. Uncapped mint     — owner can mint unlimited tokens
 *   2. No allowance check on transferFrom
 *   3. Integer wrap in _transfer (unchecked)
 *   4. Centralized burn  — owner can burn anyone's tokens
 *   5. Missing zero-address checks on transfer/approve
 */
contract InsecureToken {
    string  public name     = "InsecureToken";
    string  public symbol   = "ISEC";
    uint8   public decimals = 18;

    uint256 public totalSupply;
    address public owner;

    mapping(address => uint256)                     public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to,    uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to,   uint256 value);
    event Burn(address indexed from, uint256 value);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(uint256 initialSupply) {
        owner = msg.sender;
        _mint(msg.sender, initialSupply);
    }

    // ── BUG 1: No supply cap — owner can inflate forever ──────────────────
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // ── BUG 2: Centralised burn of ANY address's tokens ───────────────────
    function adminBurn(address from, uint256 amount) external onlyOwner {
        require(balanceOf[from] >= amount, "Burn exceeds balance");
        unchecked { balanceOf[from] -= amount; }   // BUG 3: unchecked subtraction
        totalSupply -= amount;
        emit Burn(from, amount);
    }

    // ── BUG 4: transferFrom ignores allowance ─────────────────────────────
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        // Missing: require(allowance[from][msg.sender] >= amount)
        _transfer(from, to, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    // ── BUG 5: No zero-address check in _transfer ─────────────────────────
    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "Insufficient balance");
        unchecked {
            balanceOf[from] -= amount;
            balanceOf[to]   += amount;   // can overflow if to == address(0)
        }
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "Mint to zero");
        totalSupply   += amount;
        balanceOf[to] += amount;
        emit Mint(to, amount);
        emit Transfer(address(0), to, amount);
    }
}
