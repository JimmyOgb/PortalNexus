// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title TestUSDCMin (Portal Test USD Simulation Token)
 * @notice Ultra-lightweight testnet simulation token for simulating stablecoin liquidity.
 * @dev IMPORTANT DISCLOSURE:
 * This is a TESTNET SIMULATION TOKEN (pUSDC). It is NOT real USDC, has ZERO financial
 * backing, and holds NO real-world monetary value.
 * It features an unrestricted testnet faucet with a strict per-call cap (10,000 pUSDC).
 */
contract TestUSDCMin {
    uint8 public constant decimals = 6;
    uint256 public constant MAX_MINT_PER_CALL = 10_000 * 10 ** 6;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Approval(address indexed src, address indexed guy, uint256 wad);
    event Transfer(address indexed src, address indexed dst, uint256 wad);
    event FaucetMinted(address indexed recipient, uint256 amount);

    function name() external pure returns (string memory) { return "Portal Test USD"; }
    function symbol() external pure returns (string memory) { return "pUSDC"; }

    function faucetMint(address to, uint256 amount) external {
        require(to != address(0) && amount > 0 && amount <= MAX_MINT_PER_CALL);
        balanceOf[to] += amount;
        totalSupply += amount;
        emit FaucetMinted(to, amount);
        emit Transfer(address(0), to, amount);
    }

    function approve(address guy, uint256 wad) external returns (bool) {
        allowance[msg.sender][guy] = wad;
        emit Approval(msg.sender, guy, wad);
        return true;
    }

    function transfer(address dst, uint256 wad) external returns (bool) {
        return transferFrom(msg.sender, dst, wad);
    }

    function transferFrom(address src, address dst, uint256 wad) public returns (bool) {
        require(dst != address(0) && balanceOf[src] >= wad);
        if (src != msg.sender && allowance[src][msg.sender] != type(uint256).max) {
            require(allowance[src][msg.sender] >= wad);
            allowance[src][msg.sender] -= wad;
        }
        balanceOf[src] -= wad;
        balanceOf[dst] += wad;
        emit Transfer(src, dst, wad);
        return true;
    }
}
