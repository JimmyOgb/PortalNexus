// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title NexusLPReceipt
 * @notice ERC-721 Position Receipt representing an enforceable claim on NexusAMM liquidity.
 * @dev Only the authorized NexusAMM contract may mint or burn receipts.
 * Every receipt binds to exact liquidity shares. Transferring the NFT transfers
 * the underlying withdrawal claim. Burning the NFT on withdrawal permanently prevents
 * double-redemption or replay attacks.
 */
contract NexusLPReceipt is ERC721 {
    struct Position {
        address pool;
        uint256 shares;
        uint256 token0Deposited;
        uint256 token1Deposited;
        uint256 timestamp;
    }

    address public immutable amm;
    uint256 private _nextTokenId;

    // tokenId => Position data
    mapping(uint256 => Position) private _positions;

    event ReceiptMinted(uint256 indexed tokenId, address indexed recipient, uint256 shares, uint256 amount0, uint256 amount1);
    event ReceiptBurned(uint256 indexed tokenId, address indexed owner, uint256 shares);

    error OnlyAMM();
    error NonexistentReceipt(uint256 tokenId);
    error ZeroShares();
    error ZeroAddress();

    modifier onlyAMM() {
        if (msg.sender != amm) revert OnlyAMM();
        _;
    }

    constructor(address ammAddress) ERC721("Nexus Liquidity Position Receipt", "NEXUS-LP") {
        if (ammAddress == address(0)) revert ZeroAddress();
        amm = ammAddress;
        _nextTokenId = 1;
    }

    /**
     * @notice Mint a new liquidity receipt tied to actual AMM shares.
     * @dev Only callable by the authorized NexusAMM.
     */
    function mintReceipt(
        address recipient,
        uint256 shares,
        uint256 amount0,
        uint256 amount1
    ) external onlyAMM returns (uint256 tokenId) {
        if (recipient == address(0)) revert ZeroAddress();
        if (shares == 0) revert ZeroShares();

        tokenId = _nextTokenId++;
        _positions[tokenId] = Position({
            pool: amm,
            shares: shares,
            token0Deposited: amount0,
            token1Deposited: amount1,
            timestamp: block.timestamp
        });

        _mint(recipient, tokenId);
        emit ReceiptMinted(tokenId, recipient, shares, amount0, amount1);
    }

    /**
     * @notice Burn a receipt upon redemption.
     * @dev Only callable by the authorized NexusAMM during liquidity withdrawal.
     */
    function burnReceipt(uint256 tokenId) external onlyAMM {
        address owner = ownerOf(tokenId);
        uint256 shares = _positions[tokenId].shares;

        delete _positions[tokenId];
        _burn(tokenId);

        emit ReceiptBurned(tokenId, owner, shares);
    }

    /**
     * @notice Get position details associated with a receipt.
     */
    function getPosition(uint256 tokenId) external view returns (
        address pool,
        uint256 shares,
        uint256 token0Deposited,
        uint256 token1Deposited,
        uint256 timestamp
    ) {
        _requireOwned(tokenId);
        Position memory pos = _positions[tokenId];
        return (pos.pool, pos.shares, pos.token0Deposited, pos.token1Deposited, pos.timestamp);
    }
}
