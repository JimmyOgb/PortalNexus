// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title PortalTestStorage
 * @notice Ultra-minimal, self-contained verification contract for PortalNexus Stage 3D testnet deployment.
 * @dev Zero external imports, zero token approvals, zero payable functions, zero privileged/owner roles.
 */
contract PortalTestStorage {
    uint256 public value;
    address public immutable creator;

    event ValueUpdated(uint256 indexed previousValue, uint256 indexed newValue);

    constructor(uint256 initialValue) {
        value = initialValue;
        creator = msg.sender;
        emit ValueUpdated(0, initialValue);
    }

    function setValue(uint256 newValue) external {
        uint256 prev = value;
        value = newValue;
        emit ValueUpdated(prev, newValue);
    }

    function getValue() external view returns (uint256) {
        return value;
    }
}
