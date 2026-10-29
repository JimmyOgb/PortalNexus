// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title WPotToken (Wrapped POT)
 * @notice ERC-20 wrapper for EVM-native currency (POT/wei) on Portaldot V3.
 * @dev IMPORTANT ARCHITECTURAL DISCLOSURE:
 * This contract wraps the EVM execution environment's native gas currency (POT/wei).
 * It does NOT wrap Substrate-native POT directly and is NOT a cross-VM bridge.
 * Wrapping is strictly 1:1 backed by native currency held in contract escrow.
 */
contract WPotToken is ERC20, ReentrancyGuard {
    event Deposit(address indexed dst, uint256 wad);
    event Withdrawal(address indexed src, uint256 wad);

    error InsufficientBalance(uint256 requested, uint256 available);
    error NativeTransferFailed();
    error ZeroAmount();

    constructor() ERC20("Wrapped POT", "WPOT") {}

    /**
     * @notice Fallback receive function to deposit native currency.
     */
    receive() external payable {
        deposit();
    }

    /**
     * @notice Deposit native EVM currency (POT/wei) and mint equivalent WPOT tokens.
     */
    function deposit() public payable {
        if (msg.value == 0) revert ZeroAmount();
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @notice Burn WPOT tokens and withdraw equivalent native EVM currency.
     * @param wad Amount of WPOT to burn and native currency to receive.
     */
    function withdraw(uint256 wad) external nonReentrant {
        if (wad == 0) revert ZeroAmount();
        uint256 balance = balanceOf(msg.sender);
        if (balance < wad) revert InsufficientBalance(wad, balance);

        _burn(msg.sender, wad);
        emit Withdrawal(msg.sender, wad);

        (bool success, ) = msg.sender.call{value: wad}("");
        if (!success) revert NativeTransferFailed();
    }
}
