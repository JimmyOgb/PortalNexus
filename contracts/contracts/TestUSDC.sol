// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title TestUSDC (Portal Test USD)
 * @notice Testnet mock token for simulating stablecoin liquidity in PortalNexus.
 * @dev IMPORTANT DISCLOSURE:
 * This is a TESTNET SIMULATION TOKEN (pUSDC). It is NOT real USDC, has ZERO financial
 * backing, and holds NO real-world monetary value.
 * It features an unrestricted testnet faucet with a strict per-call cap to prevent spam.
 */
contract TestUSDC is ERC20 {
    uint256 public constant MAX_MINT_PER_CALL = 10_000 * 10 ** 6; // 10,000 pUSDC

    event FaucetMinted(address indexed recipient, uint256 amount);

    error ExceedsMaxMint(uint256 requested, uint256 maxAllowed);
    error ZeroAmount();
    error ZeroAddress();

    constructor() ERC20("Portal Test USD", "pUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @notice Free testnet faucet minting subject to per-call cap.
     * @param to Recipient address for minted tokens.
     * @param amount Amount of pUSDC (6 decimals) to mint.
     */
    function faucetMint(address to, uint256 amount) external {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > MAX_MINT_PER_CALL) revert ExceedsMaxMint(amount, MAX_MINT_PER_CALL);

        _mint(to, amount);
        emit FaucetMinted(to, amount);
    }
}
